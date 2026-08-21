/**
 * 教練的學生名單：解析、卡片組裝、提示產生。
 *
 * ⚠️ 設計原則（2026-08-21 一連串修正後的結論）：
 * 1. **先給價值，資料當副產品** —— 教練會用它是因為打開比自己回想快，
 *    不是因為「應該記錄」
 * 2. **建檔只要兩個欄位**（名字 + 標的）。Howard 原話：「第幾堂很麻煩，
 *    有些學生就是會一直上課的啊」→ 堂數整個拿掉，改用時間驅動
 * 3. **標的可以空** —— 講不出標的的學生，那件事本身就是資訊
 */

const DAY = 86_400_000

/** 每幾週回頭檢查一次標的（取代原本的「第 8/16/24 堂」） */
const GOAL_CHECK_WEEKS = 8
/** 幾天沒上課算「該問一下」 */
const IDLE_MULTIPLIER = 2

export type StudentInput = { name: string; goal: string | null }

/**
 * 解析教練貼進來的名單。格式刻意寬鬆 —— 一行一個學生，
 * 第一段是名字，其餘是標的。不強制標點。
 */
export function parseRoster(raw: string): StudentInput[] {
  const out: StudentInput[] = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    // 支援 "名字 標的" / "名字,標的" / "名字：標的" / 只有名字
    const m = t.match(/^([^\s,，:：]+)[\s,，:：]+(.+)$/)
    if (m) {
      out.push({ name: m[1].trim(), goal: m[2].trim() || null })
    } else {
      out.push({ name: t, goal: null })
    }
  }
  // 同名的只留第一筆
  const seen = new Set<string>()
  return out.filter(s => (seen.has(s.name) ? false : (seen.add(s.name), true)))
}

export type StudentCard = {
  id: string
  name: string
  goal: string | null
  goalKind: string | null
  /** 跟這位教練練了多久（週） */
  weeksTogether: number | null
  /** 最近 30 天上了幾堂 */
  sessionsLast30: number
  lastDate: string | null
  lastNote: string | null
  daysSinceLast: number | null
  /** 平常間隔（天），從歷史推 */
  typicalGapDays: number | null
  /** 系統提示 —— 只在該講的時候出現，其餘為 null */
  cue: string | null
  /** 今天是否已記錄 */
  doneToday: boolean
}

type SessionRow = { date: string; note: string | null }

function medianGap(dates: string[]): number | null {
  if (dates.length < 3) return null
  const gaps: number[] = []
  for (let i = 1; i < dates.length; i++) {
    gaps.push((new Date(dates[i] + 'T00:00:00').getTime() - new Date(dates[i - 1] + 'T00:00:00').getTime()) / DAY)
  }
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2 * 10) / 10
}

export function buildCard(
  student: { id: string; name: string; goal: string | null; goal_kind: string | null; created_at: string; goal_checked_at: string | null },
  sessions: SessionRow[],
  today: Date = new Date(),
): StudentCard {
  const todayStr = today.toISOString().slice(0, 10)
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const dates = sorted.map(s => s.date)
  const last = sorted.length ? sorted[sorted.length - 1] : null
  const doneToday = dates.includes(todayStr)

  const daysSinceLast = last
    ? Math.floor((new Date(todayStr + 'T00:00:00').getTime() - new Date(last.date + 'T00:00:00').getTime()) / DAY)
    : null

  // 「練了多久」從第一堂算；還沒有紀錄就從建檔日算
  const startMs = dates.length
    ? new Date(dates[0] + 'T00:00:00').getTime()
    : new Date(student.created_at).getTime()
  const weeksTogether = Math.floor((today.getTime() - startMs) / DAY / 7)

  const cutoff = new Date(today.getTime() - 30 * DAY).toISOString().slice(0, 10)
  const sessionsLast30 = dates.filter(d => d >= cutoff).length
  const typicalGapDays = medianGap(dates)

  // ── 提示：一次只講一件，講最該講的那件 ──
  let cue: string | null = null

  // ① 沒有標的 —— 這是最該補的，因為沒有標的就會變成只教動作
  if (!student.goal) {
    cue = '還沒設標的。這堂結束前想一下：他來這裡最想達成什麼？'
  }
  // ② 太久沒上課
  else if (daysSinceLast != null && typicalGapDays != null && daysSinceLast > typicalGapDays * IDLE_MULTIPLIER) {
    cue = `距上次上課 ${daysSinceLast} 天（平常每 ${typicalGapDays} 天）。順口問一下最近狀況。`
  }
  // ③ 每 8 週回頭檢查標的（取代「第 8/16/24 堂」，對一直上課的學生也成立）
  else {
    const lastCheck = student.goal_checked_at ? new Date(student.goal_checked_at).getTime() : startMs
    const weeksSinceCheck = Math.floor((today.getTime() - lastCheck) / DAY / 7)
    if (weeksSinceCheck >= GOAL_CHECK_WEEKS) {
      cue = `已經 ${weeksSinceCheck} 週沒回頭對標的了 —— 「${student.goal}」現在到哪了？`
    }
  }

  return {
    id: student.id,
    name: student.name,
    goal: student.goal,
    goalKind: student.goal_kind,
    weeksTogether: dates.length || student.created_at ? weeksTogether : null,
    sessionsLast30,
    lastDate: last?.date ?? null,
    lastNote: last?.note ?? null,
    daysSinceLast,
    typicalGapDays,
    cue,
    doneToday,
  }
}

/** 排序：有提示的排前面（該處理的先看到），其餘按最久沒上課 */
export function sortCards(cards: StudentCard[]): StudentCard[] {
  return [...cards].sort((a, b) => {
    if (!!a.cue !== !!b.cue) return a.cue ? -1 : 1
    return (b.daysSinceLast ?? 0) - (a.daysSinceLast ?? 0)
  })
}
