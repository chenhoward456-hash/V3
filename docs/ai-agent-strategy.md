# AI Agent 策略 memo

> 2026-05-27 與 Claude 討論結果，未來繼續迭代時參考。

## TL;DR

AI Agent 不是「跟學員聊天」，是 **「整合 + 安全 + 教練擔保」**。
跟 ChatGPT 的差異不在聊天能力，在**動得了 DB + 有歷史 + 有人擔保**。

---

## 成本結構

### 目前（playground 測試）
- 模型：Sonnet 4.6 + prompt caching
- 單次 propose flow：NT$1.0-1.5
- 純聊天（無 tool）：NT$0.3-0.5

### Production 配置（3 招壓成本到 1/3）

| 策略 | 做法 | 節省 |
|---|---|---|
| **Haiku triage** | 先用 Haiku 4.5 判斷意圖（聊天 vs propose）。80% 聊天直接 Haiku 回，20% propose 才升級 Sonnet | 60% |
| **Context 瘦身** | 不灌 14 天全部資料，只灌 7 天 + 重點 summary | 40% input |
| **Per-client rate limit** | 每客戶每天 5 次 propose / 20 次聊天上限 | 上限可控 |

### 預估 production 成本（30 個 coached 學員）
- 平均每對話 NT$0.3-0.5
- 每客戶每天 3 次 = NT$30/月/客
- 30 客 = **NT$1,200-1,500/月**
- vs 訂閱費 NT$90,000/月 → **AI 成本 1.5%**

---

## Tier Gating（vs ChatGPT 差異化的關鍵）

| Tier | 月費 | AI Agent 開放程度 | 差異化 |
|---|---|---|---|
| **Free** | $0 | ❌ 完全不開 | 他們直接用 ChatGPT 就好，沒收入沒成本 |
| **Self-managed** | $499 | 🟡 Read-only Q&A | 比 ChatGPT 強：知道你的血檢、體重、訓練計畫 |
| **Coached** | $2,999 | ✅ 完整 Agent + 教練審核 | 動得了 DB、有歷史、有真人擔保 |
| **Protocol** | $4,999 | ✅✅ 全部 + 主動 retest 提醒 + 自動趨勢分析 | 高端整合 |

---

## ChatGPT 永遠做不到的 5 件事

1. **個人化數據存取**：血檢、體重曲線、訓練紀錄、補品都在你 DB 裡，ChatGPT 看不到
2. **動 DB 的能力**：可以實際更新 macros、寫 personal_notes、log adjustment；ChatGPT 講完就忘
3. **教練在迴路**：所有提案教練審核才生效，有真人擔保
4. **Safety gate**：nutrition-engine 擋住激進建議（min_calories、severity floor、time decay 等）；ChatGPT 會無腦給 1200 kcal cut
5. **個人記憶**：personal_notes 永遠記住「3 月低碳失敗」這種血淚教訓；ChatGPT 對話結束就忘

---

## 銷售敘事

❌ 不要賣「我們有 AI 聊天」（學員會說：那我直接用 ChatGPT 不就好）

✅ 賣「**整合系統 + 安全閘 + 教練擔保**」：
> 「我們的 AI 知道你的血檢、知道你 3 月低碳失敗、知道你的訓練計畫，
> 它的建議會經過教練審核才生效，有 SOP 擋住激進方案。
> ChatGPT 不知道你是誰、也動不了你的 macros。」

可以加：「你這個月用 AI 諮詢 87 次」當客戶可見的 deliverable，讓他們覺得 NT$2999 含 AI 是賺到。

---

## Phase 路線圖

- ✅ **Phase 1**：playground MVP（已完成 2026-05-27）
- 🚧 **Phase 2a**：教練端 LINE webhook 整合（**現在做**）
- ⏳ **Phase 2b**：Cron 主動觸發（每天讀 wellness/body 自動評估）
- ⏳ **Phase 2c**：學員端 LINE bot（Coached tier 才開）
- ⏳ **Phase 3**：Haiku triage + tier gating + rate limit
- ⏳ **Phase 4**：personal_notes UI（教練手動編輯個人筆記）

---

## 還沒解的問題

1. **AI 提案的成功率回饋**：怎麼知道 AI 提的方案套用後有效？需要 outcome tracking
2. **多模型成本配置**：Haiku/Sonnet/Opus 怎麼分工的決策樹要寫清楚
3. **教練不在線時的延遲**：如果學員 LINE 後教練 6 小時沒審，AI 該不該回「教練稍後會看」？
4. **錯誤處理**：AI 提案違反 bounds 被拒絕時，AI 該不該重試？怎麼通知學員/教練？
