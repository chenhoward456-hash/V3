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
    subtitle: 'Peter Attia Medicine 3.0 核心 — ApoB 是新的 LDL',
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
    tests: ['AST', 'ALT', 'GGT', '白蛋白', 'eGFR', 'BUN', '肌酸酐'],
  },
  {
    title: '甲狀腺 / 荷爾蒙',
    subtitle: '能量 / 恢復 / 性慾 / 肌肉合成的源頭',
    tests: ['TSH', 'Free T4', 'Free T3', '睪固酮', '游離睪固酮', '皮質醇', 'DHEA-S', '雌二醇', 'SHBG'],
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={status} />
          <div className="font-medium text-gray-900 truncate">{testName}</div>
        </div>
        {inOptimal && hasData && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            最佳
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-gray-900">
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
              <span className="text-gray-700 font-medium">
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
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-[10px] font-medium text-emerald-700 mb-1">
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
        <div className="text-xs text-gray-400 py-6 text-center">尚無數據</div>
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

  const client = data?.client
  const labs = useMemo<LabRow[]>(
    () => (client?.lab_results ?? []) as LabRow[],
    [client?.lab_results]
  )
  const gender = (client?.gender === '男性' || client?.gender === '女性')
    ? client.gender
    : undefined

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-5xl mx-auto animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-64"></div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
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
                  <div key={j} className="bg-white rounded-xl border border-gray-200 p-4">
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
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
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
                className="ml-2 inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
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
        {/* 下次抽血倒數 banner */}
        {(() => {
          const nextDate = client?.next_checkup_date
          const compDate = client?.competition_date
          if (!nextDate) return null
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const next = new Date(nextDate); next.setHours(0, 0, 0, 0)
          const days = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (days < -7) return null  // 太久以前的不顯示

          const compDays = compDate
            ? Math.floor((new Date(compDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null

          if (days < 0) {
            return (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-rose-900">
                  ⚠️ 抽血日已過 {Math.abs(days)} 天 — {nextDate}
                </div>
                <div className="text-xs text-rose-700 mt-1">
                  記得補抽，上傳後系統會自動生成新觀察筆記
                </div>
              </div>
            )
          }
          if (days <= 14) {
            return (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-amber-900">
                      🩸 下次抽血倒數 <span className="text-xl">{days}</span> 天（{nextDate}）
                    </div>
                    <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                      {compDays !== null && compDays > 0 && (
                        <>距離比賽日（{compDate}）還有 <strong>{compDays}</strong> 天 — </>
                      )}
                      建議抽血項目：T / Free T / E2 / SHBG / Cortisol / TSH / hs-CRP / 鐵蛋白 / ALT
                    </div>
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
          }
          return (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="text-xs text-blue-800">
                🩸 下次抽血排程：<strong>{nextDate}</strong>（{days} 天後）
                {compDays !== null && compDays > 0 && <> · 距離比賽 {compDays} 天</>}
              </div>
            </div>
          )
        })()}

        {/* 摘要列 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500">追蹤項目</div>
            <div className="text-xl font-semibold text-gray-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-emerald-600">正常</div>
            <div className="text-xl font-semibold text-emerald-700">{summary.normal}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-amber-600">注意</div>
            <div className="text-xl font-semibold text-amber-700">{summary.attention}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-rose-600">警示</div>
            <div className="text-xl font-semibold text-rose-700">{summary.alert}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 col-span-2 md:col-span-1">
            <div className="text-xs text-emerald-700">已達最佳</div>
            <div className="text-xl font-semibold text-emerald-800">
              {summary.optimal}
              <span className="text-xs font-normal text-emerald-700 ml-1">/ {summary.total}</span>
            </div>
          </div>
        </div>

        {latestDate && (
          <div className="text-xs text-gray-500 mb-4">
            最近一次血檢：{latestDate}
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
                    className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm"
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

        {/* 補品 Protocol 演進 — Longevity tier 核心交付 */}
        {(activeSupps.length > 0 || archivedSupps.length > 0) && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              💊 你的補品 Protocol
            </h2>

            {/* Active */}
            {activeSupps.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
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
              <div className="bg-white border border-gray-200 rounded-xl">
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
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {archivedSupps.map(s => {
                      const replacedByName = s.replaced_by_id
                        ? activeSupps.find(a => a.id === s.replaced_by_id)?.name ?? null
                        : null
                      return (
                        <div key={s.id} className="border-l-2 border-gray-300 pl-3 py-1">
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
                            <div className="text-xs text-indigo-700 mt-0.5">
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
          </section>
        )}

        {/* 分類顯示 */}
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

        {/* 沒有任何分類有資料時 */}
        {summary.total === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 mb-3">尚未輸入任何血檢資料</p>
            <Link
              href={`/c/${clientId}/health/upload`}
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded"
            >
              📥 上傳血檢資料（手打 / CSV / PDF / 照片）
            </Link>
          </div>
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
            <section className="mt-10 bg-white border border-gray-200 rounded-xl p-4">
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
                  <div className="text-[11px] font-medium text-indigo-700 mb-1">💡 建議加驗（近 1 年未驗的核心指標）</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestNew.slice(0, 12).map(t => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-500 leading-relaxed pt-3 border-t border-gray-100">
                抽血前空腹 8 小時、前一天降低訓練量、選上午抽。抽完拿到報告就到「📥 上傳血檢」自動生成觀察筆記。
              </p>
            </section>
          )
        })()}

        {/* B. 快速導航 */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href={`/c/${clientId}/health/upload`}
            className="bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">📥</div>
            <div className="text-sm font-medium text-gray-900">上傳血檢</div>
            <div className="text-[10px] text-gray-500 mt-0.5">手打 / CSV / 照片</div>
          </Link>
          <Link
            href={`/c/${clientId}/health/standards`}
            className="bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">📏</div>
            <div className="text-sm font-medium text-gray-900">標準對照</div>
            <div className="text-[10px] text-gray-500 mt-0.5">醫院 vs Howard 最佳</div>
          </Link>
          <Link
            href={`/c/${clientId}#section-supplements`}
            className="bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">💊</div>
            <div className="text-sm font-medium text-gray-900">補品 protocol</div>
            <div className="text-[10px] text-gray-500 mt-0.5">目前在吃 + 歷史版本</div>
          </Link>
          <Link
            href={`/c/${clientId}`}
            className="bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-4 text-center transition-colors"
          >
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm font-medium text-gray-900">回主頁</div>
            <div className="text-[10px] text-gray-500 mt-0.5">每日打卡 + 訓練</div>
          </Link>
        </section>

        {/* C. 常見問題 FAQ — 已對文獻 (保守版) */}
        <section className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">常見問題</h3>
            <span className="text-[10px] text-gray-400">本資訊已對文獻；非醫療建議</span>
          </div>
          <div className="space-y-2">
            {[
              // ── 基礎觀念 ──
              {
                cat: '基礎觀念',
                q: '為什麼 ApoB 比 LDL-C 更重要？',
                a: 'LDL-C 測的是膽固醇「總含量」，但動脈粥狀硬化是由顆粒撞擊血管壁造成，所以「顆粒數量」(ApoB) 比含量更接近真正風險。2021 Canadian CVS Guidelines 已建議當三酸甘油酯 >1.5 mmol/L 時，ApoB 為優選篩檢指標（取代 LDL-C）。Peter Attia 在「Outlive」(2023) 中也以 ApoB 為心血管風險核心指標。',
              },
              {
                cat: '基礎觀念',
                q: '為什麼 Howard 標準 ApoB <50 比醫院 <130 嚴格？',
                a: '醫院 <130 是「疾病門檻」(過了就算高血脂)。Peter Attia 在「Outlive」主張長壽優化目標為 ApoB <50（最低風險區）— 此為個人化健康優化立場，**非醫學共識診斷標準**。2024 JAMA Cardiology 研究顯示，LDL-C 70 對應的人群中位 ApoB ~60，所以 <50 是「比中位數更低」的位置。',
              },
              {
                cat: '基礎觀念',
                q: '空腹胰島素為什麼比血糖更早顯示問題？',
                a: '胰島素阻抗發展過程：胰島素分泌增加 → 維持血糖正常 → 持續 10-20 年 → 胰臟撐不住 → 血糖才升高 → 一般健檢才看到。空腹胰島素能在這個沉默期早期捕捉。功能醫學共識：<5 µIU/mL「健康」；長壽派 (Attia) <2.5。',
              },
              {
                cat: '基礎觀念',
                q: '同半胱胺酸 (Homocysteine) 是什麼？',
                a: '甲基化代謝的中間產物。標準實驗室「正常」<15 µmol/L，但研究顯示 >10 心血管風險上升、>15 失智症風險上升。功能醫學優化區間 6-9。常見升高原因：B12 / 葉酸 / B6 缺乏、MTHFR 基因變異。介入：甲基化形式 B12 + 葉酸。',
              },
              {
                cat: '基礎觀念',
                q: '為什麼追蹤「趨勢」比單一數字重要？',
                a: '同樣是 ApoB 60，從 80 → 60 (進步) 跟從 40 → 60 (退步) 意義完全相反。年度健檢只看到 snapshot；連續追蹤能抓「方向 + 速度」，更能預測未來健康狀態。這是 Function Health / Lifeforce / Howard Protocol 共通主張。',
              },
              {
                cat: '基礎觀念',
                q: '我可以自己抽血嗎？',
                a: '台灣法規下，血液檢驗需醫師處方。你可以到聯安、美兆、汎美等健檢中心做完整 panel，或請家醫科 / 整合醫學醫師開立檢驗單。拿到報告後上傳到系統就能自動生成觀察筆記。',
              },

              // ── 補品策略（A 類）──
              {
                cat: '補品策略',
                q: 'Omega-3 EPA/DHA 該吃多少？魚油 vs 藻油？',
                a: 'AHA 2019 科學建議：高三酸甘油酯者 4 g/日 EPA+DHA 處方級劑量；一般保健 1-2 g/日。REDUCE-IT 試驗 (NEJM 2019) 顯示 4g/日 EPA 處方藥降低心血管事件 25%。魚油 vs 藻油：藻油為 EPA/DHA 原始來源、不含重金屬、適合素食者；魚油較便宜、選擇深海小型魚種降污染風險。FDA 一般 OTC 建議 ≤2g/日，超過建議與醫師討論。',
              },
              {
                cat: '補品策略',
                q: '維生素 D 過量風險？>100 ng/mL 有事嗎？',
                a: 'Endocrine Society 建議 25-OH-D 目標 40-60 ng/mL；高劑量補充 (>4000 IU/日長期) 可能造成高血鈣症。文獻認為 >100 ng/mL 為毒性警示區、>150 ng/mL 明確高血鈣風險上升。Howard 系統「警示」上限 150 是基於此。建議搭配 K2 (MK-7) 引導鈣質沉積到骨骼而非血管。',
              },
              {
                cat: '補品策略',
                q: '長期補鋅該注意銅平衡嗎？',
                a: '是。長期高劑量鋅 (>40 mg/日) 會競爭抑制銅吸收，造成銅缺乏（影響鐵代謝、神經）。文獻建議鋅:銅比約 15:1（例：鋅 15 mg + 銅 1 mg）。短期備賽期可不補銅，長期 (>3 個月) 建議搭配。',
              },
              {
                cat: '補品策略',
                q: '維生素 K2 為什麼要跟 D3 一起吃？',
                a: 'D3 促進腸道吸收鈣質、K2 (MK-7) 引導鈣質沉積到骨骼而非血管。研究方向認為單獨高劑量 D3 可能增加血管鈣化風險，搭配 K2 可平衡。常見組合：D3 4000-5000 IU + K2 (MK-7) 100-200 mcg。',
              },

              // ── 進階追蹤（B 類）──
              {
                cat: '進階追蹤',
                q: 'HRV（心率變異性）是什麼？為什麼追蹤？',
                a: 'HRV 衡量自律神經系統的「交感 vs 副交感」平衡。高 HRV = 神經系統有彈性、恢復良好；低 HRV = 持續壓力、過度訓練、疾病早期信號。最常用：Garmin、Polar、Oura Ring、Apple Watch（夜間測得最準）。HRV 沒有絕對「好壞」數字，個人基線比較才有意義 — 看自己跟自己的趨勢。',
              },
              {
                cat: '進階追蹤',
                q: '連續血糖監測 (CGM) 適合非糖尿病人嗎？',
                a: 'CGM 用 14 天 sensor 連續測量組織液血糖，可看到食物、運動、壓力、睡眠對血糖的即時反應。Levels Health、Veri 等公司針對非糖尿病人「代謝健康優化」市場。台灣自費 NT$2000-3000 / 14 天。對代謝症候群高風險、想了解食物個體差異的人有教育價值。但目前長期使用對非糖尿病人的硬 outcome 證據仍有限，**主要是教育用途**。',
              },
              {
                cat: '進階追蹤',
                q: 'DEXA 體脂掃描多久該做一次？',
                a: 'DEXA (DXA) 是測量身體組成「金標準」（脂肪、肌肉、骨密度分區）。對長壽客戶建議：基線測 1 次 + 每 12-24 個月複測 1 次。每年做 1 次是合理頻率。台灣自費 NT$2000-3000。比 InBody 準確很多但不便宜，建議用於「長期 trajectory」追蹤，不是月月測。',
              },
              {
                cat: '進階追蹤',
                q: '表觀基因年齡 (Epigenetic age) 測試值得嗎？',
                a: '基於 DNA 甲基化模式估算「生物年齡」(GrimAge / PhenoAge 等)。研究方向認為它跟長壽相關性比實際年齡強。但目前商業檢測 (Elysium TruAge、TruDiagnostic) 個人化準確度、生活方式介入後變化的可靠性仍有爭議。值得測：好奇 + 預算夠。不值得測：希望靠它做精準介入決策的人。',
              },

              // ── 實務操作（C 類）──
              {
                cat: '實務操作',
                q: '如何跟一般家醫科溝通自費加驗項目？',
                a: '直接列清單：「我想自費加驗 ApoB / Lp(a) / 空腹胰島素 / hs-CRP / 同半胱胺酸 / Free T3 / Vit D」。家醫科通常願意協助開立。如果遇到「健保不給付不能加驗」的情況，請改去：(1) 整合醫學或功能醫學門診 (2) 大型健檢中心（聯安、美兆、汎美等）做完整 panel。',
              },
              {
                cat: '實務操作',
                q: '抽血前該怎麼準備？',
                a: '基本：空腹 8-12 小時（只能喝水）、前一天降低訓練量（避免 ALT / CK 因運動升高）、避免酒精 48 小時、選擇上午 7-9 點抽（皮質醇 / 睪固酮日內變化）。長期藥物 / 補品照常吃但記錄下來。女性月經週期會影響荷爾蒙，建議經期第 21 天 (黃體期中)、固定每次相同期相比較。',
              },
              {
                cat: '實務操作',
                q: '健保檢驗 vs 自費功能醫學檢驗差在哪？',
                a: '健保項目以「疾病診斷」為導向，項目少（一般健檢約 10-15 項）、用「疾病門檻」判讀。自費功能醫學項目以「健康優化」為導向，可加驗 ApoB、Lp(a)、空腹胰島素、Free T3、同半胱胺酸、Omega-3 指數、有機酸等 30-100 項，用「最佳化範圍」判讀。Howard Protocol 主要服務後者。',
              },
              {
                cat: '實務操作',
                q: '報告紅字 / 紅字解讀心法',
                a: '不要看到紅字就慌、也不要綠字就放心。三個層次：(1) **方向**：跟自己上次比，是進步還是退步？(2) **位置**：是在「警示」線附近、還是已到「最佳」位置？(3) **關聯**：跟其他指標一起看，是不是某個系統（代謝、發炎、荷爾蒙）整組偏移？單一紅字 + 趨勢進步 = 不用慌；單一綠字 + 趨勢惡化 = 要注意。',
              },
            ].map((item, i) => (
              <details key={i} className="group border border-gray-100 rounded-lg">
                <summary className="cursor-pointer px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
                  <span className="font-medium flex-1">
                    <span className="text-[10px] text-gray-400 mr-2">{item.cat}</span>
                    {item.q}
                  </span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <p className="px-3 pb-3 pt-1 text-xs text-gray-700 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          {/* 來源參考 */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-[11px] font-medium text-gray-500 mb-2">📚 主要參考來源</div>
            <ul className="text-[10px] text-gray-500 space-y-0.5 leading-relaxed">
              <li>• 2021 Canadian Cardiovascular Society Guidelines for Dyslipidemia (Pearson et al., Can J Cardiol)</li>
              <li>• Individual Variation in ApoB Distribution (Sayed et al., 2024 JAMA Cardiol)</li>
              <li>• AHA/CDC Working Group: hsCRP Risk Categories (&lt;1 低 / 1-3 中 / &gt;3 高)</li>
              <li>• AHA 2019 Science Advisory: Omega-3 for Hypertriglyceridemia (4 g/d EPA+DHA)</li>
              <li>• REDUCE-IT trial (Bhatt et al., 2019 NEJM): EPA 4g/d → MACE -25%</li>
              <li>• Endocrine Society Vitamin D Guidelines (40-60 ng/mL 偏好區間)</li>
              <li>• Peter Attia「Outlive: The Science &amp; Art of Longevity」(2023) — ApoB &lt;50 / 空腹胰島素 &lt;2.5 等長壽派立場</li>
              <li>• IFM / 功能醫學共識（同半胱胺酸 6-9、Vit D &gt;40）</li>
            </ul>
            <p className="mt-2 text-[10px] text-amber-700">
              ⚠️ 本 FAQ 為教練資訊整理，不構成醫療診斷或處方建議。如有具體健康疑慮請諮詢家醫科或整合醫學醫師。
            </p>
          </div>
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
            <strong>Howard 採用的是「最佳化追蹤範圍」</strong>，參考國際長壽研究文獻（Peter Attia 等）以長期健康、預防、表現優化為導向。
            例如 ApoB：醫院 &lt; 130 都算正常，但研究指出 &lt; 80（最佳 &lt; 50）的人長期心血管風險更低。
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
