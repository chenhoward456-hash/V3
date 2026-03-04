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
