'use client'

import { useState, useEffect, useRef } from 'react'
import { getCycleState, type PeriodizedPlan } from '@/lib/periodization'

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
  // 近期感受（給 7 天趨勢迷你圖用）；每筆取 sleep/energy/training_drive 平均
  recentWellness?: { date: string; sleep_quality?: number | null; energy_level?: number | null; training_drive?: number | null }[]
  // 課表（有 mesocycle 時判斷本週是否為排定減量週 → 判決卡加一行說明；沒有就什麼都不顯示）
  trainingPlan?: PeriodizedPlan | null
}

// ── 常數映射 ──

const stateConfig = {
  optimal: { label: '最佳狀態', color: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-200' },
  good: { label: '狀態良好', color: 'text-blue-600', bg: 'bg-blue-500', ring: 'ring-blue-200' },
  struggling: { label: '需要恢復', color: 'text-amber-700', bg: 'bg-amber-500', ring: 'ring-amber-200' },
  critical: { label: '嚴重疲勞', color: 'text-rose-600', bg: 'bg-rose-500', ring: 'ring-rose-200' },
}

const systemLabels: Record<string, { name: string }> = {
  neural: { name: '神經系統' },
  muscular: { name: '肌肉骨骼' },
  metabolic: { name: '代謝狀態' },
  hormonal: { name: '荷爾蒙' },
  psychological: { name: '心理狀態' },
}

const riskLevelConfig = {
  low: { label: '低風險', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  moderate: { label: '中等風險', color: 'text-amber-700', bg: 'bg-amber-50' },
  high: { label: '高風險', color: 'text-rose-600', bg: 'bg-rose-50' },
  very_high: { label: '極高風險', color: 'text-rose-700', bg: 'bg-rose-100' },
}

const ansLabels = {
  parasympathetic_dominant: { label: '副交感主導', color: 'text-emerald-600' },
  balanced: { label: '平衡', color: 'text-blue-600' },
  sympathetic_dominant: { label: '交感主導', color: 'text-amber-700' },
  // 沒 HRV 就沒得算 → 講清楚是「缺穿戴數據」而非功能被拿掉（學員會誤以為刪掉了）
  unknown: { label: '需手錶 HRV', color: 'text-gray-400' },
}

const trajectoryLabels = {
  improving: { label: '改善中', color: 'text-emerald-600' },
  stable: { label: '穩定', color: 'text-blue-600' },
  declining: { label: '下滑中', color: 'text-rose-600' },
  unknown: { label: '數據不足', color: 'text-gray-400' },
}

function SystemBar({ name, system }: { name: string; system: SystemRecovery }) {
  const config = stateConfig[system.state]
  return (
    <div className="flex items-center gap-2">
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

export default function RecoveryDashboard({ clientId, recentWellness, trainingPlan }: RecoveryDashboardProps) {
  const [data, setData] = useState<RecoveryAssessmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  // 進入視口才打 /api/recovery-assessment（mount 時不預先 fetch，省首屏請求）
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setInView(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!clientId || !inView) return
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
  }, [clientId, inView])

  if (loading) {
    return (
      <div ref={containerRef} className="bg-white rounded-2xl p-4 animate-pulse">
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

  // ── 一句話判決：恢復端最該回答的「今天該怎麼練」（紅綠燈）+ 具體訓練處方 ──
  const verdict = data.score >= 75
    ? { dot: 'bg-emerald-500', box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-900', headline: '恢復好 → 照表全力練', trainRx: '可挑戰 PR、加重量；今天身體準備好了' }
    : data.score >= 50
    ? { dot: 'bg-amber-500', box: 'bg-amber-50 border-amber-200', text: 'text-amber-900', headline: '恢復普通 → 照練但別逞強', trainRx: '主項照常、先別追 PR；輔助組數收一點' }
    : data.score >= 30
    ? { dot: 'bg-amber-600', box: 'bg-amber-100 border-amber-300', text: 'text-amber-900', headline: '恢復偏低 → 今天降量', trainRx: '主項降到 7-8 成重量、每項少 1-2 組' }
    : { dot: 'bg-rose-500', box: 'bg-rose-50 border-rose-200', text: 'text-rose-900', headline: '恢復差 → 今天別硬上', trainRx: '改輕鬆有氧／活動度，或直接休一天' }
  // 驅動原因：列出所有「在扣分」的系統(<65)的主因，最多兩條 → 讓綜合分數一眼說得通，
  // 不只給一條最低的(會漏掉同樣在拉低分數的另一個系統，分數看起來莫名)。恢復好(綠)就不囉嗦。
  const driverLine = data.score < 75
    ? (Object.values(data.systems)
        .filter(s => s.score < 65)
        .sort((a, b) => a.score - b.score)
        .map(s => s.signals?.[0])
        .filter((s): s is string => !!s)
        .slice(0, 2)
        .join('；') || null)
    : null

  // 排定減量週？（純日曆判定；沒 mesocycle → null → 不顯示）
  const isScheduledDeloadWeek = getCycleState(trainingPlan)?.isDeloadWeek === true

  // ── 7 天感受趨勢迷你圖：每天 (睡眠+精力+想練)/可得項 平均，看方向 ──
  const trend7 = (recentWellness ?? [])
    .filter(w => w.sleep_quality != null || w.energy_level != null || w.training_drive != null)
    .slice(-7)
    .map(w => {
      const vals = [w.sleep_quality, w.energy_level, w.training_drive].filter((v): v is number => v != null)
      return { date: w.date, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }
    })
  const trendDir = trend7.length >= 4
    ? (trend7.slice(-3).reduce((a, b) => a + b.avg, 0) / 3) - (trend7.slice(0, 3).reduce((a, b) => a + b.avg, 0) / 3)
    : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* 頂部：綜合分數 */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold text-gray-900">今天的恢復</p>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${config.color} ${config.ring} ring-1`}>
            {config.label}
          </span>
        </div>

        {/* 一句話判決 — 恢復端最該回答的「今天該怎麼練」+ 具體訓練處方 */}
        <div className={`px-3 py-2.5 rounded-xl border ${verdict.box} mb-3`}>
          <div className="flex items-start gap-2.5">
            <span className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${verdict.dot}`} />
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-snug ${verdict.text}`}>{verdict.headline}</p>
              {isScheduledDeloadWeek && (
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">本週為減量週，課表已調整</p>
              )}
              <p className="text-xs text-gray-600 mt-0.5 leading-snug">{verdict.trainRx}</p>
              {driverLine && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">主要因為：{driverLine}</p>}
            </div>
          </div>
          {/* 7 天感受趨勢迷你圖 */}
          {trend7.length >= 3 && (
            <div className="flex items-end gap-1 mt-2.5 pt-2.5 border-t border-black/5">
              <span className="text-[11px] text-gray-400 mr-1 self-center">近 7 天</span>
              {trend7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: 24 }} title={`${d.date.slice(5)}：${d.avg.toFixed(1)}/5`}>
                  <div className={`w-full rounded-sm ${d.avg >= 4 ? 'bg-emerald-400' : d.avg >= 3 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ height: `${Math.max(10, (d.avg / 5) * 100)}%` }} />
                </div>
              ))}
              <span className={`text-[11px] ml-1 self-center font-medium ${trendDir > 0.3 ? 'text-emerald-600' : trendDir < -0.3 ? 'text-rose-600' : 'text-gray-400'}`}>
                {trendDir > 0.3 ? '↗ 回升' : trendDir < -0.3 ? '↘ 下降' : '→ 持平'}
              </span>
            </div>
          )}
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
              <span className="text-[11px] text-gray-400">/ 100</span>
              <span className="text-[11px] text-gray-400">系統綜合評估</span>
            </div>
          </div>

          {/* 快速指標 */}
          <div className="flex-1 grid grid-cols-1 gap-1.5">
            {/* 軌跡 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">趨勢</span>
              <span className={`text-xs font-semibold ml-auto ${traj.color}`}>{traj.label}</span>
            </div>
            {/* 自律神經 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">自律神經</span>
              <span className={`text-xs font-semibold ml-auto ${ans.color}`}>{ans.label}</span>
            </div>
            {/* 過訓風險 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">過訓風險</span>
              <span className={`text-xs font-semibold ml-auto ${risk.color}`}>{risk.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 建議（如果有的話） */}
      {topRecommendations.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            {topRecommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-gray-400 text-xs mt-0.5">·</span>
                <p className="text-xs text-gray-600 leading-relaxed">{rec.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 展開/收合 — 五大系統 + ACWR 等詳細（想鑽的人才打開，預設只看上面那句判決）*/}
      <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1 border-t border-gray-50"
          >
            {expanded ? '收合詳細分析' : '查看詳細分析（五大系統 / 負荷）'}
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
              {/* 五大系統條形圖（搬到詳細區，預設不洗版）*/}
              <div className="space-y-1.5">
                {Object.entries(data.systems).map(([key, system]) => {
                  const info = systemLabels[key]
                  return <SystemBar key={key} name={info.name} system={system} />
                })}
              </div>
              {/* ACWR 區塊 */}
              {data.overtrainingRisk.acwr !== null && (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1.5">急慢性負荷比 (ACWR)</p>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    {/* 安全區 0.8-1.3 綠色背景 */}
                    <div
                      className="absolute inset-y-0 bg-emerald-100 rounded-full"
                      style={{ left: `${(0.8 / 2) * 100}%`, width: `${((1.3 - 0.8) / 2) * 100}%` }}
                    />
                    {/* 當前值指標 */}
                    <div
                      className={`absolute top-0 w-2.5 h-3 rounded-full ${
                        data.overtrainingRisk.acwr >= 0.8 && data.overtrainingRisk.acwr <= 1.3
                          ? 'bg-emerald-500' : data.overtrainingRisk.acwr > 1.5
                          ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ left: `${Math.min((data.overtrainingRisk.acwr / 2) * 100, 98)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-gray-400">0</span>
                    <span className="text-[11px] text-emerald-600">安全區 0.8–1.3</span>
                    <span className="text-[11px] text-gray-400">2.0</span>
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
                        <p className="text-[11px] text-blue-500">HRV</p>
                        <p className={`text-sm font-bold ${
                          data.autonomicBalance.hrvZScore >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {data.autonomicBalance.hrvZScore > 0 ? '+' : ''}{data.autonomicBalance.hrvZScore.toFixed(1)}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {data.autonomicBalance.hrvTrend === 'rising' ? '上升趨勢' :
                           data.autonomicBalance.hrvTrend === 'declining' ? '下降趨勢' :
                           data.autonomicBalance.hrvTrend === 'stable' ? '穩定' : '--'}
                        </p>
                      </div>
                    )}
                    {data.autonomicBalance.rhrZScore !== null && (
                      <div className="bg-rose-50 rounded-lg p-2 text-center">
                        <p className="text-[11px] text-rose-400">RHR</p>
                        <p className={`text-sm font-bold ${
                          data.autonomicBalance.rhrZScore <= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {data.autonomicBalance.rhrZScore > 0 ? '+' : ''}{data.autonomicBalance.rhrZScore.toFixed(1)}
                        </p>
                        <p className="text-[11px] text-gray-400">
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
    </div>
  )
}
