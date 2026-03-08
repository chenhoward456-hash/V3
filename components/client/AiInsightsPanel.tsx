'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Activity, Utensils, AlertTriangle,
  Brain, Dumbbell, ChevronRight, Loader2, Sparkles, FlaskConical, Target
} from 'lucide-react'

interface AiInsightsPanelProps {
  clientId: string
  isTrainingDay: boolean
}

interface TrendPrediction {
  currentWeight: number
  targetWeight: number | null
  weeklyRate: number | null
  estimatedWeeksToGoal: number | null
  estimatedDate: string | null
  confidence: 'high' | 'medium' | 'low'
  message: string
}

interface DietaryPattern {
  weekendOvereat: { detected: boolean; avgWeekdayCal: number | null; avgWeekendCal: number | null; diff: number | null }
  proteinDeficiency: { detected: boolean; deficientDays: number; totalDays: number }
  carbsImbalance: { detected: boolean; detail: string }
  waterDeficiency: { detected: boolean; avgWater: number | null; target: number | null }
}

interface TrainingAdvice {
  recommendedIntensity: 'high' | 'moderate' | 'low' | 'rest'
  recoveryScore: number
  reasons: string[]
  suggestion: string
}

interface SmartAlert {
  type: string
  severity: 'warning' | 'info'
  title: string
  message: string
  icon: string
}

interface LabComparison {
  testName: string
  current: { value: number; status: string; date: string } | null
  previous: { value: number; status: string; date: string } | null
  change: number | null
  changePercent: number | null
  improved: boolean | null
  unit: string
}

interface InsightsData {
  trendPrediction?: TrendPrediction
  dietaryPatterns?: DietaryPattern
  trainingAdvice?: TrainingAdvice
  smartAlerts?: SmartAlert[]
  labComparisons?: LabComparison[]
}

const intensityColors = {
  high: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  rest: 'bg-red-100 text-red-700 border-red-200',
}

const intensityLabels = {
  high: '高強度',
  moderate: '中等強度',
  low: '輕量',
  rest: '休息',
}

const confidenceLabels = {
  high: '高可信度',
  medium: '中可信度',
  low: '低可信度',
}

export default function AiInsightsPanel({ clientId, isTrainingDay }: AiInsightsPanelProps) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [aiContent, setAiContent] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const controller = new AbortController()
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/ai/insights?clientId=${clientId}&type=all`, { signal: controller.signal })
        if (!res.ok) throw new Error('載入失敗')
        const json = await res.json()
        setData(json)
      } catch (err: any) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchInsights()
    return () => controller.abort()
  }, [clientId])

  const aiContentRef = useRef(aiContent)
  const aiLoadingRef = useRef(aiLoading)
  aiContentRef.current = aiContent
  aiLoadingRef.current = aiLoading

  const fetchAiContent = useCallback(async (type: string, extraParams = '') => {
    if (aiContentRef.current[type] || aiLoadingRef.current[type]) return
    setAiLoading(prev => ({ ...prev, [type]: true }))
    try {
      const res = await fetch(`/api/ai/insights?clientId=${clientId}&type=${type}${extraParams}`)
      if (!res.ok) throw new Error('AI 分析失敗')
      const json = await res.json()
      const content = json.weeklyReport || json.mealSuggestion || json.labSummary || ''
      setAiContent(prev => ({ ...prev, [type]: content }))
    } catch {
      setAiContent(prev => ({ ...prev, [type]: '分析失敗，請稍後再試' }))
    } finally {
      setAiLoading(prev => ({ ...prev, [type]: false }))
    }
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-purple-500" />
          <h3 className="font-semibold text-gray-900">AI 智能分析</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">分析中...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return null
  }

  const { trendPrediction, dietaryPatterns, trainingAdvice, smartAlerts, labComparisons } = data
  const hasAlerts = smartAlerts && smartAlerts.length > 0
  const hasLabChanges = labComparisons && labComparisons.some(c => c.previous != null)

  return (
    <div className="space-y-3">
      {/* 智能警示 */}
      {hasAlerts && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-500" />
            <h4 className="text-sm font-semibold text-gray-900">智能提醒</h4>
          </div>
          <div className="space-y-2">
            {smartAlerts!.map((alert, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm ${alert.severity === 'warning' ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'}`}>
                <div className="font-medium text-gray-800 mb-1">{alert.icon} {alert.title}</div>
                <p className="text-gray-600 text-xs leading-relaxed">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 訓練建議 */}
      {trainingAdvice && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={16} className="text-indigo-500" />
              <h4 className="text-sm font-semibold text-gray-900">今日訓練建議</h4>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${intensityColors[trainingAdvice.recommendedIntensity]}`}>
              {intensityLabels[trainingAdvice.recommendedIntensity]}
            </span>
          </div>

          {/* 恢復分數條 */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>恢復分數</span>
              <span>{trainingAdvice.recoveryScore}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  trainingAdvice.recoveryScore >= 75 ? 'bg-green-400' :
                  trainingAdvice.recoveryScore >= 50 ? 'bg-blue-400' :
                  trainingAdvice.recoveryScore >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${trainingAdvice.recoveryScore}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">{trainingAdvice.suggestion}</p>

          {trainingAdvice.reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {trainingAdvice.reasons.map((r, i) => (
                <p key={i} className="text-[11px] text-gray-400">• {r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 趨勢預測 */}
      {trendPrediction && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-blue-500" />
            <h4 className="text-sm font-semibold text-gray-900">趨勢預測</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              trendPrediction.confidence === 'high' ? 'bg-green-50 text-green-600' :
              trendPrediction.confidence === 'medium' ? 'bg-yellow-50 text-yellow-600' :
              'bg-gray-50 text-gray-500'
            }`}>
              {confidenceLabels[trendPrediction.confidence]}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{trendPrediction.currentWeight}kg</p>
              <p className="text-[10px] text-gray-400">目前</p>
            </div>
            {trendPrediction.weeklyRate != null && (
              <>
                <div className="flex items-center text-gray-300">
                  {trendPrediction.weeklyRate < 0
                    ? <TrendingDown size={16} className={trendPrediction.targetWeight != null && trendPrediction.currentWeight > trendPrediction.targetWeight ? 'text-green-500' : 'text-red-500'} />
                    : <TrendingUp size={16} className={trendPrediction.targetWeight != null && trendPrediction.currentWeight < trendPrediction.targetWeight ? 'text-green-500' : 'text-red-500'} />}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    {trendPrediction.weeklyRate > 0 ? '+' : ''}{trendPrediction.weeklyRate}kg/週
                  </p>
                  <p className="text-[10px] text-gray-400">週變化率</p>
                </div>
              </>
            )}
            {trendPrediction.targetWeight != null && (
              <>
                <div className="text-gray-300">→</div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{trendPrediction.targetWeight}kg</p>
                  <p className="text-[10px] text-gray-400">目標</p>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">{trendPrediction.message}</p>

          {trendPrediction.estimatedDate && (
            <div className="mt-2 bg-blue-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-blue-700">
                預計 <span className="font-semibold">{trendPrediction.estimatedWeeksToGoal} 週</span>後達標
                <span className="text-blue-500 ml-1">({trendPrediction.estimatedDate})</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 飲食模式洞察 */}
      {dietaryPatterns && (dietaryPatterns.weekendOvereat.detected || dietaryPatterns.proteinDeficiency.detected || dietaryPatterns.carbsImbalance.detected || dietaryPatterns.waterDeficiency.detected) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-purple-500" />
            <h4 className="text-sm font-semibold text-gray-900">飲食模式洞察</h4>
          </div>
          <div className="space-y-2">
            {dietaryPatterns.weekendOvereat.detected && (
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-medium text-orange-800 mb-1">週末熱量偏高</p>
                <p className="text-[11px] text-orange-600">
                  平日平均 {dietaryPatterns.weekendOvereat.avgWeekdayCal} kcal → 週末平均 {dietaryPatterns.weekendOvereat.avgWeekendCal} kcal（+{dietaryPatterns.weekendOvereat.diff} kcal）
                </p>
              </div>
            )}
            {dietaryPatterns.proteinDeficiency.detected && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs font-medium text-red-800 mb-1">蛋白質攝取不足</p>
                <p className="text-[11px] text-red-600">
                  近 14 天有 {dietaryPatterns.proteinDeficiency.deficientDays}/{dietaryPatterns.proteinDeficiency.totalDays} 天蛋白質低於目標 80%
                </p>
              </div>
            )}
            {dietaryPatterns.carbsImbalance.detected && (
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <p className="text-xs font-medium text-yellow-800 mb-1">碳水攝取不穩定</p>
                <p className="text-[11px] text-yellow-600">{dietaryPatterns.carbsImbalance.detail}</p>
              </div>
            )}
            {dietaryPatterns.waterDeficiency.detected && (
              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                <p className="text-xs font-medium text-cyan-800 mb-1">水分攝取不足</p>
                <p className="text-[11px] text-cyan-600">
                  平均 {dietaryPatterns.waterDeficiency.avgWater} ml/天（目標 {dietaryPatterns.waterDeficiency.target} ml）
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 血檢趨勢 */}
      {hasLabChanges && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <button
            onClick={() => {
              setExpandedSection(expandedSection === 'lab' ? null : 'lab')
              if (!aiContent['lab-comparison-summary']) {
                fetchAiContent('lab-comparison-summary')
              }
            }}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-teal-500" />
              <h4 className="text-sm font-semibold text-gray-900">血檢趨勢對比</h4>
            </div>
            <ChevronRight size={16} className={`text-gray-400 transition-transform ${expandedSection === 'lab' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'lab' && (
            <div className="mt-3 space-y-2">
              {labComparisons!.filter(c => c.previous != null).map((comp, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-600">{comp.testName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">{comp.previous?.value}</span>
                    <span className="text-gray-300">→</span>
                    <span className={`text-xs font-medium ${
                      comp.improved ? 'text-green-600' : comp.improved === false ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {comp.current?.value} {comp.unit}
                    </span>
                    {comp.improved != null && (
                      <span className={`text-[10px] ${comp.improved ? 'text-green-500' : 'text-red-500'}`}>
                        {comp.improved ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {aiLoading['lab-comparison-summary'] && (
                <div className="flex items-center gap-2 py-3 text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">AI 分析中...</span>
                </div>
              )}
              {aiContent['lab-comparison-summary'] && (
                <div className="mt-2 p-3 bg-teal-50 rounded-xl text-xs text-teal-800 leading-relaxed whitespace-pre-wrap">
                  {aiContent['lab-comparison-summary']}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI 功能按鈕 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-900">AI 進階分析</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fetchAiContent('weekly-report')}
            disabled={aiLoading['weekly-report']}
            className="flex items-center gap-2 p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 hover:border-purple-200 transition-colors text-left"
          >
            {aiLoading['weekly-report'] ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <Activity size={14} className="text-purple-500" />}
            <span className="text-xs font-medium text-purple-700">AI 週報</span>
          </button>
          <button
            onClick={() => fetchAiContent('meal-suggestion', `&training=${isTrainingDay ? '1' : '0'}`)}
            disabled={aiLoading['meal-suggestion']}
            className="flex items-center gap-2 p-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors text-left"
          >
            {aiLoading['meal-suggestion'] ? <Loader2 size={14} className="animate-spin text-orange-400" /> : <Utensils size={14} className="text-orange-500" />}
            <span className="text-xs font-medium text-orange-700">菜單建議</span>
          </button>
        </div>

        {/* AI 生成的內容顯示 */}
        {aiContent['weekly-report'] && (
          <div className="mt-3 p-3 bg-purple-50 rounded-xl text-xs text-purple-900 leading-relaxed whitespace-pre-wrap border border-purple-100">
            {aiContent['weekly-report']}
          </div>
        )}
        {aiContent['meal-suggestion'] && (
          <div className="mt-3 p-3 bg-orange-50 rounded-xl text-xs text-orange-900 leading-relaxed whitespace-pre-wrap border border-orange-100">
            {aiContent['meal-suggestion']}
          </div>
        )}
      </div>
    </div>
  )
}
