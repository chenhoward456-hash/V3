'use client'

import { useState, useEffect } from 'react'

interface PeakWeekDay {
  daysOut: number
  date: string
  label: string
  phase: 'depletion' | 'fat_load' | 'carb_load' | 'taper' | 'show_day'
  carbs: number
  protein: number
  fat: number
  calories: number
  water: number
  sodiumNote: string
  fiberNote: string
  trainingNote: string
}

interface PeakWeekPlanProps {
  clientId: string
  competitionDate: string
  bodyWeight: number
}

const phaseColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  depletion: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  fat_load: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  carb_load: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  taper: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  show_day: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
}

const phaseLabels: Record<string, string> = {
  depletion: '碳水耗竭',
  fat_load: '脂肪補充',
  carb_load: '碳水超補',
  taper: '微調日',
  show_day: '比賽日',
}

export default function PeakWeekPlan({ clientId, competitionDate, bodyWeight }: PeakWeekPlanProps) {
  const [plan, setPlan] = useState<PeakWeekDay[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch(`/api/nutrition-suggestions?clientId=${clientId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.suggestion?.peakWeekPlan) {
          setPlan(data.suggestion.peakWeekPlan)
          // 自動展開今天
          const todayIdx = data.suggestion.peakWeekPlan.findIndex((d: PeakWeekDay) => d.date === todayStr)
          if (todayIdx >= 0) setExpandedDay(todayIdx)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchPlan()
  }, [clientId, todayStr])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="h-5 bg-gray-200 rounded w-40" />
        </div>
      </div>
    )
  }

  if (!plan || plan.length === 0) return null

  const todayPlan = plan.find(d => d.date === todayStr)
  const compDate = new Date(competitionDate)
  const daysLeft = Math.max(0, Math.ceil((compDate.getTime() - new Date().getTime()) / 86400000))

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-bold text-gray-900">Peak Week 計畫</h2>
        </div>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
          倒數 {daysLeft} 天
        </span>
      </div>

      {/* 今日重點卡片 */}
      {todayPlan && (
        <div className={`${phaseColors[todayPlan.phase]?.bg || 'bg-gray-50'} ${phaseColors[todayPlan.phase]?.border || 'border-gray-200'} border rounded-2xl p-4 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${phaseColors[todayPlan.phase]?.badge || 'bg-gray-100 text-gray-600'}`}>
                {phaseLabels[todayPlan.phase] || todayPlan.phase}
              </span>
              <span className="text-sm font-semibold text-gray-700">今日計畫</span>
            </div>
          </div>

          {/* 四大巨量 */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: '碳水', value: todayPlan.carbs, unit: 'g', emoji: '🍚' },
              { label: '蛋白質', value: todayPlan.protein, unit: 'g', emoji: '🥩' },
              { label: '脂肪', value: todayPlan.fat, unit: 'g', emoji: '🥑' },
              { label: '熱量', value: todayPlan.calories, unit: '', emoji: '🔥' },
            ].map(({ label, value, unit, emoji }) => (
              <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
                <p className="text-[10px] text-gray-500">{emoji} {label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-400">{unit || 'kcal'}</p>
              </div>
            ))}
          </div>

          {/* 水分 + 指引 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span>💧</span>
              <span className="text-gray-600">飲水：<strong>{(todayPlan.water / 1000).toFixed(1)}L</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🧂</span>
              <span className="text-gray-600">{todayPlan.sodiumNote}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🥬</span>
              <span className="text-gray-600">{todayPlan.fiberNote}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🏋️</span>
              <span className="text-gray-600">{todayPlan.trainingNote}</span>
            </div>
          </div>
        </div>
      )}

      {/* 7 天時間軸 */}
      <div className="space-y-2">
        {plan.map((day, idx) => {
          const isToday = day.date === todayStr
          const isPast = day.date < todayStr
          const isExpanded = expandedDay === idx
          const colors = phaseColors[day.phase] || phaseColors.depletion
          const dateObj = new Date(day.date)
          const dateLabel = dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
          const weekDayLabel = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]

          return (
            <div key={day.date}>
              <button
                onClick={() => setExpandedDay(isExpanded ? null : idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isToday ? `${colors.bg} ${colors.border} border-2 shadow-sm`
                  : isPast ? 'bg-gray-50 opacity-60'
                  : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* 日期 */}
                <div className="w-12 text-center shrink-0">
                  <p className={`text-xs font-bold ${isToday ? colors.text : 'text-gray-500'}`}>
                    {dateLabel}
                  </p>
                  <p className="text-[10px] text-gray-400">({weekDayLabel})</p>
                </div>

                {/* 階段標籤 */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${colors.badge}`}>
                  {phaseLabels[day.phase]}
                </span>

                {/* 簡要數據 */}
                <div className="flex-1 flex items-center gap-3 text-[10px] text-gray-500">
                  <span>🍚 {day.carbs}g</span>
                  <span>🥩 {day.protein}g</span>
                  <span>🔥 {day.calories}</span>
                  <span>💧 {(day.water / 1000).toFixed(1)}L</span>
                </div>

                {/* 展開箭頭 */}
                <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* 展開詳情 */}
              {isExpanded && (
                <div className={`ml-4 mr-2 mt-1 mb-2 px-4 py-3 rounded-xl border ${colors.bg} ${colors.border}`}>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div><span className="text-gray-500">碳水：</span><strong>{day.carbs}g</strong></div>
                    <div><span className="text-gray-500">蛋白質：</span><strong>{day.protein}g</strong></div>
                    <div><span className="text-gray-500">脂肪：</span><strong>{day.fat}g</strong></div>
                    <div><span className="text-gray-500">熱量：</span><strong>{day.calories} kcal</strong></div>
                    <div><span className="text-gray-500">飲水：</span><strong>{(day.water / 1000).toFixed(1)}L</strong></div>
                  </div>
                  <div className="space-y-1 text-[11px] text-gray-600 border-t border-gray-200 pt-2">
                    <p>🧂 {day.sodiumNote}</p>
                    <p>🥬 {day.fiberNote}</p>
                    <p>🏋️ {day.trainingNote}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 注意事項 */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 font-medium mb-1">⚠️ Peak Week 注意事項</p>
        <ul className="text-[11px] text-amber-600 space-y-0.5">
          <li>• 碳水超補期選精緻碳水（白飯、白吐司），避免高纖</li>
          <li>• 水分操控要循序漸進，不要突然斷水</li>
          <li>• 碳水超補後體重會增加 1-2kg（肝醣+水），屬正常現象</li>
          <li>• 如有任何不適，立即恢復正常飲食並通知教練</li>
        </ul>
      </div>
    </div>
  )
}
