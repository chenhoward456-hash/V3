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
  hasPush: boolean
  hasLine: boolean
}

// 安全可批次發的：數據調整模式 + 有管道 + 不需教練親看。其餘(問責/需你看/無管道)預設不勾，由你決定。
const isSafeToBatch = (d: Draft) => d.mode === 'adjust' && !d.needsCoachReview && (d.hasPush || d.hasLine)

export default function WeeklyCoachingPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [batchSending, setBatchSending] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sentResult, setSentResult] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/weekly-coaching', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/admin/login'); throw new Error('unauth') } return r.json() })
      .then(d => {
        const ds: Draft[] = d.drafts || []
        setDrafts(ds)
        setGeneratedAt(d.generatedAt || '')
        // 預設勾選安全可發的
        setSelected(new Set(ds.filter(isSafeToBatch).map(x => x.clientId)))
      })
      .catch(() => setError('載入失敗'))
  }, [router])

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // 單筆發送，回傳結果字串（批次與單發共用）
  const sendOne = async (d: Draft): Promise<string> => {
    if (!d.hasPush && !d.hasLine) return '無管道（用你私訊）'
    try {
      const res = await fetch('/api/admin/weekly-coaching/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: d.clientId, message: d.studentMessage, mode: d.mode }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) return data.method === 'skipped' ? '沒有可用管道' : '發送失敗'
      return data.method === 'web_push' ? '已推 Web Push' : '已發 LINE'
    } catch { return '發送失敗' }
  }

  const send = async (d: Draft) => {
    if (!window.confirm(`發送本週訊息給 ${d.name}？（${d.hasPush ? 'Web 推播' : d.hasLine ? 'LINE' : '無管道'}）`)) return
    setSending(d.clientId)
    setSentResult(p => ({ ...p, [d.clientId]: '' }))
    const r = await sendOne(d)
    setSentResult(p => ({ ...p, [d.clientId]: r }))
    setSending(null)
  }

  const batchSend = async () => {
    const targets = (drafts || []).filter(d => selected.has(d.clientId) && (d.hasPush || d.hasLine))
    if (targets.length === 0) return
    if (!window.confirm(`核准並發送給 ${targets.length} 位學員？`)) return
    setBatchSending(true)
    let ok = 0, fail = 0
    for (const d of targets) {
      setSentResult(p => ({ ...p, [d.clientId]: '發送中…' }))
      const r = await sendOne(d)
      setSentResult(p => ({ ...p, [d.clientId]: r }))
      r.startsWith('已') ? ok++ : fail++
      // 發完取消勾選，避免重複發
      setSelected(prev => { const n = new Set(prev); n.delete(d.clientId); return n })
    }
    setBatchSending(false)
    alert(`完成：成功 ${ok}、失敗/略過 ${fail}`)
  }

  const selectableCount = (drafts || []).filter(d => selected.has(d.clientId) && (d.hasPush || d.hasLine)).length

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-xl font-semibold text-slate-900">本週教練佇列</h1>
          <a href="/admin" className="text-sm text-primary-600 hover:text-primary-700">← 後台</a>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          系統依每位學員近 14 天數據草擬本週調整。{generatedAt && `生成於 ${generatedAt}。`}勾選後一鍵批次發；「問責召回／需你看／無管道」預設不勾，請你親自確認。
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {!drafts && !error && <p className="text-sm text-slate-400">計算中…</p>}
        {drafts && drafts.length === 0 && <p className="text-sm text-slate-400">沒有活躍學員。</p>}

        {/* 批次發送列 */}
        {drafts && drafts.length > 0 && (
          <div className="sticky top-2 z-10 flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-4 shadow-sm">
            <span className="text-sm text-slate-600">已勾選 <b className="text-slate-900">{selectableCount}</b> 位</span>
            <button
              onClick={batchSend}
              disabled={batchSending || selectableCount === 0}
              className="ml-auto text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40"
            >
              {batchSending ? '發送中…' : `核准並發送 (${selectableCount})`}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {drafts?.map(d => {
            const hasChannel = d.hasPush || d.hasLine
            return (
            <div key={d.clientId} className={`bg-white border rounded-2xl p-5 ${selected.has(d.clientId) ? 'border-primary-300 ring-1 ring-primary-100' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected.has(d.clientId)}
                    disabled={!hasChannel}
                    onChange={() => toggle(d.clientId)}
                    className="w-4 h-4 accent-primary-600 shrink-0 disabled:opacity-30"
                    title={!hasChannel ? '無管道，無法批次發' : '勾選批次發送'}
                  />
                  <span className="font-semibold text-slate-900">{d.name}</span>
                  {d.mode === 'accountability'
                    ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">問責召回</span>
                    : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">數據調整</span>}
                  {d.needsCoachReview && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">需你看</span>}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${d.hasPush ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`} title={d.hasPush ? '已開 Web 推播' : '未開 Web 推播'}>Push{d.hasPush ? '' : ' ✗'}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${d.hasLine ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`} title={d.hasLine ? '有綁 LINE' : '沒綁 LINE'}>LINE{d.hasLine ? '' : ' ✗'}</span>
                </div>
                <a href={`/admin/clients/${d.clientId}/overview`} className="text-xs text-primary-600 hover:text-primary-700 shrink-0">學員 →</a>
              </div>

              <p className="text-sm text-slate-700 mb-2">{d.headline}</p>

              {d.flags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {d.flags.map((f, i) => <span key={i} className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{f}</span>)}
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

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => send(d)}
                  disabled={sending === d.clientId || batchSending || !hasChannel}
                  className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40"
                  title={!hasChannel ? '此學員沒有 Web 推播也沒綁 LINE，請用你的私訊' : ''}
                >
                  {sending === d.clientId ? '發送中…' : d.hasPush ? '發送（Web 推播）' : d.hasLine ? '發送（LINE）' : '無管道可發'}
                </button>
                <button
                  onClick={() => copy(d.clientId, d.studentMessage)}
                  className="text-sm font-medium bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg hover:border-slate-300 transition-colors"
                >
                  {copied === d.clientId ? '已複製' : '複製（自己貼）'}
                </button>
                {sentResult[d.clientId] && <span className="text-xs text-slate-600">{sentResult[d.clientId]}</span>}
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}
