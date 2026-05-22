'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Sparkles, Pencil, Save, AlertCircle } from 'lucide-react'

interface AuditEntry {
  id: string
  client: { id: string; name: string; unique_code: string | null; subscription_tier: string | null }
  panel_date: string
  client_mode: string | null
  findings_count: number | null
  model_used: string | null
  created_at: string
  coach_saved_at: string | null
  saved: boolean
  ai: { summary: string; priorities: string; total_chars: number }
  coach: { summary: string; priorities: string; total_chars: number } | null
  diff: { size_delta: number; size_ratio: number | null } | null
}

interface AuditData {
  counts: { total: number; saved: number; pending: number }
  avg_chars: { ai: number; coach: number }
  entries: AuditEntry[]
}

export default function AiAuditPage() {
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState<'all' | 'saved' | 'pending'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | 'protocol' | 'coached' | 'free' | 'self_managed' | 'concierge'>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/ai-audit?limit=100')
        const json = await res.json()
        if (cancelled) return
        if (json?.success) setData(json.data)
        else setErr(json?.error || '讀取失敗')
      } catch {
        if (!cancelled) setErr('網路錯誤')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-56 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-72"></div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="h-3 bg-gray-100 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-100 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-rose-600">{err || '無資料'}</div>
      </div>
    )
  }

  const q = searchQuery.trim().toLowerCase()
  const filtered = data.entries.filter(e => {
    // saved/pending filter
    if (showFilter === 'saved' && !e.saved) return false
    if (showFilter === 'pending' && e.saved) return false
    // tier filter
    if (tierFilter !== 'all' && e.client.subscription_tier !== tierFilter) return false
    // search by client name / panel_date / mode
    if (q) {
      const hay = `${e.client.name} ${e.panel_date} ${e.client_mode ?? ''} ${e.client.unique_code ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  function fmtDate(s: string | null) {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
  }

  function tierColor(t: string | null) {
    if (t === 'protocol') return 'bg-emerald-100 text-emerald-800'
    if (t === 'concierge') return 'bg-purple-100 text-purple-800'
    if (t === 'coached') return 'bg-blue-100 text-blue-800'
    if (t === 'self_managed') return 'bg-gray-100 text-gray-700'
    return 'bg-gray-50 text-gray-500'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">AI 草稿 Audit Dashboard</h1>
          </div>
          <p className="text-xs text-gray-500 ml-7">
            追蹤 AI 自動寫的 panel note 和你修改後的最終版本 — 用來持續優化 prompt
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 摘要 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500">總草稿數</div>
            <div className="text-2xl font-semibold text-gray-900">{data.counts.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-emerald-600">已儲存（教練審核過）</div>
            <div className="text-2xl font-semibold text-emerald-700">{data.counts.saved}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-amber-600">未儲存（草稿但沒寫進 panel notes）</div>
            <div className="text-2xl font-semibold text-amber-700">{data.counts.pending}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-indigo-600">AI 平均長度</div>
            <div className="text-2xl font-semibold text-indigo-700">{data.avg_chars.ai}<span className="text-sm text-gray-500 ml-1">字</span></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-emerald-600">教練最終長度</div>
            <div className="text-2xl font-semibold text-emerald-700">{data.avg_chars.coach || '—'}<span className="text-sm text-gray-500 ml-1">字</span></div>
          </div>
        </div>

        {/* 搜尋 + 篩選 */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 space-y-2">
          {/* 搜尋框 */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 搜尋客戶名 / panel 日期 / mode / unique code..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {/* 篩選 row */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-gray-500">狀態：</span>
            {([
              { key: 'all', label: `全部 (${data.counts.total})` },
              { key: 'saved', label: `已儲存 (${data.counts.saved})` },
              { key: 'pending', label: `未儲存 (${data.counts.pending})` },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setShowFilter(f.key)}
                className={`px-2.5 py-1 rounded ${
                  showFilter === f.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}

            <span className="text-gray-500 ml-2">Tier：</span>
            {(['all', 'protocol', 'concierge', 'coached', 'self_managed', 'free'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1 rounded ${
                  tierFilter === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}

            {(searchQuery || tierFilter !== 'all' || showFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setTierFilter('all'); setShowFilter('all') }}
                className="ml-auto px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
              >
                清除全部
              </button>
            )}
          </div>
          {filtered.length !== data.entries.length && (
            <div className="text-[11px] text-gray-500">
              顯示 {filtered.length} / {data.entries.length} 筆
            </div>
          )}
        </div>

        {/* 列表 */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              {data.counts.total === 0 ? (
                <>
                  <div className="text-5xl mb-3 opacity-60">✨</div>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    還沒有任何 AI 草稿紀錄
                  </div>
                  <div className="text-xs text-gray-500 mb-3 max-w-sm mx-auto leading-relaxed">
                    去學員血檢 tab 按「✨ AI 草稿」，或讓學員上傳血檢自動觸發草稿，紀錄會出現在這裡。
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2 opacity-60">🔍</div>
                  <div className="text-sm text-gray-600">沒有符合條件的紀錄</div>
                  <div className="text-xs text-gray-400 mt-1">切換上方篩選器看看</div>
                </>
              )}
            </div>
          )}

          {filtered.map(entry => {
            const isOpen = expanded === entry.id
            return (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.saved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {entry.saved ? <Save className="inline w-3 h-3 mr-0.5" /> : <AlertCircle className="inline w-3 h-3 mr-0.5" />}
                      {entry.saved ? '已儲存' : '未儲存'}
                    </div>
                    <div className="font-medium text-gray-900 truncate">{entry.client.name}</div>
                    {entry.client.subscription_tier && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierColor(entry.client.subscription_tier)}`}>
                        {entry.client.subscription_tier}
                      </span>
                    )}
                    {entry.client_mode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {entry.client_mode}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 truncate">
                      panel: {entry.panel_date} · {entry.findings_count} findings
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {entry.diff && (
                      <div className={`text-xs ${
                        entry.diff.size_delta === 0 ? 'text-gray-400' :
                        entry.diff.size_delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {entry.diff.size_delta > 0 ? '+' : ''}{entry.diff.size_delta} 字
                      </div>
                    )}
                    <span className="text-xs text-gray-400">{fmtDate(entry.created_at)}</span>
                    <span className="text-gray-400">{isOpen ? '▴' : '▾'}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                    <div className="text-xs text-gray-500">
                      Model: {entry.model_used} · Created: {fmtDate(entry.created_at)}
                      {entry.coach_saved_at && <> · Saved: {fmtDate(entry.coach_saved_at)}</>}
                    </div>

                    {/* AI 寫的 */}
                    <div>
                      <div className="text-xs font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI 寫的（{entry.ai.total_chars} 字）
                      </div>
                      <div className="bg-white border border-indigo-200 rounded p-3 space-y-2">
                        <div>
                          <div className="text-[11px] font-medium text-gray-500 mb-0.5">Summary</div>
                          <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{entry.ai.summary || '(無)'}</p>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium text-gray-500 mb-0.5">Priorities</div>
                          <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{entry.ai.priorities || '(無)'}</p>
                        </div>
                      </div>
                    </div>

                    {/* 教練改完 */}
                    {entry.coach && (
                      <div>
                        <div className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                          <Pencil className="w-3 h-3" /> 教練最終版（{entry.coach.total_chars} 字{
                            entry.diff && entry.diff.size_delta !== 0
                              ? `，比 AI ${entry.diff.size_delta > 0 ? '多' : '少'} ${Math.abs(entry.diff.size_delta)} 字`
                              : '，沒改長度'
                          }）
                        </div>
                        <div className="bg-white border border-emerald-200 rounded p-3 space-y-2">
                          <div>
                            <div className="text-[11px] font-medium text-gray-500 mb-0.5">Summary</div>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{entry.coach.summary || '(無)'}</p>
                          </div>
                          <div>
                            <div className="text-[11px] font-medium text-gray-500 mb-0.5">Priorities</div>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{entry.coach.priorities || '(無)'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!entry.coach && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        此草稿尚未儲存到 panel note — 可能是教練按了「✨ AI 草稿」但沒按「儲存」
                      </div>
                    )}

                    {entry.client.unique_code && (
                      <div className="pt-2 border-t border-gray-200">
                        <Link
                          href={`/c/${entry.client.unique_code}/health/timeline`}
                          className="text-xs text-blue-600 hover:underline"
                          target="_blank"
                        >
                          → 查看學員 timeline
                        </Link>
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
