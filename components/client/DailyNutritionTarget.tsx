'use client'

import { useState } from 'react'

interface DailyNutritionTargetProps {
  caloriesTarget?: number | null
  proteinTarget?: number | null
  carbsTarget?: number | null
  fatTarget?: number | null
  carbsCyclingEnabled?: boolean
  isTrainingDay?: boolean
  carbsTrainingDay?: number | null
  carbsRestDay?: number | null
  geneticCorrections?: { gene: string; rule: string; adjustment: string }[]
}

export default function DailyNutritionTarget({
  caloriesTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  carbsCyclingEnabled,
  isTrainingDay,
  carbsTrainingDay,
  carbsRestDay,
  geneticCorrections,
}: DailyNutritionTargetProps) {
  const [manualDayType, setManualDayType] = useState<'training' | 'rest' | null>(null)
  const effectiveIsTraining = manualDayType != null ? manualDayType === 'training' : !!isTrainingDay

  const effectiveCarbsTarget = carbsCyclingEnabled && carbsTrainingDay != null && carbsRestDay != null
    ? (effectiveIsTraining ? carbsTrainingDay : carbsRestDay)
    : carbsTarget

  // 直接使用 DB 的 calories_target，不從 macro 反算（避免跟 NutritionLog 不一致）
  const effectiveCalories = caloriesTarget

  // 沒有任何目標值時不顯示
  if (!effectiveCalories && !proteinTarget && !effectiveCarbsTarget && !fatTarget) return null

  const items = [
    { label: '熱量', value: effectiveCalories, unit: 'kcal', emoji: '🔥' },
    { label: '蛋白質', value: proteinTarget, unit: 'g', emoji: '🥩' },
    { label: '碳水', value: effectiveCarbsTarget, unit: 'g', emoji: '🍚' },
    { label: '脂肪', value: fatTarget, unit: 'g', emoji: '🥑' },
  ].filter(item => item.value)

  if (items.length === 0) return null

  const hasCarbCycling = carbsCyclingEnabled && carbsTrainingDay != null && carbsRestDay != null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h2 className="text-base font-bold text-gray-900">今日飲食目標</h2>
        </div>
        {hasCarbCycling && (
          <button
            onClick={() => setManualDayType(effectiveIsTraining ? 'rest' : 'training')}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              effectiveIsTraining ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {effectiveIsTraining ? '🏋️ 訓練日' : '🛋️ 休息日'} ▾
          </button>
        )}
      </div>
      <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4`}>
        <div className={`grid gap-2 ${
          { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[items.length] || 'grid-cols-4'
        }`}>
          {items.map(({ label, value, unit, emoji }) => (
            <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
              <p className="text-[10px] text-gray-500">{emoji} {label}</p>
              <p className="text-lg font-bold text-gray-900">{value || '--'}</p>
              <p className="text-[10px] text-gray-400">{unit}</p>
            </div>
          ))}
        </div>
        {hasCarbCycling && (
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            碳水循環：訓練日 {carbsTrainingDay}g ／ 休息日 {carbsRestDay}g
          </p>
        )}
        {geneticCorrections && geneticCorrections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-100 space-y-1">
            {geneticCorrections.map((gc, i) => (
              <p key={i} className="text-[11px] text-purple-600 flex items-start gap-1">
                <span className="shrink-0">🧬</span>
                <span>{gc.adjustment}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
