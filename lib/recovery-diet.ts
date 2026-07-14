/**
 * Recovery Diet — 減脂/備賽結束後的恢復飲食引擎
 *
 * ⚠️ 這不是 reverse diet。這是刻意的取代。
 *
 * 「Reverse diet」（每週小幅加熱量、宣稱能把代謝養回來）**沒有實證支持**：
 *   - PubMed 全庫 "reverse dieting"[Title/Abstract] 只有 1 篇命中，且是質性訪談（Buechel 2025, PMID 41107212）。
 *     零篇完整同儕審查的介入研究。
 *   - Lima 2022 scoping review（PMID 35966021）逐字：reverse dieting "remains a theoretical concept"
 *     且 "might slow physiological recovery as it prolongs fat restoration"。
 *   - 唯一直接比較的隨機實驗只存在於 ISSN 年會會議摘要（Rodriguez Da Silva / Campbell 2025, PMC12381988）：
 *     REV vs 立刻回維持 vs ad libitum，體重回增 3.68% / 2.73% / 1.30%，p=0.053 未達顯著；
 *     REV 組退出率 45.2% 最高；且該研究**只測體重，沒測 RMR**。
 *
 * 有證據支持的模型：**恢復是「體重與能量可用性回升」帶動的，不是「加熱量的速度慢」帶動的。**
 *   - Lima 2022：RMR 恢復關聯的是 "total body mass and fat restoration"；
 *     回增最少的人 RMR 與內分泌恢復最差；一名女性立刻 +97% 熱量，10 週內 RMR 與月經全面恢復。
 *   - Chappell / Trexler / Helms 2021（PMID 34401005）：賽後 2 個月回增 7.9 kg（87% 脂肪），
 *     生理指標多數回基線 —— "rapid bodyweight and bodyfat regain ... likely aided prompt recovery"。
 *   - Pardue / Trexler 2017（PMID 28770669）：恢復期實際執行慢速 reverse（每週 +碳水 10-30g），
 *     做了 5 個月**仍未完全恢復**。
 *
 * 因此本引擎：**第一週就回到維持熱量**，然後用兩個煞車與一個方向盤控制。
 *   方向盤：體重回增速率（目標 +0.5~1.0% BW/週，1-2 個月回到基線體脂）
 *   煞車 1（最高優先）：能量可用性 EA 底線 —— 男 25 / 女 30 kcal/kg FFM（Fagerberg 2018, PMID 28530498）
 *   煞車 2：體脂過衝 —— 超過基線 +5 個百分點且已恢復 → 停止加熱量
 *
 * 其他寫死的證據點：
 *   - 蛋白 ≥ 2.0 g/kg 全程不降（Lima 2022 明文；恢復期保瘦體重）
 *   - 脂肪 ≥ 0.5 g/kg（極低脂壓睪固酮；Helms 2014, PMID 24864135）
 *   - 加熱量時碳水:脂肪 ≈ 70:30（先恢復肝醣與訓練表現）
 *   - 阻力訓練**不准停**（Lima 2022：搶回瘦體重的必要條件）；有氧階梯式下調（拉高 EA 最快的槓桿）
 *
 * 完整證據與三類分離（有證據 / Helms 實務建議 / 圈內迷思）見
 * ~/.claude/.../memory/project_v3_recovery_diet_evidence.md
 */

// ═══════════════════════════════════════
// Constants（改這裡之前先讀上面的引用）
// ═══════════════════════════════════════

/** EA 硬底線 kcal/kg FFM/day — Fagerberg 2018 (PMID 28530498) */
export const EA_FLOOR_MALE = 25
export const EA_FLOOR_FEMALE = 30

/** 恢復期蛋白質下限 g/kg 體重 — Lima 2022 (PMID 35966021) */
export const RECOVERY_PROTEIN_PER_KG = 2.0

/** 恢復期脂肪下限 g/kg 體重 — 極低脂壓睪固酮 (Helms 2014, PMID 24864135) */
export const RECOVERY_FAT_FLOOR_PER_KG = 0.5
/**
 * 恢復期脂肪上限 g/kg 體重。
 * 有上限是因為碳水優先（先恢復肝醣與訓練表現），但不設上限的話高維持量的人脂肪會失控。
 */
export const RECOVERY_FAT_CAP_PER_KG = 1.2
/**
 * 脂肪佔總熱量的比例。25% 落在 Helms 2014 建議的 15-30% 區間中段。
 * ⚠️ 不要改回「脂肪 = 固定 g/kg」——那會讓維持熱量高的人把所有餘數倒進碳水（實測 90kg 的人吃到 469g）。
 */
export const RECOVERY_FAT_PCT_OF_KCAL = 0.25

/** 目標體重回增速率（% 體重/週）：1-2 個月回到基線體脂 — Roberts, 引自 Lima 2022 */
export const TARGET_REGAIN_PCT_PER_WEEK_MIN = 0.5
export const TARGET_REGAIN_PCT_PER_WEEK_MAX = 1.0

/** 恢復失速判定：4 週後總回增 < 2% 體重 → 加熱量（回增最少者恢復最差） */
export const STALL_CHECK_WEEKS = 4
export const STALL_REGAIN_PCT_THRESHOLD = 2.0

/** 體脂過衝煞車：超過賽前基線 + N 個百分點 — Fagerberg 2018 "body fat overshoot" */
export const FAT_OVERSHOOT_PP_OVER_BASELINE = 5

/**
 * 沒有記錄賽前基線體脂時的 fallback 上限：離開 athletic 區間的上緣就算過衝。
 * 取自 body-fat-zone-table 的 athletic zone bfMax（男 17 / 女 25），不是自己編的數字。
 */
export const ATHLETIC_ZONE_BF_CEILING_MALE = 17
export const ATHLETIC_ZONE_BF_CEILING_FEMALE = 25

/** 加熱量時的碳水:脂肪 分配 */
export const SURPLUS_CARB_RATIO = 0.7

/** 回增太快時的單次減量、失速時的單次加量（kcal） */
export const CALORIE_STEP = 200

/** ad libitum 只當 1-2 週短期閥門，不得延長（Lima 2022） */
export const AD_LIBITUM_MAX_DAYS = 14

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export type RecoveryPhase =
  | 'return_to_maintenance'  // 第 1 週：直接回到維持熱量
  | 'restoring'              // 回增進行中，用速率當方向盤
  | 'stalled'                // 回增失速（恢復最差的訊號）→ 加熱量
  | 'complete'               // 體脂/體重回到基線區間 → 轉 lean bulk

export interface RecoveryDietInput {
  bodyWeight: number
  gender: string                      // '男性' | '女性'
  bodyFatPct: number | null           // 目前體脂 %
  height?: number | null
  /** 賽前/減脂前的基線體脂 %（沒有就用 targetBodyFat 或 fallback） */
  baselineBodyFatPct: number | null
  daysSinceCompetition: number
  trainingDaysPerWeek: number
  activityProfile?: 'sedentary' | 'high_energy_flux'
  /** week 0 = 本週, 1 = 上週 … 用來算回增速率 */
  weeklyWeights: { week: number; avgWeight: number }[]
  currentCalories: number | null
  cardioMinutesPerDay?: number | null
}

export interface RecoveryDietResult {
  phase: RecoveryPhase
  calories: number
  protein: number
  carbs: number
  fat: number
  maintenanceCalories: number
  water: number

  /** 方向盤：實際回增速率（% 體重/週），資料不足為 null */
  regainRatePctPerWeek: number | null
  /** 煞車 1：能量可用性 */
  energyAvailability: { eaKcalPerKgFFM: number; floor: number; breached: boolean } | null
  /** 煞車 2：體脂過衝 */
  fatOvershoot: boolean

  warnings: string[]
  /** 給教練/學員的具體動作（不是精神喊話） */
  actions: string[]
  /** 訓練面指引 —— 阻力訓練不停、有氧階梯下調 */
  trainingGuidance: string[]
}

// ═══════════════════════════════════════
// Core
// ═══════════════════════════════════════

/** 活動係數（與 nutrition-engine 的 getActivityMultiplier 對齊） */
function activityMultiplier(profile: string | undefined, trainingDays: number): number {
  if (profile === 'sedentary') return trainingDays >= 4 ? 1.45 : 1.35
  if (profile === 'high_energy_flux') return trainingDays >= 4 ? 1.75 : 1.65
  return trainingDays >= 4 ? 1.6 : 1.5
}

/**
 * 恢復期的維持熱量。
 *
 * ⚠️ 刻意**不套**減脂期那個 -10% 代謝適應折扣。備賽末期 RMR 確實被壓低（Pardue 2017 掉到預測值的
 * 81.2%），但恢復的機制正是「餵到未適應的維持量，靠體重與能量可用性把 RMR 拉回來」。
 * 照著被壓低的 TDEE 餵，只會把壓低狀態固定住。
 */
export function estimateRecoveryMaintenance(input: RecoveryDietInput): number {
  const isMale = input.gender !== '女性'
  const mult = activityMultiplier(input.activityProfile, input.trainingDaysPerWeek)

  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    // Katch-McArdle: BMR = 370 + 21.6 × LBM
    const lbm = input.bodyWeight * (1 - input.bodyFatPct / 100)
    return Math.round((370 + 21.6 * lbm) * mult)
  }
  // 無體脂 → 簡化公式（與 nutrition-engine 的 fallback 對齊）
  let base = isMale ? 30 : 27
  if (input.activityProfile === 'sedentary') base = isMale ? 26 : 24
  else if (input.activityProfile === 'high_energy_flux') base = isMale ? 35 : 31
  const days = input.trainingDaysPerWeek === 0 ? 3 : input.trainingDaysPerWeek
  if (days >= 6) base += 3
  else if (days >= 4) base += 2
  else if (days >= 3) base += 1
  return Math.round(input.bodyWeight * base)
}

/** 回增速率（% 體重/週）。需要至少 2 週資料，否則 null。 */
export function calcRegainRate(weeklyWeights: { week: number; avgWeight: number }[]): number | null {
  if (weeklyWeights.length < 2) return null
  const sorted = [...weeklyWeights].sort((a, b) => a.week - b.week)
  const current = sorted[0].avgWeight          // week 0 = 本週
  const oldest = sorted[sorted.length - 1].avgWeight
  const weeksSpan = sorted[sorted.length - 1].week - sorted[0].week
  if (weeksSpan <= 0 || oldest <= 0) return null
  const totalPct = ((current - oldest) / oldest) * 100
  return Math.round((totalPct / weeksSpan) * 100) / 100
}

/** 估算每日運動消耗（與 nutrition-engine 的 EA 算法對齊） */
function estimateExerciseKcal(input: RecoveryDietInput): number {
  const resistance = (input.trainingDaysPerWeek * 450) / 7
  const cardio = (input.cardioMinutesPerDay ?? 0) * 8
  return resistance + cardio
}

export function generateRecoveryDiet(input: RecoveryDietInput): RecoveryDietResult {
  const bw = input.bodyWeight
  const isMale = input.gender !== '女性'
  const warnings: string[] = []
  const actions: string[] = []

  const maintenance = estimateRecoveryMaintenance(input)
  const regainRate = calcRegainRate(input.weeklyWeights)
  const weeksSinceComp = input.daysSinceCompetition / 7

  // ── 煞車 2：體脂過衝 ──────────────────────────
  // 有記錄賽前基線 → 基線 + 5pp；沒有 → 用 athletic 區間上緣當 fallback（男 17 / 女 25）
  const baselineBF = input.baselineBodyFatPct
  const overshootCeiling =
    baselineBF != null
      ? baselineBF + FAT_OVERSHOOT_PP_OVER_BASELINE
      : isMale
        ? ATHLETIC_ZONE_BF_CEILING_MALE
        : ATHLETIC_ZONE_BF_CEILING_FEMALE
  const fatOvershoot = input.bodyFatPct != null && input.bodyFatPct > overshootCeiling

  // ── 相位判定 ──────────────────────────────────
  let phase: RecoveryPhase
  if (fatOvershoot) {
    phase = 'complete'
  } else if (input.daysSinceCompetition <= 7) {
    phase = 'return_to_maintenance'
  } else if (
    weeksSinceComp >= STALL_CHECK_WEEKS &&
    regainRate != null &&
    regainRate * STALL_CHECK_WEEKS < STALL_REGAIN_PCT_THRESHOLD
  ) {
    phase = 'stalled'
  } else if (
    baselineBF != null &&
    input.bodyFatPct != null &&
    input.bodyFatPct >= baselineBF
  ) {
    phase = 'complete'
  } else {
    phase = 'restoring'
  }

  // ── 熱量：起點一律是維持量，不是「當前 + 100」 ──
  let calories = maintenance

  if (phase === 'stalled') {
    // 回增失速 = 恢復最差的訊號（Lima 2022）→ 往上加，不是往下修
    calories = maintenance + CALORIE_STEP
    warnings.push(
      `📉 恢復失速：${STALL_CHECK_WEEKS} 週只回增 ${(regainRate! * STALL_CHECK_WEEKS).toFixed(1)}%（門檻 ${STALL_REGAIN_PCT_THRESHOLD}%）。回增最少的人代謝與內分泌恢復最差 —— 這時候要加熱量，不是撐住。`
    )
    actions.push(`熱量往上加 ${CALORIE_STEP} kcal（${maintenance} → ${calories}），以碳水為主`)
  } else if (phase === 'restoring' && regainRate != null && regainRate > TARGET_REGAIN_PCT_PER_WEEK_MAX) {
    // 回增太快 → 收一點，但絕不低於維持量以下太多
    calories = Math.max(maintenance - CALORIE_STEP, Math.round(maintenance * 0.9))
    warnings.push(
      `⚡ 回增偏快（${regainRate}% 體重/週，目標 ${TARGET_REGAIN_PCT_PER_WEEK_MIN}-${TARGET_REGAIN_PCT_PER_WEEK_MAX}%）。收 ${CALORIE_STEP} kcal，但不要回去節食 —— 恢復期的體重回升是機制不是失敗。`
    )
    actions.push(`熱量收到 ${calories} kcal（仍在維持量附近）`)
  } else if (phase === 'complete') {
    calories = maintenance
    if (fatOvershoot) {
      warnings.push(
        baselineBF != null
          ? `🛑 體脂已超過賽前基線 +${FAT_OVERSHOOT_PP_OVER_BASELINE} 個百分點（目前 ${input.bodyFatPct}%，基線 ${baselineBF}%）。停止往上加熱量，轉入 lean bulk 或維持。`
          : `🛑 體脂 ${input.bodyFatPct}% 已高於 ${overshootCeiling}%（沒有記錄賽前基線，用一般運動員區間上緣判定）。停止往上加熱量，轉入 lean bulk 或維持。`
      )
      actions.push('把 prep_phase 從 recovery 改成 bulk（lean bulk）或 off_season')
    } else {
      actions.push('體脂已回到基線區間 —— 恢復期完成，可以轉 lean bulk 或設定下一個目標')
    }
  }

  // ── 巨量營養素 ────────────────────────────────
  // 蛋白：≥2.0 g/kg，全程不降（Lima 2022：恢復期保瘦體重）
  const protein = Math.round(bw * RECOVERY_PROTEIN_PER_KG)

  // 脂肪：佔總熱量 25%，但夾在 0.5–1.2 g/kg 之間。
  // 用「比例」而不是「固定 g/kg」，否則維持熱量高的人餘數會全部倒進碳水。
  const fatFloor = Math.round(bw * RECOVERY_FAT_FLOOR_PER_KG)
  const fatCap = Math.round(bw * RECOVERY_FAT_CAP_PER_KG)
  let finalFat = Math.min(
    fatCap,
    Math.max(fatFloor, Math.round((calories * RECOVERY_FAT_PCT_OF_KCAL) / 9))
  )

  // 碳水 = 餘數（碳水優先：先恢復肝醣與訓練表現）
  let carbs = Math.round((calories - protein * 4 - finalFat * 9) / 4)

  // 碳水被擠得太低（< 2 g/kg）→ 先把脂肪往底線砍，碳水優先
  const carbFloor = Math.round(bw * 2.0)
  if (carbs < carbFloor) {
    const fatFromCarbNeed = Math.round((calories - protein * 4 - carbFloor * 4) / 9)
    finalFat = Math.max(fatFloor, fatFromCarbNeed)
    carbs = Math.round((calories - protein * 4 - finalFat * 9) / 4)
  }
  carbs = Math.max(carbs, Math.round(bw * 1.5))

  // 熱量回填（吸收四捨五入誤差，讓 P/C/F 加總 == calories）
  calories = protein * 4 + carbs * 4 + finalFat * 9

  // ── 煞車 1（最高優先）：EA 底線 ────────────────
  let energyAvailability: RecoveryDietResult['energyAvailability'] = null
  const eaFloor = isMale ? EA_FLOOR_MALE : EA_FLOOR_FEMALE
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    const ffm = bw * (1 - input.bodyFatPct / 100)
    const exerciseKcal = estimateExerciseKcal(input)
    let ea = ffm > 0 ? (calories - exerciseKcal) / ffm : 0

    if (ffm > 0 && ea < eaFloor) {
      // 強制加熱量到越過門檻 —— 無視體脂目標，這是最高優先的煞車
      const minCals = Math.round(eaFloor * ffm + exerciseKcal)
      const bumped = minCals - calories
      // 重算脂肪與碳水（同一套比例規則），再把熱量回填成 P/C/F 的加總，避免漂移
      finalFat = Math.min(fatCap, Math.max(fatFloor, Math.round((minCals * RECOVERY_FAT_PCT_OF_KCAL) / 9)))
      carbs = Math.max(
        Math.round(bw * 1.5),
        Math.round((minCals - protein * 4 - finalFat * 9) / 4)
      )
      calories = protein * 4 + carbs * 4 + finalFat * 9
      ea = (calories - exerciseKcal) / ffm
      warnings.push(
        `🚨 能量可用性低於底線（${eaFloor} kcal/kg 瘦體重）—— 已強制把熱量拉到 ${calories} kcal（+${bumped}）。EA 過低會壓睪固酮、骨密度、免疫力，這條優先於任何體脂目標。`
      )
      actions.push(`熱量強制拉到 ${calories} kcal 以越過 EA 底線`)
      // 有氧是拉高 EA 最快的槓桿
      if ((input.cardioMinutesPerDay ?? 0) > 0) {
        actions.push(`有氧從 ${input.cardioMinutesPerDay} 分鐘/天階梯式下調（每週砍一半），這是拉高 EA 最快的槓桿`)
      }
    }

    energyAvailability = {
      eaKcalPerKgFFM: Math.round(ea * 10) / 10,
      floor: eaFloor,
      breached: ea < eaFloor,
    }
  }

  // ── 訓練指引（證據明確，常被漏掉）────────────
  const trainingGuidance: string[] = [
    '💪 阻力訓練不准停 —— 恢復期繼續結構化課表是搶回瘦體重的必要條件（Lima 2022）。這跟「賽後休息兩週不練」的直覺相反，但證據站在繼續練這邊。',
    '🏃 有氧階梯式下調，不要一次砍光 —— 這是拉高能量可用性最快的槓桿。',
  ]
  if (input.daysSinceCompetition <= AD_LIBITUM_MAX_DAYS) {
    trainingGuidance.push('🍽️ 賽後 1-2 週可以允許一定程度的隨性進食（滿足 refeeding 衝動），但不要延長成常態。')
  }

  // ── 一般性 warnings ───────────────────────────
  if (phase === 'return_to_maintenance') {
    warnings.push(
      `🔄 賽後恢復：第 1 週直接回到維持熱量 ${maintenance} kcal —— 不做慢速 reverse。證據顯示恢復是靠體重與能量可用性回升帶動的，慢慢爬只會拖長恢復（Lima 2022）。`
    )
    actions.push(`熱量直接設到維持量 ${calories} kcal（不是每天 +100 慢慢加）`)
  }
  if (regainRate == null && input.daysSinceCompetition > 14) {
    warnings.push('📊 體重資料不足，無法判斷回增速率。恢復期的方向盤就是體重趨勢 —— 請每天早上空腹量體重。')
  }

  const expectedTimeline =
    '⏱️ 預期時間軸：RMR 約 4-6 週到 6 個月；睪固酮男性多數 4-6 週回基線。體重與體脂回升是恢復的機制，不是副作用。'
  warnings.push(expectedTimeline)

  return {
    phase,
    calories,
    protein,
    carbs,
    fat: finalFat,
    maintenanceCalories: maintenance,
    water: Math.round(bw * 40),
    regainRatePctPerWeek: regainRate,
    energyAvailability,
    fatOvershoot,
    warnings,
    actions,
    trainingGuidance,
  }
}

export const RECOVERY_PHASE_LABELS: Record<RecoveryPhase, string> = {
  return_to_maintenance: '回到維持',
  restoring: '恢復中',
  stalled: '恢復失速',
  complete: '恢復完成',
}
