/**
 * 用體重變化對帳飲食紀錄：「你記的」 vs 「你身體顯示的」。
 *
 * ⚠️ 為什麼要有這個（2026-08-16 Howard 自己講的）：
 *   「我都填達標，可是其實我都有多吃」「我都不太敢回報體重，或者說都虛報」
 * 連系統的設計者兼 CSCS 教練都會這樣，代表**所有學員都會**。
 * 「今天照目標吃・全部達標」那顆鈕是我做的，它把虛報的成本降到零。
 *
 * 解法不是叫人誠實，是讓誠實與否**不影響判斷**：體重會說話。
 * 兩邊對不上時不是抓誰說謊 —— 另一個同樣常見的解釋是**熱量設定本身錯了**
 * （張承鈞：處方 2285 > 她的 TDEE 1837，她照吃反而變胖）。
 *
 * 這是估算。刻意設得保守（門檻高、資料不足回 null），寧可不說話也不要冤枉人。
 */

/** 1 kg 體重變化的熱量當量。增重期組織是脂肪+瘦體+水分混合，7700（純脂肪）會偏保守，
 *  方向與量級足夠做決策。見 nutrition-engine 的動態能量密度註解。 */
const KCAL_PER_KG = 7700

const MIN_WEIGHT_POINTS = 8
const MIN_SPAN_DAYS = 10
const MIN_NUTRITION_LOGS = 5
/** 差多少才開口。300 kcal 以內是估算誤差 + 日常波動，不值得講 */
const MIN_GAP_KCAL = 300

/** 各目標的「照計畫走」時該有的體重速率（kg/週）。用來把目標熱量換算成基準。 */
const EXPECTED_RATE: Record<string, number> = {
  bulk: 0.20,
  cut: -0.50,
  recomp: 0,
}

export type IntakeReconciliation = {
  /** 體重變化推算的每日實際攝取（kcal） */
  impliedDaily: number
  /** 飲食紀錄的每日平均（kcal） */
  loggedDaily: number
  /** implied − logged；>0 = 實際吃得比記的多 */
  gap: number
  /** 近期體重斜率（kg/週） */
  slopePerWeek: number
  /** 這個目標下「照計畫走」該有的斜率（kg/週） */
  expectedRatePerWeek: number
  weightPoints: number
  nutritionLogs: number
}

type WeightRow = { date: string; weight: number | null }
type NutritionRow = { date: string; calories: number | null }

const DAY = 86400000

function slopePerDay(points: { x: number; y: number }[]): number | null {
  const n = points.length
  if (n < 2) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x }
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  return (n * sxy - sx * sy) / denom
}

/**
 * 反推邏輯：目標熱量對應「該有的體重速率」；實際速率偏離多少，就換算成多吃/少吃多少。
 *
 *   impliedDaily = targetCalories + (實際速率 − 該有速率) × 7700 / 7
 *
 * 這樣不需要另外估 TDEE —— 教練設的目標熱量已經隱含了它。
 *
 * @param targetCalories 學員的每日目標熱量（clients.calories_target）
 * @param goalType       cut / bulk / recomp
 */
export function reconcileIntake(
  weights: WeightRow[],
  nutrition: NutritionRow[],
  targetCalories: number,
  goalType: string | null,
  windowDays = 21,
): IntakeReconciliation | null {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null

  const valid = weights
    .filter(w => w.weight != null)
    .map(w => ({ date: w.date, value: w.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (valid.length < MIN_WEIGHT_POINTS) return null

  const lastMs = new Date(valid[valid.length - 1].date + 'T00:00:00').getTime()
  const recent = valid.filter(v => new Date(v.date + 'T00:00:00').getTime() >= lastMs - windowDays * DAY)
  if (recent.length < MIN_WEIGHT_POINTS) return null

  const firstMs = new Date(recent[0].date + 'T00:00:00').getTime()
  if ((lastMs - firstMs) / DAY < MIN_SPAN_DAYS) return null

  const slope = slopePerDay(recent.map(v => ({
    x: (new Date(v.date + 'T00:00:00').getTime() - firstMs) / DAY,
    y: v.value,
  })))
  if (slope == null) return null

  const logs = nutrition
    .filter(n => n.calories != null && n.calories > 0)
    .filter(n => {
      const t = new Date(n.date + 'T00:00:00').getTime()
      return t >= firstMs && t <= lastMs
    })
  if (logs.length < MIN_NUTRITION_LOGS) return null

  const expectedRatePerWeek = EXPECTED_RATE[goalType ?? ''] ?? 0
  const rateGapPerWeek = slope * 7 - expectedRatePerWeek
  const loggedDaily = Math.round(logs.reduce((a, n) => a + (n.calories as number), 0) / logs.length)
  const impliedDaily = Math.round(targetCalories + rateGapPerWeek * KCAL_PER_KG / 7)

  return {
    impliedDaily,
    loggedDaily,
    gap: impliedDaily - loggedDaily,
    slopePerWeek: slope * 7,
    expectedRatePerWeek,
    weightPoints: recent.length,
    nutritionLogs: logs.length,
  }
}

export function isGapSignificant(r: IntakeReconciliation | null): boolean {
  return !!r && Math.abs(r.gap) >= MIN_GAP_KCAL
}

/**
 * 給人看的一句話。**刻意不指控** —— 講的是「兩個數字對不起來」，
 * 因為「紀錄漏了」和「目標設錯了」一樣可能，而且處理方式完全相反。
 */
export function reconciliationMessage(r: IntakeReconciliation): string {
  const { gap, impliedDaily, loggedDaily } = r
  if (gap > 0) {
    return `紀錄平均 ${loggedDaily} kcal，但體重變化推算實際約 ${impliedDaily} kcal（多 ${gap}）。` +
      `體重是最誠實的那個數字 —— 要嘛紀錄漏了什麼，要嘛目標本身該往下調。兩個都好處理，講一聲就行。`
  }
  return `紀錄平均 ${loggedDaily} kcal，但體重變化推算實際約 ${impliedDaily} kcal（少 ${Math.abs(gap)}）。` +
    `可能是吃得比記的少，或消耗比估的高 —— 先別再往下減，跟教練確認一次。`
}
