/**
 * Phase Manager
 * 階段自動切換引擎
 *
 * 根據減脂持續時間、身心指標、目標進度，
 * 自動判斷是否該切換訓練/飲食階段。
 *
 * 階段流程：
 *   Cut → (Diet Break) → Cut → (Refeed) → Cut → Reverse Diet → Maintenance / Bulk
 *
 * 文獻依據：
 * - Byrne et al. 2018: Intermittent dieting (MATADOR study)
 * - Trexler et al. 2014: Metabolic adaptation to weight loss
 * - Peos et al. 2019: Intermittent Dieting in bodybuilders
 * - Campbell et al. 2020: Reverse dieting
 */

export interface PhaseInput {
  gender: string
  goalType: 'cut' | 'bulk'
  currentWeight: number
  targetWeight: number | null
  bodyFatPct: number | null
  targetBodyFatPct: number | null
  dietStartDate: string | null
  prepPhase: string | null  // current phase

  // 已減重量
  totalWeightLost: number | null  // from diet start to now

  // 每週減重率（近期）
  weeklyWeightChangeRate: number | null  // % of BW

  // 合規率
  nutritionCompliance: number  // 0-100

  // 身心指標（近 7 天平均）
  avgEnergy: number | null  // 1-5
  avgMood: number | null    // 1-5
  avgSleepQuality: number | null // 1-5
  avgTrainingDrive: number | null // 1-5

  // 恢復指標
  avgHRV: number | null
  baselineHRV: number | null
  avgRHR: number | null
  baselineRHR: number | null

  // 距上次 Diet Break 幾週
  weeksSinceLastBreak: number | null

  // Refeed 相關
  refeedSuggested: boolean
  lastRefeedDate: string | null

  // 比賽日
  competitionDate: string | null
  competitionEnabled: boolean
}

export interface PhaseRecommendation {
  currentPhase: string
  suggestedPhase: string | null  // null = 維持現狀
  confidence: 'high' | 'medium' | 'low'
  reason: string
  details: string
  urgency: 'immediate' | 'this_week' | 'next_week' | 'monitor'
}

export function evaluatePhase(input: PhaseInput): PhaseRecommendation {
  const {
    goalType, currentWeight, targetWeight, bodyFatPct,
    dietStartDate, weeklyWeightChangeRate,
    avgEnergy, avgMood, avgSleepQuality, avgTrainingDrive,
    weeksSinceLastBreak, competitionDate, competitionEnabled,
  } = input

  const currentPhase = input.prepPhase || (goalType === 'cut' ? 'cut' : 'bulk')

  // 計算減脂持續週數
  let dietDurationWeeks: number | null = null
  if (dietStartDate) {
    const start = new Date(dietStartDate)
    const now = new Date()
    dietDurationWeeks = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }

  // 計算距比賽天數
  let daysToCompetition: number | null = null
  if (competitionEnabled && competitionDate) {
    const comp = new Date(competitionDate)
    const now = new Date()
    daysToCompetition = Math.ceil((comp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 身心健康綜合指數（1-5）
  const wellnessScores = [avgEnergy, avgMood, avgSleepQuality, avgTrainingDrive].filter(v => v != null) as number[]
  const wellnessAvg = wellnessScores.length > 0
    ? wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length
    : 3

  // HRV 下降比例
  let hrvDecline = 0
  if (input.avgHRV != null && input.baselineHRV != null && input.baselineHRV > 0) {
    hrvDecline = (input.baselineHRV - input.avgHRV) / input.baselineHRV
  }

  // ========== Cut 階段判斷 ==========
  if (goalType === 'cut') {

    // ─── 1. 已達目標 → 建議 Reverse Diet ───
    if (targetWeight != null && currentWeight <= targetWeight) {
      return {
        currentPhase,
        suggestedPhase: 'reverse_diet',
        confidence: 'high',
        reason: '已達目標體重',
        details: `目前體重 ${currentWeight}kg 已達到目標 ${targetWeight}kg。建議進入 Reverse Diet，每週增加 50-100 kcal 直到回到維持熱量。`,
        urgency: 'this_week',
      }
    }

    if (input.targetBodyFatPct != null && bodyFatPct != null && bodyFatPct <= input.targetBodyFatPct) {
      return {
        currentPhase,
        suggestedPhase: 'reverse_diet',
        confidence: 'high',
        reason: '已達目標體脂率',
        details: `目前體脂 ${bodyFatPct}% 已達目標 ${input.targetBodyFatPct}%。建議 Reverse Diet 回到維持熱量。`,
        urgency: 'this_week',
      }
    }

    // ─── 2. 備賽選手 → Peak Week 判斷 ───
    if (daysToCompetition != null && daysToCompetition <= 10 && daysToCompetition > 0) {
      return {
        currentPhase,
        suggestedPhase: 'peak_week',
        confidence: 'high',
        reason: `距比賽 ${daysToCompetition} 天`,
        details: '進入 Peak Week，啟動碳水操控 + 水分調整。依 Escalante 2021 方案，前 3 天低碳 → 後 2-3 天高碳載入。',
        urgency: 'immediate',
      }
    }

    // ─── 3. 減脂過久 + 身心指標下降 → Diet Break ───
    // MATADOR study: 每 4-6 週減脂搭配 2 週 break 效果更好
    const needsBreak = (
      (dietDurationWeeks != null && dietDurationWeeks >= 12 && wellnessAvg <= 2.5) ||
      (dietDurationWeeks != null && dietDurationWeeks >= 8 && wellnessAvg <= 2.0) ||
      (weeksSinceLastBreak != null && weeksSinceLastBreak >= 10 && wellnessAvg <= 2.5)
    )

    // 備賽中不建議 Diet Break（太接近比賽）
    if (needsBreak && !(daysToCompetition != null && daysToCompetition <= 30)) {
      return {
        currentPhase,
        suggestedPhase: 'diet_break',
        confidence: wellnessAvg <= 2.0 ? 'high' : 'medium',
        reason: `減脂已 ${dietDurationWeeks} 週 + 身心指標低落`,
        details: `身心綜合指數 ${wellnessAvg.toFixed(1)}/5，減脂持續 ${dietDurationWeeks} 週。Byrne 2018 (MATADOR) 建議每 4-6 週安排 1-2 週 Diet Break（回到維持熱量），可減少代謝適應。`,
        urgency: wellnessAvg <= 2.0 ? 'immediate' : 'this_week',
      }
    }

    // ─── 4. HRV 大幅下降 → 建議 Deload + 短暫提高熱量 ───
    if (hrvDecline >= 0.20 && dietDurationWeeks != null && dietDurationWeeks >= 4) {
      return {
        currentPhase,
        suggestedPhase: 'diet_break',
        confidence: 'medium',
        reason: 'HRV 下降 ≥ 20% — 恢復不足訊號',
        details: `HRV 較基線下降 ${(hrvDecline * 100).toFixed(0)}%，加上減脂 ${dietDurationWeeks} 週，自律神經系統可能過度疲勞。建議 5-7 天維持熱量 + 訓練減量。`,
        urgency: 'this_week',
      }
    }

    // ─── 5. 體重完全停滯 ≥ 3 週 + 高合規率 → 代謝適應 ───
    if (weeklyWeightChangeRate != null && Math.abs(weeklyWeightChangeRate) < 0.1 && input.nutritionCompliance >= 70 && dietDurationWeeks != null && dietDurationWeeks >= 6) {
      return {
        currentPhase,
        suggestedPhase: null,  // 不需要換階段，但需要調整
        confidence: 'medium',
        reason: '體重停滯 + 合規率高 — 可能需要調整策略',
        details: `體重變化率 ${weeklyWeightChangeRate?.toFixed(2)}%/週，合規率 ${input.nutritionCompliance}%。可能是代謝適應。建議：(1) 短期 Refeed 2-3 天 或 (2) 增加活動量（步數/輕量有氧）而非降低熱量。`,
        urgency: 'this_week',
      }
    }
  }

  // ========== Bulk 階段判斷 ==========
  if (goalType === 'bulk') {

    // 體脂率過高 → 建議切換到 Cut
    if (bodyFatPct != null && bodyFatPct >= 20 && input.gender === '男性') {
      return {
        currentPhase,
        suggestedPhase: 'cut',
        confidence: 'medium',
        reason: `體脂率 ${bodyFatPct}% 已超過增肌效率區間`,
        details: '男性增肌建議體脂保持在 10-18%。超過 20% 後胰島素敏感度下降，營養分配效率降低。建議切換到 Mini-Cut（4-6 週短期減脂）。',
        urgency: 'next_week',
      }
    }

    if (bodyFatPct != null && bodyFatPct >= 28 && input.gender === '女性') {
      return {
        currentPhase,
        suggestedPhase: 'cut',
        confidence: 'medium',
        reason: `體脂率 ${bodyFatPct}% 已超過建議範圍`,
        details: '女性增肌建議體脂保持在 18-25%。建議切換到 Mini-Cut。',
        urgency: 'next_week',
      }
    }

    // 增重太快 → 脂肪累積
    if (weeklyWeightChangeRate != null && weeklyWeightChangeRate > 0.5) {
      return {
        currentPhase,
        suggestedPhase: null,
        confidence: 'medium',
        reason: '增重速率偏高',
        details: `每週增重 ${weeklyWeightChangeRate.toFixed(2)}% BW，超過建議的 0.25-0.5%。脂肪累積比例可能過高，建議減少每日盈餘 100-150 kcal。`,
        urgency: 'next_week',
      }
    }
  }

  // ========== Diet Break 階段判斷 ==========
  if (currentPhase === 'diet_break') {
    // Diet Break 建議持續 7-14 天
    // 如果身心恢復了就回到 Cut
    if (wellnessAvg >= 3.5 && dietDurationWeeks != null) {
      return {
        currentPhase,
        suggestedPhase: 'cut',
        confidence: 'medium',
        reason: '身心指標已恢復',
        details: `身心綜合指數回升至 ${wellnessAvg.toFixed(1)}/5，可以結束 Diet Break 回到減脂。建議赤字從之前的 50-70% 開始，逐步加深。`,
        urgency: 'next_week',
      }
    }
  }

  // ========== Reverse Diet 階段判斷 ==========
  if (currentPhase === 'reverse_diet') {
    // 如果已經回到維持熱量且穩定 2 週
    // 這裡簡化判斷：如果體重穩定 + 身心恢復，建議進入 Maintenance 或 Bulk
    if (wellnessAvg >= 4 && weeklyWeightChangeRate != null && Math.abs(weeklyWeightChangeRate) < 0.2) {
      return {
        currentPhase,
        suggestedPhase: 'bulk',
        confidence: 'low',
        reason: 'Reverse Diet 完成，體重和身心穩定',
        details: `體重變化 ${weeklyWeightChangeRate?.toFixed(2)}%/週（趨穩），身心指數 ${wellnessAvg.toFixed(1)}/5。可以考慮進入增肌期（+200-300 kcal/天）或維持。`,
        urgency: 'next_week',
      }
    }
  }

  // 預設：維持現狀
  return {
    currentPhase,
    suggestedPhase: null,
    confidence: 'low',
    reason: '目前階段適當',
    details: `現階段指標正常，繼續執行目前計畫。${dietDurationWeeks != null ? `減脂已 ${dietDurationWeeks} 週。` : ''}`,
    urgency: 'monitor',
  }
}
