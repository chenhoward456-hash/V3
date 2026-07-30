'use client'

import { useState, useEffect, useCallback } from 'react'

interface IntakeRow {
  calories?: number | null
  protein_grams?: number | null
  carbs_grams?: number | null
  fat_grams?: number | null
}

interface TodayNutritionIntakeProps {
  clientCode: string
  date: string
  caloriesTarget?: number | null
  proteinTarget?: number | null
  /** 已解析為當日值（碳循環訓練/休息日、Peak Week 當日計畫） */
  carbsTarget?: number | null
  fatTarget?: number | null
  /** 當天 nutrition_logs 的實際攝取（可能是空的） */
  intake?: IntakeRow | null
  /** 訓練日 / 休息日 / Peak Week 階段標籤 */
  dayLabel?: string | null
  onMutate?: () => void
}

type MacroKey = 'protein_grams' | 'carbs_grams' | 'fat_grams'

const round = (n: number) => Math.round(n)

export default function TodayNutritionIntake({
  clientCode,
  date,
  caloriesTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  intake,
  dayLabel,
  onMutate,
}: TodayNutritionIntakeProps) {
  // 本地「已吃」狀態：拖進度條即時更新，放手才寫 DB
  const [eaten, setEaten] = useState({
    protein_grams: intake?.protein_grams ?? 0,
    carbs_grams: intake?.carbs_grams ?? 0,
    fat_grams: intake?.fat_grams ?? 0,
    calories: intake?.calories ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showMeal, setShowMeal] = useState(false)
  const [meal, setMeal] = useState({ carbs: '', protein: '', fat: '' })

  // intake 變了（SWR 重新抓 / 換日）→ 同步本地
  useEffect(() => {
    setEaten({
      protein_grams: intake?.protein_grams ?? 0,
      carbs_grams: intake?.carbs_grams ?? 0,
      fat_grams: intake?.fat_grams ?? 0,
      calories: intake?.calories ?? 0,
    })
  }, [intake?.protein_grams, intake?.carbs_grams, intake?.fat_grams, intake?.calories])

  const flashSaved = useCallback(() => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1400)
  }, [])

  // 拖進度條放手 → set 覆寫（連同重算的熱量一起寫，避免熱量條跟巨量對不上）
  const commitSet = useCallback(async (next: typeof eaten) => {
    setSaving(true)
    const kcal = round(next.protein_grams * 4 + next.carbs_grams * 4 + next.fat_grams * 9)
    // 熱量條樂觀更新：不等 SWR 回抓（否則按完達標熱量會停在舊值好幾秒）
    setEaten(prev => ({ ...prev, calories: kcal }))
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientCode,
          date,
          mode: 'set',
          protein_grams: round(next.protein_grams),
          carbs_grams: round(next.carbs_grams),
          fat_grams: round(next.fat_grams),
          calories: kcal,
        }),
      })
      if (!res.ok) throw new Error()
      flashSaved()
      onMutate?.()
    } catch {
      // 寫失敗就回到 intake 真值
      setEaten({
        protein_grams: intake?.protein_grams ?? 0,
        carbs_grams: intake?.carbs_grams ?? 0,
        fat_grams: intake?.fat_grams ?? 0,
        calories: intake?.calories ?? 0,
      })
    } finally {
      setSaving(false)
    }
  }, [clientCode, date, flashSaved, onMutate, intake])

  // 一鍵定位：「達標」= 拉條跳到目標值，「沒達標」= 歸零（懶得拖拉條時用）
  const setMacro = useCallback((key: MacroKey, v: number) => {
    const next = { ...eaten, [key]: round(v) }
    setEaten(next)
    commitSet(next)
  }, [eaten, commitSet])

  // 三個巨量一次全部對齊目標（只打一次 API）
  const hitAllTargets = useCallback(() => {
    const next = {
      ...eaten,
      protein_grams: proteinTarget != null ? round(proteinTarget) : eaten.protein_grams,
      carbs_grams: carbsTarget != null ? round(carbsTarget) : eaten.carbs_grams,
      fat_grams: fatTarget != null ? round(fatTarget) : eaten.fat_grams,
    }
    setEaten(next)
    commitSet(next)
  }, [eaten, commitSet, proteinTarget, carbsTarget, fatTarget])

  // + 記一餐 → add 累加（伺服器端在現有值上加，跟 LINE 記餐同路徑）
  const submitMeal = useCallback(async () => {
    const c = parseFloat(meal.carbs) || 0
    const p = parseFloat(meal.protein) || 0
    const f = parseFloat(meal.fat) || 0
    if (c === 0 && p === 0 && f === 0) return
    const kcal = round(p * 4 + c * 4 + f * 9)
    setSaving(true)
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientCode,
          date,
          mode: 'add',
          protein_grams: round(p),
          carbs_grams: round(c),
          fat_grams: round(f),
          calories: kcal,
        }),
      })
      if (!res.ok) throw new Error()
      // 樂觀更新本地（跟拖進度條同手感）：不等 SWR 回抓，記完立刻看到累加後的值
      setEaten(prev => ({
        protein_grams: prev.protein_grams + p,
        carbs_grams: prev.carbs_grams + c,
        fat_grams: prev.fat_grams + f,
        calories: prev.calories + kcal,
      }))
      setMeal({ carbs: '', protein: '', fat: '' })
      setShowMeal(false)
      flashSaved()
      onMutate?.()
    } catch {
      /* 靜默失敗，值不動 */
    } finally {
      setSaving(false)
    }
  }, [meal, clientCode, date, flashSaved, onMutate])

  const rows: { key: MacroKey; label: string; target: number | null | undefined; unit: string }[] = [
    { key: 'protein_grams', label: '蛋白質', target: proteinTarget, unit: 'g' },
    { key: 'carbs_grams', label: '碳水', target: carbsTarget, unit: 'g' },
    { key: 'fat_grams', label: '脂肪', target: fatTarget, unit: 'g' },
  ]
  const hasAnyTarget = !!(caloriesTarget || proteinTarget || carbsTarget || fatTarget)
  // 沒有任何目標的學員不顯示這張卡（相容舊資料 / 未設 macro）
  if (!hasAnyTarget) return null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-gray-900">今日營養攝取</h2>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-[11px] text-emerald-600 font-medium">已儲存</span>}
          {dayLabel && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{dayLabel}</span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">拖進度條設今天吃到哪；懶得拉就按「達標」直接對齊目標，或按「＋記一餐」累加</p>

      {/* 熱量：巨量算出來的，只顯示不拖 */}
      {caloriesTarget != null && (
        <CalorieBar eaten={eaten.calories} target={caloriesTarget} />
      )}

      {/* 三大巨量：可拖的進度條 */}
      <div className="space-y-4 mt-4">
        {rows.map(({ key, label, target, unit }) => {
          if (target == null) return null
          const value = eaten[key]
          const remaining = target - value
          const over = value > target
          const pct = Math.min((value / target) * 100, 100)
          const sliderMax = Math.max(round(target * 1.5), round(value), 1)
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[13px] font-medium text-slate-700">{label}</span>
                <span className="text-[13px] text-slate-500 tabular-nums">
                  <span className={`font-bold ${over ? 'text-rose-600' : 'text-slate-900'}`}>{round(value)}</span>
                  <span className="text-slate-400"> / {round(target)}{unit}</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={1}
                value={round(value)}
                aria-label={`${label}已吃`}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setEaten(prev => ({ ...prev, [key]: v }))
                }}
                onPointerUp={() => commitSet({ ...eaten, [key]: round(eaten[key]) })}
                onKeyUp={() => commitSet({ ...eaten, [key]: round(eaten[key]) })}
                disabled={saving}
                className="w-full appearance-none bg-transparent cursor-pointer disabled:opacity-60
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-600
                  [&::-webkit-slider-thumb]:shadow
                  [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-600"
                style={{
                  // 手機端 globals.css 把 input 撐到 min-height:44px（觸控區），
                  // 所以軌道用置中的 10px 色帶畫，看起來才是細拉條、手指還是有 44px 好按
                  background: `linear-gradient(to right, ${over ? '#e11d48' : '#1E4A73'} ${pct}%, #e2e8f0 ${pct}%) center / 100% 10px no-repeat`,
                  borderRadius: 9999,
                }}
              />
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-[11px] tabular-nums">
                  {over ? (
                    <span className="text-rose-600">超標 +{round(value - target)}{unit}</span>
                  ) : remaining <= 0 ? (
                    <span className="text-emerald-600">已達標</span>
                  ) : (
                    <span className="text-slate-400">還差 {round(remaining)}{unit}</span>
                  )}
                </p>
                {/* 一鍵定位：懶得拉拉條時直接按 */}
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMacro(key, target)}
                    disabled={saving}
                    aria-pressed={round(value) === round(target)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                      round(value) === round(target)
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary-300 hover:text-primary-600'
                    }`}
                  >
                    達標
                  </button>
                  <button
                    type="button"
                    onClick={() => setMacro(key, 0)}
                    disabled={saving}
                    aria-pressed={round(value) === 0}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                      round(value) === 0
                        ? 'bg-slate-100 border-slate-300 text-slate-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary-300 hover:text-primary-600'
                    }`}
                  >
                    沒達標
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 三個巨量一次達標（今天照目標吃完，一鍵） */}
      <button
        type="button"
        onClick={hitAllTargets}
        disabled={saving}
        className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-primary-50 hover:border-primary-300 disabled:opacity-50 transition-colors"
      >
        今天照目標吃 · 全部達標
      </button>

      {/* ＋記一餐 */}
      <div className="mt-3 pt-4 border-t border-slate-100">
        {!showMeal ? (
          <button
            onClick={() => setShowMeal(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-primary-50 hover:border-primary-300 transition-colors"
          >
            ＋ 記一餐
          </button>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {([['carbs', '碳水'], ['protein', '蛋白'], ['fat', '脂肪']] as const).map(([k, l]) => (
                <label key={k} className="block">
                  <span className="text-[11px] text-slate-500">{l} (g)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    value={meal[k]}
                    onChange={e => setMeal(prev => ({ ...prev, [k]: e.target.value }))}
                    placeholder="0"
                    className="mt-0.5 w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-base font-semibold text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-400"
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowMeal(false); setMeal({ carbs: '', protein: '', fat: '' }) }}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitMeal}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                {saving ? '…' : '加上去'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CalorieBar({ eaten, target }: { eaten: number; target: number }) {
  const over = eaten > target
  const pct = Math.min((eaten / target) * 100, 100)
  const remaining = target - eaten
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium text-slate-700">熱量</span>
        <span className="text-[13px] text-slate-500 tabular-nums">
          <span className={`font-bold ${over ? 'text-rose-600' : 'text-slate-900'}`}>{round(eaten)}</span>
          <span className="text-slate-400"> / {round(target)} kcal</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-primary-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] mt-1 tabular-nums">
        {over ? (
          <span className="text-rose-600">超標 +{round(eaten - target)} kcal</span>
        ) : remaining <= 0 ? (
          <span className="text-emerald-600">已達標</span>
        ) : (
          <span className="text-slate-400">還差 {round(remaining)} kcal</span>
        )}
      </p>
    </div>
  )
}
