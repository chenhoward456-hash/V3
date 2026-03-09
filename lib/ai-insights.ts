/**
 * AI 洞察引擎
 * 整合 Claude AI 提供多種智能分析功能：
 *   1. 每週 AI 週報
 *   2. 飲食模式洞察
 *   3. AI 趨勢預測
 *   4. 訓練量建議
 *   5. AI 菜單建議
 *   6. 血檢趨勢對比
 *   7. 智能警示
 */

import { askClaude, ChatMessage } from './claude'
import { isInOptimalRange } from '@/utils/labStatus'
import { matchLabName } from '@/utils/labMatch'

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export interface NutritionLogEntry {
  date: string
  calories?: number | null
  protein_grams?: number | null
  carbs_grams?: number | null
  fat_grams?: number | null
  water_ml?: number | null
  compliant?: boolean | null
}

export interface WellnessEntry {
  date: string
  mood?: number | null
  energy_level?: number | null
  sleep_quality?: number | null
  hunger?: number | null
  stress?: number | null
  digestion?: number | null
}

export interface TrainingEntry {
  date: string
  training_type?: string | null
  duration?: number | null
  rpe?: number | null
  note?: string | null
}

export interface BodyEntry {
  date: string
  weight?: number | null
  body_fat?: number | null
}

export interface LabEntry {
  date: string
  test_name: string
  value: number | null
  unit: string
  status: 'normal' | 'attention' | 'alert'
}

export interface WearableEntry {
  date: string
  hrv?: number | null
  resting_hr?: number | null
  device_recovery_score?: number | null
  wearable_sleep_score?: number | null
}

export interface ClientProfile {
  name: string
  gender: string | null
  goalType: string | null
  currentWeight: number | null
  currentBodyFat: number | null
  targetWeight: number | null
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
}

export interface InsightData {
  client: ClientProfile
  nutritionLogs: NutritionLogEntry[]
  wellnessLogs: WellnessEntry[]
  trainingLogs: TrainingEntry[]
  bodyLogs: BodyEntry[]
  labResults?: LabEntry[]
  wearableData?: WearableEntry[]
  supplements?: { name: string; dosage?: string; timing?: string }[]
  supplementComplianceRate?: number
}

// ═══════════════════════════════════════
// 1. AI 每週週報
// ═══════════════════════════════════════

export async function generateWeeklyAIReport(data: InsightData): Promise<string> {
  const { client, nutritionLogs, wellnessLogs, trainingLogs, bodyLogs } = data

  // 取最近 7 天資料（先按日期排序確保正確）
  const sortByDate = <T extends { date: string }>(arr: T[]) => [...arr].sort((a, b) => a.date.localeCompare(b.date))
  const last7Nutrition = sortByDate(nutritionLogs).slice(-7)
  const last7Wellness = sortByDate(wellnessLogs).slice(-7)
  const last7Training = sortByDate(trainingLogs).slice(-7)
  const last7Body = sortByDate(bodyLogs).slice(-7)

  // 計算統計
  const avgCalories = calcAvg(last7Nutrition.map(n => n.calories))
  const avgProtein = calcAvg(last7Nutrition.map(n => n.protein_grams))
  const avgCarbs = calcAvg(last7Nutrition.map(n => n.carbs_grams))
  const avgFat = calcAvg(last7Nutrition.map(n => n.fat_grams))
  const compliantDays = last7Nutrition.filter(n => n.compliant).length
  const trainingDays = last7Training.filter(t => t.training_type && t.training_type !== 'rest').length
  const avgSleep = calcAvg(last7Wellness.map(w => w.sleep_quality))
  const avgEnergy = calcAvg(last7Wellness.map(w => w.energy_level))
  const avgMood = calcAvg(last7Wellness.map(w => w.mood))
  const avgStress = calcAvg(last7Wellness.map(w => w.stress))

  // 體重變化
  const weights = last7Body.filter(b => b.weight != null).map(b => b.weight!)
  const weightChange = weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null

  const prompt = `你是 Howard Protocol 的 AI 分析師。請根據以下學員本週數據，生成一份簡潔的週報摘要。

## 學員資料
- 姓名：${client.name}
- 性別：${client.gender || '未設定'}
- 目標：${client.goalType === 'cut' ? '減脂' : client.goalType === 'bulk' ? '增肌' : '維持'}
- 目前體重：${client.currentWeight ?? '未知'} kg
- 目前體脂：${client.currentBodyFat ?? '未知'}%
- 目標體重：${client.targetWeight ?? '未設定'} kg

## 本週數據摘要
- 平均熱量：${avgCalories ? Math.round(avgCalories) : '無資料'} kcal（目標 ${client.caloriesTarget ?? '未設定'} kcal）
- 平均蛋白質：${avgProtein ? Math.round(avgProtein) : '無資料'}g（目標 ${client.proteinTarget ?? '未設定'}g）
- 平均碳水：${avgCarbs ? Math.round(avgCarbs) : '無資料'}g
- 平均脂肪：${avgFat ? Math.round(avgFat) : '無資料'}g
- 飲食合規：${compliantDays}/7 天
- 訓練天數：${trainingDays} 天
- 體重變化：${weightChange != null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg` : '資料不足'}
${avgSleep != null ? `- 平均睡眠：${avgSleep.toFixed(1)}/5` : ''}
${avgEnergy != null ? `- 平均精力：${avgEnergy.toFixed(1)}/5` : ''}
${avgMood != null ? `- 平均心情：${avgMood.toFixed(1)}/5` : ''}
${avgStress != null ? `- 平均壓力：${avgStress.toFixed(1)}/5` : ''}

## 每日飲食明細
${last7Nutrition.map(n => `${n.date}: ${n.calories ?? 0}kcal P${n.protein_grams ?? 0}g C${n.carbs_grams ?? 0}g F${n.fat_grams ?? 0}g ${n.compliant ? '✓' : '✗'}`).join('\n')}

## 每日訓練明細
${last7Training.map(t => `${t.date}: ${t.training_type || '休息'}${t.duration ? ` ${t.duration}分鐘` : ''}${t.rpe ? ` RPE${t.rpe}` : ''}`).join('\n')}

## 輸出格式要求
此摘要會附加在結構化週報（體重、飲食合規、訓練天數、引擎建議）之後，請不要重複這些數據。
請按以下結構輸出（使用繁體中文）：

## 📊 本週總結
（2-3 句話概括本週整體表現，著重在趨勢與執行品質的分析，不要重述體重、合規天數等已列出的數字）

## 📈 亮點
（列出 1-2 個做得好的地方）

## ⚠️ 需注意
（列出 1-2 個需要改善的地方）

## 💡 下週建議
（給出 2-3 個具體可執行的建議）

要求：
- 控制在 250 字以內
- 語氣親切鼓勵，不責備
- 建議要具體可執行
- 不要重複結構化週報已有的數據（體重、合規率、訓練天數、建議熱量/蛋白質）
- 如果數據不足，不要捏造`

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
  return askClaude(messages)
}

// ═══════════════════════════════════════
// 2. 飲食模式洞察
// ═══════════════════════════════════════

export interface DietaryPattern {
  weekendOvereat: { detected: boolean; avgWeekdayCal: number | null; avgWeekendCal: number | null; diff: number | null }
  proteinDeficiency: { detected: boolean; deficientDays: number; totalDays: number }
  carbsImbalance: { detected: boolean; detail: string }
  waterDeficiency: { detected: boolean; avgWater: number | null; target: number | null }
  mealTiming: string | null
}

export function analyzeDietaryPatterns(
  nutritionLogs: NutritionLogEntry[],
  targets: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; water?: number | null }
): DietaryPattern {
  const last14 = nutritionLogs.slice(-14)

  // 週末 vs 平日熱量分析
  const weekdayLogs = last14.filter(n => {
    const day = new Date(n.date + 'T12:00:00').getDay()
    return day >= 1 && day <= 5
  })
  const weekendLogs = last14.filter(n => {
    const day = new Date(n.date + 'T12:00:00').getDay()
    return day === 0 || day === 6
  })

  const avgWeekdayCal = calcAvg(weekdayLogs.map(n => n.calories))
  const avgWeekendCal = calcAvg(weekendLogs.map(n => n.calories))
  const calDiff = avgWeekdayCal != null && avgWeekendCal != null ? avgWeekendCal - avgWeekdayCal : null

  // 蛋白質不足天數
  const proteinDays = last14.filter(n => n.protein_grams != null)
  const proteinDeficientDays = targets.protein
    ? proteinDays.filter(n => (n.protein_grams ?? 0) < targets.protein! * 0.8).length
    : 0

  // 碳水不均衡
  const carbValues = last14.map(n => n.carbs_grams).filter(v => v != null) as number[]
  const carbStd = calcStdDev(carbValues)
  const avgCarbs = calcAvg(last14.map(n => n.carbs_grams))

  let carbDetail = ''
  if (carbStd != null && avgCarbs != null && avgCarbs > 0 && carbStd / avgCarbs > 0.4) {
    carbDetail = `碳水攝取波動大（標準差 ${Math.round(carbStd)}g），建議穩定控制`
  }

  // 水分不足
  const avgWater = calcAvg(last14.map(n => n.water_ml))

  return {
    weekendOvereat: {
      detected: calDiff != null && calDiff > 200,
      avgWeekdayCal: avgWeekdayCal ? Math.round(avgWeekdayCal) : null,
      avgWeekendCal: avgWeekendCal ? Math.round(avgWeekendCal) : null,
      diff: calDiff ? Math.round(calDiff) : null,
    },
    proteinDeficiency: {
      detected: proteinDeficientDays >= 3,
      deficientDays: proteinDeficientDays,
      totalDays: proteinDays.length,
    },
    carbsImbalance: {
      detected: !!carbDetail,
      detail: carbDetail,
    },
    waterDeficiency: {
      detected: avgWater != null && targets.water != null && avgWater < targets.water * 0.7,
      avgWater: avgWater ? Math.round(avgWater) : null,
      target: targets.water ?? null,
    },
    mealTiming: null, // 需要更細的用餐時間數據
  }
}

// ═══════════════════════════════════════
// 3. AI 趨勢預測
// ═══════════════════════════════════════

export interface TrendPrediction {
  currentWeight: number
  targetWeight: number | null
  weeklyRate: number | null  // kg/week
  estimatedWeeksToGoal: number | null
  estimatedDate: string | null
  confidence: 'high' | 'medium' | 'low'
  message: string
}

export function predictTrend(
  bodyLogs: BodyEntry[],
  targetWeight: number | null,
  goalType: string | null
): TrendPrediction {
  const validWeights = bodyLogs
    .filter(b => b.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (validWeights.length < 4) {
    return {
      currentWeight: validWeights.length > 0 ? validWeights[validWeights.length - 1].weight! : 0,
      targetWeight,
      weeklyRate: null,
      estimatedWeeksToGoal: null,
      estimatedDate: null,
      confidence: 'low',
      message: '數據不足（需至少 4 天體重記錄），無法進行趨勢預測',
    }
  }

  // 計算週均體重（用 7 天滑動平均來消除日波動）
  const weeklyAvgs: { weekStart: string; avg: number }[] = []
  for (let i = 0; i <= validWeights.length - 7; i += 7) {
    const chunk = validWeights.slice(i, i + 7)
    const avg = chunk.reduce((s, b) => s + b.weight!, 0) / chunk.length
    weeklyAvgs.push({ weekStart: chunk[0].date, avg })
  }

  // 如果不夠完整週，也用最後的數據
  if (weeklyAvgs.length < 2 && validWeights.length >= 4) {
    const mid = Math.floor(validWeights.length / 2)
    const firstHalf = validWeights.slice(0, mid)
    const secondHalf = validWeights.slice(mid)
    const avg1 = firstHalf.reduce((s, b) => s + b.weight!, 0) / firstHalf.length
    const avg2 = secondHalf.reduce((s, b) => s + b.weight!, 0) / secondHalf.length
    const daysBetween = (new Date(secondHalf[0].date).getTime() - new Date(firstHalf[0].date).getTime()) / 86400000
    const weeksElapsed = Math.max(1, daysBetween / 7)

    weeklyAvgs.length = 0
    weeklyAvgs.push({ weekStart: firstHalf[0].date, avg: avg1 })
    weeklyAvgs.push({ weekStart: secondHalf[0].date, avg: avg2 })
  }

  const currentWeight = validWeights[validWeights.length - 1].weight!

  if (weeklyAvgs.length < 2) {
    return {
      currentWeight,
      targetWeight,
      weeklyRate: null,
      estimatedWeeksToGoal: null,
      estimatedDate: null,
      confidence: 'low',
      message: '數據不足，無法計算趨勢',
    }
  }

  // 計算平均週變化率
  const firstAvg = weeklyAvgs[0].avg
  const lastAvg = weeklyAvgs[weeklyAvgs.length - 1].avg
  const daysBetween = (new Date(weeklyAvgs[weeklyAvgs.length - 1].weekStart).getTime() - new Date(weeklyAvgs[0].weekStart).getTime()) / 86400000
  const weeksElapsed = Math.max(1, daysBetween / 7)
  const weeklyRate = (lastAvg - firstAvg) / weeksElapsed

  let estimatedWeeksToGoal: number | null = null
  let estimatedDate: string | null = null
  let message = ''
  let confidence: 'high' | 'medium' | 'low' = 'medium'

  if (targetWeight != null && weeklyRate !== 0) {
    const remaining = targetWeight - currentWeight

    // 檢查方向是否正確
    if ((goalType === 'cut' && weeklyRate < 0) || (goalType === 'bulk' && weeklyRate > 0)) {
      estimatedWeeksToGoal = Math.abs(remaining / weeklyRate)
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + estimatedWeeksToGoal * 7)
      estimatedDate = targetDate.toISOString().split('T')[0]

      confidence = weeksElapsed >= 3 ? 'high' : 'medium'
      message = `以目前每週 ${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)}kg 的速率，預計 ${Math.ceil(estimatedWeeksToGoal)} 週後（約 ${estimatedDate}）可達到目標 ${targetWeight}kg`
    } else if (weeklyRate === 0) {
      message = '體重目前處於平原期，建議調整飲食或訓練策略'
      confidence = 'medium'
    } else if (goalType === 'cut' || goalType === 'bulk') {
      message = goalType === 'cut'
        ? `體重目前呈上升趨勢（+${weeklyRate.toFixed(2)}kg/週），與減脂目標方向相反，建議檢視飲食合規`
        : `體重目前呈下降趨勢（${weeklyRate.toFixed(2)}kg/週），與增肌目標方向相反，建議增加攝取`
      confidence = 'high'
    } else {
      // goalType 為 null 或其他（如 maintain）
      message = `目前每週變化 ${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)}kg`
      confidence = 'medium'
    }
  } else if (targetWeight == null) {
    message = `目前每週變化 ${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)}kg（尚未設定目標體重）`
    confidence = 'medium'
  }

  return {
    currentWeight,
    targetWeight,
    weeklyRate: Math.round(weeklyRate * 100) / 100,
    estimatedWeeksToGoal: estimatedWeeksToGoal ? Math.ceil(estimatedWeeksToGoal) : null,
    estimatedDate,
    confidence,
    message,
  }
}

// ═══════════════════════════════════════
// 4. 訓練量建議
// ═══════════════════════════════════════

export interface TrainingAdvice {
  recommendedIntensity: 'high' | 'moderate' | 'low' | 'rest'
  recoveryScore: number  // 0-100
  reasons: string[]
  suggestion: string
}

export function getTrainingAdvice(
  wellnessLogs: WellnessEntry[],
  trainingLogs: TrainingEntry[],
  wearableData?: WearableEntry[],
  labData?: Array<{ test_name: string; value: number | null; status: 'normal' | 'attention' | 'alert' }>
): TrainingAdvice {
  const last3Wellness = wellnessLogs.slice(-3)
  const last7Training = trainingLogs.slice(-7)
  const latestWearable = wearableData?.slice(-1)[0]

  let recoveryScore = 70 // 基準
  const reasons: string[] = []

  // 睡眠品質影響
  const avgSleep = calcAvg(last3Wellness.map(w => w.sleep_quality))
  if (avgSleep != null) {
    if (avgSleep < 2.5) {
      recoveryScore -= 25
      reasons.push(`近 3 天睡眠品質偏低（${avgSleep.toFixed(1)}/5）`)
    } else if (avgSleep < 3.5) {
      recoveryScore -= 10
      reasons.push(`睡眠品質一般（${avgSleep.toFixed(1)}/5）`)
    } else if (avgSleep >= 4) {
      recoveryScore += 10
      reasons.push(`睡眠品質良好（${avgSleep.toFixed(1)}/5）`)
    }
  }

  // 精力影響
  const avgEnergy = calcAvg(last3Wellness.map(w => w.energy_level))
  if (avgEnergy != null) {
    if (avgEnergy < 2.5) {
      recoveryScore -= 20
      reasons.push(`精力偏低（${avgEnergy.toFixed(1)}/5）`)
    } else if (avgEnergy >= 4) {
      recoveryScore += 10
      reasons.push(`精力充沛（${avgEnergy.toFixed(1)}/5）`)
    }
  }

  // 壓力影響
  const avgStress = calcAvg(last3Wellness.map(w => w.stress))
  if (avgStress != null && avgStress >= 4) {
    recoveryScore -= 15
    reasons.push(`壓力較大（${avgStress.toFixed(1)}/5）`)
  }

  // 連續訓練天數
  const recentTrainingDays = last7Training.filter(t => t.training_type && t.training_type !== 'rest').length
  if (recentTrainingDays >= 5) {
    recoveryScore -= 15
    reasons.push(`近 7 天已訓練 ${recentTrainingDays} 天，累積疲勞`)
  } else if (recentTrainingDays <= 2) {
    recoveryScore += 10
    reasons.push(`近 7 天僅訓練 ${recentTrainingDays} 天，恢復充足`)
  }

  // 高 RPE 訓練累積
  const highRPE = last7Training.filter(t => t.rpe != null && t.rpe >= 9).length
  if (highRPE >= 3) {
    recoveryScore -= 15
    reasons.push(`近 7 天有 ${highRPE} 次高強度（RPE≥9）訓練`)
  }

  // 穿戴裝置數據
  if (latestWearable) {
    if (latestWearable.device_recovery_score != null) {
      if (latestWearable.device_recovery_score < 33) {
        recoveryScore -= 20
        reasons.push(`裝置恢復分數低（${latestWearable.device_recovery_score}/100）`)
      } else if (latestWearable.device_recovery_score >= 67) {
        recoveryScore += 10
        reasons.push(`裝置恢復分數佳（${latestWearable.device_recovery_score}/100）`)
      }
    }
    if (latestWearable.hrv != null && latestWearable.hrv < 30) {
      recoveryScore -= 10
      reasons.push(`HRV 偏低（${latestWearable.hrv}ms）`)
    }
  }

  // 血檢指標影響
  if (labData && labData.length > 0) {
    for (const lab of labData) {
      if (lab.value == null || lab.status === 'normal') continue

      // 低鐵蛋白 → 有氧能力受限，降低建議強度
      if (matchLabName(lab.test_name, ['鐵蛋白', 'ferritin']) && lab.value < 30) {
        recoveryScore -= 10
        reasons.push(`鐵蛋白偏低（${lab.value}），有氧能力受限，建議減少有氧量`)
      }

      // 低血紅素 → 氧氣運輸下降
      if (matchLabName(lab.test_name, ['血紅素', 'hemoglobin']) && lab.value < 12) {
        recoveryScore -= 15
        reasons.push(`血紅素偏低（${lab.value}），氧氣運輸能力下降`)
      }

      // TSH 偏高 → 代謝率降低
      if (matchLabName(lab.test_name, ['tsh', '促甲狀腺']) && lab.value > 4.0) {
        recoveryScore -= 5
        reasons.push(`TSH 偏高（${lab.value}），代謝率可能降低`)
      }
    }
  }

  // Clamp
  recoveryScore = Math.max(0, Math.min(100, recoveryScore))

  // 決定建議強度
  let recommendedIntensity: TrainingAdvice['recommendedIntensity']
  let suggestion: string

  if (recoveryScore >= 75) {
    recommendedIntensity = 'high'
    suggestion = '恢復狀態良好，可以進行高強度訓練。建議挑戰新的 PR 或增加訓練量。'
  } else if (recoveryScore >= 50) {
    recommendedIntensity = 'moderate'
    suggestion = '恢復狀態一般，建議維持正常訓練強度。避免過度追求 PR，專注在動作品質。'
  } else if (recoveryScore >= 30) {
    recommendedIntensity = 'low'
    suggestion = '恢復狀態偏差，建議降低訓練強度。可以做輕量訓練或主動恢復（散步、伸展）。'
  } else {
    recommendedIntensity = 'rest'
    suggestion = '身體需要休息。建議今天安排完全休息日，專注睡眠和營養補充。'
  }

  return { recommendedIntensity, recoveryScore, reasons, suggestion }
}

// ═══════════════════════════════════════
// 5. AI 菜單建議
// ═══════════════════════════════════════

export async function generateMealSuggestion(
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  preferences: { isTrainingDay: boolean; mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' }
): Promise<string> {
  const { calories, protein, carbs, fat } = remaining
  const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心' }
  const mealLabel = preferences.mealType ? mealNames[preferences.mealType] : '下一餐'

  const prompt = `你是 Howard Protocol 的 AI 營養師。學員今天還需要攝取以下營養素：

剩餘需求：
- 熱量：${calories} kcal
- 蛋白質：${protein}g
- 碳水：${carbs}g
- 脂肪：${fat}g

今天是${preferences.isTrainingDay ? '訓練日' : '休息日'}
請推薦的餐：${mealLabel}

請推薦 2-3 個台灣常見的${mealLabel}選擇，包含：
1. 超商方案（7-11、全家）
2. 外食方案（自助餐、便當店）
3. 簡單自煮方案（選配）

每個方案要列出：
- 具體品項名稱
- 預估營養素（蛋白質 Xg ｜ 碳水 Xg ｜ 脂肪 Xg ｜ 熱量 X kcal）
- 搭配建議

要求：
- 繁體中文
- 控制在 250 字以內
- 品項要具體（不要只說「高蛋白食物」）
- 優先推薦能最接近剩餘需求的組合`

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
  return askClaude(messages)
}

// ═══════════════════════════════════════
// 6. 血檢趨勢對比
// ═══════════════════════════════════════

export interface LabComparison {
  testName: string
  current: { value: number; status: string; date: string } | null
  previous: { value: number; status: string; date: string } | null
  change: number | null
  changePercent: number | null
  improved: boolean | null
  unit: string
}

export function compareLabResults(labResults: LabEntry[]): LabComparison[] {
  // 依 test_name 分組，找出每個指標最近兩次的值
  const byName = new Map<string, LabEntry[]>()
  for (const lab of labResults) {
    if (lab.value == null) continue
    const existing = byName.get(lab.test_name) || []
    existing.push(lab)
    byName.set(lab.test_name, existing)
  }

  const comparisons: LabComparison[] = []

  for (const [testName, entries] of byName) {
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length < 2) {
      comparisons.push({
        testName,
        current: sorted.length > 0 ? { value: sorted[sorted.length - 1].value!, status: sorted[sorted.length - 1].status, date: sorted[sorted.length - 1].date } : null,
        previous: null,
        change: null,
        changePercent: null,
        improved: null,
        unit: sorted[0]?.unit || '',
      })
      continue
    }

    const prev = sorted[sorted.length - 2]
    const curr = sorted[sorted.length - 1]
    const change = curr.value! - prev.value!
    const changePercent = prev.value! !== 0 ? (change / prev.value!) * 100 : null

    const statusRank: Record<string, number> = { normal: 2, attention: 1, alert: 0 }
    const currRank = statusRank[curr.status] ?? 0
    const prevRank = statusRank[prev.status] ?? 0

    comparisons.push({
      testName,
      current: { value: curr.value!, status: curr.status, date: curr.date },
      previous: { value: prev.value!, status: prev.status, date: prev.date },
      change: Math.round(change * 100) / 100,
      changePercent: changePercent ? Math.round(changePercent * 10) / 10 : null,
      improved: currRank > prevRank ? true : currRank < prevRank ? false : null,
      unit: curr.unit,
    })
  }

  return comparisons
}

export async function generateLabComparisonSummary(comparisons: LabComparison[]): Promise<string> {
  if (comparisons.length === 0) return '目前沒有血檢數據可供比較'

  const withChanges = comparisons.filter(c => c.previous != null)
  if (withChanges.length === 0) return '目前只有一次血檢記錄，下次血檢後可進行趨勢比較'

  const improved = withChanges.filter(c => c.improved)
  const worsened = withChanges.filter(c => c.improved === false)

  const dataStr = withChanges.map(c =>
    `${c.testName}: ${c.previous!.value}→${c.current!.value} ${c.unit}（${c.previous!.status}→${c.current!.status}，${c.change! > 0 ? '+' : ''}${c.change}）`
  ).join('\n')

  // 找出正常但可優化的指標
  const allCurrentValues = comparisons.filter(c => c.current != null)
  const normalButSuboptimal = allCurrentValues.filter(c => {
    if (!c.current || c.current.status !== 'normal') return false
    return !isInOptimalRange(c.testName, c.current.value)
  })

  const optimizationStr = normalButSuboptimal.length > 0
    ? `\n\n## 正常但可優化的指標\n${normalButSuboptimal.map(c => `${c.testName}: ${c.current!.value} ${c.unit}（正常範圍內，但尚未達最佳區間）`).join('\n')}`
    : ''

  const prompt = `你是 Howard Protocol 的 AI 健康分析師。請根據以下血檢趨勢變化，給出簡潔的分析和建議。

## 血檢變化
${dataStr}

## 統計
- 改善：${improved.length} 項
- 惡化：${worsened.length} 項
- 總共：${withChanges.length} 項${optimizationStr}

請用以下格式輸出（繁體中文，250 字以內）：

📊 血檢趨勢摘要
（列出重要的改善和需注意項目）
${normalButSuboptimal.length > 0 ? '\n🎯 優化空間\n（列出 1-2 個雖在正常範圍但可進一步優化的指標，給出具體建議）\n' : ''}
💡 建議
（1-2 個具體可執行的飲食或生活建議）

注意：不做醫療診斷。即使指標在正常範圍內，也應指出可以更好的方向。`

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
  return askClaude(messages)
}

// ═══════════════════════════════════════
// 7. 智能警示系統
// ═══════════════════════════════════════

export interface SmartAlert {
  type: 'no_record' | 'weight_anomaly' | 'sleep_decline' | 'energy_low' | 'overtraining' | 'nutrition_drift' | 'streak_break'
  severity: 'warning' | 'info'
  title: string
  message: string
  icon: string
}

export function generateSmartAlerts(data: InsightData): SmartAlert[] {
  const alerts: SmartAlert[] = []
  const { nutritionLogs, wellnessLogs, trainingLogs, bodyLogs } = data

  // 1. 連續未記錄
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const threeDaysStr = threeDaysAgo.toISOString().split('T')[0]

  const recentRecords = nutritionLogs.filter(n => n.date >= threeDaysStr && n.date <= today)
  if (recentRecords.length === 0 && nutritionLogs.length > 0) {
    alerts.push({
      type: 'no_record',
      severity: 'warning',
      title: '連續 3 天未記錄飲食',
      message: '持續記錄是進步的關鍵！即使沒有完美執行，記錄下來也能幫助分析趨勢。',
      icon: '📝',
    })
  }

  // 2. 體重異常波動
  const last7Body = bodyLogs.slice(-7)
  const weights = last7Body.filter(b => b.weight != null).map(b => b.weight!)
  if (weights.length >= 3) {
    const maxDiff = Math.max(...weights) - Math.min(...weights)
    if (maxDiff > 2) {
      alerts.push({
        type: 'weight_anomaly',
        severity: 'warning',
        title: '體重波動較大',
        message: `近 7 天體重波動 ${maxDiff.toFixed(1)}kg。可能原因：水分攝取變化、鈉攝取、經期、腸胃狀態。建議觀察趨勢而非單日數字。`,
        icon: '⚖️',
      })
    }
  }

  // 3. 睡眠品質下降
  const last7Wellness = wellnessLogs.slice(-7)
  const last3Sleep = last7Wellness.slice(-3).map(w => w.sleep_quality).filter(v => v != null) as number[]
  if (last3Sleep.length >= 3 && last3Sleep.every(s => s <= 2)) {
    alerts.push({
      type: 'sleep_decline',
      severity: 'warning',
      title: '連續 3 天睡眠品質差',
      message: '睡眠不足會影響恢復和減脂效率。建議：1) 睡前 1 小時減少藍光 2) 補充鎂 3) 控制咖啡因在下午 2 點前。',
      icon: '😴',
    })
  }

  // 4. 精力持續低迷
  const last3Energy = last7Wellness.slice(-3).map(w => w.energy_level).filter(v => v != null) as number[]
  if (last3Energy.length >= 3 && last3Energy.every(e => e <= 2)) {
    alerts.push({
      type: 'energy_low',
      severity: 'warning',
      title: '連續 3 天精力偏低',
      message: '可能原因：熱量赤字過大、睡眠不足、過度訓練。建議：1) 確認熱量攝取足夠 2) 考慮安排 refeed day 3) 增加碳水攝取。',
      icon: '⚡',
    })
  }

  // 5. 過度訓練風險
  const last7Training = trainingLogs.slice(-7)
  const consecutiveTraining = last7Training.filter(t => t.training_type && t.training_type !== 'rest').length
  if (consecutiveTraining >= 6) {
    alerts.push({
      type: 'overtraining',
      severity: 'warning',
      title: '訓練頻率偏高',
      message: `近 7 天訓練了 ${consecutiveTraining} 天。充足的休息對肌肉生長和恢復至關重要，建議安排 1-2 天完全休息。`,
      icon: '🏋️',
    })
  }

  // 6. 飲食偏離目標
  if (data.client.caloriesTarget) {
    const last7Nutrition = nutritionLogs.slice(-7)
    const avgCal = calcAvg(last7Nutrition.map(n => n.calories))
    if (avgCal != null && Math.abs(avgCal - data.client.caloriesTarget) > data.client.caloriesTarget * 0.15) {
      const direction = avgCal > data.client.caloriesTarget ? '超過' : '低於'
      const diff = Math.abs(Math.round(avgCal - data.client.caloriesTarget))
      alerts.push({
        type: 'nutrition_drift',
        severity: 'info',
        title: `平均熱量${direction}目標`,
        message: `近 7 天平均熱量 ${Math.round(avgCal)} kcal，${direction}目標 ${diff} kcal。${direction === '超過' ? '建議檢視是否有隱藏熱量（醬料、飲料）。' : '注意避免熱量赤字過大影響代謝。'}`,
        icon: '🔥',
      })
    }
  }

  return alerts
}

// ═══════════════════════════════════════
// Utility
// ═══════════════════════════════════════

function calcAvg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter(v => v != null) as number[]
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function calcStdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(v => (v - mean) ** 2)
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
}
