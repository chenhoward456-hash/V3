'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CoachingDraft } from '@/lib/coaching-drafts'

type Preview = { draft: CoachingDraft; message: string }[]
const LIMIT = 1500
const button = 'min-h-11 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40'
const primary = `${button} bg-primary-600 text-white hover:bg-primary-700`
const secondary = `${button} border border-slate-200 text-slate-700 hover:bg-slate-50`

export default function WeeklyCoachingPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<CoachingDraft[] | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [generatedAt, setGeneratedAt] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<Record<string, { saved: boolean; unknown?: boolean; text: string }>>({})
  const sendLock = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const messageFor = (d: CoachingDraft) => edits[d.clientId] ?? d.studentMessage
  const invalid = (text: string) => !text.trim() ? '請先填寫訊息。' : text.trim().length > LIMIT ? `訊息超過 ${LIMIT} 字，請縮短後再確認。` : ''
  const dirty = (drafts ?? []).some(d => edits[d.clientId] !== undefined && edits[d.clientId] !== d.studentMessage && !results[d.clientId]?.saved && !results[d.clientId]?.unknown)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/admin/weekly-coaching', { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        if (res.status === 401) { router.push('/admin/login'); throw new Error('登入已失效，請重新登入。') }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '草稿載入失敗，請重試。')
        return data
      })
      .then(data => { if (controller.signal.aborted) return; setDrafts(data.drafts); setEdits({}); setResults({}); setSelected(new Set()); setGeneratedAt(data.generatedAt || '') })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || '草稿載入失敗，請重試。') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [router, revision])

  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  useEffect(() => {
    if (preview) dialog.current?.showModal()
    else dialog.current?.close()
  }, [preview])

  const refresh = () => {
    if (Object.values(results).some(result => result.unknown)) { setError('有訊息尚未確認儲存結果；請先到學員頁核對，再解除重試限制。'); return }
    if (dirty && !window.confirm('重新整理會清掉尚未送出的編輯內容。確定重新生成草稿？')) return
    setError(''); setLoading(true); setRevision(n => n + 1)
  }
  const copy = async (d: CoachingDraft) => {
    setCopyError(null)
    try { await navigator.clipboard.writeText(messageFor(d)); setCopied(d.clientId) }
    catch { setCopied(null); setCopyError(d.clientId) }
  }
  const openPreview = (targets: CoachingDraft[]) => {
    if (loading || error || sendLock.current || !targets.length || targets.some(d => invalid(messageFor(d)) || (results[d.clientId]?.saved || results[d.clientId]?.unknown))) return
    setReviewed(false)
    setPreview(targets.map(d => ({ draft: d, message: messageFor(d).trim() })))
  }
  const confirmSend = async () => {
    if (!preview || sendLock.current || (preview.some(p => p.draft.needsCoachReview) && !reviewed)) return
    sendLock.current = true; setSending(true)
    const targets = preview
    for (const { draft: d, message } of targets) {
      let result: { saved: boolean; unknown?: boolean; text: string } = { saved: false, text: '' }
      try {
        const res = await fetch('/api/admin/weekly-coaching/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: d.clientId, message, mode: d.mode }) })
        const data = await res.json()
        result = res.ok && data.saved
          ? { saved: true, text: data.success ? `已存學員頁，${data.method === 'web_push' ? 'Web 推播' : 'LINE 通知'}已送達。` : '已存學員頁；通知未送達，請勿重複送出。' }
          : { saved: false, unknown: res.status >= 500 || res.ok, text: data.error || '無法確認儲存結果；請到學員總覽核對後再重試。' }
      } catch { result = { saved: false, unknown: true, text: '連線中斷，無法確認是否已儲存；請到學員總覽核對，避免重複送出。' } }
      setResults(prev => ({ ...prev, [d.clientId]: result }))
      setSelected(prev => { const next = new Set(prev); next.delete(d.clientId); return next })
    }
    setSending(false); sendLock.current = false; setPreview(null)
  }
  const selectedDrafts = (drafts ?? []).filter(d => selected.has(d.clientId) && !results[d.clientId]?.saved && !results[d.clientId]?.unknown)

  return <div className="min-h-screen bg-slate-50 px-4 py-6">
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">本週教練草稿</h1>
          <a href="/admin" onClick={e => { if (dirty && !window.confirm('尚未送出的編輯內容會清除。確定離開？')) e.preventDefault() }} className="flex min-h-11 items-center text-sm text-primary-700">返回後台</a>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">先看依據、改成你想說的話，再複製或檢查發送。編輯只保留在這一頁，尚未送出，也不會套用營養或課表。</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{generatedAt ? `生成於 ${new Date(generatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}` : '依現有記錄生成草稿'}</p>
          <button onClick={refresh} disabled={loading || sending} className={secondary}>{loading ? '載入中…' : '重新整理草稿'}</button>
        </div>
      </header>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-rose-700">{error}</p><p className="mt-2 text-sm text-slate-600">讀取失敗不代表學員沒有記錄。</p><button className={`${secondary} mt-3`} onClick={refresh}>重試</button></div>}
      {loading && <p role="status" className="text-sm text-slate-500">正在整理學員記錄…</p>}
      {!loading && !error && drafts?.length === 0 && <p className="text-sm text-slate-600">目前沒有啟用中的學員。</p>}
      {selectedDrafts.length > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="text-sm text-slate-600">已選 {selectedDrafts.length} 位，尚未送出</span><button onClick={() => openPreview(selectedDrafts)} disabled={loading || !!error || sending || selectedDrafts.some(d => !!invalid(messageFor(d)))} className={primary}>檢查所選草稿</button></div>}
      <div className="space-y-4">{drafts?.map(d => {
        const text = messageFor(d), issue = invalid(text), saved = !!results[d.clientId]?.saved, uncertain = !!results[d.clientId]?.unknown
        const modified = text !== d.studentMessage
        return <article key={d.clientId} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3"><input aria-label={`選取 ${d.name}`} type="checkbox" checked={selected.has(d.clientId)} disabled={sending || saved || uncertain} onChange={() => setSelected(prev => { const next = new Set(prev); next.has(d.clientId) ? next.delete(d.clientId) : next.add(d.clientId); return next })} className="h-5 w-5 accent-primary-600" /><h2 className="text-lg font-semibold text-slate-900">{d.name}</h2></div>
            <a className="flex min-h-11 items-center text-sm text-primary-700" target="_blank" rel="noopener noreferrer" href={`/admin/clients/${d.clientId}/overview`}>查學員紀錄 ↗</a>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{d.headline}</p>
          <p className="mt-2 text-xs text-slate-500">{d.dataDays} 天有記錄 · {d.mode === 'accountability' ? '先確認近況' : '本週建議'} · {d.hasPush ? '已開 Web 推播' : d.hasLine ? '已綁 LINE' : '沒有通知管道；可複製私訊或存學員頁'}</p>
          {d.needsCoachReview && <p className="mt-3 flex items-start gap-2 text-sm text-rose-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />這則需要你親自確認：{d.flags.join('；') || '請先核對資料與建議。'}</p>}
          <details className="mt-4 border-t border-slate-100 pt-2"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-700">判斷依據與資料來源</summary>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-600">{d.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            <h3 className="mb-2 mt-4 text-sm font-medium text-slate-900">建議下一步（尚未套用）</h3><ul className="space-y-2 text-sm leading-relaxed text-slate-600">{d.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>
            {d.evidence && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs leading-relaxed text-slate-500">趨勢日期 {d.evidence.from} 至 {d.evidence.to}（含首尾）；各來源採用期間列於下方。筆數與記錄天數不同；沒記錄不等於沒執行。感受取近 7 天平均並與前 7 天比較；營養變更取近 60 天作為回補期背景。</p><dl className="mt-3 space-y-2">{d.evidence.sources.map(s => <div key={s.key} className="flex flex-wrap justify-between gap-x-3 text-xs leading-relaxed"><dt className="text-slate-700">{s.label}<span className="block text-slate-400">{s.from} 至 {s.to}</span></dt><dd className="text-slate-500">{s.records} 筆 · {s.days} 天 · 最新 {s.latestDate || '無此期間記錄'}</dd></div>)}</dl></div>}
          </details>
          <div className="mt-4 border-t border-slate-100 pt-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor={`message-${d.clientId}`} className="text-sm font-medium text-slate-900">給學員的訊息</label><span className="text-xs text-slate-500">{saved ? '已存學員頁' : modified ? '已編輯，尚未送出' : '草稿，尚未送出'}</span></div>
            <textarea id={`message-${d.clientId}`} value={text} disabled={saved || sending} rows={7} onChange={e => { setEdits(prev => ({ ...prev, [d.clientId]: e.target.value })); setCopied(null); setCopyError(null) }} aria-describedby={`validation-${d.clientId}`} className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-relaxed text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50" />
            <div id={`validation-${d.clientId}`} className="mt-1 flex flex-wrap justify-between gap-2 text-xs"><span className={issue ? 'text-rose-700' : 'text-slate-500'}>{issue || '複製及檢查發送會使用上方文字。'}</span><span className="text-slate-500">{text.trim().length} / {LIMIT} 字</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => copy(d)} disabled={!text.trim()} className={primary}>{copied === d.clientId ? '已複製目前文字' : '複製目前文字'}</button><button onClick={() => openPreview([d])} disabled={loading || !!error || !!issue || sending || saved || uncertain} className={secondary}>檢查並發送</button><button disabled={!modified || saved || sending} onClick={() => { if (window.confirm('確定還原系統草稿？目前的編輯內容會清除。')) { setEdits(prev => ({ ...prev, [d.clientId]: d.studentMessage })); setCopied(null) } }} className={`${button} text-slate-500 hover:bg-slate-50`}>還原原文</button></div>
          {copyError === d.clientId && <p role="alert" className="mt-2 text-sm text-rose-700">無法存取剪貼簿，請重試或選取上方文字複製。</p>}
          {uncertain && <button className={`${secondary} mt-3`} onClick={() => { setResults(prev => ({ ...prev, [d.clientId]: { saved: false, text: '已核對未儲存，可重新檢查發送。' } })); setError('') }}>已核對學員頁，確認未儲存</button>}
          {results[d.clientId] && <p role="status" className="mt-3 text-sm leading-relaxed text-slate-700">{results[d.clientId].text}</p>}
        </article>
      })}</div>
    </div>
    <dialog aria-labelledby="send-preview-title" ref={dialog} onCancel={e => { if (sending) e.preventDefault(); else setPreview(null) }} className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-slate-200 p-0 backdrop:bg-slate-900/40">
      <div className="p-5"><h2 id="send-preview-title" className="text-lg font-semibold text-slate-900">檢查要送出的全文</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">確認後會存入學員頁並嘗試發通知。這個動作不會修改營養或課表；若文字提到改設定，請先核對學員目前的處方。</p>
        {preview?.map(({ draft: d, message }) => <div key={d.clientId} className="mt-4 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">{d.name}{d.needsCoachReview ? ' · 需親自確認' : ''}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{message}</p></div>)}
        {preview?.some(p => p.draft.needsCoachReview) && <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-slate-800"><input type="checkbox" checked={reviewed} disabled={sending} onChange={e => setReviewed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary-600" />我已核對需確認草稿的資料、旗標與全文，確認可以送出。</label>}
        <div className="mt-5 flex flex-wrap gap-2"><button onClick={confirmSend} disabled={sending || (preview?.some(p => p.draft.needsCoachReview) && !reviewed)} className={primary}>{sending ? '正在儲存與發送…' : `確認發送${preview && preview.length > 1 ? ` ${preview.length} 則` : ''}`}</button><button onClick={() => setPreview(null)} disabled={sending} className={secondary}>返回編輯</button></div>
      </div>
    </dialog>
  </div>
}
