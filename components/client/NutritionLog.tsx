'use client'

import { useState, useMemo } from 'react'
import NutrientSlider from './NutrientSlider'

interface NutritionLogProps {
  todayNutrition: { id?: string; date: string; compliant: boolean | null; note: string | null; protein_grams: number | null; water_ml: number | null; carbs_grams?: number | null; fat_grams?: number | null; calories?: number | null } | null
  nutritionLogs: any[]
  clientId: string
  date?: string
  proteinTarget?: number | null
  waterTarget?: number | null
  competitionEnabled?: boolean
  carbsTarget?: number | null
  fatTarget?: number | null
  caloriesTarget?: number | null
  carbsCyclingEnabled?: boolean
  isTrainingDay?: boolean
  onMutate: () => void
}

export default function NutritionLog({ todayNutrition, nutritionLogs, clientId, date, proteinTarget, waterTarget, competitionEnabled, carbsTarget, fatTarget, caloriesTarget, carbsCyclingEnabled, isTrainingDay, onMutate }: NutritionLogProps) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(todayNutrition?.note || '')
  const [showNote, setShowNote] = useState(false)
  const [proteinInput, setProteinInput] = useState<string>(todayNutrition?.protein_grams?.toString() || '')
  const [waterInput, setWaterInput] = useState<string>(todayNutrition?.water_ml?.toString() || '')
  const [carbsInput, setCarbsInput] = useState<string>(todayNutrition?.carbs_grams?.toString() || '')
  const [fatInput, setFatInput] = useState<string>(todayNutrition?.fat_grams?.toString() || '')
  const [savingNutrients, setSavingNutrients] = useState(false)

  const today = date || new Date().toISOString().split('T')[0]

  // 自動計算熱量：蛋白質×4 + 碳水×4 + 脂肪×9
  const computedCalories = useMemo(() => {
    const p = proteinInput ? Number(proteinInput) : 0
    const c = carbsInput ? Number(carbsInput) : 0
    const f = fatInput ? Number(fatInput) : 0
    if (!p && !c && !f) return null
    return Math.round(p * 4 + c * 4 + f * 9)
  }, [proteinInput, carbsInput, fatInput])

  const handleSubmit = async (compliant: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today, compliant, note: note || null,
          protein_grams: proteinInput ? Number(proteinInput) : null,
          water_ml: waterInput ? Number(waterInput) : null,
          carbs_grams: carbsInput ? Number(carbsInput) : null,
          fat_grams: fatInput ? Number(fatInput) : null,
          calories: computedCalories,
        })
      })
      if (!res.ok) throw new Error('記錄失敗')
      onMutate()
    } catch {
      alert('記錄失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNote = async () => {
    if (todayNutrition?.compliant == null) return
    setSaving(true)
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today, compliant: todayNutrition.compliant, note: note || null,
          protein_grams: proteinInput ? Number(proteinInput) : null,
          water_ml: waterInput ? Number(waterInput) : null,
          carbs_grams: carbsInput ? Number(carbsInput) : null,
          fat_grams: fatInput ? Number(fatInput) : null,
          calories: computedCalories,
        })
      })
      if (!res.ok) throw new Error('儲存失敗')
      onMutate()
      setShowNote(false)
    } catch {
      alert('儲存失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNutrients = async () => {
    if (todayNutrition?.compliant == null) return
    setSavingNutrients(true)
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today, compliant: todayNutrition.compliant, note: todayNutrition.note || null,
          protein_grams: proteinInput ? Number(proteinInput) : null,
          water_ml: waterInput ? Number(waterInput) : null,
          carbs_grams: carbsInput ? Number(carbsInput) : null,
          fat_grams: fatInput ? Number(fatInput) : null,
          calories: computedCalories,
        })
      })
      if (!res.ok) throw new Error('儲存失敗')
      onMutate()
    } catch {
      alert('儲存失敗，請重試')
    } finally {
      setSavingNutrients(false)
    }
  }

  // 本週 7 天一覽
  const weekDays = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)

    const days: { date: string; label: string; log: any; isToday: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        label: ['一', '二', '三', '四', '五', '六', '日'][i],
        log: nutritionLogs.find((l: any) => l.date === dateStr) || null,
        isToday: dateStr === today,
      })
    }
    return days
  }, [nutritionLogs, today])

  // 本週合規率
  const weekStats = useMemo(() => {
    const weekLogs = weekDays.filter(d => d.log != null)
    const compliant = weekLogs.filter(d => d.log?.compliant).length
    const total = weekLogs.length
    return { compliant, total, rate: total > 0 ? Math.round((compliant / total) * 100) : 0 }
  }, [weekDays])

  // 近 30 天合規趨勢
  const monthStats = useMemo(() => {
    if (!nutritionLogs.length) return { compliant: 0, total: 0, rate: 0 }
    const compliant = nutritionLogs.filter((l: any) => l.compliant).length
    return { compliant, total: nutritionLogs.length, rate: Math.round((compliant / nutritionLogs.length) * 100) }
  }, [nutritionLogs])

  // 近 7 天蛋白質/水量趨勢
  const nutrientTrend = useMemo(() => {
    if (!proteinTarget && !waterTarget) return null
    const days: { label: string; protein: number | null; water: number | null }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const log = nutritionLogs.find((l: any) => l.date === dateStr)
      days.push({
        label: d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
        protein: log?.protein_grams ?? null,
        water: log?.water_ml ?? null,
      })
    }
    const hasAnyProtein = proteinTarget && days.some(d => d.protein != null)
    const hasAnyWater = waterTarget && days.some(d => d.water != null)
    if (!hasAnyProtein && !hasAnyWater) return null
    return { days, hasAnyProtein, hasAnyWater }
  }, [nutritionLogs, proteinTarget, waterTarget])

  const hasRecorded = todayNutrition?.compliant != null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">🍽️ 飲食紀錄</h2>
        {hasRecorded && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            todayNutrition.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {todayNutrition.compliant ? '已合規' : '未合規'}
          </span>
        )}
      </div>

      {/* 備賽巨量營養素進度快照 */}
      {competitionEnabled && hasRecorded && (caloriesTarget || carbsTarget || fatTarget) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-amber-700">🏆 今日巨量營養素</p>
            {carbsCyclingEnabled && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isTrainingDay ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'}`}>
                🔄 {isTrainingDay ? '訓練日' : '休息日'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {caloriesTarget && (
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-1">🔥 熱量</p>
                <p className={`text-lg font-bold ${computedCalories && computedCalories >= caloriesTarget * 0.9 && computedCalories <= caloriesTarget * 1.1 ? 'text-green-600' : computedCalories ? 'text-orange-600' : 'text-gray-300'}`}>
                  {computedCalories ?? '--'}
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${computedCalories && computedCalories >= caloriesTarget * 0.9 ? 'bg-green-500' : 'bg-orange-400'}`}
                    style={{ width: `${Math.min(100, computedCalories ? (computedCalories / caloriesTarget) * 100 : 0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">/ {caloriesTarget}</p>
              </div>
            )}
            {carbsTarget && (
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-1">🍚 碳水</p>
                <p className={`text-lg font-bold ${carbsInput && Number(carbsInput) >= carbsTarget * 0.9 && Number(carbsInput) <= carbsTarget * 1.1 ? 'text-green-600' : Number(carbsInput) ? 'text-amber-600' : 'text-gray-300'}`}>
                  {carbsInput ? `${Number(carbsInput)}g` : '--'}
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${carbsInput && Number(carbsInput) >= carbsTarget * 0.9 ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, carbsInput ? (Number(carbsInput) / carbsTarget) * 100 : 0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">/ {carbsTarget}g</p>
              </div>
            )}
            {fatTarget && (
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-1">🥑 脂肪</p>
                <p className={`text-lg font-bold ${fatInput && Number(fatInput) >= fatTarget * 0.9 && Number(fatInput) <= fatTarget * 1.1 ? 'text-green-600' : Number(fatInput) ? 'text-yellow-600' : 'text-gray-300'}`}>
                  {fatInput ? `${Number(fatInput)}g` : '--'}
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${fatInput && Number(fatInput) >= fatTarget * 0.9 ? 'bg-green-500' : 'bg-yellow-400'}`}
                    style={{ width: `${Math.min(100, fatInput ? (Number(fatInput) / fatTarget) * 100 : 0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">/ {fatTarget}g</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 今日狀態按鈕 */}
      {!hasRecorded ? (
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-3">今天有照計畫吃嗎？</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="flex items-center justify-center gap-2 py-4 bg-green-50 border-2 border-green-200 rounded-2xl text-green-700 font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl">✅</span>
              <span>照計畫吃</span>
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="flex items-center justify-center gap-2 py-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl">❌</span>
              <span>沒照計畫</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className={`flex-1 py-3 rounded-2xl font-medium text-sm transition-colors ${
                todayNutrition.compliant
                  ? 'bg-green-100 border-2 border-green-400 text-green-700'
                  : 'bg-gray-50 border-2 border-gray-200 text-gray-400 hover:bg-green-50'
              }`}
            >
              ✅ 照計畫吃
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className={`flex-1 py-3 rounded-2xl font-medium text-sm transition-colors ${
                !todayNutrition.compliant
                  ? 'bg-red-100 border-2 border-red-400 text-red-700'
                  : 'bg-gray-50 border-2 border-gray-200 text-gray-400 hover:bg-red-50'
              }`}
            >
              ❌ 沒照計畫
            </button>
          </div>

          {/* 備註 */}
          {todayNutrition.note && !showNote && (
            <div className="bg-gray-50 rounded-xl p-3 mb-2">
              <p className="text-sm text-gray-600">{todayNutrition.note}</p>
              <button onClick={() => { setNote(todayNutrition.note || ''); setShowNote(true) }} className="text-xs text-blue-600 mt-1">
                編輯備註
              </button>
            </div>
          )}
          {!todayNutrition.note && !showNote && (
            <button onClick={() => setShowNote(true)} className="text-sm text-blue-600">
              + 新增備註
            </button>
          )}

          {/* 蛋白質 & 水量（滑桿模式） */}
          {(proteinTarget || waterTarget) && (
            <div className="mt-4 space-y-4">
              {proteinTarget && (
                <NutrientSlider
                  label="蛋白質" emoji="🥩"
                  value={proteinInput} onChange={setProteinInput}
                  target={proteinTarget} unit="g"
                  max={Math.max(300, (proteinTarget || 150) * 1.5)} step={5}
                  color="blue"
                />
              )}
              {waterTarget && (
                <NutrientSlider
                  label="飲水量" emoji="💧"
                  value={waterInput} onChange={setWaterInput}
                  target={waterTarget} unit="ml"
                  max={Math.max(5000, (waterTarget || 2500) * 1.5)} step={100}
                  color="cyan"
                />
              )}
              {/* 備賽巨量營養素 */}
              {competitionEnabled && (
                <div className="border-t border-gray-100 pt-3 mt-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-600">🏆 備賽巨量營養素</p>
                    {carbsCyclingEnabled && (
                      <span className={`text-[10px] font-medium ${isTrainingDay ? 'text-cyan-600' : 'text-gray-500'}`}>
                        🔄 {isTrainingDay ? '訓練日碳水' : '休息日碳水'}
                      </span>
                    )}
                  </div>
                  <NutrientSlider
                    label="碳水" emoji="🍚"
                    value={carbsInput} onChange={setCarbsInput}
                    target={carbsTarget} unit="g"
                    max={Math.max(500, (carbsTarget || 250) * 1.5)} step={5}
                    color="amber"
                  />
                  <NutrientSlider
                    label="脂肪" emoji="🥑"
                    value={fatInput} onChange={setFatInput}
                    target={fatTarget} unit="g"
                    max={Math.max(200, (fatTarget || 80) * 2)} step={5}
                    color="yellow"
                  />
                  {/* 自動計算熱量顯示 */}
                  <div className="bg-orange-50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">🔥 熱量（自動計算）</span>
                      <span className={`text-lg font-bold ${
                        computedCalories && caloriesTarget && computedCalories >= caloriesTarget * 0.9 && computedCalories <= caloriesTarget * 1.1
                          ? 'text-green-600'
                          : computedCalories ? 'text-orange-600' : 'text-gray-300'
                      }`}>
                        {computedCalories ?? '--'} <span className="text-xs font-normal text-gray-400">kcal</span>
                      </span>
                    </div>
                    {caloriesTarget && computedCalories && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${computedCalories >= caloriesTarget * 0.9 ? 'bg-green-500' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(100, (computedCalories / caloriesTarget) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${computedCalories >= caloriesTarget * 0.9 && computedCalories <= caloriesTarget * 1.1 ? 'text-green-600' : 'text-orange-600'}`}>
                          {Math.round((computedCalories / caloriesTarget) * 100)}%
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">= 蛋白質×4 + 碳水×4 + 脂肪×9{caloriesTarget ? ` ｜ 目標 ${caloriesTarget} kcal` : ''}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleSaveNutrients}
                disabled={savingNutrients}
                className="w-full py-2.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {savingNutrients ? '儲存中...' : '儲存飲食數據'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 備註輸入 */}
      {showNote && (
        <div className="mb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="今天吃了什麼？有什麼特別情況？"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              儲存
            </button>
            <button
              onClick={() => setShowNote(false)}
              className="px-4 py-1.5 text-gray-500 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 本週一覽 */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">本週一覽</p>
          {weekStats.total > 0 && (
            <span className={`text-sm font-bold ${weekStats.rate >= 80 ? 'text-green-600' : weekStats.rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {weekStats.rate}%
            </span>
          )}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.date} className="text-center">
              <p className={`text-xs mb-1 ${day.isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>{day.label}</p>
              <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-lg ${
                day.isToday ? 'ring-2 ring-blue-400' : ''
              } ${
                day.log == null
                  ? 'bg-gray-50'
                  : day.log.compliant
                    ? 'bg-green-50'
                    : 'bg-red-50'
              }`}>
                {day.log == null ? '' : day.log.compliant ? '✅' : '❌'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 蛋白質/水量 7 天趨勢 */}
      {nutrientTrend && (
        <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
          {nutrientTrend.hasAnyProtein && proteinTarget && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">近 7 天蛋白質</p>
                <p className="text-xs text-gray-400">目標 {proteinTarget}g</p>
              </div>
              <div className="flex items-end gap-1 h-16">
                {nutrientTrend.days.map((d, i) => {
                  const pct = d.protein != null ? Math.min(100, (d.protein / proteinTarget) * 100) : 0
                  const reached = d.protein != null && d.protein >= proteinTarget
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex flex-col justify-end h-12">
                        {d.protein != null ? (
                          <div
                            className={`w-full rounded-t transition-all ${reached ? 'bg-green-400' : 'bg-blue-300'}`}
                            style={{ height: `${Math.max(8, pct)}%` }}
                            title={`${d.protein}g`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-end justify-center">
                            <div className="w-full h-2 bg-gray-100 rounded border border-dashed border-gray-200" title="未記錄" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{d.label.split('/')[1]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {nutrientTrend.hasAnyWater && waterTarget && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">近 7 天飲水量</p>
                <p className="text-xs text-gray-400">目標 {waterTarget}ml</p>
              </div>
              <div className="flex items-end gap-1 h-16">
                {nutrientTrend.days.map((d, i) => {
                  const pct = d.water != null ? Math.min(100, (d.water / waterTarget) * 100) : 0
                  const reached = d.water != null && d.water >= waterTarget
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex flex-col justify-end h-12">
                        {d.water != null ? (
                          <div
                            className={`w-full rounded-t transition-all ${reached ? 'bg-green-400' : 'bg-cyan-300'}`}
                            style={{ height: `${Math.max(8, pct)}%` }}
                            title={`${d.water}ml`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-end justify-center">
                            <div className="w-full h-2 bg-gray-100 rounded border border-dashed border-gray-200" title="未記錄" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{d.label.split('/')[1]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 近 30 天趨勢 */}
      {monthStats.total > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">近 30 天合規率</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${monthStats.rate >= 80 ? 'bg-green-500' : monthStats.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${monthStats.rate}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${monthStats.rate >= 80 ? 'text-green-600' : monthStats.rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {monthStats.rate}%
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{monthStats.compliant}/{monthStats.total} 天合規</p>
        </div>
      )}
    </div>
  )
}
