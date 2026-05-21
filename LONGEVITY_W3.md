# Longevity Tier W3 — Mode 整合 + 補品 Protocol 版本化

> W3 = 「Mode 上游 + 補品下游」一起做。W2 暴露 placeholder cherry-pick 問題已解；W3 進一步讓 AI 知道學員當前哲學（備賽 vs 長壽 = 不同建議策略），並把補品從「狀態」變「事件流」記錄為什麼開、為什麼停。

## 完成內容（5 天全部 ✅）

### D1 — Mode 系統正式定型
- `lib/client-mode.ts` 加入 `longevity` mode（NT$4,999 Protocol tier 對應）
- 加入 `isLongevityMode()` 和 `isLongTermHealthMode()` helpers
- Migration `longevity_w3_add_modes`：
  - 更新 `clients.client_mode` CHECK constraint（含 longevity）
  - 加入 `subscription_tier` 'protocol' (NT$4,999) + 'concierge' (未來 NT$12,000)
- **Hotfix migration `longevity_w3_fix_old_client_mode_check`**：
  - 抓到 bug — 原本 20260316 migration 用 `chk_client_mode` 名稱建 constraint，我 W3 D1 用了 `clients_client_mode_check` 不同名字，導致舊的還在擋 longevity insert。drop 舊的。

### D2 — Mode 注入 AI（兩處）
- `lib/lab-draft-engine.ts`：
  - 拆出 `SYSTEM_PROMPT_BASE` + `MODE_PHILOSOPHIES` 字典
  - 每個 mode 有 5-10 行哲學注入
  - bodybuilding: 「短期可接受代價」
  - longevity: 「零容忍犧牲睡眠/恢復/荷爾蒙；介入優先序 sleep > nutrition > supplements > training」
- `lib/claude.ts`：
  - `askClaude(messages, clientContext, clientMode?)` 加入第三參數
  - 從伺服器端注入 mode 哲學（不從前端，防 prompt injection）
- `app/api/ai/chat/route.ts`：
  - select client.client_mode 並傳給 askClaude

### D3 — Supplements schema 版本化
- Migration `longevity_w3_supplement_versioning`：
  - 新增 6 個欄位：`started_at`, `archived_at`, `archive_reason`, `replaced_by_id`, `coach_rationale`, `mode_context`
  - Index：`idx_supplements_active_client` 加速 active 查詢
  - 回填：32 個既有 supplements 全部 `started_at = created_at::date`
- 新 API `POST /api/supplements/archive`：教練專用，封存補品 + reason + 可選 replaced_by
- 新 API `DELETE /api/supplements/archive?supplementId=X`：還原（reactivate）
- 新 API `GET /api/supplements/history?clientId=X`：學員公開讀取，回傳 `{ active, archived, all }`
- **Bug fix**：`/api/admin/clients` `ALLOWED_SUPP_FIELDS` 過去過濾掉 `why / sort_order`，現在改寫白名單為 DB 真正存在的欄位 + W3 新欄位

### D4 — 教練後台「封存 + rationale」UX
- 修 `app/admin/clients/[clientId]/page.tsx`：
  - `Supplement` interface 加 6 個新欄位
  - `addSupplement()` 自動帶入 `started_at = 今天` + `mode_context = client.client_mode`
  - 新 `archiveSupplement()` handler — confirm reason + 呼叫 archive API
  - 補品卡片 UI：
    - 加 開始日期 / 當時 mode / 教練 rationale 欄位
    - 「刪除」改為「📦 封存」（saved item）或「取消新增」（unsaved item）
- 新元件 `ArchivedSupplementsList.tsx`：折疊區塊顯示已封存補品（rationale + 停掉原因 + 取代 + 期間 + 還原按鈕）
- 掛到血檢 tab 底部

### D5 — 學員端 timeline 補品演進區塊
- 修 `app/c/[clientId]/health/timeline/page.tsx`：
  - 載入 `/api/supplements/history` 同時間
  - 新「💊 你的補品 Protocol」區塊：
    - 目前在吃（綠色左邊框 + rationale + 起始日期 + mode）
    - 過去 protocol（折疊 + 當時 rationale + 停掉原因 + 被誰取代）
  - 位置：panel notes 下方、分類顯示上方

## Debug 結果（我主動跑的）

| 檢查 | 結果 |
|---|---|
| TypeScript（排除既有 cron-daily test bug）| ✅ clean |
| Production build | ✅ ✓ Generating static pages (94/94) |
| `/api/lab-findings` smoke test | ✅ critical=4, attention=2 |
| `/api/supplements/history` smoke test | ✅ active=14, archived=0 |
| `/api/lab-panel-notes/draft` (bodybuilding mode) | ✅ 11s 回應，22 findings，tone「尚在預期內」 |
| `/api/lab-panel-notes/draft` (longevity mode) | ✅ tone「核心問題是睪固酮軸崩潰」+「過度 cut / 訓練壓力過高」 |
| Supplement archive round-trip | ✅ active 14→13 archived→restore→14 |
| Page render: `/c/.../health/timeline` | ✅ 200 |
| Page render: `/admin/clients/...` | ✅ 307 (redirect to login, expected) |

### 抓到並修的 bug

1. **Mode CHECK constraint duplication**：原 migration 建 `chk_client_mode` 沒含 longevity，我 D1 用了不同名字建新的 → 舊的還在擋。Hotfix migration 把舊的 drop 掉。
2. **Supplements admin 白名單漏欄位**：`why`、`sort_order` 是 DB 真存在但被 admin save 過濾掉。順手補齊。
3. **`/api/lab-findings` 和 `/api/supplements/history` build 警告**：加 `export const dynamic = 'force-dynamic'`。
4. **`Bioavailable Testosterone` 等非標準指標**：trend analyzer 會 fall back 到 attention，但無正確閾值（W4 議題）。

## Mode-aware AI 實際對比（同一份數據，Howard）

**bodybuilding mode**:
> 陳胤豪目前處於備賽 cut 中期，荷爾蒙下降幅度顯著但**尚在預期內**：睪固酮 403.92 ng/dL (-35.4%)...典型 cut 末期荷爾蒙特徵。

**longevity mode**:
> 陳胤豪的**核心問題是睪固酮軸崩潰**：總睪固酮從 625 降至 404 ng/dL（-35%）...指向「**過度 cut / 恢復不足 / 訓練壓力過高**」的典型荷爾蒙縮水信號。

## 商業意義

| 維度 | W2 前 | W2 後 | W3 後 |
|---|---|---|---|
| 教練寫 panel note 時間 | 30 min | 5 min（AI 草稿） | 5 min（mode-aware 草稿，少改） |
| 不同客群（備賽 vs 長壽）統一 prompt | ❌ 會搞混 | ❌ 會搞混 | ✅ 自動切換哲學 |
| 補品 protocol 演進故事 | ❌ 改了就消失 | ❌ | ✅ 完整保留 |
| 給研究對象的 demo | ✅ 儀表板 | ✅ + AI 解讀 | ✅ +「protocol 是演進的」故事 |

## 未來改進（記下）

1. **Mode 變更歷史**：目前 client_mode 只記當下，不知道何時從 bodybuilding 切到 health。考慮新表 `client_mode_history`，跟補品 mode_context 對應更完整。
2. **AI 草稿快取**：同 findings + 同 mode → 不重燒 token。
3. **跨期延續性敘事**：把上次 panel_note + priorities 一起餵 Claude，寫「上次叮嚀的 X 做到了嗎」。
4. **`Bioavailable Testosterone`** 等指標補進 `LAB_THRESHOLDS`。
5. **AI 草稿 audit log**：DB 存 input findings + output draft + 教練修改後版本，未來 fine-tune。
6. **學員端 mode 標示**：目前 timeline 沒顯示「你目前是 X mode」，加個小 chip。

## Howard 你回來該做的事

1. **進 admin 試「✨ AI 草稿」按鈕** — 看 mode 切換有沒有差
2. **試補品「📦 封存」流程**：挑一個補品按封存、填 reason、看左邊頁面消失、滾下去看「過去 protocol」有出現它
3. **進學員端 timeline** 看「💊 你的補品 Protocol」區塊
4. **production 環境** Vercel 那邊也要設 `ANTHROPIC_API_KEY`（如果還沒）

## W4 候選

- **AI 草稿 audit log** + **跨期延續性敘事**（讓 Howard 看「上次叮嚀的做到沒」）
- 或回到原 12 週計畫 **AI chat mode-aware（W3 已做掉一半）+ Apple HealthKit Shortcuts**
