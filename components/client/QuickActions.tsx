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
  /** 一鍵「全部吃了」標記今天補品全完成 */
  showQuickSupplements?: boolean
  onQuickSupplements?: () => Promise<boolean>
  /** 一鍵感受：好/普通/累，對應睡眠+精力+心情 */
  showQuickWellness?: boolean
  onQuickWellness?: (level: 'good' | 'ok' | 'tired') => Promise<boolean>
  /** 一鍵訓練：選肌群即標記今天練了（休息=rest） */
  showQuickTraining?: boolean
  onQuickTraining?: (trainingType: string) => Promise<boolean>
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

/** 一鍵補品全完成 — 跟「達標」同一個手感，一下標記今天清單全吃了；要改細項再進補品分頁 */
function QuickSupplementInline({ onSubmit }: { onSubmit: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tap = async () => { setBusy(true); const ok = await onSubmit(); setBusy(false); if (ok) setDone(true) }
  if (done) return null
  return (
    <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
      <span className="text-base shrink-0">💊</span>
      <span className="text-sm text-gray-700 font-medium shrink-0">今天補品</span>
      <button onClick={tap} disabled={busy} className="ml-auto shrink-0 px-3 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">全部吃了 ✓</button>
    </div>
  )
}

/** 一鍵感受 — 好/普通/累 一下完成（粗估，要記睡眠分數/HRV 再進感受分頁）*/
function QuickWellnessInline({ onSubmit }: { onSubmit: (level: 'good' | 'ok' | 'tired') => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tap = async (l: 'good' | 'ok' | 'tired') => { setBusy(true); const ok = await onSubmit(l); setBusy(false); if (ok) setDone(true) }
  if (done) return null
  const btn = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors'
  return (
    <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
      <p className="text-sm text-gray-700 font-medium mb-2">😊 今天感受如何？</p>
      <div className="flex gap-1.5">
        <button onClick={() => tap('good')} disabled={busy} className={btn}>👍 還不錯</button>
        <button onClick={() => tap('ok')} disabled={busy} className={btn}>😐 普通</button>
        <button onClick={() => tap('tired')} disabled={busy} className={btn}>😪 累</button>
      </div>
    </div>
  )
}

/** 一鍵訓練 — 選肌群即標記今天練了（要記重量/組數再進訓練分頁）*/
function QuickTrainingInline({ onSubmit }: { onSubmit: (t: string) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tap = async (t: string) => { setBusy(true); const ok = await onSubmit(t); setBusy(false); if (ok) setDone(true) }
  if (done) return null
  const chip = 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 transition-colors'
  return (
    <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
      <p className="text-sm text-gray-700 font-medium mb-2">🏋️ 今天練了哪裡？</p>
      <div className="flex flex-wrap gap-1.5">
        {([['push', '推'], ['pull', '拉'], ['legs', '腿'], ['full_body', '全身'], ['cardio', '有氧']] as const).map(([t, l]) => (
          <button key={t} onClick={() => tap(t)} disabled={busy} className={chip}>{l}</button>
        ))}
        <button onClick={() => tap('rest')} disabled={busy} className={`${chip} text-slate-500`}>😴 休息</button>
      </div>
    </div>
  )
}

export default function QuickActions({ enabledSections, onNavigate, topSummary, showQuickWeight, onQuickWeight, showQuickNutrition, onQuickNutrition, showQuickSupplements, onQuickSupplements, showQuickWellness, onQuickWellness, showQuickTraining, onQuickTraining }: QuickActionsProps) {
  if (enabledSections.length === 0) return null

  const completedCount = enabledSections.filter(s => s.completed).length
  const allDone = completedCount === enabledSections.length

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      {/* 一行摘要 — 只留「今天該吃多少碳水」這種操作資訊；體重/倒數已在備賽作戰室，不重複 */}
      {topSummary && (topSummary.todayCarbs != null || (topSummary.streak != null && topSummary.streak >= 3)) && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {topSummary.todayCarbs != null && (
              <span className="text-gray-500">🍚 今天碳水 <span className="font-semibold text-slate-700 tabular-nums">{topSummary.todayCarbs}g</span>（{topSummary.isTrainingDay ? '訓練日' : '休息日'}）</span>
            )}
          </div>
          {topSummary.streak != null && topSummary.streak >= 3 && (
            <span className="text-xs font-bold text-slate-500 tabular-nums">🔥 {topSummary.streak}天</span>
          )}
        </div>
      )}

      {/* 一鍵記今天體重（今天還沒量才出現） */}
      {showQuickWeight && onQuickWeight && <QuickWeightInline onSubmit={onQuickWeight} />}

      {/* 一鍵記今天飲食達標（今天還沒記才出現） */}
      {showQuickNutrition && onQuickNutrition && <QuickNutritionInline onSubmit={onQuickNutrition} />}

      {/* 一鍵補品 / 感受 / 訓練（今天還沒記才出現）— 五項都能在首頁一下完成 */}
      {showQuickSupplements && onQuickSupplements && <QuickSupplementInline onSubmit={onQuickSupplements} />}
      {showQuickWellness && onQuickWellness && <QuickWellnessInline onSubmit={onQuickWellness} />}
      {showQuickTraining && onQuickTraining && <QuickTrainingInline onSubmit={onQuickTraining} />}

      {/* 進度條 */}
      <div className="flex gap-1 mb-3">
        {enabledSections.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s.completed ? 'bg-emerald-400' : 'bg-slate-200'}`}
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
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <span className="text-base mb-0.5">{s.completed ? '✅' : s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-xs text-emerald-600 font-medium mt-2">今天全部完成 💪</p>
      )}
    </div>
  )
}
