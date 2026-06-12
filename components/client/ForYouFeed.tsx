'use client'

import { useState, useEffect } from 'react'
import { buildClientFeed, type FeedCard, type FeedTone, type MacroAdjustmentRow } from '@/lib/client-feed'
import type { LabResultRow } from '@/lib/lab-trend-analyzer'

const TONE_STYLE: Record<FeedTone, { box: string; title: string; icon: string }> = {
  good:  { box: 'from-emerald-50 to-green-50 border-emerald-200', title: 'text-emerald-800', icon: 'bg-emerald-100' },
  alert: { box: 'from-rose-50 to-red-50 border-rose-200',         title: 'text-rose-800',    icon: 'bg-rose-100' },
  warn:  { box: 'from-amber-50 to-yellow-50 border-amber-200',    title: 'text-amber-800',   icon: 'bg-amber-100' },
  info:  { box: 'from-blue-50 to-indigo-50 border-blue-200',      title: 'text-blue-800',    icon: 'bg-blue-100' },
}

function Card({ card, onDismiss }: { card: FeedCard; onDismiss: (id: string) => void }) {
  const s = TONE_STYLE[card.tone]
  return (
    <div className={`relative bg-gradient-to-br ${s.box} border rounded-2xl p-4 mb-3`}>
      <button
        onClick={() => onDismiss(card.id)}
        className="absolute top-2.5 right-2.5 text-gray-300 hover:text-gray-500 transition-colors p-1"
        aria-label="關閉這則更新"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div className="flex gap-3 pr-5">
        <div className={`shrink-0 w-9 h-9 rounded-xl ${s.icon} flex items-center justify-center text-lg`}>{card.icon}</div>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${s.title} mb-0.5`}>{card.title}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
          {card.cta && (
            <a
              href={card.cta.href}
              className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
            >
              {card.cta.label} →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

interface ForYouFeedProps {
  labs: LabResultRow[]
  gender?: '男性' | '女性'
  nextCheckupDate?: string | null
  macroAdjustment?: MacroAdjustmentRow | null
  clientName?: string | null
}

/**
 * 「為你更新」卡片流 — 把儀表板從給看變主動講。
 * 資料事件穩定 id；關掉存 localStorage，新事件會用新 id 重新出現。
 */
export function ForYouFeed({ labs, gender, nextCheckupDate, macroAdjustment, clientName }: ForYouFeedProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

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

  // 避免 SSR / client 首渲染不一致（dismissed 來自 localStorage）
  if (!ready) return null

  const cards = buildClientFeed({ labs, gender, nextCheckupDate, macroAdjustment }).filter(c => !dismissed.has(c.id))
  if (cards.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2 px-1">
        為你更新{clientName ? ` · ${clientName}` : ''}
      </p>
      {cards.map(card => (
        <Card key={card.id} card={card} onDismiss={handleDismiss} />
      ))}
    </div>
  )
}
