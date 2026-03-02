/**
 * 營養素自動分析引擎 v3
 * 基於 2025-2026 最新運動科學文獻：
 * - ISSN Position Stand: 減脂速率 0.5-1.0% BW/week
 * - Physique Athletes Review: 蛋白質 ≥ 2.0g/kg 男性, 1.6-2.0g/kg 女性 (減脂)
 * - Morton et al. 2018 (BJSM): 蛋白質需求無顯著性別差異，但絕對需求量較低
 * - Stokes et al. 2018: 女性對低劑量蛋白質反應同等有效
 * - Loucks 2004 / Mountjoy et al. 2018 RED-S: 女性脂肪最低需求更高 (1.0g/kg)
 * - Off-Season Bodybuilding: 增肌速率 0.25-0.5% BW/week, surplus +200-300kcal
 * - Caloric Restriction Meta-Analysis: 最大赤字 ≤ 500kcal/day
 *
 * 活動量分型 (Activity Profile)：
 * - sedentary（上班族）: 以飲食控制為主，步數受限，有氧時間少
 * - high_energy_flux（高能量通量）: 主動增加活動消耗，同樣赤字下吃更多，保護代謝
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

  // 活動量分型（影響 TDEE 估算與有氧/步數建議）
  // sedentary = 上班族，步數受限，有氧時間少
  // high_energy_flux = 高能量通量，主動增加活動消耗
  activityProfile?: 'sedentary' | 'high_energy_flux'

  // 近 30 天狀態監控（近 3 天 = 當前狀態, 第 4-30 天 = 個人基線）
  recentWellness?: {
    date: string
    energy_level: number | null
    training_drive: number | null
    // 穿戴裝置生理指標（Apple Watch / Garmin / Whoop）
    device_recovery_score?: number | null  // 裝置恢復分數 0-100（WHOOP Recovery / Oura Readiness / Garmin Body Battery）
    resting_hr?: number | null       // 靜息心率 bpm
    hrv?: number | null              // 心率變異度 ms
    wearable_sleep_score?: number | null  // 睡眠分數 0-100
    respiratory_rate?: number | null // 呼吸速率 次/分
  }[]
  recentTrainingLogs?: { date: string; rpe: number | null }[]
  recentCarbsPerDay?: { date: string; carbs: number | null }[]

  // 月經週期（女性專用，用於排除黃體期體重浮動）
  lastPeriodDate?: string | null  // 最近一次經期開始日 (ISO)
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

  // 當前狀態監控
  currentState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
  readinessScore: number | null       // 0-100，穿戴裝置恢復分數
  wearableInsight: string | null      // 根據恢復狀態的即時回饋文字
  refeedSuggested: boolean
  refeedReason: string | null
  refeedDays: number | null

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

  // 月經週期判斷（女性專用）
  menstrualCycleNote: string | null  // 黃體期提示訊息（null = 不在黃體期或非女性）

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
  // 男性蛋白質下限（Helms 2014: 2.3-3.1g/kg LBM → 體重近似取下限）
  MIN_PROTEIN_PER_KG_CUT: 2.3,
  MIN_PROTEIN_PER_KG_BULK: 1.8,
  // 女性蛋白質下限（Stokes 2018 / Morton 2018 meta: 1.6-2.0g/kg 即達最大合成效果）
  MIN_PROTEIN_PER_KG_CUT_FEMALE: 1.8,
  MIN_PROTEIN_PER_KG_BULK_FEMALE: 1.6,
  // 脂肪下限：男性荷爾蒙需求較低，女性 (雌激素合成) 需更高
  MIN_FAT_PER_KG: 0.8,           // 男性 (15-20% calories)
  MIN_FAT_PER_KG_FEMALE: 1.0,    // 女性 (Loucks 2004 / RED-S: ≥20-25% calories)
  MAX_FAT_PER_KG_BULK: 1.2,
  MAX_DEFICIT_KCAL: 500,          // Meta-analysis: ≤500kcal/day deficit
  DIET_BREAK_WEEKS: 8,            // Suggest diet break after 8 weeks continuous
}

// Goal-Driven 模式的放寬限制（用於備賽選手，允許更激進的赤字）
const GOAL_DRIVEN = {
  MIN_CALORIES_MALE: 1200,        // 備賽極限：1200kcal（短期可承受）
  MIN_CALORIES_FEMALE: 1050,      // 女性備賽極限：1050kcal（低於此荷爾蒙風險極高）
  MAX_DEFICIT_KCAL: 750,          // 允許最大赤字到 750kcal（備賽期）
  EXTREME_DEFICIT_KCAL: 1000,     // 極端赤字（最後 3 週，自動警告）
  // ── 男性蛋白質依赤字深度分級 (Helms 2014: 赤字越大 → 蛋白質越高) ──
  PROTEIN_PER_KG_NORMAL: 2.3,    // normal 赤字：2.3g/kg
  PROTEIN_PER_KG_AGGRESSIVE: 2.6, // aggressive：2.6g/kg
  PROTEIN_PER_KG_EXTREME: 3.0,   // extreme：3.0g/kg（接近 LBM 的 3.1g/kg 上限）
  // ── 女性蛋白質分級 (Stokes 2018: 女性 1.6-2.2g/kg 達最大效果，備賽上調) ──
  PROTEIN_PER_KG_NORMAL_FEMALE: 1.8,
  PROTEIN_PER_KG_AGGRESSIVE_FEMALE: 2.0,
  PROTEIN_PER_KG_EXTREME_FEMALE: 2.3,
  // ── 脂肪下限：男性 0.7g/kg，女性備賽最低 0.9g/kg（荷爾蒙保護）──
  MIN_FAT_PER_KG: 0.7,           // 男性備賽最低 0.7g/kg
  MIN_FAT_PER_KG_FEMALE: 0.9,    // 女性備賽最低 0.9g/kg（低於此月經功能風險增加）
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

// 有氧消耗估算常數（不隨 activityProfile 變化的基礎值）
const CARDIO = {
  // 中等強度有氧的基礎消耗（kcal/min/kg），體重修正用
  // ACSM: 中等強度（快走 5-6km/h）≈ 3.5-7 METs
  // 備賽後期代謝適應折扣 15-25%（Trexler 2014: adaptive thermogenesis）
  BASE_KCAL_PER_MIN_PER_KG: 0.075, // ~6 kcal/min for 80kg（保守，已含適應折扣）
  PREP_FATIGUE_DISCOUNT: 0.80,     // 備賽後期效率折扣（代謝適應 + 疲勞）
  // 每步消耗（體重修正）
  BASE_KCAL_PER_STEP_PER_KG: 0.0005, // 80kg × 0.0005 = 0.04 kcal/step
  // 每日額外活動消耗的合理上限（kcal）
  MAX_EXTRA_BURN_PER_DAY: 500,     // 有氧+步數合計上限
}

// 依活動量分型取有氧/步數參數
// sedentary（上班族）：時間受限，現實步數目標低
// high_energy_flux（高能量通量）：主動提高活動消耗，可達較高步數 / 有氧時間
// 預設（moderate）：適合一般健身愛好者
function getCardioProfile(activityProfile?: string) {
  if (activityProfile === 'sedentary') {
    return {
      BASELINE_STEPS: 3000,      // 上班族基礎步數（久坐辦公）
      MAX_DAILY_STEPS: 8000,     // 現實上限（通勤+午休散步）
      MAX_CARDIO_MINUTES: 30,    // 時間有限
    }
  } else if (activityProfile === 'high_energy_flux') {
    return {
      BASELINE_STEPS: 8000,      // 本身已高活動
      MAX_DAILY_STEPS: 15000,    // 積極步數目標
      MAX_CARDIO_MINUTES: 60,    // 可支撐較長有氧
    }
  } else {
    // moderate（預設）
    return {
      BASELINE_STEPS: 5000,
      MAX_DAILY_STEPS: 12000,
      MAX_CARDIO_MINUTES: 45,
    }
  }
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
  WATER_BASELINE: 90,     // Day 7-4：90 mL/kg
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

// ===== 活動量分型輔助函式 =====

// Katch-McArdle 活動係數
// sedentary：主要靠飲食控制，有氧量少 → 低係數
// high_energy_flux：刻意提高 NEAT + 有氧 → 高係數
function getActivityMultiplier(activityProfile: string | undefined, trainingDaysPerWeek: number): number {
  if (activityProfile === 'sedentary') {
    return trainingDaysPerWeek >= 4 ? 1.35 : 1.25
  } else if (activityProfile === 'high_energy_flux') {
    return trainingDaysPerWeek >= 4 ? 1.55 : 1.45
  } else {
    // moderate（預設）
    return trainingDaysPerWeek >= 4 ? 1.45 : 1.35
  }
}

// 無體脂率時的 fallback TDEE 係數（kcal/kg）
// 來源：Harris-Benedict / Mifflin-St Jeor 修正，依性別和活動量調整
function getFallbackTDEEMultiplier(activityProfile: string | undefined, isMale: boolean): number {
  if (activityProfile === 'sedentary') {
    return isMale ? 26 : 24   // 上班族：低 NEAT，少量有氧
  } else if (activityProfile === 'high_energy_flux') {
    return isMale ? 35 : 31   // 高能量通量：高 NEAT + 有氧
  } else {
    return isMale ? 30 : 27   // 預設（中等活動量）
  }
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
    currentState: 'unknown', readinessScore: null, wearableInsight: null,
    refeedSuggested: false, refeedReason: null, refeedDays: null,
    deadlineInfo: null, autoApply: false, peakWeekPlan: null,
    menstrualCycleNote: null,
    ...overrides,
  }
}

// ===== 月經週期判斷 =====
// 文獻：
// - Stachenfeld 2008: 黃體期（排卵後 ~day 14-28）孕酮↑ → 體液滯留 1-2kg
// - Davidsen et al. 2007: 月經週期造成的體重波動 0.5-2.5kg，不代表脂肪增加
// - 實務：排除黃體期的假性「方向錯誤」，避免不必要的減卡

interface MenstrualCycleInfo {
  inLutealPhase: boolean    // 是否在黃體期（day 14-28）
  daysSincePeriod: number   // 距上次經期天數
  note: string | null       // 給前端的提示文字
}

function checkMenstrualCycle(input: NutritionInput): MenstrualCycleInfo {
  const isFemale = input.gender === '女性'
  if (!isFemale || !input.lastPeriodDate) {
    return { inLutealPhase: false, daysSincePeriod: -1, note: null }
  }

  const now = new Date()
  const periodDate = new Date(input.lastPeriodDate)
  const daysSince = Math.floor((now.getTime() - periodDate.getTime()) / (1000 * 60 * 60 * 24))

  // 標準週期 ~28 天：卵泡期 day 1-14, 黃體期 day 15-28
  // 黃體期孕酮升高 → 水分滯留 → 體重假性上升
  const inLutealPhase = daysSince >= 14 && daysSince <= 30

  let note: string | null = null
  if (inLutealPhase) {
    note = `🩸 目前處於黃體期（經期後第 ${daysSince} 天），體重可能因荷爾蒙導致 0.5-2kg 的水分滯留，屬於正常波動，不代表脂肪增加。`
  } else if (daysSince >= 0 && daysSince <= 5) {
    note = `🩸 經期中（第 ${daysSince + 1} 天），體重可能略有波動，持續記錄即可。`
  }

  return { inLutealPhase, daysSincePeriod: daysSince, note }
}

// ===== 當前狀態評估（Readiness Score v2）=====
//
// 核心改動：高 RPE 是備賽/增肌訓練的正常現象（接近力竭 = 有效刺激）
// 不應因為 RPE 8-9 就判定為 struggling，而是以客觀生理指標判斷真正的疲勞
//
// 文獻依據：
// 1. HRV (RMSSD) — 最強證據的非侵入式恢復指標
//    - Plews et al. 2013: HRV-guided training 避免過度訓練
//    - Buchheit 2014: 強調 RMSSD 趨勢分析（週均值 + CV）
//    - PMC 2024 Narrative Review (J Funct Morphol Kinesiol): RMSSD 是力量訓練中最穩定的 HRV 指標
//    - Sensors 2025 Review: 7 天滾動 RMSSD 均值 + CV 為最佳實踐
//    - 注意：文獻強調個人基線比絕對值重要（SWC = mean ± 0.5×SD）
//      但因目前僅有 3 天數據，使用族群級別範圍作為初步評估
//
// 2. RHR (靜息心率) — 升高表示疲勞/過度訓練
//    - Nature 2025 (Scientific Reports): vmHRV + RHR + WB 多指標指導訓練
//    - PMC 2024: Nocturnal HR 對過度訓練的 PPV ≥ 85%
//
// 3. 睡眠分數 — 恢復基礎
//    - JCM 2025 Multidimensional Review: 睡眠不足 → cortisol 升高、testosterone/GH 降低
//    - Current Sports Medicine Reports 2025: 穿戴裝置睡眠分數具方向性參考價值
//      但各品牌演算法不透明，臨床精確度有限
//
// 4. 呼吸速率 — 輔助指標（證據力最弱）
//    - Nicolò et al. 2020: 呼吸速率對強度變化的反應比心率更快
//    - 穿戴裝置多從 HRV 間接推導，非獨立測量
//    - 升高的夜間呼吸速率可提示疾病、壓力或過度訓練
//
// 權重分配（基於證據強度）：
//   HRV 35% > 睡眠 30% > RHR 25% > 呼吸速率 10%

type WellnessWithWearable = {
  date: string
  energy_level: number | null
  training_drive: number | null
  device_recovery_score?: number | null
  resting_hr?: number | null
  hrv?: number | null
  wearable_sleep_score?: number | null
  respiratory_rate?: number | null
}

function assessCurrentState(
  recentWellness: WellnessWithWearable[],
  recentTrainingLogs: { date: string; rpe: number | null }[]
): { state: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'; readinessScore: number | null } {
  // 排序：最新在前
  const sorted = [...recentWellness].sort((a, b) => b.date.localeCompare(a.date))

  // 近 3 天 = 當前狀態
  const last3Wellness = sorted
    .slice(0, 3)
    .filter(w => w.energy_level != null || w.training_drive != null ||
      w.device_recovery_score != null || w.resting_hr != null || w.hrv != null || w.wearable_sleep_score != null)

  // 第 4-30 天 = 個人基線（用於計算 SWC）
  const baselineWellness = sorted.slice(3)

  const last3Training = [...recentTrainingLogs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .filter(t => t.rpe != null)

  if (last3Wellness.length === 0 && last3Training.length === 0) return { state: 'unknown', readinessScore: null }

  // ── 主觀指標 ──
  const avgEnergy = last3Wellness.length > 0
    ? last3Wellness.reduce((s, w) => s + (w.energy_level ?? 3), 0) / last3Wellness.length
    : null

  const avgDrive = last3Wellness.length > 0
    ? last3Wellness.reduce((s, w) => s + (w.training_drive ?? 3), 0) / last3Wellness.length
    : null

  // ── 穿戴裝置客觀指標 → Readiness Score ──
  // 路徑 1: device_recovery_score（使用者只填 1 個數字，裝置已做個人比較）
  // 路徑 2: 個別指標 + 個人基線 SWC 比較
  // 路徑 3: 個別指標 + 族群範圍（基線不足時的 fallback）

  const recoveryScores = last3Wellness
    .filter(w => w.device_recovery_score != null)
    .map(w => w.device_recovery_score!)

  let readinessScore: number | null = null

  if (recoveryScores.length >= 1) {
    // 路徑 1: 裝置恢復分數直接使用
    readinessScore = recoveryScores.reduce((s, v) => s + v, 0) / recoveryScores.length
  }

  if (readinessScore == null) {
    // 路徑 2 或 3: 從個別指標計算
    const currentEntries = last3Wellness.filter(w =>
      w.resting_hr != null || w.hrv != null || w.wearable_sleep_score != null
    )

    if (currentEntries.length >= 2) {
      const scores: { value: number; weight: number }[] = []

      // 工具函數：計算基線 mean + SD
      const calcBaseline = (vals: number[]) => {
        if (vals.length < 5) return null // 基線至少需要 5 天數據
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
        return { mean, sd, swc: 0.5 * sd }
      }

      // 工具函數：基於個人基線的偏移量 → 0-100 分
      // zScore = (current - baseline.mean) / baseline.sd
      // 正向指標（HRV、睡眠）：z=0 → 50 分, z≥+2 → 100, z≤-2 → 0
      // 反向指標（RHR、呼吸）：z=0 → 50 分, z≤-2 → 100, z≥+2 → 0
      const zToScore = (z: number) => Math.min(100, Math.max(0, 50 + z * 25))

      // ── HRV ── 權重 35%（正向：越高越好）
      // Sensors 2025: RMSSD 7 天滾動均值 + CV，偏離個人基線 >SWC 有臨床意義
      const currentHRV = currentEntries.filter(w => w.hrv != null).map(w => w.hrv!)
      if (currentHRV.length > 0) {
        const avgHRV = currentHRV.reduce((s, v) => s + v, 0) / currentHRV.length
        const baselineHRV = calcBaseline(
          baselineWellness.filter(w => w.hrv != null).map(w => w.hrv!)
        )

        if (baselineHRV && baselineHRV.sd > 0) {
          // 路徑 2: 個人基線比較
          const z = (avgHRV - baselineHRV.mean) / baselineHRV.sd
          scores.push({ value: zToScore(z), weight: 35 })
        } else {
          // 路徑 3 fallback: 族群範圍 (20-100ms)
          scores.push({
            value: Math.min(100, Math.max(0, (avgHRV - 20) * (100 / 80))),
            weight: 35
          })
        }
      }

      // ── RHR ── 權重 25%（反向：越低越好）
      // PMC 2024: Nocturnal HR 升高 >5bpm 持續 2+ 天 = overreaching 信號
      const currentRHR = currentEntries.filter(w => w.resting_hr != null).map(w => w.resting_hr!)
      if (currentRHR.length > 0) {
        const avgRHR = currentRHR.reduce((s, v) => s + v, 0) / currentRHR.length
        const baselineRHR = calcBaseline(
          baselineWellness.filter(w => w.resting_hr != null).map(w => w.resting_hr!)
        )

        if (baselineRHR && baselineRHR.sd > 0) {
          // 路徑 2: RHR 升高 = 差，取反
          const z = -(avgRHR - baselineRHR.mean) / baselineRHR.sd
          scores.push({ value: zToScore(z), weight: 25 })
        } else {
          // 路徑 3 fallback: 族群範圍 (50-90bpm, 反向)
          scores.push({
            value: Math.min(100, Math.max(0, (90 - avgRHR) * (100 / 40))),
            weight: 25
          })
        }
      }

      // ── 睡眠分數 ── 權重 30%（正向：越高越好）
      // 已經是 0-100，可直接用；有基線時用 z-score 更精準
      const currentSleep = currentEntries.filter(w => w.wearable_sleep_score != null).map(w => w.wearable_sleep_score!)
      if (currentSleep.length > 0) {
        const avgSleep = currentSleep.reduce((s, v) => s + v, 0) / currentSleep.length
        const baselineSleep = calcBaseline(
          baselineWellness.filter(w => w.wearable_sleep_score != null).map(w => w.wearable_sleep_score!)
        )

        if (baselineSleep && baselineSleep.sd > 0) {
          // 路徑 2: 相對於個人睡眠品質水平
          const z = (avgSleep - baselineSleep.mean) / baselineSleep.sd
          scores.push({ value: zToScore(z), weight: 30 })
        } else {
          // 路徑 3 fallback: 直接用 0-100
          scores.push({ value: avgSleep, weight: 30 })
        }
      }

      // ── 呼吸速率 ── 權重 10%（反向：越低越好）
      const currentRR = currentEntries.filter(w => w.respiratory_rate != null).map(w => w.respiratory_rate!)
      if (currentRR.length > 0) {
        const avgRR = currentRR.reduce((s, v) => s + v, 0) / currentRR.length
        const baselineRR = calcBaseline(
          baselineWellness.filter(w => w.respiratory_rate != null).map(w => w.respiratory_rate!)
        )

        if (baselineRR && baselineRR.sd > 0) {
          const z = -(avgRR - baselineRR.mean) / baselineRR.sd
          scores.push({ value: zToScore(z), weight: 10 })
        } else {
          // 路徑 3 fallback: 族群範圍 (12-24 次/分, 反向)
          scores.push({
            value: Math.min(100, Math.max(0, (24 - avgRR) * (100 / 12))),
            weight: 10
          })
        }
      }

      if (scores.length > 0) {
        const totalWeight = scores.reduce((s, sc) => s + sc.weight, 0)
        readinessScore = scores.reduce((s, sc) => s + sc.value * sc.weight, 0) / totalWeight
      }
    }
  }

  // ── 判定邏輯 ──
  // 有穿戴裝置 → 以 Readiness Score 為主（客觀優先）
  // 無穿戴裝置 → 使用主觀 energy + drive（不再單獨依賴 RPE）
  //
  // 關鍵原則（Nature 2025 Scientific Reports）：
  //   主觀 + 客觀整合效果 > 任一單獨使用
  //   RPE 高 + Readiness 好 = 有效訓練（不觸發 Refeed）
  //   RPE 高 + Readiness 差 = 真正過度疲勞（觸發 Refeed）

  if (readinessScore != null) {
    const rs = Math.round(readinessScore)
    if (readinessScore < 25) {
      return { state: 'critical', readinessScore: rs }
    }
    if (readinessScore < 40) {
      if (avgEnergy != null && avgEnergy <= 2) return { state: 'critical', readinessScore: rs }
      return { state: 'struggling', readinessScore: rs }
    }
    if (readinessScore < 55) {
      if (avgEnergy != null && avgEnergy <= 2 && avgDrive != null && avgDrive <= 2) return { state: 'struggling', readinessScore: rs }
      return { state: 'good', readinessScore: rs }
    }
    if (readinessScore >= 70) {
      return { state: 'optimal', readinessScore: rs }
    }
    return { state: 'good', readinessScore: rs }
  }

  // ── 無穿戴裝置：改良的主觀判定 ──
  // 核心修正：RPE 高≠疲勞（接近力竭是肌肥大訓練的目標）
  // 只用 energy_level + training_drive 作為主觀疲勞信號

  if (avgEnergy != null && avgEnergy <= 1.5 && last3Wellness.length >= 2) {
    return { state: 'critical', readinessScore: null }
  }
  if (avgEnergy != null && avgEnergy <= 2 && avgDrive != null && avgDrive <= 2) {
    return { state: 'struggling', readinessScore: null }
  }
  if (avgEnergy != null && avgEnergy >= 4 && (avgDrive == null || avgDrive >= 3)) {
    return { state: 'optimal', readinessScore: null }
  }

  return { state: 'good', readinessScore: null }
}

// ===== 低碳連續天數 =====
// 從最近一天往前數，連續幾天碳水 < threshold（預設 150g）

function countConsecutiveLowCarbDays(
  recentCarbsPerDay: { date: string; carbs: number | null }[],
  threshold = 150
): number {
  const sorted = [...recentCarbsPerDay].sort((a, b) => b.date.localeCompare(a.date))
  let count = 0
  for (const day of sorted) {
    if (day.carbs == null) continue  // 沒記錄的日子跳過
    if (day.carbs < threshold) {
      count++
    } else {
      break  // 遇到非低碳日停止
    }
  }
  return count
}

// ===== Refeed 觸發判斷 =====
// 條件 A：currentState = struggling 或 critical
// 條件 B：連續低碳 ≥ 3 天
// A + B 同時成立 → 觸發 Refeed 建議

function checkRefeedTrigger(
  currentState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown',
  lowCarbDays: number
): { suggested: boolean; reason: string | null; days: number | null } {
  if (currentState === 'unknown' || currentState === 'optimal' || currentState === 'good') {
    return { suggested: false, reason: null, days: null }
  }

  const reasons: string[] = []

  if (currentState === 'critical') {
    reasons.push('生理狀態已達臨界（恢復指標低落或能量極低）')
  } else if (currentState === 'struggling') {
    reasons.push('恢復不足（生理指標下滑且主觀能量低落）')
  }

  if (lowCarbDays >= 5) {
    reasons.push(`已連續 ${lowCarbDays} 天碳水 < 150g`)
  } else if (lowCarbDays >= 3) {
    reasons.push(`已連續 ${lowCarbDays} 天碳水 < 150g`)
  } else {
    // 狀態差但低碳天數不足，僅警告不強制 Refeed
    return { suggested: false, reason: reasons.join('、'), days: null }
  }

  const days = (currentState === 'critical' || lowCarbDays >= 5) ? 2 : 1

  return { suggested: true, reason: reasons.join('、'), days }
}

// ===== 穿戴裝置恢復回饋 =====
// 根據 currentState + readinessScore 產生使用者可見的即時回饋文字
// 確保「恢復好」時也有正向回饋，而非只在差的時候才提醒

function generateWearableInsight(
  state: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown',
  readinessScore: number | null
): string | null {
  if (state === 'unknown') return null

  const scoreText = readinessScore != null ? `（恢復分數 ${readinessScore}）` : ''

  switch (state) {
    case 'optimal':
      return `恢復狀態極佳${scoreText}。身體適應良好，系統已根據恢復狀態微調營養分配，可放心維持訓練強度。`
    case 'good':
      return `恢復狀態正常${scoreText}。營養計畫按原定方案執行，繼續保持！`
    case 'struggling':
      return `恢復狀態偏低${scoreText}。系統已自動增加碳水攝取支持恢復，建議同時改善睡眠與壓力管理。`
    case 'critical':
      return `恢復狀態不佳${scoreText}。系統已自動增加碳水並縮小赤字，優先保護恢復能力。請檢視睡眠、訓練量和壓力。`
    default:
      return null
  }
}

// ===== 主要引擎 =====

export function generateNutritionSuggestion(input: NutritionInput): NutritionSuggestion {
  const warnings: string[] = []

  // 狀態監控：在所有分支前先計算，後面 spread 進每個 return
  const stateResult = assessCurrentState(
    input.recentWellness ?? [],
    input.recentTrainingLogs ?? []
  )
  const currentState = stateResult.state
  const readinessScore = stateResult.readinessScore
  const lowCarbDays = countConsecutiveLowCarbDays(input.recentCarbsPerDay ?? [])
  const refeedTrigger = checkRefeedTrigger(currentState, lowCarbDays)

  // 根據穿戴裝置恢復狀態生成即時回饋
  const wearableInsight = generateWearableInsight(currentState, readinessScore)

  const stateFields = {
    currentState,
    readinessScore,
    wearableInsight,
    refeedSuggested: refeedTrigger.suggested,
    refeedReason: refeedTrigger.reason,
    refeedDays: refeedTrigger.days,
  }

  // 月經週期判斷（女性專用）
  const cycleInfo = checkMenstrualCycle(input)

  // Refeed 警告加入 warnings（讓前端顯示）
  if (refeedTrigger.suggested && refeedTrigger.reason) {
    warnings.push(`🔄 系統偵測：可考慮安排 ${refeedTrigger.days} 天 Refeed：${refeedTrigger.reason}`)
  } else if (refeedTrigger.reason && !refeedTrigger.suggested) {
    // 狀態差但低碳天數不足（不強制 Refeed，僅提醒）
    warnings.push(`⚠️ 注意狀態：${refeedTrigger.reason}（低碳天數未達 3 天，持續觀察）`)
  }

  // 0. Peak Week 偵測：距比賽 ≤ 7 天且 prepPhase 是 peak_week
  if (input.targetDate && input.prepPhase === 'peak_week') {
    const now = new Date()
    const target = new Date(input.targetDate)
    const daysLeft = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    if (daysLeft <= 8) {
      return { ...generatePeakWeekPlan(input, daysLeft), ...stateFields }
    }
  }

  // 1. 檢查數據是否足夠
  if (input.weeklyWeights.length < 2) {
    return emptyResult({
      status: 'insufficient_data', statusLabel: '數據不足', statusEmoji: '📊',
      message: '需要至少 2 週的體重數據才能開始分析。請讓學員持續記錄體重。',
      ...stateFields,
    })
  }

  // 2. 合規率低時加入警告，但不阻擋引擎運作（體重是最真實的指標）
  if (input.nutritionCompliance < 70) {
    warnings.push(`飲食合規率 ${input.nutritionCompliance}%，提高記錄完整度可提升分析準確性`)
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
    // 活動係數依 activityProfile 決定（sedentary 低、high_energy_flux 高）
    // 備賽中後期代謝適應約 -10%（Trexler 2014: adaptive thermogenesis）
    const activityMultiplier = getActivityMultiplier(input.activityProfile, input.trainingDaysPerWeek)
    const metabolicAdaptation = dietDurationWeeks != null && dietDurationWeeks >= 8 ? 0.90 : 0.95
    formulaTDEE = Math.round(bmr * activityMultiplier * metabolicAdaptation)
  } else {
    // 無體脂率 → 依性別 + 活動量分型的簡化公式
    formulaTDEE = Math.round(input.bodyWeight * getFallbackTDEEMultiplier(input.activityProfile, isMale))
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
    warnings.push(`⚠️ 無飲食記錄，TDEE 以${input.bodyFatPct != null ? 'Katch-McArdle 公式' : '體重公式'}估算（${estimatedTDEE}kcal），記錄每日飲食可讓系統自動校正`)
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
    return { ...generateCutSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings, cycleInfo, currentState), ...stateFields }
  } else {
    return { ...generateBulkSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings, cycleInfo, currentState), ...stateFields }
  }
}

// ===== 減脂引擎 =====

function generateCutSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  deadlineInfo: NutritionSuggestion['deadlineInfo'],
  warnings: string[],
  cycleInfo: MenstrualCycleInfo,
  recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
): NutritionSuggestion {
  const bw = input.bodyWeight
  const isMale = input.gender === '男性'

  // ===== Goal-Driven Mode =====
  // 條件：有目標體重 + 目標日期 + 有 TDEE 估算 → 直接反算每日卡路里
  if (deadlineInfo && estimatedTDEE && input.targetWeight != null && deadlineInfo.weightToLose > 0) {
    return generateGoalDrivenCut(input, estimatedTDEE, deadlineInfo, weeklyChangeRate, dietDurationWeeks, warnings, cycleInfo, recoveryState)
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

  // ===== 體重進度 × 恢復狀態 整合判斷 =====
  // 核心原則：
  //   體重趨勢決定「方向」（加熱量或減熱量）
  //   恢復狀態決定「力道」（調多少）
  //   恢復好 → 身體撐得住，可以更積極
  //   恢復差 → 保護優先，減少壓力源（碳水是最直接的恢復燃料）
  const hasRecoveryData = recoveryState !== 'unknown'
  const recoveryGood = recoveryState === 'optimal' || recoveryState === 'good'
  const recoveryBad = recoveryState === 'struggling' || recoveryState === 'critical'

  // 判斷進度
  if (weeklyChangeRate <= CUT_TARGETS.MIN_RATE) {
    // 黃體期 too_fast 也要緩衝：可能是卵泡期水分釋放造成的假性快速下降
    if (cycleInfo.inLutealPhase) {
      status = 'on_track'
      statusLabel = '週期波動'
      statusEmoji = '🟡'
      message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，但目前處於黃體期，體重波動較大，持續觀察一週再判斷。`
    } else {
      status = 'too_fast'
      statusLabel = '掉太快'
      statusEmoji = '🔴'
      // 恢復差 + 掉太快 → 加更多碳水保護（身體雙重壓力）
      // 恢復好 + 掉太快 → 標準補回
      if (recoveryState === 'critical') {
        calDelta = 250; carbDelta = 35; fatDelta = 0
        message = `體重掉太快（${weeklyChangeRate.toFixed(2)}%/週）且恢復狀態不佳。系統已加大熱量補回幅度（+250kcal），優先碳水保護恢復與肌肉。`
      } else if (recoveryState === 'struggling') {
        calDelta = 200; carbDelta = 28; fatDelta = 0
        message = `體重掉太快（${weeklyChangeRate.toFixed(2)}%/週）且恢復偏低。系統已增加碳水補回（+200kcal），兼顧恢復與肌肉保護。`
      } else {
        calDelta = 150; carbDelta = 20; fatDelta = 0
        message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，超過安全範圍（-1.0%）。系統偵測：可考慮增加熱量以保護肌肉量。`
      }
    }
  } else if (weeklyChangeRate > 0) {
    // 體重增加 → 方向錯誤
    if (cycleInfo.inLutealPhase && weeklyChangeRate <= 2.0) {
      status = 'on_track'
      statusLabel = '週期波動'
      statusEmoji = '🟡'
      message = `體重微幅上升（+${weeklyChangeRate.toFixed(2)}%/週），但目前處於黃體期，屬荷爾蒙導致的正常水分滯留（約 0.5-2kg），維持目前計畫即可。`
    } else {
      status = 'wrong_direction'
      statusLabel = '方向錯誤'
      statusEmoji = '🔴'
      // 恢復差 + 方向錯誤 → 減少減幅或不減卡（壓力已經很大，再砍熱量會更差）
      // 恢復好 + 方向錯誤 → 正常減卡
      if (recoveryState === 'critical') {
        calDelta = 0; carbDelta = 0; fatDelta = 0
        message = `體重反而增加（+${weeklyChangeRate.toFixed(2)}%/週），但恢復狀態極差。系統暫不減卡，優先恢復身體狀態，避免雪上加霜。`
        warnings.push('⚠️ 體重方向錯誤但恢復狀態不佳，暫緩減卡。建議先改善睡眠、壓力管理，待恢復好轉再調整熱量。')
      } else if (recoveryState === 'struggling') {
        calDelta = -125; carbDelta = -15; fatDelta = -3
        message = `體重反而增加（+${weeklyChangeRate.toFixed(2)}%/週），但恢復偏低。系統僅微降熱量（-125kcal），避免過度壓迫恢復。`
      } else {
        calDelta = -225; carbDelta = -27; fatDelta = -7
        message = `體重反而增加（+${weeklyChangeRate.toFixed(2)}%/週）。需要降低熱量攝取。`
      }
    }
  } else if (weeklyChangeRate >= CUT_TARGETS.MAX_RATE) {
    // 體重下降不夠快（-0.3% ~ 0%），檢查是否停滯
    if (input.weeklyWeights.length >= 2) {
      const lastWeek = input.weeklyWeights[1].avgWeight
      const lastWeekChange = ((input.weeklyWeights[0].avgWeight - lastWeek) / lastWeek) * 100
      if (lastWeekChange >= CUT_TARGETS.MAX_RATE) {
        // 體重卡關
        // 恢復好 + 卡關 → 身體撐得住，可以更積極減卡
        // 恢復差 + 卡關 → 身體已經很累，不應再減卡，改 Refeed 策略
        if (recoveryState === 'critical') {
          status = 'plateau'
          statusLabel = '停滯期'
          statusEmoji = '🟡'
          calDelta = 75; carbDelta = 19; fatDelta = 0
          message = `體重停滯（${weeklyChangeRate.toFixed(2)}%/週），但恢復狀態極差。系統反向操作：先增加碳水 Refeed（+75kcal），讓身體恢復後再突破停滯。`
          warnings.push('💡 停滯 + 恢復不足 = 代謝壓力過大。短期增加碳水有助恢復代謝率，比繼續減卡更有效突破停滯。')
        } else if (recoveryState === 'struggling') {
          status = 'plateau'
          statusLabel = '停滯期'
          statusEmoji = '🟡'
          calDelta = 0; carbDelta = 0; fatDelta = 0
          message = `體重停滯（${weeklyChangeRate.toFixed(2)}%/週），恢復偏低。系統暫維持熱量不動，優先觀察恢復趨勢。`
          warnings.push('💡 停滯 + 恢復偏低：目前不宜再減卡。建議改善睡眠品質，若恢復改善後體重仍停滯再微降熱量。')
        } else if (recoveryState === 'optimal') {
          status = 'plateau'
          statusLabel = '停滯期'
          statusEmoji = '🟡'
          calDelta = -225; carbDelta = -28; fatDelta = -7
          message = `體重停滯（${weeklyChangeRate.toFixed(2)}%/週），但恢復狀態極佳！身體撐得住，系統已加大減幅（-225kcal）突破停滯。`
        } else {
          status = 'plateau'
          statusLabel = '停滯期'
          statusEmoji = '🟡'
          calDelta = -175; carbDelta = -22; fatDelta = -5
          message = `體重近 10-14 天幾乎無變化（${weeklyChangeRate.toFixed(2)}%/週）。系統偵測：可考慮微降熱量突破停滯期。`
        }
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
  } else {
    // on_track（-0.5% ~ -1.0%）
    // 恢復差 + 體重正常掉 → 碳水補回保護恢復，不改變赤字方向
    if (recoveryState === 'critical') {
      status = 'on_track'
      statusLabel = '進度正常'
      statusEmoji = '🟢'
      calDelta = 75; carbDelta = 19; fatDelta = 0
      message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，進度正常，但恢復狀態不佳。系統已微增碳水（+75kcal）保護恢復能力，避免掉重代價過高。`
    } else if (recoveryState === 'struggling') {
      status = 'on_track'
      statusLabel = '進度正常'
      statusEmoji = '🟢'
      calDelta = 50; carbDelta = 13; fatDelta = 0
      message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，進度正常，但恢復偏低。系統已微增碳水（+50kcal）支持恢復。`
    } else {
      status = 'on_track'
      statusLabel = '進度正常'
      statusEmoji = '🟢'
      message = `體重下降速率 ${weeklyChangeRate.toFixed(2)}%/週，完美符合目標範圍（-0.5% ~ -1.0%）。`
    }
  }

  // 計算參考值
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let suggestedCal = currentCal + calDelta
  let suggestedPro = currentPro  // 蛋白質永遠不降
  let suggestedCarb = currentCarb + carbDelta
  let suggestedFat = currentFat + fatDelta

  // 安全底線檢查（男女分開：女性蛋白質需求較低，脂肪需求較高）
  const proteinPerKgFloor = isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE
  const minProtein = Math.round(bw * proteinPerKgFloor)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${proteinPerKgFloor}g/kg）`)
  }

  const fatPerKgFloor = isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
  const minFat = Math.round(bw * fatPerKgFloor)
  if (suggestedFat < minFat) {
    suggestedFat = minFat
    warnings.push(`脂肪不可低於 ${minFat}g（${fatPerKgFloor}g/kg${isMale ? '' : '，女性荷爾蒙保護需求'}），已調整至安全底線`)
  }

  if (suggestedCal < minCal) {
    suggestedCal = minCal
    warnings.push(`熱量不可低於 ${minCal}kcal（${isMale ? '男性' : '女性'}安全底線），已調整`)
  }

  if (estimatedTDEE && (estimatedTDEE - suggestedCal) > SAFETY.MAX_DEFICIT_KCAL) {
    warnings.push(`目前赤字已達 ${estimatedTDEE - suggestedCal}kcal，超過參考上限 500kcal`)
  }

  if (suggestedCarb < 50) {
    suggestedCarb = 50
    warnings.push('碳水已觸及最低值 50g，不宜再降')
  }

  // Diet break 偵測
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS
  if (dietBreakSuggested) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週，可考慮安排 1-2 週維持期（diet break）以恢復荷爾蒙和心理狀態`)
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

  // 注意：Deadline-aware 的緊急加速已由 Goal-Driven 引擎處理（weightToLose > 0 時自動進入）
  // Reactive 模式僅處理無目標體重或已達標的情況

  if (status === 'on_track' && calDelta === 0 && carbDelta === 0) {
    // 進度正常且無恢復狀態調整 → 驗證巨量營養素安全底線即可
    let validatedPro = currentPro
    let validatedFat = currentFat
    const proteinPerKgFloorOT = isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE
    const fatPerKgFloorOT = isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
    const minProteinOT = Math.round(bw * proteinPerKgFloorOT)
    const minFatOT = Math.round(bw * fatPerKgFloorOT)

    if (currentPro > 0 && currentPro < minProteinOT) {
      validatedPro = minProteinOT
      warnings.push(`⚠️ 目前蛋白質 ${currentPro}g 低於安全最低值 ${minProteinOT}g（${proteinPerKgFloorOT}g/kg），系統已自動調高`)
    }
    if (currentFat > 0 && currentFat < minFatOT) {
      validatedFat = minFatOT
      warnings.push(`⚠️ 目前脂肪 ${currentFat}g 低於安全底線 ${minFatOT}g（${fatPerKgFloorOT}g/kg），系統已自動調高`)
    }

    const hasCorrections = validatedPro !== currentPro || validatedFat !== currentFat
    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: currentCal, suggestedProtein: validatedPro,
      suggestedCarbs: currentCarb, suggestedFat: validatedFat,
      suggestedCarbsTrainingDay: input.currentCarbsTrainingDay,
      suggestedCarbsRestDay: input.currentCarbsRestDay,
      caloriesDelta: 0, proteinDelta: validatedPro - currentPro,
      carbsDelta: 0, fatDelta: validatedFat - currentFat,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested, warnings,
      currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
      deadlineInfo, autoApply: hasCorrections, peakWeekPlan: null,
      menstrualCycleNote: cycleInfo.note,
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
    currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
    deadlineInfo, autoApply: true, peakWeekPlan: null,
    menstrualCycleNote: cycleInfo.note,
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
  warnings: string[],
  cycleInfo: MenstrualCycleInfo,
  recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
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
  let aheadOfSchedule = false
  let effectiveDailyDeficit = requiredDailyDeficit

  if (weeklyChangeRate < 0) {
    const actualWeeklyLoss = Math.abs(weeklyChangeRate / 100) * bw
    const projectedLoss = actualWeeklyLoss * (daysLeft / 7)

    if (projectedLoss > weightToLose * 1.15) {
      aheadOfSchedule = true
      const idealWeeklyLoss = Math.max(requiredWeeklyLoss, bw * 0.005)
      const idealDailyDeficit = (idealWeeklyLoss * energyDensity) / 7
      effectiveDailyDeficit = Math.round(idealDailyDeficit)
      warnings.push(`📈 進度超前！照目前速率可減 ${projectedLoss.toFixed(1)}kg（只需 ${weightToLose.toFixed(1)}kg）。已放鬆赤字，增加碳水保護肌肉`)

      if (effectiveDailyDeficit <= SAFETY.MAX_DEFICIT_KCAL) {
        safetyLevel = 'normal'
      } else if (effectiveDailyDeficit <= GOAL_DRIVEN.MAX_DEFICIT_KCAL) {
        safetyLevel = 'aggressive'
      } else {
        safetyLevel = 'extreme'
      }
    }
  }

  // 3.5 恢復狀態 → 調整赤字力道
  // 核心原則：恢復差 → 縮小赤字（碳水補回）；恢復好 → 可維持或微加赤字
  // 只在非進度超前時生效（進度超前已經放鬆了，不需再調）
  let recoveryDeficitAdjust = 0
  if (!aheadOfSchedule && recoveryState !== 'unknown') {
    if (recoveryState === 'critical') {
      // 恢復極差 → 赤字縮小 150kcal（全補碳水）
      recoveryDeficitAdjust = -150
      warnings.push('⚠️ 恢復狀態不佳，系統已縮小赤字 150kcal（碳水補回），優先保護恢復能力。')
    } else if (recoveryState === 'struggling') {
      // 恢復偏低 → 赤字縮小 75kcal
      recoveryDeficitAdjust = -75
      warnings.push('⚠️ 恢復偏低，系統已微縮赤字 75kcal（碳水補回），支持身體恢復。')
    } else if (recoveryState === 'optimal' && safetyLevel === 'normal') {
      // 恢復極佳 + 安全赤字 → 可微加赤字 50kcal 加速進度
      recoveryDeficitAdjust = 50
      warnings.push('💪 恢復極佳，系統微增赤字 50kcal 加速進度。')
    }
    // good → 不調整（0）
  }
  effectiveDailyDeficit = Math.max(0, effectiveDailyDeficit + recoveryDeficitAdjust)

  // 計算目標每日卡路里（用放鬆後的赤字）
  let targetCalories = Math.round(estimatedTDEE - effectiveDailyDeficit)

  // 4. 安全底線 + 巨量營養素（先算，因為有氧需要知道真實卡路里底線）
  // 備賽選手（有 prepPhase）才允許放寬到 GOAL_DRIVEN 極限，一般學員仍用 SAFETY 底線
  const isCompetitionPrep = !!input.prepPhase
  const absoluteMinCal = isMale
    ? (isCompetitionPrep ? GOAL_DRIVEN.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_MALE)
    : (isCompetitionPrep ? GOAL_DRIVEN.MIN_CALORIES_FEMALE : SAFETY.MIN_CALORIES_FEMALE)
  const softMinCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE

  // 巨量營養素分配（依性別 + 赤字深度）
  // 男性：Helms 2014 赤字越大 → 蛋白質越高（2.3→2.6→3.0g/kg）
  // 女性：Stokes 2018 備賽建議，比男性低（1.8→2.0→2.3g/kg），節省熱量給碳水和脂肪
  const proteinPerKg = isMale
    ? (safetyLevel === 'extreme' ? GOAL_DRIVEN.PROTEIN_PER_KG_EXTREME
        : safetyLevel === 'aggressive' ? GOAL_DRIVEN.PROTEIN_PER_KG_AGGRESSIVE
        : GOAL_DRIVEN.PROTEIN_PER_KG_NORMAL)
    : (safetyLevel === 'extreme' ? GOAL_DRIVEN.PROTEIN_PER_KG_EXTREME_FEMALE
        : safetyLevel === 'aggressive' ? GOAL_DRIVEN.PROTEIN_PER_KG_AGGRESSIVE_FEMALE
        : GOAL_DRIVEN.PROTEIN_PER_KG_NORMAL_FEMALE)

  // 女性脂肪底線比男性高（雌激素合成、月經功能保護）
  const minFatPerKg = isMale
    ? (safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG)
    : (safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG_FEMALE : SAFETY.MIN_FAT_PER_KG_FEMALE)

  let suggestedPro = Math.round(bw * proteinPerKg)
  let suggestedFat = Math.round(bw * minFatPerKg)

  // 計算蛋白質+脂肪的最低卡路里（碳水底線 30g = 120kcal）
  let proFatCal = suggestedPro * 4 + suggestedFat * 9
  const carbFloorCal = 30 * 4  // 120 kcal

  // 如果蛋白質+脂肪+碳水底線 > targetCalories → 需要砍巨量營養素
  // 優先級：碳水先壓底線 → 降脂肪 → 最後降蛋白質
  // 女性脂肪壓縮底線比男性高（0.7g/kg vs 0.5g/kg），保護荷爾蒙
  if (proFatCal + carbFloorCal > targetCalories) {
    // 先降脂肪到絕對底線（使用 GOAL_DRIVEN 常數：男 0.7g/kg，女 0.9g/kg）
    const absoluteMinFat = Math.round(bw * (isMale ? GOAL_DRIVEN.MIN_FAT_PER_KG : GOAL_DRIVEN.MIN_FAT_PER_KG_FEMALE))
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
  // 依 activityProfile 取對應步數上限（上班族 vs 高能量通量）
  // 設計原則：有氧分鐘只在飲食赤字真的不夠時才顯示（主動介入），
  //           日常活動量全部以「步數目標」表達，簡單易追蹤
  const cardioProfile = getCardioProfile(input.activityProfile)
  const kcalPerMinCardio = bw * CARDIO.BASE_KCAL_PER_MIN_PER_KG * CARDIO.PREP_FATIGUE_DISCOUNT
  const kcalPerStep = bw * CARDIO.BASE_KCAL_PER_STEP_PER_KG
  let extraCardioNeeded = false
  let extraBurnPerDay = 0
  let suggestedCardioMinutes = 0  // 預設 0，只在 shortfall 夠大時才給有氧分鐘
  let suggestedDailySteps = cardioProfile.BASELINE_STEPS
  let cardioNote = ''
  let predictedCompWeight: number

  // 用 actualCalories 算真實飲食赤字
  const realDietDeficit = estimatedTDEE - actualCalories
  // shortfall 閾值 50 kcal：避免 TDEE 取整誤差造成 1 kcal shortfall → 1 分鐘有氧的 bug
  const shortfall = effectiveDailyDeficit - realDietDeficit

  if (shortfall > 50) {
    // 飲食面赤字不夠（差距 > 50 kcal）→ 需要額外活動補，全部換算成步數
    const rawExtraBurn = shortfall
    extraBurnPerDay = Math.min(rawExtraBurn, CARDIO.MAX_EXTRA_BURN_PER_DAY)
    extraCardioNeeded = true
    suggestedCardioMinutes = 0  // 不顯示有氧分鐘，全轉步數

    // 全部換算成步數（不分有氧/NEAT，統一由步數追蹤）
    const extraSteps = Math.ceil(extraBurnPerDay / kcalPerStep)
    suggestedDailySteps = Math.min(cardioProfile.MAX_DAILY_STEPS, cardioProfile.BASELINE_STEPS + extraSteps)

    // 預測體重（飲食 + 步數）
    const actualExtraSteps = suggestedDailySteps - cardioProfile.BASELINE_STEPS
    const totalDailyBurn = realDietDeficit + actualExtraSteps * kcalPerStep
    const totalLoss = (totalDailyBurn * daysLeft) / energyDensity
    predictedCompWeight = Math.round((bw - totalLoss) * 10) / 10

    // 判斷能否達標
    if (predictedCompWeight <= targetWeight + 0.3) {
      cardioNote = `飲食 + 步數可達標！今日目標 ${suggestedDailySteps.toLocaleString()} 步（需額外消耗 ${Math.round(extraBurnPerDay)}kcal）`
    } else {
      cardioNote = `預測 ${predictedCompWeight}kg（目標 ${targetWeight}kg），差 ${(predictedCompWeight - targetWeight).toFixed(1)}kg。可與教練討論調整量級或目標`
    }

    if (rawExtraBurn > CARDIO.MAX_EXTRA_BURN_PER_DAY) {
      warnings.push(`🏃 理論需額外消耗 ${Math.round(rawExtraBurn)}kcal/天，但步數合理上限約 ${CARDIO.MAX_EXTRA_BURN_PER_DAY}kcal/天`)
    }
    warnings.push(`👟 今日步數目標 ${suggestedDailySteps.toLocaleString()} 步（需額外消耗 ${Math.round(extraBurnPerDay)}kcal 彌補飲食缺口）`)
  } else {
    // 飲食面赤字足夠（shortfall ≤ 50 kcal）
    predictedCompWeight = targetWeight

    // 高能量通量策略（High Energy Flux）
    // 即使飲食赤字夠了，也設步數目標 → 多消耗的部分加回碳水
    // 原理：同樣赤字但吃更多 → 保護代謝、維持訓練品質、減少肌肉流失
    // 有氧分鐘在此路徑完全移除，只用步數目標表達活動量（簡單、可被動追蹤）
    // 注意：不設 extraCardioNeeded = true，因為飲食赤字已足夠
    if (safetyLevel !== 'normal' || input.activityProfile === 'high_energy_flux') {
      suggestedCardioMinutes = 0  // 此路徑不顯示有氧分鐘

      if (input.activityProfile === 'sedentary') {
        suggestedDailySteps = safetyLevel === 'extreme' ? 9000 : 7000
      } else if (input.activityProfile === 'high_energy_flux') {
        suggestedDailySteps = safetyLevel === 'extreme' ? 15000 : 12000
      } else {
        suggestedDailySteps = safetyLevel === 'extreme' ? 12000 : 10000
      }

      // 計算步數消耗 → 加回碳水（赤字不變）
      const fluxExtraSteps = Math.max(0, suggestedDailySteps - cardioProfile.BASELINE_STEPS)
      const fluxStepsBurn = Math.round(fluxExtraSteps * kcalPerStep)

      // 多消耗的全給碳水（碳水是訓練品質的直接燃料）
      const fluxCarbsBonus = Math.round(fluxStepsBurn / 4)
      const baseCalories = actualCalories  // 記錄未含步數的基礎卡路里
      suggestedCarb += fluxCarbsBonus
      actualCalories += fluxStepsBurn

      const profileLabel = input.activityProfile === 'sedentary' ? '上班族模式' : input.activityProfile === 'high_energy_flux' ? '高能量通量' : '中等活動量'
      cardioNote = `${profileLabel}：目標 ${suggestedDailySteps.toLocaleString()} 步/天（消耗 ~${fluxStepsBurn}kcal）→ 碳水 +${fluxCarbsBonus}g 吃回來，赤字不變。⚠️ 若未達步數目標，碳水應減 ${fluxCarbsBonus}g（改為 ${baseCalories}kcal）`
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
      // 訓練日:休息日 = 60:40 比例，根據訓練天數加權以保留週總碳水量
      // 公式：weeklyCarb = T × TD + R × RD，TD/RD = 1.5（60:40）
      const avgDailyCarb = suggestedCarb
      const T = Math.min(input.trainingDaysPerWeek, 6)
      const R = 7 - T
      if (T > 0 && R > 0) {
        suggestedCarbsRD = Math.round((avgDailyCarb * 7) / (1.5 * T + R))
        suggestedCarbsTD = Math.round(suggestedCarbsRD * 1.5)
      } else {
        suggestedCarbsTD = avgDailyCarb
        suggestedCarbsRD = avgDailyCarb
      }
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
      message += `，步數目標 ${suggestedDailySteps.toLocaleString()} 步/天`
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
    warnings.push(`⚡ 赤字已超過一般參考值 500kcal，備賽模式已啟用放寬限制`)
  } else {
    statusEmoji = '✅'
    message = `目標模式：每日赤字 ${requiredDailyDeficit}kcal，預計每週掉 ${requiredWeeklyLoss.toFixed(2)}kg（${weeklyLossPct.toFixed(1)}% BW）。`
    message += ` 在安全範圍內，距比賽 ${daysLeft} 天，穩穩達標。`
  }

  // 如果實際體重趨勢偏離目標，追加提示
  if (weeklyChangeRate > 0) {
    if (cycleInfo.inLutealPhase && weeklyChangeRate <= 2.0) {
      message += ` 🩸 上週體重微升 +${weeklyChangeRate.toFixed(2)}%，但處於黃體期，屬正常水分滯留，不影響計畫。`
    } else {
      message += ` ⚠️ 注意：上週體重反而增加了 ${weeklyChangeRate.toFixed(2)}%，請確實執行計畫。`
    }
  } else if (weeklyChangeRate < -GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT) {
    message += ` ⚠️ 上週掉太快（${weeklyChangeRate.toFixed(2)}%），注意肌肉流失。`
    warnings.push('掉重速率超過 1.2%/週（Garthe 2011: >1% 增加 LBM 流失風險），可考慮增加蛋白質攝取量或微增碳水')
  }

  // Diet break 偵測
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS
  if (dietBreakSuggested && daysLeft > 21) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週。距比賽還有 ${daysLeft} 天，可考慮安排 3-5 天 refeed 恢復代謝`)
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
    currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
    deadlineInfo: enrichedDeadlineInfo,
    autoApply: true,  // Goal-driven 永遠自動套用
    peakWeekPlan: null,
    menstrualCycleNote: cycleInfo.note,
  }
}

// ===== 增肌引擎 =====

function generateBulkSuggestion(
  input: NutritionInput,
  weeklyChangeRate: number,
  estimatedTDEE: number | null,
  dietDurationWeeks: number | null,
  deadlineInfo: NutritionSuggestion['deadlineInfo'],
  warnings: string[],
  cycleInfo: MenstrualCycleInfo,
  recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
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
    message = `體重增加速率 +${weeklyChangeRate.toFixed(2)}%/週，超過理想範圍（+0.5%），有脂肪堆積風險。系統偵測：可考慮微降熱量。`
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
      if (input.weeklyWeights.length >= 2) {
        const lastWeek = input.weeklyWeights[1].avgWeight
        const lastWeekRate = ((input.weeklyWeights[0].avgWeight - lastWeek) / lastWeek) * 100
        if (lastWeekRate < BULK_TARGETS.MIN_RATE) {
          status = 'plateau'
          statusLabel = '增長停滯'
          statusEmoji = '🟡'
          calDelta = 175
          carbDelta = 22
          fatDelta = 0
          message = `體重近 10-14 天增長停滯（+${weeklyChangeRate.toFixed(2)}%/週）。系統偵測：可考慮增加熱量推動增長。`
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

  // ===== 增肌 × 恢復狀態整合 =====
  // 增肌期恢復差 → 需要更多碳水支持恢復與合成
  // 增肌期恢復好 → 身體適應良好，不需額外調整
  if (recoveryState !== 'unknown') {
    if (recoveryState === 'critical') {
      carbDelta += 25; calDelta += 100
      message += ` 恢復狀態不佳，系統已額外增加碳水（+100kcal）支持恢復與肌肉合成。`
      warnings.push('⚠️ 增肌期恢復不足：已增加碳水支持恢復。建議檢視訓練量和睡眠品質。')
    } else if (recoveryState === 'struggling') {
      carbDelta += 13; calDelta += 50
      message += ` 恢復偏低，系統已微增碳水（+50kcal）輔助恢復。`
    }
  }

  // 計算參考值
  const currentCal = input.currentCalories || 0
  const currentPro = input.currentProtein || 0
  const currentCarb = input.currentCarbs || 0
  const currentFat = input.currentFat || 0

  let suggestedCal = currentCal + calDelta
  let suggestedPro = currentPro
  let suggestedCarb = currentCarb + carbDelta
  let suggestedFat = currentFat + fatDelta

  // 安全底線（男女分開：女性增肌期蛋白質與脂肪需求有別）
  const isMaleBulk = input.gender === '男性'
  const bulkProteinFloor = isMaleBulk ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE
  const minProtein = Math.round(bw * bulkProteinFloor)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${bulkProteinFloor}g/kg）`)
  }

  const bulkFatFloor = isMaleBulk ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
  const minFat = Math.round(bw * bulkFatFloor)
  if (suggestedFat < minFat) {
    suggestedFat = minFat
    warnings.push(`脂肪不可低於 ${minFat}g（${bulkFatFloor}g/kg），已調整`)
  }
  const maxFat = Math.round(bw * SAFETY.MAX_FAT_PER_KG_BULK)
  if (suggestedFat > maxFat) {
    suggestedFat = maxFat
    warnings.push(`增肌期脂肪參考上限 ${maxFat}g（${SAFETY.MAX_FAT_PER_KG_BULK}g/kg）`)
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
    // 即使進度正常，也驗證巨量營養素安全底線
    let validatedPro = currentPro
    let validatedFat = currentFat
    const bulkProteinFloorOT = isMaleBulk ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE
    const bulkFatFloorOT = isMaleBulk ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
    const minProteinBulk = Math.round(bw * bulkProteinFloorOT)
    const minFatBulk = Math.round(bw * bulkFatFloorOT)

    if (currentPro > 0 && currentPro < minProteinBulk) {
      validatedPro = minProteinBulk
      warnings.push(`⚠️ 目前蛋白質 ${currentPro}g 低於安全最低值 ${minProteinBulk}g（${bulkProteinFloorOT}g/kg），系統已自動調高`)
    }
    if (currentFat > 0 && currentFat < minFatBulk) {
      validatedFat = minFatBulk
      warnings.push(`⚠️ 目前脂肪 ${currentFat}g 低於安全底線 ${minFatBulk}g（${bulkFatFloorOT}g/kg），系統已自動調高`)
    }

    const hasCorrections = validatedPro !== currentPro || validatedFat !== currentFat
    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: currentCal, suggestedProtein: validatedPro,
      suggestedCarbs: currentCarb, suggestedFat: validatedFat,
      suggestedCarbsTrainingDay: input.currentCarbsTrainingDay,
      suggestedCarbsRestDay: input.currentCarbsRestDay,
      caloriesDelta: 0, proteinDelta: validatedPro - currentPro,
      carbsDelta: 0, fatDelta: validatedFat - currentFat,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested: false, warnings,
      currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
      deadlineInfo, autoApply: hasCorrections, peakWeekPlan: null,
      menstrualCycleNote: cycleInfo.note,
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
    currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
    deadlineInfo, autoApply: true, peakWeekPlan: null,
    menstrualCycleNote: cycleInfo.note,
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
        phase: 'depletion',
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
    currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
    deadlineInfo: { daysLeft, weeksLeft: Math.round(daysLeft / 7 * 10) / 10, weightToLose: 0, requiredRatePerWeek: 0, isAggressive: false },
    autoApply: true,
    peakWeekPlan: plan,
    menstrualCycleNote: null,  // Peak Week 不需要週期提示
  }
}

// ===== 理想體重推算（備賽 / 一般健康）=====
// 文獻依據：
// 備賽模式：
//   - Natural male competition BF%: 4–6% (Helms et al. 2014; Rossow et al. 2013)
//   - Natural female competition BF%: 10–14% (Halliday et al. 2016; Norton & Avery 2019)
//     ※ 原 8-12% 修正為 10-14%：Halliday 2016 實測女性自然選手比賽日約 10-15%
//   - FFMI ceiling (natural): ~25 kg/m² male, ~22 kg/m² female (Kouri et al. 1995)
// 一般健康模式：
//   - Male healthy/athletic BF%: 10–18% (ACSM Guidelines, 2021)
//   - Female healthy/athletic BF%: 18–25% (ACSM Guidelines, 2021)

export interface RecommendedStageWeightResult {
  ffm: number                    // 去脂體重 (kg)
  ffmi: number | null            // Fat Free Mass Index (kg/m²)，需要身高才能算
  recommendedLow: number         // 參考體重下限 (kg) — 以最高目標體脂推算
  recommendedHigh: number        // 參考體重上限 (kg) — 以最低目標體脂推算
  targetBFLow: number            // 使用的目標體脂下限 (%)
  targetBFHigh: number           // 使用的目標體脂上限 (%)
  currentBF: number              // 輸入的現況體脂 (%)
  currentWeight: number          // 輸入的現況體重 (kg)
  fatMass: number                // 現況脂肪量 (kg)
  fatToLose: number | null       // 需要減掉的脂肪量 (kg)，以參考中點計算
  mode: 'competition' | 'health' // 模式標籤
}

export function calcRecommendedStageWeight(
  currentWeight: number,
  bodyFatPct: number,   // 0–100 的百分比，例如 15 代表 15%
  gender: string,       // '男性' | '女性'
  heightCm?: number | null,
  isCompetition: boolean = true
): RecommendedStageWeightResult {
  const isMale = gender === '男性'

  // 去脂體重
  const ffm = Math.round(currentWeight * (1 - bodyFatPct / 100) * 10) / 10
  const fatMass = Math.round((currentWeight - ffm) * 10) / 10

  // FFMI (需要身高)
  let ffmi: number | null = null
  if (heightCm && heightCm > 0) {
    const heightM = heightCm / 100
    ffmi = Math.round((ffm / (heightM * heightM)) * 10) / 10
  }

  // 目標體脂範圍（依模式 + 性別）
  let targetBFLow: number
  let targetBFHigh: number
  if (isCompetition) {
    // 備賽：男性 4-6%，女性 10-14%（Halliday 2016 修正）
    targetBFLow = isMale ? 4 : 10
    targetBFHigh = isMale ? 6 : 14
  } else {
    // 一般健康/體態：男性 10-18%，女性 18-25%（ACSM）
    targetBFLow = isMale ? 10 : 18
    targetBFHigh = isMale ? 18 : 25
  }

  // 參考體重 = FFM ÷ (1 - 目標體脂)
  // 體脂高上限 → 體重下限；體脂低上限 → 體重上限
  const recommendedLow = Math.round(ffm / (1 - targetBFHigh / 100) * 10) / 10
  const recommendedHigh = Math.round(ffm / (1 - targetBFLow / 100) * 10) / 10

  // 以參考中點計算需減脂量
  const recommendedMid = (recommendedLow + recommendedHigh) / 2
  const fatToLose = currentWeight > recommendedMid
    ? Math.round((currentWeight - recommendedMid) * 10) / 10
    : null

  return {
    ffm,
    ffmi,
    recommendedLow,
    recommendedHigh,
    targetBFLow,
    targetBFHigh,
    currentBF: bodyFatPct,
    currentWeight,
    fatMass,
    fatToLose,
    mode: isCompetition ? 'competition' : 'health',
  }
}


// ===== Demo 引擎分析（前台訪客體驗用）=====
// 不需要學員資料庫、不需要歷史數據
// 純粹根據基本資料估算 TDEE、巨量營養素、預估時程

export interface DemoAnalysisInput {
  gender: '男性' | '女性'
  bodyWeight: number            // kg
  height?: number | null        // cm
  bodyFatPct?: number | null    // % (15 = 15%)
  goalType: 'cut' | 'bulk'
  targetWeight?: number | null  // kg
  trainingDaysPerWeek: number   // 1-7
}

export interface DemoAnalysisResult {
  estimatedTDEE: number
  tdeeMethod: 'katch_mcardle' | 'weight_formula'
  suggestedCalories: number
  dailyDeficit: number          // 正值=赤字, 負值=盈餘
  suggestedProtein: number
  suggestedCarbs: number
  suggestedFat: number
  weeklyChangeKg: number        // 預估每週變化 kg（負=減重）
  weeklyChangeRate: number      // 預估每週變化 %BW
  projectedWeeks: number | null // 達標所需週數
  safetyNotes: string[]
}

export function generateDemoAnalysis(input: DemoAnalysisInput): DemoAnalysisResult {
  const isMale = input.gender === '男性'
  const bw = input.bodyWeight
  const safetyNotes: string[] = []

  // 1. 估算 TDEE
  let estimatedTDEE: number
  let tdeeMethod: 'katch_mcardle' | 'weight_formula'

  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    // Katch-McArdle: BMR = 370 + 21.6 × LBM
    const lbm = bw * (1 - input.bodyFatPct / 100)
    const bmr = 370 + 21.6 * lbm
    const activityMultiplier = getActivityMultiplier(undefined, input.trainingDaysPerWeek)
    estimatedTDEE = Math.round(bmr * activityMultiplier)
    tdeeMethod = 'katch_mcardle'
  } else {
    // 無體脂 → 體重公式
    estimatedTDEE = Math.round(bw * getFallbackTDEEMultiplier(undefined, isMale))
    tdeeMethod = 'weight_formula'
    safetyNotes.push('未填體脂率，TDEE 以體重公式估算。填入體脂率可提高準確度。')
  }

  // 2. 計算赤字/盈餘
  let dailyDeficit: number
  if (input.goalType === 'cut') {
    // 赤字 = TDEE 的 20%，最大 500kcal
    dailyDeficit = Math.min(Math.round(estimatedTDEE * 0.20), SAFETY.MAX_DEFICIT_KCAL)
  } else {
    // 增肌盈餘 +250kcal（ISSN off-season recommendation）
    dailyDeficit = -250
  }

  // 3. 參考熱量
  let suggestedCalories = estimatedTDEE - dailyDeficit
  const minCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE
  if (suggestedCalories < minCal) {
    suggestedCalories = minCal
    dailyDeficit = estimatedTDEE - minCal
    safetyNotes.push(`已套用安全底線 ${minCal} kcal，避免代謝過度下降。`)
  }

  // 4. 巨量營養素
  const proteinPerKg = input.goalType === 'cut'
    ? (isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE)
    : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE)
  const fatPerKg = isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE

  const suggestedProtein = Math.round(bw * proteinPerKg)
  const suggestedFat = Math.round(bw * fatPerKg)
  const remainingCals = suggestedCalories - (suggestedProtein * 4) - (suggestedFat * 9)
  const suggestedCarbs = Math.max(30, Math.round(remainingCals / 4))

  // 5. 預估每週變化
  const weeklyChangeKg = input.goalType === 'cut'
    ? -(dailyDeficit * 7 / ENERGY_DENSITY.LATE_PHASE)
    : (Math.abs(dailyDeficit) * 7 / ENERGY_DENSITY.LATE_PHASE)
  const weeklyChangeRate = (weeklyChangeKg / bw) * 100

  // 6. 預估達標週數
  let projectedWeeks: number | null = null
  if (input.targetWeight != null && input.targetWeight !== bw) {
    const weightDelta = Math.abs(bw - input.targetWeight)
    const weeklyAbs = Math.abs(weeklyChangeKg)
    if (weeklyAbs > 0) {
      projectedWeeks = Math.round(weightDelta / weeklyAbs)
    }
  }

  // 7. 安全性檢查
  if (input.goalType === 'cut' && Math.abs(weeklyChangeRate) > 1.0) {
    safetyNotes.push('每週減重速率超過 1% BW，可考慮延長時程或降低赤字。')
  }
  if (input.goalType === 'bulk' && weeklyChangeRate > 0.5) {
    safetyNotes.push('增重速率偏快，可能增加脂肪堆積。')
  }

  return {
    estimatedTDEE,
    tdeeMethod,
    suggestedCalories,
    dailyDeficit,
    suggestedProtein,
    suggestedCarbs,
    suggestedFat,
    weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
    weeklyChangeRate: Math.round(weeklyChangeRate * 100) / 100,
    projectedWeeks,
    safetyNotes,
  }
}
