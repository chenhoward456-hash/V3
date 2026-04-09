'use client'

import { useState, useEffect, useRef } from 'react'

interface GoalDrivenStatusProps {
  clientId: string
  code?: string
  isTrainingDay?: boolean
  onMutate?: (appliedTargets?: Record<string, number | undefined>) => void
  initialData?: any
}

export default function GoalDrivenStatus({ clientId, code, isTrainingDay, onMutate, initialData }: GoalDrivenStatusProps) {
  const [data, setData] = useState<any>(initialData || null)
  const [targetWeightValue, setTargetWeightValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(!initialData)
  const [overriding, setOverriding] = useState(false)
  const onMutateRef = useRef(onMutate)
  onMutateRef.current = onMutate
  const fetchedRef = useRef(!!initialData)

  // 如果 initialData 從 parent 更新了，同步
  useEffect(() => {
    if (initialData && !data) {
      setData(initialData)
      setLoading(false)
      fetchedRef.current = true
    }
  }, [initialData, data])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const fetchSuggestion = async () => {
      try {
        const lookupId = code || clientId
        const res = await fetch(`/api/nutrition-suggestions?clientId=${lookupId}&autoApply=true${code ? `&code=${code}` : ''}`)
        if (!res.ok) {
          console.error('[GoalDrivenStatus] API 失敗:', res.status, res.statusText, 'lookupId:', lookupId)
          return
        }
        const json = await res.json()
        if (json.suggestion) {
          setData(json.suggestion)
          setTargetWeightValue(json.meta?.targetWeight || null)
          if (onMutateRef.current) {
            if (json.applied) {
              const s = json.suggestion
              onMutateRef.current({
                calories_target: s.suggestedCalories,
                protein_target: s.suggestedProtein,
                carbs_target: s.suggestedCarbs,
                fat_target: s.suggestedFat,
                carbs_training_day: s.suggestedCarbsTrainingDay,
                carbs_rest_day: s.suggestedCarbsRestDay,
              })
            } else {
              onMutateRef.current()
            }
          }
        }
      } catch (err) {
        console.error('[GoalDrivenStatus] fetch 錯誤:', err)
      } finally { setLoading(false) }
    }
    fetchSuggestion()
  }, [clientId, code])

  const handleGateOverride = async () => {
    if (overriding) return
    setOverriding(true)
    try {
      const lookupId = code || clientId
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: lookupId, cutting_gate_override: true }),
      })
      if (res.ok) {
        // 重新載入營養建議
        fetchedRef.current = false
        setLoading(true)
        const sugRes = await fetch(`/api/nutrition-suggestions?clientId=${lookupId}&autoApply=true${code ? `&code=${code}` : ''}`)
        if (sugRes.ok) {
          const json = await sugRes.json()
          setData(json.data || json)
        }
      }
    } catch (e) {
      console.error('[GoalDrivenStatus] override failed:', e)
    } finally {
      setOverriding(false)
      setLoading(false)
    }
  }

  if (loading || !data) return null

  const dl = data.deadlineInfo
  const isGoalDriven = dl?.isGoalDriven
  const gate = data.cuttingReadinessGate

  // 血檢警告橫幅（不擋住正常建議，只顯示提醒）
  const gateWarningBanner = gate?.blocked ? (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>🩸</span>
          <p className="text-sm font-semibold text-amber-800">血檢指標異常</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          就緒 {gate.readinessScore}/100
        </span>
      </div>
      {(gate.labFlags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {gate.labFlags.map((flag: string, i: number) => (
            <span key={i} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {flag}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-amber-700 leading-relaxed">{gate.recommendation}</p>
    </div>
  ) : null

  // 舊的強制恢復 UI 已移除 — 閘門改為純警告模式

  // 穿戴裝置恢復狀態回饋（所有狀態都顯示）
  const wearableInsightCard = (() => {
    if (!data.wearableInsight) return null

    const stateConfig: Record<string, { bg: string; border: string; text: string; emoji: string; label: string }> = {
      optimal: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', emoji: '💪', label: '恢復極佳' },
      good: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', emoji: '👍', label: '恢復正常' },
      struggling: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', emoji: '⚠️', label: '恢復偏低' },
      critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', emoji: '🚨', label: '恢復不足' },
    }
    const config = stateConfig[data.currentState] || stateConfig.good

    return (
      <div className={`mt-3 ${config.bg} border ${config.border} rounded-2xl p-4`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">⌚</span>
            <p className={`text-xs font-bold ${config.text}`}>{config.emoji} {config.label}</p>
          </div>
          {data.readinessScore != null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
              {data.readinessScore}/100
            </span>
          )}
        </div>
        <p className={`text-xs ${config.text} leading-relaxed`}>{data.wearableInsight}</p>
      </div>
    )
  })()

  // 非 goal-driven 時顯示基本引擎狀態
  if (!isGoalDriven) {
    // 如果有 deadlineInfo 但沒進入 goal-driven（例如已達標、數據不足等），顯示簡易卡片
    if (data.status === 'insufficient_data') {
      return (
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-lg font-bold text-gray-900">目標體重計畫</h2>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
            需要至少 2 週的體重數據，系統才能啟動自動調整。請持續記錄體重！
          </div>
        </div>
      )
    }
    // 其他非 goal-driven 狀態（on_track 等）顯示引擎狀態
    if (data.status && data.statusEmoji) {
      return (
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎯</span>
            <h2 className="text-lg font-bold text-gray-900">目標體重計畫</h2>
          </div>
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            data.status === 'on_track' ? 'bg-green-50 text-green-700 border border-green-200'
            : data.status === 'plateau' ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {data.statusEmoji} {data.statusLabel} — {data.message}
          </div>
          {dl && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400">還需減</p>
                <p className="text-lg font-bold text-gray-900">{dl.weightToLose}</p>
                <p className="text-[10px] text-gray-400">kg</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400">剩餘</p>
                <p className="text-lg font-bold text-gray-900">{dl.daysLeft}</p>
                <p className="text-[10px] text-gray-400">天</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400">TDEE</p>
                <p className="text-lg font-bold text-gray-900">{data.estimatedTDEE || '--'}</p>
                <p className="text-[10px] text-gray-400">kcal</p>
              </div>
            </div>
          )}
          {data.refeedSuggested && (
            <div className="mt-3 bg-orange-50 border border-orange-300 rounded-2xl p-4">
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
          {wearableInsightCard}
          {data.menstrualCycleNote && (
            <div className="mt-3 bg-pink-50 border border-pink-200 rounded-2xl p-4">
              <p className="text-xs text-pink-700 leading-relaxed">{data.menstrualCycleNote}</p>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const safetyColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    normal: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
    aggressive: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    extreme: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  }
  const colors = safetyColors[dl.safetyLevel || 'normal'] || safetyColors.normal
  const isAheadOfSchedule = data.statusLabel === '進度超前'
  const safetyLabels: Record<string, string> = { normal: '安全範圍', aggressive: '積極模式', extreme: '極限模式' }

  // 碳循環：根據訓練日/休息日顯示不同碳水 + 重算熱量
  const hasCarbCycling = data.suggestedCarbsTrainingDay != null && data.suggestedCarbsRestDay != null
  const todayCarbs = hasCarbCycling
    ? (isTrainingDay ? data.suggestedCarbsTrainingDay : data.suggestedCarbsRestDay)
    : data.suggestedCarbs
  const todayCalories = (todayCarbs && data.suggestedProtein && data.suggestedFat)
    ? Math.round(data.suggestedProtein * 4 + todayCarbs * 4 + data.suggestedFat * 9)
    : data.suggestedCalories

  return (
    <>
    {gateWarningBanner}
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold text-gray-900">目標體重計畫</h2>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          isAheadOfSchedule ? 'bg-blue-100 text-blue-700' : colors.badge
        }`}>
          {isAheadOfSchedule ? '📈 進度超前' : safetyLabels[dl.safetyLevel || 'normal']}
        </span>
      </div>

      {/* 核心數據 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400">{dl.prePeakEntryWeight ? '飲食需減' : '還需減'}</p>
          <p className="text-xl font-bold text-gray-900">{dl.dietWeightToLose ?? dl.weightToLose}</p>
          <p className="text-[10px] text-gray-400">kg</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400">剩餘天數</p>
          <p className="text-xl font-bold text-gray-900">{dl.daysLeft}</p>
          <p className="text-[10px] text-gray-400">天</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400">每日赤字</p>
          <p className={`text-xl font-bold ${dl.requiredDailyDeficit > 750 ? 'text-red-600' : dl.requiredDailyDeficit > 500 ? 'text-amber-600' : 'text-green-600'}`}>
            {dl.requiredDailyDeficit}
          </p>
          <p className="text-[10px] text-gray-400">kcal</p>
        </div>
      </div>

      {/* Peak Week 體重拆分（備賽專用） */}
      {dl.prePeakEntryWeight && dl.peakWeekExpectedLoss && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-semibold text-indigo-700 mb-1.5">💧 Peak Week 體重拆分</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[10px] text-gray-400">PW 入場目標</p>
              <p className="font-bold text-indigo-700">{dl.prePeakEntryWeight} kg</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">PW 預估可脫</p>
              <p className="font-bold text-blue-600">-{dl.peakWeekExpectedLoss} kg</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">上台目標</p>
              <p className="font-bold text-gray-900">{targetWeightValue} kg</p>
            </div>
          </div>
          <p className="text-[9px] text-indigo-400 mt-1.5 text-center">
            水分操作預估（{Math.round((dl.peakWeekWaterCutPct || 0.02) * 100)}% BW），實際依個人反應調整
          </p>
        </div>
      )}

      {/* 代謝壓力分數 */}
      {data.metabolicStress && data.metabolicStress.score >= 30 && (
        <div className={`rounded-xl p-3 mb-3 ${
          data.metabolicStress.level === 'high' ? 'bg-red-50 border border-red-200' :
          data.metabolicStress.level === 'elevated' ? 'bg-orange-50 border border-orange-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-bold ${
              data.metabolicStress.level === 'high' ? 'text-red-700' :
              data.metabolicStress.level === 'elevated' ? 'text-orange-700' :
              'text-yellow-700'
            }`}>
              🔥 代謝壓力：{data.metabolicStress.score}/100
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              data.metabolicStress.level === 'high' ? 'bg-red-100 text-red-700' :
              data.metabolicStress.level === 'elevated' ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {data.metabolicStress.level === 'high' ? '偏高' :
               data.metabolicStress.level === 'elevated' ? '中高' : '監控中'}
            </span>
          </div>
          {/* 五維度 bar */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {[
              { label: '飲食', value: data.metabolicStress.breakdown.dietDuration, max: 25 },
              { label: '恢復', value: data.metabolicStress.breakdown.recovery, max: 30 },
              { label: '停滯', value: data.metabolicStress.breakdown.plateau, max: 20 },
              { label: '低碳', value: data.metabolicStress.breakdown.lowCarb, max: 15 },
              { label: '狀態', value: data.metabolicStress.breakdown.wellnessTrend, max: 10 },
            ].map(({ label, value, max }) => (
              <div key={label} className="text-center">
                <div className="w-full bg-gray-100 rounded-full h-1 mb-0.5">
                  <div className={`h-1 rounded-full ${value / max >= 0.7 ? 'bg-red-400' : value / max >= 0.4 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.round(value / max * 100)}%` }} />
                </div>
                <p className="text-[8px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          {data.metabolicStress.recommendation !== 'continue' && data.metabolicStress.recommendation !== 'monitor' && (
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {data.metabolicStress.recommendation === 'refeed_1day' && `💡 建議安排 1 天 strategic refeed（碳水 ${data.metabolicStress.refeedCarbGPerKg}g/kg，脂肪壓低，蛋白質維持）`}
              {data.metabolicStress.recommendation === 'refeed_2day' && `💡 建議安排 2 天 full refeed（碳水 ${data.metabolicStress.refeedCarbGPerKg}g/kg，恢復 leptin 與甲狀腺）`}
              {data.metabolicStress.recommendation === 'diet_break' && '💡 建議安排 3-5 天 diet break（維持熱量，高碳水，恢復荷爾蒙和代謝率）'}
            </p>
          )}
        </div>
      )}

      {/* 飲食目標 */}
      <div className={`${colors.bg} ${colors.border} border rounded-2xl p-4 mb-3`}>
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
            { label: '熱量', value: todayCalories, unit: 'kcal', emoji: '🔥' },
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
            {data.suggestedCarbsTrainingDay === data.suggestedCarbsRestDay
              ? `⏸️ 碳水 ${data.suggestedCarbsTrainingDay}g（碳水偏低，暫停碳循環）`
              : `碳水循環：訓練日 ${data.suggestedCarbsTrainingDay}g ／ 休息日 ${data.suggestedCarbsRestDay}g`
            }
          </p>
        )}
      </div>

      {/* 分餐蛋白質指引 */}
      {data.perMealProteinGuide && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-amber-700">🥩 分餐蛋白質指引</p>
          <p className="text-sm text-amber-900 mt-1">
            每餐 {data.perMealProteinGuide.perMealGrams.min}-{data.perMealProteinGuide.perMealGrams.max}g，
            分 {data.perMealProteinGuide.mealsPerDay.min}-{data.perMealProteinGuide.mealsPerDay.max} 餐
          </p>
          <p className="text-[10px] text-amber-600 mt-1">{data.perMealProteinGuide.periWorkoutNote}</p>
        </div>
      )}

      {/* 有氧 / 步數參考 */}
      {(dl.suggestedCardioMinutes > 0 || dl.suggestedDailySteps > 0) && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-cyan-700 mb-2">🏃 活動量參考</p>
          <div className="grid grid-cols-2 gap-3">
            {dl.suggestedCardioMinutes > 0 && (
              <div className="bg-white bg-opacity-70 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500">🚴 有氧</p>
                <p className="text-2xl font-bold text-cyan-700">{dl.suggestedCardioMinutes}</p>
                <p className="text-[10px] text-gray-400">分鐘/天</p>
                <p className="text-[10px] text-gray-400 mt-0.5">中等強度</p>
              </div>
            )}
            {dl.suggestedDailySteps > 0 && (
              <div className="bg-white bg-opacity-70 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500">👟 步數</p>
                <p className="text-2xl font-bold text-cyan-700">{dl.suggestedDailySteps?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">步/天</p>
                <p className="text-[10px] text-gray-400 mt-0.5">含日常活動</p>
              </div>
            )}
          </div>
          {dl.extraCardioNeeded && dl.extraBurnPerDay > 0 && (
            <p className="text-[10px] text-cyan-600 mt-2 text-center">
              💡 飲食面不足，需透過活動額外消耗 {dl.extraBurnPerDay} kcal/天
            </p>
          )}
          {dl.cardioNote && (
            <p className="text-[10px] text-gray-500 mt-1 text-center">{dl.cardioNote}</p>
          )}
        </div>
      )}

      {/* 預測結果 */}
      {dl.predictedCompWeight && (() => {
        const compareTarget = dl.prePeakEntryWeight || targetWeightValue || 0
        const canReach = dl.predictedCompWeight <= compareTarget + 0.5
        const hasPeakSplit = !!dl.prePeakEntryWeight
        return (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            canReach ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {canReach
              ? `✅ 預測${hasPeakSplit ? ' PW 入場' : '比賽日'} ${dl.predictedCompWeight}kg${hasPeakSplit ? `（PW 後 → ${targetWeightValue}kg）` : ''} — 可以達標！`
              : `⚠️ 預測${hasPeakSplit ? ' PW 入場' : '比賽日'} ${dl.predictedCompWeight}kg — 與${hasPeakSplit ? '入場目標' : '目標'}還差 ${(dl.predictedCompWeight - compareTarget).toFixed(1)}kg`
            }
          </div>
        )
      })()}

      {/* Refeed 建議 */}
      {data.refeedSuggested && (
        <div className="mt-3 bg-orange-50 border border-orange-300 rounded-2xl p-4">
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

      {/* 穿戴裝置恢復回饋 */}
      {wearableInsightCard}

      {/* Energy Availability (RED-S) 警告 */}
      {data.energyAvailability && data.energyAvailability.level !== 'adequate' && (
        <div className={`mt-3 rounded-2xl p-4 ${
          data.energyAvailability.level === 'critical'
            ? 'bg-red-50 border border-red-300'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <p className={`text-xs font-medium mb-1 ${
            data.energyAvailability.level === 'critical' ? 'text-red-700' : 'text-amber-700'
          }`}>
            能量可用性：{data.energyAvailability.eaKcalPerKgFFM} kcal/kg FFM/day
          </p>
          <p className={`text-[11px] leading-relaxed ${
            data.energyAvailability.level === 'critical' ? 'text-red-600' : 'text-amber-600'
          }`}>{data.energyAvailability.warning}</p>
        </div>
      )}

      {/* 血檢驅動的營養調整 */}
      {data.labMacroModifiers && data.labMacroModifiers.length > 0 && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-blue-700 mb-2">🩸 血檢指標建議</p>
          <div className="space-y-1">
            {data.labMacroModifiers.map((mod: any, i: number) => (
              <p key={i} className="text-[11px] text-blue-600 leading-relaxed">
                {mod.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 月經週期提示 */}
      {data.menstrualCycleNote && (
        <div className="mt-3 bg-pink-50 border border-pink-200 rounded-2xl p-4">
          <p className="text-xs text-pink-700 leading-relaxed">{data.menstrualCycleNote}</p>
        </div>
      )}

      {/* 警告 */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.warnings.slice(0, 5).map((w: string, i: number) => (
            <p key={i} className="text-[11px] text-gray-500">{w}</p>
          ))}
        </div>
      )}

      {/* 血檢複檢提醒 */}
      {data.cuttingReadinessGate?.labRetestReminder && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-3">
          <p className="text-xs text-blue-700 leading-relaxed">{data.cuttingReadinessGate.labRetestReminder}</p>
        </div>
      )}
    </div>
    </>
  )
}
