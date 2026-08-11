'use client'

import { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { BodyProfile } from './BodyProfileCard'

/**
 * 身體檔案 · 首頁定錨 — 一行，不是卡片。
 *
 * 為什麼放首頁：首頁原本只問「你今天要記什麼」，那是手段；
 * 該先回答的是「你的身體目前告訴我們什麼」，那是目的。一行就夠扭轉主從，
 * 又不會吃掉第一屏（完整 7 條在健康分頁）。
 *
 * 顯示哪一條由教練 pin（body_profile.entries[].pinned），不做自動挑選引擎——
 * 教練判斷是護城河，而且可以當每週的「這週你該知道的一件事」換著 pin。
 */
function BodyProfileAnchorInner({
  data,
  onOpen,
}: {
  data: BodyProfile | null
  onOpen: () => void
}) {
  const entry = data?.entries?.find((e) => e.pinned)
  if (!entry) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 mb-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-left hover:border-slate-300 transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] text-slate-400">你的身體目前告訴我們</span>
        <span className="block text-sm font-semibold text-slate-900 mt-0.5">{entry.label}</span>
        <span className="block text-xs text-slate-600 mt-0.5 tabular-nums">{entry.value}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  )
}

export default memo(BodyProfileAnchorInner)
