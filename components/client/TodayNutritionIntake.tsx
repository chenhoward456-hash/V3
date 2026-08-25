'use client'

import { useState, useEffect, useCallback } from 'react'
import { needsProfessionalReferral, REFERRAL_NOTICE, toReferenceRange, type HealthScreening } from '@/lib/health-screening'

interface IntakeRow {
  calories?: number | null
  protein_grams?: number | null
  carbs_grams?: number | null
  fat_grams?: number | null
}

interface TodayNutritionIntakeProps {
  /** 入會健康篩檢；命中風險項目時營養目標降級為參考範圍＋轉介提示 */
  healthScreening?: HealthScreening | null
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
  healthScreening,
}: TodayNutritionIntakeProps) {
  const referralNeeded = needsProfessionalReferral(healthScreening)
  // 本地「已吃」狀態：拖進度條即時更新，放手才寫 DB
  const [eaten, setEaten] = useState({
    protein_grams: intake?.protein_grams ?? 0,
    carbs_grams: intake?.carbs_grams ?? 0,
    fat_grams: intake?.fat_grams ?? 0,
    calories: intake?.calories ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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
      setSaveError(null)
      flashSaved()
      onMutate?.()
    } catch {
      // ⚠️ 2026-08-25：這裡原本只把值彈回去、**什麼都不說**。
      // 學員看到的是「我拉了它自己跳回來」——分不出是存檔失敗還是系統不讓他改，
      // 震宣的原話就是「被控制住了」。失敗要講出來。
      setSaveError('沒存進去 — 檢查一下網路，再拉一次')
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

      {saveError && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-[11px] text-rose-700">{saveError}</p>
        </div>
      )}

      {/* ⚠️ 2026-08-25：碳循環的當日目標會隨「今天記了什麼訓練」改變 ——
          震宣早上看到訓練日 271g、照著吃，中午記了有氧之後目標變成休息日 108g，
          他瞬間從沒吃夠變成超標。目標被回溯改掉又沒人解釋，他的感受是「被控制住了」。
          規則本身是對的（碳水跟著重訓走），但一定要講出來為什麼。 */}
      {dayLabel === '休息日' && (
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          今天是有氧或休息日 → 碳水目標用休息日的量。
          <span className="text-slate-400">碳水跟著重訓走，這是碳循環的設計；記了重訓就會換成訓練日的量。</span>
        </p>
      )}

      {/* 健康篩檢降級：入會填的健康狀況命中風險項目時，這張卡不以「你的目標」呈現，
          改成參考範圍＋轉介專業。刻意不顯示任何病名或個別狀況（畫面可能被他人看見）。 */}
      {referralNeeded && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[12px] font-medium text-amber-900">先請專業評估再照著吃</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">{REFERRAL_NOTICE}</p>
          {caloriesTarget != null && toReferenceRange(caloriesTarget) && (
            <p className="mt-1.5 text-[11px] text-amber-900">
              一般參考範圍：<span className="font-semibold tabular-nums">{toReferenceRange(caloriesTarget)}</span> kcal／天
            </p>
          )}
        </div>
      )}

      {/* 熱量：巨量算出來的，只顯示不拖 */}
      {caloriesTarget != null && (
        <CalorieBar eaten={eaten.calories} target={caloriesTarget} />
      )}

      {/* 漏填提醒：熱量是三大巨量反算的（P×4+C×4+F×9），漏一格熱量就整天錯，而且畫面看起來
          像「他吃很少」。2026-08-11 實例：Sean 蛋白 185／碳水 230 都按了達標、脂肪停在 0
          → 熱量顯示 1660（實際 2245），教練據此以為他少吃 600 大卡。
          規則：已經開始記（至少一項 >0）但仍有項目掛 0 → 講出來還差多少熱量沒計入。 */}
      {(() => {
        const started = rows.some(r => r.target != null && eaten[r.key] > 0)
        const missing = rows.filter(r => r.target != null && eaten[r.key] === 0)
        if (!started || missing.length === 0) return null
        const uncounted = missing.reduce(
          (sum, r) => sum + (r.target ?? 0) * (r.key === 'fat_grams' ? 9 : 4), 0
        )
        return (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            {missing.map(r => r.label).join('、')}還沒記 — 照目標算的話，上面的熱量少計了約 {round(uncounted)} 大卡
          </p>
        )
      })()}

      {/* 三大巨量：可拖的進度條 */}
      <div className="space-y-4 mt-4">
        {rows.map(({ key, label, target, unit }) => {
          if (target == null) return null
          const value = eaten[key]
          const remaining = target - value
          const over = value > target
          const pct = Math.min((value / target) * 100, 100)
          // ⚠️ 2026-08-25（震宣：「我改不了我的食物營養素」「被控制住了」「拉不了」）：
          // 原本是 max(target×1.5, value)。當 value 已經 ≥ target×1.5 時，
          // 上限**剛好等於目前值** → 拉桿頂在最右邊，往右一格都拉不動，
          // 學員再多吃就記不進去了。
          // 震宣的實況：有氧日碳水目標 108（×1.5 = 162），他已經吃 162 → 上限 162 → 卡死。
          // 修法：上限永遠比目前值高一截，怎麼吃都記得進去。
          const sliderMax = Math.max(round(target * 1.5), round(value * 1.3), round(value) + 20, 1)
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
