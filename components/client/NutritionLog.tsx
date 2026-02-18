'use client'

import { useState, useMemo } from 'react'

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
  onMutate: () => void
}

export default function NutritionLog({ todayNutrition, nutritionLogs, clientId, date, proteinTarget, waterTarget, competitionEnabled, carbsTarget, fatTarget, caloriesTarget, onMutate }: NutritionLogProps) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(todayNutrition?.note || '')
  const [showNote, setShowNote] = useState(false)
  const [proteinInput, setProteinInput] = useState<string>(todayNutrition?.protein_grams?.toString() || '')
  const [waterInput, setWaterInput] = useState<string>(todayNutrition?.water_ml?.toString() || '')
  const [carbsInput, setCarbsInput] = useState<string>(todayNutrition?.carbs_grams?.toString() || '')
  const [fatInput, setFatInput] = useState<string>(todayNutrition?.fat_grams?.toString() || '')
  const [caloriesInput, setCaloriesInput] = useState<string>(todayNutrition?.calories?.toString() || '')
  const [savingNutrients, setSavingNutrients] = useState(false)

  const today = date || new Date().toISOString().split('T')[0]

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
          calories: caloriesInput ? Number(caloriesInput) : null,
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
          calories: caloriesInput ? Number(caloriesInput) : null,
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
          calories: caloriesInput ? Number(caloriesInput) : null,
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

          {/* 蛋白質 & 水量 */}
          {(proteinTarget || waterTarget) && (
            <div className="mt-4 space-y-3">
              {proteinTarget && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-600">蛋白質</label>
                    <span className="text-xs text-gray-400">目標 {proteinTarget}g</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={proteinInput}
                      onChange={(e) => setProteinInput(e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">g</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          proteinInput && Number(proteinInput) >= proteinTarget ? 'bg-green-500' : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.min(100, proteinInput ? (Number(proteinInput) / proteinTarget) * 100 : 0)}%` }}
                      />
                    </div>
                    {proteinInput && (
                      <span className={`text-xs font-medium ${Number(proteinInput) >= proteinTarget ? 'text-green-600' : 'text-blue-600'}`}>
                        {Math.round((Number(proteinInput) / proteinTarget) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              {waterTarget && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-600">飲水量</label>
                    <span className="text-xs text-gray-400">目標 {waterTarget}ml</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={waterInput}
                      onChange={(e) => setWaterInput(e.target.value)}
                      placeholder="0"
                      step="100"
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">ml</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          waterInput && Number(waterInput) >= waterTarget ? 'bg-green-500' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.min(100, waterInput ? (Number(waterInput) / waterTarget) * 100 : 0)}%` }}
                      />
                    </div>
                    {waterInput && (
                      <span className={`text-xs font-medium ${Number(waterInput) >= waterTarget ? 'text-green-600' : 'text-cyan-600'}`}>
                        {Math.round((Number(waterInput) / waterTarget) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* 備賽巨量營養素 */}
              {competitionEnabled && (
                <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
                  <p className="text-xs font-semibold text-amber-600">🏆 備賽巨量營養素</p>
                  {[
                    { label: '熱量', emoji: '🔥', value: caloriesInput, setter: setCaloriesInput, target: caloriesTarget, unit: 'kcal', color: 'orange' },
                    { label: '碳水', emoji: '🍚', value: carbsInput, setter: setCarbsInput, target: carbsTarget, unit: 'g', color: 'amber' },
                    { label: '脂肪', emoji: '🥑', value: fatInput, setter: setFatInput, target: fatTarget, unit: 'g', color: 'yellow' },
                  ].map(({ label, emoji, value, setter, target, unit, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-gray-600">{emoji} {label}</label>
                        {target && <span className="text-xs text-gray-400">目標 {target}{unit}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">{unit}</span>
                        {target ? (
                          <>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${value && Number(value) >= target ? 'bg-green-500' : `bg-${color}-400`}`}
                                style={{ width: `${Math.min(100, value ? (Number(value) / target) * 100 : 0)}%` }}
                              />
                            </div>
                            {value && (
                              <span className={`text-xs font-medium ${Number(value) >= target ? 'text-green-600' : `text-${color}-600`}`}>
                                {Math.round((Number(value) / target) * 100)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleSaveNutrients}
                disabled={savingNutrients}
                className="w-full py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
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
