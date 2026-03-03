'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Users, Activity, Shield, Zap } from 'lucide-react'

interface PriorityAction {
  priority: 1 | 2 | 3
  action: string
  source: string
}

interface ClientReport {
  clientId: string
  clientName: string
  generatedAt: string
  summary: {
    currentWeight: number | null
    weeklyWeightChange: number | null
    weeklyWeightChangeRate: number | null
    nutritionCompliance: number
    supplementCompliance: number
    trainingDays: number
    avgEnergy: number | null
    avgMood: number | null
    avgSleep: number | null
  }
  insights: Array<{
    severity: string
    category: string
    title: string
    description: string
    action: string
  }>
  churnPrediction: {
    riskScore: number
    riskLevel: string
    riskFactors: string[]
    suggestedActions: string[]
    daysSinceLastActivity: number
    engagementTrend: string
  }
  prediction: {
    projections: Array<{
      week: number
      projectedWeight: number
      projectedBodyFat: number | null
    }>
    onTrackForGoal: boolean | null
    estimatedGoalDate: string | null
    daysToGoal: number | null
    currentWeeklyRate: number | null
    safetyWarning: string | null
  } | null
  phaseRecommendation: {
    currentPhase: string
    suggestedPhase: string | null
    confidence: string
    reason: string
    details: string
    urgency: string
  }
  priorityActions: PriorityAction[]
  overallStatus: 'green' | 'yellow' | 'red'
}

interface CoachDigest {
  generatedAt: string
  totalClients: number
  activeClients: number
  redClients: Array<{ clientId: string; clientName: string; reasons: string[] }>
  yellowClients: Array<{ clientId: string; clientName: string; reasons: string[] }>
  greenCount: number
  churnRisk: Array<{ clientId: string; clientName: string; riskScore: number; riskLevel: string; topReason: string }>
  phaseChanges: Array<{ clientId: string; clientName: string; currentPhase: string; suggestedPhase: string; reason: string }>
  stats: {
    avgNutritionCompliance: number
    avgSupplementCompliance: number
    clientsLosingWeight: number
    clientsGainingWeight: number
    clientsStagnant: number
  }
}

const phaseLabels: Record<string, string> = {
  cut: '減脂期', bulk: '增肌期', peak_week: 'Peak Week', diet_break: 'Diet Break',
  reverse_diet: '逆向飲食', off_season: '非賽季', recovery: '賽後恢復', maintenance: '維持期',
}

const statusColors = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
}

const statusLabels = { green: '正常', yellow: '留意', red: '需關注' }

export default function WeeklyReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [digest, setDigest] = useState<CoachDigest | null>(null)
  const [reports, setReports] = useState<ClientReport[]>([])
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(res => { if (!res.ok) router.push('/admin/login'); else loadReports() })
      .catch(() => router.push('/admin/login'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadReports = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/weekly-report')
      if (res.ok) {
        const data = await res.json()
        setDigest(data.digest)
        setReports(data.reports || [])
      }
    } catch { /* silent */ } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">生成智慧週報中...</p>
        <p className="text-xs text-gray-400 mt-1">正在分析所有學員數據</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900">智慧週報</h1>
                <p className="text-xs text-gray-500">{digest?.generatedAt ? new Date(digest.generatedAt).toLocaleString('zh-TW') : ''}</p>
              </div>
            </div>
            <button onClick={loadReports} disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
              {generating ? '分析中...' : '重新生成'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ===== 全局儀表板 ===== */}
        {digest && (
          <>
            {/* 統計卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-blue-500" />
                  <span className="text-xs text-gray-500">活躍學員</span>
                </div>
                <p className="text-2xl font-bold">{digest.activeClients}<span className="text-sm font-normal text-gray-400">/{digest.totalClients}</span></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-green-500" />
                  <span className="text-xs text-gray-500">飲食合規率</span>
                </div>
                <p className={`text-2xl font-bold ${digest.stats.avgNutritionCompliance >= 70 ? 'text-green-600' : digest.stats.avgNutritionCompliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{digest.stats.avgNutritionCompliance}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-purple-500" />
                  <span className="text-xs text-gray-500">補品服從率</span>
                </div>
                <p className={`text-2xl font-bold ${digest.stats.avgSupplementCompliance >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{digest.stats.avgSupplementCompliance}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-orange-500" />
                  <span className="text-xs text-gray-500">體重趨勢</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 flex items-center gap-0.5"><TrendingDown size={12} />{digest.stats.clientsLosingWeight}</span>
                  <span className="text-gray-400 flex items-center gap-0.5"><Minus size={12} />{digest.stats.clientsStagnant}</span>
                  <span className="text-red-500 flex items-center gap-0.5"><TrendingUp size={12} />{digest.stats.clientsGainingWeight}</span>
                </div>
              </div>
            </div>

            {/* 紅燈學員 */}
            {digest.redClients.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> 需要立即關注（{digest.redClients.length} 位）
                </h3>
                <div className="space-y-2">
                  {digest.redClients.map(c => (
                    <Link key={c.clientId} href={`/admin/clients/${c.clientId}/overview`}
                      className="block bg-white rounded-lg p-3 hover:shadow-sm transition-shadow">
                      <div className="font-medium text-red-700 mb-1">{c.clientName}</div>
                      <ul className="space-y-0.5">
                        {c.reasons.slice(0, 3).map((r, i) => (
                          <li key={i} className="text-xs text-red-600">• {r}</li>
                        ))}
                      </ul>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 黃燈學員 */}
            {digest.yellowClients.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-yellow-800 mb-3">
                  需要留意（{digest.yellowClients.length} 位）
                </h3>
                <div className="space-y-2">
                  {digest.yellowClients.map(c => (
                    <Link key={c.clientId} href={`/admin/clients/${c.clientId}/overview`}
                      className="block bg-white rounded-lg p-3 hover:shadow-sm transition-shadow">
                      <div className="font-medium text-yellow-700 mb-1">{c.clientName}</div>
                      <ul className="space-y-0.5">
                        {c.reasons.slice(0, 2).map((r, i) => (
                          <li key={i} className="text-xs text-yellow-600">• {r}</li>
                        ))}
                      </ul>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 流失風險 */}
            {digest.churnRisk.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">流失風險預警</h3>
                <div className="space-y-2">
                  {digest.churnRisk.map(c => (
                    <div key={c.clientId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                      <Link href={`/admin/clients/${c.clientId}/overview`} className="text-sm font-medium text-gray-700 hover:text-blue-600">{c.clientName}</Link>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{c.topReason}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${c.riskLevel === 'critical' ? 'bg-red-100 text-red-700' : c.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {c.riskScore}分
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 階段建議 */}
            {digest.phaseChanges.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">階段切換建議</h3>
                <div className="space-y-2">
                  {digest.phaseChanges.map(c => (
                    <div key={c.clientId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50">
                      <Link href={`/admin/clients/${c.clientId}/overview`} className="text-sm font-medium text-blue-700 hover:underline">{c.clientName}</Link>
                      <div className="text-xs text-blue-600">
                        {phaseLabels[c.currentPhase] || c.currentPhase} → <span className="font-bold">{phaseLabels[c.suggestedPhase] || c.suggestedPhase}</span>
                        <span className="text-blue-400 ml-1">({c.reason})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 綠燈摘要 */}
            {digest.greenCount > 0 && (
              <p className="text-sm text-green-600 text-center">
                {digest.greenCount} 位學員一切正常
              </p>
            )}
          </>
        )}

        {/* ===== 個別學員週報 ===== */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">學員詳細報告</h2>
          {reports.sort((a, b) => {
            const order = { red: 0, yellow: 1, green: 2 }
            return order[a.overallStatus] - order[b.overallStatus]
          }).map(report => {
            const isExpanded = expandedClient === report.clientId
            return (
              <div key={report.clientId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* 摘要行 */}
                <button onClick={() => setExpandedClient(isExpanded ? null : report.clientId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${statusColors[report.overallStatus]}`}>
                      {statusLabels[report.overallStatus]}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{report.clientName}</span>
                    {report.summary.currentWeight && (
                      <span className="text-xs text-gray-500">
                        {report.summary.currentWeight}kg
                        {report.summary.weeklyWeightChange != null && (
                          <span className={report.summary.weeklyWeightChange < 0 ? 'text-green-600' : report.summary.weeklyWeightChange > 0 ? 'text-red-500' : ''}>
                            {' '}{report.summary.weeklyWeightChange > 0 ? '+' : ''}{report.summary.weeklyWeightChange}kg
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {report.priorityActions.length > 0 && (
                      <span className="text-xs text-gray-400">{report.priorityActions.length} 項行動</span>
                    )}
                    {report.churnPrediction.riskLevel !== 'low' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${report.churnPrediction.riskLevel === 'critical' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                        流失風險 {report.churnPrediction.riskScore}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* 展開詳情 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                    {/* 本週數據 */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">飲食合規</p>
                        <p className={`text-lg font-bold ${report.summary.nutritionCompliance >= 70 ? 'text-green-600' : report.summary.nutritionCompliance >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{report.summary.nutritionCompliance}%</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">補品服從</p>
                        <p className={`text-lg font-bold ${report.summary.supplementCompliance >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{report.summary.supplementCompliance}%</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">訓練天數</p>
                        <p className="text-lg font-bold text-gray-900">{report.summary.trainingDays}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">精力</p>
                        <p className="text-lg font-bold text-gray-900">{report.summary.avgEnergy?.toFixed(1) || '--'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">情緒</p>
                        <p className="text-lg font-bold text-gray-900">{report.summary.avgMood?.toFixed(1) || '--'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400">睡眠</p>
                        <p className="text-lg font-bold text-gray-900">{report.summary.avgSleep?.toFixed(1) || '--'}</p>
                      </div>
                    </div>

                    {/* 優先行動 */}
                    {report.priorityActions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">建議行動</h4>
                        <div className="space-y-1.5">
                          {report.priorityActions.map((a, i) => (
                            <div key={i} className={`px-3 py-2 rounded-lg text-xs ${a.priority === 1 ? 'bg-red-50 text-red-700' : a.priority === 2 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-600'}`}>
                              <span className="font-medium">[{a.source}]</span> {a.action}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 跨系統洞察 */}
                    {report.insights.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">跨系統分析</h4>
                        <div className="space-y-2">
                          {report.insights.map((insight, i) => (
                            <div key={i} className={`px-3 py-2 rounded-lg border ${insight.severity === 'critical' ? 'border-red-200 bg-red-50' : insight.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
                              <div className={`text-xs font-semibold mb-0.5 ${insight.severity === 'critical' ? 'text-red-700' : insight.severity === 'warning' ? 'text-yellow-700' : 'text-blue-700'}`}>{insight.title}</div>
                              <p className="text-xs text-gray-600 mb-1">{insight.description}</p>
                              <p className="text-xs font-medium text-gray-700">{insight.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 趨勢預測 */}
                    {report.prediction && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">趨勢預測</h4>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                            {report.prediction.projections.slice(0, 4).map(p => (
                              <div key={p.week}>
                                <p className="text-gray-400">{p.week} 週後</p>
                                <p className="font-bold text-gray-900">{p.projectedWeight}kg</p>
                                {p.projectedBodyFat && <p className="text-gray-400">{p.projectedBodyFat}%</p>}
                              </div>
                            ))}
                          </div>
                          {report.prediction.onTrackForGoal != null && (
                            <p className={`text-xs text-center ${report.prediction.onTrackForGoal ? 'text-green-600' : 'text-red-600'}`}>
                              {report.prediction.onTrackForGoal
                                ? `預計可在目標日前達標${report.prediction.estimatedGoalDate ? `（約 ${report.prediction.estimatedGoalDate}）` : ''}`
                                : `照目前速度無法在目標日前達標${report.prediction.estimatedGoalDate ? `，預估 ${report.prediction.estimatedGoalDate} 才能達到` : ''}`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 階段建議 */}
                    {report.phaseRecommendation.suggestedPhase && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-blue-700 mb-1">
                          階段建議：{phaseLabels[report.phaseRecommendation.currentPhase] || report.phaseRecommendation.currentPhase} → {phaseLabels[report.phaseRecommendation.suggestedPhase] || report.phaseRecommendation.suggestedPhase}
                        </div>
                        <p className="text-xs text-blue-600">{report.phaseRecommendation.details}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
