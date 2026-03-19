'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TrainingPlan, TrainingPlanDay, TrainingPlanExercise } from '@/hooks/useClientData'

interface TodayWorkoutProps {
  trainingPlan: TrainingPlan
  todayTrainingType?: string | null  // 今天實際記錄的訓練類型（有記錄時覆蓋課表）
}

const DAY_LABELS: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
}

function getTaipeiDayOfWeek(): number {
  // Get current day in Asia/Taipei timezone
  // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
  // We need: 1=Mon, 2=Tue ... 7=Sun
  const now = new Date()
  const taipeiStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const taipeiDate = new Date(taipeiStr + 'T12:00:00')
  const jsDay = taipeiDate.getDay()
  return jsDay === 0 ? 7 : jsDay
}

export default function TodayWorkout({ trainingPlan, todayTrainingType }: TodayWorkoutProps) {
  const [showFullPlan, setShowFullPlan] = useState(false)

  const todayDow = useMemo(() => getTaipeiDayOfWeek(), [])
  const todayPlan = useMemo(
    () => trainingPlan.days.find(d => d.dayOfWeek === todayDow) || null,
    [trainingPlan, todayDow]
  )

  // 如果今天已記錄為「休息」，即使課表有訓練也顯示休息
  const isActualRest = todayTrainingType === 'rest'
  const showPlan = todayPlan && !isActualRest

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 mb-3">
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
            {isActualRest && todayPlan && (
              <p className="text-[10px] text-gray-400 mt-0.5">原定：{todayPlan.label}</p>
            )}
            {trainingPlan.name && (
              <p className="text-[10px] text-gray-400 mt-0.5">{trainingPlan.name}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">{DAY_LABELS[todayDow]}</span>
      </div>

      {/* Today's exercises or rest day */}
      {showPlan ? (
        <div className="bg-white/60 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-indigo-100 text-gray-500">
                <th className="text-left py-2 px-3 font-medium">動作</th>
                <th className="text-center py-2 px-2 font-medium">組x次</th>
                <th className="text-center py-2 px-2 font-medium">RPE</th>
                <th className="text-left py-2 px-2 font-medium">備註</th>
              </tr>
            </thead>
            <tbody>
              {todayPlan.exercises.map((ex, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-b-0">
                  <td className="py-2 px-3 font-medium text-gray-800">{ex.name}</td>
                  <td className="py-2 px-2 text-center text-gray-600">
                    {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.sets || ex.reps || '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {ex.rpe ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        Number(ex.rpe) >= 9 ? 'bg-red-100 text-red-700' :
                        Number(ex.rpe) >= 7 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {ex.rpe}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-gray-500 max-w-[100px] truncate">{ex.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white/60 rounded-xl p-6 text-center">
          <span className="text-3xl block mb-2">🛌</span>
          <p className="text-sm text-gray-500">好好休息，明天繼續加油！</p>
        </div>
      )}

      {/* Toggle full weekly plan */}
      <button
        onClick={() => setShowFullPlan(!showFullPlan)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
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
                    isToday ? 'bg-gray-100 ring-1 ring-indigo-200' : 'bg-gray-50'
                  }`}
                >
                  <span className="text-gray-400">
                    {DAY_LABELS[dow]} — 休息日
                    {isToday && <span className="ml-1 text-indigo-500 font-medium">(今天)</span>}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={dow}
                className={`rounded-lg p-3 ${
                  isToday
                    ? 'bg-indigo-50 ring-1 ring-indigo-200'
                    : 'bg-white/80'
                }`}
              >
                <p className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {DAY_LABELS[dow]} — {day.label}
                  {isToday && <span className="ml-1 text-indigo-500">(今天)</span>}
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
