'use client'

import { useState, useEffect } from 'react'

interface GoalDrivenStatusProps {
  clientId: string
}

export default function GoalDrivenStatus({ clientId }: GoalDrivenStatusProps) {
  const [data, setData] = useState<any>(null)
  const [targetWeightValue, setTargetWeightValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSuggestion = async () => {
      try {
        const res = await fetch(`/api/nutrition-suggestions?clientId=${clientId}`)
        if (!res.ok) return
        const json = await res.json()
        if (json.suggestion) {
          setData(json.suggestion)
          setTargetWeightValue(json.meta?.targetWeight || null)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchSuggestion()
  }, [clientId])

  if (loading || !data) return null

  const dl = data.deadlineInfo
  const isGoalDriven = dl?.isGoalDriven

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
  const safetyLabels: Record<string, string> = { normal: '安全範圍', aggressive: '積極模式', extreme: '極限模式' }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold text-gray-900">目標體重計畫</h2>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>
          {safetyLabels[dl.safetyLevel || 'normal']}
        </span>
      </div>

      {/* 核心數據 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400">還需減</p>
          <p className="text-xl font-bold text-gray-900">{dl.weightToLose}</p>
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

      {/* 飲食目標 */}
      <div className={`${colors.bg} ${colors.border} border rounded-2xl p-4 mb-3`}>
        <p className="text-xs font-semibold text-gray-700 mb-2">📋 今日飲食目標</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '熱量', value: data.suggestedCalories, unit: 'kcal', emoji: '🔥' },
            { label: '蛋白質', value: data.suggestedProtein, unit: 'g', emoji: '🥩' },
            { label: '碳水', value: data.suggestedCarbs, unit: 'g', emoji: '🍚' },
            { label: '脂肪', value: data.suggestedFat, unit: 'g', emoji: '🥑' },
          ].map(({ label, value, unit, emoji }) => (
            <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
              <p className="text-[10px] text-gray-500">{emoji} {label}</p>
              <p className="text-lg font-bold text-gray-900">{value || '--'}</p>
              <p className="text-[10px] text-gray-400">{unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 有氧 / 步數建議 */}
      {(dl.suggestedCardioMinutes > 0 || dl.suggestedDailySteps > 0) && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold text-cyan-700 mb-2">🏃 活動量建議</p>
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
      {dl.predictedCompWeight && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          dl.predictedCompWeight <= (targetWeightValue || 0) + 0.5
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {dl.predictedCompWeight <= (targetWeightValue || 0) + 0.5
            ? `✅ 預測比賽日 ${dl.predictedCompWeight}kg — 可以達到目標！`
            : `⚠️ 預測比賽日 ${dl.predictedCompWeight}kg — 與目標還差 ${(dl.predictedCompWeight - (targetWeightValue || 0)).toFixed(1)}kg`
          }
        </div>
      )}

      {/* 警告 */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.warnings.slice(0, 3).map((w: string, i: number) => (
            <p key={i} className="text-[11px] text-gray-500">{w}</p>
          ))}
        </div>
      )}
    </div>
  )
}
