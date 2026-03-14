/**
 * 取得本地時區的日期字串 (YYYY-MM-DD)
 * 避免 toISOString() 在 UTC+8 時區凌晨 0-8 點回傳前一天的問題
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 計算從今天到目標日期的天數差（UTC+8 台北時區對齊）
 * 正值 = 未來，0 = 今天，負值 = 已過去
 *
 * 統一公式避免 browser/server 時區不一致：
 * - Browser (UTC+8): new Date() 已是本地時間，但 new Date("YYYY-MM-DD") 是 UTC midnight
 * - Server (UTC): Date.now() 是 UTC，需 +8hr 對齊台北
 * - 此函式在兩端都產出正確的台北日期差
 */
export function daysUntilDateTW(targetDateStr: string): number {
  const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const nowTWMidnight = new Date(nowTW.toISOString().split('T')[0])
  const target = new Date(targetDateStr)
  return Math.round((target.getTime() - nowTWMidnight.getTime()) / 86400000)
}
