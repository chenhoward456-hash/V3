'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TrainingPlan, TrainingPlanExercise } from '@/hooks/useClientData'
import { getCycleState, applyDeloadToDay, getTaipeiDayOfWeek } from '@/lib/periodization'
import { labelToTrainingType } from '@/lib/training-split'

interface TodayWorkoutProps {
  trainingPlan: TrainingPlan
  todayTrainingType?: string | null  // 今天實際記錄的訓練類型（有記錄時覆蓋課表）
}

const DAY_LABELS: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
}

export default function TodayWorkout({ trainingPlan, todayTrainingType }: TodayWorkoutProps) {
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
    const match = trainingDays.find(d => labelToTrainingType(d.label) === todayTrainingType)
    return match?.dayOfWeek ?? null
  }, [todayTrainingType, trainingDays])

  const hasScheduledToday = trainingDays.some(d => d.dayOfWeek === todayDow)

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
  const scheduledLabel = trainingDays.find(d => d.dayOfWeek === todayDow)?.label ?? '休息'
  // 清掉手動切換後會回到的預設分化（記錄優先，否則星期）
  const defaultLabel = defaultDow != null
    ? trainingDays.find(d => d.dayOfWeek === defaultDow)?.label ?? '休息'
    : '休息'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isActualRest ? '😴' : '🏋️'}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {isActualRest
                ? '今天休息'
                : showPlan
                ? `今日訓練 — ${todayPlan!.label}`
                : '今天是休息日'}
            </h3>
            {isActualRest && (
              <p className="text-[11px] text-gray-400 mt-0.5">原定：{scheduledLabel}</p>
            )}
            {!isActualRest && isSwitched && (
              <p className="text-[11px] text-blue-600 mt-0.5">
                目前顯示 {todayPlan!.label}（今天原定：{scheduledLabel}）
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  {d.label}
                  {isScheduled && (
                    <span className={active ? 'ml-1 text-blue-100' : 'ml-1 text-blue-500'}>·今天</span>
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
                <th className="text-left py-2 px-2 font-medium">備註</th>
              </tr>
            </thead>
            <tbody>
              {todayPlan.exercises.map((rawEx, i) => {
                const ex = rawEx as TrainingPlanExercise & {
                  deloadAdjusted?: boolean
                  originalSets?: string
                  originalRpe?: string
                }
                return (
                <tr key={i} className="border-b border-slate-200 last:border-b-0">
                  <td className="py-2 px-3 font-medium text-gray-800">{ex.name}</td>
                  <td className="py-2 px-2 text-center text-gray-600 tabular-nums">
                    {ex.originalSets && (
                      <span className="line-through text-gray-300 mr-1">{ex.originalSets}</span>
                    )}
                    {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.sets || ex.reps || '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
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
                  <td className="py-2 px-2 text-gray-500 max-w-[100px] truncate">{ex.note || ''}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <span className="text-3xl block mb-2">🛌</span>
          <p className="text-sm text-gray-500">今天原定休息。想練別的？點上面的分化就會跳出對應動作。</p>
        </div>
      )}

      {/* 提示 */}
      {showPlan && (
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          這是教練安排的參考課表。今天做別的分化，點上方切換即可。
          {'\n'}想長期改課表？在 LINE 跟教練說一聲 💬
        </p>
      )}

      {/* Toggle full weekly plan */}
      <button
        onClick={() => setShowFullPlan(!showFullPlan)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
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
                    isToday ? 'bg-slate-100 ring-1 ring-blue-200' : 'bg-slate-50'
                  }`}
                >
                  <span className="text-gray-400">
                    {DAY_LABELS[dow]} — 休息日
                    {isToday && <span className="ml-1 text-blue-600 font-medium">(今天)</span>}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={dow}
                className={`rounded-lg p-3 ${
                  isToday
                    ? 'bg-blue-50 ring-1 ring-blue-200'
                    : 'bg-slate-50'
                }`}
              >
                <p className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                  {DAY_LABELS[dow]} — {day.label}
                  {isToday && <span className="ml-1 text-blue-600">(今天)</span>}
                </p>
                <div className="space-y-0.5">
                  {day.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span className="font-medium text-gray-700 min-w-0 truncate flex-1">{ex.name}</span>
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
