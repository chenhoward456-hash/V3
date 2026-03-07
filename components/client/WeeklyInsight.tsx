'use client'

import { useState, useEffect } from 'react'

interface WeeklyInsightProps {
  clientId: string
  code?: string
  onMutate?: () => void
}

export default function WeeklyInsight({ clientId, code, onMutate }: WeeklyInsightProps) {
  const [data, setData] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const res = await fetch(`/api/nutrition-suggestions?clientId=${clientId}${code ? `&code=${code}` : ''}`)
        if (!res.ok) return
        const json = await res.json()
        if (json.suggestion) {
          setData(json.suggestion)
          setMeta(json.meta || null)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchInsight()
  }, [clientId])

  if (loading) return null
  if (!data) return null
  // 數據不足時顯示引導卡片
  if (data.status === 'insufficient_data') {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🧠</span>
          <h2 className="text-lg font-bold text-gray-900">每週智能分析</h2>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
          需要至少 2 週的體重數據，系統才能開始分析。持續記錄，下週就能看到分析結果！
        </div>
      </div>
    )
  }

  // 合規率低時也顯示，但帶不同訊息
  if (data.status === 'low_compliance') {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🧠</span>
          <h2 className="text-lg font-bold text-gray-900">每週智能分析</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          飲食紀錄率偏低，系統還無法準確分析。試著每天記錄飲食，讓分析更精準！
        </div>
      </div>
    )
  }

  // 狀態對應顏色和配置
  const statusConfig: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    on_track: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '🟢' },
    too_fast: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🔴' },
    plateau: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: '🟡' },
    wrong_direction: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🔴' },
    goal_driven: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '🎯' },
  }
  const config = statusConfig[data.status] || statusConfig.on_track

  // 計算目標赤字（如果有 TDEE 和目標熱量）
  const dailyDeficit = data.estimatedTDEE && data.suggestedCalories
    ? data.estimatedTDEE - data.suggestedCalories
    : null

  // 體重變化率的友善顯示
  const changeRate = data.weeklyWeightChangeRate
  const changeRateText = changeRate != null
    ? changeRate === 0 ? '持平' : `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%`
    : null

  // 安全的 warnings（過濾掉引擎的 emoji 前綴重複）
  const visibleWarnings = (data.warnings || [])
    .filter((w: string) => !w.startsWith('🔄'))  // Refeed 單獨顯示
    .slice(0, 3)

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🧠</span>
        <h2 className="text-lg font-bold text-gray-900">每週智能分析</h2>
      </div>

      {/* 主要狀態 */}
      <div className={`${config.bg} ${config.border} border rounded-2xl px-4 py-3 mb-4`}>
        <p className={`text-sm font-semibold ${config.text}`}>
          {data.statusEmoji} {data.statusLabel}
        </p>
        <p className={`text-xs ${config.text} mt-1 opacity-80`}>
          {data.message}
        </p>
      </div>

      {/* 關鍵數據 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* TDEE */}
        {data.estimatedTDEE && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">預估 TDEE</p>
            <p className="text-lg font-bold text-gray-900">{data.estimatedTDEE}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>
        )}

        {/* 週體重變化 */}
        {changeRateText && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">本週體重</p>
            <p className={`text-lg font-bold ${
              meta?.goalType === 'cut'
                ? (changeRate! < 0 ? 'text-green-600' : 'text-red-600')
                : (changeRate! > 0 ? 'text-green-600' : 'text-red-600')
            }`}>{changeRateText}</p>
            <p className="text-[10px] text-gray-400">/週</p>
          </div>
        )}

        {/* 赤字 or 盈餘 */}
        {dailyDeficit != null && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">{meta?.goalType === 'cut' ? '每日赤字' : '每日盈餘'}</p>
            <p className={`text-lg font-bold ${
              Math.abs(dailyDeficit) > 500 ? 'text-amber-600' : 'text-green-600'
            }`}>{Math.abs(dailyDeficit)}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>
        )}

        {/* 合規率 fallback（如果赤字或 TDEE 缺一個） */}
        {(!data.estimatedTDEE || dailyDeficit == null) && meta?.nutritionCompliance != null && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">飲食合規率</p>
            <p className={`text-lg font-bold ${
              meta.nutritionCompliance >= 80 ? 'text-green-600'
              : meta.nutritionCompliance >= 50 ? 'text-amber-600'
              : 'text-red-600'
            }`}>{meta.nutritionCompliance}%</p>
            <p className="text-[10px] text-gray-400">近 14 天</p>
          </div>
        )}
      </div>

      {/* 調整參考（如果有 delta） */}
      {(data.caloriesDelta !== 0 || data.proteinDelta !== 0 || data.carbsDelta !== 0 || data.fatDelta !== 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">📋 系統分析 — 目標校正</p>
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
            以上為系統根據體重趨勢自動分析的參考數據，僅供教練與你討論時參考
          </p>
        </div>
      )}

      {/* Refeed 提示 */}
      {data.refeedSuggested && (
        <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 mb-4">
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

      {/* Diet Break 提示 */}
      {data.dietBreakSuggested && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⏸️</span>
            <p className="text-sm font-bold text-purple-800">系統偵測：可考慮安排 Diet Break</p>
          </div>
          <p className="text-xs text-purple-700">
            已持續減脂 {data.dietDurationWeeks} 週以上。可考慮安排 1-2 週維持熱量，讓代謝和荷爾蒙恢復。
          </p>
        </div>
      )}

      {/* 月經週期提示 */}
      {data.menstrualCycleNote && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-4">
          <p className="text-xs text-pink-700 leading-relaxed">{data.menstrualCycleNote}</p>
        </div>
      )}

      {/* 警告 */}
      {visibleWarnings.length > 0 && (
        <div className="space-y-1.5">
          {visibleWarnings.map((w: string, i: number) => (
            <p key={i} className="text-[11px] text-gray-500 leading-relaxed">{w}</p>
          ))}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mt-3">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          此為系統根據體重趨勢與飲食紀錄自動產生之參考建議，不構成個人化營養指導或醫療建議。
        </p>
      </div>
    </div>
  )
}
