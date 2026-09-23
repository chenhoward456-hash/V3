'use client'

import { useEffect, useState } from 'react'
import type { HorsemanView, HypothesisGrade } from '@/lib/longevity-lens'

/**
 * 首頁一行「血檢進退」摘要：初衷原本只在「健康」分頁裡，首頁看不到。
 * 只佔一行，點了切到健康分頁。首屏不搶請求：延後 1.5 秒再抓。
 */
export default function LongevityTeaser({ code, onOpen }: { code: string; onOpen: () => void }) {
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/longevity?code=${encodeURIComponent(code)}`)
        .then(r => r.json())
        .then(j => {
          if (!j.success) return
          const groups = j.data.groups as HorsemanView[]
          const hyps = j.data.hypotheses as { retest_by: string | null; grade: HypothesisGrade }[]
          const real = groups.flatMap(g => g.stories).filter(s => s.change && s.change.verdict !== 'noise').length
          const waiting = hyps.filter(h => h.grade.status === 'pending' || h.grade.status === 'overdue')
          const graded = hyps.length - waiting.length
          const parts: string[] = []
          if (real > 0) parts.push(`${real} 項有明顯變化`)
          if (graded > 0) parts.push(`${graded} 個預測已對答案`)
          if (waiting.length > 0) {
            const next = waiting.map(h => h.retest_by).filter(Boolean).sort()[0]
            parts.push(next ? `${waiting.length} 個預測等 ${Number(next.slice(5, 7))}/${Number(next.slice(8, 10))} 抽血` : `${waiting.length} 個預測等重測`)
          }
          if (parts.length === 0 && groups.length > 0) parts.push('目前都在正常波動內')
          if (parts.length) setLine(parts.join('・'))
        })
        .catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [code])

  if (!line) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl px-5 py-3 mb-3 flex items-center justify-between gap-3"
    >
      <span className="text-sm text-slate-700"><span className="font-semibold text-slate-900">血檢進退</span>　{line}</span>
      <span className="text-slate-400 shrink-0">›</span>
    </button>
  )
}
