/**
 * 營養素自動建議引擎
 * 基於 2025-2026 最新運動科學文獻：
 * - ISSN Position Stand: 減脂速率 0.5-1.0% BW/week
 * - Physique Athletes Review: 蛋白質 ≥ 2.0g/kg (減脂), 1.6-2.2g/kg (增肌)
 * - Off-Season Bodybuilding: 增肌速率 0.25-0.5% BW/week, surplus +200-300kcal
 * - Caloric Restriction Meta-Analysis: 最大赤字 ≤ 500kcal/day
 * - Fat minimum: ≥ 0.8g/kg for hormonal health
 */

// ===== 類型定義 =====

export interface NutritionInput {
  // 學員資料
  gender: string  // '男性' | '女性'
  bodyWeight: number  // 當前體重 kg (最新紀錄)
  goalType: 'cut' | 'bulk'
  dietStartDate: string | null  // 開始日期 (ISO)

  // 當前目標
  currentCalories: number | null
  currentProtein: number | null
  currentCarbs: number | null
  currentFat: number | null
  currentCarbsTrainingDay: number | null
  currentCarbsRestDay: number | null
  carbsCyclingEnabled: boolean

  // 歷史數據 (近 14-28 天)
  weeklyWeights: { week: number; avgWeight: number }[]  // week 0 = 本週, 1 = 上週, 2 = 前2週...
  nutritionCompliance: number  // 飲食合規率 %
  avgDailyCalories: number | null  // 近 2 週平均每日攝取
  trainingDaysPerWeek: number
}

export interface NutritionSuggestion {
  status: 'on_track' | 'too_fast' | 'plateau' | 'wrong_direction' | 'insufficient_data' | 'low_compliance'
  statusLabel: string
  statusEmoji: string
  message: string

  // 建議的新目標
  suggestedCalories: number | null
  suggestedProtein: number | null
  suggestedCarbs: number | null
  suggestedFat: number | null
  suggestedCarbsTrainingDay: number | null
  suggestedCarbsRestDay: number | null

  // 變化量
  caloriesDelta: number
  proteinDelta: number
  carbsDelta: number
  fatDelta: number

  // 額外資訊
  estimatedTDEE: number | null
  weeklyWeightChangeRate: number | null  // % of BW per week
  dietDurationWeeks: number | null
  dietBreakSuggested: boolean
  warnings: string[]
}

// ===== 常數 (基於文獻) =====

const SAFETY = {
  MIN_CALORIES_MALE: 1500,
  MIN_CALORIES_FEMALE: 1200,
  MIN_PROTEIN_PER_KG_CUT: 2.0,   // ISSN: ≥2.0g/kg during deficit
  MIN_PROTEIN_PER_KG_BULK: 1.8,  // Off-season: 1.6-2.2, we use 1.8 floor
  MIN_FAT_PER_KG: 0.8,           // Hormonal health minimum
  MAX_FAT_PER_KG_BULK: 1.2,
  MAX_DEFICIT_KCAL: 500,          // Meta-analysis: ≤500kcal/day deficit
  DIET_BREAK_WEEKS: 8,            // Suggest diet break after 8 weeks continuous
}

const CUT_TARGETS = {
  // ISSN: 0.5-1.0% BW/week for lean mass retention
  MIN_RATE: -1.0,  // % per week (下限，太快)
  MAX_RATE: -0.3,  // % per week (上限，太慢 → 停滯)
  IDEAL_MIN: -1.0,
  IDEAL_MAX: -0.5,
}

const BULK_TARGETS = {
  // Off-Season Review: 0.25-0.5% BW/week
  MIN_RATE: 0.1,   // % per week (下限，停滯)
  MAX_RATE: 0.5,   // % per week (上限，太快)
  IDEAL_MIN: 0.25,
  IDEAL_MAX: 0.5,
}

// 碳循環分配比例：訓練日 60%，休息日 40%
const CARB_CYCLE_TRAINING_RATIO = 0.6
const CARB_CYCLE_REST_RATIO = 0.4

// ===== 主要引擎 =====

export function generateNutritionSuggestion(input: NutritionInput): NutritionSuggestion {
  const warnings: string[] = []

  // 1. 檢查數據是否足夠
  if (input.weeklyWeights.length < 2) {
    return {
      status: 'insufficient_data',
      statusLabel: '數據不足',
      statusEmoji: '📊',
      message: '需要至少 2 週的體重數據才能開始分析。請讓學員持續記錄體重。',
      suggestedCalories: null, suggestedProtein: null, suggestedCarbs: null, suggestedFat: null,
      suggestedCarbsTrainingDay: null, suggestedCarbsRestDay: null,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE: null, weeklyWeightChangeRate: null,
      dietDurationWeeks: null, dietBreakSuggested: false, warnings: [],
    }
  }

  // 2. 檢查合規率
  if (input.nutritionCompliance < 70) {
    return {
      status: 'low_compliance',
      statusLabel: '合規率偏低',
      statusEmoji: '⚠️',
      message: `飲食合規率僅 ${input.nutritionCompliance}%，建議先把合規率提升到 70% 以上再調整目標。目前的數據無法準確判斷進度。`,
      suggestedCalories: null, suggestedProtein: null, suggestedCarbs: null, suggestedFat: null,
      suggestedCarbsTrainingDay: null, suggestedCarbsRestDay: null,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE: null, weeklyWeightChangeRate: null,
      dietDurationWeeks: null, dietBreakSuggested: false, warnings: [],
    }
  }

  // 3. 計算週均體重變化率
  const thisWeekAvg = input.weeklyWeights[0].avgWeight
  const lastWeekAvg = input.weeklyWeights[1].avgWeight
  const weeklyChange = thisWeekAvg - lastWeekAvg  // kg
  const weeklyChangeRate = (weeklyChange / lastWeekAvg) * 100  // %

  // 4. 估算 Adaptive TDEE
  // TDEE = 平均每日攝取 - (週體重變化kg × 7700kcal / 7天)
  let estimatedTDEE: number | null = null
  if (input.avgDailyCalories != null) {
    estimatedTDEE = Math.round(input.avgDailyCalories - (weeklyChange * 7700 / 7))
  }

  // 5. 計算飲食持續天數
  let dietDurationWeeks: number | null = null
  if (input.dietStartDate) {
    const startDate = new Date(input.dietStartDate)
    const now = new Date()
    dietDurationWeeks = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }

  // 6. 根據目標類型分流
  if (input.goalType === 'cut') {
    return generateCutSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, warnings)
  } else {
    return generateBulkSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, warnings)
  }
}

// ===== 減脂引擎 =====

function generateCutSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  warnings: string[]
): NutritionSuggestion {
  const bw = input.bodyWeight
  const isMale = input.gender === '男性'
  const minCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE

  let status: NutritionSuggestion['status']
  let statusLabel: string
  let statusEmoji: string
  let message: string
  let calDelta = 0
  let carbDelta = 0
  let fatDelta = 0

  // 判斷進度
  if (weeklyChangeRate <= CUT_TARGETS.MIN_RATE) {
    // 掉太快 (< -1.0%)
    status = 'too_fast'
    statusLabel = '掉太快'
    statusEmoji = '🔴'
    calDelta = 150
    carbDelta = 20
    fatDelta = 0
    message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，超過安全範圍（-1.0%）。建議增加熱量以保護肌肉量。`
  } else if (weeklyChangeRate >= CUT_TARGETS.MAX_RATE) {
    // 持續 2 週看是否有上週數據佐證
    if (input.weeklyWeights.length >= 3) {
      const twoWeeksAgo = input.weeklyWeights[2].avgWeight
      const twoWeekChange = ((input.weeklyWeights[0].avgWeight - twoWeeksAgo) / twoWeeksAgo) * 100 / 2
      if (twoWeekChange >= CUT_TARGETS.MAX_RATE) {
        // 連續 2 週停滯
        status = 'plateau'
        statusLabel = '停滯期'
        statusEmoji = '🟡'
        calDelta = -175  // -150~200 中間值
        carbDelta = -22  // -20~25 中間值
        fatDelta = -5
        message = `體重已連續 2 週幾乎無變化（${weeklyChangeRate.toFixed(2)}%/週）。建議微降熱量突破停滯期。`
      } else {
        status = 'on_track'
        statusLabel = '進度正常'
        statusEmoji = '🟢'
        message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，處於安全範圍內。繼續維持目前計畫。`
      }
    } else {
      // 只有 2 週數據，先觀察
      status = 'on_track'
      statusLabel = '觀察中'
      statusEmoji = '🟢'
      message = `體重變化 ${weeklyChangeRate.toFixed(2)}%/週。數據尚少，再觀察一週。`
    }
  } else if (weeklyChangeRate > 0) {
    // 體重反而增加
    status = 'wrong_direction'
    statusLabel = '方向錯誤'
    statusEmoji = '🔴'
    calDelta = -225  // -200~250 中間值
    carbDelta = -27  // -25~30 中間值
    fatDelta = -7    // -5~10 中間值
    message = `體重反而增加（+${weeklyChangeRate.toFixed(2)}%/週）。需要降低熱量攝取。`
  } else {
    // 正常範圍 -0.3% ~ -1.0%
    status = 'on_track'
    statusLabel = '進度正常'
    statusEmoji = '🟢'
    message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，完美符合目標範圍（-0.5% ~ -1.0%）。`
  }

  // 計算建議值
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let suggestedCal = currentCal + calDelta
  let suggestedPro = currentPro  // 蛋白質永遠不降
  let suggestedCarb = currentCarb + carbDelta
  let suggestedFat = currentFat + fatDelta

  // 安全底線檢查
  const minProtein = Math.round(bw * SAFETY.MIN_PROTEIN_PER_KG_CUT)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${SAFETY.MIN_PROTEIN_PER_KG_CUT}g/kg）`)
  }

  const minFat = Math.round(bw * SAFETY.MIN_FAT_PER_KG)
  if (suggestedFat < minFat) {
    suggestedFat = minFat
    warnings.push(`脂肪不可低於 ${minFat}g（${SAFETY.MIN_FAT_PER_KG}g/kg），已調整至安全底線`)
  }

  if (suggestedCal < minCal) {
    suggestedCal = minCal
    warnings.push(`熱量不可低於 ${minCal}kcal（${isMale ? '男性' : '女性'}安全底線），已調整`)
  }

  // 赤字檢查
  if (estimatedTDEE && (estimatedTDEE - suggestedCal) > SAFETY.MAX_DEFICIT_KCAL) {
    warnings.push(`目前赤字已達 ${estimatedTDEE - suggestedCal}kcal，超過建議上限 500kcal`)
  }

  if (suggestedCarb < 50) {
    suggestedCarb = 50
    warnings.push('碳水已觸及最低值 50g，不建議再降')
  }

  // Diet break 建議
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS
  if (dietBreakSuggested) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週，建議安排 1-2 週維持期（diet break）以恢復荷爾蒙和心理狀態`)
  }

  // 碳循環分配
  let suggestedCarbsTD: number | null = null
  let suggestedCarbsRD: number | null = null
  if (input.carbsCyclingEnabled && input.currentCarbsTrainingDay != null && input.currentCarbsRestDay != null) {
    const totalCarbChange = carbDelta
    const tdChange = Math.round(totalCarbChange * CARB_CYCLE_TRAINING_RATIO)
    const rdChange = totalCarbChange - tdChange
    suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
    suggestedCarbsRD = input.currentCarbsRestDay + rdChange
    if (suggestedCarbsRD < 30) {
      suggestedCarbsRD = 30
      warnings.push('休息日碳水已觸及最低值 30g')
    }
  }

  // 如果 on_track 不需要改變
  if (status === 'on_track') {
    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: currentCal, suggestedProtein: currentPro,
      suggestedCarbs: currentCarb, suggestedFat: currentFat,
      suggestedCarbsTrainingDay: input.currentCarbsTrainingDay,
      suggestedCarbsRestDay: input.currentCarbsRestDay,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested, warnings,
    }
  }

  return {
    status, statusLabel, statusEmoji, message,
    suggestedCalories: Math.round(suggestedCal),
    suggestedProtein: Math.round(suggestedPro),
    suggestedCarbs: Math.round(suggestedCarb),
    suggestedFat: Math.round(suggestedFat),
    suggestedCarbsTrainingDay: suggestedCarbsTD != null ? Math.round(suggestedCarbsTD) : null,
    suggestedCarbsRestDay: suggestedCarbsRD != null ? Math.round(suggestedCarbsRD) : null,
    caloriesDelta: calDelta,
    proteinDelta: suggestedPro - currentPro,
    carbsDelta: carbDelta,
    fatDelta: fatDelta,
    estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
    dietDurationWeeks, dietBreakSuggested, warnings,
  }
}

// ===== 增肌引擎 =====

function generateBulkSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  warnings: string[]
): NutritionSuggestion {
  const bw = input.bodyWeight

  let status: NutritionSuggestion['status']
  let statusLabel: string
  let statusEmoji: string
  let message: string
  let calDelta = 0
  let carbDelta = 0
  let fatDelta = 0

  if (weeklyChangeRate > BULK_TARGETS.MAX_RATE) {
    // 增太快 (> +0.5%)
    status = 'too_fast'
    statusLabel = '增太快'
    statusEmoji = '🟡'
    calDelta = -125  // -100~150 中間值
    carbDelta = -17  // -15~20 中間值
    fatDelta = 0
    message = `體重增加速率 +${weeklyChangeRate.toFixed(2)}%/週，超過理想範圍（+0.5%），有脂肪堆積風險。建議微降熱量。`
  } else if (weeklyChangeRate < BULK_TARGETS.MIN_RATE) {
    if (weeklyChangeRate < 0) {
      // 體重下降 → 盈餘明顯不夠
      status = 'wrong_direction'
      statusLabel = '盈餘不足'
      statusEmoji = '🔴'
      calDelta = 275  // +250~300 中間值
      carbDelta = 30
      fatDelta = 0
      message = `體重反而下降（${weeklyChangeRate.toFixed(2)}%/週）。熱量盈餘明顯不夠，需要增加攝取。`
    } else {
      // 停滯 (0 ~ +0.1%)
      if (input.weeklyWeights.length >= 3) {
        const twoWeeksAgo = input.weeklyWeights[2].avgWeight
        const twoWeekRate = ((input.weeklyWeights[0].avgWeight - twoWeeksAgo) / twoWeeksAgo) * 100 / 2
        if (twoWeekRate < BULK_TARGETS.MIN_RATE) {
          status = 'plateau'
          statusLabel = '增長停滯'
          statusEmoji = '🟡'
          calDelta = 175  // +150~200 中間值
          carbDelta = 22  // +20~25 中間值
          fatDelta = 0
          message = `體重增長連續 2 週停滯（+${weeklyChangeRate.toFixed(2)}%/週）。建議增加熱量推動增長。`
        } else {
          status = 'on_track'
          statusLabel = '進度正常'
          statusEmoji = '🟢'
          message = `體重增加速率 +${weeklyChangeRate.toFixed(2)}%/週，接近目標範圍。`
        }
      } else {
        status = 'on_track'
        statusLabel = '觀察中'
        statusEmoji = '🟢'
        message = `體重變化 +${weeklyChangeRate.toFixed(2)}%/週。數據尚少，再觀察一週。`
      }
    }
  } else {
    // 完美範圍 +0.25% ~ +0.5%
    status = 'on_track'
    statusLabel = '進度正常'
    statusEmoji = '🟢'
    message = `體重增加速率 +${weeklyChangeRate.toFixed(2)}%/週，完美符合增肌目標（+0.25% ~ +0.5%）。`
  }

  // 計算建議值
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let suggestedCal = currentCal + calDelta
  let suggestedPro = currentPro
  let suggestedCarb = currentCarb + carbDelta
  let suggestedFat = currentFat + fatDelta

  // 安全底線
  const minProtein = Math.round(bw * SAFETY.MIN_PROTEIN_PER_KG_BULK)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${SAFETY.MIN_PROTEIN_PER_KG_BULK}g/kg）`)
  }

  const minFat = Math.round(bw * SAFETY.MIN_FAT_PER_KG)
  if (suggestedFat < minFat) {
    suggestedFat = minFat
    warnings.push(`脂肪不可低於 ${minFat}g（${SAFETY.MIN_FAT_PER_KG}g/kg），已調整`)
  }
  const maxFat = Math.round(bw * SAFETY.MAX_FAT_PER_KG_BULK)
  if (suggestedFat > maxFat) {
    suggestedFat = maxFat
    warnings.push(`增肌期脂肪建議不超過 ${maxFat}g（${SAFETY.MAX_FAT_PER_KG_BULK}g/kg）`)
  }

  // 碳循環分配
  let suggestedCarbsTD: number | null = null
  let suggestedCarbsRD: number | null = null
  if (input.carbsCyclingEnabled && input.currentCarbsTrainingDay != null && input.currentCarbsRestDay != null) {
    const totalCarbChange = carbDelta
    const tdChange = Math.round(totalCarbChange * CARB_CYCLE_TRAINING_RATIO)
    const rdChange = totalCarbChange - tdChange
    suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
    suggestedCarbsRD = input.currentCarbsRestDay + rdChange
  }

  // 如果 on_track 不需要改變
  if (status === 'on_track') {
    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: currentCal, suggestedProtein: currentPro,
      suggestedCarbs: currentCarb, suggestedFat: currentFat,
      suggestedCarbsTrainingDay: input.currentCarbsTrainingDay,
      suggestedCarbsRestDay: input.currentCarbsRestDay,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested: false, warnings,
    }
  }

  return {
    status, statusLabel, statusEmoji, message,
    suggestedCalories: Math.round(suggestedCal),
    suggestedProtein: Math.round(suggestedPro),
    suggestedCarbs: Math.round(suggestedCarb),
    suggestedFat: Math.round(suggestedFat),
    suggestedCarbsTrainingDay: suggestedCarbsTD != null ? Math.round(suggestedCarbsTD) : null,
    suggestedCarbsRestDay: suggestedCarbsRD != null ? Math.round(suggestedCarbsRD) : null,
    caloriesDelta: calDelta,
    proteinDelta: suggestedPro - currentPro,
    carbsDelta: carbDelta,
    fatDelta: fatDelta,
    estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
    dietDurationWeeks, dietBreakSuggested: false, warnings,
  }
}
