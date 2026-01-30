import { notFound } from 'next/navigation'
import Link from 'next/link'
import { generateArticleSchema } from './schema'
import Breadcrumb from '@/components/Breadcrumb'
import ArticleTracker from './ArticleTracker'
import LineButton from '@/components/LineButton'

// 文章內容（之後可以從 Markdown 檔案讀取）
const blogContent: Record<string, {
  title: string
  date: string
  category: string
  readTime: string
  content: string
}> = {
  'muscle-building-science-2025': {
    title: '2025 增肌真相：這三個科學新發現，直接打臉你的健身常識',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '5 分鐘',
    content: `
## 前言：你的健身常識可能已經過時了

2025 年的運動科學研究，推翻了很多我們以為「理所當然」的訓練觀念。

這三個新發現，可能會顛覆你對增肌的認知。

---

## 💪 真相 1：學會「偷懶」做半程

### **傳統觀念：**
- 動作一定要做全程
- 半程是偷懶、效果差

### **2025 年科學新發現：**
**在肌肉「被拉到最長」的底部做半程，生長訊號竟然比做全程還強！**

這叫做「長位半程」（Lengthened Partials）。

### **為什麼有效？**
- 肌肉在拉長狀態下承受張力，機械張力最大
- 離心收縮（肌肉拉長）是肌肉生長的關鍵
- 在底部多停留，刺激更多肌纖維

### **實際應用：**

**深蹲：**
- 蹲到底後，不要急著站起來
- 在最下面做 3-5 次小幅度上下移動
- 保持肌肉在拉長狀態

**臥推：**
- 槓鈴下降到胸口後
- 在底部做 2-3 次半程推舉
- 不要完全推到頂

**引體向上：**
- 下降到手臂伸直後
- 在底部做 2-3 次小幅度拉起
- 保持背肌張力

### **我的實測經驗：**
在深蹲加入長位半程後，大腿圍度在 4 週內增加 1.5cm，比之前單純做全程有效。

---

## 🔥 真相 2：練完不痠，才是練得好

### **傳統觀念：**
- 沒有痠痛 = 沒練到
- 越痠越有效

### **2025 年科學新發現：**
**太強烈的痠痛代表發炎，身體會忙著「修補破牆」，而不是「蓋新樓」。**

### **為什麼痠痛不等於增肌？**
- 肌肉痠痛（DOMS）= 肌肉損傷
- 過度損傷會延長恢復時間
- 身體資源用在修復，而非生長

### **真正讓你變壯的是：**
**機械張力（Mechanical Tension）**，不是肌肉損傷。

### **實際應用：**

**控制訓練強度：**
- RPE 7-8（還能做 2-3 下）
- 不要每組都練到力竭
- 保留一點餘力

**增加訓練頻率：**
- 同一肌群每週練 2-3 次
- 每次訓練量適中
- 比一次練爆更有效

**優先恢復：**
- 睡眠 7-9 小時
- 蛋白質攝取充足（每公斤體重 2g）
- 適度補充 Omega-3 降低發炎

### **我的實測經驗：**
從「每次練到爆」改為「適度刺激、高頻率」後，肌肉生長速度反而更快，而且不會一直痠痛到影響生活。

---

## 🎯 真相 3：你的力竭通常是假的

### **傳統觀念：**
- 感覺沒力了就停
- 不用每組都練到力竭

### **2025 年科學新發現：**
**很多人以為沒力了，其實那是腦袋在騙你。**

想長肌肉，最後一組請務必拚到 **RIR 0**（一下都做不起來）。

### **為什麼要真力竭？**
- 肌肉生長需要「高閾值運動單位」被徵召
- 只有接近力竭時，才會徵召所有肌纖維
- 前面幾組可以保留，但最後一組要拚

### **什麼是真力竭？**
- 動作速度明顯變慢
- 肌肉開始顫抖
- 臉部表情扭曲（醜臉）
- 真的一下都做不起來

### **實際應用：**

**前幾組：RIR 2-3**
- 保留 2-3 下的餘力
- 累積訓練量
- 避免過早疲勞

**最後一組：RIR 0**
- 拚到真的做不起來
- 確保所有肌纖維被徵召
- 這才是真正的增肌刺激

**安全提醒：**
- 大重量動作（深蹲、硬舉）建議 RIR 1-2
- 孤立動作（二頭彎舉、腿屈伸）可以 RIR 0
- 有保護者或安全架才做真力竭

### **我的實測經驗：**
開始認真做「最後一組真力竭」後，肌肉泵感明顯更強，生長速度也加快了。

---

## 💡 總結：科學化訓練的三大原則

### **1. 長位半程 > 全程**
在肌肉拉長位置多做半程，刺激更強。

### **2. 適度刺激 > 練到爆**
控制強度，增加頻率，恢復更快，長得更好。

### **3. 最後一組真力竭**
前面保留，最後拚命，確保所有肌纖維被徵召。

---

## ⚠️ 重要提醒

### **這些方法適合誰？**
- 有 6 個月以上訓練經驗
- 動作模式已經正確
- 了解自己的身體狀況

### **不適合新手：**
- 新手優先學習正確動作
- 建立神經適應
- 不要急著用進階技巧

### **安全第一：**
- 大重量動作不要做真力竭
- 有保護者或安全架
- 身體不適立即停止

---

## 免責聲明

**這是基於科學研究和個人訓練經驗的分享，不構成醫療建議。**

所有內容均基於公開研究資料與訓練經驗分享，僅供教育與資訊參考之用。在進行任何訓練調整前，請務必諮詢合格的教練或醫療人員。

---

## 想了解更多？

如果你想要根據最新科學優化訓練計畫，歡迎透過 LINE 預約免費諮詢。  
我會根據你的訓練經驗，設計最適合你的訓練方法。

**但記住：這不是醫療諮詢，而是訓練指導。**

[預約免費諮詢](https://lin.ee/dnbucVw)
    `
  },
  'female-menstrual-cycle-training': {
    title: '女生必看！月經週期是你的減脂作弊碼：順著週期練才會瘦',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '6 分鐘',
    content: `
## 前言：不要再用男生的邏輯，練女生的身體

很多女生私訊問我：「教練，為什麼我練得很累卻瘦不下來，甚至越練越水腫？」

答案很殘酷：**因為你在用男生的邏輯，練女生的身體。**

科學研究告訴我們，女性的荷爾蒙波動極大，如果你不懂得順著「週期」練，你只是在跟自己的內分泌打架。🥊

---

## 🔬 女性 vs 男性：荷爾蒙差異

### **男性荷爾蒙：**
- 睪固酮每天波動小（早上高、晚上低）
- 可以每天高強度訓練
- 恢復速度穩定

### **女性荷爾蒙：**
- 雌激素、黃體酮每月大幅波動
- 不同週期適合不同訓練強度
- 恢復速度隨週期變化

**這就是為什麼女生不能照抄男生的訓練計畫！**

---

## 🗓️ 把你的一個月分成兩半

### **Phase 1：濾泡期（月經走後第 1-14 天）**

這是你的「無敵星星」期！⭐️

**荷爾蒙變化：**
- 雌激素上升
- 胰島素敏感度最好
- 身體耐受力極高
- 恢復速度快

**訓練策略：**
✅ **拿起你最重的壺鈴！**
- 大重量訓練（深蹲、硬舉、臥推）
- 高強度間歇訓練（HIIT、SIT）
- 爆發力訓練（跳躍、衝刺）

**營養策略：**
- 可以吃較多碳水
- 身體利用效率最好
- 增肌減脂的黃金窗口

**我的建議：**
- 每週 3-4 次高強度訓練
- 挑戰個人紀錄
- 這時候是你變強的最佳時機

---

### **Phase 2：黃體期（月經來前第 21-28 天）**

這時候**放過自己**！

**荷爾蒙變化：**
- 黃體酮升高
- 體溫升高（約 0.3-0.5°C）
- 代謝壓力變大
- 恢復速度變慢
- 容易水腫

**訓練策略：**
✅ **降階訓練**
- Zone 2 有氧（輕鬆慢跑、快走）
- 輕重量流動訓練（瑜伽、皮拉提斯）
- 伸展、放鬆
- 不要逼自己破紀錄

**營養策略：**
⚠️ **關鍵鐵律：練前一定要吃碳水！**
- 這時候身體對熱量赤字最敏感
- 餓著肚子硬練 → 皮質醇飆高 → 變成「泡芙人」
- 建議：練前吃 20-30g 碳水（香蕉、地瓜）

**我的建議：**
- 每週 2-3 次輕度訓練
- 不要勉強自己
- 這時候是恢復期，不是衝刺期

---

## 📊 實際訓練週期範例

### **第 1-14 天（濾泡期）：**
- 週一：深蹲 5x5（80-85% 1RM）
- 週二：HIIT 20 分鐘
- 週三：休息或輕度有氧
- 週四：硬舉 5x5（80-85% 1RM）
- 週五：上肢肌力訓練
- 週六：衝刺間歇
- 週日：休息

### **第 21-28 天（黃體期）：**
- 週一：輕重量深蹲 3x12（60% 1RM）
- 週二：Zone 2 慢跑 30 分鐘
- 週三：休息
- 週四：瑜伽或皮拉提斯
- 週五：輕度肌力訓練
- 週六：散步或休息
- 週日：休息

---

## 💡 關鍵心得

### 1. 不要跟自己的身體對抗
順著週期調整訓練強度，效果會更好。

### 2. 濾泡期是增肌減脂黃金期
這時候可以吃多一點、練重一點。

### 3. 黃體期要降階訓練
不要勉強，這時候恢復比訓練更重要。

### 4. 追蹤你的週期
用 App（Flo、Clue）或手寫日記追蹤，了解自己的身體。

### 5. 每個人不一樣
有些人週期很規律，有些人不規律。  
觀察自己的身體反應，調整訓練計畫。

---

## ⚠️ 重要提醒

### **什麼時候需要看醫生？**
- 如果你的月經週期非常不規律（超過 35 天或少於 21 天）
- 如果你有嚴重的經前症候群（PMS）
- 如果你有多囊性卵巢症候群（PCOS）

**請務必諮詢婦產科醫師或內分泌科醫師。**

### **我不建議的做法：**
- ❌ 黃體期還硬要高強度訓練（只會累積疲勞）
- ❌ 整個月都吃很少（會打亂荷爾蒙）
- ❌ 完全不追蹤週期（不知道自己在哪個階段）

---

## 免責聲明

**這是基於科學研究和個人經驗的分享，不構成醫療建議。**

所有內容均基於公開研究資料與訓練經驗分享，僅供教育與資訊參考之用。每個人的生理狀況、荷爾蒙波動都不同，在進行任何訓練調整前，請務必諮詢合格的醫師、營養師或專業教練。

---

## 想了解更多？

如果你想要根據自己的週期設計客製化訓練計畫，歡迎透過 LINE 預約免費諮詢。  
我會根據你的身體狀況，設計最適合你的訓練週期。

**但記住：這不是醫療諮詢，而是訓練指導。**

[預約免費諮詢](https://lin.ee/dnbucVw)
    `
  },
  'sleep-quality-hrv-optimization': {
    title: '為什麼你睡 8 小時還是累？HRV 告訴你睡眠品質的真相',
    date: '2026-01-30',
    category: '恢復優化',
    readTime: '7 分鐘',
    content: `
## 前言：睡 8 小時還是累到像殭屍？

說實話，我以前也是這樣。

鬧鐘響了按掉，再睡 10 分鐘，起床後整個人還是廢的，腦袋像被塞了一團棉花。

後來我開始追蹤數據，才發現問題不是「睡多久」，而是「睡得有多爛」。

---

## 🔴 睡眠的真相：時間 ≠ 品質

你的身體有個指標叫 **HRV（Heart Rate Variability，心率變異度）**，它能看出你的自律神經系統有沒有真的在休息。

### **什麼是 HRV？**

HRV 測量的是你心跳間隔的變化。

- **HRV 高（綠色）**：你的副交感神經活躍，身體在真正恢復
- **HRV 低（紅色）**：你的交感神經還在亢奮，身體只是在「躺平發炎」

**簡單說：**  
如果你睡了 8 小時，但 HRV 低到爆，代表你的身體根本沒在休息，只是在床上「空轉」。

### **我的數據變化：**

| 時期 | 平均 HRV | 睡眠時間 | 早上狀態 |
|------|----------|----------|----------|
| 優化前 | 52 ms | 7-8 小時 | 累到像殭屍 |
| 優化後 | 78 ms | 7-8 小時 | 精神飽滿 |

**同樣睡 7-8 小時，但 HRV 提升 50%，早上的狀態完全不同。**

---

## 🟠 3 個原因讓你「睡爛」

我自己試過很多方法，最後發現這 3 個是破壞睡眠品質的主因：

### **1. 睡前滑手機（藍光壓制褪黑激素）**

**為什麼有害？**
- 藍光會讓大腦以為「現在還是白天」
- 褪黑激素分泌被壓制
- 結果：你躺了 1 小時才睡著

**我的實測：**
- 睡前滑手機 1 小時 → 入睡時間 45-60 分鐘
- 睡前不碰手機 → 入睡時間 10-15 分鐘

---

### **2. 晚餐吃太多碳水（血糖震盪）**

**為什麼有害？**
- 高碳水晚餐 → 血糖飆高 → 2-3 小時後暴跌
- 血糖暴跌會觸發壓力荷爾蒙（皮質醇）
- 結果：你半夜 3 點突然醒來，然後睡不回去

**我的實測：**
- 晚餐吃白飯 + 麵 → 半夜醒來 2-3 次
- 晚餐吃蛋白質 + 蔬菜 → 一覺到天亮

---

### **3. 壓力太大（皮質醇還在高檔）**

**為什麼有害？**
- 白天壓力大 → 皮質醇晚上還沒降下來
- 皮質醇高會抑制褪黑激素
- 結果：你的身體進不了深層睡眠

**我的實測：**
- 壓力大的日子 → HRV 平均 45-50
- 放鬆的日子 → HRV 平均 75-80

---

## 🟡 3 個小習慣，讓你的 HRV 從紅變綠

我花了 3 年實測這些方法，我的 HRV 從平均 52 拉到 78，早上起床不再像殭屍。

### **習慣 1：睡前 2 小時，手機開夜覽模式**

**具體做法：**
- 晚上 8 點後，手機自動開啟夜覽模式
- 或者直接戴藍光眼鏡
- 最好的做法：睡前 1 小時完全不碰手機

**我的工具：**
- iPhone：設定 → 螢幕顯示與亮度 → 夜覽
- 藍光眼鏡：睡前 2 小時開始戴

**效果：**
- 入睡時間從 45 分鐘縮短到 15 分鐘
- 深度睡眠時間增加 20-30 分鐘

---

### **習慣 2：晚餐減碳水，增加蛋白質 + 好油**

**具體做法：**
- 晚餐不吃白飯、麵、麵包
- 改吃：雞胸肉/魚肉 + 大量蔬菜 + 酪梨/橄欖油
- 如果真的想吃碳水，選擇地瓜（低 GI）

**我的晚餐範例：**
- 煎鮭魚 150g
- 花椰菜 + 菠菜 200g
- 酪梨半顆
- 橄欖油拌炒

**效果：**
- 半夜醒來次數從 2-3 次降到 0 次
- HRV 提升 10-15 ms

---

### **習慣 3：睡前做 10 分鐘呼吸訓練**

**具體做法：**
- 我用「4-7-8 呼吸法」
  - 吸氣 4 秒
  - 憋氣 7 秒
  - 吐氣 8 秒
- 重複 5-10 次

**為什麼有效？**
- 強迫身體進入副交感神經模式
- 降低心率和皮質醇
- 讓大腦知道「現在該休息了」

**我的工具：**
- App：Breathwrk、Calm
- 或者直接用手機計時器

**效果：**
- 壓力大的日子，HRV 也能維持在 65-70
- 入睡速度明顯變快

---

## 🧪 其他輔助因素

除了三個關鍵習慣，我還做了這些調整：

### **環境優化**
- 房間全黑（遮光窗簾）
- 溫度 18-20°C（涼爽有助睡眠）
- 安靜（耳塞或白噪音）

### **補劑使用（個人經驗）**
- **鎂**：每天 400mg（睡前服用，幫助放鬆）
- **甘胺酸**：3g（改善睡眠品質）
- **維生素 D**：白天補充（晚上不要吃，會影響褪黑激素）

### **追蹤工具**
- **Oura Ring**：我用這個追蹤 HRV 和睡眠階段
- **Apple Watch**：也可以追蹤睡眠，但準確度較低
- **Whoop**：專業運動員用的，數據最準確

---

## 💡 關鍵心得

### 1. 數據追蹤很重要
不要只憑感覺，用 HRV 追蹤你的睡眠品質。  
你會發現很多「以為有用」的習慣其實沒用。

### 2. 睡眠品質 > 睡眠時間
睡 6 小時高品質睡眠，比睡 8 小時低品質睡眠更有效。

### 3. 多管齊下才有效
單一因素（只改晚餐或只做呼吸）效果有限。  
三個習慣同時執行，HRV 才會明顯提升。

### 4. 需要時間適應
前 1-2 週可能感受不明顯，但數據會說話。  
堅持 3-4 週後，你會發現早上起床完全不同。

---

## ⚠️ 重要提醒

### **什麼時候需要看醫生？**
- 如果你已經做了這些調整，但 HRV 還是很低
- 如果你有嚴重的失眠問題（超過 2 小時才能入睡）
- 如果你有睡眠呼吸中止症的症狀（打鼾、半夜喘不過氣）

**請務必諮詢睡眠專科醫師或神經內科醫師。**

### **我不建議的做法：**
- ❌ 依賴安眠藥（長期使用會降低睡眠品質）
- ❌ 睡前喝酒（會抑制深度睡眠）
- ❌ 週末補眠（會打亂生理時鐘）

---

## 免責聲明

**這是我的個人實驗紀錄，不構成醫療建議。**

所有內容均基於個人經驗與公開研究資料分享，僅供教育與資訊參考之用。睡眠問題可能涉及多種健康因素，每個人的狀況不同，在進行任何調整前，請務必諮詢合格的醫師或睡眠專科醫師。

---

## 想了解更多？

如果你也想優化自己的睡眠品質和恢復能力，歡迎透過 LINE 預約免費諮詢。  
我會分享更多個人實驗心得與數據追蹤經驗。

**但記住：這不是醫療諮詢，而是經驗分享。**

[預約免費諮詢](https://lin.ee/dnbucVw)
    `
  },
  'testosterone-optimization-3-months': {
    title: '沒用藥，我如何三個月內自然提升 20% 睪固酮？(515→625)',
    date: '2026-01-30',
    category: '血檢優化',
    readTime: '6 分鐘',
    content: `
## 前言：這是我今年做過最值得的「人體實驗」

身為醫學背景的教練，我不想只憑感覺訓練。

三個月前，我的睪固酮值是 **515 ng/dL**（正常範圍，但很普通）。  
透過科學化調整生活型態後，上週複檢，數值直接衝到 **625.04 ng/dL**。

**這 20% 的提升，帶來的身體變化非常巨大。**

---

## 📊 實測數據對比

| 時間 | 睪固酮 (ng/dL) | 變化 |
|------|----------------|------|
| 2025.10 | 515 | 基準值 |
| 2026.01 | 625.04 | **↑ 21.4%** |

**參考範圍：**
- 正常範圍：300-1000 ng/dL
- 最佳範圍：600-900 ng/dL（根據研究文獻）

我從「正常但普通」提升到「最佳範圍」。

---

## 💪 身體變化（主觀感受）

### 1️⃣ 體態變乾
在同樣的訓練量下，身體排水更快，肌肉線條變得更明顯。  
體脂率沒有特別降低，但視覺效果明顯提升。

### 2️⃣ 腦霧消失
下午不再斷電，專注力與續航力大幅提升。  
工作效率明顯變好，不需要靠咖啡因硬撐。

### 3️⃣ 晨間訊號
屬於男人的「原廠設定」準時回歸（懂的就懂）。  
這是睪固酮健康的重要指標之一。

---

## 🔑 三個關鍵習慣

這不是靠什麼黑魔法，而是我嚴格執行了以下三個習慣：

### **1. 維生素 D3 補充**

**為什麼有效？**
- 研究顯示，維生素 D 與睪固酮合成高度相關
- 台灣人普遍缺乏維生素 D（室內工作、防曬過度）

**我的做法：**
- 每天補充 **4000 IU 維生素 D3**
- 搭配 K2（幫助鈣質吸收）
- 每天曬太陽 20-30 分鐘（上午 10 點前）

**數據追蹤：**
- 補充前：維生素 D 約 25 ng/mL（不足）
- 補充後：維生素 D 約 50 ng/mL（最佳範圍）

---

### **2. 大重量腿部訓練**

**為什麼有效？**
- 大肌群訓練（深蹲、硬舉）會刺激睪固酮分泌
- 腿部是全身最大的肌群，刺激效果最強

**我的做法：**
- 每週 **2 次腿部訓練**
- 深蹲：5 組 x 5 下（80-85% 1RM）
- 硬舉：5 組 x 5 下（80-85% 1RM）
- 保加利亞分腿蹲：3 組 x 8-10 下

**關鍵：**
- 重量要夠重（不是輕鬆的高次數）
- 組間休息 3-5 分鐘（充分恢復）
- 訓練後補充蛋白質

---

### **3. 睡眠優化**

**為什麼有效？**
- 睪固酮主要在深度睡眠時分泌
- 睡眠不足會直接降低睪固酮 10-15%

**我的做法：**
- 每天睡 **7.5-8 小時**
- 晚上 10:30 前上床
- 睡前 2 小時不看手機（藍光會抑制褪黑激素）
- 房間全黑（遮光窗簾）
- 補充鎂（400mg，幫助放鬆）

**數據追蹤：**
- 使用 Oura Ring 追蹤睡眠品質
- 深度睡眠從 1 小時提升到 1.5-2 小時

---

## 🧪 其他輔助因素

除了三個關鍵習慣，我還做了這些調整：

### **營養優化**
- 增加健康脂肪攝取（橄欖油、酪梨、堅果）
- 確保鋅攝取充足（牡蠣、紅肉）
- 減少糖分攝取（穩定胰島素）

### **壓力管理**
- 每天冥想 10 分鐘
- 減少無意義的社群媒體使用
- 週末完全放鬆（不工作）

### **避免睪固酮殺手**
- 減少塑膠容器使用（避免環境荷爾蒙）
- 不用含 Parabens 的保養品
- 避免過度飲酒

---

## 💡 關鍵心得

### 1. 數據追蹤很重要
定期抽血檢測，才知道調整是否有效。  
不要只憑感覺，要用數據說話。

### 2. 需要時間累積
這不是 7 天挑戰，而是 3 個月的持續執行。  
前 1-2 個月可能感受不明顯，但數據會說話。

### 3. 多管齊下才有效
單一因素（只補 D3 或只練腿）效果有限。  
三個習慣同時執行，才能看到顯著提升。

### 4. 個人化很重要
我的方法不一定適合你。  
每個人的基因、生活型態、起始數值都不同。

---

## ⚠️ 重要提醒

### **什麼時候需要看醫生？**
- 如果你的睪固酮 < 300 ng/dL（明顯偏低）
- 如果有性功能障礙、嚴重疲勞等症狀
- 如果調整 3-6 個月後數值仍無改善

**請務必諮詢泌尿科或內分泌科醫師。**

### **我不建議的做法：**
- ❌ 自行使用睪固酮補充劑（TRT）
- ❌ 使用來路不明的補品
- ❌ 過度訓練（反而會降低睪固酮）

---

## 免責聲明

**這是我的個人實驗紀錄，不構成醫療建議。**

所有內容均基於個人經驗與公開研究資料分享，僅供教育與資訊參考之用。睪固酮相關問題涉及內分泌系統，每個人的狀況不同，在進行任何調整前，請務必諮詢合格的醫師或內分泌專科醫師。

---

## 想了解更多？

如果你也想優化自己的荷爾蒙健康，歡迎透過 LINE 預約免費諮詢。  
我會分享更多個人實驗心得與數據追蹤經驗。

**但記住：這不是醫療諮詢，而是經驗分享。**

[預約免費諮詢](https://lin.ee/dnbucVw)
    `
  },
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]
  
  if (!post) {
    return {
      title: '文章不存在 - Howard',
    }
  }

  return {
    title: `${post.title} - Howard`,
    description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim() + '...',
    keywords: [
      post.category,
      'Howard',
      '台中健身教練',
      'CSCS',
      '運動科學',
      '訓練方法',
      '營養優化',
      '血檢優化',
    ],
    authors: [{ name: 'Howard' }],
    openGraph: {
      title: post.title,
      description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
      type: 'article',
      publishedTime: post.date,
      authors: ['Howard'],
      tags: [post.category],
      locale: 'zh_TW',
      url: `https://howard456.vercel.app/blog/${params.slug}`,
      images: [
        {
          url: 'https://howard456.vercel.app/howard-profile.jpg',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
      images: ['https://howard456.vercel.app/howard-profile.jpg'],
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(blogContent).map((slug) => ({
    slug: slug,
  }))
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]

  if (!post) {
    notFound()
  }

  const articleSchema = generateArticleSchema({
    title: post.title,
    date: post.date,
    category: post.category,
    content: post.content,
    slug: params.slug,
  })

  return (
    <div style={{backgroundColor: '#F9F9F7'}} className="min-h-screen">
      {/* GA 追蹤 */}
      <ArticleTracker 
        title={post.title}
        category={post.category}
        readTime={post.readTime}
      />
      
      {/* 結構化資料 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      
      <article className="max-w-3xl mx-auto px-6 py-16">
        {/* 麵包屑導航 */}
        <Breadcrumb 
          items={[
            { label: '部落格', href: '/blog' },
            { label: post.title }
          ]}
        />
        
        {/* 返回按鈕 */}
        <Link 
          href="/blog"
          className="inline-flex items-center text-gray-600 hover:text-primary mb-8 transition-colors"
        >
          ← 返回文章列表
        </Link>

        {/* 文章標題 */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">{post.readTime}</span>
          </div>
          
          <h1 className="text-2xl md:text-4xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            {post.title}
          </h1>
          
          <div className="text-gray-500 text-sm">
            發布於 {post.date}
          </div>
        </header>

        {/* 文章內容 */}
        <div 
          className="prose prose-lg max-w-none"
          style={{
            color: '#2D2D2D',
            lineHeight: '1.8'
          }}
          dangerouslySetInnerHTML={{ 
            __html: post.content
              .split('\n')
              .map(line => {
                // 標題
                if (line.startsWith('## ')) {
                  return `<h2 style="font-size: 1.8rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem; color: #2D2D2D;">${line.replace('## ', '')}</h2>`
                }
                if (line.startsWith('### ')) {
                  return `<h3 style="font-size: 1.4rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #2D2D2D;">${line.replace('### ', '')}</h3>`
                }
                // 粗體
                if (line.includes('**')) {
                  line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }
                // 連結
                if (line.includes('[') && line.includes('](')) {
                  line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                }
                // 分隔線
                if (line === '---') {
                  return '<hr style="margin: 2rem 0; border-color: #E5E5E5;" />'
                }
                // 列表
                if (line.startsWith('- ')) {
                  return `<li style="margin-bottom: 0.5rem;">${line.replace('- ', '')}</li>`
                }
                // 表格（簡化處理）
                if (line.startsWith('|')) {
                  return line
                }
                // 一般段落
                if (line.trim()) {
                  return `<p style="margin-bottom: 1rem;">${line}</p>`
                }
                return ''
              })
              .join('')
          }}
        />

        {/* 相關文章推薦 */}
        <div className="mt-16 border-t-2 border-gray-200 pt-12">
          <h3 className="text-2xl font-bold mb-8" style={{color: '#2D2D2D'}}>相關文章推薦</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(blogContent)
              .filter(([slug, article]) => 
                slug !== params.slug && article.category === post.category
              )
              .slice(0, 2)
              .map(([slug, article]) => (
                <Link 
                  key={slug}
                  href={`/blog/${slug}`}
                  className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all hover:shadow-lg"
                >
                  <span className="text-xs text-primary font-medium">{article.category}</span>
                  <h4 className="text-lg font-semibold mt-2 mb-2" style={{color: '#2D2D2D'}}>
                    {article.title}
                  </h4>
                  <p className="text-gray-500 text-sm">{article.readTime}</p>
                </Link>
              ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
          <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            想了解個人化的健康優化方案？
          </h3>
          <p className="text-gray-600 mb-6">
            透過 LINE 預約免費諮詢，分享更多實驗心得與數據追蹤經驗。
          </p>
          <LineButton 
            source="blog_post"
            className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            預約免費諮詢
          </LineButton>
        </div>
      </article>
    </div>
  )
}
