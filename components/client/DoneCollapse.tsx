'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * 「這件事今天做完了」→ 收成一行，點一下還是展得開。
 *
 * ## 為什麼（2026-09-19）
 *
 * Howard：「我目前在增肌期，每天做的事情基本上都一樣，我到底要這系統幹嘛？
 * 字那麼多看得很躁…我根本不想看。」
 *
 * 實測他自己的頁面：今天的體重已經記了、畫面也寫著「體重記好了，今天就算完成」，
 * 底下卻還有 1,600px 攤開的記錄卡（QuickActions 457px ＋ 今日營養攝取 761px）。
 * 增肌期他每天碳水 420g、每天一樣，那些卡天天攤開沒有新資訊。
 *
 * ⚠️ **不是刪功能**（他明確說「不用剪功能啦我都做了」）。東西一個都沒少，
 * 只是做完之後預設收起來，要看點一下就開。
 *
 * ⚠️ 收合條件是**這張卡自己那件事**做完，不是「今天有記體重」——
 * 體重記了不代表飯吃了，拿別人的完成度把這張藏起來會蓋掉他還沒做的事。
 *
 * 刻意不存 localStorage：狀態每天重置才對（今天做完收起來，明天自然又是打開的）。
 */
export default function DoneCollapse({
  done,
  summary,
  children,
}: {
  /** 這張卡負責的事今天做完了沒 */
  done: boolean
  /** 收起來時顯示的那一行（講結果，不是講「已完成」） */
  summary: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  // 還沒做完 → 原樣攤開，不要擋他做事
  if (!done) return <>{children}</>

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 mb-4 text-left hover:border-slate-300 transition-colors"
      >
        <Check size={14} className="text-emerald-600 shrink-0" />
        <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">{summary}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full flex items-center gap-2 px-1 pb-1 text-left"
      >
        <span className="text-[11px] text-slate-400 ml-auto">收起來 ↑</span>
      </button>
      {children}
    </div>
  )
}
