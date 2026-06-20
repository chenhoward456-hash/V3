'use client'

import { useState } from 'react'

interface QuickActionsProps {
  enabledSections: { id: string; icon: string; label: string; completed: boolean }[]
  onNavigate: (sectionId: string) => void
  topSummary?: {
    weight?: string | number | null
    daysLeft?: number | null
    todayCarbs?: number | null
    isTrainingDay?: boolean
    streak?: number | null
  }
  /** 一鍵記今天體重：今天還沒量時，直接在最上面打一個數字就好（不用展開、不用開 modal） */
  showQuickWeight?: boolean
  onQuickWeight?: (weight: number) => Promise<boolean>
  /** 一鍵記今天飲食：今天還沒記時，達標/沒達標兩顆按鈕，把「填一張表」降成一下 */
  showQuickNutrition?: boolean
  onQuickNutrition?: (compliant: boolean) => Promise<boolean>
}

/** 一鍵記飲食達標 — 把「展開→填蛋白/水/碳水→存」降成一下；之後要補細項仍可進卡片(同日 upsert) */
function QuickNutritionInline({ onSubmit }: { onSubmit: (compliant: boolean) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tap = async (c: boolean) => { setBusy(true); const ok = await onSubmit(c); setBusy(false); if (ok) setDone(true) }
  if (done) return null
  return (
    <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
      <span className="text-base shrink-0">🍽️</span>
      <span className="text-sm text-gray-700 font-medium shrink-0">今天吃得如何</span>
      <div className="flex gap-1.5 ml-auto shrink-0">
        <button onClick={() => tap(true)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">✅ 達標</button>
        <button onClick={() => tap(false)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">😅 沒達標</button>
      </div>
    </div>
  )
}

/** 早上打開就能直接記體重的一行輸入 — 砍掉「展開區塊→滑過圖表→開 modal→存」那 6 步 */
function QuickWeightInline({ onSubmit }: { onSubmit: (w: number) => Promise<boolean> }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const w = parseFloat(val)
    if (isNaN(w) || w < 20 || w > 300) return
    setBusy(true)
    const ok = await onSubmit(w)
    setBusy(false)
    if (ok) setVal('')
  }
  return (
    <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
      <span className="text-base shrink-0">☀️</span>
      <span className="text-sm text-gray-700 font-medium shrink-0">今天體重</span>
      <input
        type="number" inputMode="decimal" step="0.1" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="--"
        aria-label="今天體重 (kg)"
        className="flex-1 min-w-0 px-3 py-2 bg-white border border-blue-200 rounded-lg text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
        autoComplete="off"
      />
      <span className="text-sm text-gray-400 shrink-0">kg</span>
      <button
        onClick={submit}
        disabled={busy || !val}
        className="shrink-0 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {busy ? '…' : '記錄'}
      </button>
    </div>
  )
}

export default function QuickActions({ enabledSections, onNavigate, topSummary, showQuickWeight, onQuickWeight, showQuickNutrition, onQuickNutrition }: QuickActionsProps) {
  if (enabledSections.length === 0) return null

  const completedCount = enabledSections.filter(s => s.completed).length
  const allDone = completedCount === enabledSections.length

  return (
    <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
      {/* 一行摘要 */}
      {topSummary && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {topSummary.weight && <span className="font-bold">{topSummary.weight}kg</span>}
            {topSummary.daysLeft != null && topSummary.daysLeft > 0 && (
              <span className="text-gray-400">· 🏆 {topSummary.daysLeft}天</span>
            )}
            {topSummary.todayCarbs != null && (
              <span className="text-gray-400">· 🍚 {topSummary.todayCarbs}g（{topSummary.isTrainingDay ? '訓練' : '休息'}）</span>
            )}
          </div>
          {topSummary.streak != null && topSummary.streak >= 3 && (
            <span className="text-xs font-bold text-orange-500">🔥 {topSummary.streak}天</span>
          )}
        </div>
      )}

      {/* 一鍵記今天體重（今天還沒量才出現） */}
      {showQuickWeight && onQuickWeight && <QuickWeightInline onSubmit={onQuickWeight} />}

      {/* 一鍵記今天飲食達標（今天還沒記才出現） */}
      {showQuickNutrition && onQuickNutrition && <QuickNutritionInline onSubmit={onQuickNutrition} />}

      {/* 進度條 */}
      <div className="flex gap-1 mb-3">
        {enabledSections.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s.completed ? 'bg-green-400' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* 按鈕列 */}
      <div className="flex gap-1.5">
        {enabledSections.map(s => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className={`flex-1 flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all ${
              s.completed
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <span className="text-base mb-0.5">{s.completed ? '✅' : s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-xs text-green-600 font-medium mt-2">今天全部完成 💪</p>
      )}
    </div>
  )
}
