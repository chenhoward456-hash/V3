'use client'

import { useState, useMemo, useEffect } from 'react'
import NutrientSlider from './NutrientSlider'
import { getLocalDateStr } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'

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
  carbsTrainingDay?: number | null
  carbsRestDay?: number | null
  onMutate: () => void
}

export default function NutritionLog({ todayNutrition, nutritionLogs, clientId, date, proteinTarget, waterTarget, competitionEnabled, carbsTarget, fatTarget, caloriesTarget, carbsCyclingEnabled, isTrainingDay, carbsTrainingDay, carbsRestDay, onMutate }: NutritionLogProps) {
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  // 碳循環：用戶可手動切換訓練日/休息日
  const [manualDayType, setManualDayType] = useState<'training' | 'rest' | null>(null)
  const effectiveIsTraining = manualDayType != null ? manualDayType === 'training' : !!isTrainingDay
  const effectiveCarbsTarget = carbsCyclingEnabled && carbsTrainingDay && carbsRestDay
    ? (effectiveIsTraining ? carbsTrainingDay : carbsRestDay)
    : carbsTarget
  const [note, setNote] = useState(todayNutrition?.note || '')
  const [showNote, setShowNote] = useState(false)
  const [proteinInput, setProteinInput] = useState<string>(todayNutrition?.protein_grams?.toString() || '')
  const [waterInput, setWaterInput] = useState<string>(todayNutrition?.water_ml?.toString() || '')
  const [carbsInput, setCarbsInput] = useState<string>(todayNutrition?.carbs_grams?.toString() || '')
  const [fatInput, setFatInput] = useState<string>(todayNutrition?.fat_grams?.toString() || '')
  // 合規性也作為本地 state，一次提交
  const [compliant, setCompliant] = useState<boolean | null>(todayNutrition?.compliant ?? null)

  const today = date || getLocalDateStr()

  // 當 todayNutrition 變動時同步表單狀態（切換日期）
  useEffect(() => {
    setNote(todayNutrition?.note || '')
    setShowNote(false)
    setProteinInput(todayNutrition?.protein_grams?.toString() || '')
    setWaterInput(todayNutrition?.water_ml?.toString() || '')
    setCarbsInput(todayNutrition?.carbs_grams?.toString() || '')
    setFatInput(todayNutrition?.fat_grams?.toString() || '')
    setCompliant(todayNutrition?.compliant ?? null)
  }, [todayNutrition])

  // 自動計算熱量：蛋白質×4 + 碳水×4 + 脂肪×9
  const computedCalories = useMemo(() => {
    const p = proteinInput ? Number(proteinInput) : 0
    const c = carbsInput ? Number(carbsInput) : 0
    const f = fatInput ? Number(fatInput) : 0
    if (!p && !c && !f) return null
    return Math.round(p * 4 + c * 4 + f * 9)
  }, [proteinInput, carbsInput, fatInput])

  // 統一提交：一次送出所有數據
  const handleSaveAll = async () => {
    if (compliant === null) {
      showToast('請先選擇今天有沒有照計畫吃', 'error')
      return
    }
    // 存手動回報值（教練看行為意圖）
    const finalCompliant = compliant
    setSaving(true)
    try {
      const res = await fetch('/api/nutrition-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today, compliant: finalCompliant, note: note || null,
          protein_grams: proteinInput ? Number(proteinInput) : null,
          water_ml: waterInput ? Number(waterInput) : null,
          carbs_grams: carbsInput ? Number(carbsInput) : null,
          fat_grams: fatInput ? Number(fatInput) : null,
          calories: computedCalories,
        })
      })
      if (!res.ok) throw new Error('記錄失敗')
      onMutate()
      showToast('飲食已記錄！', 'success', '🎉')
    } catch {
      showToast('記錄失敗，請重試', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 本週 7 天一覽（根據 selectedDate 所在週）
  const weekDays = useMemo(() => {
    const now = new Date(today + 'T12:00:00')
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)

    const days: { date: string; label: string; log: any; isToday: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = getLocalDateStr(d)
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
    const compliantCount = weekLogs.filter(d => d.log?.compliant).length
    const total = weekLogs.length
    return { compliant: compliantCount, total, rate: total > 0 ? Math.round((compliantCount / total) * 100) : 0 }
  }, [weekDays])

  // 近 30 天合規趨勢
  const monthStats = useMemo(() => {
    if (!nutritionLogs.length) return { compliant: 0, total: 0, rate: 0 }
    const compliantCount = nutritionLogs.filter((l: any) => l.compliant).length
    return { compliant: compliantCount, total: nutritionLogs.length, rate: Math.round((compliantCount / nutritionLogs.length) * 100) }
  }, [nutritionLogs])

  // 近 7 天蛋白質/水量趨勢
  const nutrientTrend = useMemo(() => {
    if (!proteinTarget && !waterTarget) return null
    const days: { label: string; protein: number | null; water: number | null }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = getLocalDateStr(d)
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
  const hasTargets = proteinTarget || waterTarget || effectiveCarbsTarget || fatTarget

  // 自動合規判斷：基於實際巨量營養素 vs 目標
  const autoComplianceStatus = useMemo(() => {
    if (!computedCalories || !caloriesTarget) return null
    const calPct = computedCalories / caloriesTarget
    const pGrams = proteinInput ? Number(proteinInput) : 0
    const proteinPct = proteinTarget ? pGrams / proteinTarget : 1
    const cGrams = carbsInput ? Number(carbsInput) : 0
    const carbsPct = effectiveCarbsTarget ? cGrams / effectiveCarbsTarget : 1
    const fGrams = fatInput ? Number(fatInput) : 0
    const fatPct = fatTarget ? fGrams / fatTarget : 1

    // 合規 = 熱量 ±10% 且蛋白質 ≥ 80%
    const calOk = calPct >= 0.9 && calPct <= 1.1
    const proteinOk = proteinPct >= 0.8
    // 某巨量營養素偏差 >20%
    const macroIssues: string[] = []
    if (proteinTarget && proteinPct < 0.8) macroIssues.push('蛋白質不足')
    if (proteinTarget && proteinPct > 1.2) macroIssues.push('蛋白質偏高')
    if (effectiveCarbsTarget && carbsPct > 1.2) macroIssues.push('碳水偏高')
    if (effectiveCarbsTarget && carbsPct < 0.8) macroIssues.push('碳水不足')
    if (fatTarget && fatPct > 1.2) macroIssues.push('脂肪偏高')
    if (fatTarget && fatPct < 0.8) macroIssues.push('脂肪不足')

    if (calOk && proteinOk && macroIssues.length === 0) {
      return { status: 'compliant' as const, label: '已合規', hint: '營養素接近目標 👍', color: 'green' }
    }
    if (calOk && macroIssues.length > 0) {
      return { status: 'partial' as const, label: '部分達標', hint: macroIssues.join('、'), color: 'amber' }
    }
    if (calPct < 0.8 || proteinPct < 0.6) {
      return { status: 'miss' as const, label: '未達標', hint: calPct < 0.8 ? `熱量偏低 ${Math.round(calPct * 100)}%` : '蛋白質嚴重不足', color: 'red' }
    }
    if (calPct > 1.1) {
      return { status: 'miss' as const, label: '未達標', hint: `熱量偏高 ${Math.round(calPct * 100)}%`, color: 'red' }
    }
    // 蛋白質不足但熱量在範圍內
    if (!proteinOk) {
      return { status: 'partial' as const, label: '部分達標', hint: '蛋白質待補', color: 'amber' }
    }
    return { status: 'compliant' as const, label: '已合規', hint: '營養素接近目標 👍', color: 'green' }
  }, [caloriesTarget, computedCalories, proteinInput, proteinTarget, carbsInput, effectiveCarbsTarget, fatInput, fatTarget])

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">🍽️ 飲食紀錄</h2>
        {hasRecorded && (
          <div className="flex items-center gap-1.5">
            {/* 手動回報：用戶主觀感受 */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              todayNutrition.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {todayNutrition.compliant ? '照計畫' : '沒照計畫'}
            </span>
            {/* 自動判斷：數據實際狀態 */}
            {autoComplianceStatus && autoComplianceStatus.status !== 'compliant' && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                autoComplianceStatus.color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`} title={autoComplianceStatus.hint}>
                {autoComplianceStatus.hint}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Step 1: 合規性選擇 */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-3">今天有照計畫吃嗎？</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCompliant(true)}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold transition-all ${
              compliant === true
                ? 'bg-green-100 border-2 border-green-400 text-green-700 scale-[1.02]'
                : 'bg-green-50 border-2 border-green-200 text-green-700 hover:bg-green-100'
            }`}
          >
            <span className="text-xl">✅</span>
            <span>照計畫吃</span>
          </button>
          <button
            onClick={() => setCompliant(false)}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold transition-all ${
              compliant === false
                ? 'bg-red-100 border-2 border-red-400 text-red-700 scale-[1.02]'
                : 'bg-red-50 border-2 border-red-200 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="text-xl">❌</span>
            <span>沒照計畫</span>
          </button>
        </div>
      </div>

      {/* Step 2: 營養素數據（選了合規性後展開） */}
      {compliant !== null && hasTargets && (
        <div className="space-y-4 mb-4">
          {/* 巨量營養素進度快照 */}
          {(caloriesTarget || effectiveCarbsTarget || fatTarget) && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-amber-700">{competitionEnabled ? '🏆 備賽巨量營養素' : '🍽️ 今日巨量營養素'}</p>
                {carbsCyclingEnabled && (
                  <button
                    onClick={() => setManualDayType(effectiveIsTraining ? 'rest' : 'training')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${effectiveIsTraining ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    🔄 {effectiveIsTraining ? '訓練日' : '休息日'} ▾
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                {effectiveCarbsTarget && (
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-1">🍚 碳水</p>
                    <p className={`text-lg font-bold ${carbsInput && Number(carbsInput) >= effectiveCarbsTarget * 0.9 && Number(carbsInput) <= effectiveCarbsTarget * 1.1 ? 'text-green-600' : Number(carbsInput) ? 'text-amber-600' : 'text-gray-300'}`}>
                      {carbsInput ? `${Number(carbsInput)}g` : '--'}
                    </p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${carbsInput && Number(carbsInput) >= effectiveCarbsTarget * 0.9 ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(100, carbsInput ? (Number(carbsInput) / effectiveCarbsTarget) * 100 : 0)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">/ {effectiveCarbsTarget}g</p>
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
          {(effectiveCarbsTarget || fatTarget) && (
            <div className="border-t border-gray-100 pt-3 mt-1 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-600">{competitionEnabled ? '🏆 備賽巨量營養素' : '🍽️ 巨量營養素'}</p>
                {carbsCyclingEnabled && carbsTrainingDay && carbsRestDay && (
                  <button
                    onClick={() => setManualDayType(effectiveIsTraining ? 'rest' : 'training')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${effectiveIsTraining ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 text-gray-600'}`}
                  >
                    🔄 {effectiveIsTraining ? '訓練日' : '休息日'} ▾
                  </button>
                )}
              </div>
              <NutrientSlider
                label="碳水" emoji="🍚"
                value={carbsInput} onChange={setCarbsInput}
                target={effectiveCarbsTarget} unit="g"
                max={Math.max(500, (effectiveCarbsTarget || 250) * 1.5)} step={5}
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

          {/* 自動合規提示 */}
          {autoComplianceStatus && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
              autoComplianceStatus.color === 'green' ? 'bg-green-50 text-green-700' :
              autoComplianceStatus.color === 'amber' ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-700'
            }`}>
              <span>{autoComplianceStatus.color === 'green' ? '✅' : autoComplianceStatus.color === 'amber' ? '⚠️' : '❌'}</span>
              <span>{autoComplianceStatus.hint}</span>
            </div>
          )}
        </div>
      )}

      {/* 備註 */}
      {compliant !== null && (
        <div className="mb-4">
          {!showNote && !note ? (
            <button onClick={() => setShowNote(true)} className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
              + 新增備註 <span className="text-gray-400 text-xs">（選填）</span>
            </button>
          ) : (
            <div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="今天吃了什麼？有什麼特別情況？"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* 巨量營養素填寫鼓勵 */}
      {compliant !== null && hasTargets && !computedCalories && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-3 flex items-start gap-2">
          <span className="text-sm mt-0.5">📝</span>
          <div>
            <p className="text-xs text-indigo-700 font-medium">填入今天的營養素數據，系統能更準確追蹤你的進度</p>
            <p className="text-[10px] text-indigo-500 mt-0.5">只需輸入蛋白質和碳水，熱量會自動計算</p>
          </div>
        </div>
      )}

      {/* 連續多天沒填巨量營養素的提醒 */}
      {compliant !== null && hasTargets && (() => {
        // nutritionLogs 按日期降序排列（最新在前），取最近 5 筆
        const recentWithoutMacros = nutritionLogs
          .slice(0, 5)
          .filter((l: any) => l.compliant != null && l.calories == null)
        return recentWithoutMacros.length >= 3 && !computedCalories ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3 flex items-start gap-2">
            <span className="text-sm mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              你已連續 {recentWithoutMacros.length} 天沒有填寫營養素數據。填入實際攝取量可以幫助系統判斷是否需要調整你的目標。
            </p>
          </div>
        ) : null
      })()}

      {/* 統一儲存按鈕 */}
      {compliant !== null && (
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 mb-4"
        >
          {saving ? '儲存中...' : hasRecorded ? '更新飲食紀錄' : '💾 儲存飲食紀錄'}
        </button>
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
