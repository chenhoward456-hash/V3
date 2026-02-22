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

  // 身體組成（用於 Katch-McArdle BMR 估算 TDEE）
  height?: number | null        // 身高 cm
  bodyFatPct?: number | null    // 體脂率 %（例如 10 = 10%）

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
// 主要文獻：
//   Helms et al. 2014 (JISSN) — 備賽營養建議
//   Iraki et al. 2019 (JOHK) — Physique athletes 營養建議
//   Hall 2008 (IJOB) — 動態能量平衡模型
//   Thomas et al. 2013 (IJOB) — 體重預測修正
//   Garthe et al. 2011 — 慢速 vs 快速減重對 LBM 的影響

const SAFETY = {
  MIN_CALORIES_MALE: 1500,
  MIN_CALORIES_FEMALE: 1200,
  MIN_PROTEIN_PER_KG_CUT: 2.3,   // Helms 2014: 2.3-3.1g/kg LBM → 用體重近似取下限
  MIN_PROTEIN_PER_KG_BULK: 1.8,  // Off-season: 1.6-2.2, we use 1.8 floor
  MIN_FAT_PER_KG: 0.8,           // Hormonal health minimum (15-20% calories)
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
  // 蛋白質依赤字深度分級 (Helms 2014: 赤字越大 → 蛋白質越高)
  PROTEIN_PER_KG_NORMAL: 2.3,    // normal 赤字：2.3g/kg
  PROTEIN_PER_KG_AGGRESSIVE: 2.6, // aggressive：2.6g/kg
  PROTEIN_PER_KG_EXTREME: 3.0,   // extreme：3.0g/kg（接近 LBM 的 3.1g/kg 上限）
  MIN_FAT_PER_KG: 0.7,           // 備賽最低 0.7g/kg (Iraki: 15-25% cal, ~15% at 1200kcal = 20g ≈ 0.7g/80kg)
  // 每週最大安全掉重率 (Helms: 0.5-1.0%, Garthe: >1.4% 損失 LBM)
  MAX_WEEKLY_LOSS_PCT: 1.2,       // goal-driven 放寬到 1.2%（1.0% 理想上限 + 10% 備賽彈性）
}

// 動態能量密度（取代靜態 7700 kcal/kg）
// Hall 2008: 早期減重 ~4800 kcal/kg（含水分+glycogen），後期趨近 7700
// 備賽選手體脂低，減掉的含較多 LBM → 實際能量密度較低
const ENERGY_DENSITY = {
  PURE_FAT: 7700,                 // 純脂肪 1kg = 7700 kcal
  EARLY_PHASE: 5500,              // 減重前期（前 4-6 週）含水分+glycogen
  LATE_PHASE: 6500,               // 減重後期（6 週+）趨近脂肪但仍含部分 LBM
  CONTEST_LEAN: 5500,             // 備賽選手（<12% BF）：LBM 流失比例較高
}

// 有氧消耗估算常數
const CARDIO = {
  // 中等強度有氧的基礎消耗（kcal/min/kg），體重修正用
  // ACSM: 中等強度（快走 5-6km/h）≈ 3.5-7 METs
  // 備賽後期代謝適應折扣 15-25%（Trexler 2014: adaptive thermogenesis）
  BASE_KCAL_PER_MIN_PER_KG: 0.075, // ~6 kcal/min for 80kg（保守，已含適應折扣）
  PREP_FATIGUE_DISCOUNT: 0.80,     // 備賽後期效率折扣（代謝適應 + 疲勞）
  // 每步消耗（體重修正）
  BASE_KCAL_PER_STEP_PER_KG: 0.0005, // 80kg × 0.0005 = 0.04 kcal/step
  // 基線步數（日常活動，不算額外有氧）
  BASELINE_STEPS: 5000,
  // 最大建議有氧時間（備賽期不應超過，避免肌肉流失）
  // Helms 2014: 過量有氧 → 干擾力量訓練恢復
  MAX_CARDIO_MINUTES: 45,          // 從 60 降到 45（文獻建議保守）
  // 最大建議步數
  MAX_DAILY_STEPS: 12000,          // 從 15000 降到 12000（更實際）
  // 每日額外活動消耗的合理上限（kcal）
  // 現實中備賽選手很難每天靠活動額外消耗超過 400-500 kcal
  MAX_EXTRA_BURN_PER_DAY: 500,     // 有氧+步數合計上限
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

// ===== 動態能量密度計算 =====
// 依備賽階段和剩餘天數決定每公斤體重變化的 kcal 密度
function getEnergyDensity(daysLeft: number, dietDurationWeeks: number | null): number {
  // 備賽選手體脂低 + 減重後期 → 不純粹是脂肪
  if (dietDurationWeeks != null && dietDurationWeeks < 4) {
    return ENERGY_DENSITY.EARLY_PHASE  // 5500: 前 4 週含大量水分+glycogen
  }
  if (daysLeft <= 21) {
    return ENERGY_DENSITY.CONTEST_LEAN  // 5500: 最後 3 週，體脂極低，LBM 流失比例增加
  }
  return ENERGY_DENSITY.LATE_PHASE  // 6500: 減重中後期
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

  // 4. 計算飲食持續天數（提前算，TDEE 和 goal-driven 都需要）
  let dietDurationWeeks: number | null = null
  if (input.dietStartDate) {
    const startDate = new Date(input.dietStartDate)
    const now = new Date()
    dietDurationWeeks = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }

  // 5. 計算目標日距（提前算，TDEE 需要能量密度）
  let daysToTarget: number | null = null
  if (input.targetDate) {
    const now = new Date()
    const target = new Date(input.targetDate)
    daysToTarget = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // 6. 估算 TDEE
  // 策略：
  //   A) Katch-McArdle 公式 TDEE（有體脂率時，最穩定的基準）
  //   B) Adaptive TDEE（有飲食記錄+體重變化，最準但依賴數據品質）
  //   C) 簡化公式（體重 × 係數，最粗略的 fallback）
  //
  // 選擇邏輯：
  //   - 合規率 ≥ 70% + 有飲食記錄 → 用 Adaptive，但不低於公式值的 80%（sanity check）
  //   - 合規率 < 70% 或無飲食記錄 → 直接用公式值（飲食數據不可信）
  const tdeeDensity = daysToTarget != null ? getEnergyDensity(daysToTarget, dietDurationWeeks) : ENERGY_DENSITY.LATE_PHASE
  const isMale = input.gender === '男性'

  // A) 公式 TDEE（Katch-McArdle 或簡化）
  let formulaTDEE: number | null = null
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    // Katch-McArdle: BMR = 370 + 21.6 × LBM(kg)
    const lbm = input.bodyWeight * (1 - input.bodyFatPct / 100)
    const bmr = 370 + 21.6 * lbm
    // 活動係數：備賽選手重訓 4-5 天，但有氧少、NEAT 因長期減脂而降低
    // 備賽中後期代謝適應約 -10%（Trexler 2014: adaptive thermogenesis）
    const activityMultiplier = input.trainingDaysPerWeek >= 4 ? 1.45 : 1.35
    const metabolicAdaptation = dietDurationWeeks != null && dietDurationWeeks >= 8 ? 0.90 : 0.95
    formulaTDEE = Math.round(bmr * activityMultiplier * metabolicAdaptation)
  } else {
    // 無體脂率 → 簡化公式
    formulaTDEE = Math.round(input.bodyWeight * (isMale ? 30 : 27))
  }

  // B) Adaptive TDEE（飲食記錄 + 體重變化反推）
  let adaptiveTDEE: number | null = null
  if (input.avgDailyCalories != null) {
    adaptiveTDEE = Math.round(input.avgDailyCalories - (weeklyChange * tdeeDensity / 7))
  } else if (input.currentCalories != null) {
    adaptiveTDEE = Math.round(input.currentCalories - (weeklyChange * tdeeDensity / 7))
  }

  // C) 決定最終 TDEE
  let estimatedTDEE: number | null = null
  const complianceThreshold = 70  // 合規率門檻

  if (input.nutritionCompliance >= complianceThreshold && adaptiveTDEE != null) {
    // 飲食數據可信 → 用 Adaptive TDEE
    // 但做 sanity check：不低於公式值的 80%（避免飲食記錄嚴重低報）
    const minTDEE = Math.round(formulaTDEE * 0.80)
    if (adaptiveTDEE < minTDEE) {
      estimatedTDEE = minTDEE
      warnings.push(`⚠️ 飲食記錄反推 TDEE ${adaptiveTDEE}kcal 明顯偏低（公式估算 ${formulaTDEE}kcal），已修正至 ${minTDEE}kcal。可能是記錄不完整`)
    } else {
      estimatedTDEE = adaptiveTDEE
    }
  } else if (adaptiveTDEE != null) {
    // 有飲食記錄但合規率低 → 不信任 adaptive，用公式值
    estimatedTDEE = formulaTDEE
    warnings.push(`⚠️ 飲食合規率 ${input.nutritionCompliance}% 偏低，TDEE 改用${input.bodyFatPct != null ? 'Katch-McArdle 公式' : '體重公式'}估算（${estimatedTDEE}kcal）。提高記錄完整度可讓系統自動校正`)
  } else {
    // 完全沒有飲食記錄 → 用公式值
    estimatedTDEE = formulaTDEE
    warnings.push(`⚠️ 無飲食記錄，TDEE 以${input.bodyFatPct != null ? 'Katch-McArdle 公式' : '體重公式'}估算（${estimatedTDEE}kcal），建議記錄每日飲食讓系統自動校正`)
  }

  // 7. Deadline-aware 計算（用前面算好的 daysToTarget）
  let deadlineInfo: NutritionSuggestion['deadlineInfo'] = null
  if (input.targetWeight != null && daysToTarget != null) {
    const daysLeft = daysToTarget
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

  // 8. 根據目標類型分流
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
// 邏輯：需要減的重量 × 動態能量密度 ÷ 剩餘天數 = 每日赤字 → TDEE - 赤字 = 目標卡路里
// 文獻：Hall 2008 動態模型取代靜態 7700 kcal/kg
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

  // 1. 計算需要的每日赤字（使用動態能量密度）
  const energyDensity = getEnergyDensity(daysLeft, dietDurationWeeks)
  const totalDeficitNeeded = weightToLose * energyDensity  // kcal total
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

  // 3. 進度超前檢測
  // 如果目前實際掉重速率已經超過需要的速率 → 放鬆赤字
  // 原理：已經掉太快了，不需要那麼大的赤字，把碳水加回來保護肌肉和代謝
  let aheadOfSchedule = false
  let effectiveDailyDeficit = requiredDailyDeficit

  if (weeklyChangeRate < 0) {
    // 實際每週掉重速率（kg）
    const actualWeeklyLoss = Math.abs(weeklyChangeRate / 100) * bw
    // 照目前速率到比賽日可以掉多少
    const projectedLoss = actualWeeklyLoss * (daysLeft / 7)

    if (projectedLoss > weightToLose * 1.15) {
      // 進度超前 15% 以上 → 放鬆赤字
      aheadOfSchedule = true
      // 計算放鬆後的赤字：目標是讓掉重速率回到剛好達標的水平
      // 但至少維持 0.5% BW/wk 的最低速率（Iraki: 最慢 0.5%）以免備賽反彈
      const idealWeeklyLoss = Math.max(requiredWeeklyLoss, bw * 0.005)
      const idealDailyDeficit = (idealWeeklyLoss * energyDensity) / 7
      effectiveDailyDeficit = Math.round(idealDailyDeficit)
      warnings.push(`📈 進度超前！照目前速率可減 ${projectedLoss.toFixed(1)}kg（只需 ${weightToLose.toFixed(1)}kg）。已放鬆赤字，增加碳水保護肌肉`)

      // 進度超前 → 用放鬆後的赤字重算 safetyLevel
      if (effectiveDailyDeficit <= SAFETY.MAX_DEFICIT_KCAL) {
        safetyLevel = 'normal'
      } else if (effectiveDailyDeficit <= GOAL_DRIVEN.MAX_DEFICIT_KCAL) {
        safetyLevel = 'aggressive'
      } else {
        safetyLevel = 'extreme'
      }
    }
  }

  // 計算目標每日卡路里（用放鬆後的赤字）
  let targetCalories = Math.round(estimatedTDEE - effectiveDailyDeficit)

  // 4. 安全底線 + 巨量營養素（先算，因為有氧需要知道真實卡路里底線）
  const absoluteMinCal = isMale ? GOAL_DRIVEN.MIN_CALORIES_MALE : GOAL_DRIVEN.MIN_CALORIES_FEMALE
  const softMinCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE

  // 巨量營養素分配（Helms 2014: 赤字越大 → 蛋白質越高）
  const proteinPerKg = safetyLevel === 'extreme' ? GOAL_DRIVEN.PROTEIN_PER_KG_EXTREME
    : safetyLevel === 'aggressive' ? GOAL_DRIVEN.PROTEIN_PER_KG_AGGRESSIVE
    : GOAL_DRIVEN.PROTEIN_PER_KG_NORMAL
  const minFatPerKg = safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG

  let suggestedPro = Math.round(bw * proteinPerKg)
  let suggestedFat = Math.round(bw * minFatPerKg)

  // 計算蛋白質+脂肪的最低卡路里（碳水底線 30g = 120kcal）
  let proFatCal = suggestedPro * 4 + suggestedFat * 9
  const carbFloorCal = 30 * 4  // 120 kcal

  // 如果蛋白質+脂肪+碳水底線 > targetCalories → 需要砍巨量營養素
  // 優先級：碳水先壓底線 → 降脂肪 → 最後降蛋白質
  if (proFatCal + carbFloorCal > targetCalories) {
    // 先降脂肪到 0.5g/kg
    const absoluteMinFat = Math.round(bw * 0.5)
    suggestedFat = absoluteMinFat
    proFatCal = suggestedPro * 4 + suggestedFat * 9

    if (proFatCal + carbFloorCal > targetCalories) {
      // 再降蛋白質（不低於 2.0g/kg）
      const maxProCal = targetCalories - carbFloorCal - suggestedFat * 9
      const minPro = Math.round(bw * 2.0)
      suggestedPro = Math.max(minPro, Math.round(maxProCal / 4))
      proFatCal = suggestedPro * 4 + suggestedFat * 9

      if (suggestedPro < Math.round(bw * proteinPerKg)) {
        warnings.push(`⚠️ 卡路里極低，蛋白質從 ${Math.round(bw * proteinPerKg)}g 降至 ${suggestedPro}g（${(suggestedPro / bw).toFixed(1)}g/kg）`)
      }
    }
    if (suggestedFat < Math.round(bw * minFatPerKg)) {
      warnings.push(`⚠️ 脂肪從 ${Math.round(bw * minFatPerKg)}g 降至 ${suggestedFat}g（${(suggestedFat / bw).toFixed(1)}g/kg）`)
    }
  }

  // 碳水 = 剩餘卡路里
  let suggestedCarb = Math.max(30, Math.round((targetCalories - proFatCal) / 4))

  // 反算「真實卡路里底線」— 這才是選手實際能吃到的最低值
  let actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)

  // 安全底線保護：如果 macro compression 後仍低於 absoluteMinCal → 把碳水補回來
  // 蛋白質和脂肪已是壓縮後的最低值，多出來的空間全給碳水（碳水是最先被犧牲的）
  if (actualCalories < absoluteMinCal) {
    const prevCalories = actualCalories
    const extraCal = absoluteMinCal - actualCalories
    suggestedCarb += Math.round(extraCal / 4)
    actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)
    warnings.push(`⚠️ 巨量營養素底線 ${prevCalories}kcal 低於安全線 ${absoluteMinCal}kcal，已增加碳水至 ${suggestedCarb}g（${actualCalories}kcal）`)
  }

  // 掉重率安全檢查
  if (weeklyLossPct > GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT) {
    warnings.push(`需要每週掉 ${weeklyLossPct.toFixed(1)}% BW，超過安全上限 ${GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT}%（${(bw * GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT / 100).toFixed(1)}kg/週）`)
  }
  if (actualCalories < softMinCal) {
    warnings.push(`🔥 目標熱量 ${actualCalories}kcal 低於一般安全線 ${softMinCal}kcal，已進入備賽極限模式`)
  }

  // 5. 有氧/步數計算 — 基於 actualCalories（真實飲食底線）
  const kcalPerMinCardio = bw * CARDIO.BASE_KCAL_PER_MIN_PER_KG * CARDIO.PREP_FATIGUE_DISCOUNT
  const kcalPerStep = bw * CARDIO.BASE_KCAL_PER_STEP_PER_KG
  let extraCardioNeeded = false
  let extraBurnPerDay = 0
  let suggestedCardioMinutes = 0
  let suggestedDailySteps = CARDIO.BASELINE_STEPS
  let cardioNote = ''
  let predictedCompWeight: number

  // 用 actualCalories 算真實飲食赤字
  const realDietDeficit = estimatedTDEE - actualCalories
  const shortfall = effectiveDailyDeficit - realDietDeficit  // 飲食不夠的缺口

  if (shortfall > 0) {
    // 飲食面赤字不夠 → 需要有氧補
    const rawExtraBurn = shortfall
    extraBurnPerDay = Math.min(rawExtraBurn, CARDIO.MAX_EXTRA_BURN_PER_DAY)
    extraCardioNeeded = true

    // 換算有氧分鐘數（體重修正 + 疲勞折扣）
    suggestedCardioMinutes = Math.min(
      CARDIO.MAX_CARDIO_MINUTES,
      Math.ceil(extraBurnPerDay / kcalPerMinCardio)
    )
    // 換算步數（有氧以外的部分用步數補）
    const cardioCanBurn = suggestedCardioMinutes * kcalPerMinCardio
    const remainingBurn = Math.max(0, extraBurnPerDay - cardioCanBurn)
    const extraSteps = Math.ceil(remainingBurn / kcalPerStep)
    suggestedDailySteps = Math.min(CARDIO.MAX_DAILY_STEPS, CARDIO.BASELINE_STEPS + extraSteps)

    // 預測體重（飲食 + 有氧）
    const actualExtraSteps = suggestedDailySteps - CARDIO.BASELINE_STEPS
    const totalDailyBurn = realDietDeficit + cardioCanBurn + actualExtraSteps * kcalPerStep
    const totalLoss = (totalDailyBurn * daysLeft) / energyDensity
    predictedCompWeight = Math.round((bw - totalLoss) * 10) / 10

    // 判斷能否達標
    if (predictedCompWeight <= targetWeight + 0.3) {
      cardioNote = `飲食 + 有氧可達標！每日 ${suggestedCardioMinutes} 分鐘中等強度有氧 + ${suggestedDailySteps.toLocaleString()} 步`
    } else {
      cardioNote = `預測 ${predictedCompWeight}kg（目標 ${targetWeight}kg），差 ${(predictedCompWeight - targetWeight).toFixed(1)}kg。建議與教練討論調整量級或目標`
    }

    if (rawExtraBurn > CARDIO.MAX_EXTRA_BURN_PER_DAY) {
      warnings.push(`🏃 理論需額外消耗 ${Math.round(rawExtraBurn)}kcal/天，但實際有氧+步數合理上限約 ${CARDIO.MAX_EXTRA_BURN_PER_DAY}kcal/天`)
    }
    warnings.push(`🏃 建議有氧 ${suggestedCardioMinutes} 分鐘/天 + 步數 ${suggestedDailySteps.toLocaleString()} 步/天（約消耗 ${Math.round(cardioCanBurn + actualExtraSteps * kcalPerStep)}kcal）`)
  } else {
    // 飲食面赤字足夠
    predictedCompWeight = targetWeight

    // 高能量通量策略（High Energy Flux）
    // 即使飲食赤字夠了，也建議基礎活動量 → 多消耗的部分加回碳水
    // 原理：同樣赤字但吃更多 → 保護代謝、維持訓練品質、減少肌肉流失
    if (safetyLevel !== 'normal') {
      suggestedCardioMinutes = safetyLevel === 'extreme' ? 30 : 20
      suggestedDailySteps = safetyLevel === 'extreme' ? 10000 : 8000

      // 計算活動量消耗 → 加回碳水（赤字不變）
      const fluxCardioBurn = suggestedCardioMinutes * kcalPerMinCardio
      const fluxExtraSteps = suggestedDailySteps - CARDIO.BASELINE_STEPS
      const fluxStepsBurn = fluxExtraSteps * kcalPerStep
      const fluxTotalBurn = Math.round(fluxCardioBurn + fluxStepsBurn)

      // 多消耗的全給碳水（碳水是訓練品質的直接燃料）
      const fluxCarbsBonus = Math.round(fluxTotalBurn / 4)
      suggestedCarb += fluxCarbsBonus
      actualCalories += fluxTotalBurn

      cardioNote = `高能量通量：有氧 ${suggestedCardioMinutes} 分鐘 + ${suggestedDailySteps.toLocaleString()} 步（消耗 ~${fluxTotalBurn}kcal）→ 碳水 +${fluxCarbsBonus}g 吃回來，赤字不變`
    }
  }

  // 6. 碳循環分配
  let suggestedCarbsTD: number | null = null
  let suggestedCarbsRD: number | null = null
  if (input.carbsCyclingEnabled) {
    // 碳水 < 50g 時碳循環無意義（差距太小，反而增加執行難度）
    if (suggestedCarb < 50) {
      // 碳水太低，直接統一值，不分訓練/休息日
      suggestedCarbsTD = suggestedCarb
      suggestedCarbsRD = suggestedCarb
      warnings.push('碳水已低於 50g，暫停碳循環（訓練日/休息日統一），優先確保最低碳水攝取')
    } else {
      // 訓練日多碳水(60%)、休息日少碳水(40%)
      const avgDailyCarb = suggestedCarb
      const trainingDays = Math.min(input.trainingDaysPerWeek, 6)
      const ratio = trainingDays > 0 ? CARB_CYCLE_TRAINING_RATIO : 0.5
      suggestedCarbsTD = Math.round(avgDailyCarb * (1 + (ratio - 0.5) * 2))  // 偏高
      suggestedCarbsRD = Math.round(avgDailyCarb * (1 - (ratio - 0.5) * 2))  // 偏低
      if (suggestedCarbsRD < 20) suggestedCarbsRD = 20
    }
  }

  // 7. 構建狀態訊息
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let statusEmoji = '🎯'
  let statusLabel = '目標驅動'
  let message = ''

  if (aheadOfSchedule) {
    statusEmoji = '📈'
    statusLabel = '進度超前'
    // safetyLevel 已在前面用 effectiveDailyDeficit 重算過
    message = `進度超前！赤字已從 ${requiredDailyDeficit} 放鬆至 ${effectiveDailyDeficit}kcal/天。增加碳水保護肌肉與代謝。`
    message += ` 距比賽 ${daysLeft} 天，目標卡路里 ${actualCalories}kcal。穩穩達標。`
  } else if (shortfall > 0) {
    statusEmoji = '⚠️'
    statusLabel = '底線限制'
    message = `以目前 TDEE ${estimatedTDEE}kcal，需要每日赤字 ${effectiveDailyDeficit}kcal 才能達到 ${targetWeight}kg。`
    message += `飲食底線 ${actualCalories}kcal（赤字缺口 ${Math.round(shortfall)}kcal 需靠活動補）`
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
    warnings.push('掉重速率超過 1.2%/週（Garthe 2011: >1% 增加 LBM 流失風險），建議增加蛋白質攝取量或微增碳水')
  }

  // Diet break 建議
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS
  if (dietBreakSuggested && daysLeft > 21) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週。距比賽還有 ${daysLeft} 天，建議安排 3-5 天 refeed 恢復代謝`)
  }

  // 更新 deadlineInfo 加入 goal-driven + 有氧資訊
  const enrichedDeadlineInfo = {
    ...deadlineInfo,
    requiredDailyDeficit: effectiveDailyDeficit,
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
