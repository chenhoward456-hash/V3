/**
 * 從「上課日期」判斷實體課學員的流失風險。
 *
 * ⚠️ 為什麼做這個（2026-08-21 Howard 講的真實痛點）：
 * 「買五十堂上可能不到一半就消失」，而軌跡是
 * **「開始忙了 → 取消率變多 → 最後就不約課了」**。
 *
 * 關鍵是那個軌跡**是漸進的**，不是突然消失 —— 所以有介入的時間窗。
 * 而教練通常最後才知道：取消一次、再改期一次、隔兩週、不回訊息，
 * 等意識到的時候人已經走了。
 *
 * 這支不需要接 BookFast 或 Google 行事曆 —— 貼上日期就能算，
 * **先用歷史案例驗證訊號準不準，再談自動化**。順序不能反。
 *
 * ⚠️ 主訊號用「間隔」不是「取消次數」：
 * 取消資料不一定拿得到，而且**「不約課」比「取消」更晚也更致命** ——
 * 取消代表還有意願（約了才能取消），不約課代表已經放棄了。
 * 間隔同時涵蓋這兩者。
 */

const DAY = 86_400_000

export type AttendanceRisk = {
  level: 'ok' | 'watch' | 'alert' | 'gone'
  /** 一句話：現在是什麼狀況 */
  summary: string
  /** 建議教練做什麼 */
  action: string
  /** 平常的上課間隔（天） */
  baselineGapDays: number | null
  /** 最近的上課間隔（天）—— 跟 baseline 比就知道有沒有在變慢 */
  recentGapDays: number | null
  /** 距離最後一次上課幾天 */
  daysSinceLast: number
  /** 總堂數 */
  sessions: number
  lastDate: string
}

/** 判定用的倍數：距上次超過平常間隔的幾倍 */
const WATCH_MULTIPLIER = 1.5
const ALERT_MULTIPLIER = 2.5
const GONE_MULTIPLIER = 5
/** ⚠️ gone 另外要求絕對天數 —— 一週兩次的人斷 13 天還救得回來，
 *  但純看倍數會判成「已經斷了」而讓教練放棄得太早（2026-08-21 模擬時抓到）。 */
const GONE_MIN_DAYS = 21
/** 間隔拉長多少算「頻率在下降」 */
const SLOWDOWN_RATIO = 1.4
/** 「最近」取最後幾次上課。⚠️ 原本用「後 1/3」是錯的 ——
 *  堂數多的人（買 50 堂）早期訊號會被稀釋：模擬中他已經從一週兩次變一週一次，
 *  卻因為前 2/3 裡混著大量密集紀錄而仍判 OK。改成固定看最近 5 堂。 */
const RECENT_SESSIONS = 5

function parseDates(input: string): string[] {
  return [...new Set(
    input
      .split(/[\s,、;]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        // 接受 2026-08-21 / 2026/8/21 / 8/21（補今年）
        const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
          ?? s.match(/^()(\d{1,2})[-/](\d{1,2})$/)
        if (!m) return null
        const y = m[1] || String(new Date().getFullYear())
        const mm = m[2].padStart(2, '0')
        const dd = m[3].padStart(2, '0')
        const iso = `${y}-${mm}-${dd}`
        return isNaN(new Date(iso + 'T00:00:00').getTime()) ? null : iso
      })
      .filter((s): s is string => s !== null),
  )].sort()
}

function medianGap(dates: string[]): number | null {
  if (dates.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < dates.length; i++) {
    gaps.push((new Date(dates[i] + 'T00:00:00').getTime() - new Date(dates[i - 1] + 'T00:00:00').getTime()) / DAY)
  }
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  // 用中位數不用平均 —— 一次出國或受傷造成的長間隔不該把基準線拉歪
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2 * 10) / 10
}

export function assessAttendance(input: string, today: Date = new Date()): AttendanceRisk | null {
  const dates = parseDates(input)
  if (dates.length === 0) return null

  const last = dates[dates.length - 1]
  const daysSinceLast = Math.floor(
    (new Date(today.toISOString().slice(0, 10) + 'T00:00:00').getTime()
      - new Date(last + 'T00:00:00').getTime()) / DAY,
  )

  // 基準線＝除了最近幾堂以外的全部；最近＝固定看最後 RECENT_SESSIONS 堂
  const splitAt = Math.max(2, dates.length - RECENT_SESSIONS + 1)
  const baselineGapDays = medianGap(dates.slice(0, splitAt))
  const recentGapDays = dates.length > splitAt
    ? medianGap(dates.slice(splitAt - 1))
    : baselineGapDays

  const base = baselineGapDays ?? 7   // 資料太少時假設一週一次
  const slowing = baselineGapDays != null && recentGapDays != null
    && recentGapDays > baselineGapDays * SLOWDOWN_RATIO

  let level: AttendanceRisk['level']
  let summary: string
  let action: string

  if (daysSinceLast >= Math.max(base * GONE_MULTIPLIER, GONE_MIN_DAYS)) {
    level = 'gone'
    summary = `已經 ${daysSinceLast} 天沒上課，平常是每 ${base} 天一次。`
    action = '這個階段電話比訊息有用。先別提課，問他最近怎麼樣 —— 多半是生活變忙，不是不想練。'
  } else if (daysSinceLast >= base * ALERT_MULTIPLIER) {
    level = 'alert'
    summary = `${daysSinceLast} 天沒上課（平常每 ${base} 天一次）${slowing ? '，而且前面幾次的間隔已經在拉長' : ''}。`
    action = '⚠️ 現在打給他。這是「還約得回來」和「已經走了」的分界點 —— 再等兩週成本會高很多。'
  } else if (daysSinceLast >= base * WATCH_MULTIPLIER || slowing) {
    level = 'watch'
    summary = slowing
      ? `上課間隔從每 ${baselineGapDays} 天變成每 ${recentGapDays} 天，節奏在變慢。`
      : `${daysSinceLast} 天沒上課，比平常的 ${base} 天久一點。`
    action = '先別緊張，但這週主動約下一堂 —— 不要等他來約。「開始忙」通常就是從這裡開始的。'
  } else {
    level = 'ok'
    summary = `節奏穩定，平均每 ${base} 天一次。`
    action = '照常進行。'
  }

  return {
    level, summary, action,
    baselineGapDays, recentGapDays, daysSinceLast,
    sessions: dates.length,
    lastDate: last,
  }
}
