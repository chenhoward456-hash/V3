/**
 * Client Churn Predictor
 * 學員流失預警系統
 *
 * 分析學員的行為模式，在流失前提早預警。
 * 核心概念：學員不是突然消失的，他們是慢慢變安靜的。
 *
 * 訊號權重參考：
 * - 記錄頻率下降是最強的流失指標
 * - 情緒/精力持續低落是第二指標
 * - 體重停滯 + 動機下降是組合指標
 */

export interface ChurnInput {
  clientId: string
  clientName: string
  isActive: boolean

  // 近 30 天每天的記錄狀態
  dailyActivity: Array<{
    date: string
    hasWellness: boolean
    hasNutrition: boolean
    hasTraining: boolean
    hasSupplement: boolean
    hasBodyComp: boolean
  }>

  // 近 14 天 wellness 趨勢
  wellness: Array<{
    date: string
    energy_level: number | null
    mood: number | null
    training_drive: number | null
  }>

  // 補品合規率
  supplementComplianceRate: number // 0-1

  // 飲食合規率
  nutritionComplianceRate: number // 0-100

  // 體重趨勢（有停滯嗎？）
  weightStagnant: boolean // 近 14 天波動 < 0.5kg

  // 學員訂閱層級
  subscriptionTier: string
}

export interface ChurnPrediction {
  riskScore: number  // 0-100，越高越危險
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  riskFactors: string[]
  suggestedActions: string[]
  daysSinceLastActivity: number
  engagementTrend: 'improving' | 'stable' | 'declining' | 'inactive'
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function predictChurn(input: ChurnInput): ChurnPrediction {
  let riskScore = 0
  const riskFactors: string[] = []
  const suggestedActions: string[] = []

  const { dailyActivity, wellness } = input

  // ─── 1. 記錄頻率分析（最高 35 分）───
  // 把 30 天分成 3 段：前 10 天、中 10 天、近 10 天
  const segment1 = dailyActivity.slice(0, 10)
  const segment2 = dailyActivity.slice(10, 20)
  const segment3 = dailyActivity.slice(20, 30)

  const activityCount = (days: typeof dailyActivity) =>
    days.filter(d => d.hasWellness || d.hasNutrition || d.hasTraining || d.hasSupplement || d.hasBodyComp).length

  const count1 = activityCount(segment1)
  const count2 = activityCount(segment2)
  const count3 = activityCount(segment3)

  // 計算最近 7 天有活動的天數
  const recent7Activity = dailyActivity.slice(-7)
  const recent7Count = activityCount(recent7Activity)

  // 計算最後一次活動距今幾天
  let daysSinceLastActivity = 30
  for (let i = dailyActivity.length - 1; i >= 0; i--) {
    const d = dailyActivity[i]
    if (d.hasWellness || d.hasNutrition || d.hasTraining || d.hasSupplement || d.hasBodyComp) {
      const today = new Date()
      const actDate = new Date(d.date)
      daysSinceLastActivity = Math.floor((today.getTime() - actDate.getTime()) / 86400000)
      break
    }
  }

  // 完全無活動
  if (daysSinceLastActivity >= 14) {
    riskScore += 35
    riskFactors.push(`已 ${daysSinceLastActivity} 天完全沒有任何記錄`)
    suggestedActions.push('立即主動聯繫，了解是否有狀況')
  } else if (daysSinceLastActivity >= 7) {
    riskScore += 25
    riskFactors.push(`${daysSinceLastActivity} 天未活動`)
    suggestedActions.push('發訊息關心，降低回歸門檻')
  } else if (daysSinceLastActivity >= 4) {
    riskScore += 15
    riskFactors.push(`${daysSinceLastActivity} 天未記錄`)
  }

  // 頻率下降趨勢
  if (count1 >= 5 && count3 <= 2) {
    riskScore += 20
    riskFactors.push(`記錄頻率大幅下降（前期 ${count1}/10 天 → 近期 ${count3}/10 天）`)
    suggestedActions.push('可能覺得計畫太複雜或看不到成效，建議簡化目標')
  } else if (count1 >= 5 && count3 <= count1 * 0.5) {
    riskScore += 10
    riskFactors.push(`記錄頻率下滑中（前期 ${count1}/10 天 → 近期 ${count3}/10 天）`)
  }

  // 判斷趨勢
  let engagementTrend: ChurnPrediction['engagementTrend'] = 'stable'
  if (daysSinceLastActivity >= 7) {
    engagementTrend = 'inactive'
  } else if (count3 < count1 * 0.6) {
    engagementTrend = 'declining'
  } else if (count3 > count1 * 1.2) {
    engagementTrend = 'improving'
  }

  // ─── 2. 情緒與動力趨勢（最高 25 分）───
  const energyValues = wellness.map(w => w.energy_level).filter(v => v != null) as number[]
  const moodValues = wellness.map(w => w.mood).filter(v => v != null) as number[]
  const driveValues = wellness.map(w => w.training_drive).filter(v => v != null) as number[]

  if (energyValues.length >= 5) {
    const recent = energyValues.slice(-5)
    if (avg(recent) <= 2) {
      riskScore += 15
      riskFactors.push(`連續精力低落（近 5 天均分 ${avg(recent).toFixed(1)}/5）`)
      suggestedActions.push('可能處於能量不足狀態，考慮提高熱量或安排 Diet Break')
    }
  }

  if (moodValues.length >= 5) {
    const recent = moodValues.slice(-5)
    if (avg(recent) <= 2) {
      riskScore += 10
      riskFactors.push(`情緒持續低落（近 5 天均分 ${avg(recent).toFixed(1)}/5）`)
    }
  }

  if (driveValues.length >= 3) {
    const recent = driveValues.slice(-3)
    if (avg(recent) <= 1.5) {
      riskScore += 10
      riskFactors.push('訓練動力極低')
      suggestedActions.push('建議暫時降低訓練目標，以「只要出現就好」為原則')
    }
  }

  // ─── 3. 合規率下降（最高 20 分）───
  if (input.supplementComplianceRate < 0.3 && input.supplementComplianceRate > 0) {
    riskScore += 10
    riskFactors.push(`補品服從率僅 ${(input.supplementComplianceRate * 100).toFixed(0)}%`)
  }

  if (input.nutritionComplianceRate > 0 && input.nutritionComplianceRate < 40) {
    riskScore += 10
    riskFactors.push(`飲食合規率僅 ${input.nutritionComplianceRate}%`)
    suggestedActions.push('飲食計畫可能太嚴格，考慮增加彈性空間')
  }

  // ─── 4. 體重停滯 + 低動力 → 組合指標（最高 15 分）───
  if (input.weightStagnant) {
    const lowMotivation = driveValues.length >= 2 && avg(driveValues.slice(-3)) <= 2.5
    if (lowMotivation) {
      riskScore += 15
      riskFactors.push('體重停滯 + 訓練動力下降 — 高流失風險組合')
      suggestedActions.push('讓學員知道停滯是正常的，分享其他學員的成功案例。考慮調整目標或計畫方向')
    } else {
      riskScore += 5
      riskFactors.push('體重停滯中（但動力尚可）')
    }
  }

  // ─── 5. 新學員特殊風險（最高 5 分）───
  if (dailyActivity.length < 14 && recent7Count <= 2) {
    riskScore += 5
    riskFactors.push('新學員早期參與度不足')
    suggestedActions.push('新學員前兩週是建立習慣的關鍵期，建議每天簡單互動')
  }

  // 上限 100
  riskScore = Math.min(100, riskScore)

  // 風險等級
  const riskLevel: ChurnPrediction['riskLevel'] =
    riskScore >= 70 ? 'critical' :
    riskScore >= 45 ? 'high' :
    riskScore >= 25 ? 'moderate' : 'low'

  // 如果沒有具體建議，給預設
  if (suggestedActions.length === 0 && riskScore >= 25) {
    suggestedActions.push('持續觀察，每週主動關心學員一次')
  }

  return {
    riskScore,
    riskLevel,
    riskFactors,
    suggestedActions,
    daysSinceLastActivity,
    engagementTrend,
  }
}
