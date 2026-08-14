'use client'

import { useState } from 'react'

/**
 * 教練回饋的文字渲染。
 *
 * ⚠️ 2026-08-14 修：原本是 `<p>{note}</p>` —— 沒有 whitespace-pre-line，
 * 教練打的換行全被吃掉，1265 字擠成一整片牆（Howard 自己在手機上看到後說
 * 「字那麼凌亂我怎麼看」）。同一頁下面的「健康分析」反而有處理換行。
 *
 * 三件事：保留換行、解析 **粗體**（跟 MyPlanSection 一致）、超過門檻先收起來。
 */

const COLLAPSE_THRESHOLD = 220

function renderInline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

export default function CoachNoteText({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = note.length > COLLAPSE_THRESHOLD
  // 收起時切到最後一個完整換行，不要在句子中間斷掉
  const head = long && !expanded
    ? (() => {
        const cut = note.slice(0, COLLAPSE_THRESHOLD)
        const lastBreak = cut.lastIndexOf('\n')
        return lastBreak > COLLAPSE_THRESHOLD * 0.5 ? cut.slice(0, lastBreak) : cut
      })()
    : note

  return (
    <div className="mb-2">
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
        {renderInline(head)}
        {long && !expanded && <span className="text-gray-400">⋯</span>}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
        >
          {expanded ? '收起' : '看全部'}
        </button>
      )}
    </div>
  )
}
