import crypto from 'crypto'

// ========== 環境設定 ==========
// 用獨立的 ECPAY_PRODUCTION 環境變數控制，不依賴 NODE_ENV
// 因為 Vercel 的 NODE_ENV 永遠是 production，但我們可能還在用測試帳號
const isEcpayProduction = process.env.ECPAY_PRODUCTION === 'true'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`環境變數 ${name} 未設定，請檢查 .env.local`)
  return value.trim()
}

export const ECPAY_CONFIG = {
  MerchantID: requireEnv('ECPAY_MERCHANT_ID'),
  HashKey: requireEnv('ECPAY_HASH_KEY'),
  HashIV: requireEnv('ECPAY_HASH_IV'),
  PaymentURL: isEcpayProduction
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
}

// ========== 產品設定 ==========
export const EBOOK_PRODUCTS = {
  'system-reboot-v1': {
    name: 'System Reboot：睡眠與神經系統優化實戰手冊',
    description: '4 章節完整協定：HRV 動態矩陣、精準補劑、睡前降落 SOP',
    amount: 299, // TWD 整數
    currency: 'twd' as const,
  },
} as const

export type EbookProductKey = keyof typeof EBOOK_PRODUCTS

// ========== 訂閱方案設定 ==========
export const SUBSCRIPTION_PLANS = {
  self_managed: {
    name: '自主管理方案',
    description: 'AI 系統完整存取，自動營養分析與追蹤',
    amount: 499,
    duration_months: 1,
    features: [
      'TDEE + 巨量營養素自動計算',
      '每日飲食 / 訓練 / 體態追蹤',
      'AI 智慧回饋與建議',
      '體組成趨勢圖表',
    ],
  },
  coached: {
    name: '教練指導方案',
    description: 'AI 系統 + CSCS 教練每週審閱與 LINE 指導',
    amount: 2999,
    duration_months: 1,
    features: [
      '包含自主管理方案所有功能',
      'CSCS 教練每週數據審閱',
      'LINE 一對一營養 / 訓練諮詢',
      '個人化補劑與血檢建議',
    ],
  },
  combo: {
    name: '全方位方案',
    description: '線上教練指導 + 台中實體一對一訓練',
    amount: 5000,
    duration_months: 1,
    features: [
      '包含教練指導方案所有功能',
      '台中 Coolday 實體一對一訓練',
      '動作矯正與訓練課表設計',
      '優先預約與緊急諮詢通道',
    ],
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS

// ========== ECPay .NET 風格 URL Encode ==========
// ECPay 使用 .NET 的 UrlEncode 規則，需要特殊轉換
function ecpayUrlEncode(str: string): string {
  let encoded = encodeURIComponent(str)
  // ECPay 特殊規則：某些字元要轉回來（符合 .NET UrlEncode）
  encoded = encoded
    .replace(/%2d/gi, '-')
    .replace(/%5f/gi, '_')
    .replace(/%2e/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2a/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%20/gi, '+')
  return encoded
}

// ========== 生成 CheckMacValue ==========
export function generateCheckMacValue(params: Record<string, string | number>): string {
  // 1. 按 key 字母排序
  const sortedKeys = Object.keys(params).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  // 2. 組合成 query string
  const queryString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  // 3. 前後加上 HashKey / HashIV
  const raw = `HashKey=${ECPAY_CONFIG.HashKey}&${queryString}&HashIV=${ECPAY_CONFIG.HashIV}`

  // 4. URL encode（ECPay .NET 風格）
  const encoded = ecpayUrlEncode(raw)

  // 5. 轉小寫
  const lowered = encoded.toLowerCase()

  // 6. SHA256 加密後轉大寫
  const hash = crypto.createHash('sha256').update(lowered).digest('hex').toUpperCase()

  return hash
}

// ========== 驗證回傳的 CheckMacValue ==========
export function verifyCheckMacValue(params: Record<string, string>): boolean {
  const receivedMac = params.CheckMacValue
  if (!receivedMac) return false

  // 排除 CheckMacValue 本身
  const paramsWithoutMac: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'CheckMacValue') {
      paramsWithoutMac[key] = value
    }
  }

  const expectedMac = generateCheckMacValue(paramsWithoutMac)
  return receivedMac === expectedMac
}

// ========== 生成訂單編號 ==========
// ECPay 限制：英數字，最多 20 字元，不可重複
export function generateMerchantTradeNo(): string {
  const timestamp = Date.now().toString(36) // 8-9 字元
  const random = crypto.randomBytes(3).toString('hex') // 6 字元
  return `HP${timestamp}${random}`.substring(0, 20)
}

// ========== 格式化交易時間 ==========
// ECPay 格式：yyyy/MM/dd HH:mm:ss
export function formatTradeDate(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// ========== 建立付款表單 HTML ==========
export function buildCheckoutFormHTML(params: Record<string, string | number>): string {
  const checkMacValue = generateCheckMacValue(params)

  const allParams = { ...params, CheckMacValue: checkMacValue }

  const hiddenInputs = Object.entries(allParams)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${String(value).replace(/"/g, '&quot;')}" />`)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>正在跳轉至付款頁面...</title></head>
<body>
  <form id="ecpay-form" method="POST" action="${ECPAY_CONFIG.PaymentURL}">
    ${hiddenInputs}
  </form>
  <script>document.getElementById('ecpay-form').submit();</script>
</body>
</html>`
}
