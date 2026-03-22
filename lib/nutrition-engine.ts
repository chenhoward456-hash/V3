/**
 * 營養素自動分析引擎 v3
 *
 * ═══════════════════════════════════════════════════════════════
 * 文獻參考 (Literature References)
 * ═══════════════════════════════════════════════════════════════
 *
 * ── 減脂速率與身體組成 ──
 * [1] Helms ER, Aragon AA, Fitschen PJ (2014). Evidence-based recommendations
 *     for natural bodybuilding contest preparation: nutrition and supplementation.
 *     J Int Soc Sports Nutr, 11:20. doi:10.1186/1550-2783-11-20
 *     → 減脂速率 0.5-1.0% BW/week；蛋白質 2.3-3.1 g/kg LBM；脂肪 15-30% calories
 *
 * [2] Garthe I, Raastad T, Refsnes PE, et al. (2011). Effect of two different
 *     weight-loss rates on body composition and strength and power-related
 *     performance in elite athletes. Int J Sport Nutr Exerc Metab, 21(2):97-104.
 *     doi:10.1123/ijsnem.21.2.97
 *     → 0.7% BW/week (slow) 保留更多 LBM；>1.4% BW/week 顯著損失肌肉量和力量
 *
 * [3] Roberts BM, Helms ER, Trexler ET, Fitschen PJ (2020). Nutritional
 *     recommendations for physique athletes. J Hum Kinet, 71:79-108.
 *     doi:10.2478/hukin-2019-0096
 *     → 蛋白質 1.8-2.7 g/kg；備賽與恢復期的綜合營養建議
 *
 * [4] Iraki J, Fitschen P, Espinar S, Helms E (2019). Nutrition recommendations
 *     for bodybuilders in the off-season: a narrative review. Sports, 7(7):154.
 *     doi:10.3390/sports7070154
 *     → 增肌期 surplus +10-20%、增重 0.25-0.5% BW/week；蛋白質 1.6-2.2 g/kg
 *
 * ── 蛋白質需求 ──
 * [5] Morton RW, Murphy KT, McKellar SR, et al. (2018). A systematic review,
 *     meta-analysis and meta-regression of the effect of protein supplementation
 *     on resistance training-induced gains in muscle mass and strength in healthy
 *     adults. Br J Sports Med, 52(6):376-384. doi:10.1136/bjsports-2017-097608
 *     → 蛋白質 1.6 g/kg 達飽和點；性別差異不顯著
 *
 * [6] Stokes T, Hector AJ, Morton RW, et al. (2018). Recent perspectives
 *     regarding the role of dietary protein for the promotion of muscle
 *     hypertrophy with resistance exercise training. Nutrients, 10(2):180.
 *     → 女性對低劑量蛋白質的肌肉合成反應同等有效
 *
 * ── 代謝適應與 Diet Break / Refeed ──
 * [7] Trexler ET, Smith-Ryan AE, Norton LE (2014). Metabolic adaptation to
 *     weight loss: implications for the athlete. J Int Soc Sports Nutr, 11:7.
 *     doi:10.1186/1550-2783-11-7
 *     → 代謝適應 (adaptive thermogenesis) 使 TDEE 降幅超過體重預測值；
 *       持續限制 vs 間歇限制的比較；reverse dieting 概念
 *
 * [8] Byrne NM, Sainsbury A, King NA, et al. (2018). Intermittent energy
 *     restriction improves weight loss efficiency in obese men: the MATADOR
 *     study. Int J Obes, 42:129-138. doi:10.1038/ijo.2017.206
 *     → 2 週限制 + 2 週維持 (intermittent) vs 連續限制；
 *       IER 組減脂更多 (12.9% vs 8.4%)、保留更多 FFM、代謝適應更小
 *
 * ── 能量可用性與 RED-S ──
 * [9] Loucks AB, Thuma JR (2003). Luteinizing hormone pulsatility is disrupted
 *     at a threshold of energy availability in regularly menstruating women.
 *     J Clin Endocrinol Metab, 88(1):297-311.
 *     → EA < 30 kcal/kg FFM/day 為荷爾蒙功能臨界閾值
 *
 * [10] Mountjoy M, Sundgot-Borgen JK, Burke LM, et al. (2018). IOC consensus
 *      statement on relative energy deficiency in sport (RED-S): 2018 update.
 *      Br J Sports Med, 52(11):687-697. doi:10.1136/bjsports-2018-099193
 *      → 低能量可用性對多系統的影響；RED-S 臨床評估工具
 *
 * ── 最大脂肪氧化率 ──
 * [11] Alpert SS (2005). A limit on the energy transfer rate from the human fat
 *      store in hypophagia. J Theor Biol, 233(1):1-13.
 *      doi:10.1016/j.jtbi.2004.08.029
 *      → 最大脂肪動員率 ~31 kcal/lb fat/day (290±25 kJ/kg/day)；
 *        超過此速率 FFM 流失指數級增加
 *
 * ── Peak Week 操控 ──
 * [12] Escalante G, Stevenson SW, Barakat C, Aragon AA, Schoenfeld BJ (2021).
 *      Peak week recommendations for bodybuilders: an evidence based approach.
 *      BMC Sports Sci Med Rehabil, 13:68. doi:10.1186/s13102-021-00296-y
 *      → 碳水超補 8-12 g/kg、水分操控、鈉操控的系統性建議；
 *        建議操控最少變量並預先實驗
 *
 * [13] Barakat C, Escalante G, Stevenson SW, et al. (2022). Can bodybuilding
 *      peak week manipulations favorably affect muscle size, subcutaneous
 *      thickness, and related body composition variables? A case study.
 *      Sports, 10(7):106. doi:10.3390/sports10070106
 *      → 詳細記錄碳水耗竭→超補對肌肉厚度、皮下厚度、體內外水分的影響
 *
 * [14] Homer KA, Cross MR, Helms ER (2024). Peak week carbohydrate manipulation
 *      practices in physique athletes: a narrative review. Sports Med Open,
 *      10(1):8. doi:10.1186/s40798-024-00674-z
 *      → 碳水操控 3-12 g/kg；水分切割 ~1.5-3% BW
 *
 * ── 動態能量密度 ──
 * [15] Hall KD (2008). What is the required energy deficit per unit weight loss?
 *      Int J Obes, 32(3):573-576. doi:10.1038/sj.ijo.0803720
 *      → 減重初期 ~3500 kcal/kg（含水分），後期趨近 7700 kcal/kg（純脂肪）
 *
 * ── ISSN Position Stands ──
 * [16] Jäger R, Kerksick CM, Campbell BI, et al. (2017). International Society
 *      of Sports Nutrition position stand: protein and exercise. J Int Soc
 *      Sports Nutr, 14:20. doi:10.1186/s12970-017-0177-8
 *
 * [17] Aragon AA, Schoenfeld BJ, Wildman R, et al. (2017). International
 *      Society of Sports Nutrition position stand: diets and body composition.
 *      J Int Soc Sports Nutr, 14:16. doi:10.1186/s12970-017-0174-y
 *
 * ═══════════════════════════════════════════════════════════════
 *
 * 活動量分型 (Activity Profile)：
 * - sedentary（上班族）: 以飲食控制為主，步數受限，有氧時間少
 * - high_energy_flux（高能量通量）: 主動增加活動消耗，同樣赤字下吃更多，保護代謝
 */

import {
  getBodyFatZone,
  getZoneMacros,
  type Gender as BFZGender,
  type BodyFatZoneId,
} from './body-fat-zone-table'

import { getLabMacroModifiers, detectLabCrossPatterns, type LabMacroModifier, type LabTrainingModifier } from './lab-nutrition-advisor'
import { type GeneticProfile, getSerotoninRiskLevel } from './supplement-engine'
import { generateRecoveryAssessment, type RecoveryAssessment, type RecoveryState as RecoveryEngineState } from './recovery-engine'
import type { PrepPhase } from './client-mode'

// ===== 類型定義 =====

export interface NutritionInput {
  // 學員資料
  gender: string  // '男性' | '女性'
  bodyWeight: number  // 當前體重 kg (最新紀錄)
  goalType: 'cut' | 'bulk' | 'recomp'
  dietStartDate: string | null  // 開始日期 (ISO)

  // 身體組成（用於 Katch-McArdle BMR 估算 TDEE）
  height?: number | null        // 身高 cm
  bodyFatPct?: number | null    // 體脂率 %（例如 10 = 10%）
  previousBodyFatPct?: number | null  // 上次體脂率 %（用於增肌期髒增肌偵測）

  // Deadline-aware（目標體重 + 目標日期）
  targetWeight: number | null
  targetBodyFatPct?: number | null  // 目標體脂率 %（例如 15 = 15%）
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
  prepPhase?: PrepPhase | null

  // 客戶模式（用於區分 athletic vs bodybuilding 的營養策略）
  clientMode?: 'standard' | 'health' | 'bodybuilding' | 'athletic'

  // 秤重到比賽的間距（小時），用於超補償期計算
  weighInGapHours?: number | null

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

  // 血檢結果（用於 lab → macro 調整）
  labResults?: Array<{ test_name: string; value: number | null; unit: string; status: 'normal' | 'attention' | 'alert' }>

  // 訓練量數據（RPE × duration × frequency → 影響 TDEE）
  recentTrainingVolume?: {
    avgRPE: number | null
    avgDurationMin: number | null
    sessionsPerWeek: number
  }

  // 補品依從率 + 補品清單（用於依從性回饋迴圈）
  supplementCompliance?: {
    rate: number  // 0-1 (近 8 週打卡率)
    weeksDuration: number  // 持續使用週數
    supplements?: string[]  // 補品名稱列表
  }

  // 基因資料（用於基因修正層）
  geneticProfile?: GeneticProfile

  // Peak Week 每日實際體重（用於碳水超補溢出回饋機制）
  peakWeekDailyWeights?: { date: string; weight: number }[]
}

export interface NutritionSuggestion {
  status: 'on_track' | 'too_fast' | 'plateau' | 'wrong_direction' | 'insufficient_data' | 'low_compliance' | 'peak_week' | 'goal_driven' | 'athletic_rebound' | 'athletic_weigh_in' | 'athletic_competition'
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
    // Peak Week 體重三層拆分（備賽專用）
    peakWeekWaterCutPct?: number     // 預估 Peak Week 淨脫重百分比（預設 2%）
    prePeakEntryWeight?: number      // Peak Week 入場目標體重
    dietWeightToLose?: number        // 需要靠飲食減掉的量 (kg)
    peakWeekExpectedLoss?: number    // Peak Week 預估可處理的量 (kg)
  } | null

  // 恢復評估（來自 recovery-engine，完整多系統分析）
  recoveryAssessment?: RecoveryAssessment | null

  // 代謝壓力分數
  metabolicStress: MetabolicStressResult | null

  // 月經週期判斷（女性專用）
  menstrualCycleNote: string | null  // 黃體期提示訊息（null = 不在黃體期或非女性）

  // 體脂區間資訊（有體脂率時才有值）
  bodyFatZoneInfo: {
    zoneId: BodyFatZoneId
    zoneLabel: string
    proteinPerKg: number   // 區間建議 g/kg
    fatPerKg: number       // 區間建議 g/kg
    refeedFrequency: string | null  // 建議 refeed 頻率
  } | null

  // 分餐蛋白質指引（Iraki 2019: 每餐 0.40-0.55 g/kg，3-6 餐，訓練前後 1-2 小時進食）
  perMealProteinGuide: {
    perMealGrams: { min: number; max: number }  // 每餐蛋白質克數
    mealsPerDay: { min: number; max: number }    // 建議餐數
    periWorkoutNote: string                       // 訓練前後進食指引
  } | null

  // 血檢驅動的巨量營養素修正（已套用到建議值中）
  labMacroModifiers: LabMacroModifier[]
  labTrainingModifiers: LabTrainingModifier[]

  // Energy Availability 警告（RED-S 風險）
  energyAvailability: {
    eaKcalPerKgFFM: number
    level: 'adequate' | 'low' | 'critical'
    warning: string | null
  } | null

  // 是否可以自動套用
  autoApply: boolean

  // TDEE 校正幅度異常標記（超過 15% 時為 true，建議人工確認）
  tdeeAnomalyDetected: boolean

  // Peak Week 每日計畫（僅 peak_week 狀態時有值）
  peakWeekPlan: PeakWeekDay[] | null

  // 基因修正紀錄（已套用到建議值中，前端可顯示）
  geneticCorrections: GeneticCorrection[]

  // 建議水量 (ml)
  suggestedWater?: number | null

  // Athletic 超補償期詳情
  athleticRebound?: {
    gapHours: number
    strategy: 'short' | 'medium' | 'long'
    waterPerHour: number  // mL/hour rehydration rate
  } | null

  // 賽後恢復標記（比賽日期已過時自動啟用）
  postCompetitionRecovery?: boolean
  recoveryWater?: number  // 恢復期建議水量 (ml)

  // 減脂閘門：血檢 + 穿戴裝置 + 恢復狀態不合格時強制恢復
  cuttingReadinessGate?: {
    blocked: boolean              // true = 閘門擋住，不允許減脂
    reasons: string[]             // 每個擋住的原因
    labFlags: string[]            // 異常的血檢指標
    recommendation: string        // 給用戶的建議
    readinessScore: number        // 0-100 綜合就緒分數
  } | null
}

// 基因修正紀錄
export interface GeneticCorrection {
  gene: 'depression' | 'mthfr' | 'apoe4'
  rule: string       // 修正規則名稱
  adjustment: string  // 修正內容（中文說明）
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
  sodiumMg: number          // 鈉目標 mg（可追蹤數值）
  sodiumNote: string
  fiberNote: string
  trainingNote: string
  // 算好的絕對值
  carbs: number
  protein: number
  fat: number
  calories: number
  water: number // mL
  // 進階指引
  potassiumNote?: string    // 鉀離子建議
  foodNote?: string         // 食物選擇建議
  creatineNote?: string     // 肌酸建議
  supplementNote?: string   // 補劑建議（TMG, B群, D3, 鎂, 茶氨酸等）
  posingNote?: string       // Posing 練習排程
  pumpUpNote?: string       // 後台 pump-up 指引（比賽日）
  expectedWeight?: number   // 預估體重（基於肝醣 + 水分變化）
  weightNote?: string       // 體重變化說明
  showDayTimeline?: ShowDayMeal[]  // 比賽日時間軸（僅 show_day 階段）
}

export interface ShowDayMeal {
  timeLabel: string     // 例如 '起床（上台前 7 小時）'
  relativeHours: number // 相對於上台時間，負數表示上台前
  carbs: number
  protein: number
  fat: number
  waterMl: number
  sodiumMg: number
  items: string[]       // 食物/補劑清單
  note?: string         // 特別說明
  emoji: string         // 時段 emoji
}

// ===== 常數 (基於文獻，編號對應檔案頂部 References) =====

const SAFETY = {
  MIN_CALORIES_MALE: 1500,
  MIN_CALORIES_FEMALE: 1200,
  // 男性蛋白質下限 [1] Helms 2014: 2.3-3.1 g/kg LBM → 體重近似取下限
  MIN_PROTEIN_PER_KG_CUT: 2.3,
  MIN_PROTEIN_PER_KG_BULK: 1.8,
  // 女性蛋白質下限 [5] Morton 2018 / [6] Stokes 2018: 1.6-2.0 g/kg 即達最大合成效果
  MIN_PROTEIN_PER_KG_CUT_FEMALE: 1.8,
  MIN_PROTEIN_PER_KG_BULK_FEMALE: 1.6,
  // 脂肪下限：男性荷爾蒙需求較低，女性 (雌激素合成) 需更高
  MIN_FAT_PER_KG: 0.8,           // 男性 (15-20% calories)
  MIN_FAT_PER_KG_FEMALE: 1.0,    // 女性 [9] Loucks 2003 / [10] RED-S: ≥20-25% calories
  MAX_FAT_PER_KG_BULK: 1.2,
  MAX_SURPLUS_KCAL: 500,          // 增肌盈餘上限 500kcal（ISSN: lean bulk 10-20% surplus）
  MAX_DEFICIT_KCAL: 500,          // [17] ISSN Position Stand: ≤500 kcal/day deficit
  DIET_BREAK_WEEKS: 8,            // [8] MATADOR: intermittent 2wk on/off 優於連續；8 週為保守閾值
}

// Goal-Driven 模式的放寬限制（用於備賽選手，允許更激進的赤字）
const GOAL_DRIVEN = {
  MIN_CALORIES_MALE: 1200,        // 備賽極限：1200kcal（短期可承受）
  MIN_CALORIES_FEMALE: 1050,      // 女性備賽極限：1050kcal [9][10] 低於此荷爾蒙風險極高
  MAX_DEFICIT_KCAL: 750,          // 允許最大赤字到 750kcal（備賽期）
  EXTREME_DEFICIT_KCAL: 1000,     // 極端赤字（最後 3 週，自動警告）
  // ── 男性蛋白質依赤字深度分級 [1] Helms 2014: 赤字越大 → 蛋白質越高 ──
  PROTEIN_PER_KG_NORMAL: 2.3,    // normal 赤字：2.3 g/kg
  PROTEIN_PER_KG_AGGRESSIVE: 2.6, // aggressive：2.6 g/kg
  PROTEIN_PER_KG_EXTREME: 3.0,   // extreme：3.0 g/kg（接近 LBM 的 3.1 g/kg 上限）
  // ── 女性蛋白質分級 [6] Stokes 2018: 女性 1.6-2.2 g/kg 達最大效果，備賽上調 ──
  PROTEIN_PER_KG_NORMAL_FEMALE: 1.8,
  PROTEIN_PER_KG_AGGRESSIVE_FEMALE: 2.0,
  PROTEIN_PER_KG_EXTREME_FEMALE: 2.3,
  // ── 脂肪下限：[1] Helms 2014 + [9] Loucks 2003 ──
  MIN_FAT_PER_KG: 0.7,           // 男性備賽最低 0.7 g/kg
  MIN_FAT_PER_KG_FEMALE: 0.9,    // 女性備賽最低 0.9 g/kg（低於此月經功能風險增加）
  // [2] Garthe 2011: >1.4% → LBM 顯著損失；[1] Helms 2014: 建議 0.5-1.0%
  MAX_WEEKLY_LOSS_PCT: 1.2,       // goal-driven 放寬到 1.2%（1.0% 理想上限 + 備賽彈性）
}

// ── Athletic 模式營養常數 ──
// Reale et al. 2017 — "Fighting Weight" (chronic + acute weight loss protocols)
// Garthe et al. 2011 — Slow vs fast weight loss in athletes
// Thomas et al. 2016 — ACSM nutrition for athletes (carb guidelines)
// Artioli et al. 2016 — Rapid weight loss in combat sports
// Burke et al. 2011 — Carb loading for performance
const ATHLETIC_CUT = {
  // ── 慢性降重（備戰期，離秤重 >5 天）──
  // Reale 2017: combat sport athletes 0.5-1.0% BW/week
  // Garthe 2011: slower loss = better LBM preservation
  MAX_WEEKLY_LOSS_PCT: 1.0,           // 比健美 1.2% 保守（保護運動表現）
  CARB_FLOOR_TRAINING_PER_KG: 4.0,   // 訓練日碳水下限 g/kg（Thomas 2016: 3-5g/kg for moderate exercise）
  CARB_FLOOR_REST_PER_KG: 3.0,       // 休息日碳水下限

  // ── 急性降重（備戰期最後 5 天）──
  // Reale 2017: acute weight loss via low-residue diet + water manipulation
  ACUTE_DAYS: 5,                      // 進入急性期的天數閾值
  ACUTE_CARB_PER_KG: 2.0,            // 急性期碳水（最低可執行量）
  ACUTE_FIBER_MAX_G: 10,             // 低渣飲食（減少腸道殘留重量）
  ACUTE_WATER_LOADING_ML_KG: 100,    // Day 5-3: 水分超載 mL/kg
  ACUTE_WATER_CUT_ML_KG: 15,         // Day 1: 限水 mL/kg

  // ── 超補償期（秤重後 → 比賽前）──
  // Reale 2017 / Artioli 2016: rapid rehydration + glycogen supercompensation
  REBOUND_WATER_ML_PER_HOUR: 1500,   // 1-1.5L/hour rehydration rate
  REBOUND_CARB_SHORT_PER_KG_HR: 1.5, // <6h 窗口: g/kg/hour（液態碳水為主）
  REBOUND_CARB_MEDIUM_PER_KG: 8.0,   // 6-18h 窗口: g/kg total
  REBOUND_CARB_LONG_PER_KG: 10.0,    // 18-30h 窗口: g/kg total
  REBOUND_PROTEIN_PER_KG: 1.5,       // 低蛋白（不影響補碳速度）
  REBOUND_FAT_PER_KG: 0.5,           // 最低脂肪（不佔胃容量）
}

// 動態能量密度（取代靜態 7700 kcal/kg）
// [15] Hall 2008: 早期減重 ~3500 kcal/kg（含水分+glycogen），後期趨近 7700
// [11] Alpert 2005: 最大脂肪動員率 ~31 kcal/lb fat/day
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
  // 備賽後期代謝適應折扣 15-25% [7] Trexler 2014: adaptive thermogenesis
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

// ===== 基因修正層常數 =====
// 在計算完基礎巨量營養素後，依基因風險調整安全邊界
//
// 文獻依據：
// [G1] Wurtman RJ, Wurtman JJ (1995). Brain serotonin, carbohydrate-craving, obesity and depression.
//      Obes Res, 3 Suppl 4:477S-480S. → 低碳水 → 色胺酸進入大腦減少 → 血清素合成下降
// [G2] Gilbody S, Lightfoot T, Sheldon T (2007). Is low folate a risk factor for depression? A meta-analysis.
//      J Epidemiol Community Health, 61(7):631-637. → MTHFR 突變 → 葉酸代謝受損 → 憂鬱風險
// [G3] Minihane AM, et al. (2015). APOE genotype, cardiovascular risk and responsiveness to dietary fat
//      manipulation. Proc Nutr Soc, 66(2):183-197. → APOE4 攜帶者 LDL-C 對飽和脂肪敏感度 2-3 倍
const GENETIC = {
  // 憂鬱基因 → 碳水最低下限提高
  // [G1] 低碳水 → 血清素合成不足，憂鬱風險者更脆弱
  DEPRESSION_CARB_FLOOR_HIGH: 120,     // 高風險：最低 120g（正常人 50g）
  DEPRESSION_CARB_FLOOR_MODERATE: 100, // 中風險：最低 100g

  // MTHFR 突變 → 最大赤字收窄
  // [G2] 熱量赤字 → 飲食多樣性下降 → 天然葉酸攝取不足 → MTHFR 突變者甲基化崩潰
  MTHFR_DEFICIT_REDUCTION_HOMOZYGOUS: 150,  // 純合子：赤字縮小 150kcal
  MTHFR_DEFICIT_REDUCTION_HETEROZYGOUS: 100, // 雜合子：赤字縮小 100kcal

  // APOE4 → 飽和脂肪比例限制
  // [G3] APOE4 攜帶者對飽和脂肪敏感度是正常人 2-3 倍
  APOE4_SAT_FAT_PCT_CAP: 0.30,  // 飽和脂肪 ≤ 總脂肪的 30%（正常人無強制限制）

  // 憂鬱基因 + Peak Week 耗竭期 → 縮短/緩和
  // [G1] 碳水耗竭 → 腦部血清素急降 → 高風險者可能嚴重情緒崩潰
  DEPRESSION_DEPLETION_DAYS_HIGH: 2,        // SS 高風險：耗竭期從 4 天縮為 2 天
  DEPRESSION_DEPLETION_DAYS_MODERATE: 3,    // SL 中風險：耗竭期從 4 天縮為 3 天
  DEPRESSION_DEPLETION_CARB_HIGH: 2.0,      // SS：2.0 g/kg（最大保護，接受耗竭效果較差）
  DEPRESSION_DEPLETION_CARB_MODERATE: 1.5,  // SL：1.5 g/kg（平衡保護與耗竭效果）
  // 設計邏輯：各基因型的耗竭期總碳水攝取量趨近一致
  // LL: 1.1 × 4 days × 82kg = 361g  |  SL: 1.5 × 3 days × 82kg = 369g  |  SS: 2.0 × 2 days × 82kg = 328g
}

// 基因修正層：根據基因資料調整巨量營養素
// 在基礎計算完成後調用，修正 carbs / deficit / fat source
function applyGeneticCarbFloor(
  suggestedCarbs: number,
  geneticProfile: GeneticProfile | undefined,
  corrections: GeneticCorrection[],
): number {
  if (!geneticProfile) return suggestedCarbs

  // 1. 5-HTTLPR 血清素轉運體基因 → 碳水最低下限提高
  const serotoninRisk = getSerotoninRiskLevel(geneticProfile)
  const genotypeLabel = geneticProfile.serotonin ?? (serotoninRisk === 'high' ? 'SS' : serotoninRisk === 'moderate' ? 'SL' : null)

  if (serotoninRisk === 'high' && suggestedCarbs < GENETIC.DEPRESSION_CARB_FLOOR_HIGH) {
    corrections.push({
      gene: 'depression',
      rule: '碳水最低下限',
      adjustment: `5-HTTLPR ${genotypeLabel}（高風險）→ 碳水下限從 ${suggestedCarbs}g 提高至 ${GENETIC.DEPRESSION_CARB_FLOOR_HIGH}g，保護血清素合成`,
    })
    return GENETIC.DEPRESSION_CARB_FLOOR_HIGH
  }
  if (serotoninRisk === 'moderate' && suggestedCarbs < GENETIC.DEPRESSION_CARB_FLOOR_MODERATE) {
    corrections.push({
      gene: 'depression',
      rule: '碳水最低下限',
      adjustment: `5-HTTLPR ${genotypeLabel}（中風險）→ 碳水下限從 ${suggestedCarbs}g 提高至 ${GENETIC.DEPRESSION_CARB_FLOOR_MODERATE}g，保護血清素合成`,
    })
    return GENETIC.DEPRESSION_CARB_FLOOR_MODERATE
  }

  return suggestedCarbs
}

function getGeneticDeficitReduction(
  geneticProfile: GeneticProfile | undefined,
  corrections: GeneticCorrection[],
): number {
  if (!geneticProfile) return 0

  // 2. MTHFR 突變 → 赤字收窄（減少赤字 = 吃更多 = 飲食多樣性更高 = 葉酸攝取更足）
  if (geneticProfile.mthfr === 'homozygous') {
    corrections.push({
      gene: 'mthfr',
      rule: '最大赤字收窄',
      adjustment: `MTHFR 純合子突變 → 赤字縮小 ${GENETIC.MTHFR_DEFICIT_REDUCTION_HOMOZYGOUS}kcal，保護甲基化代謝`,
    })
    return GENETIC.MTHFR_DEFICIT_REDUCTION_HOMOZYGOUS
  }
  if (geneticProfile.mthfr === 'heterozygous') {
    corrections.push({
      gene: 'mthfr',
      rule: '最大赤字收窄',
      adjustment: `MTHFR 雜合子突變 → 赤字縮小 ${GENETIC.MTHFR_DEFICIT_REDUCTION_HETEROZYGOUS}kcal，保護甲基化代謝`,
    })
    return GENETIC.MTHFR_DEFICIT_REDUCTION_HETEROZYGOUS
  }

  return 0
}

function getApoe4FatWarnings(
  geneticProfile: GeneticProfile | undefined,
  corrections: GeneticCorrection[],
  warnings: string[],
): void {
  if (!geneticProfile) return

  // 3. APOE4 → 脂肪來源比例限制
  const isApoe4 = geneticProfile.apoe === 'e3/e4' || geneticProfile.apoe === 'e4/e4'
  if (isApoe4) {
    const severity = geneticProfile.apoe === 'e4/e4' ? '純合子' : '雜合子'
    corrections.push({
      gene: 'apoe4',
      rule: '脂肪來源比例限制',
      adjustment: `APOE4 ${severity} → 飽和脂肪應 ≤ 總脂肪的 30%，優先 MUFA/MCT`,
    })
    warnings.push(`🧬 APOE4（${severity}）：飽和脂肪應限制在總脂肪的 30% 以內，脂肪來源優先選擇橄欖油、酪梨、MCT oil（避免牛油、奶油、椰子油高飽和來源）`)
  }
}

// Peak Week 常數 [12] Escalante 2021 + [13] Barakat 2022 + [14] Homer/Helms 2024 + [15] Kistler 2024 narrative review
const PEAK_WEEK = {
  // 碳水耗竭期 (Day 7-4)：低碳 + 高脂補充肌內三酸甘油酯 (IMT)
  DEPLETION_CARB_G_PER_KG: 1.1,    // Barakat 2022: 1.0-1.2 g/kg
  DEPLETION_PROTEIN_G_PER_KG: 3.2,  // Barakat 2022: ~3.16 g/kg；高蛋白保護 LBM
  DEPLETION_FAT_G_PER_KG: 1.5,     // Barakat 2022: ~1.56 g/kg；高脂補 IMT（1.2-1.8 range）

  // 碳水超補期 (Day 3-2)
  // [15] Kistler 2024 review：建議範圍 3-12 g/kg，個體差異大
  // 基準值用 Homer 2024 的 9.0 g/kg（~80kg 受試者），但需依體重調整：
  // >90kg 選手絕對量過高（>810g）會造成 GI distress，需降低 g/kg
  LOADING_CARB_G_PER_KG: 9.0,      // 基準值（≤90kg），>90kg 由 generatePeakWeekPlan 動態降低
  LOADING_CARB_G_PER_KG_FEMALE: 6.5, // Tarnopolsky 1995, James 2001: 女性肌肉肝醣超補反應約為男性 50-70%
  LOADING_PROTEIN_G_PER_KG: 1.6,   // Escalante 2021: ~1.6 g/kg；降低蛋白為碳水騰空間，最大化肝醣超補
  LOADING_FAT_G_PER_KG: 0.65,      // 低脂最大化碳水吸收
  LOADING_FAT_G_PER_KG_FEMALE: 1.0, // 女性超補期脂肪不低於 1.0 g/kg（Loucks 2003: 雌激素合成需求）

  // Taper (Day 1)
  TAPER_CARB_G_PER_KG: 5.5,        // Barakat 2022: 5.46 g/kg（基準值，會隨 loadingCarb 等比調整）
  TAPER_CARB_G_PER_KG_FEMALE: 4.0, // 女性按超補比例等比縮減（6.5/9.0 × 5.5 ≈ 4.0）
  TAPER_PROTEIN_G_PER_KG: 2.8,
  TAPER_FAT_G_PER_KG: 1.1,         // 中等脂肪防止 IMT 流失

  // 比賽日
  SHOW_CARB_G_PER_KG: 2.0,         // 小餐維持；依視覺評估彈性調整
  SHOW_PROTEIN_G_PER_KG: 3.0,
  SHOW_FAT_G_PER_KG: 0.5,

  // 水分操控 — 多數自然選手策略：一開始中度灌水壓 ADH → 超補期拉到最高 → Day 1 驟降
  // ADH 被壓越久（6 天 vs 2 天），切水後身體繼續排水的窗口越大、效果越穩定
  // 搭配碳水對比（低→高）：碳水超補理論上把水拉進肌肉（肝醣滲透壓），皮下水繼續被排掉
  // ⚠️ [15] Kistler 2024 review 指出：先前 ICW/ECW 轉移的研究使用單頻 BIA，
  // 無法準確區分細胞內外水分（需多頻 BIA 或 BIS）。水分重分佈的方向可能正確，
  // 但精確機制尚未被 RCT 驗證。目前協議仍基於理論框架 + 實務經驗，非確定性證據。
  WATER_BASELINE: 75,      // Day 7-4：75 mL/kg（中度灌水，從 Day 7 就開始壓 ADH）
  WATER_LOADING: 100,      // Day 3-2：100 mL/kg（搭配碳水超補，最大化水分進入肌肉細胞）
  WATER_TAPER: 40,         // Day 1：40 mL/kg（從 100→40 = 急降 60%，ADH 壓了 6 天來不及回升）
  WATER_SHOW: 10,          // 比賽日：由時間軸協議控制（~800ml 總計），此值為 fallback

  // 鈉目標（mg/天）— 鈉跟著水走，水高鈉就高；避免稀釋性低血鈉
  // 耗竭期：低碳→胰島素低→腎臟排鈉增加 + 水量較高 → 鈉需 3000mg 以上
  SODIUM_BASELINE: 3000,     // 耗竭期（配合 75mL/kg 水量，Na/水比=400+mg/L，安全）
  SODIUM_LOADING: 3500,      // 超補期（SGLT-1 + 高碳水 → 鈉幫助葡萄糖+水進入肌肉細胞）
  SODIUM_SHOW: 1000,         // 比賽日由時間軸協議控制（集中在最後 1.5 小時）

  // 鉀離子目標（mg/天）— Barakat 2022: ~6246 mg/day during loading
  POTASSIUM_BASELINE: 3500,  // 正常飲食鉀攝取
  POTASSIUM_LOADING: 6000,   // 超補期加鉀促進水分進入肌肉細胞
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
    recoveryAssessment: null,
    bodyFatZoneInfo: null,
    labMacroModifiers: [], labTrainingModifiers: [], energyAvailability: null,
    deadlineInfo: null, autoApply: false, tdeeAnomalyDetected: false, peakWeekPlan: null,
    menstrualCycleNote: null,
    metabolicStress: null,
    perMealProteinGuide: null,
    geneticCorrections: [],
    ...overrides,
  }
}

// ===== 分餐蛋白質指引 helper =====
// Iraki et al. (2019): 每餐 0.40-0.55 g/kg，均勻分佈 3-6 餐
// 2024 更新（IJSNEM 2024 debate, Frontiers Nutrition 2024）：
// - 單餐蛋白質利用上限比過去認知更高（Trommelen 2023: 100g 單餐仍有合成效益）
// - 蛋白質分配可能沒有總攝取量重要，但均勻分佈仍建議作為實務最佳策略
// - 訓練前後進食仍有輕微優勢（窗口比過去認為的更寬，約 4-6 小時）
function buildPerMealProteinGuide(
  bodyWeight: number,
  totalProtein: number | null
): NutritionSuggestion['perMealProteinGuide'] {
  if (!totalProtein || totalProtein <= 0) return null
  const perMealMin = Math.round(bodyWeight * 0.40)
  const perMealMax = Math.round(bodyWeight * 0.55)
  // 從總蛋白質推算合理餐數：meals = totalProtein / perMealMid
  const perMealMid = (perMealMin + perMealMax) / 2
  const idealMeals = Math.round(totalProtein / perMealMid)
  const mealsMin = Math.max(3, Math.min(idealMeals - 1, 4))
  const mealsMax = Math.min(6, Math.max(idealMeals + 1, 4))
  return {
    perMealGrams: { min: perMealMin, max: perMealMax },
    mealsPerDay: { min: mealsMin, max: mealsMax },
    periWorkoutNote: '訓練前後各安排一餐（含足量蛋白質）。合成窗口約 4-6 小時，不需要急著在 30 分鐘內吃（Trommelen 2023）。總量比分配更重要，但均勻分佈仍是好習慣。',
  }
}

// ===== 體脂區間查詢 helper =====
// 將 NutritionInput 的性別轉換為 body-fat-zone-table 的 Gender，查出區間

function toZoneGender(gender: string): BFZGender {
  return gender === '男性' ? 'male' : 'female'
}

function buildBodyFatZoneInfo(
  gender: string,
  bodyFatPct: number | null | undefined,
  goalType: 'cut' | 'bulk' | 'recomp'
): NutritionSuggestion['bodyFatZoneInfo'] {
  // recomp 用 cut 的 zone specs（高蛋白、refeed 建議等）
  if (bodyFatPct == null || bodyFatPct <= 0) return null
  const zone = getBodyFatZone(toZoneGender(gender), bodyFatPct)
  if (!zone) return null
  const effectiveGoal = goalType === 'recomp' ? 'cut' : goalType
  const spec = effectiveGoal === 'cut' ? zone.cut : zone.bulk
  return {
    zoneId: zone.id,
    zoneLabel: zone.label,
    proteinPerKg: spec.proteinGPerKg,
    fatPerKg: spec.fatGPerKg,
    refeedFrequency: effectiveGoal === 'cut' ? zone.cut.refeedFrequency : null,
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
  carbBoostGPerKg: number   // 黃體期碳水增量 g/kg（0 = 非黃體期）
  amenorrheaWarning: string | null  // 閉經警告（>45 天未標記經期）
}

function checkMenstrualCycle(input: NutritionInput): MenstrualCycleInfo {
  const isFemale = input.gender === '女性'
  if (!isFemale) {
    return { inLutealPhase: false, daysSincePeriod: -1, note: null, carbBoostGPerKg: 0, amenorrheaWarning: null }
  }

  // 閉經偵測：女性但無經期紀錄
  // [10] Mountjoy 2018 (IOC RED-S): 閉經是 RED-S 最重要的臨床徵兆之一
  if (!input.lastPeriodDate) {
    return {
      inLutealPhase: false, daysSincePeriod: -1, note: null, carbBoostGPerKg: 0,
      amenorrheaWarning: '🩸 ⚠️ 尚未記錄任何經期資訊。如果月經已超過 45 天未來，可能是 RED-S（相對能量不足）的警訊，建議諮詢醫師並評估能量可用性。',
    }
  }

  const now = new Date()
  const periodDate = new Date(input.lastPeriodDate)
  const daysSince = Math.floor((now.getTime() - periodDate.getTime()) / (1000 * 60 * 60 * 24))

  // 閉經偵測：>45 天未標記經期 = 功能性下丘腦性閉經風險
  // [9] Loucks & Thuma 2003: EA < 30 kcal/kg FFM → LH 脈衝頻率下降 → 閉經
  // [10] Mountjoy 2018: 連續 3 個月無月經 = 閉經診斷標準；45 天為早期預警
  let amenorrheaWarning: string | null = null
  if (daysSince > 90) {
    amenorrheaWarning = `🩸 🚨 已超過 ${daysSince} 天未標記經期（>90 天）！這符合閉經診斷標準，是 RED-S 的嚴重警訊。建議立即增加熱量攝取、減少訓練量，並諮詢婦產科/內分泌科。`
  } else if (daysSince > 45) {
    amenorrheaWarning = `🩸 ⚠️ 已超過 ${daysSince} 天未標記經期。月經延遲可能是能量不足的早期信號（RED-S），請留意並考慮諮詢醫師。`
  }

  // 標準週期 ~28 天：卵泡期 day 1-14, 黃體期 day 15-28
  // 黃體期孕酮升高 → 水分滯留 → 體重假性上升
  const inLutealPhase = daysSince >= 14 && daysSince <= 30

  // 黃體期碳水增量：孕酮升高 → 碳水需求增加 ~0.5 g/kg
  // 文獻：Hackney 2012 (Br J Sports Med): 黃體期碳水氧化率增加 ~15-20%
  // Hulmi et al. 2017: 黃體期增加碳水可減緩訓練表現下降
  const carbBoostGPerKg = inLutealPhase ? 0.5 : 0

  let note: string | null = null
  if (inLutealPhase) {
    note = `🩸 目前處於黃體期（經期後第 ${daysSince} 天），體重可能因荷爾蒙導致 0.5-2kg 的水分滯留，屬於正常波動。系統已自動增加碳水 +${carbBoostGPerKg} g/kg 支持黃體期代謝需求。`
  } else if (daysSince >= 0 && daysSince <= 5) {
    note = `🩸 經期中（第 ${daysSince + 1} 天），體重可能略有波動，持續記錄即可。`
  }

  return { inLutealPhase, daysSincePeriod: daysSince, note, carbBoostGPerKg, amenorrheaWarning }
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

/**
 * assessCurrentState — 委託給 recovery-engine 進行統一恢復評估。
 * 保持原有回傳簽名以維持向後相容。
 */
function assessCurrentState(
  recentWellness: WellnessWithWearable[],
  recentTrainingLogs: { date: string; rpe: number | null }[]
): { state: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'; readinessScore: number | null; recoveryAssessment?: RecoveryAssessment } {
  // 數據不足時直接返回
  const hasWellness = recentWellness.some(w =>
    w.energy_level != null || w.training_drive != null ||
    w.device_recovery_score != null || w.resting_hr != null || w.hrv != null || w.wearable_sleep_score != null
  )
  const hasTraining = recentTrainingLogs.some(t => t.rpe != null)
  if (!hasWellness && !hasTraining) return { state: 'unknown', readinessScore: null }

  const assessment = generateRecoveryAssessment({
    wellness: recentWellness.map(w => ({
      date: w.date,
      energy_level: w.energy_level,
      training_drive: w.training_drive,
      device_recovery_score: w.device_recovery_score,
      resting_hr: w.resting_hr,
      hrv: w.hrv,
      wearable_sleep_score: w.wearable_sleep_score,
      respiratory_rate: w.respiratory_rate,
    })),
    trainingLogs: recentTrainingLogs.map(t => ({ date: t.date, rpe: t.rpe })),
  })

  return {
    state: assessment.state,
    readinessScore: assessment.readinessScore,
    recoveryAssessment: assessment,
  }
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

// ===== 代謝壓力分數（Metabolic Stress Score）=====
// 綜合多維度數據自動評估是否需要 refeed / diet break
// 分數 0-100：越高代表代謝壓力越大
// 文獻基礎：Trexler 2014 (intermittent dieting), Peos 2019 (diet break), Dirlewanger 2000 (leptin)

export interface MetabolicStressResult {
  score: number                    // 0-100 總分
  level: 'low' | 'moderate' | 'elevated' | 'high'  // 壓力等級
  recommendation: 'continue' | 'monitor' | 'refeed_1day' | 'refeed_2day' | 'diet_break'
  refeedCarbGPerKg: number | null  // 建議 refeed 碳水 g/kg（null = 不需要）
  breakdown: {
    dietDuration: number           // 0-25
    recovery: number               // 0-30
    plateau: number                // 0-20
    lowCarb: number                // 0-15
    wellnessTrend: number          // 0-10
    lutealBoost: number            // 0-10
  }
  reasons: string[]
}

/**
 * 代謝壓力綜合評分 (Metabolic Stress Score)
 *
 * 五維度加權評估，自動判斷 refeed / diet break 時機：
 *   1. 飲食持續時間 (0-25) — [7] Trexler 2014: 持續限制加劇代謝適應
 *   2. 恢復狀態 (0-30)     — [10] RED-S: 低 EA 影響多系統恢復
 *   3. 體重停滯 (0-20)     — [8] MATADOR: 停滯是代謝適應的外顯指標
 *   4. 連續低碳天數 (0-15) — [7] Trexler 2014 + Kose 2024: 碳水不足 → T3 降幅達 34.6% + leptin 下降
 *   5. 主觀趨勢下滑 (0-10) — wellness tracking (能量、訓練動力)
 *
 * 建議閾值：≥60 diet break/2-day refeed, ≥45 1-day refeed, ≥30 monitor
 * Refeed 碳水量 4-5 g/kg — [12] Escalante 2021, [3] Roberts 2020
 */
export function calculateMetabolicStressScore(params: {
  dietDurationWeeks: number | null
  recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
  readinessScore: number | null
  weeklyChangeRate: number           // % per week
  consecutivePlateauWeeks: number    // 連續停滯週數
  lowCarbDays: number                // 連續低碳天數
  recentWellness?: { energy_level: number | null; training_drive: number | null }[]  // 最近 7 天
  daysUntilCompetition?: number | null
  bodyFatZoneRefeedFreq?: string | null  // 來自 body-fat-zone-table
  bodyWeight?: number                // 用於 refeed 碳水體重區間調整
  inLutealPhase?: boolean            // 女性黃體期：碳水氧化率 +15-20%，更適合安排 refeed
}): MetabolicStressResult {
  const reasons: string[] = []

  // 1. 飲食持續時間 (0-25)
  // 4 週以下 = 0, 4-6 週 = 5-10, 6-8 週 = 10-15, 8-12 週 = 15-20, 12+ 週 = 25
  const weeks = params.dietDurationWeeks ?? 0
  let dietDuration = 0
  if (weeks >= 12) { dietDuration = 25; reasons.push(`已連續減脂 ${weeks} 週（代謝適應風險高）`) }
  else if (weeks >= 8) { dietDuration = 15 + Math.round((weeks - 8) / 4 * 5); reasons.push(`已連續減脂 ${weeks} 週`) }
  else if (weeks >= 6) { dietDuration = 10 + Math.round((weeks - 6) / 2 * 5) }
  else if (weeks >= 4) { dietDuration = 5 + Math.round((weeks - 4) / 2 * 5) }

  // 2. 恢復狀態 (0-30)
  let recovery = 0
  if (params.recoveryState === 'critical') { recovery = 30; reasons.push('恢復狀態極差（critical）') }
  else if (params.recoveryState === 'struggling') { recovery = 20; reasons.push('恢復狀態偏低（struggling）') }
  else if (params.recoveryState === 'good') { recovery = 5 }
  else if (params.recoveryState === 'optimal') { recovery = 0 }
  else {
    // unknown → 用 readinessScore fallback
    if (params.readinessScore != null) {
      if (params.readinessScore < 30) { recovery = 25; reasons.push(`恢復分數偏低（${params.readinessScore}）`) }
      else if (params.readinessScore < 50) { recovery = 15 }
      else { recovery = 5 }
    } else {
      recovery = 10  // 沒有任何恢復數據 → 給中等分數（保守）
    }
  }

  // 3. 體重停滯 (0-20)
  let plateau = 0
  if (params.consecutivePlateauWeeks >= 3) { plateau = 20; reasons.push(`連續 ${params.consecutivePlateauWeeks} 週停滯`) }
  else if (params.consecutivePlateauWeeks >= 2) { plateau = 14; reasons.push(`連續 2 週停滯`) }
  else if (params.consecutivePlateauWeeks >= 1) { plateau = 7 }

  // 4. 連續低碳天數 (0-15)
  let lowCarb = 0
  if (params.lowCarbDays >= 7) { lowCarb = 15; reasons.push(`已連續 ${params.lowCarbDays} 天低碳（<150g）`) }
  else if (params.lowCarbDays >= 5) { lowCarb = 10; reasons.push(`已連續 ${params.lowCarbDays} 天低碳`) }
  else if (params.lowCarbDays >= 3) { lowCarb = 5 }

  // 5. 主觀趨勢下滑 (0-10)
  let wellnessTrend = 0
  if (params.recentWellness && params.recentWellness.length >= 4) {
    const recent = params.recentWellness.slice(0, 7)
    const energies = recent.map(w => w.energy_level).filter((e): e is number => e != null)
    const drives = recent.map(w => w.training_drive).filter((d): d is number => d != null)
    if (energies.length >= 3) {
      const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length
      if (avgEnergy <= 2.0) { wellnessTrend += 5; reasons.push(`近期能量偏低（平均 ${avgEnergy.toFixed(1)}/5）`) }
      else if (avgEnergy <= 2.5) { wellnessTrend += 3 }
    }
    if (drives.length >= 3) {
      const avgDrive = drives.reduce((a, b) => a + b, 0) / drives.length
      if (avgDrive <= 2.0) { wellnessTrend += 5; reasons.push(`訓練動力偏低（平均 ${avgDrive.toFixed(1)}/5）`) }
      else if (avgDrive <= 2.5) { wellnessTrend += 2 }
    }
  }

  // 6. 黃體期加分 (0-10)
  // Hackney 2012: 黃體期碳水氧化率增加 15-20%，是安排 refeed 的最佳時機
  // 黃體期 refeed 可同時緩解 PMS 症狀和代謝壓力
  let lutealBoost = 0
  if (params.inLutealPhase) {
    lutealBoost = 10
    reasons.push('黃體期碳水需求增加（孕酮升高 → 碳水氧化率 +15-20%），適合安排 Refeed')
  }

  const score = dietDuration + recovery + plateau + lowCarb + wellnessTrend + lutealBoost

  // 判斷等級和建議
  let level: MetabolicStressResult['level']
  let recommendation: MetabolicStressResult['recommendation']
  let refeedCarbGPerKg: number | null = null

  // 備賽模式：≤7 天不建議 refeed（交給 Peak Week），但仍回報分數
  const nearCompetition = params.daysUntilCompetition != null && params.daysUntilCompetition <= 7

  // Refeed 碳水依體重區間調整（較重者絕對碳水較多但 g/kg 略低，較輕者 g/kg 略高）
  // 文獻：Roberts 2020: refeed carbs 4-8 g/kg，Escalante 2021: 8-12 g/kg for peak week
  // 體重 <60kg → +0.5 g/kg, 60-80kg → 基準, >80kg → -0.5 g/kg, >100kg → -1.0 g/kg
  const bwTierAdjust = params.bodyWeight != null
    ? (params.bodyWeight < 60 ? 0.5 : params.bodyWeight > 100 ? -1.0 : params.bodyWeight > 80 ? -0.5 : 0)
    : 0

  if (score >= 60) {
    level = 'high'
    if (nearCompetition) {
      recommendation = 'monitor'  // Peak Week 接管
      reasons.push('代謝壓力高，但已進入 Peak Week 範圍，由 Peak Week 計畫接管')
    } else if (weeks >= 12) {
      recommendation = 'diet_break'
      refeedCarbGPerKg = Math.round((5.0 + bwTierAdjust) * 10) / 10
      reasons.push(`建議安排 3-5 天 diet break（維持熱量 + 碳水 ${refeedCarbGPerKg}g/kg）`)
    } else {
      recommendation = 'refeed_2day'
      refeedCarbGPerKg = Math.round((5.0 + bwTierAdjust) * 10) / 10
      reasons.push(`建議 2 天 full refeed（碳水 ${refeedCarbGPerKg}g/kg，脂肪壓低）`)
    }
  } else if (score >= 45) {
    level = 'elevated'
    if (nearCompetition) {
      recommendation = 'monitor'
    } else {
      recommendation = 'refeed_1day'
      refeedCarbGPerKg = Math.round((4.0 + bwTierAdjust) * 10) / 10
      reasons.push(`建議 1 天 strategic refeed（碳水 ${refeedCarbGPerKg}g/kg）`)
    }
  } else if (score >= 30) {
    level = 'moderate'
    recommendation = 'monitor'
    if (reasons.length === 0) reasons.push('代謝壓力中等，持續監控')
  } else {
    level = 'low'
    recommendation = 'continue'
  }

  return {
    score,
    level,
    recommendation,
    refeedCarbGPerKg,
    breakdown: { dietDuration, recovery, plateau, lowCarb, wellnessTrend, lutealBoost: lutealBoost || 0 },
    reasons,
  }
}

// ===== 減脂就緒閘門 =====
// 綜合血檢（荷爾蒙）+ 穿戴裝置 + 恢復狀態，判斷是否適合開始/繼續減脂
// 閘門擋住時，引擎強制恢復飲食而非減脂

interface CuttingReadinessResult {
  blocked: boolean
  reasons: string[]
  labFlags: string[]
  recommendation: string
  readinessScore: number  // 0-100
}

function checkCuttingReadiness(
  input: NutritionInput,
  recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown',
  deviceReadiness: number | null,
  metabolicStress: MetabolicStressResult | null,
): CuttingReadinessResult {
  const reasons: string[] = []
  const labFlags: string[] = []
  let score = 100 // 從滿分開始扣

  const isMale = input.gender === '男性'
  const labs = input.labResults || []

  // --- 1. 血檢荷爾蒙指標 ---
  const findLab = (keywords: string[]) =>
    labs.find(l => keywords.some(k => l.test_name.toLowerCase().includes(k)) && l.value != null)

  // 睪固酮（男性）
  if (isMale) {
    const testo = findLab(['testosterone', '睪固酮', '睪酮'])
    if (testo && testo.value != null) {
      if (testo.value < 300) {
        score -= 30
        reasons.push(`🔴 睪固酮極低（${testo.value} ng/dL，安全值 ≥400）— 不適合減脂`)
        labFlags.push(`睪固酮 ${testo.value} ng/dL`)
      } else if (testo.value < 400) {
        score -= 15
        reasons.push(`🟡 睪固酮偏低（${testo.value} ng/dL，建議 ≥400 再開始減脂）`)
        labFlags.push(`睪固酮 ${testo.value} ng/dL`)
      }
    }

    const freeT = findLab(['free t', 'free testosterone', '游離睪固酮'])
    if (freeT && freeT.value != null && freeT.value < 47) {
      score -= 10
      reasons.push(`🟡 游離睪固酮偏低（${freeT.value} pg/mL）`)
      labFlags.push(`游離睪固酮 ${freeT.value} pg/mL`)
    }
  }

  // 皮質醇
  const cortisol = findLab(['cortisol', '皮質醇', '可體松'])
  if (cortisol && cortisol.value != null) {
    if (cortisol.value > 25) {
      score -= 20
      reasons.push(`🔴 皮質醇過高（${cortisol.value} μg/dL，安全值 ≤18）— 身體處於高壓狀態，減脂會加劇肌肉流失`)
      labFlags.push(`皮質醇 ${cortisol.value} μg/dL`)
    } else if (cortisol.value > 20) {
      score -= 10
      reasons.push(`🟡 皮質醇偏高（${cortisol.value} μg/dL）— 建議先恢復再減脂`)
      labFlags.push(`皮質醇 ${cortisol.value} μg/dL`)
    }
  }

  // 甲狀腺（TSH + Free T4 聯合判斷）
  const tsh = findLab(['tsh', '促甲狀腺'])
  const freeT4 = findLab(['free t4', 'ft4', '游離甲狀腺素'])
  if (tsh && tsh.value != null && tsh.value > 4.0) {
    score -= 15
    reasons.push(`🟡 TSH 偏高（${tsh.value}）— 甲狀腺功能低下，代謝率降低，不適合加深赤字`)
    labFlags.push(`TSH ${tsh.value}`)
  }
  if (freeT4 && freeT4.value != null && freeT4.value < 1.0) {
    score -= 10
    reasons.push(`🟡 Free T4 偏低（${freeT4.value}）— 甲狀腺輸出不足`)
    labFlags.push(`Free T4 ${freeT4.value}`)
  }
  // TSH + Free T4 聯合：代謝低下模式
  if (tsh?.value != null && tsh.value > 3.5 && freeT4?.value != null && freeT4.value < 1.0) {
    score -= 10  // 額外扣分
    reasons.push('🔴 TSH↑ + Free T4↓ = 甲狀腺代謝低下模式，必須先恢復碳水攝取')
  }

  // CRP（發炎指標）
  const crp = findLab(['crp', 'c-reactive', 'c反應蛋白'])
  if (crp && crp.value != null && crp.value > 3.0) {
    score -= 10
    reasons.push(`🟡 CRP 偏高（${crp.value}）— 系統性發炎，需先消炎再減脂`)
    labFlags.push(`CRP ${crp.value}`)
  }

  // 鐵蛋白
  const ferritin = findLab(['ferritin', '鐵蛋白'])
  if (ferritin && ferritin.value != null && ferritin.value < 30) {
    score -= 10
    reasons.push(`🟡 鐵蛋白偏低（${ferritin.value}）— 攜氧能力下降，有氧表現和恢復受影響`)
    labFlags.push(`鐵蛋白 ${ferritin.value}`)
  }

  // --- 2. 交叉模式偵測（RED-S / 過度訓練）---
  if (labs.length > 0) {
    const crossPatterns = detectLabCrossPatterns(
      labs.map(l => ({ test_name: l.test_name, value: l.value ?? 0, unit: l.unit, status: l.status })),
      { gender: input.gender as '男性' | '女性', bodyFatPct: input.bodyFatPct }
    )
    for (const pattern of crossPatterns) {
      if (pattern.pattern === 'red_s_risk') {
        score -= 25
        reasons.push(`🚨 RED-S 風險偵測 — ${pattern.description}`)
      }
      if (pattern.pattern === 'overtraining_risk') {
        score -= 20
        reasons.push(`🚨 過度訓練風險 — ${pattern.description}`)
      }
    }
  }

  // --- 3. 穿戴裝置恢復狀態 ---
  if (deviceReadiness != null && deviceReadiness < 40) {
    score -= 15
    reasons.push(`🟡 穿戴裝置恢復分數偏低（${deviceReadiness}/100）— 身體尚未恢復`)
  }
  if (recoveryState === 'critical') {
    score -= 20
    reasons.push('🔴 恢復狀態：危險 — 神經/肌肉/代謝系統尚未恢復')
  } else if (recoveryState === 'struggling') {
    score -= 10
    reasons.push('🟡 恢復狀態：偏差 — 建議先恢復 1-2 週再開始減脂')
  }

  // --- 4. 代謝壓力 ---
  if (metabolicStress && metabolicStress.score >= 60) {
    score -= 15
    reasons.push(`🟡 代謝壓力分數偏高（${metabolicStress.score}/100）— 荷爾蒙和代謝率可能已受壓`)
  }

  score = Math.max(0, Math.min(100, score))

  // 閘門判定：分數 < 50 → 擋住
  const blocked = score < 50

  let recommendation = ''
  if (blocked) {
    if (labFlags.length > 0) {
      recommendation = `建議先以維持量 + 微盈餘進食 2-4 週，等荷爾蒙指標改善後再開始減脂。異常指標：${labFlags.join('、')}。`
    } else {
      recommendation = '建議先以維持量進食 1-2 週，讓身體從上一階段恢復，再開始新的減脂週期。'
    }
  }

  return { blocked, reasons, labFlags, recommendation, readinessScore: score }
}

// ===== Refeed 觸發判斷 =====
// 向後相容：原有 refeed 判斷（仍用於 reactive 模式）
// Goal-Driven 模式改用 calculateMetabolicStressScore()

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
    recoveryAssessment: stateResult.recoveryAssessment ?? null,
  }

  // 月經週期判斷（女性專用）
  const cycleInfo = checkMenstrualCycle(input)

  // 閉經警告加入 warnings（RED-S 早期預警）
  if (cycleInfo.amenorrheaWarning) {
    warnings.push(cycleInfo.amenorrheaWarning)
  }

  // Refeed 警告加入 warnings（讓前端顯示）
  if (refeedTrigger.suggested && refeedTrigger.reason) {
    warnings.push(`🔄 系統偵測：可考慮安排 ${refeedTrigger.days} 天 Refeed：${refeedTrigger.reason}`)
  } else if (refeedTrigger.reason && !refeedTrigger.suggested) {
    // 狀態差但低碳天數不足（不強制 Refeed，僅提醒）
    warnings.push(`⚠️ 注意狀態：${refeedTrigger.reason}（低碳天數未達 3 天，持續觀察）`)
  }

  // 0. Peak Week 偵測：備賽客戶距比賽 ≤14 天自動產生 Peak Week 計畫
  // 不再需要 prepPhase，只要有 targetDate + 距比賽夠近即可
  // daysLeft <= 8：完整啟用 Peak Week（autoApply + 回傳 peak_week status）
  // 8 < daysLeft <= 14：產生 peakWeekPlan 供前端預覽，營養建議走正常流程
  // daysLeft < 0：比賽已結束 → 進入賽後恢復模式（不再卡在 Day 0）
  // Fix #4: prepPhase === 'recovery' 也可觸發賽後恢復，即使沒有 targetDate
  if (!input.targetDate && input.prepPhase === 'recovery') {
    const bw = input.bodyWeight
    const estimatedMaintenance = Math.round(bw * 33)
    const recoveryCals = estimatedMaintenance  // 1.0x（無法確定天數，預設 Phase 1）
    const recoveryProtein = Math.round(bw * 2.2)
    const recoveryFat = Math.round(bw * 1.0)
    const recoveryCarbs = Math.round((recoveryCals - recoveryProtein * 4 - recoveryFat * 9) / 4)
    const recoveryWater = Math.round(bw * 40)
    return {
      status: 'on_track' as const,
      statusLabel: '賽後恢復',
      statusEmoji: '🔄',
      message: `目前為賽後恢復期（反向飲食 Phase 1）。無比賽日期記錄，使用預設恢復策略：維持量進食，漸進提升熱量。建議教練設定比賽日期以啟用精確恢復計畫。`,
      warnings: [
        '🔄 賽後恢復期：優先恢復腸胃功能和荷爾蒙平衡',
        '⚠️ 避免暴食 — 比賽後 leptin 急降，飢餓感會很強，用高蛋白+高纖維穩定食慾',
        `📈 目前恢復倍率 ×1.0（維持量 ${estimatedMaintenance} → ${recoveryCals} kcal）`,
        '🍽️ 以維持量進食，避免高脂高糖，讓腸胃重新適應正常食物量',
      ],
      suggestedCalories: recoveryCals,
      suggestedProtein: recoveryProtein,
      suggestedCarbs: Math.max(recoveryCarbs, 150),
      suggestedFat: recoveryFat,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE: estimatedMaintenance, weeklyWeightChangeRate: 0,
      dietDurationWeeks: 0, dietBreakSuggested: false,
      bodyFatZoneInfo: null,
      labMacroModifiers: [], labTrainingModifiers: [], energyAvailability: null,
      deadlineInfo: null,
      autoApply: true, tdeeAnomalyDetected: false,
      peakWeekPlan: null, metabolicStress: null,
      menstrualCycleNote: null,
      perMealProteinGuide: buildPerMealProteinGuide(bw, recoveryProtein),
      geneticCorrections: [],
      postCompetitionRecovery: true,
      recoveryWater,
      ...stateFields,
    }
  }

  let previewPeakWeekPlan: PeakWeekDay[] | null = null
  if (input.targetDate) {
    // 統一使用 UTC+8（台北時區）計算天數，與 todayStr 一致
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000)
    const nowTWDate = new Date(nowTW.toISOString().split('T')[0]) // UTC+8 的午夜
    const target = new Date(input.targetDate) // DB DATE 欄位 = UTC midnight
    const rawDaysLeft = Math.round((target.getTime() - nowTWDate.getTime()) / (1000 * 60 * 60 * 24))

    // 比賽已結束 → 賽後恢復模式（rawDaysLeft < 0 = 比賽日已過）
    if (rawDaysLeft < 0) {
      const daysSinceComp = Math.abs(rawDaysLeft)
      // 賽後恢復：漸進式提升熱量，避免暴食反彈
      // 第 1-3 天：維持量 ×1.0（腸胃重新適應）
      // 第 4-7 天：維持量 ×1.1（逐步提升）
      // 第 8+ 天：維持量 ×1.2（正常反向飲食起點）
      const recoveryMultiplier = daysSinceComp <= 3 ? 1.0 : daysSinceComp <= 7 ? 1.1 : 1.2
      const bw = input.bodyWeight
      const estimatedMaintenance = Math.round(bw * 33) // 粗估維持量
      const recoveryCals = Math.round(estimatedMaintenance * recoveryMultiplier)
      const recoveryProtein = Math.round(bw * 2.2)
      const recoveryFat = Math.round(bw * 1.0)
      const recoveryCarbs = Math.round((recoveryCals - recoveryProtein * 4 - recoveryFat * 9) / 4)

      const recoveryWater = Math.round(bw * 40) // 恢復期正常水量 40ml/kg
      return {
        status: 'on_track' as const,
        statusLabel: '賽後恢復',
        statusEmoji: '🔄',
        message: `比賽已結束 ${daysSinceComp} 天。目前為賽後恢復期（反向飲食 Phase ${daysSinceComp <= 3 ? 1 : daysSinceComp <= 7 ? 2 : 3}），漸進提升熱量避免暴食反彈。建議教練設定新的目標或清除比賽日期。`,
        warnings: [
          '🔄 賽後恢復期：優先恢復腸胃功能和荷爾蒙平衡',
          '⚠️ 避免暴食 — 比賽後 leptin 急降，飢餓感會很強，用高蛋白+高纖維穩定食慾',
          `📈 目前恢復倍率 ×${recoveryMultiplier}（維持量 ${estimatedMaintenance} → ${recoveryCals} kcal）`,
          ...(daysSinceComp <= 3 ? ['🍽️ 第 1-3 天：以維持量進食，避免高脂高糖，讓腸胃重新適應正常食物量'] : []),
          ...(daysSinceComp > 3 && daysSinceComp <= 7 ? ['🍽️ 第 4-7 天：每日增加 100-150kcal，以碳水為主（恢復肝醣和代謝率）'] : []),
          ...(daysSinceComp > 7 ? ['🍽️ 第 8+ 天：進入正式反向飲食，每週增加 100-200kcal 直到新維持量'] : []),
        ],
        suggestedCalories: recoveryCals,
        suggestedProtein: recoveryProtein,
        suggestedCarbs: Math.max(recoveryCarbs, 150), // 恢復期碳水不低於 150g
        suggestedFat: recoveryFat,
        suggestedCarbsTrainingDay: null,
        suggestedCarbsRestDay: null,
        caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
        estimatedTDEE: estimatedMaintenance, weeklyWeightChangeRate: 0,
        dietDurationWeeks: 0, dietBreakSuggested: false,
        bodyFatZoneInfo: null,
        labMacroModifiers: [], labTrainingModifiers: [], energyAvailability: null,
        deadlineInfo: null,
        autoApply: true, tdeeAnomalyDetected: false,
        peakWeekPlan: null, metabolicStress: null,
        menstrualCycleNote: null,
        perMealProteinGuide: buildPerMealProteinGuide(bw, recoveryProtein),
        geneticCorrections: [],
        postCompetitionRecovery: true, // 標記讓 API route 重設 water_target
        recoveryWater,
        ...stateFields, // 包含 refeedSuggested, refeedReason, refeedDays, currentState, readinessScore 等
      }
    }

    const daysLeft = Math.max(0, rawDaysLeft)

    // Athletic 模式：秤重日 / 超補償期直接走專用引擎
    if (input.clientMode === 'athletic') {
      if (input.prepPhase === 'weigh_in') {
        return { ...generateAthleticWeighIn(input), ...stateFields }
      }
      if (input.prepPhase === 'rebound') {
        return { ...generateAthleticRebound(input.bodyWeight, input.gender, input.weighInGapHours ?? 24), ...stateFields }
      }
      // Fix #3: 運動員比賽日營養處理
      if (input.prepPhase === 'competition') {
        return { ...generateAthleticCompetition(input), ...stateFields }
      }
    }

    // Peak Week 自動偵測 — 僅 bodybuilding，athletic 不適用
    if (input.clientMode !== 'athletic') {
      if (daysLeft <= 7) {
        return { ...generatePeakWeekPlan(input, daysLeft, cycleInfo), ...stateFields }
      }
      if (daysLeft <= 14) {
        previewPeakWeekPlan = generatePeakWeekPlan(input, 7, cycleInfo).peakWeekPlan
      }
    }
  }

  // 1. 檢查數據是否足夠
  // Goal-Driven（有目標體重+日期）或備賽客戶（有 prepPhase）只需 1 週
  // 用本週均值複製為 lastWeek（weeklyChangeRate = 0），讓引擎能跑
  const hasGoalOrPrep = !!(input.targetWeight && input.targetDate) || !!input.prepPhase
  if (input.weeklyWeights.length < 2) {
    if (input.weeklyWeights.length === 1 && hasGoalOrPrep) {
      input.weeklyWeights.push({ week: 1, avgWeight: input.weeklyWeights[0].avgWeight })
    } else {
      return emptyResult({
        status: 'insufficient_data', statusLabel: '數據不足', statusEmoji: '📊',
        message: '需要至少 2 週的體重數據才能開始分析。請讓學員持續記錄體重。',
        ...stateFields,
      })
    }
  }

  // 2. 合規率低時加入警告，但不阻擋引擎運作（體重是最真實的指標）
  if (input.nutritionCompliance < 70) {
    warnings.push(`飲食合規率 ${input.nutritionCompliance}%，提高記錄完整度可提升分析準確性`)
  }

  // 3. 計算週均體重變化率
  let thisWeekAvg = input.weeklyWeights[0].avgWeight
  const lastWeekAvg = input.weeklyWeights[1].avgWeight

  // 黃體期體重修正：黃體期水分滯留 0.5-2kg 會汙染週均值
  // 修正策略：如果本週處於黃體期，將本週均值向下修正 1kg（保守估計）
  // 這樣可以避免：(1) 假性停滯 (2) 假性反彈 (3) 觸發不必要的赤字加深
  // 文獻：Matton et al. 2005, White et al. 2011 — 黃體期水分滯留中位數 ~1kg
  if (cycleInfo.inLutealPhase && input.gender === '女性') {
    thisWeekAvg = Math.round((thisWeekAvg - 1.0) * 100) / 100  // 向下修正 1kg
  }

  const weeklyChange = thisWeekAvg - lastWeekAvg  // kg
  const weeklyChangeRate = lastWeekAvg > 0 ? (weeklyChange / lastWeekAvg) * 100 : 0  // %

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

  // 6b. 異常值安全檢查：校正幅度超過 15% 時標記需人工確認
  const TDEE_ADJUSTMENT_THRESHOLD = 0.15
  let tdeeAnomalyDetected = false
  if (formulaTDEE && adaptiveTDEE != null && estimatedTDEE != null) {
    const adjustmentRatio = (estimatedTDEE - formulaTDEE) / formulaTDEE
    if (Math.abs(adjustmentRatio) > TDEE_ADJUSTMENT_THRESHOLD) {
      tdeeAnomalyDetected = true
      const direction = adjustmentRatio > 0 ? '高' : '低'
      const diffPct = Math.round(Math.abs(adjustmentRatio) * 100)
      warnings.push(`🔍 系統偵測到 TDEE 校正幅度異常（比公式估算${direction} ${diffPct}%），建議諮詢教練確認`)
    }
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

    // Peak Week 體重三層拆分（備賽 + 減脂模式）— 僅 bodybuilding，athletic 不適用
    // [14] Homer/Helms 2024: 水分操控可減 ~1.5-3% BW；取 2% 為保守估計
    // [12] Escalante 2021: depletion → loading → taper → show day
    if (input.prepPhase && input.goalType === 'cut' && daysLeft > 7 && input.clientMode !== 'athletic') {
      const waterCutPct = 0.02  // 預設 2%，保守估計 [14]
      const peakWeekExpectedLoss = Math.round(thisWeekAvg * waterCutPct * 10) / 10
      const prePeakEntryWeight = Math.round((input.targetWeight! + peakWeekExpectedLoss) * 10) / 10
      const dietWeightToLose = Math.round((thisWeekAvg - prePeakEntryWeight) * 10) / 10

      deadlineInfo.peakWeekWaterCutPct = waterCutPct
      deadlineInfo.prePeakEntryWeight = prePeakEntryWeight
      deadlineInfo.dietWeightToLose = Math.max(0, dietWeightToLose)
      deadlineInfo.peakWeekExpectedLoss = peakWeekExpectedLoss

      // 用飲食目標重算 requiredRate（排除 Peak Week 可處理的部分）
      if (dietWeightToLose > 0 && dietWeightToLose < weightToLose) {
        const prePeakDays = Math.max(1, daysLeft - 7)  // 扣掉 Peak Week 7 天
        const adjustedWeeksLeft = Math.max(0.5, prePeakDays / 7)
        deadlineInfo.weightToLose = Math.round(dietWeightToLose * 10) / 10
        deadlineInfo.requiredRatePerWeek = Math.round((dietWeightToLose / adjustedWeeksLeft) * 100) / 100
        deadlineInfo.isAggressive = Math.abs(dietWeightToLose / adjustedWeeksLeft) > maxSafeRate
      }
    }

    if (deadlineInfo.isAggressive) {
      warnings.push(`需要每週 ${input.goalType === 'cut' ? '減' : '增'} ${Math.abs(deadlineInfo.requiredRatePerWeek).toFixed(2)}kg 才能達標，超過安全範圍（${maxSafeRate.toFixed(1)}kg/週）`)
    }
  }

  // 8. 計算代謝壓力分數
  // 計算連續停滯週數
  // 連續停滯週數計算
  // 黃體期修正：如果 week 0（本週）在黃體期，不計入停滯判定
  // 原因：黃體期水分滯留會讓體重看起來沒掉，但實際脂肪仍在流失
  let consecutivePlateauWeeks = 0
  if (input.weeklyWeights.length >= 2) {
    const skipWeek0 = cycleInfo.inLutealPhase && input.gender === '女性'
    const startIdx = skipWeek0 ? 1 : 0

    for (let i = startIdx; i < input.weeklyWeights.length - 1; i++) {
      const wAvg = input.weeklyWeights[i].avgWeight
      const wPrev = input.weeklyWeights[i + 1].avgWeight
      const rate = ((wAvg - wPrev) / wPrev) * 100
      if (input.goalType === 'cut' && rate >= CUT_TARGETS.MAX_RATE) {
        consecutivePlateauWeeks++
      } else if (input.goalType === 'bulk' && rate <= BULK_TARGETS.MIN_RATE) {
        consecutivePlateauWeeks++
      } else {
        break
      }
    }
  }

  const metabolicStress = calculateMetabolicStressScore({
    dietDurationWeeks,
    recoveryState: currentState,
    readinessScore,
    weeklyChangeRate,
    consecutivePlateauWeeks,
    lowCarbDays,
    recentWellness: input.recentWellness,
    daysUntilCompetition: daysToTarget,
    bodyFatZoneRefeedFreq: buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType)?.refeedFrequency ?? null,
    bodyWeight: input.bodyWeight,
    inLutealPhase: cycleInfo.inLutealPhase,
  })

  // 代謝壓力警告
  if (metabolicStress.level === 'high' || metabolicStress.level === 'elevated') {
    for (const reason of metabolicStress.reasons) {
      if (!warnings.some(w => w.includes(reason))) {
        warnings.push(`🔥 代謝壓力${metabolicStress.level === 'high' ? '高' : '偏高'}（${metabolicStress.score}/100）：${reason}`)
      }
    }
  }

  // 8a-2. 補品依從性 → 回饋迴圈
  // 若補品吃了 8 週但相關血檢指標未改善 → 升級警告
  if (input.supplementCompliance && input.labResults) {
    const { rate, weeksDuration, supplements } = input.supplementCompliance
    if (rate >= 0.8 && weeksDuration >= 8) {
      // 檢查鐵相關補品 + 鐵蛋白未改善
      const hasIronSupplement = (supplements || []).some(s =>
        s.toLowerCase().includes('鐵') || s.toLowerCase().includes('iron')
      )
      const lowFerritin = input.labResults.find(l =>
        (l.test_name.includes('鐵蛋白') || l.test_name.toLowerCase().includes('ferritin')) &&
        l.status !== 'normal' && l.value != null
      )
      if (hasIronSupplement && lowFerritin) {
        warnings.push(`🔄 補品回饋：已服用鐵劑 ${weeksDuration} 週（依從率 ${Math.round(rate * 100)}%），但鐵蛋白仍偏低（${lowFerritin.value}）。建議：1) 確認劑型（螯合鐵吸收率更高）2) 搭配維生素C 3) 避免與咖啡/茶同服 4) 若持續未改善請就醫排查吸收問題`)
      }

      // 檢查維生素D補品 + 維D未改善
      const hasVitDSupplement = (supplements || []).some(s =>
        s.includes('維生素D') || s.includes('D3') || s.toLowerCase().includes('vitamin d')
      )
      const lowVitD = input.labResults.find(l =>
        (l.test_name.includes('維生素D') || l.test_name.toLowerCase().includes('vitamin d')) &&
        l.status !== 'normal' && l.value != null
      )
      if (hasVitDSupplement && lowVitD) {
        warnings.push(`🔄 補品回饋：已服用維生素D ${weeksDuration} 週（依從率 ${Math.round(rate * 100)}%），但血清值仍偏低（${lowVitD.value}）。建議：1) 確認劑量是否足夠（建議 2000-5000 IU/day）2) 搭配脂肪餐服用以提高吸收 3) 若持續未改善請就醫`)
      }
    }

    // 低依從率警告
    if (rate < 0.5 && weeksDuration >= 4) {
      warnings.push(`💊 補品依從率偏低（${Math.round(rate * 100)}%），效果可能大打折扣。建議設定每日提醒或將補品放在固定位置。`)
    }
  }

  // 8b. 血檢 → 巨量營養素修正
  const labModResult = input.labResults
    ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: input.bodyWeight })
    : { macroModifiers: [], trainingModifiers: [], warnings: [], carbCycleMultiplier: 1.5 }
  for (const w of labModResult.warnings) {
    if (!warnings.includes(w)) warnings.push(w)
  }

  // 8c. 訓練量 → TDEE 修正
  // RPE × duration × frequency 影響實際能量消耗
  // 高訓練量（RPE≥8, >60min, ≥5x/week）→ TDEE +5-10%
  // 低訓練量（RPE≤5, <30min, ≤2x/week）→ TDEE -5%
  if (input.recentTrainingVolume && estimatedTDEE) {
    const vol = input.recentTrainingVolume
    const avgRPE = vol.avgRPE ?? 6
    const avgDur = vol.avgDurationMin ?? 45
    const freq = vol.sessionsPerWeek
    // 訓練負荷指數 = RPE × duration(hr) × frequency
    const loadIndex = avgRPE * (avgDur / 60) * freq
    // 基準：RPE 7 × 1hr × 4x/week = 28
    if (loadIndex > 40) {
      const boost = Math.min(0.10, (loadIndex - 28) / 280)
      estimatedTDEE = Math.round(estimatedTDEE * (1 + boost))
      warnings.push(`🏋️ 訓練量偏高（RPE ${avgRPE}×${avgDur}min×${freq}次/週），TDEE 已上調 +${Math.round(boost * 100)}%`)
    } else if (loadIndex < 15 && freq >= 1) {
      estimatedTDEE = Math.round(estimatedTDEE * 0.95)
      warnings.push(`💤 訓練量偏低，TDEE 已下調 -5%`)
    }
  }

  // 8d. Energy Availability (RED-S) 檢查
  // EA = (dietary intake - exercise expenditure) / FFM
  // < 30 kcal/kg FFM/day → 荷爾蒙功能臨界閾值 (Loucks & Thuma 2003)
  // < 25 kcal/kg FFM/day → 嚴重風險 (Mountjoy et al. 2018)
  let energyAvailability: NutritionSuggestion['energyAvailability'] = null
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    const ffm = input.bodyWeight * (1 - input.bodyFatPct / 100)
    const intake = input.avgDailyCalories ?? input.currentCalories ?? 0
    // 估算運動消耗：training days × ~400-600 kcal per session / 7
    const exerciseKcal = input.recentTrainingVolume
      ? (input.recentTrainingVolume.avgRPE ?? 6) * (input.recentTrainingVolume.avgDurationMin ?? 45) * 0.12 * input.recentTrainingVolume.sessionsPerWeek / 7
      : input.trainingDaysPerWeek * 450 / 7
    const eaValue = ffm > 0 ? (intake - exerciseKcal) / ffm : 0
    const eaRounded = Math.round(eaValue * 10) / 10

    if (eaRounded < 25) {
      energyAvailability = {
        eaKcalPerKgFFM: eaRounded,
        level: 'critical',
        warning: `🚨 能量可用性極低（${eaRounded} kcal/kg FFM/day，臨界值 30）！RED-S 風險：可能影響荷爾蒙、骨密度、免疫力。建議立即增加熱量攝取或減少運動量。`,
      }
      warnings.push(energyAvailability.warning!)
    } else if (eaRounded < 30) {
      energyAvailability = {
        eaKcalPerKgFFM: eaRounded,
        level: 'low',
        warning: `⚠️ 能量可用性偏低（${eaRounded} kcal/kg FFM/day，建議 >30）：長期可能影響荷爾蒙和恢復。`,
      }
      warnings.push(energyAvailability.warning!)
    } else {
      energyAvailability = {
        eaKcalPerKgFFM: eaRounded,
        level: 'adequate',
        warning: null,
      }
    }
  }

  // 8c. 減脂就緒閘門：血檢 + 穿戴裝置 + 恢復狀態綜合評估
  // 如果荷爾蒙指標太差，強制進入恢復模式而非減脂
  const cuttingGate = checkCuttingReadiness(input, currentState, readinessScore, metabolicStress)

  if (cuttingGate.blocked && (input.goalType === 'cut' || input.goalType === 'recomp')) {
    // 閘門擋住 → 強制恢復飲食，不走減脂引擎
    const bw = input.bodyWeight
    const estimatedMaintenance = estimatedTDEE || Math.round(bw * 33)
    const recoveryCals = Math.round(estimatedMaintenance * 1.05) // 微盈餘幫助荷爾蒙恢復
    const recoveryProtein = Math.round(bw * 2.2)
    const recoveryFat = Math.round(bw * 1.0)
    const recoveryCarbs = Math.max(150, Math.round((recoveryCals - recoveryProtein * 4 - recoveryFat * 9) / 4))

    warnings.push(...cuttingGate.reasons)
    return {
      status: 'on_track' as const,
      statusLabel: '荷爾蒙恢復期',
      statusEmoji: '🛡️',
      message: `系統偵測到你的身體指標尚未從上一階段恢復。${cuttingGate.recommendation}`,
      warnings,
      suggestedCalories: recoveryCals,
      suggestedProtein: recoveryProtein,
      suggestedCarbs: recoveryCarbs,
      suggestedFat: recoveryFat,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      caloriesDelta: 0, proteinDelta: 0, carbsDelta: 0, fatDelta: 0,
      estimatedTDEE: estimatedMaintenance, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks: 0, dietBreakSuggested: false,
      bodyFatZoneInfo: zoneInfo,
      labMacroModifiers: labModResult.macroModifiers,
      labTrainingModifiers: labModResult.trainingModifiers,
      energyAvailability,
      deadlineInfo: null,
      autoApply: true, tdeeAnomalyDetected: false,
      peakWeekPlan: null, metabolicStress,
      menstrualCycleNote: cycleInfo.note,
      perMealProteinGuide: buildPerMealProteinGuide(bw, recoveryProtein),
      geneticCorrections: [],
      cuttingReadinessGate: cuttingGate,
      ...stateFields,
    }
  }

  // 9. 根據目標類型分流
  const extraFields = {
    metabolicStress, tdeeAnomalyDetected,
    labMacroModifiers: labModResult.macroModifiers, labTrainingModifiers: labModResult.trainingModifiers,
    energyAvailability,
    cuttingReadinessGate: cuttingGate.blocked ? cuttingGate : null,
  }
  let result: NutritionSuggestion
  if (input.goalType === 'cut' || input.goalType === 'recomp') {
    // recomp 用 cut 引擎（微赤字 + 高蛋白），但赤字幅度較小
    result = { ...generateCutSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings, cycleInfo, currentState), ...stateFields, ...extraFields }
  } else {
    result = { ...generateBulkSuggestion(input, weeklyChangeRate, estimatedTDEE, dietDurationWeeks, deadlineInfo, warnings, cycleInfo, currentState), ...stateFields, ...extraFields }
  }

  // 9.5 Peak Week 預覽計畫注入（距比賽 >8 天時提前生成供預覽）
  if (previewPeakWeekPlan) {
    result.peakWeekPlan = previewPeakWeekPlan
  }

  // 10. TDEE 異常 → 關閉 autoApply（數據不可信，需教練確認）
  if (tdeeAnomalyDetected && result.autoApply) {
    result.autoApply = false
    result.warnings.push('🔍 TDEE 校正幅度異常，已暫停自動套用，需教練確認後手動調整')
  }

  // 11. 建議值二次 EA 驗證：用引擎建議的熱量重算 EA
  if (input.bodyFatPct != null && input.bodyFatPct > 0 && result.suggestedCalories != null) {
    const ffm = input.bodyWeight * (1 - input.bodyFatPct / 100)
    const exerciseKcal = input.recentTrainingVolume
      ? (input.recentTrainingVolume.avgRPE ?? 6) * (input.recentTrainingVolume.avgDurationMin ?? 45) * 0.12 * input.recentTrainingVolume.sessionsPerWeek / 7
      : input.trainingDaysPerWeek * 450 / 7
    const suggestedEA = ffm > 0 ? (result.suggestedCalories - exerciseKcal) / ffm : 0
    const suggestedEARounded = Math.round(suggestedEA * 10) / 10

    // 更新 energyAvailability 為建議值的 EA（而非現有攝入的 EA）
    if (suggestedEARounded < 25) {
      result.energyAvailability = {
        eaKcalPerKgFFM: suggestedEARounded,
        level: 'critical',
        warning: `🚨 建議熱量下 EA 僅 ${suggestedEARounded} kcal/kg FFM/day（臨界值 30）！RED-S 風險。`,
      }
    } else if (suggestedEARounded < 30) {
      result.energyAvailability = {
        eaKcalPerKgFFM: suggestedEARounded,
        level: 'low',
        warning: `⚠️ 建議熱量下 EA 偏低（${suggestedEARounded} kcal/kg FFM/day，建議 >30）。`,
      }
    } else {
      result.energyAvailability = {
        eaKcalPerKgFFM: suggestedEARounded,
        level: 'adequate',
        warning: null,
      }
    }
  }

  return result
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
  const zoneInfo = buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType)

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
          // 恢復極佳 + 停滯 → 不應只是砍更多（懲罰恢復好的人）
          // 策略：適度減脂肪（保護碳水），同時建議增加訓練量利用好的恢復狀態
          status = 'plateau'
          statusLabel = '停滯期'
          statusEmoji = '🟡'
          calDelta = -125; carbDelta = 0; fatDelta = -14
          message = `體重停滯（${weeklyChangeRate.toFixed(2)}%/週），恢復狀態極佳！策略：保留碳水支撐訓練表現，從脂肪微降突破停滯，並建議增加訓練量或強度來擴大消耗。`
          warnings.push('💪 恢復極佳是優勢：優先用增加訓練量/強度來突破停滯，而非一味減卡。碳水保留有助維持訓練品質和代謝率。')
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

  // 黃體期調整（女性專用）
  // [Hackney 2012] 黃體期碳水氧化率 +15-20%，BMR 升高 5-10% (Webb 1986)
  // 1. 碳水增量 +0.5g/kg 支持代謝需求
  // 2. 赤字縮小 ~100kcal 避免黃體期被放在過深的赤字裡
  if (cycleInfo.carbBoostGPerKg > 0) {
    const lutealCarbBoost = Math.round(bw * cycleInfo.carbBoostGPerKg)
    carbDelta += lutealCarbBoost
    calDelta += lutealCarbBoost * 4 // 碳水 4 kcal/g
    // 黃體期 BMR 升高約 5-10%（Webb 1986），若不補回會造成實際赤字過深
    // 額外補回 100kcal（全碳水），與碳水增量合計約 250kcal 的緩衝
    const lutealDeficitBuffer = 100
    calDelta += lutealDeficitBuffer
    carbDelta += Math.round(lutealDeficitBuffer / 4)
  }

  let suggestedCal = currentCal + calDelta
  let suggestedPro = currentPro  // 蛋白質永遠不降
  let suggestedCarb = currentCarb + carbDelta
  let suggestedFat = currentFat + fatDelta

  // 安全底線檢查（有體脂區間時用 zone 值，否則 fallback 原本男女固定值）
  const proteinPerKgFloor = zoneInfo
    ? zoneInfo.proteinPerKg
    : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE)
  const minProtein = Math.round(bw * proteinPerKgFloor)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${proteinPerKgFloor}g/kg${zoneInfo ? `，${zoneInfo.zoneLabel}區間` : ''}）`)
  }

  const fatPerKgFloor = zoneInfo
    ? zoneInfo.fatPerKg
    : (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)
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
    // 已有碳循環值 → 增量調整
    const tdChange = Math.round(carbDelta * CARB_CYCLE_TRAINING_RATIO)
    const rdChange = carbDelta - tdChange
    suggestedCarbsTD = input.currentCarbsTrainingDay + tdChange
    suggestedCarbsRD = input.currentCarbsRestDay + rdChange
    if (suggestedCarbsRD < 30) {
      suggestedCarbsRD = 30
      warnings.push('休息日碳水已觸及最低值 30g')
    }
  } else if (input.carbsCyclingEnabled && suggestedCarb >= 50) {
    // 碳循環啟用但尚無分配值 → 首次從平均碳水分配
    // 優先用血檢 → 沒血檢時用恢復分數當代理指標
    const cutLabMods = input.labResults
      ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
      : null
    let ccm = cutLabMods?.carbCycleMultiplier ?? 1.5
    if (ccm === 1.5 && recoveryState !== 'unknown') {
      if (recoveryState === 'optimal') ccm = 1.7
      else if (recoveryState === 'struggling' || recoveryState === 'critical') ccm = 1.3
    }
    const T = Math.min(Math.max(input.trainingDaysPerWeek, 4), 6)
    const R = 7 - T
    suggestedCarbsRD = Math.round((suggestedCarb * 7) / (ccm * T + R))
    suggestedCarbsTD = Math.round(suggestedCarbsRD * ccm)
    if (suggestedCarbsRD < 30) suggestedCarbsRD = 30
  }

  // 注意：Deadline-aware 的緊急加速已由 Goal-Driven 引擎處理（weightToLose > 0 時自動進入）
  // Reactive 模式僅處理無目標體重或已達標的情況

  if (status === 'on_track' && calDelta === 0 && carbDelta === 0) {
    // 進度正常 → 根據當前體重重新計算最佳巨量營養素分配
    // 體重變化時蛋白質/碳水/脂肪的最佳 per-kg 值也會跟著變
    const proteinPerKgOT = zoneInfo
      ? zoneInfo.proteinPerKg
      : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE)
    const fatPerKgOT = zoneInfo
      ? zoneInfo.fatPerKg
      : (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)

    // 重算蛋白質：取 per-kg 底線和現有值的較大值
    let recalcPro = Math.max(Math.round(bw * proteinPerKgOT), currentPro)
    // 重算脂肪：取 per-kg 底線和現有值的較大值
    let recalcFat = Math.max(Math.round(bw * fatPerKgOT), currentFat)

    // 如果有 TDEE，根據目標卡路里重算碳水（卡路里 - 蛋白質 - 脂肪 = 碳水）
    let recalcCarb = currentCarb
    if (currentCal > 0) {
      const proCalories = recalcPro * 4
      const fatCalories = recalcFat * 9
      const remainingForCarbs = currentCal - proCalories - fatCalories
      if (remainingForCarbs > 0) {
        recalcCarb = Math.max(50, Math.round(remainingForCarbs / 4))
      }
    }

    // 基因修正
    const otGeneticCorrections: GeneticCorrection[] = []
    getGeneticDeficitReduction(input.geneticProfile, otGeneticCorrections)
    recalcCarb = applyGeneticCarbFloor(recalcCarb, input.geneticProfile, otGeneticCorrections)
    getApoe4FatWarnings(input.geneticProfile, otGeneticCorrections, warnings)

    // 血檢修正
    let otLabMacroModifiers: LabMacroModifier[] = []
    let otLabTrainingModifiers: LabTrainingModifier[] = []
    if (input.labResults) {
      const labMods = getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
      otLabMacroModifiers = labMods.macroModifiers
      otLabTrainingModifiers = labMods.trainingModifiers
      for (const mod of labMods.macroModifiers) {
        if (mod.nutrient === 'protein' && mod.direction === 'increase') recalcPro += mod.delta
        if (mod.nutrient === 'carbs' && mod.direction === 'decrease') recalcCarb = Math.max(50, recalcCarb - mod.delta)
        if (mod.nutrient === 'carbs' && mod.direction === 'increase') recalcCarb += mod.delta
        if (mod.nutrient === 'fat' && mod.direction === 'decrease') recalcFat = Math.max(Math.round(bw * (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)), recalcFat - mod.delta)
        if (mod.nutrient === 'fat' && mod.direction === 'increase') recalcFat += mod.delta
      }
    }

    // on_track 碳循環也要套用血檢碳水修正（不能原封不動 pass through）
    let otCarbsTD = input.currentCarbsTrainingDay ?? null
    let otCarbsRD = input.currentCarbsRestDay ?? null
    if (otLabMacroModifiers.length > 0 && otCarbsTD != null && otCarbsRD != null) {
      for (const mod of otLabMacroModifiers) {
        if (mod.nutrient === 'carbs' && mod.direction === 'decrease') {
          otCarbsTD = Math.max(30, otCarbsTD - mod.delta)
          otCarbsRD = Math.max(30, otCarbsRD - mod.delta)
        }
        if (mod.nutrient === 'carbs' && mod.direction === 'increase') {
          otCarbsTD += mod.delta
          otCarbsRD += mod.delta
        }
      }
    }

    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: currentCal, suggestedProtein: recalcPro,
      suggestedCarbs: recalcCarb, suggestedFat: recalcFat,
      suggestedCarbsTrainingDay: otCarbsTD,
      suggestedCarbsRestDay: otCarbsRD,
      caloriesDelta: 0, proteinDelta: recalcPro - currentPro,
      carbsDelta: recalcCarb - currentCarb, fatDelta: recalcFat - currentFat,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested, warnings,
      currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
      bodyFatZoneInfo: zoneInfo,
      labMacroModifiers: otLabMacroModifiers, labTrainingModifiers: otLabTrainingModifiers, energyAvailability: null,
      deadlineInfo, autoApply: true, tdeeAnomalyDetected: false, peakWeekPlan: null, metabolicStress: null,
      menstrualCycleNote: cycleInfo.note,
      perMealProteinGuide: buildPerMealProteinGuide(bw, recalcPro),
      geneticCorrections: otGeneticCorrections,
    }
  }

  // 套用血檢巨量營養素修正到建議值
  let mainLabMacroModifiers: LabMacroModifier[] = []
  let mainLabTrainingModifiers: LabTrainingModifier[] = []
  if (input.labResults) {
    const labMods = getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
    mainLabMacroModifiers = labMods.macroModifiers
    mainLabTrainingModifiers = labMods.trainingModifiers
    for (const mod of labMods.macroModifiers) {
      if (mod.nutrient === 'protein' && mod.direction === 'increase') suggestedPro += mod.delta
      if (mod.nutrient === 'carbs' && mod.direction === 'decrease') {
        suggestedCarb = Math.max(50, suggestedCarb - mod.delta)
        // Bug 5 fix: 碳循環 TD/RD 也要同步套用血檢碳水修正
        if (suggestedCarbsTD != null) suggestedCarbsTD = Math.max(30, suggestedCarbsTD - mod.delta)
        if (suggestedCarbsRD != null) suggestedCarbsRD = Math.max(30, suggestedCarbsRD - mod.delta)
      }
      if (mod.nutrient === 'carbs' && mod.direction === 'increase') {
        suggestedCarb += mod.delta
        if (suggestedCarbsTD != null) suggestedCarbsTD += mod.delta
        if (suggestedCarbsRD != null) suggestedCarbsRD += mod.delta
      }
      if (mod.nutrient === 'fat' && mod.direction === 'decrease') suggestedFat = Math.max(Math.round(bw * (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)), suggestedFat - mod.delta)
      if (mod.nutrient === 'fat' && mod.direction === 'increase') suggestedFat += mod.delta
      if (mod.nutrient === 'calories' && mod.direction === 'increase') suggestedCal += mod.delta
    }
  }

  // 基因修正層（Reactive 模式）
  const geneticCorrections: GeneticCorrection[] = []
  suggestedCarb = applyGeneticCarbFloor(suggestedCarb, input.geneticProfile, geneticCorrections)
  // 碳循環拆分後，休息日碳水也要套用基因下限（5-HTTLPR SL/SS）
  if (suggestedCarbsRD != null) {
    suggestedCarbsRD = applyGeneticCarbFloor(suggestedCarbsRD, input.geneticProfile, geneticCorrections)
  }
  getApoe4FatWarnings(input.geneticProfile, geneticCorrections, warnings)

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
    bodyFatZoneInfo: zoneInfo,
    labMacroModifiers: mainLabMacroModifiers, labTrainingModifiers: mainLabTrainingModifiers, energyAvailability: null,
    deadlineInfo, autoApply: true, tdeeAnomalyDetected: false, peakWeekPlan: null, metabolicStress: null,
    menstrualCycleNote: cycleInfo.note,
    geneticCorrections,
    perMealProteinGuide: buildPerMealProteinGuide(bw, Math.round(suggestedPro)),
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
  const zoneInfo = buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType)
  const targetWeight = input.targetWeight!
  const daysLeft = deadlineInfo.daysLeft
  const weightToLose = deadlineInfo.weightToLose  // kg, positive = need to lose (已含 Peak Week 拆分)
  // Peak Week 拆分時，達標比較對象是 PW 入場體重（而非上台體重）
  const effectiveTarget = deadlineInfo.prePeakEntryWeight ?? targetWeight

  // 1. 計算需要的每日赤字（使用動態能量密度）
  const energyDensity = getEnergyDensity(daysLeft, dietDurationWeeks)
  const totalDeficitNeeded = weightToLose * energyDensity  // kcal total
  const requiredDailyDeficit = Math.round(totalDeficitNeeded / daysLeft)
  const requiredWeeklyLoss = weightToLose / (daysLeft / 7)
  const weeklyLossPct = (requiredWeeklyLoss / bw) * 100

  // 2. 減速上限：cap 赤字在安全範圍（MAX_WEEKLY_LOSS_PCT）
  // 超過此上限 → 不再加深赤字，改標記不可行
  // Athletic 模式使用更保守的 1.0% BW/week（Reale 2017, Garthe 2011）
  const isAthleticPrep = input.clientMode === 'athletic' && input.prepPhase === 'preparation'
  const maxWeeklyLossPct = isAthleticPrep ? ATHLETIC_CUT.MAX_WEEKLY_LOSS_PCT : GOAL_DRIVEN.MAX_WEEKLY_LOSS_PCT
  const maxSafeWeeklyLoss = bw * maxWeeklyLossPct / 100
  const maxSafeDailyDeficit = Math.round((maxSafeWeeklyLoss * energyDensity) / 7)
  let goalInfeasible = false
  if (requiredDailyDeficit > maxSafeDailyDeficit) {
    goalInfeasible = true
    warnings.push(`🚫 需要每週減 ${requiredWeeklyLoss.toFixed(2)}kg（${weeklyLossPct.toFixed(1)}% BW），超過安全上限 ${maxWeeklyLossPct}%。系統已將赤字鎖定在安全上限，建議與教練討論延長時程或調整目標體重`)
  }
  // 實際赤字不超過安全上限
  const cappedDailyDeficit = Math.min(requiredDailyDeficit, maxSafeDailyDeficit)

  // 2b. 判斷安全等級（用 capped 後的赤字）
  let safetyLevel: 'normal' | 'aggressive' | 'extreme'
  if (cappedDailyDeficit <= SAFETY.MAX_DEFICIT_KCAL) {
    safetyLevel = 'normal'
  } else if (cappedDailyDeficit <= GOAL_DRIVEN.MAX_DEFICIT_KCAL) {
    safetyLevel = 'aggressive'
  } else {
    safetyLevel = 'extreme'
  }

  // 3. 進度超前檢測
  let aheadOfSchedule = false
  let effectiveDailyDeficit = cappedDailyDeficit

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

  // 3.6 黃體期赤字緩衝（女性專用）
  // Webb 1986: 黃體期 BMR +5-10%，不補回等於實際赤字更深
  // Hackney 2012: 碳水氧化率 +15-20%，碳水需求增加
  let lutealDeficitAdjust = 0
  if (cycleInfo.inLutealPhase) {
    lutealDeficitAdjust = -100  // 縮小赤字 100kcal（碳水補回）
    warnings.push('🩸 黃體期 BMR 升高約 5-10%，系統已自動縮小赤字 100kcal（碳水補回），避免實際赤字過深。')
  }

  // 3.7 基因修正：MTHFR 突變 → 赤字收窄（保護甲基化代謝）
  const geneticCorrections: GeneticCorrection[] = []
  const geneticDeficitReduction = getGeneticDeficitReduction(input.geneticProfile, geneticCorrections)
  if (geneticDeficitReduction > 0) {
    warnings.push(`🧬 ${geneticCorrections[geneticCorrections.length - 1].adjustment}`)
  }

  effectiveDailyDeficit = Math.max(0, effectiveDailyDeficit + recoveryDeficitAdjust + lutealDeficitAdjust - geneticDeficitReduction)

  // 計算目標每日卡路里（用放鬆後的赤字）
  let targetCalories = Math.round(estimatedTDEE - effectiveDailyDeficit)

  // 4. 安全底線 + 巨量營養素（先算，因為有氧需要知道真實卡路里底線）
  // 備賽選手（有 prepPhase）才允許放寬到 GOAL_DRIVEN 極限，一般學員仍用 SAFETY 底線
  const isCompetitionPrep = !!input.prepPhase
  const absoluteMinCal = isMale
    ? (isCompetitionPrep ? GOAL_DRIVEN.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_MALE)
    : (isCompetitionPrep ? GOAL_DRIVEN.MIN_CALORIES_FEMALE : SAFETY.MIN_CALORIES_FEMALE)
  const softMinCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE

  // 巨量營養素分配
  // 有體脂區間 → 用 zone table 的蛋白質值作為 baseline（取 zone 與 safety level 較高者）
  // 無體脂區間 → fallback 到原本的 性別 + 赤字深度 分級
  const fallbackProteinPerKg = isMale
    ? (safetyLevel === 'extreme' ? GOAL_DRIVEN.PROTEIN_PER_KG_EXTREME
        : safetyLevel === 'aggressive' ? GOAL_DRIVEN.PROTEIN_PER_KG_AGGRESSIVE
        : GOAL_DRIVEN.PROTEIN_PER_KG_NORMAL)
    : (safetyLevel === 'extreme' ? GOAL_DRIVEN.PROTEIN_PER_KG_EXTREME_FEMALE
        : safetyLevel === 'aggressive' ? GOAL_DRIVEN.PROTEIN_PER_KG_AGGRESSIVE_FEMALE
        : GOAL_DRIVEN.PROTEIN_PER_KG_NORMAL_FEMALE)
  // 有體脂區間時：取 zone 建議和 safety-level fallback 的較高者
  const proteinPerKg = zoneInfo
    ? Math.max(zoneInfo.proteinPerKg, fallbackProteinPerKg)
    : fallbackProteinPerKg

  // 脂肪：有體脂區間 → zone 值，否則 fallback
  const fallbackFatPerKg = isMale
    ? (safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG)
    : (safetyLevel === 'extreme' ? GOAL_DRIVEN.MIN_FAT_PER_KG_FEMALE : SAFETY.MIN_FAT_PER_KG_FEMALE)
  const minFatPerKg = zoneInfo
    ? Math.max(zoneInfo.fatPerKg, fallbackFatPerKg)
    : fallbackFatPerKg

  let suggestedPro = Math.round(bw * proteinPerKg)
  // 減脂/備賽期間：保護現有蛋白質不被引擎降低（教練設定或先前計算的值）
  // 上限 3.3g/kg 避免異常高值永久鎖定；卡路里壓縮仍可在下方降低蛋白質
  if ((input.goalType === 'cut' || input.goalType === 'recomp') && input.currentProtein && input.currentProtein > suggestedPro) {
    const maxReasonable = Math.round(bw * 3.3)
    suggestedPro = Math.min(input.currentProtein, maxReasonable)
  }
  let suggestedFat = Math.round(bw * minFatPerKg)

  // 血檢驅動巨量營養素修正（ApoB、鐵蛋白、胰島素等）
  // Goal-Driven 也需要套用，不能只靠 reactive 路徑
  const gdLabModResult = input.labResults
    ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
    : null
  const gdMacroMods = gdLabModResult?.macroModifiers ?? []
  let gdCarbDeltaFromLab = 0
  let gdCalDeltaFromLab = 0
  let gdProDeltaFromLab = 0
  for (const mod of gdMacroMods) {
    if (mod.nutrient === 'protein' && mod.direction === 'increase') { suggestedPro += mod.delta; gdProDeltaFromLab += mod.delta }
    if (mod.nutrient === 'fat' && mod.direction === 'decrease') suggestedFat = Math.max(Math.round(bw * (isMale ? GOAL_DRIVEN.MIN_FAT_PER_KG : GOAL_DRIVEN.MIN_FAT_PER_KG_FEMALE)), suggestedFat - mod.delta)
    if (mod.nutrient === 'fat' && mod.direction === 'increase') suggestedFat += mod.delta
    if (mod.nutrient === 'carbs' && mod.direction === 'decrease') gdCarbDeltaFromLab -= mod.delta
    if (mod.nutrient === 'carbs' && mod.direction === 'increase') gdCarbDeltaFromLab += mod.delta
    if (mod.nutrient === 'calories' && mod.direction === 'increase') gdCalDeltaFromLab += mod.delta
  }
  // Bug 3 fix: TSH > 4.0 等血檢熱量修正，直接加到 targetCalories
  if (gdCalDeltaFromLab > 0) {
    targetCalories += gdCalDeltaFromLab
  }

  // 計算蛋白質+脂肪的最低卡路里（碳水底線 30g = 120kcal）
  let proFatCal = suggestedPro * 4 + suggestedFat * 9
  const carbFloorCal = 30 * 4  // 120 kcal

  // 如果蛋白質+脂肪+碳水底線 > targetCalories → 需要砍巨量營養素
  // 優先級：碳水先壓底線 → 降脂肪 → 最後降蛋白質
  // 女性脂肪壓縮底線比男性高（0.7g/kg vs 0.5g/kg），保護荷爾蒙
  if (proFatCal + carbFloorCal > targetCalories) {
    // 先降脂肪到絕對底線（使用 GOAL_DRIVEN 常數：男 0.7g/kg，女 0.9g/kg）
    // 如果血檢有 fat increase modifier（如 ApoB 優秀），底線要加上 lab delta，
    // 否則「可放寬」只是空話，數字根本沒變
    const labFatIncrease = gdMacroMods
      .filter(m => m.nutrient === 'fat' && m.direction === 'increase')
      .reduce((sum, m) => sum + m.delta, 0)
    const absoluteMinFat = Math.round(bw * (isMale ? GOAL_DRIVEN.MIN_FAT_PER_KG : GOAL_DRIVEN.MIN_FAT_PER_KG_FEMALE)) + labFatIncrease
    suggestedFat = absoluteMinFat
    proFatCal = suggestedPro * 4 + suggestedFat * 9

    if (proFatCal + carbFloorCal > targetCalories) {
      // 再降蛋白質（不低於 2.0g/kg + 血檢增量，如低鐵蛋白/低白蛋白）
      const maxProCal = targetCalories - carbFloorCal - suggestedFat * 9
      const minPro = Math.round(bw * 2.0) + gdProDeltaFromLab
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

  // 碳水 = 剩餘卡路里（若 proFatCal > targetCalories，剩餘為負，碳水壓底線 30g）
  const remainingCalForCarb = targetCalories - proFatCal
  let suggestedCarb = Math.max(30, Math.round(remainingCalForCarb / 4))

  // Bug 1 fix: 套用血檢碳水修正（HOMA-IR、胰島素、三酸甘油脂等）
  if (gdCarbDeltaFromLab !== 0) {
    suggestedCarb = Math.max(30, suggestedCarb + gdCarbDeltaFromLab)
  }

  // 反算「真實卡路里底線」— 這才是選手實際能吃到的最低值
  let actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)

  // 安全上限保護：如果蛋白質+脂肪底線強制最低值導致 actualCalories > targetCalories
  // 代表 targetCalories 極低，此時尊重營養底線但發出警告
  if (actualCalories > targetCalories && proFatCal + carbFloorCal > targetCalories) {
    warnings.push(`⚠️ 蛋白質+脂肪底線（${proFatCal}kcal）+ 碳水底線（${carbFloorCal}kcal）= ${proFatCal + carbFloorCal}kcal 已超過目標 ${targetCalories}kcal，實際最低攝取 ${actualCalories}kcal`)
  }

  // 安全底線保護：如果 macro compression 後仍低於 absoluteMinCal → 把碳水補回來
  // 蛋白質和脂肪已是壓縮後的最低值，多出來的空間全給碳水（碳水是最先被犧牲的）
  if (actualCalories < absoluteMinCal) {
    const prevCalories = actualCalories
    const extraCal = absoluteMinCal - actualCalories
    suggestedCarb += Math.round(extraCal / 4)
    actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)
    warnings.push(`⚠️ 巨量營養素底線 ${prevCalories}kcal 低於安全線 ${absoluteMinCal}kcal，已增加碳水至 ${suggestedCarb}g（${actualCalories}kcal）`)
  }

  // EA 安全閥：建議熱量不能讓 EA < 30 kcal/kg FFM/day
  // 如果有體脂率，計算建議熱量下的 EA，若低於 30 則往上拉
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    const ffm = bw * (1 - input.bodyFatPct / 100)
    const exerciseKcal = input.recentTrainingVolume
      ? (input.recentTrainingVolume.avgRPE ?? 6) * (input.recentTrainingVolume.avgDurationMin ?? 45) * 0.12 * input.recentTrainingVolume.sessionsPerWeek / 7
      : input.trainingDaysPerWeek * 450 / 7
    const EA_THRESHOLD = 30  // kcal/kg FFM/day
    const minCalForEA = Math.round(EA_THRESHOLD * ffm + exerciseKcal)

    if (actualCalories < minCalForEA) {
      const prevCalories = actualCalories
      const extraCal = minCalForEA - actualCalories
      suggestedCarb += Math.round(extraCal / 4)
      actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)
      goalInfeasible = true
      warnings.push(`🚨 EA 安全閥：建議熱量 ${prevCalories}kcal 會導致 EA < 30 kcal/kg FFM/day（RED-S 風險）。已上調至 ${actualCalories}kcal（EA ≈ 30），多出的 ${Math.round(extraCal)}kcal 給碳水`)
    }
  }

  // 基因修正層（Goal-Driven 模式）
  // 碳水下限提高 + APOE4 脂肪來源警告
  const prevCarb = suggestedCarb
  suggestedCarb = applyGeneticCarbFloor(suggestedCarb, input.geneticProfile, geneticCorrections)
  if (suggestedCarb > prevCarb) {
    // 碳水提高 → 熱量同步上調（不壓回赤字，因為這是基因安全需求）
    actualCalories += (suggestedCarb - prevCarb) * 4
  }
  getApoe4FatWarnings(input.geneticProfile, geneticCorrections, warnings)

  // 掉重率安全檢查（保留資訊性警告，赤字已在前面 cap 過）
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
    // 飲食面赤字不夠（差距 > 50 kcal）→ 需要額外活動補，換算為有氧分鐘數
    const rawExtraBurn = shortfall
    extraBurnPerDay = Math.min(rawExtraBurn, CARDIO.MAX_EXTRA_BURN_PER_DAY)
    extraCardioNeeded = true

    // 計算有氧分鐘（中等強度），受 activityProfile 上限限制
    const rawMinutes = Math.round(extraBurnPerDay / kcalPerMinCardio)
    suggestedCardioMinutes = Math.min(cardioProfile.MAX_CARDIO_MINUTES, rawMinutes)
    // suggestedDailySteps 維持基礎值（有氧分鐘已涵蓋額外消耗，不重複計算步數）

    // 預測體重（飲食 + 有氧）
    const actualCardioburn = suggestedCardioMinutes * kcalPerMinCardio
    const totalDailyBurn = realDietDeficit + actualCardioburn
    const totalLoss = (totalDailyBurn * daysLeft) / energyDensity
    predictedCompWeight = Math.round((bw - totalLoss) * 10) / 10

    // 判斷能否達標（Peak Week 拆分時比較 PW 入場目標）
    if (predictedCompWeight <= effectiveTarget + 0.3) {
      cardioNote = `飲食 + 有氧 ${suggestedCardioMinutes} 分鐘可達標！（需額外消耗 ${Math.round(extraBurnPerDay)}kcal）`
    } else {
      const targetLabel = deadlineInfo.prePeakEntryWeight ? `PW 入場 ${effectiveTarget}kg` : `目標 ${targetWeight}kg`
      cardioNote = `預測 ${predictedCompWeight}kg（${targetLabel}），差 ${(predictedCompWeight - effectiveTarget).toFixed(1)}kg。可與教練討論調整量級或目標`
    }

    if (rawExtraBurn > CARDIO.MAX_EXTRA_BURN_PER_DAY) {
      warnings.push(`🏃 理論需額外消耗 ${Math.round(rawExtraBurn)}kcal/天，但每日有氧合理上限約 ${CARDIO.MAX_EXTRA_BURN_PER_DAY}kcal/天`)
    }
    warnings.push(`🚴 今日有氧目標 ${suggestedCardioMinutes} 分鐘（中等強度，需額外消耗 ${Math.round(extraBurnPerDay)}kcal 彌補飲食缺口）`)
  } else {
    // 飲食面赤字足夠（shortfall ≤ 50 kcal）
    predictedCompWeight = effectiveTarget  // Peak Week 拆分時 = PW 入場體重

    // 高能量通量策略（High Energy Flux）
    // 即使飲食赤字夠了，也設步數目標 → 多消耗的部分加回碳水
    // 原理：同樣赤字但吃更多 → 保護代謝、維持訓練品質、減少肌肉流失
    // 有氧分鐘在此路徑完全移除，只用步數目標表達活動量（簡單、可被動追蹤）
    // 注意：不設 extraCardioNeeded = true，因為飲食赤字已足夠
    if (safetyLevel !== 'normal' || input.activityProfile === 'high_energy_flux') {
      // 飲食赤字足夠，無需額外有氧；suggestedCardioMinutes 維持 0

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
      // 訓練日:休息日比例由代謝健康動態決定（預設 1.5x）
      // 優先用血檢（HOMA-IR / 空腹胰島素）→ 沒血檢時用恢復分數當代理指標
      // 恢復極佳（≥85）= 身體代謝適應良好，碳水利用效率高 → 1.7x
      // 恢復差（≤50）= 身體壓力大，碳水分配保守 → 1.3x
      const avgDailyCarb = suggestedCarb
      const gdLabMods = input.labResults
        ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
        : null
      let gdCcm = gdLabMods?.carbCycleMultiplier ?? 1.5
      // 沒有代謝相關血檢時，用恢復分數當 fallback
      if (gdCcm === 1.5 && recoveryState !== 'unknown') {
        if (recoveryState === 'optimal') gdCcm = 1.7
        else if (recoveryState === 'struggling' || recoveryState === 'critical') gdCcm = 1.3
      }
      // 訓練天數為 0 時（紀錄空白），預設 4 天以產生有意義的碳循環分配
      const T = Math.min(Math.max(input.trainingDaysPerWeek, 4), 6)
      const R = 7 - T
      if (T > 0 && R > 0) {
        suggestedCarbsRD = Math.round((avgDailyCarb * 7) / (gdCcm * T + R))
        suggestedCarbsTD = Math.round(suggestedCarbsRD * gdCcm)
      } else {
        suggestedCarbsTD = avgDailyCarb
        suggestedCarbsRD = avgDailyCarb
      }
      if (suggestedCarbsRD < 20) suggestedCarbsRD = 20
    }
    // 碳循環拆分後，休息日碳水也要套用基因下限（5-HTTLPR SL/SS）
    suggestedCarbsRD = applyGeneticCarbFloor(suggestedCarbsRD, input.geneticProfile, geneticCorrections)
  }

  // 6b. Athletic 備戰期碳水下限保護（Thomas 2016: 3-5g/kg for moderate exercise）
  if (isAthleticPrep) {
    const acuteDaysLeft = deadlineInfo?.daysLeft ?? Infinity
    if (acuteDaysLeft <= ATHLETIC_CUT.ACUTE_DAYS) {
      // 急性期：碳水降到最低可執行量
      const acuteCarbFloor = Math.round(bw * ATHLETIC_CUT.ACUTE_CARB_PER_KG)
      suggestedCarb = Math.max(suggestedCarb, acuteCarbFloor)
      if (suggestedCarbsTD != null) suggestedCarbsTD = Math.max(suggestedCarbsTD, acuteCarbFloor)
      if (suggestedCarbsRD != null) suggestedCarbsRD = Math.max(suggestedCarbsRD, acuteCarbFloor)
      warnings.push(`🥊 急性降重期（距秤重 ${acuteDaysLeft} 天）：低渣飲食（纖維 <${ATHLETIC_CUT.ACUTE_FIBER_MAX_G}g），減少腸道殘留重量`)
      // 水分操控提示
      if (acuteDaysLeft >= 3) {
        warnings.push(`💧 水分超載期：建議水量 ${Math.round(bw * ATHLETIC_CUT.ACUTE_WATER_LOADING_ML_KG)}mL/天（${ATHLETIC_CUT.ACUTE_WATER_LOADING_ML_KG}mL/kg）`)
      } else if (acuteDaysLeft === 1) {
        warnings.push(`💧 限水期：建議水量 ${Math.round(bw * ATHLETIC_CUT.ACUTE_WATER_CUT_ML_KG)}mL/天（${ATHLETIC_CUT.ACUTE_WATER_CUT_ML_KG}mL/kg），秤重後立刻補水`)
      }
    } else {
      // 慢性降重期：碳水下限保護（保護運動表現）
      const trainingCarbFloor = Math.round(bw * ATHLETIC_CUT.CARB_FLOOR_TRAINING_PER_KG)
      const restCarbFloor = Math.round(bw * ATHLETIC_CUT.CARB_FLOOR_REST_PER_KG)
      suggestedCarb = Math.max(suggestedCarb, restCarbFloor)
      if (suggestedCarbsTD != null) suggestedCarbsTD = Math.max(suggestedCarbsTD, trainingCarbFloor)
      if (suggestedCarbsRD != null) suggestedCarbsRD = Math.max(suggestedCarbsRD, restCarbFloor)
    }
    // 重算 actualCalories（碳水可能因 floor 被提高）
    actualCalories = Math.round(suggestedPro * 4 + suggestedCarb * 4 + suggestedFat * 9)
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
    const targetLabel = deadlineInfo.prePeakEntryWeight ? `PW 入場 ${effectiveTarget}kg` : `${targetWeight}kg`
    message = `以目前 TDEE ${estimatedTDEE}kcal，需要每日赤字 ${effectiveDailyDeficit}kcal 才能達到 ${targetLabel}。`
    message += `飲食底線 ${actualCalories}kcal（赤字缺口 ${Math.round(shortfall)}kcal 需靠活動補）`
    if (extraCardioNeeded) {
      message += `，步數目標 ${suggestedDailySteps.toLocaleString()} 步/天`
      if (predictedCompWeight <= effectiveTarget + 0.3) {
        message += `，預測可達 ${predictedCompWeight}kg ✓`
      } else {
        message += `，預測 ${predictedCompWeight}kg（差 ${(predictedCompWeight - effectiveTarget).toFixed(1)}kg）`
      }
    } else {
      message += `，預測 PW 入場 ${predictedCompWeight}kg。`
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
    warnings.push('掉重速率超過 1.2%/週（[2] Garthe 2011: >1.4% 顯著增加 LBM 流失風險），可考慮增加蛋白質攝取量或微增碳水')
  }

  // Diet break / Strategic Refeed 偵測（使用代謝壓力分數）
  // [8] MATADOR: 間歇限制優於連續限制（2wk on/off → 減脂 +50%、代謝適應更小）
  // [7] Trexler 2014: 持續限制 → T3/leptin/TDEE 持續下降
  // 舊邏輯：固定 8 週門檻。新邏輯：綜合多維度數據自動評估
  const dietBreakSuggested = dietDurationWeeks != null && dietDurationWeeks >= SAFETY.DIET_BREAK_WEEKS

  // 備賽 strategic refeed：距比賽 ≤ 28 天 + 代謝壓力偏高
  // 注意：metabolicStress 由主引擎計算並 spread 進去，這裡用 deadlineInfo 的 weightToLose 做補充判斷
  if (daysLeft > 7 && daysLeft <= 28) {
    // 最後 4 週：即使未達 8 週門檻，也根據體重 gap 和恢復狀態給策略性 refeed 建議
    const hasBuffer = deadlineInfo.prePeakEntryWeight != null
      ? (bw - deadlineInfo.prePeakEntryWeight) <= (bw * 0.015)  // 差距 ≤ 1.5% BW → 有空間 refeed
      : weightToLose <= bw * 0.02
    if (hasBuffer && (recoveryState === 'critical' || recoveryState === 'struggling')) {
      warnings.push(`🔄 距比賽 ${daysLeft} 天，體重接近目標且恢復偏低。建議安排 1 天策略性 refeed（碳水 4-5 g/kg），恢復代謝和訓練品質`)
    } else if (dietBreakSuggested && daysLeft > 14) {
      warnings.push(`已連續減脂 ${dietDurationWeeks} 週。距比賽還有 ${daysLeft} 天，可考慮安排 1-2 天 refeed 恢復代謝（碳水 4-5 g/kg，蛋白質維持，脂肪壓低）`)
    }
  } else if (dietBreakSuggested && daysLeft > 28) {
    warnings.push(`已連續減脂 ${dietDurationWeeks} 週。距比賽還有 ${daysLeft} 天，可考慮安排 3-5 天 diet break 恢復代謝`)
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
    bodyFatZoneInfo: zoneInfo,
    deadlineInfo: enrichedDeadlineInfo,
    autoApply: true, tdeeAnomalyDetected: false,  // Goal-Driven 結果已 safety-capped，一律自動套用（不可行時 warning 通知教練但仍更新）
    labMacroModifiers: gdMacroMods, labTrainingModifiers: gdLabModResult?.trainingModifiers ?? [], energyAvailability: null,
    peakWeekPlan: null, metabolicStress: null,
    menstrualCycleNote: cycleInfo.note,
    perMealProteinGuide: buildPerMealProteinGuide(bw, suggestedPro),
    geneticCorrections,
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
  const isMale = input.gender === '男性'
  const zoneInfo = buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType)

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

  // ===== 黃體期碳水增量（女性增肌專用）=====
  // Hackney 2012: 黃體期碳水氧化率 +15-20%，增肌期同樣需要補回
  // 增肌期不縮赤字（沒有赤字），但增加碳水支持合成效率
  if (cycleInfo.carbBoostGPerKg > 0) {
    const lutealCarbBoost = Math.round(bw * cycleInfo.carbBoostGPerKg)
    carbDelta += lutealCarbBoost
    calDelta += lutealCarbBoost * 4
  }

  // ===== 體脂率追蹤：防止髒增肌 =====
  // 若有前次體脂率，偵測體脂上升速度。增肌期體脂增幅 > 2% 視為髒增肌風險
  // 體脂增幅 > 4% 視為嚴重髒增肌，應降低盈餘或考慮迷你減脂
  if (input.previousBodyFatPct != null && input.bodyFatPct != null
      && input.previousBodyFatPct > 0 && input.bodyFatPct > 0) {
    const bfIncrease = input.bodyFatPct - input.previousBodyFatPct
    if (bfIncrease > 4) {
      // 嚴重髒增肌：強制降低盈餘
      calDelta -= 200
      carbDelta -= 25
      status = 'too_fast'
      statusLabel = '脂肪堆積'
      statusEmoji = '🔴'
      message += ` ⚠️ 體脂率從 ${input.previousBodyFatPct}% 上升至 ${input.bodyFatPct}%（+${bfIncrease.toFixed(1)}%），脂肪增長過快。建議降低盈餘或安排 2-4 週迷你減脂。`
      warnings.push(`🔴 髒增肌警告：體脂增幅 +${bfIncrease.toFixed(1)}%，系統已自動降低盈餘 200kcal。建議考慮迷你減脂期。`)
    } else if (bfIncrease > 2) {
      // 輕度髒增肌風險：微降盈餘，改 status 確保 calDelta 被套用（避免 on_track early return 丟棄）
      calDelta -= 100
      carbDelta -= 13
      status = 'too_fast'
      statusLabel = '脂肪偏快'
      statusEmoji = '🟡'
      message += ` ⚠️ 體脂率從 ${input.previousBodyFatPct}% 上升至 ${input.bodyFatPct}%（+${bfIncrease.toFixed(1)}%），脂肪增長偏快。已微調盈餘。`
      warnings.push(`🟡 體脂上升偏快（+${bfIncrease.toFixed(1)}%），系統已微降盈餘 100kcal，持續監控中。`)
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

  // Bug 7 fix: 增肌路徑也套用血檢 modifier
  const bulkLabModResult = input.labResults
    ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
    : null
  const bulkLabMacroMods = bulkLabModResult?.macroModifiers ?? []
  const bulkLabTrainingMods = bulkLabModResult?.trainingModifiers ?? []
  for (const mod of bulkLabMacroMods) {
    if (mod.nutrient === 'protein' && mod.direction === 'increase') suggestedPro += mod.delta
    if (mod.nutrient === 'carbs' && mod.direction === 'decrease') suggestedCarb = Math.max(50, suggestedCarb - mod.delta)
    if (mod.nutrient === 'carbs' && mod.direction === 'increase') suggestedCarb += mod.delta
    if (mod.nutrient === 'fat' && mod.direction === 'decrease') suggestedFat = Math.max(Math.round(bw * (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)), suggestedFat - mod.delta)
    if (mod.nutrient === 'fat' && mod.direction === 'increase') suggestedFat += mod.delta
    if (mod.nutrient === 'calories' && mod.direction === 'increase') suggestedCal += mod.delta
  }

  // 安全底線（有體脂區間用 zone 值，否則 fallback 男女固定值）
  const bulkProteinFloor = zoneInfo
    ? zoneInfo.proteinPerKg
    : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE)
  const minProtein = Math.round(bw * bulkProteinFloor)
  if (suggestedPro < minProtein) {
    suggestedPro = minProtein
    warnings.push(`蛋白質已提升至安全最低值 ${minProtein}g（${bulkProteinFloor}g/kg）`)
  }

  const bulkFatFloor = zoneInfo
    ? zoneInfo.fatPerKg
    : (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)
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

  // 增肌期熱量安全上限：TDEE + MAX_SURPLUS_KCAL
  if (estimatedTDEE != null) {
    const maxBulkCal = estimatedTDEE + SAFETY.MAX_SURPLUS_KCAL
    if (suggestedCal > maxBulkCal) {
      suggestedCal = maxBulkCal
      warnings.push(`增肌期熱量已達上限 ${maxBulkCal}kcal（TDEE ${estimatedTDEE} + ${SAFETY.MAX_SURPLUS_KCAL}），避免過度盈餘`)
    }
    // 碳水連動：根據 capped 熱量重算碳水上限
    const maxCarbFromCal = Math.round((suggestedCal - suggestedPro * 4 - suggestedFat * 9) / 4)
    if (maxCarbFromCal > 0 && suggestedCarb > maxCarbFromCal) {
      suggestedCarb = maxCarbFromCal
    }
  }

  if (status === 'on_track') {
    // 即使進度正常，也驗證巨量營養素安全底線
    let validatedPro = currentPro
    let validatedFat = currentFat
    const bulkProteinFloorOT = zoneInfo
      ? zoneInfo.proteinPerKg
      : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE)
    const bulkFatFloorOT = zoneInfo
      ? zoneInfo.fatPerKg
      : (isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE)
    const minProteinBulk = Math.round(bw * bulkProteinFloorOT)
    const minFatBulk = Math.round(bw * bulkFatFloorOT)

    // Bug 7 fix: on_track 也套用血檢 modifier
    for (const mod of bulkLabMacroMods) {
      if (mod.nutrient === 'protein' && mod.direction === 'increase') validatedPro += mod.delta
      if (mod.nutrient === 'fat' && mod.direction === 'decrease') validatedFat = Math.max(minFatBulk, validatedFat - mod.delta)
      if (mod.nutrient === 'fat' && mod.direction === 'increase') validatedFat += mod.delta
    }

    if (currentPro > 0 && validatedPro < minProteinBulk) {
      validatedPro = minProteinBulk
      warnings.push(`⚠️ 目前蛋白質 ${currentPro}g 低於安全最低值 ${minProteinBulk}g（${bulkProteinFloorOT}g/kg），系統已自動調高`)
    }
    if (currentFat > 0 && validatedFat < minFatBulk) {
      validatedFat = minFatBulk
      warnings.push(`⚠️ 目前脂肪 ${currentFat}g 低於安全底線 ${minFatBulk}g（${bulkFatFloorOT}g/kg），系統已自動調高`)
    }

    // bulk on_track 也計算基因修正
    const otBulkGC: GeneticCorrection[] = []
    let validatedCarb = applyGeneticCarbFloor(currentCarb, input.geneticProfile, otBulkGC)
    getApoe4FatWarnings(input.geneticProfile, otBulkGC, warnings)

    // on_track 碳循環也要套用血檢碳水修正（與 cut on_track 一致，不能原封不動 pass through）
    let otBulkCarbsTD = input.currentCarbsTrainingDay ?? null
    let otBulkCarbsRD = input.currentCarbsRestDay ?? null
    if (bulkLabMacroMods.length > 0 && otBulkCarbsTD != null && otBulkCarbsRD != null) {
      for (const mod of bulkLabMacroMods) {
        if (mod.nutrient === 'carbs' && mod.direction === 'decrease') {
          otBulkCarbsTD = Math.max(30, otBulkCarbsTD - mod.delta)
          otBulkCarbsRD = Math.max(30, otBulkCarbsRD - mod.delta)
        }
        if (mod.nutrient === 'carbs' && mod.direction === 'increase') {
          otBulkCarbsTD += mod.delta
          otBulkCarbsRD += mod.delta
        }
      }
    }

    // on_track 也驗證熱量上限（修正歷史錯誤值）
    let validatedCal = currentCal
    if (estimatedTDEE != null) {
      const maxBulkCal = estimatedTDEE + SAFETY.MAX_SURPLUS_KCAL
      if (validatedCal > maxBulkCal) {
        validatedCal = maxBulkCal
        warnings.push(`增肌期熱量超過上限，已修正至 ${maxBulkCal}kcal（TDEE ${estimatedTDEE} + ${SAFETY.MAX_SURPLUS_KCAL}）`)
      }
      // 碳水連動
      const maxCarbFromCal = Math.round((validatedCal - validatedPro * 4 - validatedFat * 9) / 4)
      if (maxCarbFromCal > 0 && validatedCarb > maxCarbFromCal) {
        validatedCarb = maxCarbFromCal
      }
    }

    const hasCorrections = validatedPro !== currentPro || validatedFat !== currentFat || validatedCarb !== currentCarb || validatedCal !== currentCal
    return {
      status, statusLabel, statusEmoji, message,
      suggestedCalories: validatedCal, suggestedProtein: validatedPro,
      suggestedCarbs: validatedCarb, suggestedFat: validatedFat,
      suggestedCarbsTrainingDay: otBulkCarbsTD,
      suggestedCarbsRestDay: otBulkCarbsRD,
      caloriesDelta: validatedCal - currentCal, proteinDelta: validatedPro - currentPro,
      carbsDelta: validatedCarb - currentCarb, fatDelta: validatedFat - currentFat,
      estimatedTDEE, weeklyWeightChangeRate: weeklyChangeRate,
      dietDurationWeeks, dietBreakSuggested: false, warnings,
      currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
      bodyFatZoneInfo: zoneInfo,
      labMacroModifiers: bulkLabMacroMods, labTrainingModifiers: bulkLabTrainingMods, energyAvailability: null,
      deadlineInfo, autoApply: true, tdeeAnomalyDetected: false, peakWeekPlan: null, metabolicStress: null,
      menstrualCycleNote: cycleInfo.note,
      perMealProteinGuide: buildPerMealProteinGuide(bw, validatedPro),
      geneticCorrections: otBulkGC,
    }
  }

  // bulk 主路徑基因修正
  const bulkGC: GeneticCorrection[] = []
  suggestedCarb = applyGeneticCarbFloor(suggestedCarb, input.geneticProfile, bulkGC)
  getApoe4FatWarnings(input.geneticProfile, bulkGC, warnings)

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
    bodyFatZoneInfo: zoneInfo,
    labMacroModifiers: bulkLabMacroMods, labTrainingModifiers: bulkLabTrainingMods, energyAvailability: null,
    deadlineInfo, autoApply: true, tdeeAnomalyDetected: false, peakWeekPlan: null, metabolicStress: null,
    menstrualCycleNote: cycleInfo.note,
    perMealProteinGuide: buildPerMealProteinGuide(bw, Math.round(suggestedPro)),
    geneticCorrections: bulkGC,
  }
}

// ===== Athletic 秤重日引擎 =====
// 秤重日：最小化攝入，秤重後立刻開始回補

function generateAthleticWeighIn(input: NutritionInput): NutritionSuggestion {
  const bw = input.bodyWeight
  const isMale = input.gender === '男性'
  // 最低安全熱量（同備賽極限）
  const minCal = isMale ? GOAL_DRIVEN.MIN_CALORIES_MALE : GOAL_DRIVEN.MIN_CALORIES_FEMALE
  const protein = Math.round(bw * 1.5)  // 低蛋白（不佔胃容量）
  const fat = Math.round(bw * 0.3)
  const carbs = Math.max(20, Math.round((minCal - protein * 4 - fat * 9) / 4))
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)

  return emptyResult({
    status: 'athletic_weigh_in',
    statusLabel: '秤重日',
    statusEmoji: '⚖️',
    message: '秤重日：最小化攝入，秤重後立刻開始超補償回補。',
    suggestedCalories: calories,
    suggestedProtein: protein,
    suggestedCarbs: carbs,
    suggestedFat: fat,
    autoApply: false,
    warnings: [
      '⚖️ 秤重日：最小化攝入直到秤重完成',
      '🔄 秤重後立刻開始回補：優先液態碳水 + 電解質飲品',
      '💧 秤重前限制水分，秤重後立刻補水（目標 1-1.5L/小時）',
    ],
  })
}

// ===== Athletic 超補償期引擎 =====
// Reale 2017 / Artioli 2016: rapid rehydration + glycogen supercompensation
// Burke 2011: Carb loading for performance

function generateAthleticRebound(
  bodyWeight: number,
  gender: string,
  gapHours: number,
): NutritionSuggestion {
  const bw = bodyWeight

  let carbs: number
  let strategy: 'short' | 'medium' | 'long'
  let strategyNote: string

  if (gapHours < 6) {
    // <6h 窗口：液態碳水為主，g/kg/hour × hours × bw
    carbs = Math.round(ATHLETIC_CUT.REBOUND_CARB_SHORT_PER_KG_HR * gapHours * bw)
    strategy = 'short'
    strategyNote = `短窗口（${gapHours}h）：液態碳水為主（運動飲料、果汁、蜂蜜水），每小時 ${ATHLETIC_CUT.REBOUND_CARB_SHORT_PER_KG_HR}g/kg`
  } else if (gapHours < 18) {
    // 6-18h 窗口：結構化進食
    carbs = Math.round(ATHLETIC_CUT.REBOUND_CARB_MEDIUM_PER_KG * bw)
    strategy = 'medium'
    strategyNote = `中窗口（${gapHours}h）：結構化進食，目標碳水 ${ATHLETIC_CUT.REBOUND_CARB_MEDIUM_PER_KG}g/kg（${carbs}g）`
  } else {
    // ≥18h 窗口：完整飲食
    carbs = Math.round(ATHLETIC_CUT.REBOUND_CARB_LONG_PER_KG * bw)
    strategy = 'long'
    strategyNote = `長窗口（${gapHours}h）：完整碳水超補，目標 ${ATHLETIC_CUT.REBOUND_CARB_LONG_PER_KG}g/kg（${carbs}g）`
  }

  const protein = Math.round(ATHLETIC_CUT.REBOUND_PROTEIN_PER_KG * bw)
  const fat = Math.round(ATHLETIC_CUT.REBOUND_FAT_PER_KG * bw)
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  const waterPerHour = ATHLETIC_CUT.REBOUND_WATER_ML_PER_HOUR
  const totalWater = Math.round(waterPerHour * Math.min(gapHours, 6))  // 前 6 小時最重要

  return emptyResult({
    status: 'athletic_rebound',
    statusLabel: '超補償期',
    statusEmoji: '⚡',
    message: `秤重到比賽間距 ${gapHours} 小時。${strategyNote}`,
    suggestedCalories: calories,
    suggestedProtein: protein,
    suggestedCarbs: carbs,
    suggestedFat: fat,
    suggestedWater: totalWater,
    autoApply: false,
    athleticRebound: { gapHours, strategy, waterPerHour },
    warnings: [
      `⚡ 超補償策略：${strategyNote}`,
      `💧 補水目標：前幾小時 ${waterPerHour}mL/小時（含電解質），總計約 ${totalWater}mL`,
      `🍞 蛋白質 ${protein}g（${ATHLETIC_CUT.REBOUND_PROTEIN_PER_KG}g/kg）、脂肪 ${fat}g（${ATHLETIC_CUT.REBOUND_FAT_PER_KG}g/kg）— 低蛋白低脂，不佔胃容量`,
      ...(strategy === 'short' ? ['🥤 優先液態碳水：運動飲料、果汁、蜂蜜水、白飯粥'] : []),
      ...(strategy === 'medium' ? ['🍚 高 GI 碳水為主：白飯、白麵包、馬鈴薯、運動飲料'] : []),
      ...(strategy === 'long' ? ['🍝 完整進食：白飯、麵食、馬鈴薯、水果、運動飲料'] : []),
    ],
  })
}

// ===== Athletic 比賽日引擎 =====
// Fix #3: 運動員比賽日營養 — 高碳水、中蛋白、低脂、低纖維易消化
// Thomas 2016 (ACSM): 賽前 3-4h 高碳水低纖維 meal; Burke 2011: competition day fueling

function generateAthleticCompetition(input: NutritionInput): NutritionSuggestion {
  const bw = input.bodyWeight
  const carbs = Math.round(bw * 9)      // 8-10g/kg 中間值
  const protein = Math.round(bw * 1.8)
  const fat = Math.round(bw * 0.5)
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  const water = Math.round(bw * 40)

  return emptyResult({
    status: 'athletic_competition',
    statusLabel: '比賽日',
    statusEmoji: '🏆',
    message: `比賽日燃料策略：高碳水（${carbs}g, ~9g/kg）確保肌醣滿載，中蛋白（${protein}g）、低脂（${fat}g）減少消化負擔。賽前 3-4 小時完成最後一餐。`,
    suggestedCalories: calories,
    suggestedProtein: protein,
    suggestedCarbs: carbs,
    suggestedFat: fat,
    suggestedWater: water,
    autoApply: false,
    warnings: [
      '🏆 比賽日：專注表現，營養服務於比賽',
      `🍚 碳水 ${carbs}g（~9g/kg）：確保肌醣滿載，以高 GI 易消化碳水為主（白飯、白麵包、香蕉）`,
      `🥩 蛋白質 ${protein}g（1.8g/kg）：維持正常攝取，不增加消化負擔`,
      `🫒 脂肪 ${fat}g（0.5g/kg）：降至最低，減少消化時間`,
      '⏰ 賽前 3-4 小時完成最後一餐（低纖維、易消化）',
      '🥤 比賽中：每 15-20 分鐘補充運動飲料或碳水凝膠（視比賽時長）',
      '🚫 避免：高纖維、高脂、乳製品、辛辣食物（減少腸胃不適風險）',
    ],
    perMealProteinGuide: buildPerMealProteinGuide(bw, protein),
  })
}

// ===== Peak Week 引擎 =====
// 基於 Escalante 2021 [12] + Barakat 2022 [13] + Homer/Helms 2024 [14] + Kistler 2024 [15]
// [15] 指出：碳水超補有效（肌肉厚度 +2%, 皮下 -2%），但水分 ICW/ECW 轉移的精確機制尚缺嚴格 RCT
// 每日協議含：巨量營養素、水分、鈉、鉀、纖維、訓練、食物選擇、肌酸、Posing、Pump-up

function generatePeakWeekPlan(input: NutritionInput, daysLeft: number, cycleInfo?: MenstrualCycleInfo): NutritionSuggestion {
  const bw = input.bodyWeight
  const isFemale = input.gender === '女性'
  const compDate = new Date(input.targetDate!)
  const plan: PeakWeekDay[] = []

  // Bug 6 fix: Peak Week 也要取得血檢 modifier，用於 training modifier 警告和 labMacroModifiers 回傳
  const pwLabModResult = input.labResults
    ? getLabMacroModifiers(input.labResults, { gender: input.gender as '男性' | '女性', bodyWeight: bw })
    : null
  const pwLabMacroMods = pwLabModResult?.macroModifiers ?? []
  const pwLabTrainingMods = pwLabModResult?.trainingModifiers ?? []

  // 碳水超補量依體重動態調整 [15] Kistler 2024：3-12 g/kg 範圍，個體差異大
  // 重量級選手 (>90kg) 絕對碳水量過高（>810g）會造成腸胃不適，需降低 g/kg
  // 男性基準 9.0 g/kg（Homer 2024, ~80kg）；女性基準 6.5 g/kg（Tarnopolsky 1995）
  const baseLoadingCarb = isFemale ? PEAK_WEEK.LOADING_CARB_G_PER_KG_FEMALE : PEAK_WEEK.LOADING_CARB_G_PER_KG
  const loadingCarb = bw > 100 ? baseLoadingCarb - 1.5   // >100kg: 男 7.5, 女 5.0
    : bw > 90 ? baseLoadingCarb - 1.0                     // 90-100kg: 男 8.0, 女 5.5
    : baseLoadingCarb                                      // ≤90kg: 男 9.0, 女 6.5
  const loadingFat = isFemale ? PEAK_WEEK.LOADING_FAT_G_PER_KG_FEMALE : PEAK_WEEK.LOADING_FAT_G_PER_KG
  // Taper 碳水等比縮減：loadingCarb × (基準taper/基準loading)
  const baseTaperCarb = isFemale ? PEAK_WEEK.TAPER_CARB_G_PER_KG_FEMALE : PEAK_WEEK.TAPER_CARB_G_PER_KG
  const taperCarb = Math.round(loadingCarb * (baseTaperCarb / baseLoadingCarb) * 10) / 10

  // 基因修正層（Peak Week）
  const geneticCorrections: GeneticCorrection[] = []
  const gp = input.geneticProfile
  const isApoe4 = gp?.apoe === 'e3/e4' || gp?.apoe === 'e4/e4'

  // 5-HTTLPR 血清素轉運體基因 → 耗竭期縮短 + 碳水提高
  // [G1] 碳水耗竭 → 腦部血清素急降 → SS/SL 型情緒崩潰風險高
  const serotoninRisk = getSerotoninRiskLevel(gp)
  const genotypeLabel = gp?.serotonin ?? (serotoninRisk === 'high' ? 'SS' : serotoninRisk === 'moderate' ? 'SL' : null)
  let depletionCutoffDay = 4  // 預設 Day 7-4 為耗竭期（d >= 4）
  let depletionCarbGPerKg = PEAK_WEEK.DEPLETION_CARB_G_PER_KG
  if (serotoninRisk === 'high') {
    depletionCutoffDay = 8 - GENETIC.DEPRESSION_DEPLETION_DAYS_HIGH  // 8-2=6, 只有 Day 7-6 耗竭
    depletionCarbGPerKg = GENETIC.DEPRESSION_DEPLETION_CARB_HIGH
    geneticCorrections.push({
      gene: 'depression',
      rule: 'Peak Week 耗竭策略',
      adjustment: `5-HTTLPR ${genotypeLabel}（高風險）→ 耗竭期從 4 天縮為 ${GENETIC.DEPRESSION_DEPLETION_DAYS_HIGH} 天，碳水從 ${PEAK_WEEK.DEPLETION_CARB_G_PER_KG}g/kg 提高至 ${GENETIC.DEPRESSION_DEPLETION_CARB_HIGH}g/kg，最大保護腦部血清素`,
    })
  } else if (serotoninRisk === 'moderate') {
    depletionCutoffDay = 8 - GENETIC.DEPRESSION_DEPLETION_DAYS_MODERATE  // 8-3=5, Day 7-5 耗竭
    depletionCarbGPerKg = GENETIC.DEPRESSION_DEPLETION_CARB_MODERATE
    geneticCorrections.push({
      gene: 'depression',
      rule: 'Peak Week 耗竭策略',
      adjustment: `5-HTTLPR ${genotypeLabel}（中風險）→ 耗竭期從 4 天縮為 ${GENETIC.DEPRESSION_DEPLETION_DAYS_MODERATE} 天，碳水從 ${PEAK_WEEK.DEPLETION_CARB_G_PER_KG}g/kg 提高至 ${GENETIC.DEPRESSION_DEPLETION_CARB_MODERATE}g/kg，平衡血清素保護與肝醣耗竭效果`,
    })
  }

  // APOE4 → 脂肪來源限制（耗竭期高脂需避免飽和脂肪）
  if (isApoe4) {
    geneticCorrections.push({
      gene: 'apoe4',
      rule: '脂肪來源比例限制',
      adjustment: `APOE4 → Peak Week 脂肪來源優先 MCT/MUFA，飽和脂肪 ≤ 30%（避免牛油奶油）`,
    })
  }

  // MTHFR 突變 → 甲基化 B 群 + TMG（補劑切換）
  // 活性葉酸代謝不良 → BH4 合成受限 → 血清素/多巴胺製造端受限
  // 與 5-HTTLPR SL/SS 形成複合風險：製造端 + 回收端雙重限制
  if (gp?.mthfr === 'homozygous' || gp?.mthfr === 'heterozygous') {
    const mthfrLabel = gp.mthfr === 'homozygous' ? '純合子' : '雜合子'
    geneticCorrections.push({
      gene: 'mthfr',
      rule: 'Peak Week 補劑甲基化',
      adjustment: `MTHFR ${mthfrLabel}突變 → 補劑切換為甲基化 B 群（Methylfolate + Methylcobalamin + P-5-P）+ TMG，保護甲基化循環和神經傳導物質合成`,
    })
  }

  // ===== 體重預測 =====
  // 生理學基礎：1g 肝醣結合 2.7-3g 水分（Fernández-Elías 2015）
  // 完全耗竭可清空 ~400g 肌肉肝醣 + 100g 肝臟肝醣 = ~500g
  // 500g 肝醣 + 1500g 水 ≈ 2.0kg 流失（理論最大值，實際約 1.0-1.5kg）
  // 超補可儲存 600-700g 肝醣 + 1.8-2.1kg 水分 ≈ 2.5-2.8kg 增加
  const weightDeltaMap: Record<number, { delta: number; note: string }> = {
    7: { delta: 0, note: '基準體重' },
    6: { delta: -0.3, note: '肝醣開始消耗，體重微降' },
    5: { delta: -0.7, note: '肝醣持續消耗 + 脂肪補充 IMT' },
    4: { delta: -1.0, note: '肝醣接近耗盡，體重最低點' },
    3: { delta: -0.2, note: '碳水超補開始，肝醣+水分快速回填' },
    2: { delta: 0.8, note: '肝醣超補高峰，體重顯著增加（正常！）' },
    1: { delta: 1.2, note: '肝醣飽和 + 細胞內水分最大化' },
    0: { delta: 0.5, note: '水分微調後，肌肉飽滿但皮下水分減少' },
  }
  // 女性體重變化較小（肝醣超補反應約男性 50-70%）
  if (isFemale) {
    Object.keys(weightDeltaMap).forEach(k => {
      const key = Number(k)
      weightDeltaMap[key].delta = Math.round(weightDeltaMap[key].delta * 0.65 * 10) / 10
    })
  }

  // ===== Day 2 碳水溢出防護（體重回饋機制）=====
  // Day 3 超補後體重暴漲（Day 2 晨重反映）超過閾值 → Day 2 碳水自動降低，避免 spill-over（碳水溢出到皮下水分）
  // 男性閾值 2.0kg / 女性閾值 1.3kg（65% scaling）
  let day2CarbOverride: number | null = null
  let spillOverWarning: string | null = null

  if (input.peakWeekDailyWeights && input.peakWeekDailyWeights.length > 0) {
    const pwWeights = input.peakWeekDailyWeights

    // baseline = Day 7 體重（最早的 Peak Week 體重）
    const day7Date = new Date(compDate)
    day7Date.setDate(compDate.getDate() - 7)
    const day7Str = day7Date.toISOString().split('T')[0]

    // Day 2 晨重日期（反映 Day 3 超補後的體重變化）
    const day2Date = new Date(compDate)
    day2Date.setDate(compDate.getDate() - 2)
    const day2Str = day2Date.toISOString().split('T')[0]

    // 找 baseline：優先取 Day 7 當天，否則取 Peak Week 最早的紀錄
    const baselineRecord = pwWeights.find(w => w.date === day7Str)
      || pwWeights.reduce((earliest, w) => (w.date < earliest.date ? w : earliest), pwWeights[0])
    const day2Record = pwWeights.find(w => w.date === day2Str)

    if (baselineRecord && day2Record) {
      const weightGain = day2Record.weight - baselineRecord.weight
      const threshold = isFemale ? 1.3 : 2.0
      const reducedCarb = isFemale ? 5.0 : 7.0

      if (weightGain > threshold) {
        day2CarbOverride = reducedCarb
        spillOverWarning = `⚠️ Day 2 晨重 ${day2Record.weight}kg（基線 ${baselineRecord.weight}kg，增幅 +${weightGain.toFixed(1)}kg，超過閾值 ${threshold}kg）→ Day 2 碳水已從 ${loadingCarb}g/kg 自動調降至 ${reducedCarb}g/kg，防止肝醣溢出到皮下水分`
      }
    }
  }

  // ===== 補劑建議 =====
  // MTHFR 突變者需要甲基化 B 群（methylfolate + methylcobalamin + P-5-P）
  // 而非普通合成葉酸（folic acid），因為 MTHFR 酶活性不足無法將 folic acid 轉換為活性 5-MTHF
  // 活性葉酸是 BH4 合成的關鍵輔因子 → BH4 是血清素/多巴胺合成限速酶輔因子
  // MTHFR + 5-HTTLPR SL = 複合風險：製造端（MTHFR）+ 回收端（SL）雙重受限
  const isMthfr = gp?.mthfr === 'homozygous' || gp?.mthfr === 'heterozygous'
  const bVitaminNote = isMthfr
    ? '甲基化 B 群早餐後（Methylfolate 800mcg + Methylcobalamin 1000mcg + P-5-P 50mg）— MTHFR 突變者需活性形式，普通 B 群的 folic acid 無法有效轉換'
    : 'B群（含 B1, B6, B12）早餐後 — 低碳期能量代謝輔酶需求增加'
  const tmgNote = isMthfr
    ? 'TMG（三甲基甘氨酸）500-1000mg — 提供備用甲基捐贈路徑，降低同型半胱氨酸（MTHFR 突變者 Hcy 易堆積）'
    : null

  const supplementDepletion = [
    '肌酸 5g/天（不要停！停肌酸會流失細胞內水分和肌肉飽滿度）',
    '鎂 400mg 睡前（甘氨酸鎂或蘋果酸鎂）— 改善睡眠品質、減少肌肉痙攣',
    '茶氨酸 200mg 睡前 — 降低耗竭期皮質醇、改善睡眠',
    bVitaminNote,
    ...(tmgNote ? [tmgNote] : []),
    'D3 2000-4000 IU/天 — 維持免疫力（備賽後期免疫力下降）',
    '電解質補充（鈉、鉀、鎂）— 低碳期水分流失加速電解質排出',
  ].join('；')
  const supplementLoading = [
    '肌酸 5g/天（搭配碳水一起吃，肌酸+碳水超補可增強肝醣儲存）',
    '鎂 400mg 睡前 — 碳水超補期鎂需求增加（葡萄糖代謝輔因子）',
    '茶氨酸 200mg 睡前 — 維持睡眠品質',
    bVitaminNote,
    ...(tmgNote ? [tmgNote] : []),
    'D3 2000-4000 IU/天',
    '消化酵素（每餐服用）— 大量碳水攝取減少腸胃不適',
  ].join('；')
  const supplementTaper = [
    '肌酸 5g/天',
    '鎂 400mg 睡前',
    '茶氨酸 200mg 睡前（比賽前一晚好睡很重要）',
    bVitaminNote,
    ...(tmgNote ? [tmgNote] : []),
    'D3 2000-4000 IU/天',
  ].join('；')
  const supplementShowDay = [
    '賽前 caffeine 200mg（上台前 45-60 分鐘）— 增強血管充盈和 pump',
    '肌酸可省略（非必要）',
    '維他命 C 500mg — 抗氧化',
  ].join('；')

  // 建立 Day 7 到 Day 0（比賽日）的每日計畫
  for (let d = Math.min(daysLeft, 7); d >= 0; d--) {
    const dayDate = new Date(compDate)
    dayDate.setDate(compDate.getDate() - d)
    const dateStr = dayDate.toISOString().split('T')[0]

    // 體重預測
    const wd = weightDeltaMap[d] || { delta: 0, note: '' }
    const expectedWt = Math.round((bw + wd.delta) * 10) / 10

    let day: PeakWeekDay

    // 區分耗竭期和 IMT 脂肪補充期
    // Day 7-6：高強度耗竭訓練（真正的碳水耗竭）
    // Day 5-4：訓練強度降低，重點轉為高脂補充 IMT（肌內三酸甘油酯）
    const isIMTPhase = d >= depletionCutoffDay && d <= 5

    if (d >= depletionCutoffDay) {
      const trainingMap: Record<number, string> = {
        7: '耗竭訓練：上半身（高次數 >12RM，巨組），每肌群 3-4 組',
        6: '耗竭訓練：下半身（高次數 >12RM，巨組），每肌群 3-4 組',
        5: '輕量全身訓練（每組 >15 次）— 重點已轉為 IMT 補充，不需極度耗竭',
        4: '輕量 pump / 完全休息（從今天起不再做重訓）',
      }
      const posingMap: Record<number, string> = {
        7: 'Posing 練習 15 分鐘（正常強度，同時消耗肝醣）',
        6: 'Posing 練習 15 分鐘（正常強度）',
        5: 'Posing 練習 10 分鐘（中等強度）',
        4: 'Posing 練習 10 分鐘（輕度，避免過度消耗）',
      }
      const depletionFoodNote = isIMTPhase
        ? (isApoe4
            ? 'IMT 補充重點：MCT oil、橄欖油、酪梨、鮭魚（APOE4 → 避免牛油、奶油等高飽和脂肪來源）。少量纖維蔬菜搭配'
            : 'IMT 補充重點：酪梨、堅果、橄欖油、鮭魚、蛋黃。高脂飲食補充肌內三酸甘油酯，提升比賽日肌肉飽滿度')
        : (isApoe4
            ? '碳水來源：纖維蔬菜為主；脂肪來源：MCT oil、橄欖油、酪梨（APOE4 → 避免牛油、奶油等高飽和脂肪來源）'
            : '碳水來源：纖維蔬菜為主（花椰菜、蘆筍、菠菜）；脂肪來源：酪梨、堅果、橄欖油（補充 IMT）')
      day = {
        daysOut: d, date: dateStr,
        label: isIMTPhase ? `Day ${d} — 脂肪補充 IMT` : `Day ${d} — 碳水耗竭期`,
        phase: isIMTPhase ? 'fat_load' : 'depletion',
        carbsGPerKg: depletionCarbGPerKg,
        proteinGPerKg: PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.DEPLETION_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_BASELINE,
        sodiumMg: PEAK_WEEK.SODIUM_BASELINE,
        sodiumNote: `鈉攝取（${PEAK_WEEK.SODIUM_BASELINE}mg）— 配合灌水策略，鈉跟著水走避免低血鈉。低碳期胰島素低、腎臟排鈉增加，鈉需足量`,
        fiberNote: d <= 5 ? '開始減少纖維（目標 <15g）— 碳水來源選低纖維蔬菜（去莖花椰菜、櫛瓜、蘆筍尖）' : '正常纖維攝取',
        trainingNote: trainingMap[d] || '休息',
        carbs: Math.round(bw * depletionCarbGPerKg),
        protein: Math.round(bw * PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.DEPLETION_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_BASELINE),
        potassiumNote: `正常鉀攝取（~${PEAK_WEEK.POTASSIUM_BASELINE}mg）`,
        foodNote: depletionFoodNote,
        creatineNote: '維持肌酸 5g/天（不要停！停肌酸會流失細胞內水分和肌肉飽滿度）',
        supplementNote: supplementDepletion,
        posingNote: posingMap[d] || '輕度 Posing',
        expectedWeight: expectedWt,
        weightNote: wd.note,
      }
    } else if (d >= 4 && d < depletionCutoffDay) {
      // 基因修正（SL/SS）縮短耗竭期後，多出的中間日 → IMT 脂肪補充 + 漸進碳水提升
      // 避免直接跳入全量碳水超補（9 g/kg），改用中間碳水（3.5 g/kg）平穩過渡
      const transitionCarbGPerKg = 3.5
      day = {
        daysOut: d, date: dateStr,
        label: `Day ${d} — IMT 脂肪補充 + 過渡`,
        phase: 'fat_load' as const,
        carbsGPerKg: transitionCarbGPerKg,
        proteinGPerKg: PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.DEPLETION_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_BASELINE,
        sodiumMg: PEAK_WEEK.SODIUM_BASELINE,
        sodiumNote: `鈉攝取（${PEAK_WEEK.SODIUM_BASELINE}mg）— 過渡期維持基線鈉`,
        fiberNote: '低纖維（<12g）— 開始為碳水超補清腸',
        trainingNote: '完全休息或極輕量 pump（保存肝醣容量給超補期）',
        carbs: Math.round(bw * transitionCarbGPerKg),
        protein: Math.round(bw * PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.DEPLETION_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_BASELINE),
        potassiumNote: `正常鉀攝取（~${PEAK_WEEK.POTASSIUM_BASELINE}mg）`,
        foodNote: '過渡期：維持高脂（IMT）+ 中等碳水。脂肪來源：酪梨、堅果、橄欖油；碳水來源：白飯少量、地瓜',
        creatineNote: '維持肌酸 5g/天',
        supplementNote: supplementDepletion,
        posingNote: 'Posing 練習 10 分鐘（輕度）',
        expectedWeight: expectedWt,
        weightNote: wd.note,
      }
    } else if (d >= 2) {
      // Day 3-2：碳水超補 + 鈉加載 + 鉀加載
      // Day 2 碳水溢出防護：如果 Day 3 體重增幅超過閾值，自動降低 Day 2 碳水
      const effectiveCarb = (d === 2 && day2CarbOverride != null) ? day2CarbOverride : loadingCarb
      day = {
        daysOut: d, date: dateStr,
        label: (d === 2 && day2CarbOverride != null)
          ? `Day ${d} — 碳水超補期（已調降）`
          : `Day ${d} — 碳水超補期`,
        phase: 'carb_load',
        carbsGPerKg: effectiveCarb,
        proteinGPerKg: PEAK_WEEK.LOADING_PROTEIN_G_PER_KG,
        fatGPerKg: loadingFat,
        waterMlPerKg: PEAK_WEEK.WATER_LOADING,
        sodiumMg: PEAK_WEEK.SODIUM_LOADING,
        sodiumNote: `鈉加載（${PEAK_WEEK.SODIUM_LOADING}mg）— 鈉經 SGLT-1 幫助葡萄糖進入肌肉細胞，搭配高碳水最大化肝醣超補`,
        fiberNote: '極低纖維（<10g），避免腹脹影響比賽日外觀',
        trainingNote: '完全休息（任何訓練都會重新消耗肝醣，破壞超補效果）',
        carbs: Math.round(bw * effectiveCarb),
        protein: Math.round(bw * PEAK_WEEK.LOADING_PROTEIN_G_PER_KG),
        fat: Math.round(bw * loadingFat),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_LOADING),
        potassiumNote: `鉀加載 ~${PEAK_WEEK.POTASSIUM_LOADING}mg（香蕉、馬鈴薯、椰子水）— 鉀幫助水分進入肌肉細胞`,
        foodNote: isFemale
          ? `精緻高 GI 碳水為主：白飯、白吐司、年糕、蜂蜜、果醬。分 6-7 餐進食（女性超補量 ${effectiveCarb}g/kg，少量多餐更易執行）`
          : '精緻高 GI 碳水為主：白飯、白吐司、年糕、麻糬、蜂蜜、果醬。分 5-6 餐進食，避免單餐過量導致腸胃不適',
        creatineNote: '維持肌酸 5g/天（搭配碳水一起吃，肌酸+碳水超補可增強肝醣儲存）',
        supplementNote: supplementLoading,
        posingNote: '僅輕度 Posing 排練 5 分鐘（避免消耗超補的肝醣）',
        expectedWeight: expectedWt,
        weightNote: wd.note,
      }
    } else if (d === 1) {
      // Day 1：Taper — 碳水微降 + 水分適度減少 + 脂肪中等（防 IMT 流失）
      day = {
        daysOut: d, date: dateStr,
        label: 'Day 1 — 微調日',
        phase: 'taper',
        carbsGPerKg: taperCarb,
        proteinGPerKg: PEAK_WEEK.TAPER_PROTEIN_G_PER_KG,
        fatGPerKg: PEAK_WEEK.TAPER_FAT_G_PER_KG,
        waterMlPerKg: PEAK_WEEK.WATER_TAPER,
        sodiumMg: PEAK_WEEK.SODIUM_BASELINE,
        sodiumNote: `鈉回到基線（${PEAK_WEEK.SODIUM_BASELINE}mg）— 從超補期的高鈉緩降，不要突然斷鈉，避免醛固酮反彈導致皮下積水`,
        fiberNote: '極低纖維（<8g），避免腹脹',
        trainingNote: '完全休息（不要做任何訓練）',
        carbs: Math.round(bw * taperCarb),
        protein: Math.round(bw * PEAK_WEEK.TAPER_PROTEIN_G_PER_KG),
        fat: Math.round(bw * PEAK_WEEK.TAPER_FAT_G_PER_KG),
        calories: 0, water: Math.round(bw * PEAK_WEEK.WATER_TAPER),
        potassiumNote: `維持高鉀 ~${PEAK_WEEK.POTASSIUM_LOADING}mg（延續超補期策略）`,
        foodNote: '延續精緻碳水但量減半；少量多餐；晚餐前最後一餐加少許鹹食',
        creatineNote: '維持肌酸 5g/天',
        supplementNote: supplementTaper,
        posingNote: 'Posing 排練 5 分鐘（僅走流程，不做長時間持續收縮）',
        expectedWeight: expectedWt,
        weightNote: wd.note,
      }
    } else {
      // Day 0：比賽日 — 完整時間軸協議
      // 策略核心：前半段碳水為主（不加鈉） → 後半段鈉+簡單糖 dump → pump → 上台
      // 生理學：早期碳水進入肌肉不需要鈉（GLUT-4 insulin-mediated），
      //         最後 1-2 小時才加鈉（SGLT-1 + 血管充盈 + pump 效果）

      // 根據體重計算各餐份量
      const meal1Carbs = Math.round(bw * 1.0)     // 起床大餐：1.0 g/kg
      const meal1Protein = Math.round(bw * 0.35)   // 少量蛋白質
      const meal2Carbs = Math.round(bw * 0.6)      // 中間餐：0.6 g/kg
      const meal2Protein = Math.round(bw * 0.25)
      const meal3Carbs = Math.round(bw * 0.8)      // Pre-stage dump：0.8 g/kg（蜂蜜+運動飲料）
      const pumpSnackCarbs = Math.round(bw * 0.15) // Pump 中間小口補：0.15 g/kg

      const totalShowCarbs = meal1Carbs + meal2Carbs + meal3Carbs + pumpSnackCarbs
      const totalShowProtein = meal1Protein + meal2Protein
      const totalShowFat = Math.round(bw * 0.3)    // 極低脂肪，僅來自食物附帶

      const timeline: ShowDayMeal[] = [
        {
          timeLabel: '起床（上台前 7 小時）',
          relativeHours: -7,
          carbs: meal1Carbs, protein: meal1Protein, fat: 5,
          waterMl: 300, sodiumMg: 0,
          emoji: '🌅',
          items: [
            '量體重（目標體重確認）',
            `白飯 / 地瓜 ${meal1Carbs}g 碳水`,
            `蛋白質 ${meal1Protein}g（雞胸 / 水煮蛋）`,
            '水 300ml（小口喝）',
          ],
          note: '不加鈉 — 早期碳水經 GLUT-4 路徑進入肌肉，不需要鈉輔助。過早加鈉可能造成皮下水分滯留',
        },
        {
          timeLabel: '上台前 3 小時',
          relativeHours: -3,
          carbs: meal2Carbs, protein: meal2Protein, fat: 3,
          waterMl: 200, sodiumMg: 200,
          emoji: '🍌',
          items: [
            `蜂蜜 + 香蕉（碳水 ${meal2Carbs}g）`,
            `蛋白質 ${meal2Protein}g`,
            '水 200ml',
            '微量鈉 ~200mg（少許鹽）',
          ],
          note: '開始微量鈉 — 為最後的鈉 dump 做準備，避免突然大量鈉攝入造成不適',
        },
        {
          timeLabel: '上台前 1-1.5 小時',
          relativeHours: -1.5,
          carbs: meal3Carbs, protein: 0, fat: 0,
          waterMl: 250, sodiumMg: 700,
          emoji: '⚡',
          items: [
            'Citrulline 6-8g（增強血管擴張 + pump）',
            `蜂蜜 ${Math.round(meal3Carbs * 0.8)}g（直接擠著喝）`,
            '舒跑 / 運動飲料 200-300ml',
            `鹽 500-800mg（直接加在蜂蜜或運動飲料裡）`,
            'Caffeine 200mg（增強 pump + 專注力）',
          ],
          note: '鈉 dump — SGLT-1 鈉-葡萄糖共轉運體：鈉+糖同時攝入，最大化葡萄糖進入肌肉。鹹+甜一起灌下去，血管充盈感會非常明顯',
        },
        {
          timeLabel: '上台前 30-45 分鐘 — Pump Up',
          relativeHours: -0.5,
          carbs: pumpSnackCarbs, protein: 0, fat: 0,
          waterMl: 50, sodiumMg: 100,
          emoji: '💪',
          items: [
            '彈力帶 + 輕啞鈴',
            '專注三角肌、手臂、胸、上背',
            '每部位 2-3 組 × 12-20 下，不到力竭',
            '組間小口蜂蜜或糖果',
            '避免腿部 pump',
            '上台前 5-10 分鐘停止',
          ],
          note: '3 組彎舉就能消耗 24% 肱二頭肌肝醣 — 保持輕量！目標是充血不是訓練。如果看起來扁就多吃幾口蜂蜜+鹽，看起來水就不要再喝了',
        },
        {
          timeLabel: '上台',
          relativeHours: 0,
          carbs: 0, protein: 0, fat: 0,
          waterMl: 0, sodiumMg: 0,
          emoji: '🏆',
          items: ['爆炸！'],
          note: '上台前最後確認：肌肉飽滿度、血管充盈、姿勢。深呼吸，享受比賽',
        },
      ]

      day = {
        daysOut: 0, date: dateStr,
        label: '比賽日',
        phase: 'show_day',
        carbsGPerKg: Math.round(totalShowCarbs / bw * 10) / 10,
        proteinGPerKg: Math.round(totalShowProtein / bw * 10) / 10,
        fatGPerKg: Math.round(totalShowFat / bw * 10) / 10,
        waterMlPerKg: Math.round(800 / bw * 10) / 10,  // ~800ml 總計
        sodiumMg: 1000,  // 總計 ~1000mg，大部分在最後 1.5 小時
        sodiumNote: '鈉集中在最後 1.5 小時 — 前半段不加鈉，上台前 dump 鹽+蜂蜜+運動飲料，最大化 SGLT-1 效果和血管充盈',
        fiberNote: '幾乎零纖維（全部吃精緻碳水）',
        trainingNote: '後台 pump-up（詳見時間軸）',
        carbs: totalShowCarbs,
        protein: totalShowProtein,
        fat: totalShowFat,
        calories: 0,
        water: 800,  // 總計約 800ml（不含運動飲料）
        potassiumNote: '從運動飲料和香蕉自然攝取即可',
        foodNote: '比賽日所有食物依時間軸進食（詳見下方完整時間軸）',
        creatineNote: '比賽日可省略肌酸（非必要）',
        supplementNote: [
          'Citrulline 6-8g（上台前 1-1.5 小時）— 一氧化氮前驅物，增強血管擴張',
          'Caffeine 200mg（上台前 1-1.5 小時）— 增強 pump + 專注力',
          '維他命 C 500mg（早餐時）',
        ].join('；'),
        posingNote: '上台前反覆練習指定動作',
        pumpUpNote: '上台前 30-45 分鐘開始 pump-up：彈力帶 + 輕啞鈴。專注三角肌、手臂、胸、上背。每部位 2-3 組 x 12-20 下，不到力竭。避免腿部 pump。上台前 5-10 分鐘停止。',
        expectedWeight: expectedWt,
        weightNote: wd.note,
        showDayTimeline: timeline,
      }
    }

    // 計算熱量
    day.calories = Math.round(day.protein * 4 + day.carbs * 4 + day.fat * 9)

    // 體重回饋：實際 vs 預期比較
    if (input.peakWeekDailyWeights) {
      const actualWeight = input.peakWeekDailyWeights.find(w => w.date === dateStr)
      if (actualWeight && day.expectedWeight) {
        const diff = actualWeight.weight - day.expectedWeight
        const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
        day.weightNote = `${wd.note}（實際 ${actualWeight.weight}kg vs 預期 ${day.expectedWeight}kg，差異 ${diffStr}kg）`
      }
    }

    plan.push(day)
  }

  // 找到今天的計畫（使用 UTC+8 避免時區問題）
  const nowMs = Date.now() + 8 * 60 * 60 * 1000
  const todayStr = new Date(nowMs).toISOString().split('T')[0]
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
      ...(todayPlan.potassiumNote ? [`🍌 ${todayPlan.potassiumNote}`] : []),
      ...(todayPlan.foodNote ? [`🍽️ ${todayPlan.foodNote}`] : []),
      ...(todayPlan.creatineNote ? [`💊 ${todayPlan.creatineNote}`] : []),
      ...(todayPlan.supplementNote ? [`💊 補劑：${todayPlan.supplementNote}`] : []),
      ...(todayPlan.posingNote ? [`🪞 ${todayPlan.posingNote}`] : []),
      ...(todayPlan.pumpUpNote ? [`💪 ${todayPlan.pumpUpNote}`] : []),
      ...(todayPlan.expectedWeight ? [`⚖️ 預估體重 ${todayPlan.expectedWeight}kg — ${todayPlan.weightNote}`] : []),
      '⚠️ 重要：不要突然斷水或斷鈉！醛固酮反彈會導致皮下水分滯留，效果適得其反',
      // 女性黃體期警告：水分操控效果不穩定
      ...(isFemale && cycleInfo?.inLutealPhase ? [
        '🩸 ⚠️ 目前處於黃體期 — 孕酮升高會導致額外水分滯留，Peak Week 水分操控效果可能不如預期。視覺評估時需考慮荷爾蒙因素，不要過度反應體重數字。',
      ] : []),
      // 碳水超補量說明（體重調整 + 女性調整）
      ...(loadingCarb !== baseLoadingCarb ? [
        `📋 碳水超補量已依體重調整：${loadingCarb}g/kg（基準 ${baseLoadingCarb}g/kg）— 體重 ${bw}kg 時絕對量為 ${Math.round(bw * loadingCarb)}g，維持在腸胃可負荷範圍（Kistler 2024: 建議範圍 3-12g/kg）`,
      ] : []),
      ...(isFemale ? [
        `📋 女性碳水超補量已調整為 ${loadingCarb}g/kg（男性基準 ${PEAK_WEEK.LOADING_CARB_G_PER_KG}g/kg）— 女性肌肉肝醣超補反應約為男性 50-70%（Tarnopolsky 1995, James 2001），過量碳水只會增加腸胃不適而非更多肝醣儲存。`,
      ] : []),
      // 碳水溢出防護警告
      ...(spillOverWarning ? [spillOverWarning] : []),
      // 基因修正警告
      ...geneticCorrections.map(gc => `🧬 ${gc.adjustment}`),
    ],
    currentState: 'unknown' as const, readinessScore: null, wearableInsight: null, refeedSuggested: false, refeedReason: null, refeedDays: null,
    bodyFatZoneInfo: buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType),
    deadlineInfo: { daysLeft, weeksLeft: Math.round(daysLeft / 7 * 10) / 10, weightToLose: 0, requiredRatePerWeek: 0, isAggressive: false },
    autoApply: true, tdeeAnomalyDetected: false,
    labMacroModifiers: pwLabMacroMods, labTrainingModifiers: pwLabTrainingMods, energyAvailability: null,
    peakWeekPlan: plan, metabolicStress: null,
    menstrualCycleNote: cycleInfo?.note ?? null,
    perMealProteinGuide: buildPerMealProteinGuide(bw, Math.round(bw * PEAK_WEEK.DEPLETION_PROTEIN_G_PER_KG)),
    geneticCorrections,
  }
}

// ===== 自主管理初始目標計算 =====
// 用於 Onboarding 時直接從 InBody 數據算出初始 TDEE + 營養目標
// 不需要 2 週體重數據，有體脂率用 Katch-McArdle，無體脂率用簡化公式

export interface InitialTargetInput {
  gender: string          // '男性' | '女性'
  bodyWeight: number      // kg
  height?: number | null  // cm
  bodyFatPct?: number | null  // % (e.g. 20 = 20%)
  goalType: 'cut' | 'bulk' | 'recomp'
  activityProfile?: 'sedentary' | 'high_energy_flux'
  trainingDaysPerWeek?: number
}

export interface InitialTargetResult {
  estimatedTDEE: number
  calories: number
  protein: number
  carbs: number
  fat: number
  deficit: number  // 正=赤字, 負=盈餘
  method: 'katch_mcardle' | 'fallback'  // TDEE 計算方式
  bodyFatZoneInfo: NutritionSuggestion['bodyFatZoneInfo']
}

export function calculateInitialTargets(input: InitialTargetInput): InitialTargetResult {
  const isMale = input.gender === '男性'
  const bw = input.bodyWeight
  const trainingDays = input.trainingDaysPerWeek ?? 3

  // 1. 計算 TDEE
  let estimatedTDEE: number
  let method: 'katch_mcardle' | 'fallback'

  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    // Katch-McArdle: BMR = 370 + 21.6 × LBM(kg)
    const lbm = bw * (1 - input.bodyFatPct / 100)
    const bmr = 370 + 21.6 * lbm
    const multiplier = getActivityMultiplier(input.activityProfile, trainingDays)
    estimatedTDEE = Math.round(bmr * multiplier)
    method = 'katch_mcardle'
  } else {
    const multiplier = getFallbackTDEEMultiplier(input.activityProfile, isMale)
    estimatedTDEE = Math.round(bw * multiplier)
    method = 'fallback'
  }

  // 2. 根據目標計算赤字/盈餘
  let deficit: number
  if (input.goalType === 'cut') {
    // 保守赤字 300-400kcal（非備賽不需激進）
    deficit = Math.min(400, Math.round(estimatedTDEE * 0.18))
    deficit = Math.max(200, deficit)  // 至少 200
  } else if (input.goalType === 'recomp') {
    // 體態重組：維持 TDEE 或微赤字 (0~-150 kcal)
    // 目標是降體脂 + 增肌，體重可能不變
    // 文獻支持：訓練新手或體脂較高者可在等熱量下同時增肌減脂
    // 蛋白質拉高（在下方 macro 分配處理）
    deficit = Math.min(150, Math.round(estimatedTDEE * 0.05))
    deficit = Math.max(0, deficit)
  } else {
    // 增肌：優先使用 zone table 的 surplusKcal（依體脂區間文獻校準）
    // Iraki 2019 [4]: surplus +10-20%；各 zone 有更精確的 surplusKcal 範圍
    if (input.bodyFatPct != null && input.bodyFatPct > 0) {
      const zone = getBodyFatZone(toZoneGender(input.gender), input.bodyFatPct)
      if (zone) {
        const midSurplus = (zone.bulk.surplusKcal.min + zone.bulk.surplusKcal.max) / 2
        deficit = -Math.round(midSurplus)
      } else {
        deficit = -Math.min(300, Math.round(estimatedTDEE * 0.12))
      }
    } else {
      // 無體脂率 → fallback 保守盈餘 200-300kcal
      deficit = -Math.min(300, Math.round(estimatedTDEE * 0.12))
      deficit = Math.max(-300, deficit)
    }
  }

  const targetCalories = estimatedTDEE - deficit

  // 3. 安全下限
  const minCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE
  const finalCalories = Math.max(targetCalories, minCal)

  // 4. 巨量營養素分配
  // 有體脂區間 → 用 getZoneMacros() 取得基於文獻的精確建議
  // 無體脂區間 → fallback 男女固定值
  // recomp 用 cut 的蛋白質水準（較高），因為需要高蛋白支持肌肉合成
  const macroGoalType = input.goalType === 'recomp' ? 'cut' : input.goalType
  const zoneInfo = buildBodyFatZoneInfo(input.gender, input.bodyFatPct, macroGoalType)

  let protein: number
  let fat: number
  let carbs: number

  if (input.bodyFatPct != null && input.bodyFatPct > 0 && zoneInfo) {
    // 用 getZoneMacros() 取得 protein/fat（含 overweight 體重校正）
    // 但不用它的 calories/carbs → 改用 finalCalories 算碳水，避免 zone 赤字 ≠ 函數赤字
    // recomp 用 cut 的蛋白質標準（2.0+ g/kg），確保肌肉合成
    const zoneMacros = getZoneMacros({
      gender: toZoneGender(input.gender),
      bodyWeight: bw,
      bodyFatPct: input.bodyFatPct,
      goalType: macroGoalType,
      estimatedTDEE: estimatedTDEE,
    })
    protein = zoneMacros.protein
    fat = zoneMacros.fat
    // 碳水 = finalCalories 扣掉蛋白質+脂肪的剩餘
    const remainingCal = finalCalories - (protein * 4) - (fat * 9)
    carbs = Math.max(50, Math.round(remainingCal / 4))
  } else {
    // Fallback: 固定 g/kg
    // recomp 用 cut 的高蛋白標準
    const proteinPerKg = (input.goalType === 'cut' || input.goalType === 'recomp')
      ? (isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE)
      : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE)
    protein = Math.round(bw * proteinPerKg)

    const fatPerKg = isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
    fat = Math.round(bw * fatPerKg)

    const remainingCal = finalCalories - (protein * 4) - (fat * 9)
    carbs = Math.max(50, Math.round(remainingCal / 4))
  }

  return {
    estimatedTDEE,
    calories: finalCalories,
    protein,
    carbs,
    fat,
    deficit: estimatedTDEE - finalCalories,
    method,
    bodyFatZoneInfo: zoneInfo,
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

// Re-export from extracted module for backward compatibility
export { calcRecommendedStageWeight, type RecommendedStageWeightResult } from './stage-weight'


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
  bodyFatZoneInfo: NutritionSuggestion['bodyFatZoneInfo']
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
    // 增肌：優先使用 zone table 的 surplusKcal（依體脂區間文獻校準）
    if (input.bodyFatPct != null && input.bodyFatPct > 0) {
      const zone = getBodyFatZone(toZoneGender(input.gender), input.bodyFatPct)
      if (zone) {
        const midSurplus = (zone.bulk.surplusKcal.min + zone.bulk.surplusKcal.max) / 2
        dailyDeficit = -Math.round(midSurplus)
      } else {
        dailyDeficit = -250
      }
    } else {
      // 無體脂率 → fallback +250kcal（ISSN off-season recommendation）
      dailyDeficit = -250
    }
  }

  // 3. 參考熱量
  let suggestedCalories = estimatedTDEE - dailyDeficit
  const minCal = isMale ? SAFETY.MIN_CALORIES_MALE : SAFETY.MIN_CALORIES_FEMALE
  if (suggestedCalories < minCal) {
    suggestedCalories = minCal
    dailyDeficit = estimatedTDEE - minCal
    safetyNotes.push(`已套用安全底線 ${minCal} kcal，避免代謝過度下降。`)
  }

  // 4. 巨量營養素（有體脂區間用 zone macros，否則 fallback）
  const zoneInfo = buildBodyFatZoneInfo(input.gender, input.bodyFatPct, input.goalType)
  let suggestedProtein: number
  let suggestedFat: number
  let suggestedCarbs: number

  if (input.bodyFatPct != null && input.bodyFatPct > 0 && zoneInfo) {
    // 用 getZoneMacros() 取得 protein/fat（含 overweight 體重校正）
    // 碳水用 suggestedCalories 反算，避免 zone 赤字 ≠ 函數赤字造成 macro-calorie 不一致
    const zoneMacros = getZoneMacros({
      gender: toZoneGender(input.gender),
      bodyWeight: bw,
      bodyFatPct: input.bodyFatPct,
      goalType: input.goalType,
      estimatedTDEE: estimatedTDEE,
    })
    suggestedProtein = zoneMacros.protein
    suggestedFat = zoneMacros.fat
    const remainingCals = suggestedCalories - (suggestedProtein * 4) - (suggestedFat * 9)
    suggestedCarbs = Math.max(30, Math.round(remainingCals / 4))
  } else {
    const proteinPerKg = input.goalType === 'cut'
      ? (isMale ? SAFETY.MIN_PROTEIN_PER_KG_CUT : SAFETY.MIN_PROTEIN_PER_KG_CUT_FEMALE)
      : (isMale ? SAFETY.MIN_PROTEIN_PER_KG_BULK : SAFETY.MIN_PROTEIN_PER_KG_BULK_FEMALE)
    const fatPerKg = isMale ? SAFETY.MIN_FAT_PER_KG : SAFETY.MIN_FAT_PER_KG_FEMALE
    suggestedProtein = Math.round(bw * proteinPerKg)
    suggestedFat = Math.round(bw * fatPerKg)
    const remainingCals = suggestedCalories - (suggestedProtein * 4) - (suggestedFat * 9)
    suggestedCarbs = Math.max(30, Math.round(remainingCals / 4))
  }

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
    bodyFatZoneInfo: zoneInfo,
  }
}
