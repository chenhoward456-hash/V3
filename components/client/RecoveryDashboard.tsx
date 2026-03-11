'use client'

import { useState, useEffect } from 'react'

/**
 * RecoveryDashboard — 恢復評估儀表板
 *
 * 呈現 recovery-engine 的完整分析結果：
 * - 綜合恢復分數 + 狀態
 * - 五大系統分解（神經/肌肉/代謝/荷爾蒙/心理）
 * - 過度訓練風險（ACWR）
 * - 自律神經平衡
 * - 恢復軌跡趨勢
 * - 個人化建議
 */

interface SystemRecovery {
  score: number
  state: 'optimal' | 'good' | 'struggling' | 'critical'
  signals: string[]
}

interface OvertrainingRisk {
  acwr: number | null
  monotony: number | null
  strain: number | null
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high'
  reasons: string[]
}

interface AutonomicBalance {
  status: 'parasympathetic_dominant' | 'balanced' | 'sympathetic_dominant' | 'unknown'
  hrvTrend: 'rising' | 'stable' | 'declining' | 'unknown'
  rhrTrend: 'rising' | 'stable' | 'declining' | 'unknown'
  hrvZScore: number | null
  rhrZScore: number | null
  reasons: string[]
}

interface RecoveryRecommendation {
  priority: 'high' | 'medium' | 'low'
  category: 'sleep' | 'nutrition' | 'training' | 'stress' | 'medical'
  message: string
}

interface RecoveryAssessmentData {
  score: number
  state: 'optimal' | 'good' | 'struggling' | 'critical'
  readinessScore: number | null
  systems: {
    neural: SystemRecovery
    muscular: SystemRecovery
    metabolic: SystemRecovery
    hormonal: SystemRecovery
    psychological: SystemRecovery
  }
  overtrainingRisk: OvertrainingRisk
  autonomicBalance: AutonomicBalance
  trajectory: 'improving' | 'stable' | 'declining' | 'unknown'
  recommendations: RecoveryRecommendation[]
  reasons: string[]
}

interface RecoveryDashboardProps {
  clientId: string
}

// ── 常數映射 ──

const stateConfig = {
  optimal: { label: '最佳狀態', color: 'text-green-600', bg: 'bg-green-500', ring: 'ring-green-200' },
  good: { label: '狀態良好', color: 'text-blue-600', bg: 'bg-blue-500', ring: 'ring-blue-200' },
  struggling: { label: '需要恢復', color: 'text-amber-600', bg: 'bg-amber-500', ring: 'ring-amber-200' },
  critical: { label: '嚴重疲勞', color: 'text-red-600', bg: 'bg-red-500', ring: 'ring-red-200' },
}

const systemLabels: Record<string, { icon: string; name: string }> = {
  neural: { icon: '🧠', name: '神經系統' },
  muscular: { icon: '💪', name: '肌肉骨骼' },
  metabolic: { icon: '🔥', name: '代謝狀態' },
  hormonal: { icon: '🧬', name: '荷爾蒙' },
  psychological: { icon: '🧘', name: '心理狀態' },
}

const riskLevelConfig = {
  low: { label: '低風險', color: 'text-green-600', bg: 'bg-green-50' },
  moderate: { label: '中等風險', color: 'text-amber-600', bg: 'bg-amber-50' },
  high: { label: '高風險', color: 'text-red-500', bg: 'bg-red-50' },
  very_high: { label: '極高風險', color: 'text-red-700', bg: 'bg-red-100' },
}

const ansLabels = {
  parasympathetic_dominant: { label: '副交感主導', icon: '😌', color: 'text-green-600' },
  balanced: { label: '平衡', icon: '⚖️', color: 'text-blue-600' },
  sympathetic_dominant: { label: '交感主導', icon: '⚡', color: 'text-amber-600' },
  unknown: { label: '數據不足', icon: '❓', color: 'text-gray-400' },
}

const trajectoryLabels = {
  improving: { label: '改善中', icon: '📈', color: 'text-green-600' },
  stable: { label: '穩定', icon: '➡️', color: 'text-blue-600' },
  declining: { label: '下滑中', icon: '📉', color: 'text-red-500' },
  unknown: { label: '數據不足', icon: '❓', color: 'text-gray-400' },
}

const categoryIcons: Record<string, string> = {
  sleep: '😴',
  nutrition: '🍎',
  training: '🏋️',
  stress: '🧘',
  medical: '🏥',
}

function SystemBar({ name, icon, system }: { name: string; icon: string; system: SystemRecovery }) {
  const config = stateConfig[system.state]
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center shrink-0">{icon}</span>
      <span className="text-xs text-gray-600 w-16 shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.bg}`}
          style={{ width: `${system.score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${config.color}`}>{system.score}</span>
    </div>
  )
}

export default function RecoveryDashboard({ clientId }: RecoveryDashboardProps) {
  const [data, setData] = useState<RecoveryAssessmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/recovery-assessment?clientId=${clientId}`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (error || !data) return null

  const config = stateConfig[data.state]
  const risk = riskLevelConfig[data.overtrainingRisk.riskLevel]
  const ans = ansLabels[data.autonomicBalance.status]
  const traj = trajectoryLabels[data.trajectory]

  // 只顯示 high/medium priority 的建議
  const topRecommendations = data.recommendations
    .filter(r => r.priority === 'high' || r.priority === 'medium')
    .slice(0, 3)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* 頂部：綜合分數 */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500">🔬 恢復評估</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.color} ${config.ring} ring-1`}>
            {config.label}
          </span>
        </div>

        {/* 分數圓環 + 三個快速指標 */}
        <div className="flex items-center gap-4">
          {/* 大圓環分數 */}
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={data.score >= 75 ? '#22c55e' : data.score >= 50 ? '#3b82f6' : data.score >= 30 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(data.score / 100) * 213.6} 213.6`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-gray-900">{data.score}</span>
              <span className="text-[9px] text-gray-400">/ 100</span>
            </div>
          </div>

          {/* 快速指標 */}
          <div className="flex-1 grid grid-cols-1 gap-1.5">
            {/* 軌跡 */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{traj.icon}</span>
              <span className="text-xs text-gray-500">趨勢</span>
              <span className={`text-xs font-semibold ml-auto ${traj.color}`}>{traj.label}</span>
            </div>
            {/* 自律神經 */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{ans.icon}</span>
              <span className="text-xs text-gray-500">自律神經</span>
              <span className={`text-xs font-semibold ml-auto ${ans.color}`}>{ans.label}</span>
            </div>
            {/* 過訓風險 */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🚦</span>
              <span className="text-xs text-gray-500">過訓風險</span>
              <span className={`text-xs font-semibold ml-auto ${risk.color}`}>{risk.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 五大系統條形圖 */}
      <div className="px-4 pb-3 space-y-1.5">
        {Object.entries(data.systems).map(([key, system]) => {
          const info = systemLabels[key]
          return <SystemBar key={key} name={info.name} icon={info.icon} system={system} />
        })}
      </div>

      {/* 建議（如果有的話） */}
      {topRecommendations.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            {topRecommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-xs mt-0.5">{categoryIcons[rec.category] || '💡'}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{rec.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 展開/收合 — ACWR 詳細數據 */}
      {(data.overtrainingRisk.acwr !== null || data.autonomicBalance.hrvZScore !== null) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1 border-t border-gray-50"
          >
            {expanded ? '收合詳細數據' : '查看詳細數據'}
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
              {/* ACWR 區塊 */}
              {data.overtrainingRisk.acwr !== null && (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1.5">急慢性負荷比 (ACWR)</p>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    {/* 安全區 0.8-1.3 綠色背景 */}
                    <div
                      className="absolute inset-y-0 bg-green-100 rounded-full"
                      style={{ left: `${(0.8 / 2) * 100}%`, width: `${((1.3 - 0.8) / 2) * 100}%` }}
                    />
                    {/* 當前值指標 */}
                    <div
                      className={`absolute top-0 w-2.5 h-3 rounded-full ${
                        data.overtrainingRisk.acwr >= 0.8 && data.overtrainingRisk.acwr <= 1.3
                          ? 'bg-green-500' : data.overtrainingRisk.acwr > 1.5
                          ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ left: `${Math.min((data.overtrainingRisk.acwr / 2) * 100, 98)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">0</span>
                    <span className="text-[10px] text-green-500">安全區 0.8–1.3</span>
                    <span className="text-[10px] text-gray-400">2.0</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    當前 ACWR: <span className="font-semibold">{data.overtrainingRisk.acwr.toFixed(2)}</span>
                    {data.overtrainingRisk.monotony !== null && (
                      <span className="text-gray-400 ml-2">
                        單調性: {data.overtrainingRisk.monotony.toFixed(1)}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* HRV/RHR z-score */}
              {(data.autonomicBalance.hrvZScore !== null || data.autonomicBalance.rhrZScore !== null) && (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1.5">相對基線 (z-score)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {data.autonomicBalance.hrvZScore !== null && (
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-blue-500">HRV</p>
                        <p className={`text-sm font-bold ${
                          data.autonomicBalance.hrvZScore >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {data.autonomicBalance.hrvZScore > 0 ? '+' : ''}{data.autonomicBalance.hrvZScore.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {data.autonomicBalance.hrvTrend === 'rising' ? '上升趨勢' :
                           data.autonomicBalance.hrvTrend === 'declining' ? '下降趨勢' :
                           data.autonomicBalance.hrvTrend === 'stable' ? '穩定' : '--'}
                        </p>
                      </div>
                    )}
                    {data.autonomicBalance.rhrZScore !== null && (
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-red-400">RHR</p>
                        <p className={`text-sm font-bold ${
                          data.autonomicBalance.rhrZScore <= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {data.autonomicBalance.rhrZScore > 0 ? '+' : ''}{data.autonomicBalance.rhrZScore.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {data.autonomicBalance.rhrTrend === 'rising' ? '上升趨勢' :
                           data.autonomicBalance.rhrTrend === 'declining' ? '下降趨勢' :
                           data.autonomicBalance.rhrTrend === 'stable' ? '穩定' : '--'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 判斷依據 */}
              {data.reasons.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1">判斷依據</p>
                  <div className="space-y-0.5">
                    {data.reasons.slice(0, 5).map((reason, i) => (
                      <p key={i} className="text-[11px] text-gray-400 leading-relaxed">
                        · {reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
