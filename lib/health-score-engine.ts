/**
 * Health Score Engine
 * 健康分數引擎 — 健康模式（Health Mode）專用
 *
 * 計算邏輯：
 *   吃（飲食合規）20% + 睡（睡眠品質）20% + 練（訓練天數）20%
 *   + 補（補品依從）15% + 主觀精力/情緒/認知/壓力 25%
 *
 * 血液指標：alert 每項 -10 分，attention 每項 -5 分（最多扣 30 分）
 *
 * 無數據處理：
 *   有數據的支柱正常計分，無數據的支柱不參與加權（避免 fallback 50 分的誤導）。
 *   若所有支柱都無數據，返回 insufficient_data 狀態。
 *
 * 血檢時效：
 *   > 90 天的血檢結果懲罰減半（可能已改善但未複檢），> 180 天不計入。
 *
 * 文獻依據：
 *   - WHO Well-being Index（2012）
 *   - Bize et al. 2007 (Prev Med)：健康行為與主觀健康感受的相關性
 */

export interface HealthPillarScore {
  pillar: 'sleep' | 'wellness' | 'nutrition' | 'training' | 'supplement'
  label: string
  score: number | null   // 0–100, null = 無數據
  emoji: string
  detail: string
  hasData: boolean
}

export interface HealthScore {
  total: number | null       // 0–100（加權合計），null = 數據不足
  grade: 'A' | 'B' | 'C' | 'D' | null  // A≥80, B≥65, C≥50, D<50, null = 數據不足
  pillars: HealthPillarScore[]
  labPenalty: number         // 負值，血檢異常扣分
  daysInCycle: number | null     // 本季第幾天（1-90）
  daysUntilBloodTest: number | null  // 距下次血檢（季末）
  insufficientData: boolean  // 是否數據不足無法評分
  scoredPillarCount: number  // 有數據的支柱數量
}

export interface HealthScoreInput {
  wellnessLast7: Array<{
    sleep_quality: number | null
    energy_level: number | null
    mood: number | null
    cognitive_clarity?: number | null
    stress_level?: number | null
  }>
  nutritionLast7: Array<{ compliant: boolean | null }>
  trainingLast7: Array<{ training_type: string }>
  supplementComplianceRate: number   // 0–1（週平均補品打卡率）
  labResults: Array<{
    status: 'normal' | 'attention' | 'alert'
    date?: string | null  // ISO date string，用於時效衰減
  }>
  quarterlyStart?: string | null     // ISO date string
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function calculateHealthScore(input: HealthScoreInput): HealthScore {
  const {
    wellnessLast7,
    nutritionLast7,
    trainingLast7,
    supplementComplianceRate,
    labResults,
    quarterlyStart,
  } = input

  // ── 1. 睡眠分數（權重 20%）──
  const sleepRaw = wellnessLast7.map(w => w.sleep_quality).filter(v => v != null) as number[]
  const hasSleepData = sleepRaw.length > 0
  const sleepScore = hasSleepData ? (avg(sleepRaw) / 5) * 100 : null
  const sleepDetail = hasSleepData
    ? `近7天平均 ${avg(sleepRaw).toFixed(1)}/5`
    : '尚無記錄'

  // ── 2. 主觀健康分數（權重 25%）= 精力 + 心情 + 認知清晰 - 壓力 ──
  const energyRaw = wellnessLast7.map(w => w.energy_level).filter(v => v != null) as number[]
  const moodRaw = wellnessLast7.map(w => w.mood).filter(v => v != null) as number[]
  const cogRaw = wellnessLast7.map(w => w.cognitive_clarity).filter(v => v != null) as number[]
  const stressRaw = wellnessLast7.map(w => w.stress_level).filter(v => v != null) as number[]

  // 壓力反轉：壓力 5（高） → 貢獻 1 分（差），壓力 1（低） → 貢獻 5 分（好）
  const stressInverted = stressRaw.map(s => 6 - s)
  const allWellness = [...energyRaw, ...moodRaw, ...cogRaw, ...stressInverted]
  const hasWellnessData = allWellness.length > 0
  const wellnessScore = hasWellnessData ? (avg(allWellness) / 5) * 100 : null
  const wellnessDetail = hasWellnessData
    ? `精力/情緒/認知 近7天均分 ${(avg(allWellness) / 5 * 10).toFixed(1)}/10`
    : '尚無記錄'

  // ── 3. 飲食分數（權重 20%）──
  const compliantDays = nutritionLast7.filter(n => n.compliant === true).length
  const hasNutritionData = nutritionLast7.length > 0
  const nutritionScore = hasNutritionData
    ? (compliantDays / nutritionLast7.length) * 100
    : null
  const nutritionDetail = hasNutritionData
    ? `近7天合規 ${compliantDays}/${nutritionLast7.length} 天`
    : '尚無記錄'

  // ── 4. 訓練分數（權重 20%）── 每週 3 天為滿分
  const trainingDays = trainingLast7.filter(t => t.training_type !== 'rest').length
  const hasTrainingData = trainingLast7.length > 0
  const trainingScore = hasTrainingData ? Math.min(100, (trainingDays / 3) * 100) : null
  const trainingDetail = hasTrainingData
    ? `近7天訓練 ${trainingDays} 天`
    : '尚無記錄'

  // ── 5. 補品分數（權重 15%）──
  // supplementComplianceRate > 0 才算有數據（0 表示完全沒打卡或沒設定補品）
  const hasSupplementData = supplementComplianceRate > 0
  const supplementScore = hasSupplementData ? Math.min(100, supplementComplianceRate * 100) : null
  const supplementDetail = hasSupplementData
    ? `近7天依從率 ${Math.round(supplementComplianceRate * 100)}%`
    : '尚無記錄'

  // ── 6. 血液指標懲罰 ──
  // 時效衰減：> 90 天的結果懲罰減半，> 180 天不計入
  // 上限提高至 -30 分（原本 -20 太溫和，5 個 alert 只扣 20 不合理）
  const now = new Date()
  let rawLabPenalty = 0
  for (const lab of labResults) {
    let weight = 1.0
    if (lab.date) {
      const daysAgo = Math.floor((now.getTime() - new Date(lab.date).getTime()) / 86400000)
      if (daysAgo > 180) continue      // 超過 6 個月：不計入
      if (daysAgo > 90) weight = 0.5   // 超過 3 個月：懲罰減半
    }
    if (lab.status === 'alert') rawLabPenalty -= 10 * weight
    else if (lab.status === 'attention') rawLabPenalty -= 5 * weight
  }
  const labPenalty = Math.max(-30, rawLabPenalty)

  // ── 動態加權合計：只對有數據的支柱計分 ──
  const pillarWeights: { score: number; baseWeight: number }[] = []
  if (sleepScore != null) pillarWeights.push({ score: sleepScore, baseWeight: 0.20 })
  if (wellnessScore != null) pillarWeights.push({ score: wellnessScore, baseWeight: 0.25 })
  if (nutritionScore != null) pillarWeights.push({ score: nutritionScore, baseWeight: 0.20 })
  if (trainingScore != null) pillarWeights.push({ score: trainingScore, baseWeight: 0.20 })
  if (supplementScore != null) pillarWeights.push({ score: supplementScore, baseWeight: 0.15 })

  const scoredPillarCount = pillarWeights.length
  const insufficientData = scoredPillarCount === 0

  let total: number | null = null
  let grade: 'A' | 'B' | 'C' | 'D' | null = null

  if (!insufficientData) {
    // 重新正規化權重：使有數據的支柱權重加總為 1.0
    const totalWeight = pillarWeights.reduce((s, p) => s + p.baseWeight, 0)
    const weighted = pillarWeights.reduce(
      (s, p) => s + p.score * (p.baseWeight / totalWeight), 0
    ) + labPenalty

    total = Math.max(0, Math.min(100, Math.round(weighted)))
    grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D'
  }

  // ── 季度週期計算 ──
  let daysInCycle: number | null = null
  let daysUntilBloodTest: number | null = null

  if (quarterlyStart) {
    const start = new Date(quarterlyStart)
    const elapsed = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1
    daysInCycle = Math.min(90, Math.max(1, elapsed))
    daysUntilBloodTest = Math.max(0, 90 - daysInCycle)
  }

  return {
    total,
    grade,
    pillars: [
      { pillar: 'sleep',      label: '睡眠',     score: sleepScore != null ? Math.round(sleepScore) : null,         emoji: '😴', detail: sleepDetail, hasData: hasSleepData },
      { pillar: 'wellness',   label: '精力/情緒', score: wellnessScore != null ? Math.round(wellnessScore) : null,   emoji: '⚡', detail: wellnessDetail, hasData: hasWellnessData },
      { pillar: 'nutrition',  label: '飲食',     score: nutritionScore != null ? Math.round(nutritionScore) : null,  emoji: '🥗', detail: nutritionDetail, hasData: hasNutritionData },
      { pillar: 'training',   label: '訓練',     score: trainingScore != null ? Math.round(trainingScore) : null,    emoji: '🏋️', detail: trainingDetail, hasData: hasTrainingData },
      { pillar: 'supplement', label: '補品',     score: supplementScore != null ? Math.round(supplementScore) : null, emoji: '💊', detail: supplementDetail, hasData: hasSupplementData },
    ],
    labPenalty,
    daysInCycle,
    daysUntilBloodTest,
    insufficientData,
    scoredPillarCount,
  }
}
