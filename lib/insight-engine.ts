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

  // 體重歷史（14 天，用於停滯偵測）
  weightHistory?: Array<{ date: string; weight: number }>
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

/** Get the next calendar day as YYYY-MM-DD string. */
function nextCalendarDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
const ruleSleepRPECorrelation: RuleFn = ({ wellness, training }) => {
  const wellnessMap = byDate(wellness)
  const trainingMap = byDate(training)
  const dates = wellness.map(w => w.date).sort() // chronological

  const rpeAfterPoor: number[] = []
  const rpeAfterGood: number[] = []

  for (let i = 0; i < dates.length - 1; i++) {
    const sleepDay = wellnessMap.get(dates[i])
    // Bug fix: 確認 dates[i+1] 是真正的隔天，不是跳天
    const nextDate = nextCalendarDay(dates[i])
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
  // Bug fix: 用所有日期（wellness + training 聯集）算連續訓練天數
  // 避免只有訓練沒有 wellness 記錄的天被遺漏
  const trainingDates = new Set(training.filter(t => t.training_type && t.training_type !== 'rest').map(t => t.date))
  const allDatesSet = new Set([...wellness.map(w => w.date), ...training.map(t => t.date)])
  const allDates = [...allDatesSet].sort() // chronological

  let maxStreak = 0
  let currentStreak = 0
  let expectedDate: string | null = null
  for (const date of allDates) {
    // 確認日曆連續性
    if (expectedDate && date !== expectedDate) {
      // 跳天了，如果中間的天有訓練記錄也要算
      currentStreak = trainingDates.has(date) ? 1 : 0
    } else if (trainingDates.has(date)) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
    expectedDate = nextCalendarDay(date)
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
    // Bug fix: 確認隔天是真正的日曆隔天
    const nextW = wellnessMap.get(nextCalendarDay(dates[i]))
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

  // Bug fix: 一天可能有多筆 supplement log（每顆一筆），用 Map 去重
  // 一天中只要有任何一顆沒吃就算 skipped
  const dailyCompletion = new Map<string, boolean>()
  for (const log of supplementLogs) {
    const existing = dailyCompletion.get(log.date)
    if (existing === undefined) {
      dailyCompletion.set(log.date, log.completed)
    } else {
      // 只要有一顆沒吃，整天算 skipped
      if (!log.completed) dailyCompletion.set(log.date, false)
    }
  }

  for (const [date, allCompleted] of dailyCompletion) {
    const w = wellnessMap.get(date)
    if (!w) continue

    // Use wearable sleep score if available, fallback to subjective * 20
    const sleepScore = w.wearable_sleep_score ?? (notNull(w.sleep_quality) ? w.sleep_quality * 20 : null)
    if (!notNull(sleepScore)) continue

    if (allCompleted) sleepTaken.push(sleepScore)
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
const ruleWeightPlateau: RuleFn = ({ nutrition, goalType, weightHistory }) => {
  // Only relevant for cut or bulk
  if (goalType === 'recomp') return null

  // Bug fix: 使用實際體重歷史判斷停滯，而非只看熱量穩定性
  const weights = weightHistory?.map(w => w.weight) ?? []
  const compliantDays = nutrition.filter(n => n.compliant === true)
  const totalDaysWithData = nutrition.filter(n => notNull(n.compliant))

  if (totalDaysWithData.length < 10) return null
  const complianceRate = compliantDays.length / totalDaysWithData.length
  if (complianceRate < 0.7) return null

  // 有體重數據：用實際體重波動判斷
  if (weights.length >= 4) {
    const maxW = Math.max(...weights)
    const minW = Math.min(...weights)
    const range = maxW - minW
    // 體重波動 < 0.5kg = 停滯
    if (range >= 0.5) return null
  } else {
    // 沒有體重數據：fallback 用熱量穩定性當代理
    const calories = nutrition.map(n => n.calories).filter(notNull)
    if (calories.length < 10) return null
    const calRange = Math.max(...calories) - Math.min(...calories)
    const avgCal = avg(calories)
    if (calRange / avgCal > 0.15) return null
  }

  const goalLabel = goalType === 'cut' ? '減脂' : '增肌'
  const weightInfo = weights.length >= 4
    ? `體重近 14 天波動僅 ${(Math.max(...weights) - Math.min(...weights)).toFixed(1)}kg`
    : '熱量攝取穩定但進度可能未如預期'

  return {
    id: 'weight-plateau',
    emoji: '⚖️',
    title: `${goalLabel}進度可能停滯`,
    description: `根據你的數據，過去 14 天飲食合規率 ${Math.round(complianceRate * 100)}%，${weightInfo}。`,
    suggestion: goalType === 'cut'
      ? '可考慮安排 1-2 天 Refeed（提高碳水至維持熱量），或與教練討論是否需要 Diet Break。'
      : '可考慮微幅增加熱量盈餘（+100-200 kcal），或與教練討論訓練變項調整。',
    category: 'trend',
    confidence: weights.length >= 4 && complianceRate >= 0.85 ? 'high' : 'medium',
    priority: 3,
  }
}

// ── Early Rules (3 天數據即可觸發，解決新用戶空白期) ──

/**
 * Early Rule 1: 首次記錄體重 + 飲食 → 正向回饋 + 引導持續
 */
const ruleEarlyFirstSteps: RuleFn = ({ nutrition, weightHistory }) => {
  const hasWeight = (weightHistory?.length ?? 0) >= 1
  const hasNutrition = nutrition.length >= 1

  if (!hasWeight || !hasNutrition) return null
  // 只在前 5 天觸發（之後有更有價值的 insight）
  if (nutrition.length > 5) return null

  return {
    id: 'early-first-steps',
    emoji: '🎉',
    title: '開始追蹤了！',
    description: `你已記錄 ${nutrition.length} 天飲食和體重。持續記錄 7 天後，系統就能分析你的飲食與身體狀態之間的關聯。`,
    suggestion: '目標：連續 7 天記錄飲食 + 體重，解鎖個人化分析。',
    category: 'trend',
    confidence: 'low',
    priority: 2,
  }
}

/**
 * Early Rule 2: 前 3 天的飲食蛋白質是否達標
 */
const ruleEarlyProteinCheck: RuleFn = ({ nutrition, bodyWeight }) => {
  const withProtein = nutrition.filter(n => notNull(n.protein_grams))
  if (withProtein.length < 2 || withProtein.length > 7) return null

  const avgProtein = avg(withProtein.map(n => n.protein_grams!))
  const proteinPerKg = avgProtein / bodyWeight
  const target = 1.6 // 最低建議值

  if (proteinPerKg >= target) {
    return {
      id: 'early-protein-good',
      emoji: '💪',
      title: '蛋白質攝取充足',
      description: `根據你的數據，近 ${withProtein.length} 天平均蛋白質 ${Math.round(avgProtein)}g（${proteinPerKg.toFixed(1)}g/kg），達到建議量。`,
      suggestion: '繼續保持！蛋白質是增肌減脂的基石，你目前的攝取量很棒。',
      category: 'nutrition_mood',
      confidence: 'medium',
      priority: 4,
    }
  }

  return {
    id: 'early-protein-low',
    emoji: '🥩',
    title: '蛋白質可能不足',
    description: `根據你的數據，近 ${withProtein.length} 天平均蛋白質 ${Math.round(avgProtein)}g（${proteinPerKg.toFixed(1)}g/kg），低於建議的 ${target}g/kg。`,
    suggestion: `試著每餐加入一份掌心大小的蛋白質來源（雞胸、蛋、豆腐），目標 ${Math.round(bodyWeight * target)}g/天。`,
    category: 'nutrition_mood',
    confidence: 'medium',
    priority: 2,
  }
}

/**
 * Early Rule 3: 前 3 天的睡眠品質回饋
 */
const ruleEarlySleepFeedback: RuleFn = ({ wellness }) => {
  const withSleep = wellness.filter(w => notNull(w.sleep_quality))
  if (withSleep.length < 2 || withSleep.length > 7) return null

  const avgSleep = avg(withSleep.map(w => w.sleep_quality!))

  if (avgSleep >= 4) return null // 睡得好不需要提醒

  return {
    id: 'early-sleep-feedback',
    emoji: '😴',
    title: '睡眠品質偏低',
    description: `根據你的數據，近 ${withSleep.length} 天平均睡眠品質 ${avgSleep.toFixed(1)}/5。睡眠是恢復的基礎，直接影響訓練效果和體態進展。`,
    suggestion: '試試固定起床時間、睡前 1 小時不看手機、臥室溫度調到 18-20°C。',
    category: 'sleep_training',
    confidence: 'low',
    priority: 2,
  }
}

/**
 * Early Rule 4: 記錄了但沒有每天記 → 鼓勵持續
 */
const ruleEarlyConsistency: RuleFn = ({ nutrition, wellness }) => {
  const totalDays = Math.max(nutrition.length, wellness.length)
  if (totalDays < 3 || totalDays > 10) return null

  // 算「有記錄的天數」佔總天數的比例
  const nutritionDates = new Set(nutrition.map(n => n.date))
  const wellnessDates = new Set(wellness.map(w => w.date))
  const allDates = new Set([...nutritionDates, ...wellnessDates])

  // 如果記錄天數 >= 實際天數的 80%，不需要提醒
  if (allDates.size >= totalDays * 0.8) return null

  const missedDays = totalDays - allDates.size
  if (missedDays < 2) return null

  return {
    id: 'early-consistency',
    emoji: '📝',
    title: '持續記錄讓分析更準',
    description: `近 ${totalDays} 天中有 ${missedDays} 天沒有記錄。數據越完整，系統能給你的個人化建議就越準確。`,
    suggestion: '不需要完美記錄，每天花 30 秒填體重 + 飲食合規就夠了。',
    category: 'trend',
    confidence: 'low',
    priority: 3,
  }
}

// ── Main Engine ─────────────────────────────

const ALL_RULES: RuleFn[] = [
  // 早期規則（3 天數據即可，新用戶前 7 天觸發）
  ruleEarlyFirstSteps,       // Early 1
  ruleEarlyProteinCheck,     // Early 2
  ruleEarlySleepFeedback,    // Early 3
  ruleEarlyConsistency,      // Early 4
  // 標準規則（需 7-14 天數據）
  rulePoorSleepStreak,       // Rule 1
  ruleSleepRPECorrelation,   // Rule 2
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
