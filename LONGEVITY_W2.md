# Longevity Tier W2 — 趨勢警示引擎 + AI 解讀草稿

> 本文是 W2 的執行紀錄與 handoff。W2 取代了原本「補品 protocol 版本化」的計畫，因為 W1 末期測試暴露出更核心的問題：教練手寫 panel note 會 cherry-pick 漂亮數據，漏掉惡化中的指標。Howard 自己的睪固酮在 2.5 個月內下降 35% 但被我（AI agent）的 placeholder summary 整個跳過。沒有自動偵測與 AI 起稿，NT$4,999 Protocol 層無法 scale 到 5 人。

## 完成內容

### D1 — 趨勢分析引擎（✅）
- 檔案：`lib/lab-trend-analyzer.ts`
- 純函式，吃 `LabResultRow[]` + 性別，吐 `LabFinding[]`
- 偵測：
  - 跨閾值劣化（normal → attention）
  - 顯著變化（>10% / 20% 階梯）
  - 距離 Howard 最佳範圍
  - 範圍型 vs 越高越好 vs 越低越好的趨勢方向判斷
- 嚴重度分級：`critical / attention / watch / improving / optimal`
- 排序：critical → attention → watch → improving → optimal

### D2 — AI 草稿引擎 + API（✅）
- 檔案：`lib/lab-draft-engine.ts` — 呼叫 Claude Haiku 4.5
- 檔案：`app/api/lab-panel-notes/draft/route.ts` — 教練權限
- System prompt 注入 Howard Protocol 哲學：
  - 不准 cherry-pick，critical/attention 必須出現在 summary
  - 變差優先寫，跨指標關聯必須點出
  - 行動建議要具體（劑量、頻率、複測時程）
  - 不過度醫療化（教練助手，不是醫師）
- 輸出嚴格 JSON `{ summary, priorities }` + findings brief

### D3 — 教練後台「✨ AI 草稿」按鈕（✅）
- 修 `app/admin/clients/[clientId]/components/LabPanelNotesEditor.tsx`
- 新增 indigo 按鈕「✨ AI 草稿」 — 11-15 秒生成
- 已有內容會 confirm 才覆蓋
- 生成後在卡片內顯示「AI 偵測到的關鍵指標」標籤群（依嚴重度色票）

### D4 — 學員端 timeline 警示 banner（✅）
- 新 API：`app/api/lab-findings/route.ts` — 公開讀取（學員可看自己）
- 修 `app/c/[clientId]/health/timeline/page.tsx`
- 在儀表板頂部顯示：
  - 紅底 banner（有 critical）/ 黃底 banner（只有 attention）
  - 「N 個指標需要立即關注」
  - 展開列出每筆：指標、最新值、最佳範圍、變化%
- 學員第一眼看到的不是「漂亮數字」而是「該注意什麼」

### D5 — Polish（✅）
- 修了 severity 邏輯：顯著進步（>15%）優先於「目前還在 attention」
  → 範例：同半胱胺酸 15→9（-40%）從 `attention` 改正為 `improving`

## 用 Howard 真實數據驗證

請求：`POST /api/lab-panel-notes/draft` for `nfV43jIV`

**Findings 統計**：
- critical: 4（游離睪固酮 -40.8%、睪固酮 -35.4%、SHBG +57.4%、鐵蛋白 250 偏高）
- attention: 2
- watch: 6
- improving: 2
- optimal: 8

**AI 自動 summary 涵蓋了：**
- 心血管 / 代謝面亮眼（沒漏好消息）
- 睪固酮系統下降（CRITICAL — placeholder 漏的）
- SHBG 上升解釋游離 T 下降（跨指標關聯）
- 雌二醇 42.4 偏高（與睪固酮下降的組合）
- 鐵蛋白 250 偏高（我與 placeholder 都漏掉的，AI 主動抓到）
- 維生素 D 從 27→59 進步（鼓勵）
- 同半胱胺酸 9 仍偏高

**AI 自動 priorities 提出：**
- 同半胱胺酸：B12 1000 mcg/週 + 葉酸 800 mcg/日 + 甜菜根汁 250 mL/日，8 週複測
- 鐵蛋白：停止鐵補、加做 hsCRP + sTfR、4 週後複檢
- 睪固酮支持：鋅 15-25 mg + 鎂甘氨酸 400-500 mg + 維生素 D 4000 IU；賽後恢復期預計 8-12 週反彈
- 雌二醇：芳香酶抑制劑在功能醫學不建議；確認脂肪攝取 + 十字花科 500 g/日
- TSH/T4 異常組合 → 加做 TPO + 甲狀球蛋白抗體排除自體免疫
- 賽後 4-6 週完整複檢時程

**回應時間**：~11.5 秒（Haiku 4.5）

## 對 Protocol 層商業模式的意義

- 教練寫 panel note 時間：從 ~30 分鐘變 ~5 分鐘（只審 AI 草稿 + 微調）
- 5 人 × 每季 1 次 = 25 分鐘/季 vs 原本 150 分鐘/季
- 規模化臨界點解鎖：從「教練人腦上限 3-5 人」變「可擴展到 10-15 人」
- 學員自己看 timeline 也會直接看到「N 個指標需要注意」 — 不依賴教練主動提醒

## 未來改進（記下，不在 W2 範圍）

1. **AI 草稿快取**：同一 panel_date 同樣 findings → 不重複燒 token
2. **教練修改前後 diff**：記錄 AI 草稿 vs 最終 saved 內容，未來可用來 fine-tune prompt
3. **跨期比較**：把上次 panel note + 上次 priorities 也餵給 Claude，讓它寫「上次叮嚀的 X 做到了嗎」這種延續性敘事
4. **`Bioavailable Testosterone`** 等指標還沒在 `LAB_THRESHOLDS`，目前會 fall back 到 attention 警示但無正確閾值 — 需要把 Howard 自己用的非標準指標補進去
5. **AI 草稿 audit log**：存到 DB（input findings + output draft + 教練最終版本）方便日後檢討

## 接下來 W3 計畫候選

回到原計畫 → **W2 (取消) Supplement protocol 版本化** 改成 W3 主題。
或者 W3 推進「AI 教練 mode-aware」（健康模式 vs 備賽模式不同 prompt）— 因為 W2 已經把 AI 帶進系統，順勢處理可能更省力。
