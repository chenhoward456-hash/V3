/**
 * 營養素自動建議引擎 v2
 * 基於 2025-2026 最新運動科學文獻：
 * - ISSN Position Stand: 減脂速率 0.5-1.0% BW/week
 * - Physique Athletes Review: 蛋白質 ≥ 2.0g/kg (減脂), 1.6-2.2g/kg (增肌)
 * - Off-Season Bodybuilding: 增肌速率 0.25-0.5% BW/week, surplus +200-300kcal
 * - Caloric Restriction Meta-Analysis: 最大赤字 ≤ 500kcal/day
 * - Fat minimum: ≥ 0.8g/kg for hormonal health
 *
 * Peak Week 文獻：
 * - Escalante et al. (2021) - Peak week recommendations: evidence based approach
 * - Barakat et al. (2022) - Peak Week Manipulations: muscle size case study
 * - Mitchell et al. (2024) - Peak Week Carbohydrate Manipulation: narrative review
 */

// ===== 類型定義 =====

export interface NutritionInput {
  // 學員資料
  gender: string  // '男性' | '女性'
  bodyWeight: number  // 當前體重 kg (最新紀錄)
  goalType: 'cut' | 'bulk'
  dietStartDate: string | null  // 開始日期 (ISO)

  // Deadline-aware（目標體重 + 目標日期）
  targetWeight: number | null
  targetDate: string | null  // 比賽日或目標日 (ISO)

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

  // 備賽階段（可選）
  prepPhase?: string  // 'peak_week' | 'cut' | 'bulk' | 'off_season' | etc.
}

export interface NutritionSuggestion {
  status: 'on_track' | 'too_fast' | 'plateau' | 'wrong_direction' | 'insufficient_data' | 'low_compliance' | 'peak_week' | 'goal_driven'
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

  // Deadline-aware info
  deadlineInfo: {
    daysLeft: number
    weeksLeft: number
    weightToLose: number  // 可正可負
    requiredRatePerWeek: number  // kg/week
    isAggressive: boolean  // 超過安全範圍
    // Goal-driven 額外資訊
    requiredDailyDeficit?: number    // 需要的每日赤字 kcal
    predictedCompWeight?: number     // 預測比賽日體重
    isGoalDriven?: boolean           // 是否啟用 goal-driven 模式
    safetyLevel?: 'normal' | 'aggressive' | 'extreme'  // 赤字安全等級
    // 有氧/步數建議（飲食不夠時靠活動量補）
    extraCardioNeeded?: boolean      // 是否需要額外有氧
    extraBurnPerDay?: number         // 每天需要額外燃燒 kcal
    suggestedCardioMinutes?: number  // 建議有氧分鐘數（中等強度）
    suggestedDailySteps?: number     // 建議每日步數
    cardioNote?: string              // 有氧建議說明
  } | null

  // 是否可以自動套用
  autoApply: boolean

  // Peak Week 每日計畫（僅 peak_week 狀態時有值）
  peakWeekPlan: PeakWeekDay[] | null
}

// Peak Week 每日計畫
export interface PeakWeekDay {
  daysOut: number       // 距比賽天數（7=7天前, 0=比賽日）
  date: string          // ISO date
  label: string         // 例如 'Day 7 - 碳水耗竭 + 上半身'
  phase: 'depletion' | 'fat_load' | 'carb_load' | 'taper' | 'show_day'
  carbsGPerKg: number
  proteinGPerKg: number
  fatGPerKg: number
  waterMlPerKg: number
  sodiumNote: string
  fiberNote: string
  trainingNote: string
  // 算好的絕對值
  carbs: number
  protein: number
  fat: number
  calories: number
  water: number // mL
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

// Goal-Driven 模式的放寬限制（用於備賽選手，允許更激進的赤字）
const GOAL_DRIVEN = {
  MIN_CALORIES_MALE: 1200,        // 備賽極限：1200kcal（短期可承受）
  MIN_CALORIES_FEMALE: 1000,
  MAX_DEFICIT_KCAL: 750,          // 允許最大赤字到 750kcal（備賽期）
  EXTREME_DEFICIT_KCAL: 1000,     // 極端赤字（最後 3 週，自動警告）
  MIN_PROTEIN_PER_KG: 2.3,       // 大赤字時提高蛋白質保護肌肉
  MIN_FAT_PER_KG: 0.5,           // 備賽最後階段可短期降到 0.5g/kg
  // 每週最大安全掉重率（備賽選手可承受更高）
  MAX_WEEKLY_LOSS_PCT: 1.5,       // 正常模式 1.0%，goal-driven 放寬到 1.5%
}

// 有氧消耗估算常數
const CARDIO = {
  // 中等強度有氧（快走/橢圓機/低阻力踩車）每分鐘消耗約 6-8 kcal
  // 保守估算用 6.5 kcal/min（適合備賽後期低能量狀態）
  MODERATE_KCAL_PER_MIN: 6.5,
  // 每步消耗約 0.04-0.05 kcal（體重相關，80kg 約 0.045）
  KCAL_PER_STEP: 0.045,
  // 基線步數（日常活動，不算額外有氧）
  BASELINE_STEPS: 5000,
  // 最大建議有氧時間（備賽期不應超過，避免肌肉流失）
  MAX_CARDIO_MINUTES: 60,
  // 最大建議步數
  MAX_DAILY_STEPS: 15000,
}

const CUT_TARGETS = {
  MIN_RATE: -1.0,  // % per week (下限，太快)
  MAX_RATE: -0.3,  // % per week (上限，太慢 → 停滯)
  IDEAL_MIN: -1.0,
  IDEAL_MAX: -0.5,
}

const BULK_TARGETS = {
  MIN_RATE: 0.1,   // % per week (下限，停滯)
  MAX_RATE: 0.5,   // % per week (上限，太快)
  IDEAL_MIN: 0.25,
  IDEAL_MAX: 0.5,
}

// 碳循環分配比例：訓練日 60%，休息日 40%
const CARB_CYCLE_TRAINING_RATIO = 0.6
const CARB_CYCLE_REST_RATIO = 0.4

// Peak Week 常數（基於 Escalante 2021 + Barakat 2022 + Mitchell 2024）
const PEAK_WEEK = {
  // 碳水耗竭期 (Day 7-4)：低碳 + 高脂補充肌內三酸甘油酯
  DEPLETION_CARB_G_PER_KG: 1.1,    // Barakat: 1.0-1.2
  DEPLETION_PROTEIN_G_PER_KG: 3.2,  // 高蛋白保護肌肉
  DEPLETION_FAT_G_PER_KG: 1.5,     // 高脂補 IMT（1.2-1.8 range）

  // 碳水超補期 (Day 3-2)
  LOADING_CARB_G_PER_KG: 9.0,      // Escalante: 8-12, Barakat: 7.8-8.0
  LOADING_PROTEIN_G_PER_KG: 2.2,   // 降低為碳水騰空間
  LOADING_FAT_G_PER_KG: 0.65,      // 低脂最大化碳水

  // Taper (Day 1)
  TAPER_CARB_G_PER_KG: 5.5,        // Barakat: 5.46
  TAPER_PROTEIN_G_PER_KG: 2.8,
  TAPER_FAT_G_PER_KG: 1.1,         // 中等脂肪防止 IMT 流失

  // 比賽日
  SHOW_CARB_G_PER_KG: 2.0,         // 小餐維持
  SHOW_PROTEIN_G_PER_KG: 3.0,
  SHOW_FAT_G_PER_KG: 0.5,

  // 水分操控（mL/kg）
  WATER_BASELINE: 90,     // Day 7-5：90 mL/kg
  WATER_LOADING: 140,     // Day 3-2：120-155 mL/kg (中間值)
  WATER_TAPER: 80,        // Day 1：80 mL/kg
  WATER_SHOW: 20,         // 比賽日：少量啜飲
}

// ===== 空結果模板 =====

function emptyResult(overrides: Partial<NutritionSuggestion>): NutritionSuggestion {
  return {
    status: 'insufficient_data', statusLabel: '', statusEmoji: '', message: '',
    suggestedCalories: null, suggestedProtein: null, suggestedCarbs: null, suggestedFat: null,
    suggestedCarbsTrainingDay: null, suggestedCarbsRestDay: null,
    caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
    estimatedTDEE: null, weeklyWeightChangeRate: null,
    dietDurationWeeks: null, dietBreakSuggested: false, warnings: [],
    deadlineInfo: null, autoApply: false, peakWeekPlan: null,
    ...overrides,
  }
}

// ===== 主要引擎 =====

export function generateNutritionSuggestion(input: NutritionInput): NutritionSuggestion {
  const warnings: string[] = []

  // 0. Peak Week 偵測：距比賽 ≤ 7 天且 prepPhase 是 peak_week
  if (input.targetDate && input.prepPhase === 'peak_week') {
    const now = new Date()
    const target = new Date(input.targetDate)
    const daysLeft = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    if (daysLeft <= 8) {
      return generatePeakWeekPlan(input, daysLeft)
    }
  }

  // 1. 檢查數據是否足夠
  if (input.weeklyWeights.length < 2) {
    return emptyResult({
      status: 'insufficient_data', statusLabel: '數據不足', statusEmoji: '📊',
      message: '需要至少 2 週的體重數據才能開始分析。請讓學員持續記錄體重。',
    })
  }

  // 2. 合規率低時加入警告，但不阻擋引擎運作（體重是最真實的指標）
  if (input.nutritionCompliance < 70) {
    warnings.push(`飲食合規率 ${input.nutritionCompliance}%，建議提高記錄完整度以提升建議準確性`)
  }

  // 3. 計算週均體重變化率
  const thisWeekAvg = input.weeklyWeights[0].avgWeight
  const lastWeekAvg = input.weeklyWeights[1].avgWeight
  const weeklyChange = thisWeekAvg - lastWeekAvg  // kg
  const weeklyChangeRate = (weeklyChange / lastWeekAvg) * 100  // %

  // 4. 估算 Adaptive TDEE
  let estimatedTDEE: number | null = null
  if (input.avgDailyCalories != null) {
    // 優先用 Adaptive TDEE（最準確，基於實際攝取 vs 體重變化）
    estimatedTDEE = Math.round(input.avgDailyCalories - (weeklyChange * 7700 / 7))
  } else if (input.currentCalories != null) {
    // Fallback: 用教練設定的當前目標卡路里 + 體重變化反推
    estimatedTDEE = Math.round(input.currentCalories - (weeklyChange * 7700 / 7))
    warnings.push('⚠️ 尚無飲食記錄，TDEE 基於目前設定的目標卡路里推算，準確度較低。建議記錄每日飲食提高精度')
  } else {
    // 最終 Fallback: 簡化公式估算（粗略）
    // 無身高年齡資料，用簡化公式：男性 TDEE ≈ 體重 × 30, 女性 ≈ 體重 × 27
    const isMale = input.gender === '男性'
    estimatedTDEE = Math.round(input.bodyWeight * (isMale ? 30 : 27))
    warnings.push(`⚠️ 無飲食記錄，TDEE 以體重公式粗估（${estimatedTDEE}kcal），建議記錄每日飲食讓系統自動校正`)
  }

  // 5. 計算飲食持續天數
  let dietDurationWeeks: number | null = null
  if (input.dietStartDate) {
    const startDate = new Date(input.dietStartDate)
    const now = new Date()
    dietDurationWeeks = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }

  // 6. Deadline-aware 計算
  let deadlineInfo: NutritionSuggestion['deadlineInfo'] = null
  if (input.targetWeight != null && input.targetDate) {
    const now = new Date()
    const target = new Date(input.targetDate)
    const daysLeft = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const weeksLeft = Math.max(0.5, daysLeft / 7)
    const weightToLose = thisWeekAvg - input.targetWeight
    const requiredRatePerWeek = weightToLose / weeksLeft
    const maxSafeRate = thisWeekAvg * 0.01
    const isAggressive = Math.abs(requiredRatePerWeek) > maxSafeRate

    deadlineInfo = { daysLeft, weeksLeft: Math.round(weeksLeft * 10) / 10, weightToLose: Math.round(weightToLose * 10) / 10, requiredRatePerWeek: Math.round(requiredRatePerWeek * 100) / 100, isAggressive }

    if (isAggressive) {
      warnings.push(`需要每週 ${input.goalType === 'cut' ? '減' : '增'} ${Math.abs(requiredRatePerWeek).toFixed(2)}kg 才能達標，超過安全範圍（${maxSafeRate.toFixed(1)}kg/週）`)
    }
  }

  // 7. 根據目標類型分流
  if (input.goalType === 'cut') {
    return generateCutSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings)
  } else {
    return generateBulkSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings)
  }
}

// ===== 減脂引擎 =====

function generateCutSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  deadlineInfo: NutritionSuggestion['deadlineInfo'],
  warnings: string[]
): NutritionSuggestion {
  const bw = input.bodyWeight
  const isMale = input.gender === '男性'

  // ===== Goal-Driven Mode =====
  // 條件：有目標體重 + 目標日期 + 有 TDEE 估算 → 直接反算每日卡路里
  if (deadlineInfo && estimatedTDEE && input.targetWeight != null && deadlineInfo.weightToLose > 0) {
    return generateGoalDrivenCut(input, estimatedTDEE, deadlineInfo, weeklyChangeRate, dietDurationWeeks, warnings)
  }

  // ===== 以下是原本的 Reactive Mode（無目標體重或無 TDEE 時 fallback）=====
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
    status = 'too_fast'
    statusLabel = '掉太快'
    statusEmoji = '🔴'
    calDelta = 150
    carbDelta = 20
    fatDelta = 0
    message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，超過安全範圍（-1.0%）。建議增加熱量以保護肌肉量。`
  } else if (weeklyChangeRate >= CUT_TARGETS.MAX_RATE) {
    if (input.weeklyWeights.length >= 3) {
      const twoWeeksAgo = input.weeklyWeights[2].avgWeight
      const twoWeekChange = ((input.weeklyWeights[0].avgWeight - twoWeeksAgo) / twoWeeksAgo) * 100 / 2
      if (twoWeekChange >= CUT_TARGETS.MAX_RATE) {
        status = 'plateau'
        statusLabel = '停滯期'
        statusEmoji = '🟡'
        calDelta = -175
        carbDelta = -22
        fatDelta = -5
        message = `體重已連續 2 週幾乎無變化（${weeklyChangeRate.toFixed(2)}%/週）。建議微降熱量突破停滯期。`
      } else {
        status = 'on_track'
        statusLabel = '進度正常'
        statusEmoji = '🟢'
        message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，處於安全範圍內。繼續維持目前計畫。`
      }
    } else {
      status = 'on_track'
      statusLabel = '觀察中'
      statusEmoji = '🟢'
      message = `體重變化 ${weeklyChangeRate.toFixed(2)}%/週。數據尚少，再觀察一週。`
    }
  } else if (weeklyChangeRate > 0) {
    status = 'wrong_direction'
    statusLabel = '方向錯誤'
    statusEmoji = '🔴'
    calDelta = -225
    carbDelta = -27
    fatDelta = -7
    message = `體重反而增加（+${weeklyChangeRate.toFixed(2)}%/週）。需要降低熱量攝取。`
  } else {
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

  // 碳循環分配（訓練日多碳水、休息日少碳水）
  let suggestedCarbsTD: number | null = null
  let suggestedCarbsRD: number | null = null
  if (input.carbsCyclingEnabled && input.currentCarbsTrainingDay != null && input.currentCarbsRestDay != null) {
    const tdChange = Math.round(carbDelta * CARB_CYCLE_TRAINING_RATIO)
    const rdChange = carbDelta - tdChange
    suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
    suggestedCarbsRD = input.currentCarbsRestDay + rdChange
    if (suggestedCarbsRD < 30) {
      suggestedCarbsRD = 30
      warnings.push('休息日碳水已觸及最低值 30g')
    }
  }

  // Deadline-aware: 如果進度落後且有 deadline，加大調整幅度
  if (deadlineInfo && status !== 'on_track' && status !== 'too_fast') {
    if (deadlineInfo.daysLeft < 28 && deadlineInfo.weightToLose > 1) {
      const urgencyMultiplier = Math.min(1.5, 1 + (1 - deadlineInfo.daysLeft / 28) * 0.5)
      calDelta = Math.round(calDelta * urgencyMultiplier)
      carbDelta = Math.round(carbDelta * urgencyMultiplier)
      suggestedCal = currentCal + calDelta
      suggestedCarb = currentCarb + carbDelta
      if (suggestedCal < minCal) suggestedCal = minCal
      if (suggestedCarb < 50) suggestedCarb = 50
      if (suggestedFat < minFat) suggestedFat = minFat
      // 碳循環也要重算
      if (input.carbsCyclingEnabled && input.currentCarbsTrainingDay != null && input.currentCarbsRestDay != null) {
        const tdChange = Math.round(carbDelta * CARB_CYCLE_TRAINING_RATIO)
        const rdChange = carbDelta - tdChange
        suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
        suggestedCarbsRD = input.currentCarbsRestDay + rdChange
        if (suggestedCarbsRD! < 30) suggestedCarbsRD = 30
      }
      message += ` ⏰ 距離目標僅剩 ${deadlineInfo.daysLeft} 天，需加速調整。`
    }
  }

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
      deadlineInfo, autoApply: false, peakWeekPlan: null,
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
    deadlineInfo, autoApply: true, peakWeekPlan: null,
  }
}

// ===== Goal-Driven 反算引擎（備賽核心）=====
// 給定目標體重 + 目標日期 + 當前 TDEE → 精確計算每日卡路里
// 邏輯：需要減的重量 × 7700kcal/kg ÷ 剩餘天數 = 每日赤字 → TDEE - 赤字 = 目標卡路里
function generateGoalDrivenCut(
  input: NutritionInput,
  estimatedTDEE: number,
  deadlineInfo: NonNullable<NutritionSuggestion['deadlineInfo']>,
  weeklyChangeRate: number,
  dietDurationWeeks: number | null,
  warnings: string[]
): NutritionSuggestion {
  const bw = input.bodyWeight
  const isMale = input.gender === '男性'
  const targetWeight = input.targetWeight!
  const daysLeft = deadlineInfo.daysLeft
  const weightToLose = deadlineInfo.weightToLose  // kg, positive = need to lose

  // 1. 計算需要的每日赤字
  const totalDeficitNeeded = weightToLose * 7700  // kcal total
  const requiredDailyDeficit = Math.round(totalDeficitNeeded / daysLeft)
  const requiredWeeklyLoss = weightToLose / (daysLeft / 7)
  const weeklyLossPct = (requiredWeeklyLoss / bw) * 100

  // 2. 判斷安全等級
  let safetyLevel: 'normal' | 'aggressive' | 'extreme'
  if (requiredDailyDeficit <= SAFETY.MAX_DEFICIT_KCAL) {
    safetyLevel = 'normal'
  } else if (requiredDailyDeficit <= GOAL_DRIVEN.MAX_DEFICIT_KCAL) {
    safetyLevel = 'aggressive'
  } else {
    safetyLevel = 'extreme'
  }

  // 3. 計算目標每日卡路里
  let targetCalories = Math.round(estimatedTDEE - requiredDailyDeficit)

  // 4. 安全底線（Goal-Driven 模式使用放寬的底線）
  const absoluteMinCal = isMale ? GOAL_DRIVEN.MIN_CALORIES_MALE : GOAL_DRIVEN.MIN_CALORIES_FEMALE
  const softMinCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE

  // 計算如果被底線限制，實際能達到的體重
  let predictedCompWeight: number
  let caloriesCapped = false

  // 計算有氧/步數需求
  let extraCardioNeeded = false
  let extraBurnPerDay = 0
  let suggestedCardioMinutes = 0
  let suggestedDailySteps = CARDIO.BASELINE_STEPS
  let cardioNote = ''

  if (targetCalories < absoluteMinCal) {
    // 被硬底線限制 → 需要靠有氧補差距
    caloriesCapped = true
    const dietOnlyDeficit = estimatedTDEE - absoluteMinCal
    extraBurnPerDay = requiredDailyDeficit - dietOnlyDeficit  // 飲食不夠的缺口
    targetCalories = absoluteMinCal

    if (extraBurnPerDay > 0) {
      extraCardioNeeded = true
      // 換算有氧分鐘數
      suggestedCardioMinutes = Math.min(
        CARDIO.MAX_CARDIO_MINUTES,
        Math.ceil(extraBurnPerDay / CARDIO.MODERATE_KCAL_PER_MIN)
      )
      // 換算步數（有氧以外的部分用步數補）
      const cardioCanBurn = suggestedCardioMinutes * CARDIO.MODERATE_KCAL_PER_MIN
      const remainingBurn = Math.max(0, extraBurnPerDay - cardioCanBurn)
      const extraSteps = Math.ceil(remainingBurn / CARDIO.KCAL_PER_STEP)
      suggestedDailySteps = Math.min(CARDIO.MAX_DAILY_STEPS, CARDIO.BASELINE_STEPS + extraSteps)

      // 重新計算有有氧加持後的預測體重
      const totalDailyBurn = dietOnlyDeficit + cardioCanBurn + extraSteps * CARDIO.KCAL_PER_STEP
      const totalLossWithCardio = (totalDailyBurn * daysLeft) / 7700
      predictedCompWeight = Math.round((bw - totalLossWithCardio) * 10) / 10

      // 判斷加了有氧後能否達標
      if (predictedCompWeight <= targetWeight + 0.3) {
        cardioNote = `飲食 + 有氧可達標！每日 ${suggestedCardioMinutes} 分鐘中等強度有氧 + ${suggestedDailySteps.toLocaleString()} 步`
      } else {
        cardioNote = `即使加上有氧，預測 ${predictedCompWeight}kg（目標 ${targetWeight}kg）。差距 ${(predictedCompWeight - targetWeight).toFixed(1)}kg，建議與教練討論調整量級或目標`
      }

      warnings.push(`🏃 飲食赤字不足，需額外每日消耗 ${Math.round(extraBurnPerDay)}kcal → 建議有氧 ${suggestedCardioMinutes} 分鐘/天 + 步數 ${suggestedDailySteps.toLocaleString()} 步/天`)
    } else {
      const actualTotalLoss = (dietOnlyDeficit * daysLeft) / 7700
      predictedCompWeight = Math.round((bw - actualTotalLoss) * 10) / 10
    }
  } else {
    predictedCompWeight = targetWeight  // 飲食面可以達到

    // 即使不被底線限制，也建議一定的活動量維持代謝
    if (safetyLevel !== 'normal') {
      suggestedCardioMinutes = safetyLevel === 'extreme' ? 30 : 20
      suggestedDailySteps = safetyLevel === 'extreme' ? 10000 : 8000
      cardioNote = `建議維持每日 ${suggestedCardioMinutes} 分鐘低強度有氧 + ${suggestedDailySteps.toLocaleString()} 步，幫助赤字執行`
    }
  }

  if (targetCalories < softMinCal) {
    warnings.push(`🔥 目標熱量 ${targetCalories}kcal 低於一般安全線 ${softMinCal}kcal，已進入備賽極限模式`)
  }

  // 5. 計算巨量營養素分配
  // Goal-Driven 模式：蛋白質提高（保護肌肉），脂肪降到備賽底線，剩餘給碳水
  const minProteinPerKg = safetyLevel === 'normal' ? SAFETY.MIN_PROTEIN_PER_KG_CUT : GOAL_DRIVEN.MIN_PROTEIN_PER_KG
  const minFatPerKg = safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG

  let suggestedPro = Math.round(bw * minProteinPerKg)
  let suggestedFat = Math.round(bw * minFatPerKg)

  // 蛋白質和脂肪先佔的卡路里
  const proFatCal = suggestedPro * 4 + suggestedFat * 9
  let suggestedCarb = Math.max(30, Math.round((targetCalories - proFatCal) / 4))

  // 反算實際卡路里（可能因為碳水有底線而微調）
  const actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)

  // 6. 碳循環分配
  let suggestedCarbsTD: number | null = null
  let suggestedCarbsRD: number | null = null
  if (input.carbsCyclingEnabled) {
    // 訓練日多碳水(60%)、休息日少碳水(40%)
    const avgDailyCarb = suggestedCarb
    const trainingDays = Math.min(input.trainingDaysPerWeek, 6)
    const ratio = trainingDays > 0 ? CARB_CYCLE_TRAINING_RATIO : 0.5
    suggestedCarbsTD = Math.round(avgDailyCarb * (1 + (ratio - 0.5) * 2))  // 偏高
    suggestedCarbsRD = Math.round(avgDailyCarb * (1 - (ratio - 0.5) * 2))  // 偏低
    if (suggestedCarbsRD < 20) suggestedCarbsRD = 20
  }

  // 7. 構建狀態訊息
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let statusEmoji = '🎯'
  let statusLabel = '目標驅動'
  let message = ''

  if (caloriesCapped) {
    statusEmoji = '⚠️'
    statusLabel = '底線限制'
    message = `以目前 TDEE ${estimatedTDEE}kcal，需要每日赤字 ${requiredDailyDeficit}kcal 才能達到 ${targetWeight}kg。`
    message += `飲食限制在 ${absoluteMinCal}kcal`
    if (extraCardioNeeded) {
      message += `，搭配每日有氧 ${suggestedCardioMinutes} 分鐘 + ${suggestedDailySteps.toLocaleString()} 步`
      if (predictedCompWeight <= targetWeight + 0.3) {
        message += `，預測可達 ${predictedCompWeight}kg ✓`
      } else {
        message += `，預測 ${predictedCompWeight}kg（差 ${(predictedCompWeight - targetWeight).toFixed(1)}kg）`
      }
    } else {
      message += `，預測比賽日 ${predictedCompWeight}kg。`
    }
  } else if (safetyLevel === 'extreme') {
    statusEmoji = '🔥'
    message = `目標模式：每日赤字 ${requiredDailyDeficit}kcal（極限），預計每週掉 ${requiredWeeklyLoss.toFixed(2)}kg（${weeklyLossPct.toFixed(1)}% BW）。`
    message += ` 距比賽 ${daysLeft} 天，需減 ${weightToLose.toFixed(1)}kg。目標卡路里 ${actualCalories}kcal。`
    warnings.push(`🚨 每日赤字 ${requiredDailyDeficit}kcal 已超過 750kcal 極限，請確保足夠休息和蛋白質攝取`)
  } else if (safetyLevel === 'aggressive') {
    statusEmoji = '🎯'
    message = `目標模式：每日赤字 ${requiredDailyDeficit}kcal（積極），預計每週掉 ${requiredWeeklyLoss.toFixed(2)}kg（${weeklyLossPct.toFixed(1)}% BW）。`
    message += ` 距比賽 ${daysLeft} 天，目標卡路里 ${actualCalories}kcal。可以達標。`
    warnings.push(`⚡ 赤字已超過一般建議的 500kcal，備賽模式已啟用放寬限制`)
  } else {
    statusEmoji = '✅'
    message = `目標模式：每日赤字 ${requiredDailyDeficit}kcal，預計每週掉 ${requiredWeeklyLoss.toFixed(2)}kg（${weeklyLossPct.toFixed(1)}% BW）。`
    message += ` 在安全範圍內，距比賽 ${daysLeft} 天，穩穩達標。`
  }

  // 如果實際體重趨勢偏離目標，追加提示
  if (weeklyChangeRate > 0) {
    message += ` ⚠️ 注意：上週體重反而增加了 ${weeklyChangeRate.toFixed(2)}%，請確實執行計畫。`
  } else if (weeklyChangeRate < -GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT) {
    message += ` ⚠️ 上週掉太快（${weeklyChangeRate.toFixed(2)}%），注意肌肉流失。`
    warnings.push('掉重速率超過 1.5%/週，建議增加蛋白質攝取量或微增碳水')
  }

  // Diet break 建議
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS
  if (dietBreakSuggested && daysLeft > 21) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週。距比賽還有 ${daysLeft} 天，建議安排 3-5 天 refeed 恢復代謝`)
  }

  // 更新 deadlineInfo 加入 goal-driven + 有氧資訊
  const enrichedDeadlineInfo = {
    ...deadlineInfo,
    requiredDailyDeficit,
    predictedCompWeight,
    isGoalDriven: true,
    safetyLevel,
    extraCardioNeeded,
    extraBurnPerDay: Math.round(extraBurnPerDay),
    suggestedCardioMinutes,
    suggestedDailySteps,
    cardioNote,
  }

  return {
    status: 'goal_driven',
    statusLabel,
    statusEmoji,
    message,
    suggestedCalories: actualCalories,
    suggestedProtein: suggestedPro,
    suggestedCarbs: suggestedCarb,
    suggestedFat: suggestedFat,
    suggestedCarbsTrainingDay: suggestedCarbsTD,
    suggestedCarbsRestDay: suggestedCarbsRD,
    caloriesDelta: actualCalories - currentCal,
    proteinDelta: suggestedPro - currentPro,
    carbsDelta: suggestedCarb - currentCarb,
    fatDelta: suggestedFat - currentFat,
    estimatedTDEE,
    weeklyWeightChangeRate: weeklyChangeRate,
    dietDurationWeeks,
    dietBreakSuggested,
    warnings,
    deadlineInfo: enrichedDeadlineInfo,
    autoApply: true,  // Goal-driven 永遠自動套用
    peakWeekPlan: null,
  }
}

// ===== 增肌引擎 =====

function generateBulkSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  deadlineInfo: NutritionSuggestion['deadlineInfo'],
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
    status = 'too_fast'
    statusLabel = '增太快'
    statusEmoji = '🟡'
    calDelta = -125
    carbDelta = -17
    fatDelta = 0
    message = `體重增加速率 +${weeklyChangeRate.toFixed(2)}%/週，超過理想範圍（+0.5%），有脂肪堆積風險。建議微降熱量。`
  } else if (weeklyChangeRate < BULK_TARGETS.MIN_RATE) {
    if (weeklyChangeRate < 0) {
      status = 'wrong_direction'
      statusLabel = '盈餘不足'
      statusEmoji = '🔴'
      calDelta = 275
      carbDelta = 30
      fatDelta = 0
      message = `體重反而下降（${weeklyChangeRate.toFixed(2)}%/週）。熱量盈餘明顯不夠，需要增加攝取。`
    } else {
      if (input.weeklyWeights.length >= 3) {
        const twoWeeksAgo = input.weeklyWeights[2].avgWeight
        const twoWeekRate = ((input.weeklyWeights[0].avgWeight - twoWeeksAgo) / twoWeeksAgo) * 100 / 2
        if (twoWeekRate < BULK_TARGETS.MIN_RATE) {
          status = 'plateau'
          statusLabel = '增長停滯'
          statusEmoji = '🟡'
          calDelta = 175
          carbDelta = 22
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
    const tdChange = Math.round(carbDelta * CARB_CYCLE_TRAINING_RATIO)
    const rdChange = carbDelta - tdChange
    suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
    suggestedCarbsRD = input.currentCarbsRestDay + rdChange
  }

  // 增肌期 Deadline-aware（目標體重 > 當前體重時）
  if (deadlineInfo && status !== 'on_track' && status !== 'too_fast') {
    if (deadlineInfo.daysLeft < 28 && deadlineInfo.weightToLose < -1) {
      // 還差 >1kg 要增，加大盈餘
      const urgencyMultiplier = Math.min(1.5, 1 + (1 - deadlineInfo.daysLeft / 28) * 0.5)
      calDelta = Math.round(calDelta * urgencyMultiplier)
      carbDelta = Math.round(carbDelta * urgencyMultiplier)
      suggestedCal = currentCal + calDelta
      suggestedCarb = currentCarb + carbDelta
      message += ` ⏰ 距離目標僅剩 ${deadlineInfo.daysLeft} 天，需加速增量。`
    }
  }

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
      deadlineInfo, autoApply: false, peakWeekPlan: null,
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
    deadlineInfo, autoApply: true, peakWeekPlan: null,
  }
}

// ===== Peak Week 引擎 =====
// 基於 Escalante 2021 + Barakat 2022 + Mitchell 2024

function generatePeakWeekPlan(input: NutritionInput, daysLeft: number): NutritionSuggestion {
  const bw = input.bodyWeight
  const compDate = new Date(input.targetDate!)
  const plan: PeakWeekDay[] = []

  // 建立 Day 7 到 Day 0（比賽日）的每日計畫
  for (let d = Math.min(daysLeft, 7); d >= 0; d--) {
    const dayDate = new Date(compDate)
    dayDate.setDate(compDate.getDate() - d)
    const dateStr = dayDate.toISOString().split('T')[0]

    let day: PeakWeekDay

    if (d >= 4) {
      // Day 7-4：碳水耗竭 + 脂肪補充 IMT
      const trainingMap: Record<number, string> = {
        7: '耗竭訓練：上半身（高次數 >12RM，巨組）',
        6: '耗竭訓練：下半身（高次數 >12RM，巨組）',
        5: '耗竭訓練：全身（中等重量，每組 >15 次）',
        4: '輕量 pump / 休息',
      }
      day = {
        daysOut: d, date: dateStr,
        label: `Day ${d} — 碳水耗竭期`,
        phase: d >= 6 ? 'depletion' : 'fat_load',
        carbsGPerKg: PEAK_WEEK.DEPLETION_CARB_G_PER_KG,
        proteinGPerKg: PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.DEPLETION_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_BASELINE,
        sodiumNote: '正常鈉攝取',
        fiberNote: d <= 5 ? '開始減少纖維（目標 <15g）' : '正常',
        trainingNote: trainingMap[d] || '休息',
        carbs: Math.round(bw * PEAK_WEEK.DEPLETION_CARB_G_PER_KG),
        protein: Math.round(bw * PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.DEPLETION_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_BASELINE),
      }
    } else if (d >= 2) {
      // Day 3-2：碳水超補 + 水分加載 + 鈉加載
      day = {
        daysOut: d, date: dateStr,
        label: `Day ${d} — 碳水超補期 🍚`,
        phase: 'carb_load',
        carbsGPerKg: PEAK_WEEK.LOADING_CARB_G_PER_KG,
        proteinGPerKg: PEAK_WEEK.LOADING_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.LOADING_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_LOADING,
        sodiumNote: '鈉加載 +30%（多加鹽，幫助碳水吸收入肌肉）',
        fiberNote: '低纖維（<12g），選白飯、白吐司等精緻碳水',
        trainingNote: '完全休息（保存肝醣）',
        carbs: Math.round(bw * PEAK_WEEK.LOADING_CARB_G_PER_KG),
        protein: Math.round(bw * PEAK_WEEK.LOADING_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.LOADING_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_LOADING),
      }
    } else if (d === 1) {
      // Day 1：Taper — 碳水微降 + 水分回調 + 脂肪中等（防 IMT 流失）
      day = {
        daysOut: d, date: dateStr,
        label: 'Day 1 — 微調日',
        phase: 'taper',
        carbsGPerKg: PEAK_WEEK.TAPER_CARB_G_PER_KG,
        proteinGPerKg: PEAK_WEEK.TAPER_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.TAPER_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_TAPER,
        sodiumNote: '恢復正常鈉',
        fiberNote: '極低纖維（<10g），避免腹脹',
        trainingNote: '完全休息或極輕 pump',
        carbs: Math.round(bw * PEAK_WEEK.TAPER_CARB_G_PER_KG),
        protein: Math.round(bw * PEAK_WEEK.TAPER_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.TAPER_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_TAPER),
      }
    } else {
      // Day 0：比賽日
      day = {
        daysOut: 0, date: dateStr,
        label: '🏆 比賽日',
        phase: 'show_day',
        carbsGPerKg: PEAK_WEEK.SHOW_CARB_G_PER_KG,
        proteinGPerKg: PEAK_WEEK.SHOW_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.SHOW_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_SHOW,
        sodiumNote: '正常，少量啜飲',
        fiberNote: '幾乎零纖維',
        trainingNote: '後台 pump-up：彈力帶 + 輕啞鈴',
        carbs: Math.round(bw * PEAK_WEEK.SHOW_CARB_G_PER_KG),
        protein: Math.round(bw * PEAK_WEEK.SHOW_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.SHOW_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_SHOW),
      }
    }

    // 計算熱量
    day.calories = Math.round(day.protein * 4 + day.carbs * 4 + day.fat * 9)
    plan.push(day)
  }

  // 找到今天的計畫
  const todayStr = new Date().toISOString().split('T')[0]
  const todayPlan = plan.find(p => p.date === todayStr) || plan[0]

  return {
    status: 'peak_week',
    statusLabel: 'Peak Week',
    statusEmoji: '🏆',
    message: `距比賽 ${daysLeft} 天 — ${todayPlan.label}。今日碳水 ${todayPlan.carbs}g、蛋白質 ${todayPlan.protein}g、脂肪 ${todayPlan.fat}g、水 ${(todayPlan.water / 1000).toFixed(1)}L`,
    suggestedCalories: todayPlan.calories,
    suggestedProtein: todayPlan.protein,
    suggestedCarbs: todayPlan.carbs,
    suggestedFat: todayPlan.fat,
    suggestedCarbsTrainingDay: null,
    suggestedCarbsRestDay: null,
    caloriesDelta: todayPlan.calories - (input.currentCalories || 0),
    proteinDelta: todayPlan.protein - (input.currentProtein || 0),
    carbsDelta: todayPlan.carbs - (input.currentCarbs || 0),
    fatDelta: todayPlan.fat - (input.currentFat || 0),
    estimatedTDEE: null,
    weeklyWeightChangeRate: null,
    dietDurationWeeks: null,
    dietBreakSuggested: false,
    warnings: [
      '⚠️ Peak Week 期間營養素每日不同，請嚴格按照每日計畫執行',
      `💧 今日飲水目標：${(todayPlan.water / 1000).toFixed(1)}L（${todayPlan.waterMlPerKg} mL/kg）`,
      `🧂 ${todayPlan.sodiumNote}`,
      `🥬 纖維：${todayPlan.fiberNote}`,
      `🏋️ ${todayPlan.trainingNote}`,
    ],
    deadlineInfo: { daysLeft, weeksLeft: Math.round(daysLeft / 7 * 10) / 10, weightToLose: 0, requiredRatePerWeek: 0, isAggressive: false },
    autoApply: true,
    peakWeekPlan: plan,
  }
}
