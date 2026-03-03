/**
 * Cross-System Insight Engine
 * 跨系統智慧關聯引擎
 *
 * 交叉分析 wellness、training、nutrition、body composition、lab 數據，
 * 找出人眼不容易發現的關聯性，幫教練提前看到問題。
 *
 * 文獻依據：
 * - Halson 2014 (BJSM): Sleep & athletic recovery
 * - Meeusen et al. 2013: Overtraining syndrome markers
 * - Mountjoy et al. 2018: RED-S (Relative Energy Deficiency in Sport)
 */

export interface InsightInput {
  clientName: string
  gender: string
  goalType: 'cut' | 'bulk'

  // 近 14 天 wellness（按日期排序，最新在後）
  wellness: Array<{
    date: string
    sleep_quality: number | null
    energy_level: number | null
    mood: number | null
    stress_level: number | null
    training_drive: number | null
    cognitive_clarity: number | null
    resting_hr: number | null
    hrv: number | null
  }>

  // 近 14 天訓練
  training: Array<{
    date: string
    training_type: string
    rpe: number | null
  }>

  // 近 14 天飲食
  nutrition: Array<{
    date: string
    compliant: boolean | null
    calories: number | null
    protein_grams: number | null
  }>

  // 近 14 天體組成
  bodyComposition: Array<{
    date: string
    weight: number
    body_fat: number | null
  }>

  // 最近血檢
  labResults: Array<{
    test_name: string
    value: number
    status: 'normal' | 'attention' | 'alert'
    date: string
  }>

  // 目標
  caloriesTarget: number | null
  proteinTarget: number | null
}

export interface Insight {
  severity: 'info' | 'warning' | 'critical'
  category: 'recovery' | 'nutrition' | 'training' | 'metabolic' | 'behavioral'
  title: string
  description: string
  action: string
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function recentSlice<T extends { date: string }>(data: T[], days: number): T[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return data.filter(d => d.date >= cutoffStr)
}

export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = []

  const recent3Wellness = input.wellness.slice(-3)
  const recent7Wellness = input.wellness.slice(-7)
  const earlier7Wellness = input.wellness.slice(-14, -7)

  const recent3Training = recentSlice(input.training, 3)
  const recent7Training = recentSlice(input.training, 7)

  const recent7Nutrition = recentSlice(input.nutrition, 7)
  const recent14Nutrition = input.nutrition

  // ─── 1. 睡眠下降 + 訓練表現下降 → 恢復不足 ───
  const recentSleep = recent3Wellness.map(w => w.sleep_quality).filter(v => v != null) as number[]
  const earlierSleep = earlier7Wellness.map(w => w.sleep_quality).filter(v => v != null) as number[]
  const recentRPE = recent3Training.filter(t => t.rpe != null).map(t => t.rpe!)
  const earlierTraining = input.training.slice(0, -3).filter(t => t.rpe != null).map(t => t.rpe!)

  if (recentSleep.length >= 2 && earlierSleep.length >= 3) {
    const sleepDrop = avg(earlierSleep) - avg(recentSleep)
    if (sleepDrop >= 0.8) {
      const rpeIncrease = recentRPE.length >= 2 && earlierTraining.length >= 2
        ? avg(recentRPE) - avg(earlierTraining)
        : 0

      if (rpeIncrease > 0.5) {
        insights.push({
          severity: 'critical',
          category: 'recovery',
          title: '睡眠品質下降 + 訓練感知疲勞上升',
          description: `近 3 天睡眠均分 ${avg(recentSleep).toFixed(1)} 較前期 ${avg(earlierSleep).toFixed(1)} 下降，同時訓練 RPE 上升 ${rpeIncrease.toFixed(1)}。Halson 2014 指出睡眠不足是恢復不良的首要因素。`,
          action: '建議暫緩調降熱量，優先改善睡眠。考慮降低訓練量或安排 Deload。',
        })
      } else {
        insights.push({
          severity: 'warning',
          category: 'recovery',
          title: '睡眠品質持續下降',
          description: `近 3 天睡眠均分 ${avg(recentSleep).toFixed(1)}，較前期 ${avg(earlierSleep).toFixed(1)} 明顯下滑。`,
          action: '留意是否與壓力、咖啡因攝取或訓練時間有關。睡眠持續不佳會影響減脂效率和肌肉恢復。',
        })
      }
    }
  }

  // ─── 2. 能量 + 情緒 + 訓練動力全面下降 → RED-S 風險 ───
  const recentEnergy = recent3Wellness.map(w => w.energy_level).filter(v => v != null) as number[]
  const recentMood = recent3Wellness.map(w => w.mood).filter(v => v != null) as number[]
  const recentDrive = recent3Wellness.map(w => w.training_drive).filter(v => v != null) as number[]

  if (recentEnergy.length >= 2 && recentMood.length >= 2 && input.goalType === 'cut') {
    const avgEnergy = avg(recentEnergy)
    const avgMood = avg(recentMood)
    const avgDrive = recentDrive.length >= 2 ? avg(recentDrive) : 3

    if (avgEnergy <= 2 && avgMood <= 2 && avgDrive <= 2) {
      insights.push({
        severity: 'critical',
        category: 'metabolic',
        title: '能量/情緒/訓練動力全面低落 — RED-S 風險',
        description: `近 3 天精力 ${avgEnergy.toFixed(1)}、情緒 ${avgMood.toFixed(1)}、訓練動力 ${avgDrive.toFixed(1)}，均低於 2/5。Mountjoy et al. 2018 指出這是相對能量不足 (RED-S) 的典型徵兆。`,
        action: '強烈建議安排 Diet Break（回到維持熱量 7-14 天）或至少減少赤字 50%。',
      })
    } else if (avgEnergy <= 2.5 && avgMood <= 2.5) {
      insights.push({
        severity: 'warning',
        category: 'metabolic',
        title: '精力與情緒偏低',
        description: `近 3 天精力 ${avgEnergy.toFixed(1)}、情緒 ${avgMood.toFixed(1)}，持續低於正常水準。`,
        action: '考慮安排 Refeed Day 或檢查睡眠與壓力管理。',
      })
    }
  }

  // ─── 3. 壓力持續高 + 體重停滯 → cortisol-driven water retention ───
  const recentStress = recent7Wellness.map(w => w.stress_level).filter(v => v != null) as number[]
  const weights = input.bodyComposition.map(b => b.weight)

  if (recentStress.length >= 5 && avg(recentStress) >= 4 && weights.length >= 4) {
    const maxW = Math.max(...weights.slice(-7))
    const minW = Math.min(...weights.slice(-7))
    if (maxW - minW < 0.5) {
      insights.push({
        severity: 'warning',
        category: 'metabolic',
        title: '高壓力 + 體重停滯 — 可能是水分滯留',
        description: `近 7 天壓力平均 ${avg(recentStress).toFixed(1)}/5，同時體重波動 < 0.5kg。高 cortisol 會促進水分滯留，掩蓋實際脂肪減少。`,
        action: '不要急著調降熱量。先嘗試壓力管理（步行、冥想、鎂補充），可能 1-2 天後會出現「突破性下降」(whoosh effect)。',
      })
    }
  }

  // ─── 4. 訓練頻率下降 + 情緒下滑 → 動力流失 ───
  const recentTrainDays = recent7Training.filter(t => t.training_type !== 'rest').length
  const earlierTrainDays = input.training
    .filter(t => {
      const d = new Date()
      d.setDate(d.getDate() - 14)
      const d7 = new Date()
      d7.setDate(d7.getDate() - 7)
      return t.date >= d.toISOString().split('T')[0] && t.date < d7.toISOString().split('T')[0] && t.training_type !== 'rest'
    }).length

  if (earlierTrainDays >= 3 && recentTrainDays <= 1) {
    const moodTrend = recentMood.length >= 2 ? avg(recentMood) : 3
    insights.push({
      severity: moodTrend <= 2.5 ? 'critical' : 'warning',
      category: 'behavioral',
      title: '訓練頻率大幅下降',
      description: `本週訓練 ${recentTrainDays} 天，上週 ${earlierTrainDays} 天。${moodTrend <= 2.5 ? '同時情緒偏低，可能正在失去動力。' : ''}`,
      action: '建議主動關心學員狀況，了解是否有生活壓力或對計畫的疑慮。降低訓練門檻（縮短時間、降低強度）有助於維持習慣。',
    })
  }

  // ─── 5. 血檢異常 + 相關症狀關聯 ───
  const alertLabs = input.labResults.filter(l => l.status === 'alert')
  const attentionLabs = input.labResults.filter(l => l.status === 'attention')

  // 鐵相關
  const ironIssue = [...alertLabs, ...attentionLabs].find(l =>
    l.test_name.includes('鐵蛋白') || l.test_name.includes('血紅素') || l.test_name.toLowerCase().includes('ferritin') || l.test_name.toLowerCase().includes('hemoglobin')
  )
  if (ironIssue && recentEnergy.length >= 2 && avg(recentEnergy) <= 2.5) {
    insights.push({
      severity: 'critical',
      category: 'nutrition',
      title: `${ironIssue.test_name}偏低 + 持續疲勞`,
      description: `血檢 ${ironIssue.test_name} ${ironIssue.value}（${ironIssue.status === 'alert' ? '紅燈' : '黃燈'}），加上近期精力持續偏低 (${avg(recentEnergy).toFixed(1)}/5)，高度懷疑鐵缺乏影響運動表現和日常精力。`,
      action: '確認鐵劑補充是否到位。建議搭配維生素 C 提高吸收率，避免與鈣/茶/咖啡同時服用。',
    })
  }

  // 維生素 D
  const vitD = [...alertLabs, ...attentionLabs].find(l =>
    l.test_name.includes('維生素D') || l.test_name.includes('Vitamin D') || l.test_name.toLowerCase().includes('25-oh')
  )
  if (vitD && recentMood.length >= 2 && avg(recentMood) <= 2.5) {
    insights.push({
      severity: 'warning',
      category: 'nutrition',
      title: '維生素 D 不足 + 情緒偏低',
      description: `維生素 D ${vitD.value}（${vitD.status === 'alert' ? '紅燈' : '黃燈'}），加上近期情緒偏低 (${avg(recentMood).toFixed(1)}/5)。文獻顯示 Vitamin D 不足與情緒低落、免疫力下降有關。`,
      action: '確認 D3 補充劑量是否足夠（建議 4000-5000 IU/天），並增加戶外日曬。',
    })
  }

  // ─── 6. 蛋白質攝取不足 + 體重下降過快 → 肌肉流失風險 ───
  const recentProtein = recent7Nutrition
    .map(n => n.protein_grams)
    .filter(v => v != null) as number[]

  if (recentProtein.length >= 3 && input.proteinTarget && input.goalType === 'cut') {
    const avgProtein = avg(recentProtein)
    const proteinDeficit = input.proteinTarget - avgProtein

    if (proteinDeficit > 20 && weights.length >= 7) {
      const weeklyDrop = weights[0] - weights[weights.length - 1]
      if (weeklyDrop > 0) {
        insights.push({
          severity: proteinDeficit > 40 ? 'critical' : 'warning',
          category: 'nutrition',
          title: '蛋白質攝取不足 — 肌肉流失風險',
          description: `近 7 天平均蛋白質 ${avgProtein.toFixed(0)}g，低於目標 ${input.proteinTarget}g（差 ${proteinDeficit.toFixed(0)}g）。減脂期蛋白質不足會加速肌肉流失。`,
          action: '優先確保蛋白質達標。建議每餐至少 30-40g 蛋白質，可用乳清蛋白補足差額。',
        })
      }
    }
  }

  // ─── 7. HRV 持續低於基線 → 交感過度激活 ───
  const recentHRV = recent3Wellness.map(w => w.hrv).filter(v => v != null) as number[]
  const baselineHRV = earlier7Wellness.map(w => w.hrv).filter(v => v != null) as number[]

  if (recentHRV.length >= 2 && baselineHRV.length >= 3) {
    const avgRecentHRV = avg(recentHRV)
    const avgBaselineHRV = avg(baselineHRV)
    const drop = (avgBaselineHRV - avgRecentHRV) / avgBaselineHRV

    if (drop >= 0.15) {
      insights.push({
        severity: 'warning',
        category: 'recovery',
        title: 'HRV 低於個人基線 15%+',
        description: `近 3 天 HRV 均值 ${avgRecentHRV.toFixed(0)}ms，低於基線 ${avgBaselineHRV.toFixed(0)}ms（下降 ${(drop * 100).toFixed(0)}%）。Meeusen et al. 2013 指出 HRV 持續下降是過度訓練早期訊號。`,
        action: '建議降低本週訓練強度或安排 Deload。觀察 RHR 是否同步上升。',
      })
    }
  }

  // ─── 8. 靜息心率上升 ───
  const recentRHR = recent3Wellness.map(w => w.resting_hr).filter(v => v != null) as number[]
  const baselineRHR = earlier7Wellness.map(w => w.resting_hr).filter(v => v != null) as number[]

  if (recentRHR.length >= 2 && baselineRHR.length >= 3) {
    const avgRecentRHR = avg(recentRHR)
    const avgBaselineRHR = avg(baselineRHR)

    if (avgRecentRHR - avgBaselineRHR >= 5) {
      insights.push({
        severity: 'warning',
        category: 'recovery',
        title: '靜息心率偏移 +5bpm 以上',
        description: `近 3 天 RHR 均值 ${avgRecentRHR.toFixed(0)}bpm，基線 ${avgBaselineRHR.toFixed(0)}bpm（上升 ${(avgRecentRHR - avgBaselineRHR).toFixed(0)}bpm）。持續偏高可能代表恢復不足、壓力過大或潛在生病。`,
        action: '確認是否有感冒前兆、睡眠不足或情緒壓力。建議今日降低訓練強度。',
      })
    }
  }

  // ─── 9. 飲食合規率下降趨勢 ───
  if (recent14Nutrition.length >= 10) {
    const firstHalf = recent14Nutrition.slice(0, Math.floor(recent14Nutrition.length / 2))
    const secondHalf = recent14Nutrition.slice(Math.floor(recent14Nutrition.length / 2))

    const rate1 = firstHalf.filter(n => n.compliant).length / firstHalf.length
    const rate2 = secondHalf.filter(n => n.compliant).length / secondHalf.length

    if (rate1 >= 0.7 && rate2 < 0.5) {
      insights.push({
        severity: 'warning',
        category: 'behavioral',
        title: '飲食合規率明顯下滑',
        description: `前半段合規率 ${(rate1 * 100).toFixed(0)}%，近期降至 ${(rate2 * 100).toFixed(0)}%。可能是計畫太嚴格導致疲勞，或生活變動影響執行。`,
        action: '主動詢問學員是否遇到困難。考慮放寬限制（增加彈性餐或提高熱量）以維持長期依從性。',
      })
    }
  }

  // ─── 10. 體重反彈 + 高合規 → 可能是週期性水分波動或代謝適應 ───
  if (input.goalType === 'cut' && weights.length >= 7) {
    const recentWeights = weights.slice(-7)
    const firstAvg = avg(recentWeights.slice(0, 3))
    const lastAvg = avg(recentWeights.slice(-3))

    if (lastAvg > firstAvg + 0.3) {
      const recentCompliance = recent7Nutrition.filter(n => n.compliant).length / Math.max(1, recent7Nutrition.length)
      if (recentCompliance >= 0.7) {
        // Compliance is high but weight went up — likely water
        const highStress = recentStress.length >= 3 && avg(recentStress) >= 3.5
        insights.push({
          severity: 'info',
          category: 'metabolic',
          title: '減脂期體重微升但合規率高 — 無需恐慌',
          description: `本週體重上升 ${(lastAvg - firstAvg).toFixed(1)}kg，但飲食合規率 ${(recentCompliance * 100).toFixed(0)}%。${highStress ? '加上壓力偏高，' : ''}很可能是水分波動而非脂肪增加。`,
          action: '維持目前計畫不變，持續觀察 1 週。如果下週仍然上升再考慮調整。',
        })
      }
    }
  }

  return insights
}
