# Howard Protocol — ManyChat DM 自動化腳本

> 最後更新：2026-03-13
> 方案：免費 $0 / 自主管理 NT$499（首月 NT$399）/ 教練指導 NT$2,999

---

## 一、ManyChat 設定總覽

### Tag 策略

建立以下 Tags 做受眾分群：

**興趣 Tags**
- `interest_tdee` — 對 TDEE / 熱量計算有興趣
- `interest_carb_cycling` — 對碳循環有興趣
- `interest_blood_test` — 對血液報告有興趣
- `interest_ai` — 對 AI 飲食顧問有興趣
- `interest_case_study` — 對案例 / 成果有興趣

**漏斗階段 Tags**
- `stage_awareness` — 認知階段（剛接觸）
- `stage_consideration` — 考慮階段（在比較）
- `stage_decision` — 決策階段（準備付費）

**行動 Tags**
- `clicked_diagnosis` — 點了 /diagnosis 連結
- `completed_diagnosis` — 完成診斷
- `clicked_join` — 點了 /join 連結
- `converted_free` — 註冊免費方案
- `converted_paid` — 註冊付費方案

**互動 Tags**
- `engaged_reply` — 有回覆訊息
- `no_response` — 完全沒互動

### 一般規則

- 每個序列最多 5 則訊息
- 訊息間隔至少 1 小時（第一則除外，第一則立即發送）
- 用戶回覆「不用了」「不需要」「stop」→ 立即停止序列，回覆：「沒問題！免費工具隨時都在，有需要再找我 🙌」
- 同一用戶 7 天內不重複觸發同一序列
- 安靜時段：22:00 - 08:00 不發送延遲訊息
- 語氣：專業但親切，數據導向，不推銷

---

## 二、8 個關鍵字序列

---

### 序列 1：TDEE

- **觸發關鍵字**：TDEE
- **目標**：導向 /diagnosis
- **Tags**：`interest_tdee`, `stage_awareness`

**訊息 1（立即）**

```
嗨！你想了解你的真實 TDEE 對吧？

先跟你說一個事實：網路上 90% 的 TDEE 計算器，誤差都超過 300 大卡。

我開發了一個更精準的免費計算工具，三分鐘就能完成。要我傳給你嗎？
```

> [按鈕] 好啊，傳給我 / 先了解更多

**訊息 2（按下「好啊」或 30 分鐘後）**

```
這是免費身體組成分析工具 👇

https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=tdee

三分鐘完成，你會看到你的 TDEE。

算完後告訴我你的數字，我可以幫你看看合不合理！
```

> [Tag] `clicked_diagnosis`

**訊息 3（24 小時後，未點連結才發）**

```
嘿，昨天的分析工具你試了嗎？

很多學員跟我說，光是知道自己真正的 TDEE，第一個月就突破了卡關。

三分鐘就能完成，試試看 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=tdee_reminder
```

**訊息 4（48 小時後，仍未互動才發）**

```
最後分享一個東西，我不會再打擾你了 :)

這是我自己六年的體態數據追蹤紀錄：
https://howardprotocol.com/case

看完你就會知道，為什麼「用數據管理身體」跟一般的減肥方法完全不同。

有問題隨時問我！
```

> [Tag] `no_response`（如果完全沒互動）

---

### 序列 2：診斷

- **觸發關鍵字**：診斷
- **目標**：直接導向 /diagnosis
- **Tags**：`interest_tdee`, `stage_awareness`

**訊息 1（立即）**

```
來！這是免費體態診斷工具 👇

https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=diagnosis

填完基本資料（體重、身高、活動量），馬上算出你的 TDEE。

完整的巨量營養素建議需要升級才能看到，但 TDEE 是免費的！
```

> [Tag] `clicked_diagnosis`

**訊息 2（24 小時後）**

```
做完診斷了嗎？

如果你看到結果頁面有些數據是模糊的——那是正常的。

因為目標熱量和巨量營養素比例，需要根據你的訓練、睡眠、壓力等因素調整。免費方案可以先幫你追蹤體重和飲食，隨時可以升級看完整分析。

有任何問題都可以直接回我！
```

**訊息 3（48 小時後，未註冊才發）**

```
對了，如果你好奇「數據化管理身體」到底是什麼感覺，可以看看我自己的故事 👇

https://howardprotocol.com/case

六年的數據全部公開，包括我發現慢性發炎的過程。
```

---

### 序列 3：碳循環

- **觸發關鍵字**：碳循環
- **目標**：教育 → 導向 $499 方案
- **Tags**：`interest_carb_cycling`, `stage_consideration`

**訊息 1（立即）**

```
碳循環是我最推薦的飲食策略之一！

簡單說：你不需要每天吃一樣的熱量。根據訓練日和休息日，調整碳水攝取量。

我自己用了三年，效果很好。學員也是。
```

**訊息 2（30 秒後）**

```
給你一個簡單的碳循環架構：

🔵 高碳日（訓練日）
碳水佔總熱量 50-55%

🟡 中碳日（輕度活動日）
碳水佔總熱量 35-40%

🔴 低碳日（休息日）
碳水佔總熱量 20-25%

但每個人的具體數字不同，要根據體重、體脂和 TDEE 來算。
```

**訊息 3（1 小時後）**

```
想要根據你的數據，自動幫你排碳循環嗎？

Howard Protocol 的 AI 飲食顧問可以做到這件事。

自主管理方案 NT$499/月（首月 NT$399），包含：
✅ AI 飲食顧問（24 小時都能問）
✅ 自動碳循環排程
✅ 飲食數據分析

或者你也可以先做免費體態診斷，算出你的基礎數字 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=carb_cycling
```

**訊息 4（48 小時後）**

```
碳循環的資訊有幫到你嗎？

如果試了之後有任何問題，都可以直接回覆這則訊息。

或者你想看看其他學員的成果？👇
https://howardprotocol.com/case
```

---

### 序列 4：案例

- **觸發關鍵字**：案例
- **目標**：建立信任 → 導向 /remote
- **Tags**：`interest_case_study`, `stage_consideration`

**訊息 1（立即）**

```
想看真實案例對吧！

先分享我自己的——我連續追蹤身體數據六年，包括體重、體脂、血液報告、荷爾蒙...全部公開在這裡 👇

https://howardprotocol.com/case

重點是：過程不是一帆風順的。我中間發現了慢性發炎、荷爾蒙失衡，這些都是靠數據才抓到的。
```

**訊息 2（24 小時後）**

```
看完我的故事了嗎？

很多人問我：「一般人也能做到嗎？」

可以。學員 K.C. 卡關半年後加入，三個月體脂從 28% 降到 21%。
學員 L.Y. 以為自己吃得很健康，數據分析後才發現問題在哪。

他們用的都是自主管理方案（NT$499/月），AI 飲食顧問會根據數據自動調整建議。
```

**訊息 3（48 小時後）**

```
如果你想了解哪個方案適合你，可以看這裡 👇

https://howardprotocol.com/remote

或者先從免費體態診斷開始，了解你現在的身體狀況：
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=case

有問題隨時問我！
```

---

### 序列 5：卡關

- **觸發關鍵字**：卡關
- **目標**：問題意識 → /diagnosis
- **Tags**：`stage_consideration`

**訊息 1（立即）**

```
卡關是最讓人挫折的事，我懂。

我追蹤數據六年，自己也卡過三次。每次解決的方法都不一樣，因為原因不同。

先問你一個問題：你卡關多久了？
```

> [快速回覆] 2-4 週 / 1-3 個月 / 超過 3 個月

**訊息 2（根據回覆）**

如果選「2-4 週」：
```
2-4 週的停滯其實很常見，可能只是正常的體重波動。

但如果你的飲食和訓練都沒有大改變，而體重就是不動，建議先確認一下你的 TDEE 有沒有算對。

免費體態診斷可以幫你重新算 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=plateau_2w
```

如果選「1-3 個月」：
```
1-3 個月的卡關，最常見的原因是代謝適應——你的身體已經適應了你的飲食熱量。

這時候需要做的不是「吃更少」，而是策略性地調整（比如碳循環、飲食休息日）。

建議先確認你目前的 TDEE 和基礎數字 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=plateau_1m
```

如果選「超過 3 個月」：
```
超過 3 個月的卡關，問題可能不只是飲食。

根據我的經驗，長期卡關常常跟這些有關：
• 慢性發炎（血液報告可以看出來）
• 荷爾蒙失衡（壓力、睡眠）
• 代謝率過度下降

我自己就是靠血液報告發現慢性發炎的。

建議先做免費體態診斷看看基礎數字 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=plateau_3m

如果情況比較複雜，教練指導方案（NT$2,999/月）包含血液報告分析。
```

**訊息 3（24 小時後，未點連結才發）**

```
對了，這是我自己六年的體態數據追蹤紀錄，包括我自己卡關的經歷 👇

https://howardprotocol.com/case

看完你可能會發現，你的卡關原因跟你想的不一樣。
```

**訊息 4（72 小時後，仍未互動）**

```
最後提醒一下：Howard Protocol 的免費方案就包含體重追蹤和飲食紀錄。

有時候光是開始記錄，就能發現問題在哪。

免費註冊，不需要信用卡 👇
https://howardprotocol.com/join?plan=free&utm_source=ig&utm_medium=manychat&utm_campaign=plateau_free
```

---

### 序列 6：方案 / 399

- **觸發關鍵字**：方案、399
- **目標**：直接轉換 → /join
- **Tags**：`stage_decision`

**訊息 1（立即）**

```
感謝你的興趣！

Howard Protocol 目前有三個方案：

🆓 免費方案（$0）
體重追蹤 + 飲食紀錄 + TDEE 計算

📊 自主管理（NT$499/月，首月 NT$399）
AI 飲食顧問 + 自動分析 + 碳循環建議
→ 每天不到 NT$17，比一杯咖啡便宜

🏋️ 教練陪跑（NT$2,999/月）
CSCS 教練每週檢視數據 + LINE 一對一
+ 客製化營養 + 血液報告分析
→ 每天不到 NT$100，比一堂私人教練課便宜

完整比較在這裡 👇
https://howardprotocol.com/remote?utm_source=ig&utm_medium=manychat&utm_campaign=plans
```

> [快速回覆] 我想了解 $499 / 我想了解 $2,999 / 先看免費方案

**訊息 2（根據回覆）**

如果選 $499：
```
自主管理方案很適合知道方向、需要工具輔助的人。

大部分學員從這裡開始。AI 飲食顧問可以 24 小時隨時問，系統會自動分析你的飲食數據。

首月 NT$399 優惠中，月繳制，隨時可取消 👇
https://howardprotocol.com/join?plan=self_managed&utm_source=ig&utm_medium=manychat&utm_campaign=plan_499
```

如果選 $2,999：
```
教練陪跑方案適合需要專業判斷和把關的人。

除了所有自主管理功能，Howard 會每週親自審閱你的數據，透過 LINE 跟你一對一溝通，幫你設計客製化營養方案。

如果你有血液報告，也可以一起分析。

有興趣的話可以加 LINE 詳談 👇
https://howardprotocol.com/remote?utm_source=ig&utm_medium=manychat&utm_campaign=plan_2999
```

如果選免費：
```
免費方案完全不用付錢，也不需要信用卡。

先用免費方案建立追蹤習慣，之後想升級隨時可以 👇
https://howardprotocol.com/join?plan=free&utm_source=ig&utm_medium=manychat&utm_campaign=plan_free
```

**訊息 3（48 小時後，未點連結才發）**

```
還在考慮嗎？沒關係！

不管你選哪個方案，第一步都一樣：了解你現在的身體狀況。

這個免費體態診斷只要三分鐘 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=plans_fallback

做完你會更清楚自己需要什麼。
```

---

### 序列 7：血液

- **觸發關鍵字**：血液
- **目標**：教育 → 導向 $2,999 方案
- **Tags**：`interest_blood_test`, `stage_consideration`

**訊息 1（立即）**

```
你對血液報告有興趣！這其實是大部分人忽略的減脂關鍵。

你的血液報告藏著很多線索：
• CRP（C 反應蛋白）→ 反映慢性發炎
• 空腹胰島素 → 反映胰島素敏感度
• 三酸甘油脂 → 反映脂肪代謝效率
• 睪固酮 / 甲狀腺 → 影響代謝率

這些數字比體重計重要得多。
```

**訊息 2（1 小時後）**

```
我自己就是靠血液報告，發現了慢性發炎的問題。

那時候訓練和飲食都做對了，但身體就是沒有反應。直到看了血液報告才找到原因。

完整故事在這裡 👇
https://howardprotocol.com/case

如果你有最近的血液報告，歡迎跟我分享，我可以幫你看看。
```

**訊息 3（24 小時後）**

```
教練指導方案（NT$2,999/月）包含血液報告分析。

Howard 會根據你的血液數據，調整你的營養和補劑建議。

如果你想先了解基本的體態狀況，免費體態診斷也是一個好的開始 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=blood

有問題隨時問我！
```

---

### 序列 8：開始

- **觸發關鍵字**：開始
- **目標**：第一步 → /diagnosis
- **Tags**：`stage_awareness`

**訊息 1（立即）**

```
準備好開始了嗎？太好了！

不管你的目標是減脂、增肌、還是改善體態，第一步都一樣：了解你現在的身體狀況。

這個免費體態診斷只要三分鐘 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=start

填完你會馬上看到你的 TDEE！
```

**訊息 2（24 小時後，未點連結才發）**

```
嘿，昨天的體態診斷你試了嗎？

很多人做完之後跟我說：「原來我的 TDEE 跟我以為的差這麼多！」

三分鐘就能完成，免費的 👇
https://howardprotocol.com/diagnosis?utm_source=ig&utm_medium=manychat&utm_campaign=start_reminder
```

**訊息 3（48 小時後，已完成診斷但未註冊）**

```
看到你的分析結果了嗎？

如果你想要保存結果、開始追蹤體重和飲食，免費方案馬上就能開通，不需要信用卡 👇
https://howardprotocol.com/join?plan=free&utm_source=ig&utm_medium=manychat&utm_campaign=start_join

想要 AI 飲食顧問幫你分析數據？自主管理方案首月只要 NT$399。

有問題隨時問我！
```

---

## 三、IG 貼文留言自動回覆模板

每當用戶留言關鍵字時，除了私訊，也在貼文底下公開回覆：

| 關鍵字 | 公開回覆 |
|--------|----------|
| TDEE | 已經私訊你了！裡面有免費的 TDEE 計算工具 💪 |
| 診斷 | 私訊已送出！免費體態診斷三分鐘搞定 🔍 |
| 碳循環 | 收到！碳循環的完整說明已經私訊給你了 📊 |
| 案例 | 學員案例已經私訊給你囉！看完你會有感覺的 🔥 |
| 卡關 | 懂你的痛！已經私訊你了，裡面有卡關自我檢測的方法 💡 |
| 方案 / 399 | 方案比較已經私訊你了！有問題直接問 🙌 |
| 血液 | 血液報告解讀指南已私訊！這個很多人不知道 🩸 |
| 開始 | 太棒了！第一步的工具已經私訊給你了 🚀 |

---

## 四、快速參考表

| 關鍵字 | 目標頁面 | 目標方案 | Tag | 訊息數 |
|--------|----------|----------|-----|--------|
| TDEE | /diagnosis | Free → $499 | `interest_tdee` | 4 |
| 診斷 | /diagnosis | Free → $499 | `interest_tdee` | 3 |
| 碳循環 | /diagnosis → /remote | $499 | `interest_carb_cycling` | 4 |
| 案例 | /case → /remote | Any | `interest_case_study` | 3 |
| 卡關 | /diagnosis | Free → depends | `stage_consideration` | 4 |
| 方案 / 399 | /remote → /join | $499 / $2,999 | `stage_decision` | 3 |
| 血液 | /case → /remote | $2,999 | `interest_blood_test` | 3 |
| 開始 | /diagnosis → /join | Free | `stage_awareness` | 3 |

---

## 五、設定 Checklist

照著這個順序在 ManyChat 設定：

- [ ] 建立所有 Tags（第一節列出的全部 Tags）
- [ ] 建立 8 個 Keyword Automation（每個序列一個）
- [ ] 每個 Automation 設定觸發關鍵字（設定「包含」而非「完全匹配」）
- [ ] 每個序列的訊息 2-4 設定 Smart Delay（依照時間間隔）
- [ ] 設定條件判斷：未點連結 / 未註冊 才發送後續訊息
- [ ] 設定 Stop Condition：回覆「不用」「不需要」「stop」→ 停止序列
- [ ] 設定 Quiet Hours：22:00 - 08:00 不發送
- [ ] 設定 Frequency Cap：同一用戶 7 天內同序列最多觸發 1 次
- [ ] 設定公開留言自動回覆（第三節的模板）
- [ ] 自己測試：留言每個關鍵字，確認私訊和公開回覆都正確
- [ ] 每週檢查 ManyChat Analytics：打開率、點擊率、轉換到 /diagnosis 的比例
