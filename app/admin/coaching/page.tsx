'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Draft = {
  clientId: string
  name: string
  uniqueCode: string
  mode: 'adjust' | 'accountability'
  dataDays: number
  headline: string
  bullets: string[]
  adjustments: string[]
  studentMessage: string
  needsCoachReview: boolean
  flags: string[]
}

export default function WeeklyCoachingPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/weekly-coaching', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/admin/login'); throw new Error('unauth') } return r.json() })
      .then(d => { setDrafts(d.drafts || []); setGeneratedAt(d.generatedAt || '') })
      .catch(() => setError('載入失敗'))
  }, [router])

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-xl font-semibold text-slate-900">本週教練佇列</h1>
          <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700">← 後台</a>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          系統依每位學員近 14 天數據草擬本週調整。{generatedAt && `生成於 ${generatedAt}。`}核准/交付為下一階段；現在可「複製」手動發給學員。
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {!drafts && !error && <p className="text-sm text-slate-400">計算中…</p>}
        {drafts && drafts.length === 0 && <p className="text-sm text-slate-400">沒有活躍學員。</p>}

        <div className="space-y-4">
          {drafts?.map(d => (
            <div key={d.clientId} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-900">{d.name}</span>
                  {d.mode === 'accountability'
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">問責召回</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">數據調整</span>}
                  {d.needsCoachReview && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">需你看</span>}
                </div>
                <a href={`/admin/clients/${d.clientId}/overview`} className="text-xs text-blue-600 hover:text-blue-700 shrink-0">學員 →</a>
              </div>

              <p className="text-sm text-slate-700 mb-2">{d.headline}</p>

              {d.flags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {d.flags.map((f, i) => <span key={i} className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">🚩 {f}</span>)}
                </div>
              )}

              <div className="text-xs text-slate-500 space-y-0.5 mb-2">
                {d.bullets.map((b, i) => <div key={i}>{b}</div>)}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mb-3">
                <p className="text-[11px] font-medium text-slate-500 mb-1">本週調整</p>
                <ul className="text-sm text-slate-800 list-disc list-inside space-y-0.5">
                  {d.adjustments.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>

              <details>
                <summary className="text-xs text-slate-500 cursor-pointer mb-1">給學員的訊息（點開）</summary>
                <p className="text-sm text-slate-700 whitespace-pre-line bg-white border border-slate-200 rounded-xl p-3 mt-1">{d.studentMessage}</p>
              </details>

              <button
                onClick={() => copy(d.clientId, d.studentMessage)}
                className="mt-3 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {copied === d.clientId ? '✓ 已複製' : '複製訊息'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
