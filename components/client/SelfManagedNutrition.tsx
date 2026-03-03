'use client'

import { useState, useEffect } from 'react'

interface SelfManagedNutritionProps {
  clientId: string  // UUID (internal ID)
  uniqueCode: string  // unique_code (for PATCH API)
  goalType: string | null
  activityProfile: string | null
  isTrainingDay?: boolean
  onMutate?: () => void
}

export default function SelfManagedNutrition({
  clientId,
  uniqueCode,
  goalType,
  activityProfile,
  isTrainingDay,
  onMutate,
}: SelfManagedNutritionProps) {
  const [data, setData] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState<'goal' | 'activity' | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<'cut' | 'bulk' | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<'sedentary' | 'high_energy_flux'>('sedentary')
  const [submitting, setSubmitting] = useState(false)

  // 需要設定 goal_type 才能開始
  const needsOnboarding = !goalType

  useEffect(() => {
    if (needsOnboarding) {
      setSetupStep('goal')
      setLoading(false)
      return
    }

    const fetchSuggestion = async () => {
      try {
        const res = await fetch(`/api/nutrition-suggestions?clientId=${clientId}&autoApply=true`)
        if (!res.ok) return
        const json = await res.json()
        if (json.suggestion) {
          setData(json.suggestion)
          setMeta(json.meta || null)
          if (json.applied && onMutate) {
            onMutate()
          }
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchSuggestion()
  }, [clientId, needsOnboarding, onMutate])

  const handleSetup = async () => {
    if (!selectedGoal) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: uniqueCode,
          goal_type: selectedGoal,
          activity_profile: selectedActivity,
        }),
      })
      if (res.ok) {
        // Refresh the page to load with new settings
        if (onMutate) onMutate()
        window.location.reload()
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false) }
  }

  // Onboarding 畫面
  if (needsOnboarding || setupStep) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold text-gray-900">設定你的營養目標</h2>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          告訴系統你的目標，我們會根據你的體重數據自動計算每日該吃多少。
        </p>

        {/* Step 1: 目標選擇 */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-700 mb-3">你的目標是？</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedGoal('cut')}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedGoal === 'cut'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl block mb-1">🔥</span>
              <p className="text-sm font-bold text-gray-900">減脂</p>
              <p className="text-[11px] text-gray-500 mt-1">降低體脂率、改善體態</p>
            </button>
            <button
              onClick={() => setSelectedGoal('bulk')}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedGoal === 'bulk'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl block mb-1">💪</span>
              <p className="text-sm font-bold text-gray-900">增肌</p>
              <p className="text-[11px] text-gray-500 mt-1">增加肌肉量、提升力量</p>
            </button>
          </div>
        </div>

        {/* Step 2: 活動量 */}
        {selectedGoal && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-700 mb-3">你的日常活動量？</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedActivity('sedentary')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedActivity === 'sedentary'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">🖥️</span>
                <p className="text-sm font-bold text-gray-900">上班族</p>
                <p className="text-[11px] text-gray-500 mt-1">久坐為主、步數偏少</p>
              </button>
              <button
                onClick={() => setSelectedActivity('high_energy_flux')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedActivity === 'high_energy_flux'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">🚶</span>
                <p className="text-sm font-bold text-gray-900">高活動量</p>
                <p className="text-[11px] text-gray-500 mt-1">日常步數多、體力勞動</p>
              </button>
            </div>
          </div>
        )}

        {/* 送出 */}
        {selectedGoal && (
          <button
            onClick={handleSetup}
            disabled={submitting}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '設定中...' : '開始計算我的營養目標'}
          </button>
        )}
      </div>
    )
  }

  if (loading) return null
  if (!data) return null

  // 數據不足
  if (data.status === 'insufficient_data') {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🤖</span>
          <h2 className="text-lg font-bold text-gray-900">智能營養計算</h2>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          需要至少 2 週的體重數據，系統才能開始自動計算你的營養目標。請每天記錄體重！
        </div>
        <div className="mt-3 bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500">目前設定</p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {goalType === 'cut' ? '🔥 減脂' : '💪 增肌'}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              {activityProfile === 'high_energy_flux' ? '🚶 高活動量' : '🖥️ 上班族'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 碳循環
  const hasCarbCycling = data.suggestedCarbsTrainingDay != null && data.suggestedCarbsRestDay != null
  const todayCarbs = hasCarbCycling
    ? (isTrainingDay ? data.suggestedCarbsTrainingDay : data.suggestedCarbsRestDay)
    : data.suggestedCarbs

  // 狀態顏色
  const statusConfig: Record<string, { bg: string; border: string; text: string }> = {
    on_track: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    too_fast: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    plateau: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    wrong_direction: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    goal_driven: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  }
  const config = statusConfig[data.status] || statusConfig.on_track

  // 穿戴裝置回饋
  const WearableInsightCard = () => {
    if (!data.wearableInsight) return null
    const stateConfig: Record<string, { bg: string; border: string; text: string; emoji: string; label: string }> = {
      optimal: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', emoji: '💪', label: '恢復極佳' },
      good: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', emoji: '👍', label: '恢復正常' },
      struggling: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', emoji: '⚠️', label: '恢復偏低' },
      critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', emoji: '🚨', label: '恢復不足' },
    }
    const sc = stateConfig[data.currentState] || stateConfig.good
    return (
      <div className={`mt-3 ${sc.bg} border ${sc.border} rounded-2xl p-4`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">⌚</span>
            <p className={`text-xs font-bold ${sc.text}`}>{sc.emoji} {sc.label}</p>
          </div>
          {data.readinessScore != null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              {data.readinessScore}/100
            </span>
          )}
        </div>
        <p className={`text-xs ${sc.text} leading-relaxed`}>{data.wearableInsight}</p>
      </div>
    )
  }

  // 體重變化率
  const changeRate = data.weeklyWeightChangeRate
  const changeRateText = changeRate != null
    ? changeRate === 0 ? '持平' : `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%`
    : null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h2 className="text-lg font-bold text-gray-900">智能營養計算</h2>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          goalType === 'cut' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
        }`}>
          {goalType === 'cut' ? '🔥 減脂中' : '💪 增肌中'}
        </span>
      </div>

      {/* 狀態 */}
      <div className={`${config.bg} ${config.border} border rounded-2xl px-4 py-3 mb-4`}>
        <p className={`text-sm font-semibold ${config.text}`}>
          {data.statusEmoji} {data.statusLabel}
        </p>
        <p className={`text-xs ${config.text} mt-1 opacity-80`}>
          {data.message}
        </p>
      </div>

      {/* 今日飲食目標 */}
      {data.suggestedCalories && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">📋 今日飲食目標</p>
            {hasCarbCycling && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isTrainingDay ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isTrainingDay ? '🏋️ 訓練日' : '🛋️ 休息日'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '熱量', value: data.suggestedCalories, unit: 'kcal', emoji: '🔥' },
              { label: '蛋白質', value: data.suggestedProtein, unit: 'g', emoji: '🥩' },
              { label: '碳水', value: todayCarbs, unit: 'g', emoji: '🍚' },
              { label: '脂肪', value: data.suggestedFat, unit: 'g', emoji: '🥑' },
            ].map(({ label, value, unit, emoji }) => (
              <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
                <p className="text-[10px] text-gray-500">{emoji} {label}</p>
                <p className="text-lg font-bold text-gray-900">{value || '--'}</p>
                <p className="text-[10px] text-gray-400">{unit}</p>
              </div>
            ))}
          </div>
          {hasCarbCycling && (
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              碳水循環：訓練日 {data.suggestedCarbsTrainingDay}g ／ 休息日 {data.suggestedCarbsRestDay}g
            </p>
          )}
        </div>
      )}

      {/* 關鍵數據 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {data.estimatedTDEE && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">預估 TDEE</p>
            <p className="text-lg font-bold text-gray-900">{data.estimatedTDEE}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>
        )}
        {changeRateText && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">本週體重</p>
            <p className={`text-lg font-bold ${
              goalType === 'cut'
                ? (changeRate! < 0 ? 'text-green-600' : 'text-red-600')
                : (changeRate! > 0 ? 'text-green-600' : 'text-red-600')
            }`}>{changeRateText}</p>
            <p className="text-[10px] text-gray-400">/週</p>
          </div>
        )}
        {data.estimatedTDEE && data.suggestedCalories && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">{goalType === 'cut' ? '每日赤字' : '每日盈餘'}</p>
            <p className={`text-lg font-bold ${
              Math.abs(data.estimatedTDEE - data.suggestedCalories) > 500 ? 'text-amber-600' : 'text-green-600'
            }`}>{Math.abs(data.estimatedTDEE - data.suggestedCalories)}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>
        )}
      </div>

      {/* 調整記錄 */}
      {(data.caloriesDelta !== 0 || data.proteinDelta !== 0 || data.carbsDelta !== 0 || data.fatDelta !== 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-blue-700 mb-2">📋 本週自動調整</p>
          <div className="grid grid-cols-2 gap-2">
            {data.caloriesDelta !== 0 && (
              <div className="flex items-center justify-between bg-white bg-opacity-70 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-600">🔥 熱量</span>
                <span className={`text-xs font-bold ${data.caloriesDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.caloriesDelta > 0 ? '+' : ''}{data.caloriesDelta} kcal
                </span>
              </div>
            )}
            {data.proteinDelta !== 0 && (
              <div className="flex items-center justify-between bg-white bg-opacity-70 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-600">🥩 蛋白質</span>
                <span className={`text-xs font-bold ${data.proteinDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.proteinDelta > 0 ? '+' : ''}{data.proteinDelta}g
                </span>
              </div>
            )}
            {data.carbsDelta !== 0 && (
              <div className="flex items-center justify-between bg-white bg-opacity-70 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-600">🍚 碳水</span>
                <span className={`text-xs font-bold ${data.carbsDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.carbsDelta > 0 ? '+' : ''}{data.carbsDelta}g
                </span>
              </div>
            )}
            {data.fatDelta !== 0 && (
              <div className="flex items-center justify-between bg-white bg-opacity-70 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-600">🥑 脂肪</span>
                <span className={`text-xs font-bold ${data.fatDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.fatDelta > 0 ? '+' : ''}{data.fatDelta}g
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-blue-500 mt-2">
            系統每週根據體重趨勢自動調整，不需要教練介入
          </p>
        </div>
      )}

      {/* Refeed 建議 */}
      {data.refeedSuggested && (
        <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔄</span>
            <p className="text-sm font-bold text-orange-800">
              系統偵測：可考慮安排 {data.refeedDays} 天 Refeed
            </p>
          </div>
          <p className="text-xs text-orange-700">{data.refeedReason}</p>
          <p className="text-[11px] text-orange-500 mt-1">
            今日碳水提升至維持熱量（4-6g/kg），脂肪降低，蛋白質維持。
          </p>
        </div>
      )}

      {/* Diet Break */}
      {data.dietBreakSuggested && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⏸️</span>
            <p className="text-sm font-bold text-purple-800">系統偵測：可考慮安排 Diet Break</p>
          </div>
          <p className="text-xs text-purple-700">
            已持續{goalType === 'cut' ? '減脂' : '增肌'} {data.dietDurationWeeks} 週以上。可考慮安排 1-2 週維持熱量。
          </p>
        </div>
      )}

      {/* 穿戴裝置恢復回饋 */}
      <WearableInsightCard />

      {/* 月經週期 */}
      {data.menstrualCycleNote && (
        <div className="mt-3 bg-pink-50 border border-pink-200 rounded-2xl p-4">
          <p className="text-xs text-pink-700 leading-relaxed">{data.menstrualCycleNote}</p>
        </div>
      )}

      {/* 警告 */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.warnings
            .filter((w: string) => !w.startsWith('🔄'))
            .slice(0, 3)
            .map((w: string, i: number) => (
              <p key={i} className="text-[11px] text-gray-500 leading-relaxed">{w}</p>
            ))}
        </div>
      )}
    </div>
  )
}
