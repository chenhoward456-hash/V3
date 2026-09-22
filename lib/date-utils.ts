export const DAY_MS = 86400000

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
  return Math.round((target.getTime() - nowTWMidnight.getTime()) / DAY_MS)
}

// ═══════════════════════════════════════════════════════════
// 台北時區的日期
// ⚠️ 2026-09-21：這一段的存在是因為一個實際在跑的 bug。
//    Vercel cron 的 schedule 是 **UTC**，而 vercel.json 排了 "0 22 * * *"
//    ＝ 台灣時間**隔天早上 6 點**。在那個瞬間：
//      · UTC 日期 = 9/21，台灣日期 = 9/22
//      · cron/daily 的 `today` 用 getTaiwanDate() → 9/22（對）
//      · 但所有「N 天前」都用 `new Date(); setDate(-14); toISOString()` → 9/07（錯，該是 9/08）
//    → 區間變成 15 天不是 14 天；`昨天` 變成前天。
//    ⚠️ 而且晚上那支 cron（"0 14 * * *" ＝ 台灣 22:00）**不會**出錯，
//       所以症狀是「同一支 cron 早上跑跟晚上跑結果不一樣」，比永遠錯一天更難發現。
//
// ⚠️ getLocalDateStr() 解不了這個問題——它用的是**執行環境**的本地時區，
//    在 Vercel（UTC）上跟 toISOString() 一樣錯。只有明寫 timeZone 才對。
// ═══════════════════════════════════════════════════════════

export const TW_TZ = 'Asia/Taipei'

/** 台北時區的日期字串 (YYYY-MM-DD)。不管跑在哪個時區都正確。 */
export function getTaiwanDate(from: Date = new Date()): string {
  return from.toLocaleDateString('sv-SE', { timeZone: TW_TZ })
}

/** 台北時區的「現在幾點」(0–23)。 */
export function getTaiwanHour(from: Date = new Date()): number {
  return parseInt(from.toLocaleString('en-US', { timeZone: TW_TZ, hour: 'numeric', hour12: false }), 10)
}

/**
 * 台北日曆上往前 N 天的日期字串。`taiwanDateAgo(1)` ＝ 台灣的昨天。
 *
 * ⚠️ 不可以寫成 `const d = new Date(); d.setDate(d.getDate() - n); d.toISOString()`——
 *    那是在 **UTC 日曆**上加減，台灣早上 0–8 點會整組偏一天。
 *    這裡先把「台灣的今天」轉成 UTC midnight，再在**日曆日**上加減，就跟時鐘無關了。
 */
export function taiwanDateAgo(days: number, from: Date = new Date()): string {
  const [y, m, d] = getTaiwanDate(from).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - days * DAY_MS).toISOString().split('T')[0]
}

/** 同上，往後 N 天。 */
export function taiwanDateAhead(days: number, from: Date = new Date()): string {
  return taiwanDateAgo(-days, from)
}
