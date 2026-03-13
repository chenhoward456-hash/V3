'use client'

import { useState, useEffect } from 'react'
import { getLocalDateStr } from '@/lib/date-utils'

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
  sodiumMg?: number
  sodiumNote: string
  fiberNote: string
  trainingNote: string
  potassiumNote?: string
  foodNote?: string
  creatineNote?: string
  posingNote?: string
  pumpUpNote?: string
}

interface PeakWeekPlanProps {
  clientId: string
  code?: string
  competitionDate: string
  bodyWeight: number
  /** 預覽日期（看明天的計畫時傳入） */
  previewDate?: string
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

export default function PeakWeekPlan({ clientId, code, competitionDate, bodyWeight, previewDate }: PeakWeekPlanProps) {
  const [plan, setPlan] = useState<PeakWeekDay[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const todayStr = getLocalDateStr()
  // 顯示的焦點日：預覽模式用 previewDate，否則用今天
  const focusDate = previewDate || todayStr

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch(`/api/nutrition-suggestions?clientId=${clientId}${code ? `&code=${code}` : ''}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.suggestion?.peakWeekPlan) {
          setPlan(data.suggestion.peakWeekPlan)
          // 自動展開焦點日（預覽 or 今天）
          const focusIdx = data.suggestion.peakWeekPlan.findIndex((d: PeakWeekDay) => d.date === focusDate)
          if (focusIdx >= 0) setExpandedDay(focusIdx)
        }
      } catch {
        console.warn('[PeakWeekPlan] 載入失敗')
      }
      finally { setLoading(false) }
    }
    fetchPlan()
  }, [clientId, code, focusDate])

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

  const todayPlan = plan.find(d => d.date === focusDate)
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
              <span className="text-sm font-semibold text-gray-700">{previewDate ? '明日計畫' : '今日計畫'}</span>
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

          {/* 水分 + 基本指引 */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">💧</span>
              <span className="text-gray-600">飲水：<strong>{(todayPlan.water / 1000).toFixed(1)}L</strong></span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🧂</span>
              <span className="text-gray-600">鈉：{todayPlan.sodiumMg ? <><strong>{todayPlan.sodiumMg}mg</strong> — </> : ''}{todayPlan.sodiumNote}</span>
            </div>
            {todayPlan.potassiumNote && (
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🍌</span>
                <span className="text-gray-600">{todayPlan.potassiumNote}</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🥬</span>
              <span className="text-gray-600">{todayPlan.fiberNote}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🏋️</span>
              <span className="text-gray-600">{todayPlan.trainingNote}</span>
            </div>
            {todayPlan.posingNote && (
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🪞</span>
                <span className="text-gray-600">{todayPlan.posingNote}</span>
              </div>
            )}
          </div>

          {/* 食物建議（獨立區塊，更醒目） */}
          {todayPlan.foodNote && (
            <div className="mt-3 pt-2.5 border-t border-gray-200/50">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🍽️</span>
                <span className="text-gray-600">{todayPlan.foodNote}</span>
              </div>
            </div>
          )}

          {/* 肌酸建議 */}
          {todayPlan.creatineNote && (
            <div className="mt-1.5">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">💊</span>
                <span className="text-gray-600">{todayPlan.creatineNote}</span>
              </div>
            </div>
          )}

          {/* 比賽日 Pump-up 指引（特別醒目） */}
          {todayPlan.pumpUpNote && (
            <div className="mt-3 bg-amber-100/60 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-amber-700 mb-1">💪 後台 Pump-up 指引</p>
              <p className="text-[11px] text-amber-600 leading-relaxed">{todayPlan.pumpUpNote}</p>
            </div>
          )}
        </div>
      )}

      {/* 7 天時間軸 */}
      <div className="space-y-2">
        {plan.map((day, idx) => {
          const isToday = day.date === focusDate
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
                  {/* 巨量營養素 */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div><span className="text-gray-500">碳水：</span><strong>{day.carbs}g</strong></div>
                    <div><span className="text-gray-500">蛋白質：</span><strong>{day.protein}g</strong></div>
                    <div><span className="text-gray-500">脂肪：</span><strong>{day.fat}g</strong></div>
                    <div><span className="text-gray-500">熱量：</span><strong>{day.calories} kcal</strong></div>
                    <div><span className="text-gray-500">飲水：</span><strong>{(day.water / 1000).toFixed(1)}L</strong></div>
                    {day.sodiumMg && <div><span className="text-gray-500">鈉：</span><strong>{day.sodiumMg}mg</strong></div>}
                  </div>
                  {/* 詳細指引 */}
                  <div className="space-y-1.5 text-[11px] text-gray-600 border-t border-gray-200 pt-2">
                    <p>🧂 {day.sodiumNote}</p>
                    {day.potassiumNote && <p>🍌 {day.potassiumNote}</p>}
                    <p>🥬 {day.fiberNote}</p>
                    <p>🏋️ {day.trainingNote}</p>
                    {day.posingNote && <p>🪞 {day.posingNote}</p>}
                    {day.foodNote && <p>🍽️ {day.foodNote}</p>}
                    {day.creatineNote && <p>💊 {day.creatineNote}</p>}
                    {day.pumpUpNote && (
                      <div className="mt-1 bg-amber-100/50 rounded-lg px-2.5 py-2">
                        <p className="font-medium text-amber-700">💪 Pump-up：</p>
                        <p className="text-amber-600 mt-0.5">{day.pumpUpNote}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 注意事項 — 升級為完整的科學提醒 */}
      <div className="mt-4 space-y-2">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 font-medium mb-1">⚠️ Peak Week 關鍵注意事項</p>
          <ul className="text-[11px] text-amber-600 space-y-1">
            <li>• 碳水超補期選精緻高 GI 碳水（白飯、白吐司、年糕），避免高纖食物</li>
            <li>• <strong>不要突然斷水或斷鈉</strong> — 醛固酮反彈會導致皮下水分滯留，肌肉反而看起來更水</li>
            <li>• 碳水超補後體重增加 1-2kg 屬正常（肝醣 + 細胞內水分），不是變胖</li>
            <li>• 維持肌酸補充 — 停肌酸會流失細胞內水分，肌肉飽滿度下降</li>
            <li>• Day 3 起不做重訓 — 任何訓練都會消耗超補的肝醣</li>
            <li>• 如有腹脹、腸胃不適，減少單餐碳水量並增加餐數</li>
            <li>• 如有任何不適，立即恢復正常飲食並通知教練</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 font-medium mb-1">📋 建議：賽前 2-4 週做一次模擬 Peak Week</p>
          <p className="text-[11px] text-blue-600">
            在相似的身體狀態下練習完整的碳水耗竭→超補流程，觀察身體反應（GI 耐受度、視覺效果、體重變化），
            根據結果調整正式 Peak Week 的碳水量和食物選擇。文獻強烈建議不要第一次就在正式比賽執行 [12][14]。
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mt-3">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          此計畫由系統根據文獻公式自動產生，僅供教練與選手參考，不構成醫療建議。Peak Week 涉及水分與鈉操作，請務必在教練監督下執行。如有任何身體不適，應立即停止並諮詢醫師。
        </p>
      </div>
    </div>
  )
}
