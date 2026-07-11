'use client'

import { useState } from 'react'

interface EngineStatus {
  status: string
  statusLabel: string
  message: string
}

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
  engineStatus?: EngineStatus | null
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
  engineStatus,
}: DailyNutritionTargetProps) {
  const [manualDayType, setManualDayType] = useState<'training' | 'rest' | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const effectiveIsTraining = manualDayType != null ? manualDayType === 'training' : !!isTrainingDay

  const effectiveCarbsTarget = carbsCyclingEnabled && carbsTrainingDay != null && carbsRestDay != null
    ? (effectiveIsTraining ? carbsTrainingDay : carbsRestDay)
    : carbsTarget

  // 直接使用 DB 的 calories_target，不從 macro 反算（避免跟 NutritionLog 不一致）
  const effectiveCalories = caloriesTarget

  // 沒有任何目標值時不顯示
  if (!effectiveCalories && !proteinTarget && !effectiveCarbsTarget && !fatTarget) return null

  const items = [
    { label: '熱量', value: effectiveCalories, unit: 'kcal' },
    { label: '蛋白質', value: proteinTarget, unit: 'g' },
    { label: '碳水', value: effectiveCarbsTarget, unit: 'g' },
    { label: '脂肪', value: fatTarget, unit: 'g' },
  ].filter(item => item.value)

  if (items.length === 0) return null

  const hasCarbCycling = carbsCyclingEnabled && carbsTrainingDay != null && carbsRestDay != null

  // 狀態徽章：有動作感的標籤
  const statusBadge = engineStatus ? (() => {
    const map: Record<string, { label: string; color: string }> = {
      on_track: { label: '穩步執行中', color: 'bg-emerald-50 text-emerald-600' },
      goal_driven: { label: '目標導向模式', color: 'bg-primary-50 text-primary-700' },
      too_fast: { label: '啟動護肌模式', color: 'bg-amber-50 text-amber-700' },
      plateau: { label: '突破停滯調整', color: 'bg-amber-50 text-amber-700' },
      wrong_direction: { label: '策略修正中', color: 'bg-rose-50 text-rose-600' },
      peak_week: { label: 'Peak Week 執行中', color: 'bg-slate-100 text-slate-600' },
    }
    return map[engineStatus.status] || null
  })() : null

  // 非「進度正常」的狀態 = 有策略調整，顯示 Protocol Update
  const hasProtocolUpdate = engineStatus && engineStatus.status !== 'on_track' && engineStatus.status !== 'insufficient_data'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      {/* Protocol Update 卡片 — 策略調整時才出現 */}
      {hasProtocolUpdate && engineStatus && (
        <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">系統調整通知</span>
            </div>
            {statusBadge && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">{engineStatus.message}</p>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="mt-2 text-[11px] text-primary-500 hover:text-primary-700 transition-colors"
          >
            {showExplanation ? '收起詳情 ▲' : '查看底層計算邏輯 ▼'}
          </button>
          {showExplanation && (
            <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-0.5">
              <p>狀態：{engineStatus.status}（{engineStatus.statusLabel}）</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">今日飲食目標</h2>
          {/* 狀態徽章 — 常駐顯示 */}
          {statusBadge && !hasProtocolUpdate && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
        {hasCarbCycling && (
          <button
            onClick={() => setManualDayType(effectiveIsTraining ? 'rest' : 'training')}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              effectiveIsTraining ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {effectiveIsTraining ? '訓練日' : '休息日'} ▾
          </button>
        )}
      </div>
      <div className={`bg-slate-50 border border-slate-200 rounded-2xl p-4`}>
        <div className={`grid gap-2 ${
          { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[items.length] || 'grid-cols-4'
        }`}>
          {items.map(({ label, value, unit }) => (
            <div key={label} className="text-center bg-white rounded-xl py-2 px-1">
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{value || '--'}</p>
              <p className="text-[11px] text-gray-400">{unit}</p>
            </div>
          ))}
        </div>
        {hasCarbCycling && (
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            碳水循環：訓練日 {carbsTrainingDay}g ／ 休息日 {carbsRestDay}g
          </p>
        )}
        {geneticCorrections && geneticCorrections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
            {geneticCorrections.map((gc, i) => (
              <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                <span>{gc.adjustment}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
