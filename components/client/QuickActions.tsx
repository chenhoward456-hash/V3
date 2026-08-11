'use client'

import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

interface QuickActionsProps {
  enabledSections: { id: string; icon: ReactNode; label: string; completed: boolean }[]
  onNavigate: (sectionId: string) => void
  topSummary?: {
    weight?: string | number | null
    daysLeft?: number | null
    todayCarbs?: number | null
    isTrainingDay?: boolean
    /** Peak week 期間當天的階段標籤（如「🔺 峰值」「賽日」）；有值時取代訓練日/休息日 */
    peakLabel?: string | null
    streak?: number | null
  }
  /** 一鍵記今天體重：直接在最上面打一個數字就好（不用展開、不用開 modal） */
  showQuickWeight?: boolean
  onQuickWeight?: (weight: number) => Promise<boolean>
  /** 今天已記的體重；有值就顯示數值＋「改」，而不是把整行藏起來 */
  todayWeight?: number | null
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
  /** 今天課表的主項動作名稱；有值才會在選完分化後就地問一格重量 */
  todayMainLift?: string | null
  /** 今天已記的訓練類型（null = 還沒記）。有記但還沒填主項重量時，重新整理後仍能補填 */
  todayTrainingType?: string | null
  /** 今天已記的主項重量 */
  todayCompoundWeight?: number | null
  /** 那個主項上一次幾公斤（當 placeholder 參考） */
  lastMainLiftWeight?: number | null
  /** 記主項重量（寫進 training_logs.compound_weight + compound_lift） */
  onQuickCompoundWeight?: (weight: number) => Promise<boolean>
}

/** 一鍵記飲食達標 — 把「展開→填蛋白/水/碳水→存」降成一下；之後要補細項仍可進卡片(同日 upsert) */
function QuickNutritionInline({ onSubmit }: { onSubmit: (compliant: boolean) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tap = async (c: boolean) => { setBusy(true); const ok = await onSubmit(c); setBusy(false); if (ok) setDone(true) }
  if (done) return null
  return (
    <div className="flex items-center gap-2 mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
      <span className="text-sm text-gray-700 font-medium shrink-0">今天吃得如何</span>
      <div className="flex gap-1.5 ml-auto shrink-0">
        <button onClick={() => tap(true)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors">達標</button>
        <button onClick={() => tap(false)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">沒達標</button>
      </div>
    </div>
  )
}

/** 早上打開就能直接記體重的一行輸入 — 砍掉「展開區塊→滑過圖表→開 modal→存」那 6 步
 *
 * ⚠️ 記完不要把整行藏起來。舊版條件是「今天還沒量才顯示」，學員記完之後入口整個消失，
 * 只剩底部一顆綠色打勾 chip → 他看不到自己填了什麼、也找不到地方改，會以為功能壞了
 * （2026-08-10 Sean 實際回報）。改成記完顯示數值 + 一顆「改」，要改再回到輸入態。 */
function QuickWeightInline({ onSubmit, recordedWeight }: { onSubmit: (w: number) => Promise<boolean>; recordedWeight?: number | null }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const submit = async () => {
    const w = parseFloat(val)
    if (isNaN(w) || w < 20 || w > 300) return
    setBusy(true)
    const ok = await onSubmit(w)
    setBusy(false)
    if (ok) { setVal(''); setEditing(false) }
  }

  // 今天已經記過 → 顯示記了多少，不要讓入口消失
  if (recordedWeight != null && !editing) {
    return (
      <div className="flex items-center gap-2 mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
        <span className="text-sm text-gray-700 font-medium shrink-0">今天體重</span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-base font-bold text-slate-800 tabular-nums">{recordedWeight}</span>
          <span className="text-sm text-gray-400">kg</span>
          <Check className="w-4 h-4 text-emerald-500" />
        </span>
        <button
          onClick={() => { setVal(String(recordedWeight)); setEditing(true) }}
          className="shrink-0 ml-2 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          改
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
      <span className="text-sm text-gray-700 font-medium shrink-0">今天體重</span>
      <input
        type="number" inputMode="decimal" step="0.1" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="--"
        aria-label="今天體重 (kg)"
        className="flex-1 min-w-0 px-3 py-2 bg-white border border-primary-200 rounded-lg text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        autoComplete="off"
      />
      <span className="text-sm text-gray-400 shrink-0">kg</span>
      <button
        onClick={submit}
        disabled={busy || !val}
        className="shrink-0 bg-primary-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
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
    <div className="flex items-center gap-2 mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
      <span className="text-sm text-gray-700 font-medium shrink-0">今天補品</span>
      <button onClick={tap} disabled={busy} className="ml-auto shrink-0 px-3 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors">全部吃了 ✓</button>
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
    <div className="mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
      <p className="text-sm text-gray-700 font-medium mb-2">今天感受如何？</p>
      <div className="flex gap-1.5">
        <button onClick={() => tap('good')} disabled={busy} className={btn}>還不錯</button>
        <button onClick={() => tap('ok')} disabled={busy} className={btn}>普通</button>
        <button onClick={() => tap('tired')} disabled={busy} className={btn}>累</button>
      </div>
    </div>
  )
}

/** 一鍵訓練 — 選肌群即標記今天練了。
 *
 * ⚠️ 選完不要直接消失：舊版點完 return null，要記重量得「進訓練分頁 → 展開明細 → 填一整張表」，
 * 成本高過當下回饋 → 實際結果是連系統設計者自己都從 2026-06 起停記強度（compound_weight/RPE 全 NULL，
 * PR 停在 4 月），備賽 4 個月無法回答「掉了多少肌力」。
 * 改成選完就地問一格主項重量：一個數字，帶上次幾公斤當參考。要記細項仍可進訓練分頁。 */
function QuickTrainingInline({
  onSubmit, mainLift, lastWeight, onWeight, loggedType, loggedWeight,
}: {
  onSubmit: (t: string) => Promise<boolean>
  mainLift?: string | null
  lastWeight?: number | null
  onWeight?: (w: number) => Promise<boolean>
  loggedType?: string | null
  loggedWeight?: number | null
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // 今天已經記了分化、但主項重量還空著 → 直接進「補一格重量」那態（重新整理後也還在）
  const needsWeight = !!loggedType && loggedType !== 'rest' && loggedType !== 'cardio'
    && loggedWeight == null && !!mainLift && !!onWeight
  const [picked, setPicked] = useState<string | null>(needsWeight ? loggedType! : null)
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const tap = async (t: string) => {
    setBusy(true); const ok = await onSubmit(t); setBusy(false)
    if (!ok) return
    // 重訓且知道主項 → 就地問一格重量；有氧/休息沒有主項可問，直接收起來
    if (onWeight && mainLift && t !== 'rest' && t !== 'cardio') setPicked(t)
    else setDone(true)
  }
  const submitWeight = async () => {
    const w = parseFloat(val)
    if (isNaN(w) || w <= 0 || w > 500) return
    setBusy(true); const ok = await onWeight!(w); setBusy(false)
    if (ok) setSaved(w)
  }

  // 今天記過而且重量也有了 → 這張卡沒事做，收起來
  if (loggedType && loggedWeight != null && !picked) return null
  // 有氧/休息日記過了也不用問重量
  if (loggedType && !needsWeight && !picked) return null

  if (picked && !done) {
    return (
      <div className="mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
        {saved != null ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">主項 {mainLift}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-base font-bold text-slate-800 tabular-nums">{saved}</span>
              <span className="text-sm text-gray-400">kg</span>
              <Check className="w-4 h-4 text-emerald-500" />
            </span>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 font-medium mb-2">
              主項 {mainLift}
              {lastWeight != null && <span className="text-gray-400 font-normal">　上次 {lastWeight}kg</span>}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" step="0.5" value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitWeight() }}
                placeholder={lastWeight != null ? String(lastWeight) : '--'}
                aria-label={`${mainLift} 重量 (kg)`}
                className="flex-1 min-w-0 px-3 py-2 bg-white border border-primary-200 rounded-lg text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                autoComplete="off"
              />
              <span className="text-sm text-gray-400 shrink-0">kg</span>
              <button onClick={submitWeight} disabled={busy || !val}
                className="shrink-0 bg-primary-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors">
                {busy ? '…' : '記'}
              </button>
              <button onClick={() => setDone(true)}
                className="shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1">跳過</button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (done) return null
  const chip = 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-primary-50 hover:border-primary-300 disabled:opacity-40 transition-colors'
  return (
    <div className="mb-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
      <p className="text-sm text-gray-700 font-medium mb-2">今天練了哪裡？</p>
      <div className="flex flex-wrap gap-1.5">
        {([['push', '推'], ['pull', '拉'], ['legs', '腿'], ['full_body', '全身'], ['cardio', '有氧']] as const).map(([t, l]) => (
          <button key={t} onClick={() => tap(t)} disabled={busy} className={chip}>{l}</button>
        ))}
        <button onClick={() => tap('rest')} disabled={busy} className={`${chip} text-slate-500`}>休息</button>
      </div>
    </div>
  )
}

export default function QuickActions({ enabledSections, onNavigate, topSummary, showQuickWeight, onQuickWeight, todayWeight, showQuickNutrition, onQuickNutrition, showQuickSupplements, onQuickSupplements, showQuickWellness, onQuickWellness, showQuickTraining, onQuickTraining, todayMainLift, lastMainLiftWeight, onQuickCompoundWeight, todayTrainingType, todayCompoundWeight }: QuickActionsProps) {
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
              <span className="text-gray-500">今天碳水 <span className="font-semibold text-slate-700 tabular-nums">{topSummary.todayCarbs}g</span>（{topSummary.peakLabel || (topSummary.isTrainingDay ? '訓練日' : '休息日')}）</span>
            )}
          </div>
          {topSummary.streak != null && topSummary.streak >= 3 && (
            <span className="text-xs font-bold text-amber-600 tabular-nums">連續 {topSummary.streak} 天</span>
          )}
        </div>
      )}

      {/* 一鍵記今天體重（今天還沒量才出現） */}
      {showQuickWeight && onQuickWeight && <QuickWeightInline onSubmit={onQuickWeight} recordedWeight={todayWeight} />}

      {/* 一鍵記今天飲食達標（今天還沒記才出現） */}
      {showQuickNutrition && onQuickNutrition && <QuickNutritionInline onSubmit={onQuickNutrition} />}

      {/* 一鍵補品 / 感受 / 訓練（今天還沒記才出現）— 五項都能在首頁一下完成 */}
      {showQuickSupplements && onQuickSupplements && <QuickSupplementInline onSubmit={onQuickSupplements} />}
      {showQuickWellness && onQuickWellness && <QuickWellnessInline onSubmit={onQuickWellness} />}
      {showQuickTraining && onQuickTraining && (
        <QuickTrainingInline
          onSubmit={onQuickTraining}
          mainLift={todayMainLift}
          lastWeight={lastMainLiftWeight}
          onWeight={onQuickCompoundWeight}
          loggedType={todayTrainingType}
          loggedWeight={todayCompoundWeight}
        />
      )}

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
                : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-primary-50 hover:border-primary-300'
            }`}
          >
            <span className="mb-0.5 h-5 flex items-center justify-center">{s.completed ? <Check size={16} className="text-emerald-600" /> : s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-xs text-emerald-600 font-medium mt-2">今天全部完成</p>
      )}
    </div>
  )
}
