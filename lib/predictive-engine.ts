/**
 * Predictive Engine
 * 預測式引擎 — 看到未來 2/4/8 週的體重趨勢
 *
 * 基於過去體重數據 + 當前熱量赤字 + 合規率，
 * 推算在不同情境下的體重走勢。
 *
 * 文獻依據：
 * - Hall et al. 2011: Dynamic model of body weight change
 * - Thomas et al. 2014: Energy balance model
 * - ISSN Position Stand: 0.5-1.0% BW/week safe rate
 */

export interface PredictiveInput {
  currentWeight: number  // kg
  bodyFatPct: number | null  // %
  goalType: 'cut' | 'bulk'
  targetWeight: number | null  // kg
  targetDate: string | null  // ISO date
  estimatedTDEE: number | null  // kcal
  currentCalories: number | null  // kcal
  nutritionCompliance: number  // 0-100
  dietStartDate: string | null

  // 過去 4 週的體重趨勢
  weeklyWeights: Array<{ week: number; avgWeight: number }>  // week 0 = 本週
}

export interface WeekProjection {
  week: number
  projectedWeight: number
  projectedBodyFat: number | null
  cumulativeLoss: number
  weeklyRate: number  // kg/week
  ratePercent: number  // % BW/week
}

export interface PredictiveResult {
  projections: WeekProjection[]
  onTrackForGoal: boolean | null  // null if no target
  estimatedGoalDate: string | null  // when target will be reached
  daysToGoal: number | null
  currentWeeklyRate: number | null  // kg/week based on actual data
  safetyWarning: string | null
  scenarios: {
    optimistic: WeekProjection[]  // 100% compliance
    realistic: WeekProjection[]   // current compliance
    pessimistic: WeekProjection[] // 50% compliance
  }
}

export function generatePrediction(input: PredictiveInput): PredictiveResult {
  const {
    currentWeight, bodyFatPct, goalType, targetWeight, targetDate,
    estimatedTDEE, currentCalories, nutritionCompliance, weeklyWeights
  } = input

  // ─── 計算當前實際每週變化率 ───
  let currentWeeklyRate: number | null = null
  if (weeklyWeights.length >= 2) {
    // 用最近兩週的平均體重差
    currentWeeklyRate = weeklyWeights[0].avgWeight - weeklyWeights[1].avgWeight
  }

  // ─── 計算理論赤字/盈餘 ───
  let dailyDeficit = 0
  if (estimatedTDEE && currentCalories) {
    dailyDeficit = estimatedTDEE - currentCalories  // positive = deficit (cut), negative = surplus (bulk)
  }

  // 能量密度：早期以水分為主 ~5500 kcal/kg，後期接近純脂肪 ~7700 kcal/kg
  // 使用 Hall 2011 的動態模型簡化版
  const ENERGY_DENSITY = 7000  // kcal/kg (blended average)

  // 理論每週減重（基於赤字）
  const theoreticalWeeklyLoss = (dailyDeficit * 7) / ENERGY_DENSITY  // kg/week

  // ─── 根據合規率調整 ───
  // 合規率影響實際赤字（不合規的日子假設吃到 TDEE）
  const complianceFactor = nutritionCompliance / 100
  const effectiveWeeklyLoss = theoreticalWeeklyLoss * complianceFactor

  // ─── 選擇預測基準 ───
  // 如果有實際體重數據（>= 2 週），混合使用實際 + 理論
  // 如果沒有，用純理論值
  let baseWeeklyRate: number
  if (currentWeeklyRate != null && weeklyWeights.length >= 3) {
    // 70% 實際 + 30% 理論（實際數據更可信）
    baseWeeklyRate = currentWeeklyRate * 0.7 + (goalType === 'cut' ? -effectiveWeeklyLoss : effectiveWeeklyLoss) * 0.3
  } else if (currentWeeklyRate != null) {
    // 數據較少，50/50
    baseWeeklyRate = currentWeeklyRate * 0.5 + (goalType === 'cut' ? -effectiveWeeklyLoss : effectiveWeeklyLoss) * 0.5
  } else {
    // 無實際數據
    baseWeeklyRate = goalType === 'cut' ? -effectiveWeeklyLoss : effectiveWeeklyLoss
  }

  // ─── 生成投射（8 週）───
  function projectWeeks(weeklyRate: number, weeks: number): WeekProjection[] {
    const projections: WeekProjection[] = []
    for (let w = 1; w <= weeks; w++) {
      const projectedWeight = Math.round((currentWeight + weeklyRate * w) * 100) / 100
      let projectedBodyFat: number | null = null
      if (bodyFatPct != null) {
        // 簡化假設：減重時脂肪佔減重的 75%，增重時脂肪佔增重的 40%
        const fatRatio = goalType === 'cut' ? 0.75 : 0.40
        const fatMassChange = weeklyRate * w * fatRatio
        const currentFatMass = currentWeight * (bodyFatPct / 100)
        const newFatMass = currentFatMass + fatMassChange
        projectedBodyFat = Math.round((newFatMass / projectedWeight) * 1000) / 10
        projectedBodyFat = Math.max(3, Math.min(60, projectedBodyFat))
      }

      projections.push({
        week: w,
        projectedWeight,
        projectedBodyFat,
        cumulativeLoss: Math.round((currentWeight - projectedWeight) * 100) / 100,
        weeklyRate: Math.round(Math.abs(weeklyRate) * 100) / 100,
        ratePercent: Math.round((Math.abs(weeklyRate) / currentWeight) * 10000) / 100,
      })
    }
    return projections
  }

  const realisticProjections = projectWeeks(baseWeeklyRate, 8)

  // ─── 三種情境 ───
  const optimisticRate = theoreticalWeeklyLoss > 0
    ? (goalType === 'cut' ? -theoreticalWeeklyLoss : theoreticalWeeklyLoss)
    : baseWeeklyRate * 1.2

  const pessimisticRate = baseWeeklyRate * 0.5

  const scenarios = {
    optimistic: projectWeeks(optimisticRate, 8),
    realistic: realisticProjections,
    pessimistic: projectWeeks(pessimisticRate, 8),
  }

  // ─── 目標達成預測 ───
  let onTrackForGoal: boolean | null = null
  let estimatedGoalDate: string | null = null
  let daysToGoal: number | null = null

  if (targetWeight != null && baseWeeklyRate !== 0) {
    const weightToChange = targetWeight - currentWeight  // negative for cut
    const weeksToGoal = weightToChange / baseWeeklyRate

    if (weeksToGoal > 0 && weeksToGoal < 52) {
      daysToGoal = Math.round(weeksToGoal * 7)
      const goalDate = new Date()
      goalDate.setDate(goalDate.getDate() + daysToGoal)
      estimatedGoalDate = goalDate.toISOString().split('T')[0]

      if (targetDate) {
        const targetDateObj = new Date(targetDate)
        onTrackForGoal = goalDate <= targetDateObj
      }
    } else if (weeksToGoal <= 0) {
      // 方向相反
      onTrackForGoal = false
    }
  }

  // ─── 安全警告 ───
  let safetyWarning: string | null = null
  const ratePercent = Math.abs(baseWeeklyRate) / currentWeight * 100

  if (goalType === 'cut' && ratePercent > 1.5) {
    safetyWarning = `目前減重速率 ${ratePercent.toFixed(1)}%/週，超過安全上限 1.0-1.5%。肌肉流失風險高，建議放慢速度。`
  } else if (goalType === 'cut' && ratePercent > 1.0) {
    safetyWarning = `目前減重速率 ${ratePercent.toFixed(1)}%/週，已接近上限。密切注意訓練表現和精力水平。`
  } else if (goalType === 'bulk' && ratePercent > 0.5) {
    safetyWarning = `目前增重速率 ${ratePercent.toFixed(1)}%/週，超過建議值 0.25-0.5%。脂肪增加比例可能偏高。`
  }

  return {
    projections: realisticProjections,
    onTrackForGoal,
    estimatedGoalDate,
    daysToGoal,
    currentWeeklyRate,
    safetyWarning,
    scenarios,
  }
}
