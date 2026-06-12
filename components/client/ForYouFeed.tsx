'use client'

import { useState, useEffect } from 'react'
import { buildClientFeed, type FeedCard, type FeedTone, type MacroAdjustmentRow } from '@/lib/client-feed'
import type { LabResultRow } from '@/lib/lab-trend-analyzer'

const TONE_STYLE: Record<FeedTone, { box: string; title: string; icon: string }> = {
  good:  { box: 'bg-emerald-50/70 border-emerald-100', title: 'text-emerald-800', icon: 'bg-emerald-100' },
  alert: { box: 'bg-rose-50/70 border-rose-100',       title: 'text-rose-800',    icon: 'bg-rose-100' },
  warn:  { box: 'bg-amber-50/70 border-amber-100',     title: 'text-amber-800',   icon: 'bg-amber-100' },
  info:  { box: 'bg-blue-50/70 border-blue-100',       title: 'text-blue-800',    icon: 'bg-blue-100' },
}

function Row({ card, onDismiss }: { card: FeedCard; onDismiss: (id: string) => void }) {
  const s = TONE_STYLE[card.tone]
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.box}`}>
      <span className={`shrink-0 w-7 h-7 rounded-lg ${s.icon} flex items-center justify-center text-sm`}>{card.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${s.title} leading-tight`}>{card.title}</p>
        <p className="text-xs text-gray-500 leading-snug truncate">{card.body}</p>
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

interface ForYouFeedProps {
  labs: LabResultRow[]
  gender?: '男性' | '女性'
  nextCheckupDate?: string | null
  macroAdjustment?: MacroAdjustmentRow | null
}

/**
 * 「為你更新」精簡卡片流 — 每則一行重點、預設只顯示 3 則、合規免責收底部。
 * 關掉存 localStorage；事件 id 變了會重新出現。
 */
export function ForYouFeed({ labs, gender, nextCheckupDate, macroAdjustment }: ForYouFeedProps) {
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
  }

  if (!ready) return null

  const cards = buildClientFeed({ labs, gender, nextCheckupDate, macroAdjustment }).filter(c => !dismissed.has(c.id))
  if (cards.length === 0) return null

  const visible = expanded ? cards : cards.slice(0, 3)
  const hidden = cards.length - visible.length
  const hasMedical = cards.some(c => c.tone === 'alert' || c.tone === 'warn')

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5 px-1">為你更新</p>
      <div className="space-y-1.5">
        {visible.map(card => <Row key={card.id} card={card} onDismiss={handleDismiss} />)}
      </div>
      {hidden > 0 && (
        <button onClick={() => setExpanded(true)} className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 px-1">
          ＋ 還有 {hidden} 則
        </button>
      )}
      {hasMedical && (
        <p className="text-[10px] text-gray-400 mt-1.5 px-1 leading-snug">⚠️ 數值僅供追蹤、非醫療診斷；有疑慮請諮詢醫師。</p>
      )}
    </div>
  )
}
