'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { X, Send, Camera } from 'lucide-react'
import { daysUntilDateTW, DAY_MS } from '@/lib/date-utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** Data URL for image preview in chat bubble */
  image?: string
}

interface NutritionEntry {
  date: string
  protein_grams?: number | null
  carbs_grams?: number | null
  fat_grams?: number | null
  calories?: number | null
  water_ml?: number | null
  compliant?: boolean | null
}

interface WellnessEntry {
  date: string
  mood?: number | null
  energy_level?: number | null
  sleep_quality?: number | null
  hunger?: number | null
  digestion?: number | null
  stress?: number | null
}

interface LabResultEntry {
  test_name: string
  value: number
  unit: string
  status: string
  date: string
  custom_advice?: string | null
}

interface AiChatDrawerProps {
  open: boolean
  onClose: () => void
  // Auth
  clientId: string
  // Client context
  clientName: string
  gender: string | null
  goalType: string | null
  // Today's nutrition
  todayNutrition: NutritionEntry | null
  // Targets
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  waterTarget: number | null
  // Context
  isTrainingDay: boolean
  competitionEnabled: boolean
  prepPhase?: string | null
  competitionDate?: string | null
  latestWeight?: number | null
  latestBodyFat?: number | null
  // Extended context
  nutritionLogs?: NutritionEntry[]
  wellnessLogs?: WellnessEntry[]
  trainingLogs?: { date: string; training_type?: string; note?: string; rpe?: number | null }[]
  supplements?: { name: string; dosage?: string; timing?: string }[]
  supplementComplianceRate?: number
  todayWellness?: WellnessEntry | null
  wearableData?: { hrv?: number | null; resting_hr?: number | null; device_recovery_score?: number | null } | null
  labResults?: LabResultEntry[]
  onFirstMessage?: () => void
  initialPrompt?: string
  // Health mode context
  healthModeEnabled?: boolean
  healthScore?: { total: number; grade: string; daysInCycle: number | null; daysUntilBloodTest: number | null; labPenalty: number; labBonus: number; pillars: { pillar: string; label: string; score: number; emoji: string }[] } | null
  supplementSuggestions?: { name: string; dosage: string; reason: string; priority: string; evidence?: string; triggerTests?: string[]; category?: string }[]
  // Genetic profile
  geneticProfile?: {
    mthfr?: string | null
    apoe?: string | null
    serotonin?: string | null  // 5-HTTLPR: LL/SL/SS
    depressionRisk?: string | null  // 向後相容 (low/moderate/high)
    notes?: string | null
  } | null
  // Weight & body composition trend
  weightTrend?: { date: string; weight: number }[]
  bodyFatTrend?: { date: string; bodyFat: number }[]
  // Nutrition engine analysis
  nutritionEngineStatus?: {
    status: string
    message: string
    estimatedTDEE: number | null
    weeklyWeightChangeRate: number | null
    dietBreakSuggested: boolean
    warnings: string[]
    // Extended engine data
    currentState?: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown'
    readinessScore?: number | null
    statusLabel?: string
    refeedSuggested?: boolean
    refeedReason?: string | null
    refeedDays?: number | null
    energyAvailability?: { level: string; warning: string | null } | null
    suggestedCalories?: number | null
    suggestedProtein?: number | null
    suggestedCarbs?: number | null
    suggestedFat?: number | null
    suggestedCarbsTrainingDay?: number | null
    suggestedCarbsRestDay?: number | null
    deadlineInfo?: {
      daysLeft: number
      weeksLeft?: number
      weightToLose: number
      requiredRatePerWeek: number
      safetyLevel?: string
      predictedCompWeight?: number
      suggestedCardioMinutes?: number
      cardioNote?: string
      isAggressive?: boolean
    } | null
    peakWeekPlan?: {
      daysOut: number
      date: string
      label: string
      phase: string
      carbsGPerKg: number
      proteinGPerKg: number
      fatGPerKg: number
      waterMlPerKg: number
      sodiumMg: number
      trainingNote: string
      carbs: number
      protein: number
      fat: number
      calories: number
      water: number
    }[] | null
    athleticRebound?: {
      gapHours: number
      strategy: string
      waterPerHour: number
    } | null
    geneticCorrections?: { gene: string; rule: string; adjustment: string }[]
    wearableInsight?: string | null
    metabolicStress?: { score: number; level: string } | null
  } | null
  // Recovery assessment (from nutrition engine)
  recoveryAssessment?: {
    score: number
    state: string
    systems: {
      neural: { score: number; state: string; signals: string[] }
      muscular: { score: number; state: string; signals: string[] }
      metabolic: { score: number; state: string; signals: string[] }
      hormonal: { score: number; state: string; signals: string[] }
      psychological: { score: number; state: string; signals: string[] }
    }
    overtrainingRisk: { riskLevel: string; acwr: number | null; reasons: string[] }
    autonomicBalance: { status: string; hrvTrend: string; rhrTrend: string }
    trajectory: string
    recommendations: { priority: string; category: string; message: string }[]
  } | null
  // Coach notes
  coachSummary?: string | null
  coachWeeklyNote?: string | null
  // Behavioral
  streakDays?: number
  streakMessage?: string
  // Goals
  targetWeight?: number | null
  targetBodyFat?: number | null
  dietStartDate?: string | null
}

export default function AiChatDrawer({
  open, onClose,
  clientId,
  clientName, gender, goalType,
  todayNutrition,
  caloriesTarget, proteinTarget, carbsTarget, fatTarget, waterTarget,
  isTrainingDay, competitionEnabled, prepPhase, competitionDate,
  latestWeight, latestBodyFat,
  nutritionLogs, wellnessLogs, trainingLogs,
  supplements, supplementComplianceRate,
  todayWellness, wearableData,
  labResults,
  onFirstMessage,
  initialPrompt,
  healthModeEnabled,
  healthScore,
  supplementSuggestions,
  geneticProfile,
  weightTrend,
  bodyFatTrend,
  nutritionEngineStatus,
  recoveryAssessment,
  coachSummary,
  coachWeeklyNote,
  streakDays,
  streakMessage,
  targetWeight,
  targetBodyFat,
  dietStartDate,
}: AiChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null) // base64 JPEG
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null) // object URL for preview
  const [trainingReadiness, setTrainingReadiness] = useState<{
    recoveryScore?: number
    recommendedIntensity?: string
    suggestion?: string
    reasons?: string[]
    modeRecommendation?: {
      modeLabel?: string
      confidence?: string
      targetRpeRange?: number[]
      suggestedSets?: string
      suggestions?: string[]
      sameSplitWarning?: string | null
      focusAreas?: string[]
    }
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 開啟時抓取訓練準備度數據
  useEffect(() => {
    if (open && clientId && !trainingReadiness) {
      fetch(`/api/training-readiness?clientId=${clientId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setTrainingReadiness(data) })
        .catch(() => {})
    }
  }, [open, clientId, trainingReadiness])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  // 預填 initialPrompt（從血檢「問 AI」等入口帶入）
  useEffect(() => {
    if (open && initialPrompt && messages.length === 0) {
      setInput(initialPrompt)
    }
  }, [open, initialPrompt, messages.length])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
    }
  }, [input])

  const systemPrompt = useMemo(() => {
    const eaten = todayNutrition
    const pEaten = eaten?.protein_grams ?? 0
    const cEaten = eaten?.carbs_grams ?? 0
    const fEaten = eaten?.fat_grams ?? 0
    const calEaten = eaten?.calories ?? 0
    const wEaten = eaten?.water_ml ?? 0

    const pLeft = proteinTarget ? Math.max(0, proteinTarget - pEaten) : null
    const cLeft = carbsTarget ? Math.max(0, carbsTarget - cEaten) : null
    const fLeft = fatTarget ? Math.max(0, fatTarget - fEaten) : null
    const calLeft = caloriesTarget ? Math.max(0, caloriesTarget - calEaten) : null
    const wLeft = waterTarget ? Math.max(0, waterTarget - wEaten) : null

    // Build 7-day nutrition summary
    const last7Nutrition = (nutritionLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(n => `${n.date}: ${n.calories ?? 0}kcal P${n.protein_grams ?? 0}g C${n.carbs_grams ?? 0}g F${n.fat_grams ?? 0}g ${n.compliant ? '✓合規' : n.compliant === false ? '✗未合規' : ''}`)
      .join('\n')

    // Build 7-day wellness summary
    const last7Wellness = (wellnessLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(w => {
        const parts = [w.date]
        if (w.mood != null) parts.push(`心情${w.mood}/5`)
        if (w.energy_level != null) parts.push(`精力${w.energy_level}/5`)
        if (w.sleep_quality != null) parts.push(`睡眠${w.sleep_quality}/5`)
        if (w.hunger != null) parts.push(`飢餓${w.hunger}/5`)
        if (w.stress != null) parts.push(`壓力${w.stress}/5`)
        return parts.join(' ')
      })
      .join('\n')

    // Build 7-day training summary (include RPE if available)
    const last7Training = (trainingLogs || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(t => `${t.date}: ${t.training_type || '訓練'}${t.rpe ? ` RPE${t.rpe}` : ''}${t.note ? ` (${t.note.slice(0, 30)})` : ''}`)
      .join('\n')

    // Training recovery assessment
    const recentTraining = (trainingLogs || []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const highRPECount = recentTraining.filter(t => t.rpe != null && t.rpe >= 9).length
    const recentWellness = (wellnessLogs || []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    const avgSleep = recentWellness.length > 0
      ? recentWellness.reduce((sum, w) => sum + (w.sleep_quality ?? 3), 0) / recentWellness.length
      : null
    const avgEnergy = recentWellness.length > 0
      ? recentWellness.reduce((sum, w) => sum + (w.energy_level ?? 3), 0) / recentWellness.length
      : null

    let recoverySignals: string[] = []
    if (highRPECount >= 3) recoverySignals.push(`近 7 天有 ${highRPECount} 次 RPE≥9 高強度訓練，累積疲勞風險高`)
    if (avgSleep != null && avgSleep < 3) recoverySignals.push(`近 3 天平均睡眠品質 ${avgSleep.toFixed(1)}/5，睡眠不足`)
    if (avgEnergy != null && avgEnergy < 3) recoverySignals.push(`近 3 天平均精力 ${avgEnergy.toFixed(1)}/5，能量偏低`)
    if (wearableData?.hrv != null && wearableData.hrv < 30) recoverySignals.push(`HRV ${wearableData.hrv}ms 偏低，自律神經恢復不佳`)
    if (wearableData?.device_recovery_score != null && wearableData.device_recovery_score < 33) recoverySignals.push(`裝置恢復分數 ${wearableData.device_recovery_score}/100，身體恢復狀態差`)

    // Blood test summary (only for lab-enabled users who have results)
    const labSummary = (labResults || [])
      .filter(r => r.status === 'attention' || r.status === 'alert')
      .map(r => `${r.test_name}: ${r.value} ${r.unit}（${r.status === 'alert' ? '異常' : '注意'}）${r.custom_advice ? ` — ${r.custom_advice}` : ''}`)
      .join('\n')

    const labNormalHighlights = (labResults || [])
      .filter(r => r.status === 'normal')
      .map(r => r.test_name)
      .join('、')

    // Supplement list
    const suppList = (supplements || [])
      .map(s => `${s.name}${s.dosage ? ` ${s.dosage}` : ''}${s.timing ? ` (${s.timing})` : ''}`)
      .join('、')

    // Today's wellness
    const wellnessStr = todayWellness
      ? [
          todayWellness.mood != null ? `心情${todayWellness.mood}/5` : '',
          todayWellness.energy_level != null ? `精力${todayWellness.energy_level}/5` : '',
          todayWellness.sleep_quality != null ? `睡眠${todayWellness.sleep_quality}/5` : '',
          todayWellness.hunger != null ? `飢餓感${todayWellness.hunger}/5` : '',
          todayWellness.stress != null ? `壓力${todayWellness.stress}/5` : '',
        ].filter(Boolean).join('、')
      : ''

    // Wearable data
    const wearableStr = wearableData
      ? [
          wearableData.hrv != null ? `HRV ${wearableData.hrv}` : '',
          wearableData.resting_hr != null ? `靜息心率 ${wearableData.resting_hr}` : '',
          wearableData.device_recovery_score != null ? `恢復分數 ${wearableData.device_recovery_score}/100` : '',
        ].filter(Boolean).join('、')
      : ''

    return `你是 Howard Protocol 的 AI 健康顧問助手。你正在協助一位學員規劃飲食和健康管理。

## 學員資料
- 姓名：${clientName}
- 性別：${gender || '未設定'}
- 目標：${goalType === 'cut' ? '減脂' : goalType === 'bulk' ? '增肌' : '未設定'}
- 今天是${isTrainingDay ? '訓練日' : '休息日'}
${competitionEnabled ? `- 備賽模式（${(() => {
      const phaseLabels: Record<string, string> = { off_season: '休賽期', bulk: '增肌期', cut: '減脂期', peak_week: 'Peak Week', competition: '比賽日', recovery: '賽後恢復' }
      return phaseLabels[prepPhase || ''] || '未設定階段'
    })()}）${competitionDate ? `\n- 比賽日期：${competitionDate}（距今 ${daysUntilDateTW(competitionDate)} 天）` : ''}` : ''}
${(() => {
      if (weightTrend && weightTrend.length >= 2) {
        const first = weightTrend[0], last = weightTrend[weightTrend.length - 1]
        const diff = (last.weight - first.weight).toFixed(1)
        const dir = Number(diff) > 0 ? '上升' : Number(diff) < 0 ? '下降' : '持平'
        return `- 體重趨勢（${weightTrend.length}天）：${first.date} ${first.weight}kg → ${last.date} ${last.weight}kg（${dir} ${Math.abs(Number(diff))}kg）`
      }
      return latestWeight ? `- 最新體重：${latestWeight} kg` : ''
    })()}
${(() => {
      if (bodyFatTrend && bodyFatTrend.length >= 2) {
        const first = bodyFatTrend[0], last = bodyFatTrend[bodyFatTrend.length - 1]
        const diff = (last.bodyFat - first.bodyFat).toFixed(1)
        const dir = Number(diff) > 0 ? '上升' : Number(diff) < 0 ? '下降' : '持平'
        return `- 體脂趨勢（${bodyFatTrend.length}天）：${first.date} ${first.bodyFat}% → ${last.date} ${last.bodyFat}%（${dir} ${Math.abs(Number(diff))}%）`
      }
      return latestBodyFat ? `- 最新體脂：${latestBodyFat}%` : ''
    })()}
${targetWeight ? `- 目標體重：${targetWeight} kg${latestWeight ? `（還差 ${Math.abs(latestWeight - targetWeight).toFixed(1)} kg）` : ''}` : ''}
${targetBodyFat ? `- 目標體脂：${targetBodyFat}%` : ''}
${dietStartDate ? `- 飲食計畫開始：${dietStartDate}（已執行 ${Math.max(0, Math.round((Date.now() - new Date(dietStartDate).getTime()) / DAY_MS))} 天）` : ''}
${streakDays ? `- 連續記錄：${streakDays} 天${streakMessage ? `（${streakMessage}）` : ''}` : ''}

## 今日營養目標
${caloriesTarget ? `- 熱量目標：${caloriesTarget} kcal` : ''}
${proteinTarget ? `- 蛋白質目標：${proteinTarget}g` : ''}
${carbsTarget ? `- 碳水目標：${carbsTarget}g` : ''}
${fatTarget ? `- 脂肪目標：${fatTarget}g` : ''}
${waterTarget ? `- 水分目標：${waterTarget} ml` : ''}

## 今日已攝取
- 熱量：${calEaten} kcal
- 蛋白質：${pEaten}g
- 碳水：${cEaten}g
- 脂肪：${fEaten}g
- 水分：${wEaten} ml

## 今日剩餘需求
${calLeft != null ? `- 熱量：還需 ${calLeft} kcal` : ''}
${pLeft != null ? `- 蛋白質：還需 ${pLeft}g` : ''}
${cLeft != null ? `- 碳水：還需 ${cLeft}g` : ''}
${fLeft != null ? `- 脂肪：還需 ${fLeft}g` : ''}
${wLeft != null ? `- 水分：還需 ${wLeft} ml` : ''}
${wellnessStr ? `\n## 今日身心狀態\n${wellnessStr}` : ''}
${wearableStr ? `\n## 穿戴裝置數據\n${wearableStr}` : ''}
${last7Nutrition ? `\n## 過去 7 天營養紀錄\n${last7Nutrition}` : ''}
${last7Wellness ? `\n## 過去 7 天身心狀態\n${last7Wellness}` : ''}
${last7Training ? `\n## 過去 7 天訓練紀錄\n${last7Training}` : ''}
${suppList ? `\n## 目前補劑清單\n${suppList}${supplementComplianceRate != null ? `\n- 近 7 天服從率：${supplementComplianceRate}%` : ''}` : ''}
${recoverySignals.length > 0 ? `\n## 訓練恢復評估\n${recoverySignals.join('\n')}\n- 請根據以上恢復狀態調整飲食建議（例如：恢復差時增加抗發炎食物、含鎂食物助眠、適當增加碳水幫助恢復）` : ''}
${trainingReadiness ? `\n## 訓練引擎分析結果
- 恢復分數：${trainingReadiness.recoveryScore ?? '未知'}/100
- 整體狀態：${trainingReadiness.recommendedIntensity === 'high' ? '狀態良好' : trainingReadiness.recommendedIntensity === 'moderate' ? '狀態一般' : trainingReadiness.recommendedIntensity === 'low' ? '恢復偏差' : '建議休息'}
- 系統建議：${trainingReadiness.suggestion || '無'}
${trainingReadiness.reasons && trainingReadiness.reasons.length > 0 ? `- 分析依據：${trainingReadiness.reasons.join('、')}` : ''}
${trainingReadiness.modeRecommendation ? `- 建議訓練模式：${trainingReadiness.modeRecommendation.modeLabel || '未知'}（信心${trainingReadiness.modeRecommendation.confidence === 'high' ? '高' : trainingReadiness.modeRecommendation.confidence === 'medium' ? '中' : '低'}）
- 目標 RPE：${trainingReadiness.modeRecommendation.targetRpeRange?.join('-') || '未知'}
- 建議組數：${trainingReadiness.modeRecommendation.suggestedSets || '未知'}
${trainingReadiness.modeRecommendation.suggestions?.map(s => `- ${s}`).join('\n') || ''}
${trainingReadiness.modeRecommendation.sameSplitWarning ? `- ⚠️ ${trainingReadiness.modeRecommendation.sameSplitWarning}` : ''}
${trainingReadiness.modeRecommendation.focusAreas?.length ? `- 重點：${trainingReadiness.modeRecommendation.focusAreas.join('、')}` : ''}` : ''}
**重要**：你擁有完整的訓練引擎分析數據。當學員詢問身體狀況、今天該怎麼練、恢復狀態時，直接引用這些數據給出具體建議。像一位掌握所有數據的私人教練/顧問一樣回答。` : ''}
${labSummary ? `\n## 最新血檢異常項目\n${labSummary}\n- 請根據血檢結果在飲食建議中自然帶入相關營養素（例如：鐵蛋白低→推薦含鐵食物；維生素D不足→建議補充；不需每次都提，在相關時自然帶入）` : ''}
${labNormalHighlights && !labSummary ? `\n## 血檢狀態\n所有項目正常：${labNormalHighlights}` : ''}
${healthModeEnabled && healthScore ? `
## 健康模式 — 季度健康分數
- 總分：${healthScore.total}/100（${healthScore.grade} 級）${healthScore.labBonus > 0 ? `（含優秀獎勵 +${healthScore.labBonus}）` : ''}${healthScore.labPenalty < 0 ? `（含血檢扣分 ${healthScore.labPenalty}）` : ''}
${healthScore.pillars.map(p => `- ${p.emoji} ${p.label}：${p.score}/100`).join('\n')}
${healthScore.daysInCycle != null ? `- 本季進度：第 ${healthScore.daysInCycle} 天 / 90 天` : ''}
${healthScore.daysUntilBloodTest != null && healthScore.daysUntilBloodTest <= 30 ? `- 🩸 距離季度血檢還有 ${healthScore.daysUntilBloodTest} 天` : ''}
` : ''}${supplementSuggestions && supplementSuggestions.length > 0 ? `
## ${healthModeEnabled ? '健康模式' : '備賽模式'} — 系統建議補品
${supplementSuggestions.map(s => `- ${s.name}（${s.dosage}，${s.priority === 'high' ? '高優先' : s.priority === 'medium' ? '中優先' : '低優先'}）：${s.reason}${s.evidence ? `（文獻：${s.evidence.slice(0, 50)}）` : ''}${s.triggerTests && s.triggerTests.length > 0 ? `（觸發：${s.triggerTests.join('、')}）` : ''}`).join('\n')}
` : ''}${geneticProfile && (geneticProfile.mthfr || geneticProfile.apoe || geneticProfile.serotonin || geneticProfile.depressionRisk) ? `
## 🧬 基因風險背景
${geneticProfile.mthfr && geneticProfile.mthfr !== 'normal' ? `- **MTHFR 突變**：${geneticProfile.mthfr === 'homozygous' ? '純合突變（C677T）— 葉酸代謝嚴重受損' : '雜合突變 — 葉酸代謝部分受損'}。需使用活性葉酸（5-MTHF）而非一般葉酸。飲食建議多攝取天然葉酸食物（深色蔬菜、肝臟）。注意同半胱胺酸控制。` : ''}
${geneticProfile.apoe === 'e3/e4' || geneticProfile.apoe === 'e4/e4' ? `- **APOE4 帶因者**（${geneticProfile.apoe}）：心血管與認知退化風險較高。飲食需嚴格控制飽和脂肪（<7% 總熱量），強調 Omega-3 DHA 攝取，避免反式脂肪。建議地中海飲食模式。定期追蹤血脂（特別是 ApoB、LDL-C）。` : ''}
${geneticProfile.serotonin === 'SS' || geneticProfile.serotonin === 'SL' || geneticProfile.depressionRisk === 'moderate' || geneticProfile.depressionRisk === 'high' ? `- **5-HTTLPR 血清素轉運體基因**（${geneticProfile.serotonin || (geneticProfile.depressionRisk === 'high' ? 'SS' : 'SL')} 型，${geneticProfile.serotonin === 'SS' || geneticProfile.depressionRisk === 'high' ? '高' : '中等'}風險）：血清素回收效率${geneticProfile.serotonin === 'SS' || geneticProfile.depressionRisk === 'high' ? '最差' : '中等受損'}，壓力敏感度高。飲食建議強調：富含色胺酸食物（火雞、香蕉、堅果）、Omega-3 EPA 抗發炎、維生素 D 支持血清素合成、鎂穩定情緒。碳水不宜過度限制（維持腦部血清素合成需求）。運動處方對此基因型特別有效。` : ''}
${geneticProfile.notes ? `- 備註：${geneticProfile.notes}` : ''}
**重要**：基因背景會影響你的所有建議方向。在推薦食物、補品、生活方式時，都需要考慮這些基因風險因素。但不要每次回覆都提到基因，只在建議與基因相關時自然帶入。
` : ''}${competitionEnabled && geneticProfile && (geneticProfile.mthfr || geneticProfile.apoe || geneticProfile.serotonin || geneticProfile.depressionRisk) ? `
## 🏆🧬 備賽×基因交叉注意事項
${prepPhase === 'cut' && (geneticProfile.mthfr === 'heterozygous' || geneticProfile.mthfr === 'homozygous') ? `- **MTHFR + 減脂期**：熱量赤字加重甲基化壓力。確保活性葉酸充足，多攝取深色蔬菜（菠菜、青花菜）。同半胱胺酸可能升高，注意心血管保護。` : ''}
${prepPhase === 'cut' && (geneticProfile.serotonin === 'SS' || geneticProfile.serotonin === 'SL' || geneticProfile.depressionRisk === 'moderate' || geneticProfile.depressionRisk === 'high') ? `- **5-HTTLPR ${geneticProfile.serotonin || 'SL/SS'} + 減脂期**：長期熱量赤字導致皮質醇升高、血清素下降。此基因型選手備賽心理風險高於常人。飲食上確保色胺酸來源（火雞、蛋、乳清蛋白），不要過度限制碳水（維持最低腦部血清素合成需求），重視睡眠與壓力管理。出現持續情緒低落時建議與教練溝通調整計畫。` : ''}
${prepPhase === 'peak_week' && (geneticProfile.apoe === 'e3/e4' || geneticProfile.apoe === 'e4/e4') ? `- **APOE4 + Peak Week**：脂肪補充日避免大量飽和脂肪（牛油、奶油），改用 MCT 油、橄欖油、酪梨等。水鈉操控期間注意電解質平衡，此基因型心血管風險較高，極端脫水需格外謹慎。` : ''}
${prepPhase === 'peak_week' && (geneticProfile.serotonin === 'SS' || geneticProfile.serotonin === 'SL' || geneticProfile.depressionRisk === 'moderate' || geneticProfile.depressionRisk === 'high') ? `- **5-HTTLPR ${geneticProfile.serotonin || 'SL/SS'} + Peak Week**：Peak Week 極端飲食操控（碳水耗竭→超補）對神經傳導物質波動大。此基因型選手可能出現劇烈情緒擺盪，屬正常反應。碳水超補日情緒會明顯改善。營養計算機已自動縮短耗竭期並提高耗竭期碳水量。` : ''}
` : ''}
${nutritionEngineStatus ? `## 營養引擎分析
- 狀態：${nutritionEngineStatus.statusLabel || (({ on_track: '進度正常', too_fast: '減脂過快', plateau: '停滯期', wrong_direction: '方向偏離', insufficient_data: '數據不足', low_compliance: '合規率低', peak_week: 'Peak Week', goal_driven: '目標導向' } as Record<string, string>)[nutritionEngineStatus.status] || nutritionEngineStatus.status)}${nutritionEngineStatus.currentState ? `（${nutritionEngineStatus.currentState}）` : ''}
${nutritionEngineStatus.suggestedCalories ? `- 引擎建議熱量：${nutritionEngineStatus.suggestedCalories} kcal${caloriesTarget ? `（目前目標 ${caloriesTarget}）` : ''}` : ''}
${nutritionEngineStatus.suggestedProtein || nutritionEngineStatus.suggestedCarbs || nutritionEngineStatus.suggestedFat ? `- 引擎建議蛋白/碳水/脂肪：${nutritionEngineStatus.suggestedProtein ?? '-'}g / ${nutritionEngineStatus.suggestedCarbs ?? '-'}g / ${nutritionEngineStatus.suggestedFat ?? '-'}g` : ''}
${nutritionEngineStatus.suggestedCarbsTrainingDay != null || nutritionEngineStatus.suggestedCarbsRestDay != null ? `- 碳水循環：訓練日 ${nutritionEngineStatus.suggestedCarbsTrainingDay ?? '-'}g / 休息日 ${nutritionEngineStatus.suggestedCarbsRestDay ?? '-'}g` : ''}
${nutritionEngineStatus.estimatedTDEE ? `- 估算 TDEE：${nutritionEngineStatus.estimatedTDEE} kcal` : ''}
${nutritionEngineStatus.weeklyWeightChangeRate != null ? `- 週均體重變化：${nutritionEngineStatus.weeklyWeightChangeRate > 0 ? '+' : ''}${nutritionEngineStatus.weeklyWeightChangeRate.toFixed(2)}% BW` : ''}
${nutritionEngineStatus.refeedSuggested ? `- Refeed 建議：${nutritionEngineStatus.refeedReason || '需要 Refeed'}（${nutritionEngineStatus.refeedDays ?? 1} 天）` : '- Refeed：不需要'}
${nutritionEngineStatus.energyAvailability ? `- 能量可用性：${nutritionEngineStatus.energyAvailability.level}${nutritionEngineStatus.energyAvailability.warning ? `（${nutritionEngineStatus.energyAvailability.warning}）` : ''}` : ''}
${nutritionEngineStatus.metabolicStress ? `- 代謝壓力：${nutritionEngineStatus.metabolicStress.score}/100（${nutritionEngineStatus.metabolicStress.level}）` : ''}
${nutritionEngineStatus.readinessScore != null ? `- 恢復準備度：${nutritionEngineStatus.readinessScore}/100` : ''}
${nutritionEngineStatus.wearableInsight ? `- ${nutritionEngineStatus.wearableInsight}` : ''}
${nutritionEngineStatus.geneticCorrections && nutritionEngineStatus.geneticCorrections.length > 0 ? `- 基因修正：${nutritionEngineStatus.geneticCorrections.map(gc => gc.adjustment).join('；')}` : ''}
${nutritionEngineStatus.dietBreakSuggested ? '- ⚠️ 系統建議 Diet Break（代謝壓力累積）' : ''}
${nutritionEngineStatus.warnings.length > 0 ? `- 注意：${nutritionEngineStatus.warnings.slice(0, 3).map(w => w.replace(/[^\u4e00-\u9fff\w\s,.!?，。！？、：:()（）%+\-→←↑↓/]/g, '')).join('；')}` : ''}
**重要**：你的回答要跟營養引擎的分析一致。如果引擎說停滯期，不要說進度正常；如果引擎說減脂過快，要建議增加攝取。
` : ''}${(() => {
  const dl = nutritionEngineStatus?.deadlineInfo
  if (!dl || dl.daysLeft > 90) return ''
  return `## 目標進度分析
- 剩餘 ${dl.daysLeft} 天 / ${dl.weeksLeft ?? Math.round(dl.daysLeft / 7 * 10) / 10} 週
- 還需${dl.weightToLose > 0 ? '減' : '增'} ${Math.abs(dl.weightToLose).toFixed(1)} kg
- 每週需${dl.weightToLose > 0 ? '減' : '增'} ${Math.abs(dl.requiredRatePerWeek).toFixed(2)} kg/週
${dl.safetyLevel ? `- 安全等級：${dl.safetyLevel}` : dl.isAggressive ? '- 安全等級：超過安全範圍' : '- 安全等級：正常'}
${dl.predictedCompWeight ? `- 預估比賽體重：${dl.predictedCompWeight} kg` : ''}
${dl.suggestedCardioMinutes ? `- 建議有氧：${dl.suggestedCardioMinutes} 分/天` : ''}
${dl.cardioNote ? `- ${dl.cardioNote}` : ''}
`
})()}${(() => {
  const plan = nutritionEngineStatus?.peakWeekPlan
  if (!plan || plan.length === 0) return ''
  return `## Peak Week 每日計畫（系統已算好的精確數字）
${plan.map(d => `${d.date}（${d.label}）：碳水 ${d.carbs}g（${d.carbsGPerKg}g/kg）, 蛋白 ${d.protein}g, 脂肪 ${d.fat}g, 熱量 ${d.calories}kcal, 鈉 ${d.sodiumMg}mg, 水 ${d.water}mL, 訓練：${d.trainingNote}`).join('\n')}
**嚴格規定**：回答任何 Peak Week 相關問題（包括「明天吃什麼」「碳水要多少」等）時，必須直接引用上面的精確數字。絕對不要自己估算或猜測，計畫裡的數字就是正確答案。
**碳水溢出防護機制**：系統會比較 Day 2 晨重與基線體重（Day 7 或 Peak Week 最早紀錄）。如果增幅超過閾值（男性 2.0kg / 女性 1.3kg），代表 Day 3 碳水超補導致過多水分滯留在皮下，Day 2 碳水會自動從原始超補量調降至男性 7.0g/kg、女性 5.0g/kg。如果上方計畫中 Day 2 標註「已調降」，就是此機制已觸發。
`
})()}${(() => {
  const ra = recoveryAssessment
  if (!ra) return ''
  const systemEntries = Object.entries(ra.systems) as [string, { score: number; state: string; signals: string[] }][]
  const systemLabels: Record<string, string> = { neural: '神經系統', muscular: '肌肉系統', metabolic: '代謝系統', hormonal: '荷爾蒙系統', psychological: '心理狀態' }
  // Token control: only show signals for systems with score ≤ 60
  const systemLines = systemEntries.map(([key, sys]) => {
    const label = systemLabels[key] || key
    return sys.score <= 60
      ? `- ${label}：${sys.score}/100（${sys.state}）— ${sys.signals.join('、')}`
      : `- ${label}：${sys.score}/100（${sys.state}）`
  }).join('\n')
  const autonomicLabels: Record<string, string> = { parasympathetic_dominant: '副交感主導', balanced: '平衡', sympathetic_dominant: '交感主導', unknown: '未知' }
  const hrvTrendLabels: Record<string, string> = { rising: '上升', stable: '穩定', declining: '下降', unknown: '未知' }
  const trajectoryLabels: Record<string, string> = { improving: '改善中', stable: '穩定', declining: '退化中', unknown: '未知' }
  return `## 多系統恢復評估
- 總分：${ra.score}/100（${ra.state}）
- 趨勢：${trajectoryLabels[ra.trajectory] || ra.trajectory}
${systemLines}
- 過度訓練風險：${ra.overtrainingRisk.riskLevel}${ra.overtrainingRisk.acwr != null ? `（ACWR ${ra.overtrainingRisk.acwr.toFixed(2)}）` : ''}${ra.overtrainingRisk.reasons.length > 0 ? `（${ra.overtrainingRisk.reasons.join('、')}）` : ''}
- 自律神經：${autonomicLabels[ra.autonomicBalance.status] || ra.autonomicBalance.status}（HRV ${hrvTrendLabels[ra.autonomicBalance.hrvTrend] || ra.autonomicBalance.hrvTrend}）
${ra.recommendations.length > 0 ? `- 建議：${ra.recommendations.slice(0, 3).map(r => `[${r.priority}] ${r.message}`).join('；')}` : ''}
**重要**：回答恢復/訓練/疲勞相關問題時，引用具體系統分數和信號。
`
})()}${(() => {
  const ar = nutritionEngineStatus?.athleticRebound
  if (!ar || nutritionEngineStatus?.status !== 'athletic_rebound') return ''
  const strategyLabels: Record<string, string> = { short: '短間距（<4小時）', medium: '中間距（4-12小時）', long: '長間距（>12小時）' }
  return `## 超補償策略
- 秤重到比賽間距：${ar.gapHours} 小時
- 策略：${strategyLabels[ar.strategy] || ar.strategy}
- 補水速率：${ar.waterPerHour} mL/小時
`
})()}${coachSummary || coachWeeklyNote ? `## 教練備註
${coachWeeklyNote ? `- 本週回饋：${coachWeeklyNote.slice(0, 150)}` : ''}
${coachSummary ? `- 教練評估：${coachSummary.slice(0, 150)}` : ''}
` : ''}## 文獻資料庫（回答時引用以增加說服力）
### 減脂與體態
- Helms 2014: 自然健美備賽建議，減重速率 0.5-1.0% BW/週，蛋白質 2.3-3.1g/kg LBM，脂肪 15-30%
- Garthe 2011: 慢速減脂（0.7% BW/週）比快速（>1.4%）保留更多肌肉量和力量
- Roberts 2020: 體態選手營養建議，蛋白質 1.8-2.7g/kg
- Morton 2018: 蛋白質合成飽和點約 1.6g/kg，性別差異小
- Alpert 2005: 脂肪動員上限 ~31 kcal/磅脂肪/天
- Kouri 1995: 自然選手 FFMI 上限約 25（男）/ 22（女）
### 代謝適應與 Diet Break
- Trexler 2014: 代謝適應機制，diet break 與 reverse diet 策略
- Byrne 2018 (MATADOR): 間歇性能量限制（2週限制+2週維持）優於連續限制，更多脂肪流失（12.9% vs 8.4%）
### Peak Week
- Escalante 2021: 碳水超補 8-12g/kg、水分操控、鈉控制
- Barakat 2022: 碳水耗竭→超補效果實證（肌肉厚度+2%, 皮下-2%）
- Homer & Helms 2024: 水分操控可減 1.5-3% BW，碳水負荷個體差異 3-12g/kg
- Kistler 2024: 碳水超補敘事回顧
- Tarnopolsky 1995: 女性肌肉肝醣超補反應約為男性 50-70%
### 荷爾蒙與 RED-S
- Loucks 2003: 能量可用性 <30 kcal/kg FFM/天 → 荷爾蒙功能障礙閾值
- Mountjoy 2018 (IOC): RED-S 診斷需 3+ 個月無月經
### 蛋白質與營養時機
- Iraki 2019: 休賽期盈餘 +10-20%，蛋白質 1.6-2.2g/kg，每餐 0.40-0.55g/kg
- Jäger 2017 (ISSN): 蛋白質與運動立場聲明
- Thomas 2016 (ACSM): 中等運動碳水 3-5g/kg，賽前 3-4h 高碳低纖維餐
### 恢復與過度訓練
- Gabbett 2016: ACWR 安全區間 0.8-1.3
- Buchheit 2014: HRV 是中樞神經恢復最佳替代指標
- Meeusen 2013 (ECSS/ACSM): 過度訓練預防與診斷框架
- Plews 2013: HRV 導向訓練優於預設計畫
### 訓練量
- Schoenfeld 2017: 每增加一組 ≈ +0.38% 肌肥大
- Schoenfeld & Grgic 2025: 更新後每增加一組 ≈ +0.24% 肌肥大
### 補劑
- Kreider 2017 (ISSN): 肌酸 — 最高等級證據（Grade A）
- Chandrasekhar 2012: KSM-66 降低皮質醇 27.9%，改善焦慮量表 44%
- Bhatt 2019 (NEJM REDUCE-IT): EPA 4g/天減少心血管事件 25%
- Peeling 2018: Ferritin <30 ng/mL 影響 VO2max 和運動表現
- Guest 2021: 運動員維生素 D 目標 40-60 ng/mL
### 基因相關
- Wurtman 1995: 低碳水 → 色氨酸入腦減少 → 血清素下降 → 5-HTTLPR SL/SS 者情緒風險
- Gilbody 2007: MTHFR 突變 + 熱量赤字 → 甲基化崩潰 → 憂鬱風險
- Minihane 2015: APOE4 攜帶者對飽和脂肪敏感度為正常人 2-3 倍
- Tsang 2015: 5-MTHF 補充顯著降低 MTHFR C677T 純合突變者同半胱胺酸
- Yassine 2017 (JAMA Neurology): APOE4 攜帶者 DHA 補充改善腦部 DHA 攝取
**引用規則**：回答涉及以上主題時，自然地提及相關文獻（例如「根據 Garthe 2011 研究…」），增加專業說服力。不需要每句都引用，在關鍵建議處引用即可。
## 回答原則
1. 根據「剩餘需求」給出具體的外食建議（711、全家、超商、自助餐、外送等）
2. 每個建議要附上大約的營養素估算（蛋白質、碳水、脂肪、熱量）
3. 回答以繁體中文為主，語氣親切實用
4. 建議要具體到品項名稱，不要只說「高蛋白食物」
5. 如果學員已經吃超標，提醒但不責備，給出調整方案
6. 根據過去 7 天的趨勢給出更精準的建議（例如連續幾天蛋白質不足、睡眠差影響恢復等）
7. 如果身心狀態不佳（精力低、壓力高、睡眠差），適當調整飲食建議（例如建議含鎂食物助眠、抗氧化食物抗壓）
8. 可以根據補劑清單給出搭配飲食的建議
9. 如果有血檢數據，在推薦食物時自然融入（例如鐵蛋白低時優先推薦含鐵食物），但不要每次都強調血檢，只在相關時帶入
10. 如果訓練恢復評估顯示疲勞累積，主動建議有助恢復的飲食策略（抗發炎、助眠、補充電解質）
11. 當學員問訓練相關問題或身體狀況時，結合訓練引擎分析結果（恢復分數、建議模式、RPE 建議）給出像私人教練一樣的具體建議
12. 不做醫療診斷，建議以科學為基礎
13. 回答簡潔，不超過 400 字
14. **健康模式用戶**（如有健康分數數據）：你是他們的長壽健康顧問，除了飲食建議外，還要根據健康分數各支柱表現、血檢趨勢、補品建議，提供全面的健康優化方案。關注抗發炎、抗氧化、微營養素攝取、睡眠品質等長壽相關指標。
15. **食物估算功能**：當學員描述他吃了什麼（如「一個雞腿便當」、「超商鮭魚飯糰+茶葉蛋」），你要：
    - 估算該餐的蛋白質(g)、碳水(g)、脂肪(g)、總熱量(kcal)
    - 用清楚的格式列出，例如：「蛋白質 35g ｜ 碳水 75g ｜ 脂肪 18g ｜ 熱量 602 kcal」
    - 對比今日剩餘目標，告訴學員吃完這餐後還剩多少
    - 這是你最重要的功能之一，讓學員不需要自己查食物資料庫
16. 當學員問體重變化（變重/變輕/停滯）時，優先引用體重趨勢數據回答，結合飲食合規率、睡眠、水分等因素分析原因
17. 如果有教練備註，你的建議方向要跟教練一致，不要與教練的評估矛盾
18. **Peak Week 問題**：如果學員在 Peak Week 階段，你需要理解並解釋以下機制：
    - 耗竭期（比賽前 7-4 天）：碳水極低（1.1g/kg），但水載（75mL/kg）和鈉（3000mg）刻意維持高量，目的是壓制 ADH（抗利尿激素）。此階段體重不掉甚至微漲是正常的，因為在大量灌水。要告訴學員：「耗竭期的目的是清空肝醣，不是讓體重掉。體重是 Taper 那天的事。」
    - 超補期（比賽前 3-2 天）：碳水爆量（男 9.0g/kg、女 6.5g/kg），每 1g 碳水帶 3-4g 水進肌肉，體重會上升 1-3kg，這是肌肉飽滿的表現，不是變胖。
    - Taper（比賽前 1 天）：水從 100mL/kg 驟降至 40mL/kg（-60%），鈉從 3500mg 降至 1000mg。前 5-6 天的水載已讓腎臟習慣大量排水（ADH 被壓制），突然減少攝取但排出不減 → 體重快速下降 1-2kg。
    - **重要**：不要只說「這是正常的」，要解釋為什麼是正常的。學員需要理解水載→ADH壓制→Taper排水的因果關係才能安心。
19. **體重停滯問題**：當學員問為什麼體重沒掉時，不要只說「正常波動」。要根據數據分析具體原因：
    - 鈉攝取變化 → 水滯留（看飲食紀錄）
    - 訓練後肌肉微損傷 → 發炎修復帶水（看 RPE 和訓練紀錄）
    - 睡眠差 / 壓力大 → 皮質醇升高 → 水滯留（看身心狀態）
    - 碳水攝取變化 → 肝醣儲存帶水，1g 碳水 = 3-4g 水（看過去幾天碳水量）
    - 然後引用週均值趨勢，告訴學員系統判斷進度看的是長期趨勢，不是單日數字。同時說明系統的停滯判定標準（連續數週週均重變化率 ≥ -0.3%）。
20. **恢復與代謝適應**：當系統建議 Diet Break 或 Refeed、或學員恢復狀態差時，解釋原因：
    - 長期熱量赤字 → 代謝適應（TDEE 下降）→ 需要短期提高攝取重置
    - 恢復差時不建議繼續砍熱量，因為皮質醇已經高，再砍只會更卡（身體進入保護模式）
    - Refeed 增加碳水不是放縱，是策略性的代謝重置，讓瘦體素回升
21. **解釋「為什麼」的原則**：遇到學員焦慮的問題（體重不動、為什麼要多吃、為什麼不能再砍），不要只給結論，要解釋機制。學員理解原理後會更信任系統、更願意照做。但解釋要簡潔有力，不要變成教科書。
22. **飢餓感問題**：學員說「好餓」時，不要只說「吃高蛋白」。先分析原因：
    - 看碳水攝取：碳水太低會導致血糖不穩、飢餓感劇烈（尤其低碳日）
    - 看睡眠品質：睡眠差 → 瘦體素（leptin）下降 + 飢餓素（ghrelin）上升 → 生理性食慾增加
    - 看減脂時間：長期赤字（>8 週）代謝適應 → 飢餓感自然增加
    - 看水分：脫水會被身體誤判為飢餓
    然後給具體策略：高纖食物撐體積、蛋白質延緩胃排空、黑咖啡/綠茶抑制食慾、或判斷是否該安排 Refeed。
23. **「我可以吃 X 嗎」/ 外食問題**：不要直接說「不行」或「少吃」。算進今天的剩餘目標，告訴學員：
    - 這個食物大約的營養素
    - 吃完之後今天還剩多少額度
    - 如果會超標，建議怎麼調整其他餐（例如「中午吃了大麥克的話，晚餐就吃雞胸沙拉，整天還是能 on track」）
    - 核心態度：沒有不能吃的東西，只有怎麼放進你的目標裡
24. **週回顧 / 整體表現問題**：學員問「我這週如何」時，綜合以下維度給出結構化回顧：
    - 營養合規率（7 天中幾天達標）
    - 體重趨勢方向和速度
    - 訓練頻率和強度（RPE 分布）
    - 身心狀態趨勢（睡眠、精力、壓力的走向）
    - 最後給一個整體判斷和下週建議，像教練每週回顧一樣
25. **碳水循環解釋**：學員問為什麼今天碳水目標跟昨天不同時，解釋碳循環邏輯：
    - 訓練日碳水較高（佔總碳水 60%）：肌肉需要肝醣供能，訓練表現更好
    - 休息日碳水較低（佔總碳水 40%）：不訓練時不需要那麼多即時能量，稍低的碳水有助於脂肪氧化
    - 總週碳水量不變，只是重新分配，讓身體在對的時間用對的燃料
26. **減脂過快 (too_fast) 處理**：營養引擎顯示減脂過快時，不要只說「多吃點」。要解釋風險：
    - 週均掉超過 1% 體重 → 肌肉流失風險顯著增加（Helms 2014）
    - 過快減脂 → 代謝適應更劇烈 → 後期更容易停滯和反彈
    - 具體建議增加多少熱量（通常 +100-200 kcal），優先加碳水保護訓練表現
27. **恢復分數解讀**：學員問恢復分數的意義時，不要只說「中等/偏低」。要拆解：
    - 哪個因素在拉低分數（睡眠？訓練量？HRV？壓力？）
    - 給出 1-2 個最能改善的具體行動（例如「你近 3 天睡眠都 2/5，這是主因。今晚試試睡前 30 分鐘不看手機 + 400mg 鎂」）
    - 恢復分數對訓練的影響：<50 建議降量或 deload，50-75 正常練但注意 RPE，>75 可以推
28. **睡眠與減脂的關係**：學員問睡眠是否影響減脂時，用數據說明：
    - 睡眠不足 → 瘦體素下降 + 飢餓素上升 → 食慾增加 15-25%
    - 皮質醇升高 → 水滯留（體重看起來沒掉）+ 腹部脂肪堆積傾向
    - 睡眠差時同樣熱量赤字，身體傾向分解肌肉而非脂肪（Nedeltcheva 2010）
    - 如果學員身心狀態中睡眠持續 ≤2/5，主動建議：先改善睡眠再追求更大赤字
29. **體脂與體重不同步**：學員說「體重有掉但體脂沒變」或反過來時，解釋：
    - 家用體脂計誤差大（±2-3%），受水分、進食、時間影響
    - 體重掉但體脂不變 → 可能正在 recomp（肌肉量維持/增加，脂肪減少但比例沒變）
    - 體脂掉但體重不變 → 正在增肌減脂，這是好事
    - 建議以鏡子 + 腰圍 + 體重週均值三個維度綜合判斷，不要只看體脂計數字`
  }, [clientName, gender, goalType, todayNutrition, caloriesTarget, proteinTarget, carbsTarget, fatTarget, waterTarget, isTrainingDay, competitionEnabled, prepPhase, competitionDate, latestWeight, latestBodyFat, nutritionLogs, wellnessLogs, trainingLogs, supplements, supplementComplianceRate, todayWellness, wearableData, labResults, healthModeEnabled, healthScore, supplementSuggestions, geneticProfile, trainingReadiness, weightTrend, bodyFatTrend, nutritionEngineStatus, recoveryAssessment, coachSummary, coachWeeklyNote, streakDays, targetWeight, targetBodyFat, dietStartDate])

  // 壓縮圖片：FileReader → Image → Canvas → base64 JPEG
  // 每一步都有 fallback，即使 Canvas 失敗也會回傳原圖 base64
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 10 秒超時保護
      const timeout = setTimeout(() => reject(new Error('圖片處理超時')), 10000)

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        if (!dataUrl || !dataUrl.includes(',')) {
          clearTimeout(timeout)
          reject(new Error('FileReader 回傳無效資料'))
          return
        }

        const img = new Image()
        img.onload = () => {
          clearTimeout(timeout)
          try {
            const maxW = 800
            const scale = img.width > maxW ? maxW / img.width : 1
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              // Canvas 不支援，直接回傳原圖
              resolve(dataUrl.split(',')[1])
              return
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.7)
            const base64 = jpegUrl.split(',')[1]
            // 確認 toDataURL 有產出有效資料，否則 fallback
            if (base64 && base64.length > 100) {
              resolve(base64)
            } else {
              resolve(dataUrl.split(',')[1])
            }
          } catch {
            // Canvas 操作失敗，回傳原圖
            resolve(dataUrl.split(',')[1])
          }
        }
        img.onerror = () => {
          clearTimeout(timeout)
          // Image 載入失敗，嘗試直接用原始 data URL
          const base64 = dataUrl.split(',')[1]
          if (base64 && base64.length > 100) {
            resolve(base64)
          } else {
            reject(new Error('圖片載入失敗'))
          }
        }
        img.src = dataUrl
      }
      reader.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('檔案讀取失敗'))
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 不檢查 file.type — 某些手機瀏覽器拍照不設 MIME type，
    // 且 <input accept="image/*"> 已經在前端過濾了

    try {
      const base64 = await compressImage(file)
      setPendingImage(base64)
      setPendingImagePreview(`data:image/jpeg;base64,${base64}`)
      if (!input.trim()) {
        setInput('幫我算這餐的營養素')
      }
      inputRef.current?.focus()
    } catch (err) {
      console.error('[AiChat] Image compression failed:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `圖片處理失敗：${err instanceof Error ? err.message : '未知錯誤'}，請重新拍照或選擇其他圖片試試 🙏`,
      }])
    }
    // 最後才重置 file input，用 ref 比 event target 更可靠
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [compressImage, input])

  const clearPendingImage = useCallback(() => {
    setPendingImage(null)
    setPendingImagePreview(null)
  }, [])

  async function handleSend() {
    const text = input.trim()
    if ((!text && !pendingImage) || loading) return

    const msgText = text || (pendingImage ? '幫我算這餐的營養素' : '')
    const userMsg: Message = { role: 'user', content: msgText, image: pendingImagePreview || undefined }
    const newMessages = [...messages, userMsg]
    const imageToSend = pendingImage // capture before clearing
    setMessages(newMessages)
    setInput('')
    clearPendingImage()
    setLoading(true)

    // 標記免費用戶的首次使用
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage()
    }

    const MAX_CLIENT_RETRIES = 3

    try {
      let lastError: string | null = null

      for (let attempt = 0; attempt < MAX_CLIENT_RETRIES; attempt++) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            systemPrompt,
            clientId,
            ...(imageToSend ? { image: imageToSend } : {}),
          }),
        })

        if (res.ok) {
          const data = await res.json()
          setMessages([...newMessages, { role: 'assistant', content: data.reply }])
          return
        }

        const err = await res.json().catch(() => ({}))

        if (err.quota_exceeded) {
          setMessages([
            ...newMessages,
            { role: 'assistant', content: '本月免費體驗次數已用完 🙏\n\n你可以選擇：' },
          ])
          setQuotaExceeded(true)
          return
        }

        lastError = err.error || '回覆失敗'

        // Retry on 503 (overloaded) or 429 (rate limited)
        if ((res.status === 503 || res.status === 429) && attempt < MAX_CLIENT_RETRIES - 1) {
          const delay = (attempt + 1) * 3000 // 3s, 6s
          setMessages([...newMessages, { role: 'assistant', content: `⏳ AI 伺服器忙碌中，自動重試第 ${attempt + 1} 次...` }])
          await new Promise(r => setTimeout(r, delay))
          continue
        }

        throw new Error(lastError || '回覆失敗')
      }

      throw new Error(lastError || '回覆失敗')
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `抱歉，發生錯誤：${err.message || '請稍後再試'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Remaining macros summary
  const remaining = useMemo(() => {
    const eaten = todayNutrition
    const parts: string[] = []
    if (proteinTarget) {
      const left = Math.max(0, proteinTarget - (eaten?.protein_grams ?? 0))
      if (left > 0) parts.push(`蛋白質 ${left}g`)
    }
    if (carbsTarget) {
      const left = Math.max(0, carbsTarget - (eaten?.carbs_grams ?? 0))
      if (left > 0) parts.push(`碳水 ${left}g`)
    }
    if (fatTarget) {
      const left = Math.max(0, fatTarget - (eaten?.fat_grams ?? 0))
      if (left > 0) parts.push(`脂肪 ${left}g`)
    }
    return parts
  }, [todayNutrition, proteinTarget, carbsTarget, fatTarget])

  if (!open) return null

  const quickQuestions = [
    '我的減脂進度正常嗎？',
    '根據我的恢復狀態，今天適合練什麼？',
    '我今天剩下的量，去超商要怎麼買？',
    '幫我算這餐：一個雞腿便當加一杯豆漿',
    '這週我的睡眠跟訓練有什麼需要注意的？',
    '幫我分析我最近的飲食模式',
    '我的血檢有什麼需要透過飲食改善的？',
    '幫我預測還要多久能達到目標體重',
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI 私人顧問</p>
              {remaining.length > 0 && (
                <p className="text-[10px] text-gray-400">今日還需：{remaining.join('、')}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* AI Disclaimer */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
          <p className="text-[11px] text-gray-400 text-center">AI 建議僅供參考，不構成醫療診斷或治療建議</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '200px' }}>
          {messages.length === 0 && (
            <div className="py-6">
              <p className="text-sm text-gray-500 text-center mb-4">
                我有你的飲食、訓練、睡眠、血檢、體重變化等數據，什麼都可以問我。
              </p>
              <div className="space-y-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="w-full text-left text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-[#2563eb] px-4 py-2.5 rounded-xl transition-colors border border-gray-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.image && (
                  <img src={msg.image} alt="食物照片" className="rounded-xl mb-2 max-h-40 w-auto" />
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {quotaExceeded && (
            <div className="max-w-[90%] ml-1">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2">
                <p className="text-sm font-semibold text-gray-800 mb-1">本月 3 次免費額度已用完</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  剛才的對話你應該有感覺到——AI 回答的是你的真實數據，不是網路上的通用建議。升級後可以隨時問，不限次數。
                </p>
                <div className="space-y-2">
                  <a
                    href={`/pay?tier=self_managed&name=${encodeURIComponent(clientName)}`}
                    className="block w-full text-center bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                  >
                    升級自主管理版 NT$499/月
                    <span className="block text-[10px] font-normal opacity-80 mt-0.5">AI 顧問無限次 + 完整訓練追蹤</span>
                  </a>
                  <a
                    href="https://lin.ee/LP65rCc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-[#06C755] text-white font-semibold py-3 px-4 rounded-xl hover:bg-[#05b04d] transition-colors text-sm"
                  >
                    或加 LINE 直接問 Howard
                    <span className="block text-[10px] font-normal opacity-80 mt-0.5">真人回覆，免費諮詢</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-3 py-2.5 shrink-0">
          {/* Image preview */}
          {pendingImagePreview && (
            <div className="relative inline-block mb-2">
              <img src={pendingImagePreview} alt="預覽" className="h-20 rounded-xl border border-gray-200" />
              <button
                onClick={clearPendingImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {/* Camera button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#2563eb] transition-colors disabled:opacity-40 flex-shrink-0"
              title="拍照或選擇圖片"
            >
              <Camera size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingImage ? '描述這餐吃了什麼（選填）...' : '問我今天怎麼吃...'}
              rows={1}
              className="flex-1 resize-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage) || loading}
              className="bg-[#2563eb] text-white p-2.5 rounded-xl hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            拍照估算營養素，或問任何跟你數據有關的問題
          </p>
        </div>
      </div>
    </>
  )
}
