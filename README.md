# The Howard Protocol v3.0

Howard Chen 個人品牌網站 - 人體效能優化系統

## 技術棧

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Font**: Noto Sans TC (Google Fonts)

## 專案結構

```
V3/
├── app/                    # Next.js App Router 頁面
│   ├── layout.tsx         # 全域 Layout（含 Navigation）
│   ├── globals.css        # 全域樣式與 Tailwind 配置
│   ├── page.tsx           # 首頁（關於協議）
│   ├── case/              # 個案追蹤頁面
│   ├── training/          # 訓練工程頁面
│   ├── nutrition/         # 營養與恢復頁面
│   ├── diagnosis/         # 系統診斷頁面（互動測驗）
│   ├── tools/             # 工具與資源頁面
│   └── action/            # 開始行動頁面
├── components/            # React 元件
│   └── Navigation.tsx     # 導航列元件
├── hooks/                 # 自定義 React Hooks
│   └── useLocalStorage.ts # LocalStorage Hook（SSR 安全）
├── public/                # 靜態資源
│   ├── before.jpg         # 個案追蹤圖片
│   └── after.jpg          # 個案追蹤圖片
├── tailwind.config.ts     # Tailwind 配置（品牌色票）
├── tsconfig.json          # TypeScript 配置
├── next.config.js         # Next.js 配置
└── package.json           # 專案依賴

# 舊版檔案
├── index.html             # 原始 HTML 版本（保留作為參考）
```

## 開發指令

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build

# 啟動生產伺服器
npm start

# 程式碼檢查
npm run lint
```

## 路由結構

| 路由 | 頁面 | SEO Title |
|------|------|-----------|
| `/` | 關於協議 | 關於協議 - The Howard Protocol |
| `/case` | 個案追蹤 | 個案追蹤 - The Howard Protocol |
| `/training` | 訓練工程 | 訓練工程 - The Howard Protocol |
| `/nutrition` | 營養與恢復 | 營養與恢復 - The Howard Protocol |
| `/diagnosis` | 系統診斷 | 系統診斷 - The Howard Protocol |
| `/tools` | 工具與資源 | 工具與資源 - The Howard Protocol |
| `/action` | 開始行動 | 開始行動 - The Howard Protocol |

## 品牌色票

```css
--primary: #0066FF          /* 清爽藍色 */
--primary-dark: #0052CC
--secondary: #FF6B35        /* 活力橙色 */
--success: #00C851          /* 清新綠色 */
--warning: #FFB800          /* 溫暖黃色 */
--danger: #FF4444           /* 警示紅色 */
```

## SEO 優化

每個頁面都包含：
- ✅ 獨立的 `<title>` 標籤
- ✅ Meta description
- ✅ Open Graph tags（社群分享預覽）
- ✅ Twitter Card tags
- ✅ 語義化 HTML 結構

## 功能特色

### 1. 響應式導航列
- 桌面版：水平導航列
- 移動版：漢堡選單

### 2. 互動式診斷測驗（含 LocalStorage）
- 4 題系統健康評估
- 即時計算 WHtR（腰圍身高比）
- 動態結果顯示
- **自動保存進度**：答案、輸入值、計算結果自動儲存在瀏覽器
- **重新整理不遺失**：頁面刷新後自動恢復上次的測驗狀態
- **重新開始按鈕**：可清除所有已保存的數據

### 3. 獨立路由頁面
- 每個區塊都是獨立的 URL
- 有利於 SEO 與分享
- 支援瀏覽器前進/後退

### 4. SSR 安全的 LocalStorage
- 自定義 `useLocalStorage` Hook
- 避免 Next.js Hydration 錯誤
- 客戶端渲染時才存取 localStorage

## 部署建議

### Vercel（推薦）
```bash
# 安裝 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### Netlify
```bash
# Build command
npm run build

# Publish directory
.next
```

## 聯絡資訊

- **Instagram**: [@chenhoward](https://www.instagram.com/chenhoward/)
- **LINE**: [加入好友](https://lin.ee/dnbucVw)
- **地點**: 台中市北屯區
- **認證**: CSCS • 運動醫學背景
