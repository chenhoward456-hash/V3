/**
 * Training Mode Recommendation Engine
 *
 * 結合恢復評分、基因檔案、血檢、目標週期、代謝壓力，
 * 推薦具體訓練模式（高容量 / 高強度 / 減量 / deload 等）。
 *
 * 使用加權投票算法：每個信號對各模式投票，最高分的模式勝出。
 * 與營養引擎的 calculateMetabolicStressScore 同一設計模式。
 *
 * 文獻依據：
 *   - Schoenfeld 2017 (JSCR) — 訓練量與肌肥大劑量反應
 *   - Helms 2014 (JISSN) — 自然健美減脂期的力量訓練策略
 *   - Fernandez-del-Olmo 2021 — 5-HTTLPR 與運動後血清素反應
 *   - Shimoda 2014 — MTHFR 多型性與運動恢復
 */

import type { GeneticProfile } from './supplement-engine'
import { getSerotoninRiskLevel } from './supplement-engine'
import type { TrainingAdvice } from './ai-insights'
import { getLocalDateStr } from './date-utils'

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export type TrainingMode =
  | 'high_volume'      // 高容量：18-24 組, RPE 6-8, 肌肥大
  | 'high_intensity'   // 高強度：10-14 組, RPE 8-10, 力量
  | 'moderate'         // 正常訓練：14-18 組, RPE 7-8
  | 'reduced_volume'   // 減量：-25% 容量, RPE 6-8
  | 'deload'           // Deload 週：-50%, RPE 5-6
  | 'active_recovery'  // 主動恢復：伸展、散步
  | 'cardio_focus'     // 有氧為主
  | 'rest'             // 完全休息

export interface TrainingModeReason {
  signal: string       // 信號來源
  emoji: string        // 前綴 emoji
  description: string  // 人類可讀說明
}

export interface GeneticTrainingCorrection {
  gene: string         // e.g. '5-HTTLPR'
  variant: string      // e.g. 'SS'
  effect: string       // 調整說明
  emoji: string
}

export interface TrainingModeRecommendation {
  recommendedMode: TrainingMode
  modeLabel: string           // 中文標籤
  modeEmoji: string
  modeColor: string           // Tailwind color key
  volumeAdjustment: number    // -100 ~ +20%
  targetRpeRange: [number, number]
  suggestedSets: string       // "18-24 組"
  suggestions: string[]       // 可執行建議
  focusAreas: string[]        // 標籤
  reasons: TrainingModeReason[]
  geneticTrainingCorrections: GeneticTrainingCorrection[]
  confidence: 'high' | 'medium' | 'low'
}

// ═══════════════════════════════════════
// Mode Configuration Table
// ═══════════════════════════════════════

interface ModeConfig {
  label: string
  emoji: string
  color: string
  volumeAdjustment: number
  rpeRange: [number, number]
  suggestedSets: string
  suggestions: string[]
  focusAreas: string[]
}

const MODE_CONFIG: Record<TrainingMode, ModeConfig> = {
  high_volume: {
    label: '高容量訓練',
    emoji: '💪',
    color: 'purple',
    volumeAdjustment: 20,
    rpeRange: [6, 8],
    suggestedSets: '18-24 組',
    suggestions: [
      '專注肌肥大，每組 8-12 次',
      '使用多關節 + 單關節動作搭配',
      '組間休息 60-90 秒',
      '可加入超級組或遞減組',
    ],
    focusAreas: ['肌肥大', '代謝壓力', '高容量'],
  },
  high_intensity: {
    label: '高強度訓練',
    emoji: '🔥',
    color: 'red',
    volumeAdjustment: -10,
    rpeRange: [8, 10],
    suggestedSets: '10-14 組',
    suggestions: [
      '專注複合動作（深蹲、硬舉、臥推）',
      '每組接近力竭 RPE 8-10',
      '充分休息 3-5 分鐘',
      '以力量維持為主要目標',
    ],
    focusAreas: ['力量維持', '複合動作', '神經適應'],
  },
  moderate: {
    label: '正常訓練',
    emoji: '✅',
    color: 'blue',
    volumeAdjustment: 0,
    rpeRange: [7, 8],
    suggestedSets: '14-18 組',
    suggestions: [
      '維持正常訓練量和強度',
      '專注在動作品質和控制',
      '組間休息 90-120 秒',
    ],
    focusAreas: ['均衡訓練', '動作品質'],
  },
  reduced_volume: {
    label: '減量訓練',
    emoji: '📉',
    color: 'amber',
    volumeAdjustment: -25,
    rpeRange: [6, 8],
    suggestedSets: '10-14 組',
    suggestions: [
      '維持強度但減少總組數（-25%）',
      '保留複合動作，減少輔助動作',
      '確保充足的組間休息',
    ],
    focusAreas: ['減量', '維持強度', '疲勞管理'],
  },
  deload: {
    label: 'Deload 減負荷',
    emoji: '🔄',
    color: 'teal',
    volumeAdjustment: -50,
    rpeRange: [5, 6],
    suggestedSets: '8-10 組',
    suggestions: [
      '訓練量減半，強度降至 RPE 5-6',
      '專注動作模式和活動度',
      '這是恢復的投資，不是偷懶',
    ],
    focusAreas: ['減負荷', '恢復', '活動度'],
  },
  active_recovery: {
    label: '主動恢復',
    emoji: '🧘',
    color: 'green',
    volumeAdjustment: -80,
    rpeRange: [3, 5],
    suggestedSets: '0-6 組（輕量）',
    suggestions: [
      '以伸展和活動度訓練為主',
      '可做 20-30 分鐘散步',
      '避免高強度或高容量訓練',
      '使用泡沫滾筒放鬆肌筋膜',
    ],
    focusAreas: ['恢復', '伸展', '活動度'],
  },
  cardio_focus: {
    label: '有氧為主',
    emoji: '🏃',
    color: 'cyan',
    volumeAdjustment: -40,
    rpeRange: [5, 7],
    suggestedSets: '6-10 組（輕量重訓）',
    suggestions: [
      '以有氧訓練為主（30-45 分鐘）',
      '可搭配少量重訓維持肌力',
      '心率維持在 Zone 2-3',
    ],
    focusAreas: ['有氧', '心肺', '脂肪氧化'],
  },
  rest: {
    label: '完全休息',
    emoji: '😴',
    color: 'gray',
    volumeAdjustment: -100,
    rpeRange: [0, 0],
    suggestedSets: '0 組',
    suggestions: [
      '今天完全休息，專注睡眠和營養',
      '確保充足水分攝取',
      '如果有需要，可做輕度散步',
    ],
    focusAreas: ['休息', '恢復'],
  },
}

// ═══════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════

export interface TrainingPatternAnalysis {
  sessionsLast7d: number
  sessionsLast14d: number
  avgRpe: number | null
  highRpeCount: number        // RPE >= 8 的次數 (7d)
  consecutiveTrainingDays: number
  daysSinceLastRest: number
  lastSessionRpe: number | null  // 最近一次訓練的 RPE（前一天上下文）
  lastSessionDate: string | null // 最近一次訓練日期
  // P2: 長期週期化分析
  weeksSinceLastDeload: number   // 自上次 deload 週以來的週數（deload = 該週 avgRPE<6 或 sessions≤2）
  totalWeeksAnalyzed: number     // 有數據的總週數（最多 8）
}

export function analyzeTrainingPattern(
  logs: Array<{ date: string; training_type?: string | null; rpe?: number | null; sets?: number | null; duration?: number | null }>
): TrainingPatternAnalysis {
  if (!logs || logs.length === 0) {
    return { sessionsLast7d: 0, sessionsLast14d: 0, avgRpe: null, highRpeCount: 0, consecutiveTrainingDays: 0, daysSinceLastRest: 0, lastSessionRpe: null, lastSessionDate: null, weeksSinceLastDeload: 0, totalWeeksAnalyzed: 0 }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(today.getDate() - 14)

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  const activeLogs = sorted.filter(l => l.training_type && l.training_type !== 'rest')
  const last7dActive = activeLogs.filter(l => new Date(l.date) >= sevenDaysAgo)
  const last14dActive = activeLogs.filter(l => new Date(l.date) >= fourteenDaysAgo)

  // Average RPE (last 7 days)
  const rpeLogs = last7dActive.filter(l => l.rpe != null)
  const avgRpe = rpeLogs.length > 0
    ? rpeLogs.reduce((sum, l) => sum + (l.rpe || 0), 0) / rpeLogs.length
    : null

  // High RPE count (last 7 days)
  const highRpeCount = last7dActive.filter(l => l.rpe != null && l.rpe >= 8).length

  // Consecutive training days (from today backwards)
  let consecutiveTrainingDays = 0
  const allDates = new Set(activeLogs.map(l => l.date))
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = getLocalDateStr(d)
    if (allDates.has(dateStr)) {
      consecutiveTrainingDays++
    } else {
      break
    }
  }

  // Days since last rest
  let daysSinceLastRest = 0
  const restDates = sorted.filter(l => l.training_type === 'rest').map(l => l.date)
  const noneTrainingDates = new Set(restDates)

  // Also count days without any log entry as rest
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = getLocalDateStr(d)
    const hasLog = sorted.some(l => l.date === dateStr)
    if (!hasLog || noneTrainingDates.has(dateStr)) {
      daysSinceLastRest = i
      break
    }
    daysSinceLastRest = i + 1
  }

  // 最近一次訓練的 RPE
  const lastSession = activeLogs.length > 0 ? activeLogs[0] : null  // sorted DESC, first = most recent
  const lastSessionRpe = lastSession?.rpe ?? null
  const lastSessionDate = lastSession?.date ?? null

  // P2: 長期週期化分析 — 逐週檢查 deload 週
  // Deload 週定義：該週 sessions ≤ 2 或 avgRPE < 6
  let weeksSinceLastDeload = 0
  let totalWeeksAnalyzed = 0
  let foundDeload = false

  for (let w = 0; w < 8; w++) {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - (w + 1) * 7)
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() - w * 7)

    const weekLogs = activeLogs.filter(l => {
      const d = new Date(l.date)
      return d >= weekStart && d < weekEnd
    })

    if (weekLogs.length === 0 && w > 0) {
      // 沒有數據的週不計入（可能還沒開始用系統）
      if (totalWeeksAnalyzed === 0) continue  // 從有數據的週開始算
      // 沒訓練 = 等同 deload
      foundDeload = true
      break
    }

    if (weekLogs.length > 0) {
      totalWeeksAnalyzed++
      const weekRpes = weekLogs.filter(l => l.rpe != null).map(l => l.rpe!)
      const weekAvgRpe = weekRpes.length > 0 ? weekRpes.reduce((a, b) => a + b, 0) / weekRpes.length : 0

      if (weekLogs.length <= 2 || weekAvgRpe < 6) {
        foundDeload = true
        break
      }

      if (!foundDeload) weeksSinceLastDeload = w + 1
    }
  }

  if (!foundDeload && totalWeeksAnalyzed > 0) {
    weeksSinceLastDeload = totalWeeksAnalyzed
  }

  return {
    sessionsLast7d: last7dActive.length,
    sessionsLast14d: last14dActive.length,
    avgRpe,
    highRpeCount,
    consecutiveTrainingDays,
    daysSinceLastRest,
    lastSessionRpe,
    lastSessionDate,
    weeksSinceLastDeload,
    totalWeeksAnalyzed,
  }
}

export interface HormoneLabValues {
  testosterone: number | null
  cortisol: number | null
  ferritin: number | null
  tsh: number | null
  hemoglobin: number | null
}

export function extractHormoneLabs(
  labs: Array<{ test_name: string; value: number | null; unit?: string; status?: string }>
): HormoneLabValues {
  const result: HormoneLabValues = {
    testosterone: null,
    cortisol: null,
    ferritin: null,
    tsh: null,
    hemoglobin: null,
  }

  for (const lab of labs) {
    if (lab.value == null) continue
    const name = lab.test_name.toLowerCase()

    // 只保留最新值（input 已按 date DESC 排序，第一筆 match 即最新）
    if (/睪固酮|testosterone/i.test(name) && !/游離|free/i.test(name)) {
      if (result.testosterone == null) result.testosterone = lab.value
    } else if (/皮質醇|cortisol/i.test(name)) {
      if (result.cortisol == null) result.cortisol = lab.value
    } else if (/鐵蛋白|ferritin/i.test(name)) {
      if (result.ferritin == null) result.ferritin = lab.value
    } else if (/tsh|促甲狀腺/i.test(name)) {
      if (result.tsh == null) result.tsh = lab.value
    } else if (/血紅素|hemoglobin/i.test(name)) {
      if (result.hemoglobin == null) result.hemoglobin = lab.value
    }
  }

  return result
}

// ═══════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════

export interface TrainingModeInput {
  baseAdvice: TrainingAdvice
  goalType?: 'cut' | 'bulk' | 'recomp' | null
  prepPhase?: 'off_season' | 'bulk' | 'cut' | 'peak_week' | 'competition' | 'recovery' | null
  geneticProfile?: GeneticProfile | null
  recentTrainingPattern?: TrainingPatternAnalysis | null
  hormoneLabs?: HormoneLabValues | null
  labTrainingModifiers?: TrainingModeReason[]
  metabolicStress?: { score: number; level: string } | null
  // P2: 體重變化率（每週 % 變化，負值 = 下降）
  weeklyWeightChangePercent?: number | null
}

export function getTrainingModeRecommendation(input: TrainingModeInput): TrainingModeRecommendation {
  const {
    baseAdvice,
    goalType,
    prepPhase,
    geneticProfile,
    recentTrainingPattern,
    hormoneLabs,
    metabolicStress,
    weeklyWeightChangePercent,
  } = input

  const recovery = baseAdvice.recoveryScore
  const reasons: TrainingModeReason[] = []
  const geneticCorrections: GeneticTrainingCorrection[] = []

  // ───────────────────────────
  // Phase 1: Hard Overrides
  // ───────────────────────────

  if (recovery < 30) {
    const config = MODE_CONFIG.rest
    reasons.push({ signal: '恢復分數', emoji: '🔴', description: `恢復分數極低（${recovery}/100），身體需要完全休息` })
    return buildRecommendation('rest', config, reasons, geneticCorrections, 'high')
  }

  if (metabolicStress && metabolicStress.score >= 60) {
    const config = MODE_CONFIG.deload
    reasons.push({ signal: '代謝壓力', emoji: '⚠️', description: `代謝壓力過高（${metabolicStress.score}/100），建議 deload 減負荷` })
    return buildRecommendation('deload', config, reasons, geneticCorrections, 'high')
  }

  if (prepPhase === 'recovery') {
    const config = MODE_CONFIG.active_recovery
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: '目前處於賽後恢復期，以主動恢復為主' })
    return buildRecommendation('active_recovery', config, reasons, geneticCorrections, 'high')
  }

  // ───────────────────────────
  // Phase 2: Weighted Scoring
  // ───────────────────────────

  const scores: Record<TrainingMode, number> = {
    high_volume: 0,
    high_intensity: 0,
    moderate: 50,  // baseline bias
    reduced_volume: 0,
    deload: 0,
    active_recovery: 0,
    cardio_focus: 0,
    rest: 0,
  }

  // --- Recovery Score ---
  if (recovery >= 80) {
    scores.high_volume += 25
    scores.high_intensity += 25
    reasons.push({ signal: '恢復分數', emoji: '🟢', description: `恢復分數優秀（${recovery}/100），適合高強度或高容量訓練` })
  } else if (recovery >= 65) {
    scores.high_volume += 15
    scores.high_intensity += 15
    reasons.push({ signal: '恢復分數', emoji: '🔵', description: `恢復分數良好（${recovery}/100），可正常訓練` })
  } else if (recovery >= 50) {
    scores.moderate += 15
    scores.reduced_volume += 10
    reasons.push({ signal: '恢復分數', emoji: '🟡', description: `恢復分數一般（${recovery}/100），建議控制訓練量` })
  } else {
    // 30-49
    scores.reduced_volume += 25
    scores.active_recovery += 15
    reasons.push({ signal: '恢復分數', emoji: '🟠', description: `恢復分數偏低（${recovery}/100），建議減量或主動恢復` })
  }

  // --- Goal Type ---
  if (goalType === 'cut') {
    scores.high_intensity += 20
    scores.high_volume -= 10
    reasons.push({ signal: '目標', emoji: '🔵', description: '減脂期：優先高強度維持力量，避免過高容量消耗肌醣' })
  } else if (goalType === 'bulk') {
    scores.high_volume += 25
    scores.high_intensity += 10
    reasons.push({ signal: '目標', emoji: '🔵', description: '增肌期：提高訓練容量促進肌肥大' })
  } else if (goalType === 'recomp') {
    scores.high_intensity += 15
    scores.moderate += 10
    reasons.push({ signal: '目標', emoji: '🔵', description: '重組期：兼顧強度與容量' })
  }

  // --- Prep Phase ---
  if (prepPhase === 'peak_week') {
    scores.reduced_volume += 30
    scores.high_volume -= 20
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: 'Peak Week：減少訓練量，避免額外疲勞' })
  } else if (prepPhase === 'cut') {
    scores.high_intensity += 15
    scores.high_volume -= 10
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: '備賽減脂期：優先高強度維持力量，控制總訓練量' })
  } else if (prepPhase === 'bulk') {
    scores.high_volume += 20
    scores.high_intensity += 10
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: '備賽增肌期：提高訓練容量促進肌肥大' })
  } else if (prepPhase === 'off_season') {
    scores.high_volume += 15
    scores.high_intensity += 10
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: '休賽期：適合提高訓練量和強度' })
  } else if (prepPhase === 'competition') {
    scores.rest += 30
    scores.active_recovery += 20
    reasons.push({ signal: '備賽階段', emoji: '🏆', description: '比賽日：完全休息或輕度活動' })
  }

  // --- Metabolic Stress (45-59 elevated range) ---
  if (metabolicStress && metabolicStress.score >= 45) {
    scores.reduced_volume += 20
    scores.deload += 15
    scores.high_volume -= 20
    reasons.push({ signal: '代謝壓力', emoji: '⚠️', description: `代謝壓力升高（${metabolicStress.score}/100），建議減少訓練量` })
  }

  // --- Genetic Factors ---
  const serotoninRisk = getSerotoninRiskLevel(geneticProfile)

  if (serotoninRisk === 'high' && goalType === 'cut') {
    scores.high_intensity += 20
    scores.high_volume -= 25
    geneticCorrections.push({
      gene: '5-HTTLPR',
      variant: 'SS',
      effect: '減脂期避免高容量訓練：高容量消耗大量肌醣 → 色胺酸/BCAA 比值改變 → 腦部血清素合成不足 → 情緒崩潰風險',
      emoji: '🧬',
    })
  } else if (serotoninRisk === 'moderate' && goalType === 'cut') {
    scores.high_intensity += 10
    scores.high_volume -= 10
    geneticCorrections.push({
      gene: '5-HTTLPR',
      variant: 'SL',
      effect: '減脂期適度降低訓練容量，監控情緒狀態',
      emoji: '🧬',
    })
  }

  if (geneticProfile?.mthfr === 'homozygous') {
    scores.high_volume -= 15
    scores.reduced_volume += 10
    geneticCorrections.push({
      gene: 'MTHFR',
      variant: '純合突變',
      effect: '甲基化代謝受損 → DNA 修復與蛋白質合成恢復較慢 → 降低總訓練量，確保足夠休息日',
      emoji: '🧬',
    })
  }

  if (geneticProfile?.apoe === 'e3/e4' || geneticProfile?.apoe === 'e4/e4') {
    geneticCorrections.push({
      gene: 'APOE',
      variant: geneticProfile.apoe,
      effect: '高強度訓練時血壓反應可能更劇烈，建議監控心血管反應',
      emoji: '🧬',
    })
    // APOE4 不改變訓練量/強度分數，僅提醒
  }

  // --- Hormone Labs ---
  if (hormoneLabs) {
    if (hormoneLabs.ferritin != null && hormoneLabs.ferritin < 30) {
      scores.cardio_focus -= 20
      reasons.push({ signal: '血檢', emoji: '🩸', description: `鐵蛋白偏低（${hormoneLabs.ferritin}），有氧能力受限，減少有氧量` })
    }
    if (hormoneLabs.hemoglobin != null && hormoneLabs.hemoglobin < 12) {
      scores.cardio_focus -= 20
      reasons.push({ signal: '血檢', emoji: '🩸', description: `血紅素偏低（${hormoneLabs.hemoglobin}），氧氣運輸下降` })
    }
  }

  // --- Training Pattern ---
  if (recentTrainingPattern) {
    // P0: 前一天 RPE 上下文 — 昨天 RPE≥9 應降低今天強度
    if (recentTrainingPattern.lastSessionRpe != null && recentTrainingPattern.lastSessionDate) {
      const today = new Date()
      const lastDate = new Date(recentTrainingPattern.lastSessionDate)
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))

      if (daysDiff <= 1 && recentTrainingPattern.lastSessionRpe >= 9) {
        scores.high_intensity -= 25
        scores.high_volume -= 15
        scores.moderate += 10
        scores.reduced_volume += 15
        reasons.push({ signal: '前次訓練', emoji: '⚡', description: `昨天 RPE ${recentTrainingPattern.lastSessionRpe}（接近極限），今天應降低強度讓神經系統恢復` })
      } else if (daysDiff <= 1 && recentTrainingPattern.lastSessionRpe >= 8) {
        scores.high_intensity -= 10
        scores.moderate += 5
        reasons.push({ signal: '前次訓練', emoji: '⚡', description: `昨天 RPE ${recentTrainingPattern.lastSessionRpe}，今天避免連續高強度` })
      }
    }

    // P1: 連續訓練天數 penalty — 不只加 recovery，也要扣高強度
    if (recentTrainingPattern.consecutiveTrainingDays >= 5) {
      scores.active_recovery += 20
      scores.rest += 15
      scores.high_volume -= 20
      scores.high_intensity -= 15
      reasons.push({ signal: '訓練模式', emoji: '📊', description: `已連續訓練 ${recentTrainingPattern.consecutiveTrainingDays} 天，累積疲勞風險高，強烈建議休息` })
    } else if (recentTrainingPattern.consecutiveTrainingDays >= 4) {
      scores.active_recovery += 10
      scores.reduced_volume += 10
      scores.high_volume -= 10
      scores.high_intensity -= 10
      reasons.push({ signal: '訓練模式', emoji: '📊', description: `已連續訓練 ${recentTrainingPattern.consecutiveTrainingDays} 天，建議減量或安排休息` })
    }

    // P1: 高 RPE 累積 — 不只加 moderate，也要扣高強度和高容量
    if (recentTrainingPattern.highRpeCount >= 4) {
      scores.reduced_volume += 15
      scores.moderate += 10
      scores.high_intensity -= 20
      scores.high_volume -= 15
      reasons.push({ signal: '訓練模式', emoji: '📊', description: `近 7 天有 ${recentTrainingPattern.highRpeCount} 次高強度（RPE≥8），疲勞累積明顯，建議減量` })
    } else if (recentTrainingPattern.highRpeCount >= 3) {
      scores.moderate += 10
      scores.high_intensity -= 15
      scores.high_volume -= 10
      reasons.push({ signal: '訓練模式', emoji: '📊', description: `近 7 天有 ${recentTrainingPattern.highRpeCount} 次高強度（RPE≥8），建議適度降強度` })
    }

    // P2: 長期週期化 — 連續多週高強度未安排 deload
    if (recentTrainingPattern.totalWeeksAnalyzed >= 4 && recentTrainingPattern.weeksSinceLastDeload >= 6) {
      scores.deload += 25
      scores.reduced_volume += 15
      scores.high_volume -= 15
      scores.high_intensity -= 10
      reasons.push({ signal: '週期化', emoji: '📅', description: `已連續 ${recentTrainingPattern.weeksSinceLastDeload} 週未安排 deload，累積疲勞風險高，建議安排減負荷週` })
    } else if (recentTrainingPattern.totalWeeksAnalyzed >= 3 && recentTrainingPattern.weeksSinceLastDeload >= 5) {
      scores.deload += 15
      scores.reduced_volume += 10
      scores.high_volume -= 10
      reasons.push({ signal: '週期化', emoji: '📅', description: `已 ${recentTrainingPattern.weeksSinceLastDeload} 週未 deload，接近建議減負荷時機（通常 4-6 週一次）` })
    }
  }

  // --- P2: 體重變化率偵測 ---
  if (weeklyWeightChangePercent != null && goalType === 'cut') {
    // 掉太快：每週 > 1% 體重 → 減訓練量（肌肉流失風險）
    if (weeklyWeightChangePercent < -1.0) {
      scores.high_volume -= 15
      scores.high_intensity -= 10
      scores.reduced_volume += 10
      reasons.push({ signal: '體重變化', emoji: '⚖️', description: `每週減重 ${Math.abs(weeklyWeightChangePercent).toFixed(1)}%，超過安全上限 1%，肌肉流失風險升高，建議減少訓練量` })
    }
    // 掉太慢或沒掉：可以推更硬
    else if (weeklyWeightChangePercent > -0.3 && weeklyWeightChangePercent <= 0) {
      scores.high_intensity += 10
      scores.high_volume += 5
      reasons.push({ signal: '體重變化', emoji: '⚖️', description: `每週減重僅 ${Math.abs(weeklyWeightChangePercent).toFixed(1)}%，體重接近停滯，可適度提高訓練強度促進能量消耗` })
    }
  } else if (weeklyWeightChangePercent != null && goalType === 'bulk') {
    // 增太快：每週 > 0.5% → 可能脂肪增加過多
    if (weeklyWeightChangePercent > 0.5) {
      scores.high_volume += 10
      scores.cardio_focus += 5
      reasons.push({ signal: '體重變化', emoji: '⚖️', description: `每週增重 ${weeklyWeightChangePercent.toFixed(1)}%，增速偏快，可增加訓練容量消耗多餘熱量` })
    }
  }

  // ───────────────────────────
  // Phase 3: Select Winner
  // ───────────────────────────

  let bestMode: TrainingMode = 'moderate'
  let bestScore = scores.moderate

  for (const [mode, score] of Object.entries(scores) as [TrainingMode, number][]) {
    if (score > bestScore) {
      bestScore = score
      bestMode = mode
    }
  }

  const config = MODE_CONFIG[bestMode]

  // Determine confidence
  const sortedScores = Object.values(scores).sort((a, b) => b - a)
  const margin = sortedScores[0] - sortedScores[1]
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  if (margin >= 20) confidence = 'high'
  else if (margin < 10) confidence = 'low'

  return buildRecommendation(bestMode, config, reasons, geneticCorrections, confidence)
}

function buildRecommendation(
  mode: TrainingMode,
  config: ModeConfig,
  reasons: TrainingModeReason[],
  geneticCorrections: GeneticTrainingCorrection[],
  confidence: 'high' | 'medium' | 'low',
): TrainingModeRecommendation {
  return {
    recommendedMode: mode,
    modeLabel: config.label,
    modeEmoji: config.emoji,
    modeColor: config.color,
    volumeAdjustment: config.volumeAdjustment,
    targetRpeRange: config.rpeRange,
    suggestedSets: config.suggestedSets,
    suggestions: config.suggestions,
    focusAreas: config.focusAreas,
    reasons,
    geneticTrainingCorrections: geneticCorrections,
    confidence,
  }
}
