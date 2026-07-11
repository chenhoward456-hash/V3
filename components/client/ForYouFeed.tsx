'use client'

import { memo, useState, useEffect } from 'react'
import { buildClientFeed, type FeedCard, type FeedTone, type MacroAdjustmentRow, type CoachMessageRow } from '@/lib/client-feed'
import type { LabResultRow } from '@/lib/lab-trend-analyzer'

// 語意用 CSS 色點承接（emoji icon 依 DESIGN.md 移除；lib/client-feed 的 icon 欄位不再渲染）
const TONE_STYLE: Record<FeedTone, { box: string; title: string; dot: string }> = {
  good:  { box: 'bg-emerald-50/70 border-emerald-100', title: 'text-emerald-800', dot: 'bg-emerald-500' },
  alert: { box: 'bg-rose-50/70 border-rose-100',       title: 'text-rose-800',    dot: 'bg-rose-500' },
  warn:  { box: 'bg-amber-50/70 border-amber-100',     title: 'text-amber-800',   dot: 'bg-amber-500' },
  info:  { box: 'bg-blue-50/70 border-blue-100',       title: 'text-blue-800',    dot: 'bg-blue-500' },
}

function Row({ card, onDismiss }: { card: FeedCard; onDismiss: (id: string) => void }) {
  const s = TONE_STYLE[card.tone]
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.box}`}>
      <span className={`shrink-0 inline-block w-2 h-2 rounded-full ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${s.title} leading-tight`}>{card.title}</p>
        <p className="text-xs text-gray-500 leading-snug">
          {card.body}
          {card.cta && (
            <>
              {' · '}
              <a href={card.cta.href} className="text-blue-600 hover:underline font-medium">{card.cta.label} →</a>
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => onDismiss(card.id)}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors p-1"
        aria-label="關閉"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  )
}

/** 教練週度訊息：完整顯示（不截斷），因為這就是學員點推播要看的內容 */
function CoachMessageCard({ msg, onDismiss }: { msg: CoachMessageRow; onDismiss: (id: string) => void }) {
  const id = `coach_msg_${msg.id}`
  const dateStr = msg.created_at ? new Date(msg.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : ''
  const isAccount = msg.mode === 'accountability'
  const cleanTitle = (msg.title || '').replace(/^(💬|👋)\s*/u, '').trim() || 'Howard 的本週訊息'
  return (
    <div className="relative px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50/60 mb-2">
      <button
        onClick={() => onDismiss(id)}
        className="absolute top-2.5 right-2.5 text-blue-300 hover:text-blue-500 transition-colors p-1"
        aria-label="關閉"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div className="flex items-center gap-2 mb-1.5 pr-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-900 leading-tight">{cleanTitle}</p>
          {dateStr && <p className="text-[11px] text-blue-400 leading-tight">{dateStr} · 教練</p>}
        </div>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">{msg.body}</p>
      <p className="text-[11px] text-blue-400/80 mt-2 leading-snug">本訊息為健身/營養指導，非醫療診斷或處方；身體不適請就醫。</p>
    </div>
  )
}

interface ForYouFeedProps {
  labs: LabResultRow[]
  gender?: '男性' | '女性'
  nextCheckupDate?: string | null
  macroAdjustment?: MacroAdjustmentRow | null
  coachMessage?: CoachMessageRow | null
  /** 學員 unique_code：關閉教練訊息時回寫 read_at（跨裝置一致） */
  clientCode?: string
}

/**
 * 「為你更新」精簡卡片流 — 每則一行重點、預設只顯示 3 則、合規免責收底部。
 * 關掉存 localStorage；事件 id 變了會重新出現。
 */
function ForYouFeedInner({ labs, gender, nextCheckupDate, macroAdjustment, coachMessage, clientCode }: ForYouFeedProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const set = new Set<string>()
    try {
      const raw = localStorage.getItem('foryou_dismissed')
      if (raw) for (const id of JSON.parse(raw) as string[]) set.add(id)
    } catch { /* ignore corrupt storage */ }
    setDismissed(set)
    setReady(true)
  }, [])

  const handleDismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('foryou_dismissed', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
    // 教練訊息：除了本機隱藏，回寫 read_at → 換裝置/清快取不再跳出
    if (id.startsWith('coach_msg_') && clientCode && coachMessage) {
      fetch('/api/coach-message-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clientCode, messageId: coachMessage.id }),
      }).catch(() => { /* 本機已隱藏，回寫失敗不影響當下體驗 */ })
    }
  }

  if (!ready) return null

  const cards = buildClientFeed({ labs, gender, nextCheckupDate, macroAdjustment, clientCode }).filter(c => !dismissed.has(c.id))
  const showCoach = coachMessage && !dismissed.has(`coach_msg_${coachMessage.id}`)
  if (cards.length === 0 && !showCoach) return null

  const visible = expanded ? cards : cards.slice(0, 3)
  const hidden = cards.length - visible.length
  const hasMedical = cards.some(c => c.tone === 'alert' || c.tone === 'warn')

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5 px-1">為你更新</p>
      {showCoach && <CoachMessageCard msg={coachMessage} onDismiss={handleDismiss} />}
      <div className="space-y-1.5">
        {visible.map(card => <Row key={card.id} card={card} onDismiss={handleDismiss} />)}
      </div>
      {hidden > 0 && (
        <button onClick={() => setExpanded(true)} className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 px-1">
          ＋ 還有 {hidden} 則
        </button>
      )}
      {hasMedical && (
        <p className="text-[11px] text-gray-400 mt-1.5 px-1 leading-snug">數值僅供追蹤、非醫療診斷；有疑慮請諮詢醫師。</p>
      )}
    </div>
  )
}

export const ForYouFeed = memo(ForYouFeedInner)
