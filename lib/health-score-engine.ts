/**
 * Health Score Engine
 * 健康分數引擎 — 健康模式（Health Mode）專用
 *
 * 計算邏輯：
 *   吃（飲食合規）20% + 睡（睡眠品質）20% + 練（訓練天數）20%
 *   + 補（補品依從）15% + 主觀精力/情緒/認知/壓力 25%
 *
 * 血液指標：alert 每項 -10 分，attention 每項 -5 分（最多扣 20 分）
 *
 * 文獻依據：
 *   - WHO Well-being Index（2012）
 *   - Bize et al. 2007 (Prev Med)：健康行為與主觀健康感受的相關性
 */

export interface HealthPillarScore {
  pillar: 'sleep' | 'wellness' | 'nutrition' | 'training' | 'supplement'
  label: string
  score: number   // 0–100
  emoji: string
  detail: string
}

export interface HealthScore {
  total: number            // 0–100（加權合計）
  grade: 'A' | 'B' | 'C' | 'D'  // A≥80, B≥65, C≥50, D<50
  pillars: HealthPillarScore[]
  labPenalty: number       // 負值，血檢異常扣分
  labBonus: number         // 正值，血檢全正常 / 優秀行為獎勵
  daysInCycle: number | null     // 本季第幾天（1-90）
  daysUntilBloodTest: number | null  // 距下次血檢（季末）
}

export interface HealthScoreInput {
  wellnessLast7: Array<{
    sleep_quality: number | null
    energy_level: number | null
    mood: number | null
    cognitive_clarity?: number | null
    stress_level?: number | null
    // 穿戴裝置數據
    wearable_sleep_score?: number | null
    device_recovery_score?: number | null
    hrv?: number | null
    resting_hr?: number | null
  }>
  nutritionLast7: Array<{ compliant: boolean | null }>
  trainingLast7: Array<{ training_type: string }>
  supplementComplianceRate: number   // 0–1（週平均補品打卡率）
  labResults: Array<{ status: 'normal' | 'attention' | 'alert' }>
  hrvBaseline?: number | null          // 個人 HRV 長期平均（ms），用來跟近 7 天比
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

  // ── 1. 睡眠分數（20%）──
  // 優先使用穿戴裝置睡眠分數（0-100 客觀），fallback 到主觀睡眠品質（1-5）
  // 兩者都有時取加權平均（裝置 60% + 主觀 40%）
  const wearableSleepRaw = wellnessLast7.map(w => w.wearable_sleep_score).filter(v => v != null) as number[]
  const subjectiveSleepRaw = wellnessLast7.map(w => w.sleep_quality).filter(v => v != null) as number[]

  let sleepScore: number
  let sleepDetail: string

  if (wearableSleepRaw.length > 0 && subjectiveSleepRaw.length > 0) {
    // 兩者都有：裝置 60% + 主觀 40%（客觀優先）
    const wearableAvg = avg(wearableSleepRaw)
    const subjectiveAvg = (avg(subjectiveSleepRaw) / 5) * 100
    sleepScore = wearableAvg * 0.6 + subjectiveAvg * 0.4
    sleepDetail = `裝置 ${Math.round(wearableAvg)}/100 + 主觀 ${avg(subjectiveSleepRaw).toFixed(1)}/5`
  } else if (wearableSleepRaw.length > 0) {
    sleepScore = avg(wearableSleepRaw)
    sleepDetail = `裝置睡眠分數 ${Math.round(avg(wearableSleepRaw))}/100`
  } else if (subjectiveSleepRaw.length > 0) {
    sleepScore = (avg(subjectiveSleepRaw) / 5) * 100
    sleepDetail = `近7天平均 ${avg(subjectiveSleepRaw).toFixed(1)}/5`
  } else {
    sleepScore = 50
    sleepDetail = '尚無記錄'
  }

  // ── 2. 主觀健康分數（25%）= 精力 + 心情 + 認知清晰 - 壓力 ──
  const energyRaw = wellnessLast7.map(w => w.energy_level).filter(v => v != null) as number[]
  const moodRaw = wellnessLast7.map(w => w.mood).filter(v => v != null) as number[]
  const cogRaw = wellnessLast7.map(w => w.cognitive_clarity).filter(v => v != null) as number[]
  const stressRaw = wellnessLast7.map(w => w.stress_level).filter(v => v != null) as number[]

  // 壓力反轉：壓力 5（高） → 貢獻 1 分（差），壓力 1（低） → 貢獻 5 分（好）
  const stressInverted = stressRaw.map(s => 6 - s)
  const allWellness = [...energyRaw, ...moodRaw, ...cogRaw, ...stressInverted]
  const subjectiveWellnessScore = allWellness.length > 0 ? (avg(allWellness) / 5) * 100 : 50

  // 整合穿戴裝置恢復分數：有裝置數據時做客觀+主觀融合
  const recoveryRaw = wellnessLast7.map(w => w.device_recovery_score).filter(v => v != null) as number[]
  let wellnessScore: number
  let wellnessDetail: string

  if (recoveryRaw.length > 0 && allWellness.length > 0) {
    // 裝置恢復 40% + 主觀 60%（主觀涵蓋更多面向所以權重較高）
    wellnessScore = avg(recoveryRaw) * 0.4 + subjectiveWellnessScore * 0.6
    wellnessDetail = `主觀 ${(avg(allWellness) / 5 * 10).toFixed(1)}/10 + 裝置恢復 ${Math.round(avg(recoveryRaw))}/100`
  } else if (recoveryRaw.length > 0) {
    wellnessScore = avg(recoveryRaw)
    wellnessDetail = `裝置恢復分數 ${Math.round(avg(recoveryRaw))}/100`
  } else {
    wellnessScore = subjectiveWellnessScore
    wellnessDetail = allWellness.length > 0
      ? `精力/情緒/認知 近7天均分 ${(avg(allWellness) / 5 * 10).toFixed(1)}/10`
      : '尚無記錄'
  }

  // ── 3. 飲食分數（20%）──
  const compliantDays = nutritionLast7.filter(n => n.compliant === true).length
  const nutritionScore = nutritionLast7.length > 0
    ? (compliantDays / nutritionLast7.length) * 100
    : 50
  const nutritionDetail = nutritionLast7.length > 0
    ? `近7天合規 ${compliantDays}/${nutritionLast7.length} 天`
    : '尚無記錄'

  // ── 4. 訓練分數（20%）── 每週 3 天為滿分
  const trainingDays = trainingLast7.filter(t => t.training_type !== 'rest').length
  const trainingScore = Math.min(100, (trainingDays / 3) * 100)
  const trainingDetail = `近7天訓練 ${trainingDays} 天`

  // ── 5. 補品分數（15%）──
  const supplementScore = Math.min(100, supplementComplianceRate * 100)
  const supplementDetail = `近7天依從率 ${Math.round(supplementComplianceRate * 100)}%`

  // ── 6. 血液指標懲罰（最多 -20 分）──
  const alertCount = labResults.filter(l => l.status === 'alert').length
  const attentionCount = labResults.filter(l => l.status === 'attention').length
  const labPenalty = labResults.length > 0
    ? Math.max(-20, -(alertCount * 10 + attentionCount * 5))
    : 0

  // ── 7. 正向獎勵（最多 +10 分）──
  // 當行為和指標都優秀時，給予額外加分，而不只是「沒扣分」
  let labBonus = 0

  // 7a. 血檢全正常獎勵：有做血檢且全部 normal → +5 分
  if (labResults.length >= 3 && alertCount === 0 && attentionCount === 0) {
    labBonus += 5
  }

  // 7b. 睡眠卓越獎勵：7 天平均 >90 分 → +2 分
  if (sleepScore > 90) {
    labBonus += 2
  }

  // 7c. 飲食完美週獎勵：7/7 天合規 → +2 分
  if (compliantDays === 7 && nutritionLast7.length === 7) {
    labBonus += 2
  }

  // 7d. HRV 卓越獎勵：近 7 天平均 HRV 高於個人 baseline 10% → +1 分
  // HRV 個體差異極大（30-100+ms），必須跟自己比才有意義
  const hrvRaw = wellnessLast7.map(w => w.hrv).filter(v => v != null) as number[]
  if (hrvRaw.length > 0 && input.hrvBaseline && input.hrvBaseline > 0) {
    const hrvWeekAvg = avg(hrvRaw)
    if (hrvWeekAvg > input.hrvBaseline * 1.1) {
      labBonus += 1
    }
  }

  // 上限 +10 分
  labBonus = Math.min(10, labBonus)

  // ── 加權合計 ──
  const weighted =
    sleepScore * 0.20 +
    wellnessScore * 0.25 +
    nutritionScore * 0.20 +
    trainingScore * 0.20 +
    supplementScore * 0.15 +
    labPenalty +
    labBonus

  const total = Math.max(0, Math.min(100, Math.round(weighted)))

  const grade: 'A' | 'B' | 'C' | 'D' =
    total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D'

  // ── 季度週期計算 ──
  let daysInCycle: number | null = null
  let daysUntilBloodTest: number | null = null

  if (quarterlyStart) {
    const start = new Date(quarterlyStart)
    const today = new Date()
    const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
    daysInCycle = Math.min(90, Math.max(1, elapsed))
    daysUntilBloodTest = Math.max(0, 90 - daysInCycle)
  }

  return {
    total,
    grade,
    pillars: [
      { pillar: 'sleep',      label: '睡眠',   score: Math.round(sleepScore),       emoji: '😴', detail: sleepDetail },
      { pillar: 'wellness',   label: '精力/情緒', score: Math.round(wellnessScore), emoji: '⚡', detail: wellnessDetail },
      { pillar: 'nutrition',  label: '飲食',   score: Math.round(nutritionScore),   emoji: '🥗', detail: nutritionDetail },
      { pillar: 'training',   label: '訓練',   score: Math.round(trainingScore),    emoji: '🏋️', detail: trainingDetail },
      { pillar: 'supplement', label: '補品',   score: Math.round(supplementScore),  emoji: '💊', detail: supplementDetail },
    ],
    labPenalty,
    labBonus,
    daysInCycle,
    daysUntilBloodTest,
  }
}
