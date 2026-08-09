'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TrainingPlan, TrainingPlanExercise } from '@/hooks/useClientData'
import { getCycleState, applyDeloadToDay, getTaipeiDayOfWeek } from '@/lib/periodization'
import { labelToTrainingType, splitDisplayLabel } from '@/lib/training-split'

interface TodayWorkoutProps {
  trainingPlan: TrainingPlan
  todayTrainingType?: string | null  // 今天實際記錄的訓練類型（有記錄時覆蓋課表）
  onOverrideTypeChange?: (type: string | null) => void  // 手動切分化時通知父層同步記錄表單
  // 目前顯示的是課表裡哪一天（dayOfWeek）。同一個分化可能有兩天（拉A/拉B），
  // 只傳 type 沒辦法讓下方記錄表單分辨，所以要一起傳 dayOfWeek。
  onSelectedDayChange?: (dayOfWeek: number | null) => void
}

const DAY_LABELS: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
}

export default function TodayWorkout({ trainingPlan, todayTrainingType, onOverrideTypeChange, onSelectedDayChange }: TodayWorkoutProps) {
  const [showFullPlan, setShowFullPlan] = useState(false)
  // 手動切換的分化（null = 沿用預設）。點課表卡上方的分化 chip 才會設值。
  const [overrideDow, setOverrideDow] = useState<number | null>(null)

  const todayDow = useMemo(() => getTaipeiDayOfWeek(), [])
  // 週期狀態（沒 mesocycle = null，UI 完全不出現，現狀不變）
  const cycle = useMemo(() => getCycleState(trainingPlan), [trainingPlan])

  // 課表裡有排的訓練日（休息日不在 days 裡），依星期排序當作可切換的分化清單
  const trainingDays = useMemo(
    () => [...trainingPlan.days].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    [trainingPlan]
  )

  // 今天實際記錄的類型 → 對應到課表裡哪一天的分化（例：記錄 pull → Pull Day）
  const recordedDow = useMemo(() => {
    if (!todayTrainingType || todayTrainingType === 'rest') return null
    // 同一個類型可能排兩天（例：拉A 背厚度 / 拉B 背寬度）。
    // 今天星期原本就排這個類型 → 直接用今天，不要退回去抓排在最前面的那一天。
    const todayDay = trainingDays.find(d => d.dayOfWeek === todayDow)
    if (todayDay && labelToTrainingType(todayDay.label) === todayTrainingType) return todayDow
    const match = trainingDays.find(d => labelToTrainingType(d.label) === todayTrainingType)
    return match?.dayOfWeek ?? null
  }, [todayTrainingType, trainingDays, todayDow])

  const hasScheduledToday = trainingDays.some(d => d.dayOfWeek === todayDow)

  // 同一個分化排兩天時（拉A 背厚度 / 拉B 背寬度），兩個 chip 都只顯示「拉」→ 使用者
  // 分不出自己切到哪一天，切換後的標題也是「目前顯示 拉（今天原定：拉）」。
  // 有重複的類型才補上星期當識別；只排一天的維持原本簡潔顯示。
  const duplicatedTypes = useMemo(() => {
    const count: Record<string, number> = {}
    for (const d of trainingDays) {
      const key = labelToTrainingType(d.label) || d.label || ''
      count[key] = (count[key] || 0) + 1
    }
    return new Set(Object.keys(count).filter(k => count[k] > 1))
  }, [trainingDays])

  const dayLabelOf = (day: { label?: string; dayOfWeek: number } | null | undefined, withEmoji = false) => {
    if (!day) return ''
    const base = splitDisplayLabel(day.label, withEmoji)
    const key = labelToTrainingType(day.label) || day.label || ''
    return duplicatedTypes.has(key) ? `${base}·${DAY_LABELS[day.dayOfWeek] ?? ''}` : base
  }

  // 預設選哪個分化：①已記錄 → 記錄對應的分化 ②否則 → 今天星期排定的分化
  const defaultDow = recordedDow ?? (hasScheduledToday ? todayDow : null)
  // 實際顯示的分化：手動切換優先
  const effectiveDow = overrideDow ?? defaultDow

  const todayPlan = useMemo(() => {
    const raw = effectiveDow != null
      ? trainingDays.find(d => d.dayOfWeek === effectiveDow) ?? null
      : null
    // 減量週：只換算主項顯示（RPE 上限 6、組數 -2 下限 2），附屬照舊
    if (raw && cycle?.isDeloadWeek) return applyDeloadToDay(raw)
    return raw
  }, [trainingDays, effectiveDow, cycle])

  // 今天已記錄為「休息」且沒手動切分化 → 顯示休息
  const isActualRest = todayTrainingType === 'rest' && overrideDow == null
  const showPlan = todayPlan && !isActualRest

  // 顯示的分化 ≠ 今天星期原定 → 提示（不管是自動跟記錄還是手動切）
  const isSwitched = effectiveDow != null && effectiveDow !== todayDow
  const scheduledDay = trainingDays.find(d => d.dayOfWeek === todayDow)
  const scheduledLabel = scheduledDay ? dayLabelOf(scheduledDay) : '休息'
  // 清掉手動切換後會回到的預設分化（記錄優先，否則星期）
  const defaultDay = defaultDow != null ? trainingDays.find(d => d.dayOfWeek === defaultDow) : null
  const defaultLabel = defaultDay ? dayLabelOf(defaultDay) : '休息'

  // 手動切分化 → 通知父層把下方「記錄動作明細」的訓練類型也預選好（沒切=null，父層沿用預設）
  useEffect(() => {
    if (!onOverrideTypeChange) return
    const day = overrideDow != null ? trainingDays.find(d => d.dayOfWeek === overrideDow) : null
    onOverrideTypeChange(day ? labelToTrainingType(day.label) : null)
  }, [overrideDow, trainingDays, onOverrideTypeChange])

  // 一併把「目前是課表哪一天」告訴父層——拉A / 拉B 同類型，靠 dayOfWeek 才分得出來
  useEffect(() => {
    onSelectedDayChange?.(effectiveDow)
  }, [effectiveDow, onSelectedDayChange])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {isActualRest
                ? '今天休息'
                : showPlan
                ? `今日訓練 — ${dayLabelOf(todayPlan)}`
                : '今天是休息日'}
            </h3>
            {isActualRest && (
              <p className="text-[11px] text-gray-400 mt-0.5">原定：{scheduledLabel}</p>
            )}
            {!isActualRest && isSwitched && (
              <p className="text-[11px] text-primary-600 mt-0.5">
                目前顯示 {dayLabelOf(todayPlan)}（今天原定：{scheduledLabel}）
              </p>
            )}
            {trainingPlan.name && (
              <p className="text-[11px] text-gray-400 mt-0.5">{trainingPlan.name}</p>
            )}
            {cycle && !cycle.ended && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                第 {cycle.week} 週 / 共 {cycle.totalWeeks} 週
                {cycle.blockLabel && <> · {cycle.blockLabel}</>}
                {cycle.isDeloadWeek && (
                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium align-middle">
                    本週減量週
                  </span>
                )}
              </p>
            )}
            {cycle?.ended && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                週期已結束（共 {cycle.totalWeeks} 週），等教練排下一塊
                {cycle.blockLabel && <> · {cycle.blockLabel}</>}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">{DAY_LABELS[todayDow]}</span>
      </div>

      {/* 分化切換：今天不照課表練？點一下就跳對應動作 */}
      {trainingDays.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {trainingDays.map(d => {
              const active = d.dayOfWeek === effectiveDow
              const isScheduled = d.dayOfWeek === todayDow
              return (
                <button
                  key={d.dayOfWeek}
                  onClick={() => setOverrideDow(d.dayOfWeek)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  {dayLabelOf(d, true)}
                  {isScheduled && (
                    <span className={active ? 'ml-1 text-primary-100' : 'ml-1 text-primary-500'}>·今天</span>
                  )}
                </button>
              )
            })}
          </div>
          {overrideDow != null && overrideDow !== defaultDow && (
            <button
              onClick={() => setOverrideDow(null)}
              className="mt-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              回預設（{defaultLabel}）
            </button>
          )}
        </div>
      )}

      {/* 減量週說明（中性小字，不搶版面） */}
      {showPlan && cycle?.isDeloadWeek && (
        <p className="text-[11px] text-gray-500 mb-2">
          本週是課表排定的減量週：主項已自動換算（RPE 上限 6、組數 −2），附屬動作照舊。
        </p>
      )}

      {/* Today's exercises or rest day */}
      {showPlan ? (
        <div className="bg-slate-50 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-gray-500">
                <th className="text-left py-2 px-3 font-medium">動作</th>
                <th className="text-center py-2 px-2 font-medium">組x次</th>
                <th className="text-center py-2 px-2 font-medium">RPE</th>
              </tr>
            </thead>
            <tbody>
              {todayPlan.exercises.map((rawEx, i) => {
                const ex = rawEx as TrainingPlanExercise & {
                  deloadAdjusted?: boolean
                  originalSets?: string
                  originalRpe?: string
                }
                const hasNote = !!(ex.note && ex.note.trim())
                return (
                <Fragment key={i}>
                <tr className={hasNote ? '' : 'border-b border-slate-200 last:border-b-0'}>
                  <td className={`px-3 font-medium text-gray-800 ${hasNote ? 'pt-2 pb-1' : 'py-2'}`}>{ex.name}</td>
                  <td className={`px-2 text-center align-top text-gray-600 tabular-nums ${hasNote ? 'pt-2 pb-1' : 'py-2'}`}>
                    {ex.originalSets && (
                      <span className="line-through text-gray-300 mr-1">{ex.originalSets}</span>
                    )}
                    {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.sets || ex.reps || '-'}
                  </td>
                  <td className={`px-2 text-center align-top ${hasNote ? 'pt-2 pb-1' : 'py-2'}`}>
                    {ex.originalRpe && (
                      <span className="line-through text-gray-300 text-[11px] mr-1 tabular-nums">{ex.originalRpe}</span>
                    )}
                    {ex.rpe ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums ${
                        Number(ex.rpe) >= 9 ? 'bg-rose-100 text-rose-700' :
                        Number(ex.rpe) >= 7 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {ex.rpe}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
                {/* 備註獨立一列（colSpan 全寬、不截字、可換行）：教練寫的動作提醒要看得完 */}
                {hasNote && (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={3} className="px-3 pb-2 text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
                      {ex.note}
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500">今天原定休息。想練別的？點上面的分化就會跳出對應動作。</p>
        </div>
      )}

      {/* 提示 */}
      {showPlan && (
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          這是教練安排的參考課表。今天做別的分化，點上方切換即可。
          {'\n'}想長期改課表？在 LINE 跟教練說一聲
        </p>
      )}

      {/* Toggle full weekly plan */}
      <button
        onClick={() => setShowFullPlan(!showFullPlan)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 text-xs text-primary-600 hover:text-primary-700 transition-colors"
      >
        <span>{showFullPlan ? '收合週課表' : '查看完整週課表'}</span>
        <ChevronDown size={14} className={`transition-transform ${showFullPlan ? 'rotate-180' : ''}`} />
      </button>

      {/* Full weekly plan */}
      {showFullPlan && (
        <div className="mt-2 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map(dow => {
            const day = trainingPlan.days.find(d => d.dayOfWeek === dow)
            const isToday = dow === todayDow

            if (!day) {
              return (
                <div
                  key={dow}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    isToday ? 'bg-slate-100 ring-1 ring-primary-200' : 'bg-slate-50'
                  }`}
                >
                  <span className="text-gray-400">
                    {DAY_LABELS[dow]} — 休息日
                    {isToday && <span className="ml-1 text-primary-600 font-medium">(今天)</span>}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={dow}
                className={`rounded-lg p-3 ${
                  isToday
                    ? 'bg-primary-50 ring-1 ring-primary-200'
                    : 'bg-slate-50'
                }`}
              >
                <p className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-primary-700' : 'text-gray-700'}`}>
                  {DAY_LABELS[dow]} — {splitDisplayLabel(day.label)}
                  {isToday && <span className="ml-1 text-primary-600">(今天)</span>}
                </p>
                <div className="space-y-0.5">
                  {day.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span className="font-medium text-gray-700 min-w-0 flex-1 break-words">{ex.name}</span>
                      <span className="text-gray-400 shrink-0">
                        {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ''}
                        {ex.rpe ? ` @${ex.rpe}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
