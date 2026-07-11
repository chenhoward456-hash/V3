'use client'

import { useState } from 'react'
import type { SupplementSuggestion } from '@/lib/supplement-engine'
import { degradeToSafe } from '@/lib/compliance-scrub'

const PRIORITY: Record<SupplementSuggestion['priority'], { label: string; cls: string }> = {
  high: { label: '核心', cls: 'bg-amber-100 text-amber-800' },
  medium: { label: '建議', cls: 'bg-primary-100 text-primary-700' },
  low: { label: '加分', cls: 'bg-gray-100 text-gray-600' },
}

/**
 * 補品策略卡 — 把補品引擎的推理（原因／文獻／觸發的血檢項目）端給學員看，
 * 讓補品從「一張啞清單」變成「依我的血檢與基因、有文獻依據的個人化策略」。
 * 無建議時不顯示。
 */
export default function SupplementStrategyCard({ suggestions }: { suggestions: SupplementSuggestion[] }) {
  const [open, setOpen] = useState(false)      // 整張卡預設收合，去雜訊
  const [expanded, setExpanded] = useState(false) // 展開 >3 項
  if (!suggestions || suggestions.length === 0) return null

  // 依優先序排序：high → medium → low
  const order = { high: 0, medium: 1, low: 2 }
  const sorted = [...suggestions].sort((a, b) => order[a.priority] - order[b.priority])
  const shown = expanded ? sorted : sorted.slice(0, 3)
  const coreCount = sorted.filter(s => s.priority === 'high').length

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-3">
      {/* 收合時只露標題 + 預覽，點開看依據 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-900">你的個人化補品策略</span>
          {!open && (
            <span className="block text-xs text-gray-500 mt-0.5">
              {sorted.length} 項建議{coreCount > 0 ? `（${coreCount} 項核心）` : ''}，依血檢與基因 · 點開看依據
            </span>
          )}
        </span>
        <span className={`text-gray-400 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {!open ? null : (
      <div className="pt-4">
      <p className="text-xs text-gray-500 mb-3">依你的血檢與基因推導，每項附依據——不是通用清單。</p>

      <div className="space-y-3">
        {shown.map((s, i) => (
          <div key={`${s.name}-${i}`} className="border border-slate-200 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-gray-900 text-sm">{degradeToSafe(s.name).text}</div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORITY[s.priority].cls}`}>
                {PRIORITY[s.priority].label}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {s.dosage}
              {s.timing ? <span className="text-gray-400"> · {s.timing}</span> : null}
            </div>
            {s.reason && <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{degradeToSafe(s.reason).text}</p>}
            {s.evidence && (
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{s.evidence}</p>
            )}
            {s.triggerTests && s.triggerTests.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.triggerTests.map((t) => (
                  <span key={t} className="text-[11px] bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                    依據：{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {sorted.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-primary-600 font-medium hover:underline"
        >
          {expanded ? '收合' : `展開全部 ${sorted.length} 項`}
        </button>
      )}
      </div>
      )}
    </div>
  )
}
