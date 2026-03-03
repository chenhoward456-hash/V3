'use client'

import { useState, useEffect } from 'react'

interface SelfManagedNutritionProps {
  clientId: string  // UUID (internal ID)
  uniqueCode: string  // unique_code (for PATCH API)
  goalType: string | null
  activityProfile: string | null
  gender: string | null
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  targetWeight: number | null
  targetDate: string | null
  isTrainingDay?: boolean
  onMutate?: () => void
}

export default function SelfManagedNutrition({
  clientId,
  uniqueCode,
  goalType,
  activityProfile,
  gender,
  caloriesTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  targetWeight: existingTargetWeight,
  targetDate: existingTargetDate,
  isTrainingDay,
  onMutate,
}: SelfManagedNutritionProps) {
  const [data, setData] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Onboarding form state
  const [selectedGoal, setSelectedGoal] = useState<'cut' | 'bulk' | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<'sedentary' | 'high_energy_flux'>('sedentary')
  const [bodyWeight, setBodyWeight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [height, setHeight] = useState('')
  const [trainingDays, setTrainingDays] = useState('3')
  const [targetWeightInput, setTargetWeightInput] = useState('')
  const [targetDateOption, setTargetDateOption] = useState<'3' | '6' | 'custom'>('3')
  const [customTargetDate, setCustomTargetDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 需要 Onboarding：沒有 goalType 或沒有營養目標
  const needsOnboarding = !goalType || !caloriesTarget

  useEffect(() => {
    if (needsOnboarding) {
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

  // 計算目標日期
  const getTargetDate = () => {
    if (!targetWeightInput) return undefined
    if (targetDateOption === 'custom' && customTargetDate) return customTargetDate
    const months = targetDateOption === '3' ? 3 : 6
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString().split('T')[0]
  }

  const handleSetup = async () => {
    if (!selectedGoal || !bodyWeight) return
    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        clientId: uniqueCode,
        gender: gender || '男性',
        goal_type: selectedGoal,
        activity_profile: selectedActivity,
        body_weight: parseFloat(bodyWeight),
        body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : undefined,
        height: height ? parseFloat(height) : undefined,
        training_days_per_week: parseInt(trainingDays) || 3,
      }
      if (targetWeightInput) {
        payload.target_weight = parseFloat(targetWeightInput)
        payload.target_date = getTargetDate()
      }
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        if (onMutate) onMutate()
        window.location.reload()
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false) }
  }

  // ===== Onboarding 畫面 =====
  if (needsOnboarding) {
    const canSubmit = selectedGoal && bodyWeight && parseFloat(bodyWeight) > 30
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold text-gray-900">設定你的營養目標</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          輸入 InBody 數據，系統馬上幫你算出每日該吃多少。
        </p>

        {/* 目標選擇 */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">你的目標是？</p>
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

        {/* InBody 數據 */}
        {selectedGoal && (
          <>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">InBody / 身體數據</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">體重 (kg) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    placeholder="70"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">體脂率 (%)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bodyFatPct}
                    onChange={(e) => setBodyFatPct(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">身高 (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="170"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                有體脂率數據（InBody）可以更精準計算 TDEE
              </p>
            </div>

            {/* 活動量 + 訓練頻率 */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">日常活動量</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedActivity('sedentary')}
                  className={`p-3 rounded-2xl border-2 transition-all text-left ${
                    selectedActivity === 'sedentary'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">🖥️ 上班族</p>
                  <p className="text-[11px] text-gray-500">久坐為主</p>
                </button>
                <button
                  onClick={() => setSelectedActivity('high_energy_flux')}
                  className={`p-3 rounded-2xl border-2 transition-all text-left ${
                    selectedActivity === 'high_energy_flux'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">🚶 高活動量</p>
                  <p className="text-[11px] text-gray-500">步數多、體力勞動</p>
                </button>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-700 mb-2">每週訓練幾天？</p>
              <div className="flex gap-2">
                {['2', '3', '4', '5', '6'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrainingDays(d)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      trainingDays === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>

            {/* 目標體重 + 期限 */}
            {selectedGoal === 'cut' && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-700 mb-2">目標體重（選填）</p>
                <p className="text-[10px] text-gray-400 mb-2">設定後系統會根據期限自動倒推每週減幅</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">想減到幾公斤？</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={targetWeightInput}
                      onChange={(e) => setTargetWeightInput(e.target.value)}
                      placeholder={bodyWeight ? String(Math.round((parseFloat(bodyWeight) * 0.9) * 10) / 10) : '65'}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">預計花多久？</label>
                    <div className="flex gap-1.5">
                      {(['3', '6'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setTargetDateOption(m as '3' | '6')}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            targetDateOption === m
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {m}個月
                        </button>
                      ))}
                      <button
                        onClick={() => setTargetDateOption('custom')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          targetDateOption === 'custom'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        自訂
                      </button>
                    </div>
                  </div>
                </div>
                {targetDateOption === 'custom' && (
                  <input
                    type="date"
                    value={customTargetDate}
                    onChange={(e) => setCustomTargetDate(e.target.value)}
                    min={new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                )}
                {targetWeightInput && bodyWeight && parseFloat(targetWeightInput) < parseFloat(bodyWeight) && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-blue-700">
                      {(() => {
                        const tw = parseFloat(targetWeightInput)
                        const bw = parseFloat(bodyWeight)
                        const diff = bw - tw
                        const months = targetDateOption === 'custom'
                          ? Math.max(0.5, (new Date(customTargetDate).getTime() - Date.now()) / (30 * 86400000))
                          : parseInt(targetDateOption)
                        const weeklyRate = diff / (months * 4.33)
                        const pct = (weeklyRate / bw * 100)
                        return `需減 ${diff.toFixed(1)} kg，約每週 ${weeklyRate.toFixed(2)} kg（${pct.toFixed(1)}% BW/週）${pct > 1 ? ' ⚠️ 偏激進' : pct > 0.5 ? '' : ' — 很穩健'}`
                      })()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 送出 */}
            <button
              onClick={handleSetup}
              disabled={!canSubmit || submitting}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '計算中...' : '計算我的營養目標'}
            </button>
          </>
        )}
      </div>
    )
  }

  if (loading) return null
  if (!data) return null

  // 目標倒數卡片
  const GoalCountdownCard = () => {
    // 使用引擎回傳的 deadlineInfo 或從 props 算
    const dl = data?.deadlineInfo
    if (dl) {
      return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-indigo-700">🎯 目標倒數</p>
            {dl.isGoalDriven && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Goal-Driven</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-white bg-opacity-70 rounded-xl py-2">
              <p className="text-[10px] text-gray-400">剩餘</p>
              <p className="text-lg font-bold text-indigo-700">{dl.daysLeft}</p>
              <p className="text-[10px] text-gray-400">天</p>
            </div>
            <div className="text-center bg-white bg-opacity-70 rounded-xl py-2">
              <p className="text-[10px] text-gray-400">還需{goalType === 'cut' ? '減' : '增'}</p>
              <p className="text-lg font-bold text-indigo-700">{Math.abs(dl.weightToLose).toFixed(1)}</p>
              <p className="text-[10px] text-gray-400">kg</p>
            </div>
            <div className="text-center bg-white bg-opacity-70 rounded-xl py-2">
              <p className="text-[10px] text-gray-400">每週速率</p>
              <p className={`text-lg font-bold ${dl.isAggressive ? 'text-red-600' : 'text-indigo-700'}`}>
                {Math.abs(dl.requiredRatePerWeek).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400">kg/週</p>
            </div>
          </div>
          {dl.isAggressive && (
            <p className="text-[10px] text-red-600 mt-2 text-center">
              ⚠️ 目前速率偏激進，超過體重的 1%/週，可能流失肌肉
            </p>
          )}
          {dl.extraCardioNeeded && dl.cardioNote && (
            <p className="text-[10px] text-indigo-600 mt-2 text-center">{dl.cardioNote}</p>
          )}
        </div>
      )
    }

    // Fallback: 用 props 算簡易倒數
    if (!existingTargetWeight || !existingTargetDate) return null
    const now = new Date()
    const target = new Date(existingTargetDate)
    const daysLeft = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000))
    if (daysLeft <= 0) return null

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-indigo-700 mb-2">🎯 目標倒數</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-white bg-opacity-70 rounded-xl py-2">
            <p className="text-[10px] text-gray-400">目標體重</p>
            <p className="text-lg font-bold text-indigo-700">{existingTargetWeight}</p>
            <p className="text-[10px] text-gray-400">kg</p>
          </div>
          <div className="text-center bg-white bg-opacity-70 rounded-xl py-2">
            <p className="text-[10px] text-gray-400">剩餘</p>
            <p className="text-lg font-bold text-indigo-700">{daysLeft}</p>
            <p className="text-[10px] text-gray-400">天</p>
          </div>
        </div>
      </div>
    )
  }

  // ===== 數據不足但有初始目標 =====
  if (data.status === 'insufficient_data' && caloriesTarget) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
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

        {/* 目標倒數 */}
        <GoalCountdownCard />

        {/* 初始目標（從 InBody 計算） */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">📋 今日飲食目標（InBody 初始計算）</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '熱量', value: caloriesTarget, unit: 'kcal', emoji: '🔥' },
              { label: '蛋白質', value: proteinTarget, unit: 'g', emoji: '🥩' },
              { label: '碳水', value: carbsTarget, unit: 'g', emoji: '🍚' },
              { label: '脂肪', value: fatTarget, unit: 'g', emoji: '🥑' },
            ].map(({ label, value, unit, emoji }) => (
              <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
                <p className="text-[10px] text-gray-500">{emoji} {label}</p>
                <p className="text-lg font-bold text-gray-900">{value || '--'}</p>
                <p className="text-[10px] text-gray-400">{unit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 提示持續記錄 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          📊 持續記錄每天體重，2 週後系統會根據真實體重變化自動校正目標
        </div>
      </div>
    )
  }

  // ===== 數據不足且無初始目標（不太應該發生） =====
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
      </div>
    )
  }

  // ===== 正常顯示（有足夠數據） =====

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

      {/* 目標倒數 */}
      <GoalCountdownCard />

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

      {/* 體脂區間 */}
      {data.bodyFatZoneInfo && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-700">體脂區間</p>
              <p className="text-sm font-bold text-indigo-900 mt-0.5">{data.bodyFatZoneInfo.zoneLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-indigo-400">蛋白質 {data.bodyFatZoneInfo.proteinPerKg}g/kg ・ 脂肪 {data.bodyFatZoneInfo.fatPerKg}g/kg</p>
              {data.bodyFatZoneInfo.refeedFrequency && (
                <p className="text-[10px] text-indigo-400 mt-0.5">Refeed：{data.bodyFatZoneInfo.refeedFrequency}</p>
              )}
            </div>
          </div>
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
