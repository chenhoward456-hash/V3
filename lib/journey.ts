/**
 * 「你這 N 週」結業回顧 —— 課程結束那一刻要拿得出來的東西。
 *
 * ## 為什麼有這支（2026-09-30）
 *
 * 商業模式（[[project_v3_business_model]]）：線下學員系統免費，**課程結束＝轉換點**。
 * 那時要問的不是「買一個還不知道有沒有用的東西」，而是「不要失去已經有你全部資料的東西」。
 * 資料本身就是理由 —— 但到今天為止沒有任何一頁把「這 N 週」攤開給學員看。
 *
 * 只放「量得到的」：體重（首週均→末週均，不用單日，避免水分波動騙人）、記錄了幾天、
 * 訓練次數、主項估計 1RM、體脂（同一台儀器首末兩次）、身體說明書、身體實驗結果。
 * 不寫推銷詞 —— 數字自己說話；結尾只給一條「想繼續有人幫你看」的路。
 */

export type JourneyInput = {
  name: string
  goalType: string | null
  targetWeight: number | null
  from: string
  to: string
  weights: { date: string; weight: number | null; body_fat: number | null }[]
  nutritionDates: string[]
  trainingDates: string[]
  wellnessDates: string[]
  strength: { exercise: string; month: string; e1rm: number }[]
  profileEntries: { key: string; label: string; value: string }[]
  experiments: { title: string; resultText: string; statusText: string }[]
}

export type WeeklyPoint = { week: number; start: string; avg: number; n: number }

export type Journey = {
  name: string
  from: string
  to: string
  weeks: number
  weight: null | {
    startAvg: number
    endAvg: number
    delta: number
    perWeek: number
    weekly: WeeklyPoint[]
    toGoal: number | null
  }
  bodyFat: null | { first: { date: string; value: number }; last: { date: string; value: number } }
  logging: { weightDays: number; nutritionDays: number; trainingSessions: number; wellnessDays: number; totalDays: number; longestStreak: number }
  strength: { exercise: string; first: number; best: number; firstMonth: string; bestMonth: string }[]
  profileEntries: JourneyInput['profileEntries']
  experiments: JourneyInput['experiments']
}

const DAY = 86400000
const idx = (d: string) => Math.round(new Date(`${d}T00:00:00Z`).getTime() / DAY)
const r1 = (n: number) => Math.round(n * 10) / 10

function longestStreak(dates: string[]): number {
  const days = [...new Set(dates)].map(idx).sort((a, b) => a - b)
  let best = 0, cur = 0, prev = NaN
  for (const d of days) {
    cur = d === prev + 1 ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

export function buildJourney(input: JourneyInput): Journey {
  const inRange = (d: string) => d >= input.from && d <= input.to
  const totalDays = idx(input.to) - idx(input.from) + 1
  const weeks = Math.max(1, Math.round(totalDays / 7))

  // 體重：按週平均（第 1 週＝from 起 7 天）
  const ws = input.weights.filter(w => inRange(w.date) && w.weight != null).sort((a, b) => a.date.localeCompare(b.date))
  const byWeek = new Map<number, number[]>()
  for (const w of ws) {
    const k = Math.floor((idx(w.date) - idx(input.from)) / 7)
    byWeek.set(k, [...(byWeek.get(k) ?? []), Number(w.weight)])
  }
  const weekly: WeeklyPoint[] = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({
    week: k + 1,
    start: new Date((idx(input.from) + k * 7) * DAY).toISOString().slice(0, 10),
    avg: r1(v.reduce((s, x) => s + x, 0) / v.length),
    n: v.length,
  }))
  let weight: Journey['weight'] = null
  if (weekly.length >= 2) {
    const startAvg = weekly[0].avg, endAvg = weekly[weekly.length - 1].avg
    const span = Math.max(1, weekly[weekly.length - 1].week - weekly[0].week)
    weight = {
      startAvg, endAvg, delta: r1(endAvg - startAvg), perWeek: Math.round(((endAvg - startAvg) / span) * 100) / 100, weekly,
      toGoal: input.targetWeight != null ? r1(input.targetWeight - endAvg) : null,
    }
  }

  const bf = input.weights.filter(w => inRange(w.date) && w.body_fat != null).sort((a, b) => a.date.localeCompare(b.date))
  const bodyFat = bf.length >= 2
    ? { first: { date: bf[0].date, value: Number(bf[0].body_fat) }, last: { date: bf[bf.length - 1].date, value: Number(bf[bf.length - 1].body_fat) } }
    : null

  const weightDates = ws.map(w => w.date)
  const nut = input.nutritionDates.filter(inRange), tr = input.trainingDates.filter(inRange), wl = input.wellnessDates.filter(inRange)
  const anyLog = [...weightDates, ...nut, ...tr, ...wl]

  const fromMonth = input.from.slice(0, 7), toMonth = input.to.slice(0, 7)
  const byEx = new Map<string, { month: string; e1rm: number }[]>()
  for (const s of input.strength) {
    if (s.month < fromMonth || s.month > toMonth) continue
    byEx.set(s.exercise, [...(byEx.get(s.exercise) ?? []), { month: s.month, e1rm: s.e1rm }])
  }
  const strength = [...byEx.entries()].filter(([, pts]) => pts.length >= 2).map(([exercise, pts]) => {
    const sorted = [...pts].sort((a, b) => a.month.localeCompare(b.month))
    const best = sorted.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
    return { exercise, first: sorted[0].e1rm, best: best.e1rm, firstMonth: sorted[0].month, bestMonth: best.month }
  })

  return {
    name: input.name, from: input.from, to: input.to, weeks, weight, bodyFat,
    logging: {
      weightDays: new Set(weightDates).size,
      nutritionDays: new Set(nut).size,
      trainingSessions: new Set(tr).size,
      wellnessDays: new Set(wl).size,
      totalDays,
      longestStreak: longestStreak(anyLog),
    },
    strength,
    profileEntries: input.profileEntries,
    experiments: input.experiments,
  }
}
