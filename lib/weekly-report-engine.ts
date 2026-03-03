/**
 * Weekly Report Engine
 * 教練週報自動化引擎
 *
 * 整合所有引擎（insight、churn、predictive、phase），
 * 為每位學員生成週報摘要 + 為教練生成全局儀表板。
 */

import { generateInsights, type InsightInput, type Insight } from './insight-engine'
import { predictChurn, type ChurnInput, type ChurnPrediction } from './churn-predictor'
import { generatePrediction, type PredictiveInput, type PredictiveResult } from './predictive-engine'
import { evaluatePhase, type PhaseInput, type PhaseRecommendation } from './phase-manager'

// ─── 輸入類型 ───

export interface ClientReportInput {
  // 基本資料
  clientId: string
  clientName: string
  gender: string
  goalType: 'cut' | 'bulk'
  isActive: boolean
  subscriptionTier: string
  prepPhase: string | null
  competitionEnabled: boolean
  competitionDate: string | null
  dietStartDate: string | null

  // 目標
  targetWeight: number | null
  targetBodyFatPct: number | null
  targetDate: string | null
  caloriesTarget: number | null
  proteinTarget: number | null
  estimatedTDEE: number | null

  // 近 30 天每日活動
  dailyActivity: ChurnInput['dailyActivity']

  // 近 14 天 wellness
  wellness: InsightInput['wellness']

  // 近 14 天訓練
  training: InsightInput['training']

  // 近 14 天飲食
  nutrition: InsightInput['nutrition']

  // 近 14 天體組成
  bodyComposition: InsightInput['bodyComposition']

  // 近 4 週週均體重
  weeklyWeights: PredictiveInput['weeklyWeights']

  // 血檢
  labResults: InsightInput['labResults']

  // 合規率
  supplementComplianceRate: number  // 0-1
  nutritionCompliance: number  // 0-100

  // 體重停滯
  weightStagnant: boolean

  // Phase 相關
  weeksSinceLastBreak: number | null
  refeedSuggested: boolean
  lastRefeedDate: string | null

  // 恢復基線
  baselineHRV: number | null
  baselineRHR: number | null
}

// ─── 輸出類型 ───

export interface ClientWeeklyReport {
  clientId: string
  clientName: string
  generatedAt: string

  // 本週摘要
  summary: {
    currentWeight: number | null
    weeklyWeightChange: number | null  // kg
    weeklyWeightChangeRate: number | null  // %
    nutritionCompliance: number
    supplementCompliance: number  // %
    trainingDays: number
    avgEnergy: number | null
    avgMood: number | null
    avgSleep: number | null
  }

  // 各引擎結果
  insights: Insight[]
  churnPrediction: ChurnPrediction
  prediction: PredictiveResult | null
  phaseRecommendation: PhaseRecommendation

  // 教練行動建議（整合所有引擎的建議）
  priorityActions: PriorityAction[]

  // 交通燈狀態
  overallStatus: 'green' | 'yellow' | 'red'
}

export interface PriorityAction {
  priority: 1 | 2 | 3  // 1 = 最高
  action: string
  source: string  // 來自哪個引擎
}

export interface CoachWeeklyDigest {
  generatedAt: string
  totalClients: number
  activeClients: number

  // 紅燈學員（需要立即關注）
  redClients: Array<{
    clientId: string
    clientName: string
    reasons: string[]
  }>

  // 黃燈學員（需要留意）
  yellowClients: Array<{
    clientId: string
    clientName: string
    reasons: string[]
  }>

  // 綠燈學員
  greenCount: number

  // 流失風險
  churnRisk: Array<{
    clientId: string
    clientName: string
    riskScore: number
    riskLevel: string
    topReason: string
  }>

  // 階段建議
  phaseChanges: Array<{
    clientId: string
    clientName: string
    currentPhase: string
    suggestedPhase: string
    reason: string
  }>

  // 全局統計
  stats: {
    avgNutritionCompliance: number
    avgSupplementCompliance: number
    clientsLosingWeight: number
    clientsGainingWeight: number
    clientsStagnant: number
  }
}

// ─── 單一學員週報生成 ───

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function generateClientReport(input: ClientReportInput): ClientWeeklyReport {
  const now = new Date().toISOString()

  // ─── 本週摘要 ───
  const currentWeight = input.bodyComposition.length > 0
    ? input.bodyComposition[input.bodyComposition.length - 1].weight
    : null

  let weeklyWeightChange: number | null = null
  let weeklyWeightChangeRate: number | null = null
  if (input.weeklyWeights.length >= 2) {
    weeklyWeightChange = Math.round((input.weeklyWeights[0].avgWeight - input.weeklyWeights[1].avgWeight) * 100) / 100
    weeklyWeightChangeRate = Math.round((weeklyWeightChange / input.weeklyWeights[1].avgWeight) * 10000) / 100
  }

  const recent7Wellness = input.wellness.slice(-7)
  const energyVals = recent7Wellness.map(w => w.energy_level).filter(v => v != null) as number[]
  const moodVals = recent7Wellness.map(w => w.mood).filter(v => v != null) as number[]
  const sleepVals = recent7Wellness.map(w => w.sleep_quality).filter(v => v != null) as number[]
  const driveVals = recent7Wellness.map(w => w.training_drive).filter(v => v != null) as number[]
  const stressVals = recent7Wellness.map(w => w.stress_level).filter(v => v != null) as number[]

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const sevenStr = sevenDaysAgo.toISOString().split('T')[0]
  const trainingDays = input.training.filter(t => t.date >= sevenStr && t.training_type !== 'rest').length

  const summary = {
    currentWeight,
    weeklyWeightChange,
    weeklyWeightChangeRate,
    nutritionCompliance: input.nutritionCompliance,
    supplementCompliance: Math.round(input.supplementComplianceRate * 100),
    trainingDays,
    avgEnergy: energyVals.length > 0 ? Math.round(avg(energyVals) * 10) / 10 : null,
    avgMood: moodVals.length > 0 ? Math.round(avg(moodVals) * 10) / 10 : null,
    avgSleep: sleepVals.length > 0 ? Math.round(avg(sleepVals) * 10) / 10 : null,
  }

  // ─── 1. Cross-System Insights ───
  const insightInput: InsightInput = {
    clientName: input.clientName,
    gender: input.gender,
    goalType: input.goalType,
    wellness: input.wellness,
    training: input.training,
    nutrition: input.nutrition,
    bodyComposition: input.bodyComposition,
    labResults: input.labResults,
    caloriesTarget: input.caloriesTarget,
    proteinTarget: input.proteinTarget,
  }
  const insights = generateInsights(insightInput)

  // ─── 2. Churn Prediction ───
  const churnInput: ChurnInput = {
    clientId: input.clientId,
    clientName: input.clientName,
    isActive: input.isActive,
    dailyActivity: input.dailyActivity,
    wellness: input.wellness.map(w => ({
      date: w.date,
      energy_level: w.energy_level,
      mood: w.mood,
      training_drive: w.training_drive,
    })),
    supplementComplianceRate: input.supplementComplianceRate,
    nutritionComplianceRate: input.nutritionCompliance,
    weightStagnant: input.weightStagnant,
    subscriptionTier: input.subscriptionTier,
  }
  const churnPrediction = predictChurn(churnInput)

  // ─── 3. Predictive Engine ───
  let prediction: PredictiveResult | null = null
  if (currentWeight && input.weeklyWeights.length >= 2) {
    const latestBodyFat = input.bodyComposition.length > 0
      ? input.bodyComposition[input.bodyComposition.length - 1].body_fat
      : null

    const predInput: PredictiveInput = {
      currentWeight,
      bodyFatPct: latestBodyFat,
      goalType: input.goalType,
      targetWeight: input.targetWeight,
      targetDate: input.targetDate,
      estimatedTDEE: input.estimatedTDEE,
      currentCalories: input.caloriesTarget,
      nutritionCompliance: input.nutritionCompliance,
      dietStartDate: input.dietStartDate,
      weeklyWeights: input.weeklyWeights,
    }
    prediction = generatePrediction(predInput)
  }

  // ─── 4. Phase Manager ───
  const avgHRV = recent7Wellness.map(w => w.hrv).filter(v => v != null) as number[]
  const avgRHR = recent7Wellness.map(w => w.resting_hr).filter(v => v != null) as number[]

  const phaseInput: PhaseInput = {
    goalType: input.goalType,
    currentWeight: currentWeight || 0,
    targetWeight: input.targetWeight,
    bodyFatPct: input.bodyComposition.length > 0 ? input.bodyComposition[input.bodyComposition.length - 1].body_fat : null,
    targetBodyFatPct: input.targetBodyFatPct,
    dietStartDate: input.dietStartDate,
    prepPhase: input.prepPhase,
    totalWeightLost: null,
    weeklyWeightChangeRate,
    nutritionCompliance: input.nutritionCompliance,
    avgEnergy: energyVals.length > 0 ? avg(energyVals) : null,
    avgMood: moodVals.length > 0 ? avg(moodVals) : null,
    avgSleepQuality: sleepVals.length > 0 ? avg(sleepVals) : null,
    avgTrainingDrive: driveVals.length > 0 ? avg(driveVals) : null,
    avgHRV: avgHRV.length > 0 ? avg(avgHRV) : null,
    baselineHRV: input.baselineHRV,
    avgRHR: avgRHR.length > 0 ? avg(avgRHR) : null,
    baselineRHR: input.baselineRHR,
    weeksSinceLastBreak: input.weeksSinceLastBreak,
    refeedSuggested: input.refeedSuggested,
    lastRefeedDate: input.lastRefeedDate,
    competitionDate: input.competitionDate,
    competitionEnabled: input.competitionEnabled,
    gender: input.gender,
  }
  const phaseRecommendation = evaluatePhase(phaseInput)

  // ─── 5. 整合優先行動 ───
  const priorityActions: PriorityAction[] = []

  // 來自 Phase Manager
  if (phaseRecommendation.suggestedPhase && phaseRecommendation.urgency !== 'monitor') {
    priorityActions.push({
      priority: phaseRecommendation.urgency === 'immediate' ? 1 : 2,
      action: `${phaseRecommendation.reason} → 建議切換到 ${phaseRecommendation.suggestedPhase}`,
      source: '階段管理',
    })
  }

  // 來自 Churn Predictor
  if (churnPrediction.riskLevel === 'critical') {
    priorityActions.push({
      priority: 1,
      action: `流失風險極高（${churnPrediction.riskScore}分）— ${churnPrediction.suggestedActions[0] || '立即聯繫'}`,
      source: '流失預警',
    })
  } else if (churnPrediction.riskLevel === 'high') {
    priorityActions.push({
      priority: 2,
      action: `流失風險偏高（${churnPrediction.riskScore}分）— ${churnPrediction.suggestedActions[0] || '主動關心'}`,
      source: '流失預警',
    })
  }

  // 來自 Insights
  const criticalInsights = insights.filter(i => i.severity === 'critical')
  for (const insight of criticalInsights.slice(0, 2)) {
    priorityActions.push({
      priority: 1,
      action: `${insight.title} — ${insight.action}`,
      source: '跨系統分析',
    })
  }

  // 來自 Prediction
  if (prediction?.safetyWarning) {
    priorityActions.push({
      priority: 2,
      action: prediction.safetyWarning,
      source: '趨勢預測',
    })
  }

  if (prediction?.onTrackForGoal === false && input.targetWeight) {
    priorityActions.push({
      priority: 2,
      action: `照目前速度無法在目標日期前達到 ${input.targetWeight}kg，${prediction.estimatedGoalDate ? `預估 ${prediction.estimatedGoalDate} 才能達標` : '需要調整策略'}`,
      source: '趨勢預測',
    })
  }

  // 排序
  priorityActions.sort((a, b) => a.priority - b.priority)

  // ─── 6. 交通燈判定 ───
  let overallStatus: ClientWeeklyReport['overallStatus'] = 'green'

  if (
    criticalInsights.length > 0 ||
    churnPrediction.riskLevel === 'critical' ||
    (phaseRecommendation.suggestedPhase && phaseRecommendation.urgency === 'immediate')
  ) {
    overallStatus = 'red'
  } else if (
    insights.filter(i => i.severity === 'warning').length >= 2 ||
    churnPrediction.riskLevel === 'high' ||
    (prediction?.safetyWarning) ||
    (phaseRecommendation.suggestedPhase && phaseRecommendation.urgency === 'this_week')
  ) {
    overallStatus = 'yellow'
  }

  return {
    clientId: input.clientId,
    clientName: input.clientName,
    generatedAt: now,
    summary,
    insights,
    churnPrediction,
    prediction,
    phaseRecommendation,
    priorityActions,
    overallStatus,
  }
}

// ─── 教練全局週報 ───

export function generateCoachDigest(reports: ClientWeeklyReport[]): CoachWeeklyDigest {
  const redClients = reports
    .filter(r => r.overallStatus === 'red')
    .map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      reasons: r.priorityActions.filter(a => a.priority === 1).map(a => a.action),
    }))

  const yellowClients = reports
    .filter(r => r.overallStatus === 'yellow')
    .map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      reasons: r.priorityActions.filter(a => a.priority <= 2).map(a => a.action),
    }))

  const greenCount = reports.filter(r => r.overallStatus === 'green').length

  const churnRisk = reports
    .filter(r => r.churnPrediction.riskLevel !== 'low')
    .sort((a, b) => b.churnPrediction.riskScore - a.churnPrediction.riskScore)
    .map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      riskScore: r.churnPrediction.riskScore,
      riskLevel: r.churnPrediction.riskLevel,
      topReason: r.churnPrediction.riskFactors[0] || '',
    }))

  const phaseChanges = reports
    .filter(r => r.phaseRecommendation.suggestedPhase != null)
    .map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      currentPhase: r.phaseRecommendation.currentPhase,
      suggestedPhase: r.phaseRecommendation.suggestedPhase!,
      reason: r.phaseRecommendation.reason,
    }))

  // 全局統計
  const complianceValues = reports.map(r => r.summary.nutritionCompliance).filter(v => v > 0)
  const suppValues = reports.map(r => r.summary.supplementCompliance).filter(v => v > 0)

  let clientsLosingWeight = 0
  let clientsGainingWeight = 0
  let clientsStagnant = 0
  for (const r of reports) {
    if (r.summary.weeklyWeightChange == null) continue
    if (r.summary.weeklyWeightChange < -0.1) clientsLosingWeight++
    else if (r.summary.weeklyWeightChange > 0.1) clientsGainingWeight++
    else clientsStagnant++
  }

  return {
    generatedAt: new Date().toISOString(),
    totalClients: reports.length,
    activeClients: reports.filter(r => r.churnPrediction.daysSinceLastActivity < 7).length,
    redClients,
    yellowClients,
    greenCount,
    churnRisk,
    phaseChanges,
    stats: {
      avgNutritionCompliance: complianceValues.length > 0 ? Math.round(avg(complianceValues)) : 0,
      avgSupplementCompliance: suppValues.length > 0 ? Math.round(avg(suppValues)) : 0,
      clientsLosingWeight,
      clientsGainingWeight,
      clientsStagnant,
    },
  }
}
