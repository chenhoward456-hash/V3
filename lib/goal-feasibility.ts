/**
 * 教練端：學員的目標日還到不到得了。
 *
 * 為什麼（2026-10-10 實查）：震宣目標 10/25 到 77kg，7 天平均 82.8、4 週前 82.6 —— 兩週要掉 5.8kg；
 * Sean 目標 11/28 到 77kg，85.3 → 每週要掉 1.2kg。週報每週都在算「達成目標本來需要 1257kcal 赤字」，
 * 但赤字上限卡 500，落差只寫在一段文字裡，學員訊息還寫「穩穩達標」。沒有人被提醒要改目標。
 *
 * 安不安全用的是同一把尺：lib/goal-safety.ts 的 checkGoalSafety（學員自己設目標時就用它擋）。
 * 這裡只多做一件事：用最近 4 週的實際體重趨勢，推算「照現在的速度」大約幾號到。
 * 純函式；寫入（改 target_date）只在教練回「套用 名字」時發生（lib/proposal-actions.ts）。
 */
import { checkGoalSafety } from './goal-safety'

export type GoalFeasibility = {
  verdict: 'unreachable' | 'passed'
  /** 最近（7／10／14 天）平均體重 */
  avg7: number
  targetWeight: number
  targetDate: string
  /** 照 4 週趨勢每週變化（kg），算不出來是 null */
  trendPerWeek: number | null
  /** 照現在速度大約到的日期；方向不對或太慢（超過 2 年）是 null */
  projectedDate: string | null
  /** 照建議速度（goal-safety 的建議值）的日期 */
  suggestedDate: string | null
  /** 一句話給教練 */
  line: string
}

const DAY = 86_400_000
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/** 最近 28 天的線性回歸斜率（kg/週）；點太少或跨度不到 14 天回 null */
export function trendKgPerWeek(weights: { date: string; weight: number }[], today: string): number | null {
  const pts = weights.filter(w => w.date <= today && w.date >= addDays(today, -28) && Number.isFinite(w.weight))
  if (pts.length < 6) return null
  const xs = pts.map(p => (Date.parse(`${p.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  if (Math.max(...xs) - Math.min(...xs) < 14) return null
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = pts.reduce((a, p) => a + p.weight, 0) / pts.length
  let num = 0, den = 0
  xs.forEach((x, i) => { num += (x - mx) * (pts[i].weight - my); den += (x - mx) ** 2 })
  return den === 0 ? null : (num / den) * 7
}

export function assessGoalFeasibility(input: {
  goalType: string | null
  targetWeight: number | null
  targetDate: string | null
  weights: { date: string; weight: number }[]
  today: string
}): GoalFeasibility | null {
  const { goalType, targetWeight, targetDate, weights, today } = input
  if ((goalType !== 'cut' && goalType !== 'bulk') || targetWeight == null || !targetDate) return null
  // 「現在幾公斤」用最近的平均：7 天內量不到 3 次就放寬到 10、14 天（Sean 一週只量 2 次）；14 天都不夠就不講
  let recent: typeof weights = []
  for (const span of [7, 10, 14]) {
    recent = weights.filter(w => w.date <= today && w.date >= addDays(today, -span) && Number.isFinite(w.weight))
    if (recent.length >= 3) break
  }
  if (recent.length < 3) return null
  const avg7 = Math.round((recent.reduce((a, w) => a + w.weight, 0) / recent.length) * 10) / 10
  const remaining = targetWeight - avg7
  const reached = goalType === 'cut' ? remaining >= -0.3 : remaining <= 0.3
  if (reached) return null

  const trend = trendKgPerWeek(weights, today)
  const rightWay = trend != null && (goalType === 'cut' ? trend < -0.05 : trend > 0.05)
  const projectedDays = rightWay ? Math.ceil((remaining / trend!) * 7) : null
  const projectedDate = projectedDays != null && projectedDays <= 730 ? addDays(today, projectedDays) : null
  const trendText = trend == null ? '趨勢資料不夠' : `近 4 週${trend < 0 ? '每週掉' : '每週增'} ${Math.abs(trend).toFixed(2)}kg`
  const pace = projectedDate ? `照現在速度約 ${md(projectedDate)} 到` : rightWay ? '照現在速度兩年內到不了' : '近 4 週沒往目標走'

  if (targetDate < today) {
    const suggestedDate = projectedDate ?? addDays(today, Math.ceil(Math.abs(remaining) / (avg7 * 0.007) * 7))
    return {
      verdict: 'passed', avg7, targetWeight, targetDate, trendPerWeek: trend, projectedDate, suggestedDate,
      line: `目標日 ${md(targetDate)} 已過，還差 ${Math.abs(remaining).toFixed(1)}kg（現在 ${avg7}）。${trendText}，${pace}`,
    }
  }

  // 同一把尺：學員自己設目標時擋的就是這個
  const check = checkGoalSafety(avg7, targetWeight, targetDate, goalType, new Date(`${today}T00:00:00`))
  if (check.ok) return null
  const suggestedDate = check.suggestion?.targetDate ?? null
  const weeksLeft = Math.max(1, (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / (7 * DAY))
  const need = Math.abs(remaining) / weeksLeft
  return {
    verdict: 'unreachable', avg7, targetWeight, targetDate, trendPerWeek: trend, projectedDate, suggestedDate,
    line: `${md(targetDate)} 到 ${targetWeight}kg 要每週${goalType === 'cut' ? '掉' : '增'} ${need.toFixed(2)}kg（現在 ${avg7}），超過安全速度。${trendText}，${pace}${suggestedDate ? `；照建議速度約 ${md(suggestedDate)}` : ''}`,
  }
}
