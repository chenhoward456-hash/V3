'use client'

import { useState, useEffect } from 'react'
import type { CoachMessageRow } from '@/lib/client-feed'

/**
 * 教練訊息置頂橫幅 — 點推播進來第一眼就看到「全文」。
 * 放在儀表板最上方（之前藏在「為你更新」中段，學員/教練點進去看不到全部內容）。
 * 關閉時回寫 read_at（跨裝置一致）；localStorage 只做本機即時隱藏。
 */
export default function CoachMessageBanner({ msg, clientCode }: { msg: CoachMessageRow | null; clientCode: string }) {
  const [dismissed, setDismissed] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!msg) { setReady(true); return }
    try {
      const raw = localStorage.getItem('foryou_dismissed')
      const set = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>()
      setDismissed(set.has(`coach_msg_${msg.id}`))
    } catch { setDismissed(false) }
    setReady(true)
  }, [msg])

  if (!ready || !msg || dismissed) return null

  const id = `coach_msg_${msg.id}`
  const dateStr = msg.created_at ? new Date(msg.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : ''
  const isAccount = msg.mode === 'accountability'
  const cleanTitle = (msg.title || '').replace(/^(💬|👋)\s*/u, '').trim() || 'Howard 的訊息'

  const dismiss = () => {
    setDismissed(true)
    try {
      const raw = localStorage.getItem('foryou_dismissed')
      const set = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>()
      set.add(id)
      localStorage.setItem('foryou_dismissed', JSON.stringify([...set]))
    } catch { /* ignore */ }
    // 回寫 read_at → 換裝置/清快取不再跳出
    fetch('/api/coach-message-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: clientCode, messageId: msg.id }),
    }).catch(() => { /* 本機已隱藏，回寫失敗不影響當下 */ })
  }

  return (
    <div className="relative px-4 py-3.5 rounded-2xl border-2 border-blue-300 bg-blue-50 mb-4 shadow-sm">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-blue-300 hover:text-blue-500 transition-colors p-1"
        aria-label="我看過了"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div className="flex items-center gap-2.5 mb-2 pr-7">
        <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-base shrink-0">{isAccount ? '👋' : '💬'}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-900 leading-tight">{cleanTitle}</p>
          {dateStr && <p className="text-[11px] text-blue-400 leading-tight">{dateStr} · 教練 Howard</p>}
        </div>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed max-h-[28rem] overflow-y-auto">{msg.body}</p>
      <button
        onClick={dismiss}
        className="mt-3 w-full text-center text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-lg py-2 hover:bg-blue-50/50 transition-colors"
      >
        我看完了 ✓
      </button>
    </div>
  )
}
