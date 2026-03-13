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
  sodiumMg: number
  sodiumNote: string
  fiberNote: string
  trainingNote: string
  potassiumNote?: string
  foodNote?: string
  creatineNote?: string
  posingNote?: string
  pumpUpNote?: string
  waterMlPerKg?: number
  carbsGPerKg?: number
  proteinGPerKg?: number
  fatGPerKg?: number
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
  const [debugInfo, setDebugInfo] = useState<string>('fetching...')

  const todayStr = getLocalDateStr()
  const focusDate = previewDate || todayStr

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const queryId = code || clientId
        const url = `/api/nutrition-suggestions?clientId=${queryId}${code ? `&code=${code}` : ''}`
        setDebugInfo(`calling: ${url}`)
        const res = await fetch(url)
        if (!res.ok) {
          setDebugInfo(`API error: ${res.status} ${res.statusText}`)
          return
        }
        const data = await res.json()
        const keys = data.suggestion ? Object.keys(data.suggestion).join(', ') : 'no suggestion'
        const hasPW = !!data.suggestion?.peakWeekPlan
        const pwLen = data.suggestion?.peakWeekPlan?.length ?? 0
        setDebugInfo(`status=${data.status || 'ok'} | keys=[${keys}] | hasPeakWeek=${hasPW} | len=${pwLen}`)
        if (data.suggestion?.peakWeekPlan) {
          setPlan(data.suggestion.peakWeekPlan)
          const focusIdx = data.suggestion.peakWeekPlan.findIndex((d: PeakWeekDay) => d.date === focusDate)
          if (focusIdx >= 0) setExpandedDay(focusIdx)
        }
      } catch (err) {
        setDebugInfo(`fetch error: ${err}`)
        console.warn('[PeakWeekPlan] 載入失敗')
      }
      finally { setLoading(false) }
    }
    fetchPlan()
  }, [clientId, code, focusDate])

  /* DEBUG: 暫時顯示 API 回傳狀態 — 確認後刪除 */
  if (loading) {
    return (
      <div className="bg-black text-green-400 text-[10px] font-mono rounded-lg px-3 py-2 mb-3">
        PeakWeek DEBUG: loading... | props: compDate={competitionDate} weight={bodyWeight}
      </div>
    )
  }

  if (!plan || plan.length === 0) {
    return (
      <div className="bg-black text-green-400 text-[10px] font-mono rounded-lg px-3 py-2 mb-3">
        PeakWeek DEBUG: NO PLAN | {debugInfo} | props: compDate={competitionDate} weight={bodyWeight}
      </div>
    )
  }

  const focusPlan = plan.find(d => d.date === focusDate)
  const compDate = new Date(competitionDate)
  const daysLeft = Math.max(0, Math.ceil((compDate.getTime() - new Date().getTime()) / 86400000))
  const focusLabel = previewDate ? '明日計畫' : '今日計畫'

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

      {/* ===== 焦點日重點卡片 ===== */}
      {focusPlan && (
        <div className={`${phaseColors[focusPlan.phase]?.bg || 'bg-gray-50'} ${phaseColors[focusPlan.phase]?.border || 'border-gray-200'} border-2 rounded-2xl p-4 mb-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${phaseColors[focusPlan.phase]?.badge || 'bg-gray-100 text-gray-600'}`}>
                {phaseLabels[focusPlan.phase] || focusPlan.phase}
              </span>
              <span className="text-sm font-semibold text-gray-700">{focusLabel}</span>
            </div>
            <span className="text-[10px] text-gray-400">Day {focusPlan.daysOut}</span>
          </div>

          {/* 六大指標：碳水、蛋白質、脂肪、熱量、水、鈉 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: '碳水', value: focusPlan.carbs, unit: 'g', emoji: '🍚' },
              { label: '蛋白質', value: focusPlan.protein, unit: 'g', emoji: '🥩' },
              { label: '脂肪', value: focusPlan.fat, unit: 'g', emoji: '🥑' },
              { label: '熱量', value: focusPlan.calories, unit: 'kcal', emoji: '🔥' },
              { label: '飲水', value: `${(focusPlan.water / 1000).toFixed(1)}`, unit: 'L', emoji: '💧' },
              { label: '鈉', value: focusPlan.sodiumMg, unit: 'mg', emoji: '🧂' },
            ].map(({ label, value, unit, emoji }) => (
              <div key={label} className="text-center bg-white bg-opacity-70 rounded-xl py-2 px-1">
                <p className="text-[10px] text-gray-500">{emoji} {label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-400">{unit}</p>
              </div>
            ))}
          </div>

          {/* 關鍵指引 */}
          <div className="space-y-2 text-xs">
            {/* 鈉策略（醒目） */}
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="font-semibold text-gray-700 mb-0.5">🧂 鈉策略</p>
              <p className="text-gray-600">{focusPlan.sodiumNote}</p>
            </div>

            {/* 飲水說明 */}
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="font-semibold text-gray-700 mb-0.5">💧 飲水</p>
              <p className="text-gray-600">{(focusPlan.water / 1000).toFixed(1)}L（{focusPlan.waterMlPerKg || Math.round(focusPlan.water / bodyWeight)} mL/kg）</p>
            </div>

            {/* 鉀離子 */}
            {focusPlan.potassiumNote && (
              <div className="bg-white/60 rounded-lg px-3 py-2">
                <p className="font-semibold text-gray-700 mb-0.5">🍌 鉀離子</p>
                <p className="text-gray-600">{focusPlan.potassiumNote}</p>
              </div>
            )}

            {/* 纖維 */}
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="font-semibold text-gray-700 mb-0.5">🥬 纖維</p>
              <p className="text-gray-600">{focusPlan.fiberNote}</p>
            </div>

            {/* 訓練 */}
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="font-semibold text-gray-700 mb-0.5">🏋️ 訓練</p>
              <p className="text-gray-600">{focusPlan.trainingNote}</p>
            </div>

            {/* Posing */}
            {focusPlan.posingNote && (
              <div className="bg-white/60 rounded-lg px-3 py-2">
                <p className="font-semibold text-gray-700 mb-0.5">🪞 Posing</p>
                <p className="text-gray-600">{focusPlan.posingNote}</p>
              </div>
            )}

            {/* 食物建議 */}
            {focusPlan.foodNote && (
              <div className="bg-white/60 rounded-lg px-3 py-2 border border-gray-200">
                <p className="font-semibold text-gray-700 mb-0.5">🍽️ 食物來源建議</p>
                <p className="text-gray-600">{focusPlan.foodNote}</p>
              </div>
            )}

            {/* 肌酸 */}
            {focusPlan.creatineNote && (
              <div className="bg-white/60 rounded-lg px-3 py-2">
                <p className="font-semibold text-gray-700 mb-0.5">💊 肌酸</p>
                <p className="text-gray-600">{focusPlan.creatineNote}</p>
              </div>
            )}

            {/* 比賽日 Pump-up */}
            {focusPlan.pumpUpNote && (
              <div className="bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2.5">
                <p className="font-bold text-amber-700 mb-1">💪 後台 Pump-up 指引</p>
                <p className="text-[11px] text-amber-600 leading-relaxed">{focusPlan.pumpUpNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 7 天總覽表 ===== */}
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-500 mb-2">📅 完整 7 天計畫</p>
      </div>

      {/* 表格式總覽 — 一眼看出每天的差異 */}
      <div className="overflow-x-auto -mx-2 px-2 mb-4">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left py-1 px-1.5 font-medium">日期</th>
              <th className="text-left py-1 px-1.5 font-medium">階段</th>
              <th className="text-right py-1 px-1.5 font-medium">碳水</th>
              <th className="text-right py-1 px-1.5 font-medium">蛋白</th>
              <th className="text-right py-1 px-1.5 font-medium">脂肪</th>
              <th className="text-right py-1 px-1.5 font-medium">熱量</th>
              <th className="text-right py-1 px-1.5 font-medium">水</th>
              <th className="text-right py-1 px-1.5 font-medium">鈉</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((day) => {
              const isFocus = day.date === focusDate
              const isPast = day.date < todayStr
              const colors = phaseColors[day.phase] || phaseColors.depletion
              const dateObj = new Date(day.date + 'T12:00:00')
              const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
              const weekDay = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]

              return (
                <tr
                  key={day.date}
                  className={`border-t border-gray-100 ${
                    isFocus ? `${colors.bg} font-bold` : isPast ? 'opacity-40' : ''
                  }`}
                >
                  <td className="py-1.5 px-1.5 whitespace-nowrap">
                    <span className={isFocus ? colors.text : 'text-gray-600'}>
                      {dateLabel}({weekDay})
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${colors.badge}`}>
                      {phaseLabels[day.phase]}
                    </span>
                  </td>
                  <td className="text-right py-1.5 px-1.5 text-gray-700">{day.carbs}g</td>
                  <td className="text-right py-1.5 px-1.5 text-gray-700">{day.protein}g</td>
                  <td className="text-right py-1.5 px-1.5 text-gray-700">{day.fat}g</td>
                  <td className="text-right py-1.5 px-1.5 text-gray-700">{day.calories}</td>
                  <td className="text-right py-1.5 px-1.5 text-blue-600 font-semibold">{(day.water / 1000).toFixed(1)}L</td>
                  <td className="text-right py-1.5 px-1.5 text-orange-600 font-semibold">{day.sodiumMg}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ===== 各天展開詳情 ===== */}
      <div className="space-y-2">
        {plan.map((day, idx) => {
          const isFocus = day.date === focusDate
          const isPast = day.date < todayStr
          const isExpanded = expandedDay === idx
          const colors = phaseColors[day.phase] || phaseColors.depletion
          const dateObj = new Date(day.date + 'T12:00:00')
          const dateLabel = dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
          const weekDayLabel = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]

          return (
            <div key={day.date}>
              <button
                onClick={() => setExpandedDay(isExpanded ? null : idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isFocus ? `${colors.bg} ${colors.border} border-2 shadow-sm`
                  : isPast ? 'bg-gray-50 opacity-60'
                  : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="w-12 text-center shrink-0">
                  <p className={`text-xs font-bold ${isFocus ? colors.text : 'text-gray-500'}`}>
                    {dateLabel}
                  </p>
                  <p className="text-[10px] text-gray-400">({weekDayLabel})</p>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${colors.badge}`}>
                  {phaseLabels[day.phase]}
                </span>

                <div className="flex-1 flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                  <span>🍚{day.carbs}g</span>
                  <span>🔥{day.calories}</span>
                  <span className="text-blue-500 font-semibold">💧{(day.water / 1000).toFixed(1)}L</span>
                  <span className="text-orange-500 font-semibold">🧂{day.sodiumMg}mg</span>
                </div>

                <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {isExpanded && (
                <div className={`ml-4 mr-2 mt-1 mb-2 px-4 py-3 rounded-xl border ${colors.bg} ${colors.border}`}>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div><span className="text-gray-500">碳水：</span><strong>{day.carbs}g</strong></div>
                    <div><span className="text-gray-500">蛋白質：</span><strong>{day.protein}g</strong></div>
                    <div><span className="text-gray-500">脂肪：</span><strong>{day.fat}g</strong></div>
                    <div><span className="text-gray-500">熱量：</span><strong>{day.calories} kcal</strong></div>
                    <div><span className="text-blue-600">飲水：</span><strong className="text-blue-700">{(day.water / 1000).toFixed(1)}L</strong></div>
                    <div><span className="text-orange-600">鈉：</span><strong className="text-orange-700">{day.sodiumMg}mg</strong></div>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-gray-600 border-t border-gray-200 pt-2">
                    <p><strong>🧂 鈉策略：</strong>{day.sodiumNote}</p>
                    {day.potassiumNote && <p><strong>🍌 鉀離子：</strong>{day.potassiumNote}</p>}
                    <p><strong>🥬 纖維：</strong>{day.fiberNote}</p>
                    <p><strong>🏋️ 訓練：</strong>{day.trainingNote}</p>
                    {day.posingNote && <p><strong>🪞 Posing：</strong>{day.posingNote}</p>}
                    {day.foodNote && (
                      <div className="mt-1 bg-white/60 rounded-lg px-2.5 py-2 border border-gray-200">
                        <p><strong>🍽️ 食物來源：</strong>{day.foodNote}</p>
                      </div>
                    )}
                    {day.creatineNote && <p><strong>💊 肌酸：</strong>{day.creatineNote}</p>}
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

      {/* 注意事項 */}
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
          </ul>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mt-3">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          此計畫由系統根據文獻公式自動產生，僅供教練與選手參考，不構成醫療建議。Peak Week 涉及水分與鈉操作，請務必在教練監督下執行。
        </p>
      </div>
    </div>
  )
}
