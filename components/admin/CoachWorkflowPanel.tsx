'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageSquare, RefreshCw, FilePenLine } from 'lucide-react'
import type { CoachWorkItem } from '@/lib/coach-workflow'

type Message = { id: string; title: string; body: string; created_at: string; read_at: string | null; sent_via: string | null }
type Adjustment = { id: string; applied_at: string; reason: string | null; applied_by: string; old_macros: Record<string, unknown>; new_macros: Record<string, unknown> }
type WorkflowResponse = {
  today: string
  items: CoachWorkItem[]
  history?: { messages: Message[]; adjustments: Adjustment[]; unavailable: boolean }
}

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
const dateLabel = (value: string) => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function Reason({ item }: { item: CoachWorkItem }) {
  const extraSignals = item.signals.filter(signal => !item.reasons.some(reason => reason.reason === signal.text))
  return <>
    <p className="text-base leading-relaxed text-slate-900">{item.reason}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.action}</p>
    <p className="mt-3 text-sm text-slate-500">
      {item.reasons[0]?.kind === 'result' ? '資料日期' : '複核'}：{item.review.date ? `${item.review.date} · ` : ''}{item.review.label}
    </p>
    {(item.reasons.length > 1 || extraSignals.length > 0) && (
      <details className="mt-3 border-t border-slate-100 pt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium text-primary-700">查看判斷依據與其他關注</summary>
        <ul className="space-y-3 pb-2 text-sm leading-relaxed text-slate-600">
          {item.reasons.slice(1).map((reason, i) => <li key={`${reason.kind}-${i}`}>
            <p>{reason.reason}</p>
            <p className="mt-1 text-slate-500">{reason.action}</p>
            {reason.review.date && <p className="mt-1 text-slate-500">{reason.kind === 'result' ? '資料日期' : '複核'}：{reason.review.date} · {reason.review.label}</p>}
          </li>)}
          {extraSignals.map((signal, i) => <li key={`signal-${i}`} className="border-l-2 border-slate-200 pl-3">{signal.text}</li>)}
        </ul>
      </details>
    )}
  </>
}

/** Same server queue as LINE. Display and navigation only; no new write path. */
export default function CoachWorkflowPanel({ clientId, coachNote, onCompose, onNote, revision = 0 }: {
  clientId?: string
  coachNote?: string | null
  onCompose?: () => void
  onNote?: () => void
  revision?: number
}) {
  const [data, setData] = useState<WorkflowResponse | null>(null)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(false)
    fetch(`/api/admin/coach-workflow${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => { if (!res.ok) throw new Error('load'); return res.json() })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setPending(false) })
    return () => controller.abort()
  }, [clientId, refresh, revision])

  const items = data?.items ?? []
  const person = items[0]
  return (
    <section id="coach-workflow" aria-labelledby="coach-workflow-title" className="scroll-mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-6">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{data?.today || '教練工作區'} · 與 LINE 晨報共用清單</p>
          <h2 id="coach-workflow-title" className="text-xl font-semibold tracking-tight text-slate-900">{clientId ? '這次先處理' : '今天先處理'}</h2>
          {!clientId && !pending && !error && <p className="mt-1 text-sm text-slate-600">{items.length ? `${items.length} 位有關注事項，先看前 3 位。` : '目前清單沒有待確認事項。'}</p>}
        </div>
        <button type="button" onClick={() => setRefresh(n => n + 1)} disabled={pending} aria-label="重新整理處理清單" className={`${control} shrink-0 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50`}>
          <RefreshCw size={16} className={pending ? 'animate-spin' : ''} /><span className="hidden sm:inline">更新</span>
        </button>
      </div>

      {pending ? <p role="status" className="px-5 py-6 text-sm text-slate-600">正在整理處理清單…</p>
        : error ? <div role="alert" className="px-5 py-6"><p className="text-sm text-slate-700">清單暫時無法載入；下方原有資料仍可查看。</p><button onClick={() => setRefresh(n => n + 1)} className={`${control} mt-2 text-primary-700`}>重試</button></div>
          : clientId ? (
            <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
              <div className="p-5 sm:p-6">
                {person ? <Reason item={person} /> : <p className="text-sm leading-relaxed text-slate-600">目前共用清單沒有這位學員的待確認事項；可查看下方紀錄與上次處理內容。</p>}
                {coachNote && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-700">目前教練備註</summary><p className="whitespace-pre-wrap pb-2 text-sm leading-relaxed text-slate-600">{coachNote}</p></details>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={onCompose} className={`${control} bg-primary-600 text-white hover:bg-primary-700`}><MessageSquare size={16} />發訊息</button>
                  <button onClick={onNote} className={`${control} border border-slate-200 text-slate-700 hover:bg-slate-50`}><FilePenLine size={16} />記處理備註</button>
                  <Link href={`/admin/clients/${clientId}/longevity`} className={`${control} text-primary-700 hover:bg-primary-50`}>查看／設定複核<ArrowRight size={16} /></Link>
                  {person?.reasons.some(reason => reason.kind === 'proposal') && <a href={`/admin?proposalClientId=${clientId}#coach-proposals-${clientId}`} className={`${control} text-primary-700 hover:bg-primary-50`}>查看待審提案<ArrowRight size={16} /></a>}
                </div>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <h3 className="text-sm font-semibold text-slate-900">上次處理，這次接著看</h3>
                {data?.history?.unavailable && <p role="status" className="mt-3 text-sm text-slate-600">部分處理紀錄載入失敗，請更新後再確認。</p>}
                {data?.history?.messages[0] ? <div className="mt-4">
                  <p className="text-xs text-slate-500">{dateLabel(data.history.messages[0].created_at)} · 上次教練訊息</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{data.history.messages[0].title}</p>
                  <p className="mt-2 text-xs text-slate-600">{data.history.messages[0].read_at ? '訊息卡已收起；仍需確認是否執行。' : '尚無收起紀錄；不代表學員未執行。'}</p>
                  <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm text-primary-700">查看交付全文</summary><p className="whitespace-pre-wrap pb-3 text-sm leading-relaxed text-slate-700">{data.history.messages[0].body}</p></details>
                </div> : !data?.history?.unavailable && <p className="mt-3 text-sm text-slate-600">目前沒有教練訊息紀錄。</p>}
                {data?.history?.adjustments[0] && <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-500">{dateLabel(data.history.adjustments[0].applied_at)} · 上次營養設定調整</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{data.history.adjustments[0].reason || '這筆調整沒有留下原因。'}</p>
                  <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm text-primary-700">查看調整前後數字</summary>
                    <div className="space-y-2 pb-2 text-sm text-slate-700">{Object.entries(data.history.adjustments[0].new_macros).map(([key, value]) => <p key={key}>{({ calories: '熱量', protein: '蛋白質', carbs: '碳水', fat: '脂肪', calories_target: '熱量', protein_target: '蛋白質', carbs_target: '碳水', fat_target: '脂肪', carbs_training_day: '訓練日碳水', carbs_rest_day: '休息日碳水' } as Record<string, string>)[key] || key}：{String(data.history!.adjustments[0].old_macros[key] ?? '未記錄')} → {String(value ?? '未設定')}</p>)}</div>
                  </details>
                </div>}
              </div>
            </div>
          ) : (
            <div>
              {items.length === 0 && <p className="px-5 py-6 text-sm leading-relaxed text-slate-600">這是待確認事項清單，不代表所有學員已達標。完整學員資料與其他管理事項在下方。</p>}
              {items.slice(0, 3).map((item, i) => <div key={item.clientId} className="border-b border-slate-100 p-5 last:border-0 sm:px-6">
                <div className="mb-3 flex items-center gap-3"><span className="text-sm font-medium text-slate-400">{String(i + 1).padStart(2, '0')}</span><h3 className="text-lg font-semibold text-slate-900">{item.name}</h3></div>
                <Reason item={item} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{item.latestMessage ? `最近訊息 ${dateLabel(item.latestMessage.sentAt)} · ${item.latestMessage.readAt ? '訊息卡已收起' : '尚無收起紀錄'}` : '尚無教練訊息紀錄'}</p>
                  <Link href={item.href} className={`${control} bg-primary-600 text-white hover:bg-primary-700`}>查證與處理<ArrowRight size={16} /></Link>
                </div>
              </div>)}
              {items.length > 3 && <details className="border-t border-slate-200 px-5 sm:px-6"><summary className="min-h-14 cursor-pointer py-4 text-sm font-medium text-primary-700">其他 {items.length - 3} 位需關注學員</summary><div className="divide-y divide-slate-100">{items.slice(3).map(item => <Link key={item.clientId} href={item.href} className="flex min-h-14 items-center justify-between gap-4 py-4"><span><span className="block text-sm font-semibold text-slate-900">{item.name}</span><span className="mt-1 block text-sm text-slate-600">{item.reason}</span></span><ArrowRight size={16} className="shrink-0 text-primary-700" /></Link>)}</div></details>}
            </div>
          )}
    </section>
  )
}
