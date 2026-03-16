/**
 * Recovery Engine — 統一恢復評估引擎
 *
 * 整合並擴展散落在 body-fat-zone-table / ai-insights / nutrition-engine 的恢復邏輯，
 * 成為所有引擎消費恢復數據的單一來源（Single Source of Truth）。
 *
 * 新增功能：
 *   1. 多系統恢復評估（神經/肌肉/代謝/荷爾蒙/心理）
 *   2. 過度訓練風險偵測（ACWR 急慢性負荷比 + 單調性 + 訓練負荷）
 *   3. 自律神經平衡（HRV/RHR 趨勢推斷交感/副交感主導）
 *   4. 恢復軌跡趨勢（7 天滾動，判斷改善/穩定/退化）
 *   5. 個人化基線（SWC = 0.5×SD，超過才有意義的變化）
 *
 * 文獻依據：
 *   - Gabbett 2016 (BJSM): ACWR 0.8-1.3 安全區
 *   - Hulin 2014: 訓練負荷單調性與傷害風險
 *   - Plews 2013: HRV 指導訓練 vs 預定計劃
 *   - Buchheit 2014: HRV 用於監控訓練適應
 *   - Meeusen 2013: ECSS/ACSM — 過度訓練預防與診斷
 *   - Saw 2015: 主觀指標在訓練監控的敏感性
 *   - Nature 2025 Scientific Reports: 主觀+客觀整合 > 單一來源
 */

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export type RecoveryState = 'optimal' | 'good' | 'struggling' | 'critical'

/** 各子系統恢復狀態 */
export interface SystemRecovery {
  score: number            // 0-100
  state: RecoveryState
  signals: string[]        // 判斷依據
}

/** 過度訓練風險 */
export interface OvertrainingRisk {
  /** 急性:慢性負荷比 — 安全區 0.8-1.3 (Gabbett 2016) */
  acwr: number | null
  /** 訓練單調性 — >2.0 高風險 (Foster 1998) */
  monotony: number | null
  /** 訓練負荷 (monotony × weekly load) — >6000 AU 傷害風險↑ */
  strain: number | null
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high'
  reasons: string[]
}

/** 自律神經平衡 */
export interface AutonomicBalance {
  status: 'parasympathetic_dominant' | 'balanced' | 'sympathetic_dominant' | 'unknown'
  hrvTrend: 'rising' | 'stable' | 'declining' | 'unknown'
  rhrTrend: 'rising' | 'stable' | 'declining' | 'unknown'
  /** HRV 相對於個人基線的 z-score */
  hrvZScore: number | null
  /** RHR 相對於個人基線的 z-score */
  rhrZScore: number | null
  reasons: string[]
}

/** 完整恢復評估結果 */
export interface RecoveryAssessment {
  // ── 核心指標 ──
  /** 綜合恢復分數 0-100 */
  score: number
  /** 四級狀態 */
  state: RecoveryState
  /** 穿戴裝置 readiness（device_recovery_score 為主，個別指標 z-score 為輔） */
  readinessScore: number | null

  // ── 多系統分解 ──
  systems: {
    /** 中樞神經：HRV、反應速度代理(energy+focus) */
    neural: SystemRecovery
    /** 肌肉骨骼：訓練負荷、RPE 趨勢、延遲性痠痛代理 */
    muscular: SystemRecovery
    /** 代謝：能量水平、碳水狀態、leptin 代理（飲食持續時間） */
    metabolic: SystemRecovery
    /** 荷爾蒙：血檢（皮質醇、睪固酮）、睡眠品質、月經 */
    hormonal: SystemRecovery
    /** 心理：情緒、訓練動力、壓力 */
    psychological: SystemRecovery
  }

  // ── 進階分析 ──
  overtrainingRisk: OvertrainingRisk
  autonomicBalance: AutonomicBalance

  /** 恢復軌跡：基於 7 天滾動趨勢 */
  trajectory: 'improving' | 'stable' | 'declining' | 'unknown'

  // ── 建議 ──
  recommendations: RecoveryRecommendation[]
  reasons: string[]
}

export interface RecoveryRecommendation {
  priority: 'high' | 'medium' | 'low'
  category: 'sleep' | 'nutrition' | 'training' | 'stress' | 'medical'
  message: string
}

// ── 輸入 ──

export interface WellnessEntry {
  date: string
  sleep_quality?: number | null    // 1-5
  energy_level?: number | null     // 1-5
  mood?: number | null             // 1-5
  stress?: number | null           // 1-5
  training_drive?: number | null   // 1-5
  // 穿戴裝置
  device_recovery_score?: number | null  // 0-100
  resting_hr?: number | null             // bpm
  hrv?: number | null                    // ms (RMSSD)
  wearable_sleep_score?: number | null   // 0-100
  respiratory_rate?: number | null       // 次/分
}

export interface TrainingLogEntry {
  date: string
  training_type?: string | null
  rpe?: number | null              // 1-10
  duration?: number | null         // minutes
  sets?: number | null
}

export interface LabEntry {
  test_name: string
  value: number | null
  unit?: string
  status?: 'normal' | 'attention' | 'alert'
}

export interface RecoveryInput {
  wellness: WellnessEntry[]             // 建議 30 天（前 3 天 = 當前，4-30 = 基線）
  trainingLogs: TrainingLogEntry[]      // 建議 28 天（ACWR 需 4 週）
  labResults?: LabEntry[]               // 最近一次血檢
  dietDurationWeeks?: number | null     // 減脂持續週數
  inLutealPhase?: boolean               // 女性黃體期
  inMenstruation?: boolean              // 經期中
  prepPhase?: 'off_season' | 'bulk' | 'cut' | 'peak_week' | 'competition' | 'recovery'
    | 'training_camp' | 'weight_cut' | 'weigh_in' | 'rebound' | null
}

// ═══════════════════════════════════════
// Utility helpers
// ═══════════════════════════════════════

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((s, v) => s + v, 0) / nums.length
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function scoreToState(score: number): RecoveryState {
  if (score >= 75) return 'optimal'
  if (score >= 50) return 'good'
  if (score >= 30) return 'struggling'
  return 'critical'
}

/** 計算基線 mean + SD + SWC (Smallest Worthwhile Change) */
function calcBaseline(vals: number[]): { mean: number; sd: number; swc: number } | null {
  if (vals.length < 5) return null
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  return { mean, sd, swc: 0.5 * sd }
}

/** z-score → 0-100 分 */
function zToScore(z: number): number {
  return clamp(50 + z * 25, 0, 100)
}

/** 計算線性趨勢斜率 (簡易最小二乘法) */
function trendSlope(values: number[]): number {
  if (values.length < 3) return 0
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  return den === 0 ? 0 : num / den
}

function matchLabName(name: string, targets: string[]): boolean {
  const lower = name.toLowerCase()
  return targets.some(t => lower.includes(t.toLowerCase()))
}

// ═══════════════════════════════════════
// 1. 穿戴裝置 Readiness Score
//    (移植自 nutrition-engine assessCurrentState)
// ═══════════════════════════════════════

function calculateReadinessScore(
  current: WellnessEntry[],    // 近 3 天
  baseline: WellnessEntry[],   // 第 4-30 天
): number | null {
  // 路徑 1: device_recovery_score 直接使用
  const deviceScores = current
    .filter(w => w.device_recovery_score != null)
    .map(w => w.device_recovery_score!)
  if (deviceScores.length >= 1) {
    return deviceScores.reduce((s, v) => s + v, 0) / deviceScores.length
  }

  // 路徑 2/3: 從個別指標計算
  const entries = current.filter(w =>
    w.resting_hr != null || w.hrv != null || w.wearable_sleep_score != null
  )
  if (entries.length < 2) return null

  const scores: { value: number; weight: number }[] = []

  // HRV (權重 35%, 正向)
  const currentHRV = entries.filter(w => w.hrv != null).map(w => w.hrv!)
  if (currentHRV.length > 0) {
    const avgHRV = currentHRV.reduce((s, v) => s + v, 0) / currentHRV.length
    const bl = calcBaseline(baseline.filter(w => w.hrv != null).map(w => w.hrv!))
    if (bl && bl.sd > 0) {
      scores.push({ value: zToScore((avgHRV - bl.mean) / bl.sd), weight: 35 })
    } else {
      scores.push({ value: clamp((avgHRV - 20) * (100 / 80), 0, 100), weight: 35 })
    }
  }

  // RHR (權重 25%, 反向)
  const currentRHR = entries.filter(w => w.resting_hr != null).map(w => w.resting_hr!)
  if (currentRHR.length > 0) {
    const avgRHR = currentRHR.reduce((s, v) => s + v, 0) / currentRHR.length
    const bl = calcBaseline(baseline.filter(w => w.resting_hr != null).map(w => w.resting_hr!))
    if (bl && bl.sd > 0) {
      scores.push({ value: zToScore(-(avgRHR - bl.mean) / bl.sd), weight: 25 })
    } else {
      scores.push({ value: clamp((90 - avgRHR) * (100 / 40), 0, 100), weight: 25 })
    }
  }

  // 睡眠分數 (權重 30%, 正向)
  const currentSleep = entries.filter(w => w.wearable_sleep_score != null).map(w => w.wearable_sleep_score!)
  if (currentSleep.length > 0) {
    const avgSleep = currentSleep.reduce((s, v) => s + v, 0) / currentSleep.length
    const bl = calcBaseline(baseline.filter(w => w.wearable_sleep_score != null).map(w => w.wearable_sleep_score!))
    if (bl && bl.sd > 0) {
      scores.push({ value: zToScore((avgSleep - bl.mean) / bl.sd), weight: 30 })
    } else {
      scores.push({ value: avgSleep, weight: 30 })
    }
  }

  // 呼吸速率 (權重 10%, 反向)
  const currentRR = entries.filter(w => w.respiratory_rate != null).map(w => w.respiratory_rate!)
  if (currentRR.length > 0) {
    const avgRR = currentRR.reduce((s, v) => s + v, 0) / currentRR.length
    const bl = calcBaseline(baseline.filter(w => w.respiratory_rate != null).map(w => w.respiratory_rate!))
    if (bl && bl.sd > 0) {
      scores.push({ value: zToScore(-(avgRR - bl.mean) / bl.sd), weight: 10 })
    } else {
      scores.push({ value: clamp((24 - avgRR) * (100 / 12), 0, 100), weight: 10 })
    }
  }

  if (scores.length === 0) return null
  const totalWeight = scores.reduce((s, sc) => s + sc.weight, 0)
  return scores.reduce((s, sc) => s + sc.value * sc.weight, 0) / totalWeight
}

// ═══════════════════════════════════════
// 2. 多系統恢復評估 (NEW)
// ═══════════════════════════════════════

function assessNeuralRecovery(
  current: WellnessEntry[],
  baseline: WellnessEntry[],
): SystemRecovery {
  let score = 60
  const signals: string[] = []

  // HRV 是 CNS 恢復的最佳代理指標 (Buchheit 2014)
  const currentHRV = current.filter(w => w.hrv != null).map(w => w.hrv!)
  if (currentHRV.length > 0) {
    const a = currentHRV.reduce((s, v) => s + v, 0) / currentHRV.length
    const bl = calcBaseline(baseline.filter(w => w.hrv != null).map(w => w.hrv!))
    if (bl && bl.sd > 0) {
      const z = (a - bl.mean) / bl.sd
      if (z < -1.5) { score -= 30; signals.push(`HRV 顯著低於基線（z=${z.toFixed(1)}）`) }
      else if (z < -0.5) { score -= 15; signals.push(`HRV 略低於基線`) }
      else if (z > 0.5) { score += 15; signals.push(`HRV 高於基線`) }
    } else {
      // 族群範圍 fallback
      if (a < 30) { score -= 25; signals.push(`HRV 偏低（${a.toFixed(0)}ms）`) }
      else if (a >= 60) { score += 10; signals.push(`HRV 良好（${a.toFixed(0)}ms）`) }
    }
  }

  // Energy level 作為主觀 CNS 疲勞代理 (Saw 2015)
  const avgEnergy = avg(current.filter(w => w.energy_level != null).map(w => w.energy_level!))
  if (avgEnergy != null) {
    if (avgEnergy <= 2) { score -= 20; signals.push(`精力極低（${avgEnergy.toFixed(1)}/5）`) }
    else if (avgEnergy <= 3) { score -= 5; signals.push(`精力一般`) }
    else if (avgEnergy >= 4.5) { score += 15; signals.push(`精力充沛（${avgEnergy.toFixed(1)}/5）`) }
  }

  return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
}

function assessMuscularRecovery(
  current: WellnessEntry[],
  trainingLogs: TrainingLogEntry[],
  prepPhase?: string | null,
): SystemRecovery {
  let score = 65
  const signals: string[] = []

  const isPeakWeek = prepPhase === 'peak_week'
  const isCompetition = prepPhase === 'competition'
  const isWeighIn = prepPhase === 'weigh_in'
  const isRebound = prepPhase === 'rebound'
  const isWeightCut = prepPhase === 'weight_cut'

  // weigh_in: skip all penalty (same as competition)
  // rebound: treat like recovery
  if (isWeighIn) {
    signals.push('秤重日：跳過所有肌肉恢復 penalty')
    return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
  }

  // 近 7 天訓練負荷
  const last7 = trainingLogs.slice(-7)
  const trainDays = last7.filter(t => t.training_type && t.training_type !== 'rest').length
  const highRPE = last7.filter(t => t.rpe != null && t.rpe >= 8).length

  // peak_week: 7 天訓練頻率 penalty 減半；competition: 跳過
  // weight_cut: frequency penalty halved (similar to peak_week but encourages taper)
  if (!isCompetition) {
    const freqPenaltyMultiplier = (isPeakWeek || isWeightCut) ? 0.5 : 1
    if (trainDays >= 6) { score -= Math.round(25 * freqPenaltyMultiplier); if (!isPeakWeek && !isWeightCut) signals.push(`近 7 天訓練 ${trainDays} 天，肌肉恢復不足`); else signals.push(`${isPeakWeek ? 'Peak Week' : '降體重'}期間高頻訓練屬預期（${trainDays} 天/週）`) }
    else if (trainDays >= 5) { score -= Math.round(15 * freqPenaltyMultiplier); signals.push(`近 7 天訓練 ${trainDays} 天`) }
    else if (trainDays <= 2) { score += 15; signals.push(`近 7 天僅訓練 ${trainDays} 天，恢復充足`) }
  }

  if (highRPE >= 4) { score -= 20; signals.push(`${highRPE} 次高強度（RPE≥8），肌肉疲勞累積`) }
  else if (highRPE >= 3) { score -= 10; signals.push(`${highRPE} 次高強度訓練`) }

  // 連續訓練天數（不休息）— peak_week/competition/weight_cut/weigh_in/rebound 時跳過
  if (!isPeakWeek && !isCompetition && !isWeightCut && !isRebound) {
    const sorted = [...trainingLogs].sort((a, b) => b.date.localeCompare(a.date))
    let consecutiveDays = 0
    for (const t of sorted) {
      if (t.training_type && t.training_type !== 'rest') consecutiveDays++
      else break
    }
    if (consecutiveDays >= 5) { score -= 15; signals.push(`已連續訓練 ${consecutiveDays} 天未休息`) }
    else if (consecutiveDays >= 4) { score -= 5; signals.push(`連續訓練 ${consecutiveDays} 天`) }
  }

  // 訓練動力（主觀肌肉準備度代理）
  const avgDrive = avg(current.filter(w => w.training_drive != null).map(w => w.training_drive!))
  if (avgDrive != null) {
    if (avgDrive <= 2) { score -= 15; signals.push(`訓練動力低（${avgDrive.toFixed(1)}/5）`) }
    else if (avgDrive >= 4) { score += 10; signals.push(`訓練動力高`) }
  }

  return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
}

function assessMetabolicRecovery(
  current: WellnessEntry[],
  dietDurationWeeks: number | null,
  inLutealPhase: boolean,
): SystemRecovery {
  let score = 65
  const signals: string[] = []

  // 能量水平 = leptin/T3 代理 (代謝適應越嚴重，能量越低)
  const avgEnergy = avg(current.filter(w => w.energy_level != null).map(w => w.energy_level!))
  if (avgEnergy != null) {
    if (avgEnergy <= 2) { score -= 25; signals.push(`能量極低（代謝壓力信號）`) }
    else if (avgEnergy <= 3) { score -= 10; signals.push(`能量一般`) }
    else if (avgEnergy >= 4) { score += 10; signals.push(`能量良好`) }
  }

  // 減脂持續時間 → 代謝適應程度 (Trexler 2014)
  const weeks = dietDurationWeeks ?? 0
  if (weeks >= 12) { score -= 25; signals.push(`減脂已 ${weeks} 週，代謝適應風險高`) }
  else if (weeks >= 8) { score -= 15; signals.push(`減脂 ${weeks} 週，注意代謝適應`) }
  else if (weeks >= 4) { score -= 5; signals.push(`減脂 ${weeks} 週`) }

  // 黃體期碳水氧化率 +15-20%，代謝需求↑
  if (inLutealPhase) { score -= 5; signals.push(`黃體期：碳水需求增加`) }

  return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
}

function assessHormonalRecovery(
  current: WellnessEntry[],
  labResults: LabEntry[],
  inMenstruation: boolean,
): SystemRecovery {
  let score = 65
  const signals: string[] = []

  // 睡眠品質 → 荷爾蒙恢復的基石 (GH 在深睡期分泌)
  const avgSleep = avg(current.filter(w => w.sleep_quality != null).map(w => w.sleep_quality!))
  if (avgSleep != null) {
    if (avgSleep <= 2) { score -= 25; signals.push(`睡眠品質差（${avgSleep.toFixed(1)}/5），荷爾蒙恢復受損`) }
    else if (avgSleep <= 3) { score -= 10; signals.push(`睡眠品質一般`) }
    else if (avgSleep >= 4) { score += 10; signals.push(`睡眠品質良好`) }
  }

  // 穿戴裝置睡眠分數
  const sleepScores = current.filter(w => w.wearable_sleep_score != null).map(w => w.wearable_sleep_score!)
  const avgDeviceSleep = avg(sleepScores)
  if (avgDeviceSleep != null) {
    if (avgDeviceSleep < 60) { score -= 15; signals.push(`裝置睡眠分數低（${avgDeviceSleep.toFixed(0)}/100）`) }
    else if (avgDeviceSleep >= 80) { score += 10; signals.push(`裝置睡眠分數佳`) }
  }

  // 血檢荷爾蒙指標
  for (const lab of labResults) {
    if (lab.value == null) continue

    // 皮質醇偏高 → 分解代謝主導
    if (matchLabName(lab.test_name, ['cortisol', '皮質醇', '可體松'])) {
      if (lab.value > 20) { score -= 20; signals.push(`皮質醇偏高（${lab.value}），分解代謝主導`) }
      else if (lab.value < 5) { score -= 15; signals.push(`皮質醇偏低（${lab.value}），腎上腺疲勞信號`) }
    }

    // 睪固酮偏低
    if (matchLabName(lab.test_name, ['testosterone', '睪固酮', '睪酮'])) {
      if (lab.status === 'alert') { score -= 20; signals.push(`睪固酮異常（${lab.value}），恢復能力顯著降低`) }
      else if (lab.status === 'attention') { score -= 10; signals.push(`睪固酮偏低（${lab.value}）`) }
    }

    // TSH 偏高 → 代謝率下降
    if (matchLabName(lab.test_name, ['tsh', '促甲狀腺'])) {
      if (lab.value > 4.0) { score -= 10; signals.push(`TSH 偏高（${lab.value}），甲狀腺功能偏低`) }
    }

    // CRP 偏高 → 系統性發炎
    if (matchLabName(lab.test_name, ['crp', 'c-reactive', 'c反應蛋白'])) {
      if (lab.value > 3) { score -= 15; signals.push(`CRP 偏高（${lab.value}），系統性發炎`) }
      else if (lab.value > 1) { score -= 5; signals.push(`CRP 輕微偏高（${lab.value}）`) }
    }
  }

  // 經期：荷爾蒙波動
  if (inMenstruation) { score -= 5; signals.push(`經期中，荷爾蒙波動期`) }

  return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
}

function assessPsychologicalRecovery(
  current: WellnessEntry[],
): SystemRecovery {
  let score = 65
  const signals: string[] = []

  // 情緒
  const avgMood = avg(current.filter(w => w.mood != null).map(w => w.mood!))
  if (avgMood != null) {
    if (avgMood <= 2) { score -= 25; signals.push(`情緒低落（${avgMood.toFixed(1)}/5）`) }
    else if (avgMood <= 3) { score -= 10; signals.push(`情緒一般`) }
    else if (avgMood >= 4) { score += 15; signals.push(`情緒良好`) }
  }

  // 壓力
  const avgStress = avg(current.filter(w => w.stress != null).map(w => w.stress!))
  if (avgStress != null) {
    if (avgStress >= 4.5) { score -= 25; signals.push(`壓力極大（${avgStress.toFixed(1)}/5）`) }
    else if (avgStress >= 3.5) { score -= 15; signals.push(`壓力偏高（${avgStress.toFixed(1)}/5）`) }
    else if (avgStress <= 2) { score += 10; signals.push(`壓力低`) }
  }

  // 訓練動力 (Saw 2015: 主觀指標對疲勞的敏感性高)
  const avgDrive = avg(current.filter(w => w.training_drive != null).map(w => w.training_drive!))
  if (avgDrive != null) {
    if (avgDrive <= 2) { score -= 20; signals.push(`訓練動力低（${avgDrive.toFixed(1)}/5），可能心理疲勞`) }
    else if (avgDrive >= 4) { score += 10; signals.push(`訓練動力高`) }
  }

  return { score: clamp(score, 0, 100), state: scoreToState(clamp(score, 0, 100)), signals }
}

// ═══════════════════════════════════════
// 3. 過度訓練風險偵測 (NEW)
//    ACWR + Monotony + Strain
// ═══════════════════════════════════════

function assessOvertrainingRisk(trainingLogs: TrainingLogEntry[]): OvertrainingRisk {
  const reasons: string[] = []

  // 計算每日 session load = RPE × duration (Foster's sRPE)
  const sorted = [...trainingLogs].sort((a, b) => a.date.localeCompare(b.date))

  // 建立最近 28 天的完整日期範圍（含休息日）
  const today = new Date()
  const day28Ago = new Date(today)
  day28Ago.setDate(day28Ago.getDate() - 27) // 含今天共 28 天

  // 計算每日負荷 (sRPE)
  const dailyLoads: Map<string, number> = new Map()

  // 先把 28 天全部填 0（休息日 = 0 負荷）
  for (let d = new Date(day28Ago); d <= today; d.setDate(d.getDate() + 1)) {
    dailyLoads.set(d.toISOString().split('T')[0], 0)
  }

  // 再把有訓練紀錄的日期覆蓋上去
  for (const t of sorted) {
    if (!dailyLoads.has(t.date)) continue // 超出 28 天範圍
    if (t.training_type === 'rest') continue // 明確標為休息日 → 保持 0
    const load = (t.rpe ?? 5) * (t.duration ?? 45)
    const existing = dailyLoads.get(t.date) ?? 0
    dailyLoads.set(t.date, existing + load)
  }

  const allDates = [...dailyLoads.keys()].sort()
  if (allDates.length < 14) {
    return { acwr: null, monotony: null, strain: null, riskLevel: 'low', reasons: ['訓練數據不足 14 天，無法評估'] }
  }

  const loads = allDates.map(d => dailyLoads.get(d) ?? 0)

  // ACWR: 急性(7天) / 慢性(28天) — 用 EWMA 更穩定
  const last7Loads = loads.slice(-7)
  const acuteLoad = last7Loads.reduce((s, v) => s + v, 0) / 7
  const chronicLoad = loads.reduce((s, v) => s + v, 0) / loads.length

  let acwr: number | null = null
  if (chronicLoad > 0) {
    acwr = Number((acuteLoad / chronicLoad).toFixed(2))
  }

  // Monotony = mean(daily load) / SD(daily load) — 過去 7 天
  const meanLoad = last7Loads.reduce((s, v) => s + v, 0) / last7Loads.length
  const sdLoad = Math.sqrt(last7Loads.reduce((s, v) => s + (v - meanLoad) ** 2, 0) / last7Loads.length)
  const monotony = sdLoad > 0 ? Number((meanLoad / sdLoad).toFixed(2)) : null

  // Strain = weekly load × monotony
  const weeklyLoad = last7Loads.reduce((s, v) => s + v, 0)
  const strain = monotony != null ? Number((weeklyLoad * monotony).toFixed(0)) : null

  // 風險判定 (Gabbett 2016)
  let riskLevel: OvertrainingRisk['riskLevel'] = 'low'
  let riskScore = 0

  if (acwr != null) {
    if (acwr > 1.5) {
      riskScore += 3
      reasons.push(`ACWR ${acwr} 遠超安全區（>1.5），急性負荷暴增`)
    } else if (acwr > 1.3) {
      riskScore += 2
      reasons.push(`ACWR ${acwr} 超出安全區（0.8-1.3），注意負荷管理`)
    } else if (acwr < 0.8) {
      riskScore += 1
      reasons.push(`ACWR ${acwr} 低於安全區（<0.8），訓練刺激可能不足`)
    } else {
      reasons.push(`ACWR ${acwr} 在安全區（0.8-1.3）`)
    }
  }

  if (monotony != null && monotony > 2.0) {
    riskScore += 2
    reasons.push(`單調性 ${monotony}（>2.0），訓練變化性不足，傷害風險↑`)
  }

  if (strain != null && strain > 6000) {
    riskScore += 2
    reasons.push(`訓練負荷 ${strain} AU（>6000），累積疲勞過高`)
  } else if (strain != null && strain > 4000) {
    riskScore += 1
    reasons.push(`訓練負荷 ${strain} AU，中等水平`)
  }

  if (riskScore >= 5) riskLevel = 'very_high'
  else if (riskScore >= 3) riskLevel = 'high'
  else if (riskScore >= 2) riskLevel = 'moderate'

  return { acwr, monotony, strain, riskLevel, reasons }
}

// ═══════════════════════════════════════
// 4. 自律神經平衡 (NEW)
//    HRV + RHR 趨勢分析
// ═══════════════════════════════════════

function assessAutonomicBalance(
  wellness: WellnessEntry[],
): AutonomicBalance {
  const sorted = [...wellness].sort((a, b) => a.date.localeCompare(b.date))
  const reasons: string[] = []

  // HRV 趨勢 (近 7 天)
  const last7 = sorted.slice(-7)
  const hrvValues = last7.filter(w => w.hrv != null).map(w => w.hrv!)
  const rhrValues = last7.filter(w => w.resting_hr != null).map(w => w.resting_hr!)

  let hrvTrend: AutonomicBalance['hrvTrend'] = 'unknown'
  let rhrTrend: AutonomicBalance['rhrTrend'] = 'unknown'
  let hrvZScore: number | null = null
  let rhrZScore: number | null = null

  // 個人基線
  const baselineHRV = calcBaseline(sorted.slice(0, -3).filter(w => w.hrv != null).map(w => w.hrv!))
  const baselineRHR = calcBaseline(sorted.slice(0, -3).filter(w => w.resting_hr != null).map(w => w.resting_hr!))

  if (hrvValues.length >= 3) {
    const slope = trendSlope(hrvValues)
    const avgHRV = hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length
    // 相對斜率 > 2%/天 = 顯著趨勢
    const relSlope = avgHRV > 0 ? slope / avgHRV : 0
    if (relSlope > 0.02) hrvTrend = 'rising'
    else if (relSlope < -0.02) hrvTrend = 'declining'
    else hrvTrend = 'stable'

    if (baselineHRV && baselineHRV.sd > 0) {
      hrvZScore = Number(((avgHRV - baselineHRV.mean) / baselineHRV.sd).toFixed(2))
    }
  }

  if (rhrValues.length >= 3) {
    const slope = trendSlope(rhrValues)
    const avgRHR = rhrValues.reduce((s, v) => s + v, 0) / rhrValues.length
    const relSlope = avgRHR > 0 ? slope / avgRHR : 0
    if (relSlope > 0.015) rhrTrend = 'rising'
    else if (relSlope < -0.015) rhrTrend = 'declining'
    else rhrTrend = 'stable'

    if (baselineRHR && baselineRHR.sd > 0) {
      rhrZScore = Number(((avgRHR - baselineRHR.mean) / baselineRHR.sd).toFixed(2))
    }
  }

  // 判定 ANS 平衡
  // HRV↑ + RHR↓ = 副交感主導 (恢復中)
  // HRV↓ + RHR↑ = 交感主導 (壓力/過度訓練)
  let status: AutonomicBalance['status'] = 'unknown'

  if (hrvTrend !== 'unknown' && rhrTrend !== 'unknown') {
    if (hrvTrend === 'rising' && rhrTrend !== 'rising') {
      status = 'parasympathetic_dominant'
      reasons.push('HRV 上升 + RHR 未升高 → 副交感主導（恢復良好）')
    } else if (hrvTrend === 'declining' && rhrTrend === 'rising') {
      status = 'sympathetic_dominant'
      reasons.push('HRV 下降 + RHR 上升 → 交感主導（壓力/過度疲勞信號）')
    } else if (hrvTrend === 'declining' && rhrTrend !== 'rising') {
      // HRV 下降但 RHR 沒升 — 可能是副交感過度抑制 (parasympathetic overtraining)
      status = 'sympathetic_dominant'
      reasons.push('HRV 下降 → 可能處於累積疲勞階段')
    } else {
      status = 'balanced'
      reasons.push('自律神經指標穩定')
    }
  } else if (hrvZScore != null) {
    if (hrvZScore < -1) {
      status = 'sympathetic_dominant'
      reasons.push(`HRV 低於基線（z=${hrvZScore}）`)
    } else if (hrvZScore > 1) {
      status = 'parasympathetic_dominant'
      reasons.push(`HRV 高於基線（z=${hrvZScore}）`)
    } else {
      status = 'balanced'
      reasons.push('HRV 在基線範圍內')
    }
  }

  return { status, hrvTrend, rhrTrend, hrvZScore, rhrZScore, reasons }
}

// ═══════════════════════════════════════
// 5. 恢復軌跡 (NEW)
//    7 天滾動趨勢
// ═══════════════════════════════════════

function assessTrajectory(wellness: WellnessEntry[]): RecoveryAssessment['trajectory'] {
  const sorted = [...wellness].sort((a, b) => a.date.localeCompare(b.date))
  const last7 = sorted.slice(-7)

  if (last7.length < 4) return 'unknown'

  // 綜合多個主觀指標的趨勢
  const compositeScores: number[] = []
  for (const w of last7) {
    const vals = [w.energy_level, w.mood, w.sleep_quality, w.training_drive].filter(v => v != null) as number[]
    if (vals.length >= 2) {
      compositeScores.push(vals.reduce((s, v) => s + v, 0) / vals.length)
    }
  }

  if (compositeScores.length < 4) {
    // 嘗試用穿戴裝置數據
    const deviceScores = last7
      .filter(w => w.device_recovery_score != null)
      .map(w => w.device_recovery_score! / 20) // 正規化到 0-5 scale
    if (deviceScores.length >= 4) {
      const slope = trendSlope(deviceScores)
      if (slope > 0.1) return 'improving'
      if (slope < -0.1) return 'declining'
      return 'stable'
    }
    return 'unknown'
  }

  const slope = trendSlope(compositeScores)
  // 每天平均變化 > 0.1（在 1-5 scale 上 = ~2%/天）
  if (slope > 0.1) return 'improving'
  if (slope < -0.1) return 'declining'
  return 'stable'
}

// ═══════════════════════════════════════
// 6. 建議生成
// ═══════════════════════════════════════

function generateRecommendations(
  systems: RecoveryAssessment['systems'],
  overtrainingRisk: OvertrainingRisk,
  autonomicBalance: AutonomicBalance,
  trajectory: RecoveryAssessment['trajectory'],
  prepPhase?: string | null,
): RecoveryRecommendation[] {
  const recs: RecoveryRecommendation[] = []

  const isPeakWeek = prepPhase === 'peak_week'
  const isCompetition = prepPhase === 'competition'
  const isWeighIn = prepPhase === 'weigh_in'
  const isRebound = prepPhase === 'rebound'

  // weigh_in: force rest recommendation
  if (isWeighIn) {
    recs.push({ priority: 'high', category: 'training', message: '秤重日：強制休息，秤重後立刻開始回補。' })
    return recs
  }

  // rebound: supercompensation nutrition recommendation
  if (isRebound) {
    recs.push({ priority: 'high', category: 'nutrition', message: '超補償期：碳水 6-10g/kg，快速回補肌醣與體液。大量碳水 + 水 + 電解質。' })
    recs.push({ priority: 'medium', category: 'training', message: '超補償期：以主動恢復為主，避免高強度訓練。' })
    return recs
  }

  // 睡眠（peak_week/competition 照給）
  if (systems.hormonal.score < 50 && systems.hormonal.signals.some(s => s.includes('睡眠'))) {
    recs.push({ priority: 'high', category: 'sleep', message: '睡眠品質嚴重不足。建議：固定就寢時間、睡前 1 小時停止藍光、臥室溫度 18-20°C。' })
  } else if (systems.hormonal.score < 65 && systems.hormonal.signals.some(s => s.includes('睡眠'))) {
    recs.push({ priority: 'medium', category: 'sleep', message: '睡眠品質有提升空間。嘗試提早 30 分鐘上床、減少睡前咖啡因攝取。' })
  }

  // 訓練
  if (overtrainingRisk.riskLevel === 'very_high' || overtrainingRisk.riskLevel === 'high') {
    if (isPeakWeek) {
      // peak_week：不建議 deload/停練，改為提醒注意恢復策略
      recs.push({ priority: 'medium', category: 'training', message: `Peak Week 期間疲勞累積屬預期。留意主觀感受，加強恢復策略（睡眠、營養、伸展）。` })
    } else if (!isCompetition) {
      recs.push({ priority: 'high', category: 'training', message: `過度訓練風險${overtrainingRisk.riskLevel === 'very_high' ? '極' : ''}高。建議安排 deload 週或增加 1-2 天完全休息。` })
    }
    // competition：完全不計訓練 penalty 建議
  }
  if (systems.muscular.state === 'critical') {
    if (isPeakWeek) {
      recs.push({ priority: 'medium', category: 'training', message: 'Peak Week 肌肉疲勞明顯，注意恢復策略（充足蛋白質、伸展、冷熱交替）。' })
    } else if (!isCompetition) {
      recs.push({ priority: 'high', category: 'training', message: '肌肉恢復嚴重不足。建議今天完全休息，或僅做輕量主動恢復（散步、伸展）。' })
    }
  }

  // 營養（peak_week/competition 照給）
  if (systems.metabolic.score < 40) {
    recs.push({ priority: 'high', category: 'nutrition', message: '代謝壓力偏高。考慮安排 refeed day（碳水 4-5g/kg）或 1 週 diet break。' })
  }

  // 壓力（照給）
  if (systems.psychological.state === 'critical' || systems.psychological.state === 'struggling') {
    recs.push({ priority: 'medium', category: 'stress', message: '心理疲勞明顯。建議減少訓練量、增加休閒活動、考慮冥想或散步。' })
  }

  // 自律神經（照給）
  if (autonomicBalance.status === 'sympathetic_dominant') {
    recs.push({ priority: 'medium', category: 'stress', message: '自律神經偏向交感主導（壓力態）。優先恢復：深呼吸、輕量有氧、充足睡眠。' })
  }

  // 醫療（照給）
  if (systems.hormonal.signals.some(s => s.includes('皮質醇') || s.includes('睪固酮') || s.includes('CRP'))) {
    recs.push({ priority: 'medium', category: 'medical', message: '血檢荷爾蒙指標異常，建議追蹤複檢並諮詢醫師。' })
  }

  // 軌跡下滑 — peak_week 時不發「建議停練 1-2 天」
  if (trajectory === 'declining') {
    if (isPeakWeek) {
      recs.push({ priority: 'low', category: 'training', message: 'Peak Week 期間恢復趨勢下滑屬預期，留意主觀感受並加強恢復措施。' })
    } else if (!isCompetition) {
      recs.push({ priority: 'medium', category: 'training', message: '恢復趨勢持續下滑，建議主動安排 1-2 天輕量或休息日，避免累積疲勞惡化。' })
    }
  }

  return recs
}

// ═══════════════════════════════════════
// MAIN: generateRecoveryAssessment
// ═══════════════════════════════════════

/**
 * 生成完整恢復評估。
 *
 * 所有引擎（nutrition / training / ai-insights）都應消費此函數的輸出，
 * 不再各自重複計算 recoveryScore。
 */
export function generateRecoveryAssessment(input: RecoveryInput): RecoveryAssessment {
  const sorted = [...input.wellness].sort((a, b) => b.date.localeCompare(a.date))
  const current = sorted.slice(0, 3)   // 近 3 天
  const baseline = sorted.slice(3)      // 第 4-30 天

  const trainingLogs = [...input.trainingLogs].sort((a, b) => a.date.localeCompare(b.date))
  const labResults = input.labResults ?? []

  // ── 穿戴裝置 Readiness ──
  const readinessScore = calculateReadinessScore(current, baseline)

  // ── 多系統評估 ──
  const neural = assessNeuralRecovery(current, baseline)
  const muscular = assessMuscularRecovery(current, trainingLogs, input.prepPhase)
  const metabolic = assessMetabolicRecovery(current, input.dietDurationWeeks ?? null, input.inLutealPhase ?? false)
  const hormonal = assessHormonalRecovery(current, labResults, input.inMenstruation ?? false)
  const psychological = assessPsychologicalRecovery(current)

  const systems = { neural, muscular, metabolic, hormonal, psychological }

  // ── 進階分析 ──
  const overtrainingRisk = assessOvertrainingRisk(trainingLogs)
  const autonomicBalance = assessAutonomicBalance(input.wellness)
  const trajectory = assessTrajectory(input.wellness)

  // ── 綜合分數 ──
  // 加權：neural 25%, muscular 20%, metabolic 20%, hormonal 20%, psychological 15%
  // 如果有穿戴裝置 readiness，它取代 neural 權重的一半 (更客觀)
  let score: number

  if (readinessScore != null) {
    // 穿戴裝置模式：readiness 30% + systems 70%
    const systemsWeighted =
      neural.score * 0.10 +
      muscular.score * 0.20 +
      metabolic.score * 0.15 +
      hormonal.score * 0.15 +
      psychological.score * 0.10
    score = readinessScore * 0.30 + systemsWeighted
  } else {
    // 純主觀模式
    score =
      neural.score * 0.25 +
      muscular.score * 0.20 +
      metabolic.score * 0.20 +
      hormonal.score * 0.20 +
      psychological.score * 0.15
  }

  // 過度訓練風險懲罰（加權扣分，而非硬上限）
  if (overtrainingRisk.riskLevel === 'very_high') score *= 0.55
  else if (overtrainingRisk.riskLevel === 'high') score *= 0.75
  else if (overtrainingRisk.riskLevel === 'moderate') score *= 0.90

  // 交感主導懲罰
  if (autonomicBalance.status === 'sympathetic_dominant') score = Math.min(score, score * 0.85)

  // 軌跡修正
  if (trajectory === 'declining') score *= 0.95
  else if (trajectory === 'improving') score = Math.min(100, score * 1.05)

  score = Math.round(clamp(score, 0, 100))
  const state = scoreToState(score)

  // ── 匯總 reasons ──
  const reasons: string[] = []
  for (const [name, sys] of Object.entries(systems)) {
    const labels: Record<string, string> = { neural: '神經', muscular: '肌肉', metabolic: '代謝', hormonal: '荷爾蒙', psychological: '心理' }
    if (sys.state === 'critical' || sys.state === 'struggling') {
      reasons.push(`${labels[name]}系統：${sys.signals[0] ?? sys.state}`)
    }
  }
  if (overtrainingRisk.riskLevel !== 'low') {
    reasons.push(...overtrainingRisk.reasons.slice(0, 2))
  }
  if (autonomicBalance.status === 'sympathetic_dominant') {
    reasons.push(...autonomicBalance.reasons.slice(0, 1))
  }
  if (trajectory === 'declining') {
    reasons.push('恢復趨勢持續下滑')
  }

  // ── 建議 ──
  const recommendations = generateRecommendations(systems, overtrainingRisk, autonomicBalance, trajectory, input.prepPhase)

  return {
    score,
    state,
    readinessScore: readinessScore != null ? Math.round(readinessScore) : null,
    systems,
    overtrainingRisk,
    autonomicBalance,
    trajectory,
    recommendations,
    reasons,
  }
}

// ═══════════════════════════════════════
// 向後相容：供 body-fat-zone-table.ts 使用
// ═══════════════════════════════════════

/**
 * 簡易恢復分類 — 向後相容 classifyRecovery。
 * 新代碼應使用 generateRecoveryAssessment().state。
 */
export interface RecoveryIndicators {
  sleepQuality: number       // 1-5
  energyLevel: number        // 1-5
  mood: number               // 1-5
  trainingRPE: number        // 1-10
  performanceTrend: 'improving' | 'stable' | 'declining'
}

export function classifyRecovery(indicators: RecoveryIndicators): RecoveryState {
  const rpeNormalized = indicators.trainingRPE <= 5 ? 5
    : indicators.trainingRPE <= 7 ? 3
    : 1

  const trendScore = indicators.performanceTrend === 'improving' ? 5
    : indicators.performanceTrend === 'stable' ? 3
    : 1

  const composite =
    indicators.sleepQuality * 0.30 +
    indicators.energyLevel * 0.25 +
    indicators.mood * 0.20 +
    rpeNormalized * 0.15 +
    trendScore * 0.10

  if (composite >= 4.0) return 'optimal'
  if (composite >= 3.0) return 'good'
  if (composite >= 2.0) return 'struggling'
  return 'critical'
}

// ═══════════════════════════════════════
// 向後相容：供 ai-insights.ts / training-mode-engine.ts 使用
// ═══════════════════════════════════════

export interface TrainingAdvice {
  recommendedIntensity: 'high' | 'moderate' | 'low' | 'rest'
  recoveryScore: number  // 0-100
  reasons: string[]
  suggestion: string
}

/**
 * 基於 RecoveryAssessment 產出訓練強度建議。
 * 取代 ai-insights.ts 中的 getTrainingAdvice()。
 */
export function getTrainingAdviceFromRecovery(assessment: RecoveryAssessment): TrainingAdvice {
  const { score, reasons } = assessment

  let recommendedIntensity: TrainingAdvice['recommendedIntensity']
  let suggestion: string

  if (score >= 75) {
    recommendedIntensity = 'high'
    suggestion = '恢復狀態良好，可以進行高強度訓練。建議挑戰新的 PR 或增加訓練量。'
  } else if (score >= 50) {
    recommendedIntensity = 'moderate'
    suggestion = '恢復狀態一般，建議維持正常訓練強度。避免過度追求 PR，專注在動作品質。'
  } else if (score >= 30) {
    recommendedIntensity = 'low'
    suggestion = '恢復狀態偏差，建議降低訓練強度。可以做輕量訓練或主動恢復（散步、伸展）。'
  } else {
    recommendedIntensity = 'rest'
    suggestion = '身體需要休息。建議今天安排完全休息日，專注睡眠和營養補充。'
  }

  // 加入過度訓練警告
  if (assessment.overtrainingRisk.riskLevel === 'very_high') {
    suggestion += ' ⚠️ 過度訓練風險極高，強烈建議安排 deload。'
    if (recommendedIntensity !== 'rest') recommendedIntensity = 'low'
  } else if (assessment.overtrainingRisk.riskLevel === 'high') {
    suggestion += ' 注意：過度訓練風險偏高，考慮減量。'
  }

  // 加入自律神經提示
  if (assessment.autonomicBalance.status === 'sympathetic_dominant') {
    suggestion += ' 自律神經偏向交感主導，優先恢復。'
  }

  return {
    recommendedIntensity,
    recoveryScore: score,
    reasons,
    suggestion,
  }
}
