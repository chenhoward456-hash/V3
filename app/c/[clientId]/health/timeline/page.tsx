'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useClientData } from '@/hooks/useClientData'
import {
  calculateLabStatus,
  isInOptimalRange,
  getOptimalRangeText,
  getStatusColor,
  getStatusIcon,
  LAB_THRESHOLDS,
} from '@/utils/labStatus'
import { MODE_LABELS, MODE_EMOJIS, MODE_DESCRIPTIONS, type ClientMode } from '@/lib/client-mode'
import { calculateHealthScore } from '@/lib/health-score-engine'

interface LabPoint {
  date: string
  value: number
  coach_interpretation?: string | null
}

interface LabRow {
  test_name: string
  value: number
  unit: string | null
  date: string
  status?: string
  coach_interpretation?: string | null
}

// ── 進階追蹤分類（依生理系統分組）──
// 每組標題 + 該組要顯示的指標清單（順序就是顯示順序）
const CATEGORIES: Array<{ title: string; subtitle: string; tests: string[] }> = [
  {
    title: '代謝健康',
    subtitle: '胰島素敏感度 / 血糖控制 — 慢性病的最早預警',
    tests: ['HOMA-IR', '空腹胰島素', '空腹血糖', 'HbA1c', '尿酸'],
  },
  {
    title: '心血管風險',
    subtitle: '心血管真實風險指標 — ApoB 比 LDL-C 更精準',
    tests: ['ApoB', 'Lp(a)', 'LDL-C', 'HDL-C', '三酸甘油酯', '總膽固醇'],
  },
  {
    title: '系統性發炎',
    subtitle: '所有慢性病的共通底層 — hsCRP 越低越好',
    tests: ['hs-CRP', 'CRP', '同半胱胺酸'],
  },
  {
    title: '肝腎功能',
    subtitle: '解毒 / 代謝 / 補品安全性的底線',
    tests: ['AST', 'ALT', 'GGT', 'ALP', '總膽紅素', '白蛋白', 'eGFR', 'BUN', '肌酸酐', '尿微量白蛋白ACR'],
  },
  {
    title: '電解質',
    subtitle: '水分 / 神經肌肉傳導 — 備賽控水期會失真，看數值前先確認水分狀態',
    tests: ['鈉', '鉀', '氯'],
  },
  {
    title: '甲狀腺 / 荷爾蒙',
    subtitle: '能量 / 恢復 / 性慾 / 肌肉合成的源頭',
    tests: ['TSH', 'Free T4', 'Free T3', '睪固酮', '游離睪固酮', '生物可利用睪固酮', '皮質醇', 'DHEA-S', '雌二醇', 'SHBG'],
  },
  {
    title: '微量營養素',
    subtitle: '微量營養是補品策略的基礎',
    tests: ['維生素D', '維生素B12', '葉酸', '鎂', '鋅', '鈣', '鐵蛋白'],
  },
]

function StatusDot({ status }: { status: 'normal' | 'attention' | 'alert' }) {
  const color =
    status === 'normal' ? 'bg-emerald-500'
    : status === 'attention' ? 'bg-amber-500'
    : 'bg-rose-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
}

function TrendArrow({ change }: { change: number | null }) {
  if (change === null) return <Minus className="w-4 h-4 text-gray-400" />
  if (Math.abs(change) < 1) return <Minus className="w-4 h-4 text-gray-400" />
  return change > 0
    ? <TrendingUp className="w-4 h-4 text-gray-600" />
    : <TrendingDown className="w-4 h-4 text-gray-600" />
}

function LabCard({
  testName,
  history,
  gender,
}: {
  testName: string
  history: LabPoint[]
  gender: '男性' | '女性' | undefined
}) {
  const hasData = history.length > 0
  const latest = hasData ? history[history.length - 1] : null
  const prev = history.length >= 2 ? history[history.length - 2] : null

  const status = latest
    ? calculateLabStatus(testName, latest.value, gender)
    : 'normal'
  const inOptimal = latest ? isInOptimalRange(testName, latest.value, gender) : false
  const optimalText = getOptimalRangeText(testName, gender)

  const changePercent =
    latest && prev && prev.value !== 0
      ? ((latest.value - prev.value) / prev.value) * 100
      : null

  // 越高越好的指標：上升是好事；其他：下降是好事
  // 這裡僅顯示方向，顏色由 status 決定，不重複編碼
  const sparkColor =
    status === 'normal' ? '#10b981'
    : status === 'attention' ? '#f59e0b'
    : '#f43f5e'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={status} />
          <div className="font-medium text-gray-900 truncate">{testName}</div>
        </div>
        {/* 「最佳」只在「狀態正常 + 該指標真的有定義最佳區間」時掛。
            isInOptimalRange() 對沒定義最佳區間的指標一律回 true（語意是「正常即可」），
            少了這兩個 gate 會讓黃燈的 ALP／沒設最佳值的 BUN 都掛綠色「最佳」標。 */}
        {inOptimal && hasData && status === 'normal' && optimalText && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            最佳
          </span>
        )}
        {!inOptimal && hasData && status === 'normal' && optimalText && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            可優化 ↑
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                {latest!.value}
              </span>
              <span className="text-xs text-gray-500">
                {/* unit 從 LabRow 取，這裡 history 簡化沒帶 unit；先省略 */}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendArrow change={changePercent} />
              {changePercent !== null && (
                <span>{changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
              )}
            </div>
          </div>

          <div className="h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ?? ''
                  }
                  formatter={(value) => [String(value), testName] as [string, string]}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>
              Howard 標準：
              <span className={`font-medium ${!inOptimal && status === 'normal' && optimalText ? 'text-slate-600' : 'text-gray-700'}`}>
                {optimalText ?? '—'}
              </span>
            </span>
            <span className="text-gray-400">{history.length} 筆</span>
          </div>

          {/* 教練解讀（單一指標）— 找最新一筆有 interpretation 的 */}
          {(() => {
            const latestInterp = [...history]
              .reverse()
              .find(p => p.coach_interpretation && p.coach_interpretation.trim().length > 0)
            if (!latestInterp) return null
            return (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-medium text-emerald-700 mb-1">
                  💬 Howard 觀察
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {latestInterp.coach_interpretation}
                </p>
              </div>
            )
          })()}
        </>
      ) : (
        <div className="text-xs text-gray-400 py-6 text-center">
          <div className="text-2xl mb-1 opacity-40">—</div>
          尚無數據
        </div>
      )}
    </div>
  )
}

interface PanelNote {
  panel_date: string
  summary?: string | null
  priorities?: string | null
  next_review_date?: string | null
}

interface FindingBrief {
  testName: string
  severity: 'critical' | 'attention' | 'watch' | 'improving' | 'optimal'
  trend: 'improving' | 'declining' | 'stable' | 'unknown'
  latestValue: number
  changePercent: number | null
  optimalText: string | null
}

interface FindingsData {
  findings: FindingBrief[]
  counts: { critical: number; attention: number; watch: number; improving: number; optimal: number }
}

interface SupplementHistoryItem {
  id: string
  name: string
  dosage: string
  timing: string
  why: string | null
  started_at: string | null
  archived_at: string | null
  archive_reason: string | null
  replaced_by_id: string | null
  coach_rationale: string | null
  mode_context: string | null
}

export default function HealthTimelinePage() {
  const params = useParams()
  const clientId = (params?.clientId as string) ?? ''
  const { data, isLoading, error } = useClientData(clientId)

  const [panelNotes, setPanelNotes] = useState<PanelNote[]>([])
  const [findingsData, setFindingsData] = useState<FindingsData | null>(null)
  const [showFindingsDetail, setShowFindingsDetail] = useState(false)
  const [activeSupps, setActiveSupps] = useState<SupplementHistoryItem[]>([])
  const [archivedSupps, setArchivedSupps] = useState<SupplementHistoryItem[]>([])
  const [showArchivedSupps, setShowArchivedSupps] = useState(false)
  const [pendingDraftStatus, setPendingDraftStatus] = useState<{ pendingCount: number; panelDates: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!clientId) return
      try {
        const [notesRes, findingsRes, suppsRes] = await Promise.all([
          fetch(`/api/lab-panel-notes?clientId=${encodeURIComponent(clientId)}`),
          fetch(`/api/lab-findings?clientId=${encodeURIComponent(clientId)}`),
          fetch(`/api/supplements/history?clientId=${encodeURIComponent(clientId)}`),
        ])
        const notesJson = await notesRes.json()
        const findingsJson = await findingsRes.json()
        const suppsJson = await suppsRes.json()
        if (cancelled) return
        if (notesJson?.success && Array.isArray(notesJson.data)) {
          setPanelNotes(notesJson.data as PanelNote[])
        }
        if (findingsJson?.success && findingsJson.data) {
          setFindingsData(findingsJson.data as FindingsData)
        }
        if (suppsJson?.success && suppsJson.data) {
          setActiveSupps((suppsJson.data.active || []) as SupplementHistoryItem[])
          setArchivedSupps((suppsJson.data.archived || []) as SupplementHistoryItem[])
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => { cancelled = true }
  }, [clientId])

  // 輪詢 AI 草稿生成 / 待教練審狀態
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/auto-draft-status?clientId=${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (cancelled) return
        if (json?.success && json.data) {
          setPendingDraftStatus({
            pendingCount: json.data.pendingCount ?? 0,
            panelDates: json.data.panelDates ?? [],
          })
        }
      } catch { /* ignore */ }
    }

    fetchStatus()
    intervalId = setInterval(fetchStatus, 15_000)  // 15 秒輪一次
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [clientId])

  const client = data?.client
  const labs = useMemo<LabRow[]>(
    () => (client?.lab_results ?? []) as LabRow[],
    [client?.lab_results]
  )
  const gender = (client?.gender === '男性' || client?.gender === '女性')
    ? client.gender
    : undefined

  // 健康總分（用近 7 天 wellness / nutrition / training + lab）
  const healthScore = useMemo(() => {
    if (!data) return null
    try {
      const wellness = (data.wellness || []) as Array<{
        sleep_quality: number | null; energy_level: number | null; mood: number | null
        cognitive_clarity?: number | null; stress_level?: number | null
        wearable_sleep_score?: number | null; device_recovery_score?: number | null
        hrv?: number | null; resting_hr?: number | null
      }>
      const nutrition = (data.nutritionLogs || []) as Array<{ compliant: boolean | null }>
      const training = (data.trainingLogs || []) as Array<{ training_type: string; rpe?: number | null }>
      const recentLogs = (data.recentLogs || []) as Array<{ taken?: boolean; completed?: boolean }>
      // 簡單估算近 7 天補品打卡率（compat: taken 或 completed 都吃）
      const recent7 = recentLogs.slice(-50)
      const supplementRate = recent7.length > 0
        ? recent7.filter(l => l.taken === true || l.completed === true).length / recent7.length
        : 0.8 // 預設 80% 避免完全沒打卡時拖低分數
      return calculateHealthScore({
        wellnessLast7: wellness.slice(-7),
        nutritionLast7: nutrition.slice(-7),
        trainingLast7: training.slice(-7),
        supplementComplianceRate: supplementRate,
        labResults: labs.map(l => ({ status: (l.status as 'normal' | 'attention' | 'alert') ?? 'normal' })),
        quarterlyStart: (client?.quarterly_cycle_start as string) ?? null,
      })
    } catch (err) {
      console.warn('[timeline] health score calc failed:', err)
      return null
    }
  }, [data, labs, client?.quarterly_cycle_start])

  // 將所有 lab_results 依 test_name 分組成歷史時間序列
  const byTest = useMemo(() => {
    const map = new Map<string, LabPoint[]>()
    for (const r of labs) {
      if (!r.test_name || typeof r.value !== 'number') continue
      const arr = map.get(r.test_name) || []
      arr.push({
        date: r.date,
        value: Number(r.value),
        coach_interpretation: r.coach_interpretation ?? null,
      })
      map.set(r.test_name, arr)
    }
    // 每組依日期升序
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    return map
  }, [labs])

  // 整體摘要
  const summary = useMemo(() => {
    let total = 0, normal = 0, attention = 0, alert = 0, optimal = 0
    for (const [testName, history] of byTest) {
      if (history.length === 0) continue
      const latest = history[history.length - 1]
      if (!(testName in LAB_THRESHOLDS) && !(`${testName}_female` in LAB_THRESHOLDS)) continue
      const s = calculateLabStatus(testName, latest.value, gender)
      total++
      if (s === 'normal') normal++
      else if (s === 'attention') attention++
      else alert++
      if (isInOptimalRange(testName, latest.value, gender)) optimal++
    }
    return { total, normal, attention, alert, optimal }
  }, [byTest, gender])

  // 最新血檢日期（用於頁首顯示）
  const latestDate = useMemo(() => {
    let d = 0
    for (const r of labs) {
      const t = new Date(r.date).getTime()
      if (t > d) d = t
    }
    return d ? new Date(d).toLocaleDateString('zh-TW') : null
  }, [labs])

  // 不同 panel_date 數量（決定是否有「趨勢」可看）
  const uniquePanelDateCount = useMemo(() => {
    const set = new Set<string>()
    for (const r of labs) {
      if (r.date) set.add(r.date)
    }
    return set.size
  }, [labs])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header skeleton */}
        <div className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-5xl mx-auto animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-64"></div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="h-3 bg-gray-100 rounded w-16 mb-2"></div>
                <div className="h-7 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
          {/* 2 category section skeletons */}
          {[...Array(2)].map((_, i) => (
            <div key={i} className="mb-8">
              <div className="h-5 bg-gray-200 rounded w-32 mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-48 mb-3"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                    <div className="h-8 bg-gray-100 rounded w-16 mb-3"></div>
                    <div className="h-10 bg-gray-100 rounded mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-24"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-rose-600">無法載入資料</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/c/${clientId}`}
              className="text-gray-500 hover:text-gray-700"
              aria-label="返回"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">健康趨勢儀表板</h1>
            {client?.client_mode && (MODE_LABELS as Record<string, string>)[client.client_mode] && (
              <span
                className="ml-2 inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                title={(MODE_DESCRIPTIONS as Record<string, string>)[client.client_mode]}
              >
                {(MODE_EMOJIS as Record<string, string>)[client.client_mode]} {(MODE_LABELS as Record<string, string>)[client.client_mode]}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 ml-7">
            進階最佳化標準 · 連續追蹤 · 不只是一年一次的健檢
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 抽血將近時的「建議抽血項目」提示 — 排程倒數細節統一放在下方「下次抽血規劃」 */}
        {(() => {
          const nextDate = client?.next_checkup_date
          if (!nextDate) return null
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const next = new Date(nextDate); next.setHours(0, 0, 0, 0)
          const days = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (days < 0 || days > 14) return null  // 只在抽血將近（14 天內）時提示建議項目
          return (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-amber-800 leading-relaxed">
                  🩸 抽血將近 — 建議抽血項目：T / Free T / E2 / SHBG / Cortisol / TSH / hs-CRP / 鐵蛋白 / ALT
                </div>
                <Link
                  href={`/c/${clientId}/health/upload`}
                  className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                >
                  上傳結果 →
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Health Score（整體健康分數）*/}
        {healthScore && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="text-xs font-medium text-slate-600 mb-0.5">整體健康分數</div>
                <div className="text-[11px] text-gray-500">睡眠 + 營養 + 訓練 + 補品 + 血檢 加權</div>
              </div>
              <div className="text-right">
                <div className="text-4xl sm:text-5xl font-bold text-gray-900 leading-none tabular-nums">
                  {Math.round(healthScore.total)}
                  <span className="text-base font-medium text-gray-400 ml-1">/100</span>
                </div>
                <div className={`text-xs font-medium mt-0.5 ${
                  healthScore.grade === 'A' ? 'text-emerald-700' :
                  healthScore.grade === 'B' ? 'text-blue-700' :
                  healthScore.grade === 'C' ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  Grade {healthScore.grade}
                </div>
              </div>
            </div>
            {/* Pillar 細項 */}
            <div className="grid grid-cols-5 gap-1.5">
              {healthScore.pillars.map(p => (
                <div key={p.pillar} className="text-center bg-white rounded-lg p-2 border border-slate-200">
                  <div className="text-base sm:text-lg">{p.emoji}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{p.label}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${
                    p.score >= 80 ? 'text-emerald-700' :
                    p.score >= 65 ? 'text-blue-700' :
                    p.score >= 50 ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {Math.round(p.score)}
                  </div>
                </div>
              ))}
            </div>
            {/* 血檢加減分提示 */}
            {(healthScore.labPenalty !== 0 || healthScore.labBonus > 0) && (
              <div className="mt-2 text-[11px] text-gray-600">
                血檢調整：
                {healthScore.labBonus > 0 && <span className="text-emerald-700 ml-1">+{healthScore.labBonus.toFixed(1)}</span>}
                {healthScore.labPenalty !== 0 && <span className="text-rose-700 ml-1">{healthScore.labPenalty.toFixed(1)}</span>}
              </div>
            )}
          </div>
        )}

        {/* 摘要列 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-gray-500">追蹤項目</div>
            <div className="text-xl font-semibold text-gray-900 tabular-nums">{summary.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-emerald-600">正常</div>
            <div className="text-xl font-semibold text-emerald-700 tabular-nums">{summary.normal}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-amber-600">注意</div>
            <div className="text-xl font-semibold text-amber-700 tabular-nums">{summary.attention}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-rose-600">警示</div>
            <div className="text-xl font-semibold text-rose-700 tabular-nums">{summary.alert}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 col-span-2 md:col-span-1">
            <div className="text-xs text-emerald-700">已達最佳</div>
            <div className="text-xl font-semibold text-emerald-800 tabular-nums">
              {summary.optimal}
              <span className="text-xs font-normal text-emerald-700 ml-1">/ {summary.total}</span>
            </div>
          </div>
        </div>

        {latestDate && (
          <div className="text-xs text-gray-500 mb-4">
            最近一次血檢：{latestDate}
            {uniquePanelDateCount === 1 && (
              <span className="ml-2 text-blue-600">（僅 1 次紀錄）</span>
            )}
          </div>
        )}

        {/* 第一次上傳：解釋為什麼還看不到趨勢線 */}
        {uniquePanelDateCount === 1 && labs.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📈</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  你的趨勢線會在下次抽血後出現
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  每張 sparkline 卡目前只有 1 個點 — 那就是你剛上傳的數據。
                  <br />
                  系統的核心價值是「連續追蹤」 — <strong>下次抽血上傳後，每張卡就會出現曲線</strong>，
                  讓你看到 3 個月、6 個月、12 個月的進步軌跡。
                </p>
                <div className="mt-3 text-[11px] text-blue-700">
                  💡 建議追蹤節奏：每季 1 次（每 3 個月）。
                  {client?.next_checkup_date && (
                    <span className="ml-1">
                      你下次抽血預定：<strong>{client.next_checkup_date}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 趨勢警示 banner — 由趨勢引擎算出，避免 cherry-pick */}
        {findingsData && (findingsData.counts.critical > 0 || findingsData.counts.attention > 0) && (
          <section className="mb-6">
            <div className={`rounded-xl border p-4 ${
              findingsData.counts.critical > 0
                ? 'bg-rose-50 border-rose-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-sm font-semibold ${
                    findingsData.counts.critical > 0 ? 'text-rose-900' : 'text-amber-900'
                  }`}>
                    {findingsData.counts.critical > 0
                      ? `${findingsData.counts.critical} 個指標需要立即關注`
                      : `${findingsData.counts.attention} 個指標值得留意`}
                  </div>
                  <div className={`text-xs mt-1 ${
                    findingsData.counts.critical > 0 ? 'text-rose-700' : 'text-amber-700'
                  }`}>
                    系統自動偵測趨勢惡化 / 跨閾值劣化 / 偏離 Howard 最佳範圍
                  </div>
                </div>
                <button
                  onClick={() => setShowFindingsDetail(s => !s)}
                  className={`text-xs px-2 py-1 rounded hover:opacity-80 ${
                    findingsData.counts.critical > 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {showFindingsDetail ? '收合' : '展開'}
                </button>
              </div>

              {showFindingsDetail && (
                <div className="mt-3 space-y-1.5">
                  {findingsData.findings
                    .filter(f => f.severity === 'critical' || f.severity === 'attention')
                    .map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-white/70 rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className={f.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'}>
                            {f.severity === 'critical' ? '🚨' : '⚠️'}
                          </span>
                          <span className="font-medium text-gray-900">{f.testName}</span>
                          <span className="text-gray-600">
                            {f.latestValue}
                            {f.optimalText && (
                              <span className="text-gray-400"> · 最佳 {f.optimalText}</span>
                            )}
                          </span>
                        </div>
                        {f.changePercent !== null && (
                          <span className={`font-medium ${
                            f.trend === 'declining' ? 'text-rose-700' :
                            f.trend === 'improving' ? 'text-emerald-700' : 'text-gray-500'
                          }`}>
                            {f.changePercent > 0 ? '+' : ''}{f.changePercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 分類顯示 — 實際血檢數值（用戶最想看的，放最前面）*/}
        {CATEGORIES.map(cat => {
          const cards = cat.tests
            .map(testName => ({
              testName,
              history: byTest.get(testName) ?? [],
            }))
            .filter(c => c.history.length > 0)

          if (cards.length === 0) return null

          return (
            <section key={cat.title} className="mb-8">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">{cat.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{cat.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map(c => (
                  <LabCard
                    key={c.testName}
                    testName={c.testName}
                    history={c.history}
                    gender={gender}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* 沒有任何分類有資料時 — 富有引導感的空狀態 */}
        {summary.total === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🩸</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              還沒有血檢資料
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed max-w-md mx-auto">
              上傳一份健檢報告（PDF / 照片 / CSV / 手打皆可），系統會自動萃取數值、分類、做趨勢分析，並生成第一份觀察筆記。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6">
              <Link
                href={`/c/${clientId}/health/upload`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-5 py-2.5 rounded-lg"
              >
                📥 立刻上傳血檢
              </Link>
              <Link
                href={`/c/${clientId}/welcome`}
                className="text-sm text-gray-600 hover:text-emerald-700 underline px-3"
              >
                先看 2 分鐘導覽 →
              </Link>
            </div>
            <div className="inline-block text-left bg-white/70 rounded-lg p-3 text-xs text-gray-600">
              <div className="font-medium text-gray-700 mb-1">📋 沒抽過血怎麼辦？</div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>聯安、美兆、汎美等健檢中心做完整 panel</li>
                <li>或請家醫科 / 整合醫學醫師開檢驗單</li>
                <li>拿到報告拍照丟上來就行</li>
              </ol>
            </div>
          </div>
        )}

        {/* 🤖 AI 草稿生成 / 教練審核中 狀態 */}
        {pendingDraftStatus && pendingDraftStatus.pendingCount > 0 && (
          <section className="mb-6 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <span className="text-2xl">🤖</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-slate-400 rounded-full animate-pulse"></span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 mb-1">
                  AI 草稿生成完成，等待教練審核
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  你近期上傳的 <strong>{pendingDraftStatus.pendingCount} 份</strong>血檢已自動生成觀察筆記初稿。
                  Howard 審核 + 個人化調整後（通常 24 小時內），完整筆記會出現在下方「Howard 觀察筆記」區塊，
                  你會收到 LINE 通知。
                </p>
                <div className="mt-2 text-[11px] text-slate-500">
                  待審日期：
                  <span className="font-mono ml-1">{pendingDraftStatus.panelDates.join(', ')}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 教練筆記（Panel Notes）— Protocol 層核心交付 */}
        {panelNotes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Howard 的觀察筆記
            </h2>
            <p className="text-[11px] text-gray-500 mb-3">
              教練基於數據趨勢的生活方式建議，不構成醫療診斷或處方。指標異常請諮詢醫師。
            </p>
            <div className="space-y-3">
              {panelNotes
                .filter(n => n.summary || n.priorities)
                .slice(0, 3)
                .map(note => (
                  <div
                    key={note.panel_date}
                    className="bg-white border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-emerald-700">
                        {note.panel_date}
                      </div>
                      {note.next_review_date && (
                        <div className="text-xs text-gray-500">
                          下次追蹤：{note.next_review_date}
                        </div>
                      )}
                    </div>
                    {note.summary && (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {note.summary}
                      </p>
                    )}
                    {note.priorities && (
                      <div className="mt-3 pt-3 border-t border-emerald-100">
                        <div className="text-xs font-medium text-emerald-700 mb-1">
                          優先處理
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {note.priorities}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* 補品 Protocol 演進 — Longevity tier 核心交付（非血檢數據，預設收合）*/}
        {(activeSupps.length > 0 || archivedSupps.length > 0) && (
          <details className="mb-8">
            <summary className="cursor-pointer text-base font-semibold text-gray-900 mb-3 list-none [&::-webkit-details-marker]:hidden">
              💊 補品 Protocol 演進（展開）
            </summary>

            {/* Active */}
            {activeSupps.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                <div className="text-xs font-medium text-gray-700 mb-3">
                  目前在吃（{activeSupps.length} 項）
                </div>
                <div className="space-y-2">
                  {activeSupps.map(s => (
                    <div key={s.id} className="border-l-2 border-emerald-400 pl-3 py-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500 shrink-0">
                          {s.dosage} · {s.timing}
                        </div>
                      </div>
                      {s.coach_rationale && (
                        <div className="text-xs text-emerald-700 mt-0.5">
                          💬 {s.coach_rationale}
                        </div>
                      )}
                      {(s.started_at || s.mode_context) && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {s.started_at && <>從 {s.started_at} 開始</>}
                          {s.started_at && s.mode_context && ' · '}
                          {s.mode_context && <>當時 mode: {s.mode_context}</>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archived — collapsible */}
            {archivedSupps.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl">
                <button
                  onClick={() => setShowArchivedSupps(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      📦 過去 protocol（{archivedSupps.length} 項已封存）
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      為什麼 Howard 當初開、後來為什麼停 — protocol 演進的故事
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {showArchivedSupps ? '收合 ▴' : '展開 ▾'}
                  </span>
                </button>
                {showArchivedSupps && (
                  <div className="border-t border-slate-200 p-4 space-y-3">
                    {archivedSupps.map(s => {
                      const replacedByName = s.replaced_by_id
                        ? activeSupps.find(a => a.id === s.replaced_by_id)?.name ?? null
                        : null
                      return (
                        <div key={s.id} className="border-l-2 border-slate-300 pl-3 py-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="font-medium text-gray-700">{s.name}</div>
                            <div className="text-xs text-gray-400 shrink-0">
                              {s.dosage} · {s.timing}
                            </div>
                          </div>
                          {s.coach_rationale && (
                            <div className="text-xs text-emerald-700 mt-0.5">
                              💬 當時：{s.coach_rationale}
                            </div>
                          )}
                          {s.archive_reason && (
                            <div className="text-xs text-amber-700 mt-0.5">
                              停掉：{s.archive_reason}
                            </div>
                          )}
                          {replacedByName && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              ↪ 被「{replacedByName}」取代
                            </div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {s.started_at || '—'} → {s.archived_at || '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </details>
        )}

        {/* 有資料時：在底部放一個次要 CTA 讓學員追加更多 */}
        {summary.total > 0 && (
          <div className="mt-6 flex justify-center">
            <Link
              href={`/c/${clientId}/health/upload`}
              className="text-xs text-gray-600 hover:text-emerald-700 underline"
            >
              📥 上傳更多血檢資料
            </Link>
          </div>
        )}

        {/* A. 下次抽血規劃 */}
        {client?.next_checkup_date && labs.length > 0 && (() => {
          const today = new Date(); today.setHours(0,0,0,0)
          const nextDate = new Date(client.next_checkup_date); nextDate.setHours(0,0,0,0)
          const days = Math.floor((nextDate.getTime() - today.getTime()) / (1000*60*60*24))
          if (days < -7) return null  // 太久以前不顯示

          // 從 findings 拉 critical / attention 項目（必驗）
          const mustRecheck = findingsData
            ? findingsData.findings.filter(f => f.severity === 'critical' || f.severity === 'attention').slice(0, 8)
            : []

          // 學員 panel 裡「過去 1 年沒驗的常見指標」
          const recentTestNames = new Set(labs.filter((r: LabRow) => {
            const d = new Date(r.date); d.setHours(0,0,0,0)
            return (today.getTime() - d.getTime()) / (1000*60*60*24) <= 365
          }).map((r: LabRow) => r.test_name))
          const recommendCore = ['ApoB', 'Lp(a)', 'hs-CRP', '同半胱胺酸', '空腹胰島素', 'HbA1c', '維生素D', '睪固酮', '游離睪固酮', '雌二醇', 'SHBG', 'TSH', 'Free T4', '鐵蛋白', 'ALT']
          const suggestNew = recommendCore.filter(t => !recentTestNames.has(t))

          return (
            <section className="mt-10 bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  🩸 下次抽血規劃（{client.next_checkup_date}）
                </h3>
                <span className="text-[11px] text-gray-500">
                  {days > 0 ? `倒數 ${days} 天` : days === 0 ? '今天' : `已過 ${Math.abs(days)} 天`}
                </span>
              </div>

              {mustRecheck.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-medium text-rose-700 mb-1">⚠️ 必須複驗（前次有警示 / 注意）</div>
                  <div className="flex flex-wrap gap-1.5">
                    {mustRecheck.map(f => (
                      <span
                        key={f.testName}
                        className={`text-[11px] px-2 py-0.5 rounded ${
                          f.severity === 'critical'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {f.testName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {suggestNew.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-medium text-slate-600 mb-1">💡 建議加驗（近 1 年未驗的核心指標）</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestNew.slice(0, 12).map(t => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-500 leading-relaxed pt-3 border-t border-slate-200">
                抽血前空腹 8 小時、前一天降低訓練量、選上午抽。抽完拿到報告就到「📥 上傳血檢」自動生成觀察筆記。
              </p>
            </section>
          )
        })()}

        {/* B. 快速導航 */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Link
            href={`/c/${clientId}/health/upload`}
            className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">📥</div>
            <div className="text-sm font-medium text-gray-900">上傳血檢</div>
            <div className="text-[11px] text-gray-500 mt-0.5">手打 / CSV / 照片</div>
          </Link>
          <Link
            href={`/c/${clientId}/health/standards`}
            className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">📏</div>
            <div className="text-sm font-medium text-gray-900">標準對照</div>
            <div className="text-[11px] text-gray-500 mt-0.5">醫院 vs Howard 最佳</div>
          </Link>
          <Link
            href={`/c/${clientId}/health/learn`}
            className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">📖</div>
            <div className="text-sm font-medium text-gray-900">健康知識</div>
            <div className="text-[11px] text-gray-500 mt-0.5">18 個 FAQ + 文獻</div>
          </Link>
          <Link
            href={`/c/${clientId}#section-supplements`}
            className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">💊</div>
            <div className="text-sm font-medium text-gray-900">補品 protocol</div>
            <div className="text-[11px] text-gray-500 mt-0.5">目前在吃 + 歷史</div>
          </Link>
          <Link
            href={`/c/${clientId}`}
            className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm font-medium text-gray-900">回主頁</div>
            <div className="text-[11px] text-gray-500 mt-0.5">每日打卡 + 訓練</div>
          </Link>
        </section>


        {/* 教育性說明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              為什麼 Howard 標準和你醫院的「正常範圍」不一樣？
            </h3>
            <Link
              href={`/c/${clientId}/health/standards`}
              className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 shrink-0"
            >
              看完整對照 →
            </Link>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            一般醫院的參考範圍是「疾病門檻」 — 過了線才算病。
            <br />
            <strong>Howard 採用的是「最佳化追蹤範圍」</strong>，參考國際長壽研究文獻，以長期健康、預防、表現優化為導向。
            例如 ApoB：醫院 &lt; 130 都算正常，但長壽研究指出 &lt; 80（最佳 &lt; 50）的人長期心血管風險更低。
            <br />
            <strong>連續追蹤趨勢比單一數字更重要</strong> — 一年一次的健檢無法做到這件事。
          </p>
          <p className="text-[11px] text-blue-700 leading-relaxed mt-3 pt-3 border-t border-blue-200">
            <strong>免責提醒：</strong>本系統提供的數值參考範圍與教練筆記僅供生活方式調整參考，
            <strong>不構成醫療診斷、治療或處方建議</strong>。
            任何指標異常或健康疑慮請諮詢您的醫師。
          </p>
        </div>
      </div>
    </div>
  )
}
