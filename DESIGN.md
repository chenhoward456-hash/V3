# Design System — Howard Protocol

> 全站視覺北極星。**動任何 UI 前先讀這份。** 配色、字體、間距、卡片一律照這裡，不要各畫面各自決定（那是「躁」的來源）。改動需 Howard 明確同意。

## Product Context
- **是什麼**：數據驅動的體態與健康管理平台（血檢 + 訓練 + 營養 + 基因，教練監督、訂閱制 premium）。
- **給誰**：教練（Howard）的學員 + 教練後台。學員端**手機優先**。
- **領域對標**：Function Health / Levels / Whoop / Oura（臨床級、數據自信、冷靜權威）。

## Aesthetic Direction
- **方向**：臨床級 premium 數據感。極簡 + 大量留白。
- **裝飾程度**：minimal（靠字體、留白、層次做事，不靠色塊）。
- **氣質**：乾淨、可信、值月費。看起來像醫療數據產品，不像玩具。
- **一句話**：少即是專業。

## 🎨 Color（最重要的紀律）
**核心原則：顏色只用來傳達「意義」，不用來裝飾。** 這是這個產品專業度的命脈，也是修掉「躁」的關鍵。

- **品牌/互動色 = 臨床海軍藍**（連結、主要按鈕、可點元素、選取態）。2026-07-11 Howard 拍板，取代 Tailwind 預設藍（去 AI 味：預設藍是 AI 產出網站的公約數）。
  - `primary` `#1E4A73`（primary-600）/ hover `#16385A`（primary-700）/ 淺底 `#F0F5FA`（primary-50，少用）。
  - 完整 50–900 色階定義在 `tailwind.config.ts` 的 `primary`；**code 一律用 `primary-*` token，禁用 `blue-*` 死值**（2026-07-11 已全站替換 ~1086 處）。
- **語意狀態色 — 只准用在血檢/訓練/健康狀態，嚴禁裝飾**：
  - 🟢 正常/最佳/達標：emerald `#059669`（文字/點）、`#ecfdf5`（淺底）
  - 🟡 需注意：amber `#d97706` / `#fffbeb`
  - 🔴 異常/警告：rose `#e11d48` / `#fff1f2`
  - **規則**：看到紅/黃/綠，使用者就該理解成「這是一個狀態」。任何「只是想讓卡片好看」的彩色一律改中性灰。
- **中性灰（其餘一切的底色）**：
  - 文字主 `#0f172a`(slate-900)、次 `#475569`(slate-600)、弱 `#94a3b8`(slate-400)
  - 卡片底 `#ffffff`、頁底 `#f8fafc`(slate-50)、邊框 `#e2e8f0`(slate-200)、分隔 `#f1f5f9`(slate-100)
- **禁用**：紫、橙、靛、青、粉、teal、yellow 等裝飾色系（目前全站 13 色系 → 收斂成 藍 + 紅黃綠語意 + 灰）。漸層按鈕、彩色 icon 圓圈一律不用。
- **狀態色點規範**：狀態優先用「中性卡 + 一顆小色點/小標籤」呈現，不要整片色底（見 TrainingLog 準備度卡的做法 commit 7341aab）。

## Typography
- **body 字族首選：Noto Sans TC**（中文站，中文渲染一致性優先），拉丁 fallback Inter，鏈尾 system-ui。實際鏈：`var(--font-noto-sans-tc), var(--font-inter), system-ui, -apple-system, sans-serif`（`app/globals.css`）。
- **標題（h1–h6 / .doc-title）**：Playfair Display 只涵蓋拉丁字，**中文必須 fallback 到 Noto Sans TC**（`var(--font-playfair), var(--font-noto-sans-tc), serif`），不准讓中文掉進系統明體。
- **數據/數字**：`font-variant-numeric: tabular-nums`（表格/趨勢數字對齊）。
- **載入**：全走 next/font/google（Noto Sans TC 只載 400/500/600/700，display swap），不掛 CDN `<link>`。
- （註：2026-06-13 原案寫「單一字族 Geist」，但 code 從未導入 Geist；2026-07-04 依實況+Howard 同意改記為 Noto Sans TC 優先。）
- **字級（rem）**：hero 1.5、h2 1.25、h3 1.0625、body 0.875、label/caption 0.75、micro 0.6875。粗細：標題 600、內文 400、強調 500。
- **emoji**：大幅減量，只留功能性（狀態/導覽），不要每個標題都掛。

## Spacing
- **base unit**：8px（4px 為半階）。
- **密度**：comfortable（目前偏擠 → 放寬，premium 感來自留白）。
- **scale(px)**：2xs 2 / xs 4 / sm 8 / md 16 / lg 24 / xl 32 / 2xl 48 / 3xl 64。卡片內距預設 16–20，卡片間距 16。

## Layout
- **手機優先**，單欄為主；桌面後台可多欄。
- **卡片統一規範**：白底 `bg-white`、邊框 `border border-slate-200`（或 `shadow-sm` 二選一，不要同時重）、圓角 `rounded-2xl`(16px)、內距 `p-5`。**全站卡片長一樣。**
- **圓角階**：sm 8 / md 12 / card 16 / chip full / button 10。
- **最大內容寬**：學員端 ~640px、後台寬版。

## Motion
- **minimal-functional**：只做幫助理解的過場。
- **duration**：micro 80ms / short 180ms / medium 280ms。**easing**：enter ease-out、exit ease-in。
- 不做花俏 scroll 動畫、不彈跳。

## 套用順序（roadmap）
1. 訓練端（學員 dashboard，已起頭：準備度/模式卡中性化 7341aab）
2. 學員 dashboard 其餘卡片（補品/血檢/飲食）統一卡片規範 + 收斂顏色
3. 健康報告（已偏乾淨，對齊字體/間距）
4. 教練後台
> 一次定規則、逐畫面套用。新畫面先讀這份再動手。

## Decisions Log
| 日期 | 決策 | 理由 |
|------|------|------|
| 2026-06-13 | 建立設計系統（臨床級 premium、顏色只做語意、單一字族 Geist、放寬留白）| Howard：訓練端「不專業俐落」+ 全站 13 色系太躁。收斂為 藍+紅黃綠語意+灰，一次定北極星。 |
| 2026-07-04 | 字體北極星改為 **body 首選 Noto Sans TC**（Inter 為拉丁 fallback），標題 h1–h6/.doc-title 的 Playfair 後面補 Noto Sans TC fallback；並修正 Typography 段落與 code 實況不符的「單一字族 Geist」記載（Geist 從未進 code）。 | 中文渲染一致性：Playfair 無中文字形，中文標題會掉進系統明體、跟內文打架（docs/PRODUCT_AUDIT_RETENTION.md 早已標記）。Howard 2026-07-04 口頭同意，屬 2026-07-02 臨床決策包收尾。 |
| 2026-07-11 | 全站 de-AI pass（commit a610292）：emoji 規範真正落地——標題 emoji 全拔、⚠️ 前綴移除（留語意色）、🟢🟡🔴 改 CSS 色點、/admin header 收斂成一實心藍＋ghost、表格 emoji 鏈改單字 chip、MY DATA 黑卡改白卡。保留：BottomNav 導覽、LINE/推播訊息內容、DailyWellness 評分表情按鈕（待議）。 | Howard：後台/儀表板「AI 感」稽核後拍板全修。emoji-as-icon 是 AI 生成介面最大特徵。 |
| 2026-06-22 | 學員儀表板全面執行此規範（41 個 component 收斂）：殺光漸層（卡片→白底細灰框、按鈕→實心藍）、裝飾色（靛/紫/青/粉/橙/黃）一律轉中性灰、真狀態統一 emerald/amber/rose、卡片統一 `rounded-2xl p-5`。**順序重排**：一鍵打卡上移到判決卡之前、推播開通下移、移除體重/倒數/streak 重複顯示（備賽作戰室為單一真相）。實測 prod 0 漸層/0 裝飾色。| Howard：「重新沉一次儀表板美感+順序」、選「極簡臨床做到位」。**準則可演進**：強制紀律是手段，目的是 premium+好用；未做的獨立子頁（overview/help/timeline/showcase/welcome/upload）待後續。 |
