// 免責聲明：本引擎為教練級行為分析工具，非醫療診斷。
// 所有建議僅限生活型態調整（睡眠、飲食、訓練、休息），
// 任何血液檢查異常或疑似醫療問題一律建議「回診討論」。
// This is coaching-level behavioral analysis, NOT medical advice.

// ─────────────────────────────────────────────
// Behavior Insight Engine
// 行為洞察引擎 — 跨維度交叉分析 14 天數據
// ─────────────────────────────────────────────

// ── Interfaces ──────────────────────────────

export interface InsightInput {
  gender: string // '男性' | '女性'
  bodyWeight: number
  goalType: 'cut' | 'bulk' | 'recomp'

  // 14 days of data (newest first)
  wellness: Array<{
    date: string
    sleep_quality: number | null       // 1-5
    energy_level: number | null        // 1-5
    mood: number | null                // 1-5
    stress_level: number | null        // 1-5
    cognitive_clarity: number | null   // 1-5
    training_drive: number | null      // 1-5
    device_recovery_score: number | null  // 0-100
    resting_hr: number | null
    hrv: number | null
    wearable_sleep_score: number | null   // 0-100
  }>

  nutrition: Array<{
    date: string
    calories: number | null
    carbs_grams: number | null
    protein_grams: number | null
    compliant: boolean | null
  }>

  training: Array<{
    date: string
    training_type: string
    rpe: number | null
    duration: number | null
  }>

  supplementLogs: Array<{
    date: string
    completed: boolean
  }>

  supplementCount: number // total supplements prescribed
}

export interface BehaviorInsight {
  id: string
  emoji: string
  title: string
  description: string
  suggestion: string
  category: 'sleep_training' | 'nutrition_mood' | 'training_recovery' | 'supplement_effect' | 'trend'
  confidence: 'high' | 'medium' | 'low'
  priority: number // 1-5, 1 = most important
}

// ── Helpers ─────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function notNull<T>(v: T | null | undefined): v is T {
  return v != null
}

/** Find max consecutive run of days matching a predicate (data ordered newest-first). */
function maxConsecutiveRun<T>(arr: T[], pred: (item: T) => boolean): number {
  let max = 0
  let current = 0
  // Process oldest-first for chronological streak detection
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) {
      current++
      max = Math.max(max, current)
    } else {
      current = 0
    }
  }
  return max
}

/** Build a date-keyed lookup from an array with { date } entries. */
function byDate<T extends { date: string }>(arr: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of arr) map.set(item.date, item)
  return map
}

/** Split 14 days (newest-first) into this week (first 7) vs last week (last 7). */
function splitWeeks<T>(arr: T[]): { thisWeek: T[]; lastWeek: T[] } {
  return {
    thisWeek: arr.slice(0, 7),
    lastWeek: arr.slice(7, 14),
  }
}

/** Pearson correlation coefficient for two number arrays of equal length. */
function correlation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 5) return 0
  const mx = avg(xs)
  const my = avg(ys)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const denom = Math.sqrt(dx * dy)
  return denom === 0 ? 0 : num / denom
}

// ── Rule Implementations ────────────────────

type RuleFn = (input: InsightInput) => BehaviorInsight | null

/**
 * Rule 1: Sleep ≤ 2 for 3+ consecutive days → reduce training intensity
 */
const rulePoorSleepStreak: RuleFn = ({ wellness }) => {
  const sleepEntries = wellness.filter(w => notNull(w.sleep_quality))
  if (sleepEntries.length < 3) return null

  const streak = maxConsecutiveRun(sleepEntries, w => (w.sleep_quality ?? 0) <= 2)
  if (streak < 3) return null

  return {
    id: 'sleep-streak-poor',
    emoji: '😴',
    title: '連續睡眠品質偏低',
    description: `根據你的數據，過去 14 天中有連續 ${streak} 天睡眠品質評分 ≤ 2。持續睡眠不足會影響恢復與訓練表現。`,
    suggestion: '建議本週降低訓練強度（RPE 控制在 6-7），優先改善睡眠環境與作息。',
    category: 'sleep_training',
    confidence: streak >= 5 ? 'high' : 'medium',
    priority: 1,
  }
}

/**
 * Rule 2: Next-day RPE after poor sleep vs good sleep — show correlation
 */
const ruleSleepeRPECorrelation: RuleFn = ({ wellness, training }) => {
  const wellnessMap = byDate(wellness)
  const trainingMap = byDate(training)
  const dates = wellness.map(w => w.date).sort() // chronological

  const rpeAfterPoor: number[] = []
  const rpeAfterGood: number[] = []

  for (let i = 0; i < dates.length - 1; i++) {
    const sleepDay = wellnessMap.get(dates[i])
    const nextDate = dates[i + 1]
    const nextTraining = trainingMap.get(nextDate)

    if (!sleepDay || !notNull(sleepDay.sleep_quality) || !nextTraining || !notNull(nextTraining.rpe)) continue

    if (sleepDay.sleep_quality <= 2) rpeAfterPoor.push(nextTraining.rpe)
    else if (sleepDay.sleep_quality >= 4) rpeAfterGood.push(nextTraining.rpe)
  }

  if (rpeAfterPoor.length < 2 || rpeAfterGood.length < 2) return null

  const avgPoor = avg(rpeAfterPoor)
  const avgGood = avg(rpeAfterGood)
  const diff = avgPoor - avgGood

  if (diff < 0.8) return null // not meaningful

  return {
    id: 'sleep-rpe-correlation',
    emoji: '📊',
    title: '睡眠品質影響訓練感受',
    description: `根據你的數據，睡不好隔天的平均 RPE 為 ${avgPoor.toFixed(1)}，睡好隔天為 ${avgGood.toFixed(1)}，差距 ${diff.toFixed(1)} 分。睡眠品質顯著影響你的訓練強度感受。`,
    suggestion: '睡眠品質差的隔天，考慮安排較低強度的訓練或以恢復性訓練替代。',
    category: 'sleep_training',
    confidence: rpeAfterPoor.length + rpeAfterGood.length >= 6 ? 'high' : 'medium',
    priority: 3,
  }
}

/**
 * Rule 3: 5+ consecutive training days + declining sleep → suggest rest day
 */
const ruleOvertrainingNoRest: RuleFn = ({ wellness, training }) => {
  // Find max consecutive training days (newest-first → reverse for chronological)
  const trainingDates = new Set(training.map(t => t.date))
  const allDates = wellness.map(w => w.date).sort() // chronological

  let maxStreak = 0
  let currentStreak = 0
  for (const date of allDates) {
    if (trainingDates.has(date)) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  if (maxStreak < 5) return null

  // Check declining sleep in recent 7 days vs prior 7
  const { thisWeek, lastWeek } = splitWeeks(wellness)
  const sleepThis = thisWeek.map(w => w.sleep_quality).filter(notNull)
  const sleepLast = lastWeek.map(w => w.sleep_quality).filter(notNull)

  if (sleepThis.length < 3 || sleepLast.length < 3) return null

  const sleepDecline = avg(sleepLast) - avg(sleepThis)
  if (sleepDecline < 0.5) return null

  return {
    id: 'overtraining-no-rest',
    emoji: '🔥',
    title: '連續訓練天數偏高',
    description: `根據你的數據，近期有連續 ${maxStreak} 天訓練且睡眠品質下降 ${sleepDecline.toFixed(1)} 分。身體可能需要恢復時間。`,
    suggestion: '建議安排一天完全休息日或輕度活動恢復日，讓身體充分修復。',
    category: 'sleep_training',
    confidence: maxStreak >= 7 ? 'high' : 'medium',
    priority: 2,
  }
}

/**
 * Rule 4: Low carb days (<100g) correlate with low mood (≤2)
 */
const ruleLowCarbMood: RuleFn = ({ wellness, nutrition }) => {
  const wellnessMap = byDate(wellness)
  const pairs: Array<{ carbs: number; mood: number }> = []

  for (const n of nutrition) {
    if (!notNull(n.carbs_grams)) continue
    const w = wellnessMap.get(n.date)
    if (!w || !notNull(w.mood)) continue
    pairs.push({ carbs: n.carbs_grams, mood: w.mood })
  }

  if (pairs.length < 5) return null

  const lowCarbDays = pairs.filter(p => p.carbs < 100)
  const normalCarbDays = pairs.filter(p => p.carbs >= 100)

  if (lowCarbDays.length < 2 || normalCarbDays.length < 2) return null

  const moodLow = avg(lowCarbDays.map(p => p.mood))
  const moodNormal = avg(normalCarbDays.map(p => p.mood))
  const diff = moodNormal - moodLow

  if (diff < 0.8) return null

  return {
    id: 'low-carb-mood',
    emoji: '🍚',
    title: '低碳水與情緒連動',
    description: `根據你的數據，碳水 < 100g 的天數平均情緒為 ${moodLow.toFixed(1)}/5，正常碳水天數為 ${moodNormal.toFixed(1)}/5。低碳水攝取可能影響你的情緒狀態。`,
    suggestion: '如果情緒持續偏低，可嘗試適度增加碳水（特別是訓練日），觀察情緒變化。',
    category: 'nutrition_mood',
    confidence: lowCarbDays.length >= 4 ? 'high' : 'medium',
    priority: 3,
  }
}

/**
 * Rule 5: Nutrition compliance dropping >20% this week vs last week
 */
const ruleComplianceDrop: RuleFn = ({ nutrition }) => {
  const { thisWeek, lastWeek } = splitWeeks(nutrition)

  const compThis = thisWeek.filter(n => notNull(n.compliant))
  const compLast = lastWeek.filter(n => notNull(n.compliant))

  if (compThis.length < 4 || compLast.length < 4) return null

  const rateThis = compThis.filter(n => n.compliant).length / compThis.length
  const rateLast = compLast.filter(n => n.compliant).length / compLast.length

  if (rateLast === 0) return null
  const dropPct = ((rateLast - rateThis) / rateLast) * 100

  if (dropPct < 20) return null

  return {
    id: 'compliance-dropping',
    emoji: '📉',
    title: '飲食合規率下降',
    description: `根據你的數據，本週飲食合規率為 ${Math.round(rateThis * 100)}%，上週為 ${Math.round(rateLast * 100)}%，下降了 ${Math.round(dropPct)}%。`,
    suggestion: '先確認是否有外在因素（社交聚餐、壓力），可以從最容易執行的一餐開始重新建立節奏。',
    category: 'nutrition_mood',
    confidence: 'high',
    priority: 2,
  }
}

/**
 * Rule 6: 5+ days non-compliant + declining energy → stabilize diet
 */
const ruleNonCompliantEnergy: RuleFn = ({ wellness, nutrition }) => {
  const recentNutrition = nutrition.slice(0, 10)
  const nonCompliant = recentNutrition.filter(n => n.compliant === false)

  if (nonCompliant.length < 5) return null

  // Check energy trend (newest 5 vs prior 5)
  const recentEnergy = wellness.slice(0, 5).map(w => w.energy_level).filter(notNull)
  const priorEnergy = wellness.slice(5, 10).map(w => w.energy_level).filter(notNull)

  if (recentEnergy.length < 3 || priorEnergy.length < 3) return null

  const energyDecline = avg(priorEnergy) - avg(recentEnergy)
  if (energyDecline < 0.5) return null

  return {
    id: 'noncompliant-energy-drop',
    emoji: '⚡',
    title: '飲食不穩定影響體力',
    description: `根據你的數據，近 10 天有 ${nonCompliant.length} 天飲食未達標，同時精力評分下降了 ${energyDecline.toFixed(1)} 分。不穩定的飲食模式可能正在拖累你的體能。`,
    suggestion: '建議先把飲食穩定下來，即使無法完美執行，也先確保基本熱量與蛋白質達標。',
    category: 'nutrition_mood',
    confidence: 'high',
    priority: 1,
  }
}

/**
 * Rule 7: High RPE (≥8) followed by HRV drop next day → show pattern
 */
const ruleHighRPEHRVDrop: RuleFn = ({ wellness, training }) => {
  const wellnessMap = byDate(wellness)
  const trainingMap = byDate(training)
  const dates = wellness.map(w => w.date).sort()

  let highRPEWithDrop = 0
  let highRPETotal = 0

  for (let i = 0; i < dates.length - 1; i++) {
    const t = trainingMap.get(dates[i])
    if (!t || !notNull(t.rpe) || t.rpe < 8) continue
    highRPETotal++

    const todayW = wellnessMap.get(dates[i])
    const nextW = wellnessMap.get(dates[i + 1])
    if (!todayW || !nextW || !notNull(todayW.hrv) || !notNull(nextW.hrv)) continue

    if (nextW.hrv < todayW.hrv * 0.9) highRPEWithDrop++
  }

  if (highRPETotal < 3 || highRPEWithDrop < 2) return null

  return {
    id: 'high-rpe-hrv-drop',
    emoji: '💓',
    title: '高強度訓練後 HRV 下降',
    description: `根據你的數據，${highRPETotal} 次 RPE ≥ 8 的訓練中有 ${highRPEWithDrop} 次隔天 HRV 下降超過 10%。高強度訓練對你的自律神經恢復有明顯影響。`,
    suggestion: '高強度訓練日之間建議間隔至少 48 小時，讓 HRV 恢復到基線水平。',
    category: 'training_recovery',
    confidence: highRPEWithDrop >= 3 ? 'high' : 'medium',
    priority: 2,
  }
}

/**
 * Rule 8: Training volume trending up but recovery trending down → deload
 */
const ruleVolumeUpRecoveryDown: RuleFn = ({ wellness, training }) => {
  const { thisWeek: trainThis, lastWeek: trainLast } = splitWeeks(training)

  // Volume = total sessions or total duration
  const volThis = trainThis.length
  const volLast = trainLast.length

  if (volThis < 3 || volLast < 2) return null
  if (volThis <= volLast) return null // volume not increasing

  // Recovery: use device_recovery_score or fallback to energy+sleep composite
  const { thisWeek: wellThis, lastWeek: wellLast } = splitWeeks(wellness)

  const recoverThis = wellThis
    .map(w => w.device_recovery_score ?? (notNull(w.energy_level) && notNull(w.sleep_quality)
      ? ((w.energy_level + w.sleep_quality) / 10) * 100
      : null))
    .filter(notNull)

  const recoverLast = wellLast
    .map(w => w.device_recovery_score ?? (notNull(w.energy_level) && notNull(w.sleep_quality)
      ? ((w.energy_level + w.sleep_quality) / 10) * 100
      : null))
    .filter(notNull)

  if (recoverThis.length < 3 || recoverLast.length < 3) return null

  const recoveryDecline = avg(recoverLast) - avg(recoverThis)
  if (recoveryDecline < 8) return null // need meaningful decline

  return {
    id: 'volume-up-recovery-down',
    emoji: '⏸️',
    title: '訓練量增加但恢復下降',
    description: `根據你的數據，本週訓練 ${volThis} 次（上週 ${volLast} 次），但恢復指標下降了 ${Math.round(recoveryDecline)} 分。訓練量的增長超出目前的恢復能力。`,
    suggestion: '建議安排一週減量訓練（Deload），將訓練量降至平時的 50-60%，讓身體追上恢復。',
    category: 'training_recovery',
    confidence: recoveryDecline >= 15 ? 'high' : 'medium',
    priority: 2,
  }
}

/**
 * Rule 9: Supplement compliance dropped >30% vs previous period
 */
const ruleSupplementDrop: RuleFn = ({ supplementLogs, supplementCount }) => {
  if (supplementCount === 0) return null

  const { thisWeek, lastWeek } = splitWeeks(supplementLogs)

  if (thisWeek.length < 4 || lastWeek.length < 4) return null

  const rateThis = thisWeek.filter(s => s.completed).length / thisWeek.length
  const rateLast = lastWeek.filter(s => s.completed).length / lastWeek.length

  if (rateLast === 0) return null
  const dropPct = ((rateLast - rateThis) / rateLast) * 100

  if (dropPct < 30) return null

  return {
    id: 'supplement-compliance-drop',
    emoji: '💊',
    title: '補品打卡率下降',
    description: `根據你的數據，本週補品完成率為 ${Math.round(rateThis * 100)}%，較上週 ${Math.round(rateLast * 100)}% 下降了 ${Math.round(dropPct)}%。`,
    suggestion: '可以設定固定時間提醒，或把補品放在每天一定會看到的位置，降低遺忘機率。',
    category: 'supplement_effect',
    confidence: 'medium',
    priority: 4,
  }
}

/**
 * Rule 10: Compare sleep on supplement-taken vs supplement-skipped days
 * (Proxy for magnesium or general supplement effect on sleep)
 */
const ruleSupplementSleepEffect: RuleFn = ({ wellness, supplementLogs, supplementCount }) => {
  if (supplementCount === 0) return null

  const wellnessMap = byDate(wellness)
  const sleepTaken: number[] = []
  const sleepSkipped: number[] = []

  for (const log of supplementLogs) {
    const w = wellnessMap.get(log.date)
    if (!w) continue

    // Use wearable sleep score if available, fallback to subjective * 20
    const sleepScore = w.wearable_sleep_score ?? (notNull(w.sleep_quality) ? w.sleep_quality * 20 : null)
    if (!notNull(sleepScore)) continue

    if (log.completed) sleepTaken.push(sleepScore)
    else sleepSkipped.push(sleepScore)
  }

  if (sleepTaken.length < 3 || sleepSkipped.length < 2) return null

  const diff = avg(sleepTaken) - avg(sleepSkipped)
  if (diff < 5) return null // not meaningful

  return {
    id: 'supplement-sleep-effect',
    emoji: '🌙',
    title: '補品與睡眠品質連動',
    description: `根據你的數據，有服用補品的天數睡眠分數平均 ${Math.round(avg(sleepTaken))}，未服用天數為 ${Math.round(avg(sleepSkipped))}，差距 ${Math.round(diff)} 分。`,
    suggestion: '補品攝取似乎與較好的睡眠品質有關，建議持續穩定服用並觀察長期趨勢。',
    category: 'supplement_effect',
    confidence: sleepTaken.length + sleepSkipped.length >= 10 ? 'high' : 'low',
    priority: 4,
  }
}

/**
 * Rule 11: Energy + mood + training_drive all declining over 7 days → comprehensive recovery
 */
const ruleCompositeMentalDecline: RuleFn = ({ wellness }) => {
  if (wellness.length < 7) return null

  // Compare most recent 4 days vs prior 4 days (within the last ~10 days)
  const recent = wellness.slice(0, 4)
  const prior = wellness.slice(4, 8)

  const fields = ['energy_level', 'mood', 'training_drive'] as const

  let decliningCount = 0
  const declines: string[] = []

  for (const field of fields) {
    const recentVals = recent.map(w => w[field]).filter(notNull)
    const priorVals = prior.map(w => w[field]).filter(notNull)

    if (recentVals.length < 2 || priorVals.length < 2) continue

    const decline = avg(priorVals) - avg(recentVals)
    if (decline >= 0.5) {
      decliningCount++
      const label = field === 'energy_level' ? '精力' : field === 'mood' ? '情緒' : '訓練動力'
      declines.push(`${label} -${decline.toFixed(1)}`)
    }
  }

  if (decliningCount < 2) return null // need at least 2 of 3 declining

  return {
    id: 'composite-mental-decline',
    emoji: '🧠',
    title: '整體狀態下滑',
    description: `根據你的數據，近期多項主觀指標同步下降：${declines.join('、')}。這可能是累積疲勞或壓力的訊號。`,
    suggestion: decliningCount === 3
      ? '建議安排 2-3 天積極恢復（輕度活動、充足睡眠、適當社交），必要時與教練討論調整課表。'
      : '留意身體訊號，如果持續下滑建議主動休息一天，並確保睡眠與營養基本到位。',
    category: 'trend',
    confidence: decliningCount === 3 ? 'high' : 'medium',
    priority: 1,
  }
}

/**
 * Rule 12: Weight plateau (<0.3kg change in 14 days) + compliant diet → suggest refeed/diet break
 */
const ruleWeightPlateau: RuleFn = ({ wellness, nutrition, bodyWeight, goalType }) => {
  // Only relevant for cut or bulk
  if (goalType === 'recomp') return null

  // Check weight variance from bodyWeight (which is current)
  // We don't have daily weight in wellness, so use bodyWeight as current reference
  // and look at compliance. If consistently compliant but goal not progressing,
  // the coach should know.

  const compliantDays = nutrition.filter(n => n.compliant === true)
  const totalDaysWithData = nutrition.filter(n => notNull(n.compliant))

  if (totalDaysWithData.length < 10) return null

  const complianceRate = compliantDays.length / totalDaysWithData.length
  if (complianceRate < 0.7) return null // not compliant enough to diagnose plateau

  // Use calorie consistency as proxy for plateau (if calories are very consistent but no progress)
  const calories = nutrition.map(n => n.calories).filter(notNull)
  if (calories.length < 10) return null

  const calRange = Math.max(...calories) - Math.min(...calories)
  const avgCal = avg(calories)

  // If calorie variance is low (< 15% of average) and compliance is high,
  // there might be metabolic adaptation
  if (calRange / avgCal > 0.15) return null

  const goalLabel = goalType === 'cut' ? '減脂' : '增肌'

  return {
    id: 'weight-plateau',
    emoji: '⚖️',
    title: `${goalLabel}進度可能停滯`,
    description: `根據你的數據，過去 14 天飲食合規率 ${Math.round(complianceRate * 100)}% 且熱量攝取穩定（平均 ${Math.round(avgCal)} kcal），但目標進度可能需要調整。`,
    suggestion: goalType === 'cut'
      ? '可考慮安排 1-2 天 Refeed（提高碳水至維持熱量），或與教練討論是否需要 Diet Break。'
      : '可考慮微幅增加熱量盈餘（+100-200 kcal），或與教練討論訓練變項調整。',
    category: 'trend',
    confidence: complianceRate >= 0.85 ? 'high' : 'medium',
    priority: 3,
  }
}

// ── Main Engine ─────────────────────────────

const ALL_RULES: RuleFn[] = [
  rulePoorSleepStreak,       // Rule 1
  ruleSleepeRPECorrelation,  // Rule 2
  ruleOvertrainingNoRest,    // Rule 3
  ruleLowCarbMood,           // Rule 4
  ruleComplianceDrop,        // Rule 5
  ruleNonCompliantEnergy,    // Rule 6
  ruleHighRPEHRVDrop,        // Rule 7
  ruleVolumeUpRecoveryDown,  // Rule 8
  ruleSupplementDrop,        // Rule 9
  ruleSupplementSleepEffect, // Rule 10
  ruleCompositeMentalDecline, // Rule 11
  ruleWeightPlateau,         // Rule 12
]

const MAX_INSIGHTS = 5

export function generateBehaviorInsights(input: InsightInput): BehaviorInsight[] {
  const results: BehaviorInsight[] = []

  for (const rule of ALL_RULES) {
    try {
      const insight = rule(input)
      if (insight) results.push(insight)
    } catch {
      // Silently skip any rule that throws (bad data shape, etc.)
      continue
    }
  }

  // Sort by priority (1 = highest), then by confidence tiebreaker
  const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  results.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return (confidenceOrder[a.confidence] ?? 1) - (confidenceOrder[b.confidence] ?? 1)
  })

  return results.slice(0, MAX_INSIGHTS)
}
