'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Droplet, CalendarClock, TrendingUp, RefreshCw } from 'lucide-react'

interface Marker { name: string; value: number; unit: string | null; optimal: string | null; changePercent: number | null }
interface ImprovingMarker { name: string; from: number | null; to: number; unit: string | null; changePercent: number | null }
interface LabClient {
  clientId: string
  name: string
  uniqueCode: string
  latestDate: string | null
  daysSinceLatest: number | null
  panelCount: number
  nextCheckupDate: string | null
  checkupDaysUntil: number | null
  dueForRetest: boolean
  criticalCount: number
  attentionCount: number
  improvingCount: number
  critical: Marker[]
  attention: Marker[]
  improving: ImprovingMarker[]
}

function MarkerPill({ m }: { m: Marker }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-xs px-2 py-0.5 rounded-full bg-white/70 border border-gray-200">
      <span className="font-medium text-gray-800">{m.name}</span>
      <span className="text-gray-900 font-semibold">{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
      {m.optimal && <span className="text-[10px] text-gray-400">最佳 {m.optimal}</span>}
    </span>
  )
}

export default function AdminLabsOverviewPage() {
  const router = useRouter()
  const [items, setItems] = useState<LabClient[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/labs-overview')
      if (res.status === 403 || res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (json?.success) { setItems(json.data.items); setErr(null) }
      else setErr(json?.error || '讀取失敗')
    } catch {
      setErr('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const all = items ?? []
  const needAttention = all
    .filter(c => c.criticalCount + c.attentionCount > 0)
    .sort((a, b) => (b.criticalCount - a.criticalCount) || (b.attentionCount - a.attentionCount))
  const dueRetest = all
    .filter(c => c.dueForRetest)
    .sort((a, b) => (a.checkupDaysUntil ?? 9999) - (b.checkupDaysUntil ?? 9999))
  const wins = all
    .filter(c => c.improvingCount > 0)
    .sort((a, b) => b.improvingCount - a.improvingCount)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700"><ChevronLeft className="w-5 h-5" /></Link>
              <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Droplet className="w-5 h-5 text-rose-500" /> 血檢總覽</h1>
            </div>
            <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1" title="重新整理" aria-label="重新整理">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 ml-7 mt-0.5">所有學員的血檢一次 triage — 誰要注意、誰該回檢、誰進步了</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading && <div className="text-center text-sm text-gray-400 py-12">載入中…</div>}
        {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">{err}</div>}

        {!loading && !err && all.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            目前沒有啟用血檢的學員
          </div>
        )}

        {/* 需要注意 */}
        {needAttention.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> 需要注意（{needAttention.length}）
            </h2>
            <div className="space-y-2">
              {needAttention.map(c => (
                <Link key={c.clientId} href={`/admin/clients/${c.clientId}/overview`} className="block bg-white rounded-2xl border border-gray-200 hover:border-rose-300 p-4 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900 truncate">{c.name}</span>
                      {c.criticalCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium shrink-0">{c.criticalCount} 警示</span>}
                      {c.attentionCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">{c.attentionCount} 注意</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                      {c.latestDate && <span>{c.latestDate}</span>}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.critical.map((m, i) => <MarkerPill key={`c${i}`} m={m} />)}
                    {c.attention.map((m, i) => <MarkerPill key={`a${i}`} m={m} />)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 該回檢 */}
        {dueRetest.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-orange-500" /> 該回檢（{dueRetest.length}）
            </h2>
            <div className="space-y-2">
              {dueRetest.map(c => {
                const overdue = c.checkupDaysUntil !== null && c.checkupDaysUntil < 0
                const soon = c.checkupDaysUntil !== null && c.checkupDaysUntil >= 0 && c.checkupDaysUntil <= 14
                const stale = c.daysSinceLatest !== null && c.daysSinceLatest > 120
                const reason = overdue ? `回檢逾期 ${Math.abs(c.checkupDaysUntil!)} 天`
                  : soon ? `回檢還有 ${c.checkupDaysUntil} 天`
                  : stale ? `距上次抽血 ${Math.round((c.daysSinceLatest ?? 0) / 30)} 個月` : '建議回檢'
                return (
                  <Link key={c.clientId} href={`/admin/clients/${c.clientId}/overview`} className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-200 hover:border-orange-300 p-4 transition-colors">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className={`ml-2 text-xs ${overdue ? 'text-rose-600' : 'text-orange-600'}`}>{reason}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* 最近進步 */}
        {wins.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> 最近進步 — 可報喜（{wins.length}）
            </h2>
            <div className="space-y-2">
              {wins.map(c => (
                <Link key={c.clientId} href={`/admin/clients/${c.clientId}/overview`} className="block bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 p-4 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-medium text-gray-900 truncate">{c.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.improving.map((m, i) => (
                      <span key={i} className="inline-flex items-baseline gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <span className="font-medium text-emerald-800">{m.name}</span>
                        <span className="text-emerald-700">{m.from ?? '?'} → {m.to}{m.unit ? ` ${m.unit}` : ''}</span>
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
