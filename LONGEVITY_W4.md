# Longevity Tier W4 — 合規硬化 + 補品自動化 + 對照頁

> W4 觸發點：Howard 提出「台灣法規不確定能不能這樣賣」+ 「abcd 都要」。本週 5 天全部聚焦於 ship 前必做的合規硬化 + 既有功能完整化 + 業務素材。

## 完成內容（5 天）

### D1 — 用詞合規掃描 + 替換（✅）
全系統用戶可見的「解讀」「功能醫學」改成法律安全的詞彙：

| 原文 | 替換 |
|---|---|
| 「血檢解讀」 | 「血檢觀察筆記」/「趨勢觀察」 |
| 「教練解讀」 | 「教練觀察筆記」 |
| 「綜合解讀」 | 「教練觀察筆記」/「趨勢觀察」 |
| 「功能醫學分類」 | 「進階追蹤分類」 |
| 「功能醫學標準」 | 「進階最佳化標準」 |
| 「採用功能醫學最佳化範圍」 | 「採用最佳化追蹤範圍，參考國際長壽研究文獻」 |
| 「功能醫學醫師」 | 「家醫科或整合醫學醫師」 |
| 「Howard 解讀」 | 「Howard 觀察」/「Howard 的觀察筆記」 |

不動的（這些是正確用法）：
- `medical-disclaimer/page.tsx`：說「我們**不做**診斷/治療/處方」 — 保留
- `not-found.tsx` 「系統診斷」：意思不同
- 內部 code comments：使用者看不到
- DB 欄位名 `coach_interpretation`：內部標識符
- AI prompt 內部術語：注入後 AI 不會輸出禁詞，由 D2 處理

修改的檔案：
- `app/admin/clients/[clientId]/components/LabPanelNotesEditor.tsx`
- `app/admin/clients/[clientId]/page.tsx`
- `app/c/[clientId]/health/timeline/page.tsx`
- `app/c/[clientId]/page.tsx`
- `app/join/success/page.tsx`
- `app/api/line/webhook/route.ts`
- `lib/client-mode.ts`（longevity 描述）
- `lib/lab-draft-engine.ts`（system prompt + mode philosophy）
- `lib/claude.ts`（AI chat system prompt）

### D2 — AI prompt 法律合規鐵則 + 自動 disclaimer（✅）
- `lib/lab-draft-engine.ts` 與 `lib/claude.ts` 兩個 system prompt 都加：
  - 不要用 診斷/治療/處方/藥物
  - 不要說「你有 X 疾病」「你應該吃 X」
  - 用「補品策略可包含」「文獻常用劑量約 X mg/日」
  - 「症狀/異常/就醫」→「建議諮詢家醫科或整合醫學醫師」
  - 不用「功能醫學醫師」（台灣不是正式分科）
- 學員端 timeline panel notes 區塊頂部加註：
  - 「教練基於數據趨勢的生活方式建議，不構成醫療診斷或處方。指標異常請諮詢醫師。」
- 學員端 timeline 底部完整免責提醒
- 新增 `DRAFT_DISCLAIMER` 常數 export 供未來其他元件重用

**驗證**：用 Howard 真實數據再跑 AI 草稿，產出已 0 出現禁詞：
- ❌ 不出現「診斷」「處方」「治療」「藥物」「你應該吃」「功能醫學醫師」「疾病」
- ✅ 用「建議諮詢家醫科或整合醫學醫師」
- ✅ 用「補品策略可包含 X mg/日」「文獻劑量約 X g/日」

### D3 — Mode chip + AI 草稿 audit log（✅）

**Mode chip**:
- 學員端 timeline 標題旁顯示 mode badge（emoji + label + hover tooltip 描述）
- 範例：`🏆 健體備賽` / `🧬 長壽 Protocol`

**AI Audit log**:
- 新表 `ai_draft_audit`（migration `longevity_w4_ai_draft_audit`）
  - 欄位：client_id, panel_date, client_mode, findings_count, findings_brief (JSONB), ai_summary, ai_priorities, model_used, coach_saved_summary, coach_saved_priorities, coach_saved_at
- `/api/lab-panel-notes/draft` 在生成完成後 insert audit row（async，不阻擋）
- `/api/lab-panel-notes` PUT 在教練儲存時，找最近一筆同 client+date audit 並 update coach_saved_*
- 用途：未來 fine-tune prompt 看「AI 寫的 vs 教練改完的」差異

**Bug fix during D3**：
- 抓到：max_tokens 1500 太小，priorities 長時被截斷導致 JSON 解析失敗（fall back 把整個 raw response 塞 summary、priorities 留空）
- 修：bump max_tokens 到 3000 + 加入更穩健的 fence stripping + regex fallback 萃取欄位

### D4 — 補品打卡連動 + 自動填（✅）

**封存補品不出現在打卡清單**：
- `app/api/clients/route.ts` GET 處理：回傳前過濾掉 `archived_at` 不為 null 的 supplements
- 驗證：archive 1 個 → /api/clients 從 14 變 13；restore → 變回 14 ✅
- supplement_logs 保留歷史紀錄不變動（依舊紀錄打卡）

**補品自動填**：
- 新檔案 `lib/supplement-catalog.ts` — 18 個 Howard Protocol 常用補品建議
  - 含名稱、劑量、時間、rationale 起手式、目標血檢指標、分類
  - 涵蓋：心血管、代謝、微量營養、荷爾蒙、恢復、長壽
  - 所有劑量都是「文獻常用範圍」，提示教練仍需依血檢數據調整
- admin 補品名稱欄位加 `<datalist>` autocomplete（HTML 原生，無外部 lib）
- 加「✨ 套用建議」按鈕：從名稱查表，自動填劑量、時間、rationale 起手式

### D5 — Howard 標準 vs 醫院標準對照頁（✅）

- 新頁面 `/c/[clientId]/health/standards`
- 6 大分類，10 個關鍵指標的 side-by-side 對照：
  - 醫院「正常」範圍
  - Howard 最佳化範圍
  - 「為什麼有差」教育性說明
- 包含 ApoB / Lp(a) / HbA1c / 空腹胰島素 / hs-CRP / 同半胱胺酸 / Vit D / 睪固酮 / 游離睪固酮 / TSH
- 桌機表格 + 手機卡片自適應
- 頂部說明「為什麼有兩套標準」
- 底部 amber 免責提醒
- 從 timeline 底部「為什麼 Howard 標準 ≠ 醫院標準」區塊有「看完整對照 →」連結進入

## Debug 結果（我主動跑的）

| 檢查 | 結果 |
|---|---|
| TypeScript（排除既有 cron-daily test bug）| ✅ clean |
| Production build | ✅ ✓ Generating static pages (94/94) |
| `/c/.../health/timeline` 渲染 | ✅ 200 |
| `/c/.../health/standards` 渲染（新頁面）| ✅ 200 |
| admin 頁面（redirect to login）| ✅ 307 |
| AI 草稿合規性（7 個禁詞檢查）| ✅ 全通過 |
| Audit log 寫入 | ✅ summary 372 + priorities 801 字寫進 DB |
| Archive 過濾 active list | ✅ archive 後 14→13；restore 後 →14 |
| Build warning | ✅ 0（之前 dynamic warning 已修）|

## 抓到並修的 Bug

1. **AI 草稿 priorities 被截斷**：max_tokens 1500 + 完整繁體中文 priorities 超過上限 → 沒有結尾 ``` → JSON 解析失敗 → priorities 變空字串。修：bump 3000 + 加 regex fallback。
2. **Archive 後打卡清單還顯示**：`/api/clients` 直接 join 全部 supplements。修：post-filter 掉 archived_at != null。

## 對 Protocol 層商業模式的意義

| 維度 | W3 前 | W4 後 |
|---|---|---|
| 法律合規（用詞）| ⚠️ 大量「解讀」「功能醫學」用詞 | ✅ 全系統清洗 |
| AI 草稿合規 | ⚠️ 沒明確禁詞規則 | ✅ 系統 prompt 法律鐵則 + 7 禁詞測試 |
| 免責提醒 | ⚠️ 只有 disclaimer 頁面有 | ✅ timeline、panel notes、對照頁都有 |
| 教練寫補品 protocol 速度 | 全手打 | ✨ 套用建議 → 1 click 帶入 |
| 銷售 demo 素材 | 學員看不到「為什麼貴」 | ✅ /standards 對照頁直接 show 差異 |
| AI 草稿可追溯 | 寫完就丟 | ✅ ai_draft_audit 全紀錄 |

## 你回來檢查清單

1. 開 admin → 補品 tab → 在「補品名稱」輸入框打「Mag」看 datalist 跳建議
2. 選一個建議名稱（例 Magnesium Glycinate）→ 按「✨ 套用建議」→ 看劑量、時間、rationale 自動填入
3. 開 `/c/nfV43jIV/health/timeline` 看：
   - 標題旁有「🏆 健體備賽」chip
   - panel notes 區塊頂部有免責提醒
   - 底部「為什麼 Howard 標準 ≠ 醫院標準」有「看完整對照 →」按鈕
4. 點完整對照 → `/c/nfV43jIV/health/standards` 看 10 個指標 side-by-side
5. 教練後台血檢 tab 按「✨ AI 草稿」→ 看新版（更嚴謹合規）的產出
6. Supabase 後台看 `ai_draft_audit` 表已有紀錄

## W5 計畫 — 自助上傳血檢

| Day | 任務 |
|---|---|
| D1 | 學員端手打血檢表單（你既有 lab API 已支援，只需學員端 UI）|
| D2 | CSV upload 介面 — 學員上傳健檢試算表 → parse → 確認 → 寫入 |
| D3 | Claude Vision OCR — 上傳健檢 PDF/照片 → AI 萃取數值 |
| D4 | OCR 結果學員確認介面（學員可改）+ edge case 處理 |
| D5 | 全 E2E 測試 + W5 doc |

## W4 後追加：Mode × Tier 解耦（B 選項）

Howard 觀察到 `client_mode='longevity'` 跟 `subscription_tier='protocol'` 指向同一群人，資料模型重複。執行 B 方案：

- **Migration** `longevity_w4_collapse_longevity_mode`：
  - drop `longevity` 從 `client_mode` CHECK constraint
  - 既有 longevity 客戶 → mode=health + tier=protocol（無資料要遷移）
- **lib/client-mode.ts**：刪 longevity，新增 `isLongTermHealthMode()` + `isProtocolTier()` helpers
- **lib/lab-draft-engine.ts**：philosophy 拆成 `MODE_PHILOSOPHIES`（4 種：bb/athletic/health/standard）+ `TIER_DEPTH`（5 種：free/self_managed/coached/protocol/concierge）。`buildSystemPrompt(mode, tier)` 兩者疊加。
- **lib/claude.ts**：同步 mode + tier 注入 `askClaude(messages, ctx, mode, tier)`
- **app/api/lab-panel-notes/draft + app/api/ai/chat**：select 多加 `subscription_tier` 並傳到 lib

### 驗證對比（同一份 Howard 數據）

| 維度 | bodybuilding × coached | health × protocol |
|---|---|---|
| 對睪固酮下降定位 | 「**預期模式**」 | 「**訓練恢復壓力訊號**」 |
| 「預期」出現次數 | 3 | **0** |
| 「長期」出現 | 0 | **1** |
| Priorities 字數 | 872 | **1079**（更深）|
| 機轉解釋 | 較簡略 | 「肝臟代謝負荷」「累積應激」 |

Mode 控制「該不該擔心」、Tier 控制「寫多深」— 兩者解耦清楚。

## 未來改進（記下，不在本週範圍）

1. **AI 草稿 quality dashboard**：用 `ai_draft_audit` 統計「教練改了多少字」「常改哪些段」→ 持續優化 prompt
2. **跨期延續性敘事**：餵入上次 panel_note 給 Claude → 寫「上次叮嚀的 X 做到了嗎」
3. **法律審閱**：landing page 出來前找律師花 NT$5,000-10,000 諮詢一次（用詞、定位、責任範圍）
4. **`Bioavailable Testosterone` 等指標**：補進 `LAB_THRESHOLDS`
5. **PCT / steroid 相關語彙**：AI 草稿偶爾會引用，需要再加 prompt 規則禁止（避免暗示學員用藥）
