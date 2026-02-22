'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TRAINING_TYPES } from './types'

interface TrainingLogProps {
  todayTraining: any
  trainingLogs: any[]
  wellness: any[]
  clientId: string
  date?: string
  onMutate: () => void
}

export default function TrainingLog({ todayTraining, trainingLogs, wellness, clientId, date, onMutate }: TrainingLogProps) {
  const today = date || new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState({
    training_type: todayTraining?.training_type ?? null as string | null,
    duration: todayTraining?.duration ?? null as number | null,
    sets: todayTraining?.sets ?? null as number | null,
    rpe: todayTraining?.rpe ?? null as number | null,
    note: todayTraining?.note || ''
  })

  useEffect(() => {
    if (todayTraining) {
      setForm({
        training_type: todayTraining.training_type ?? null,
        duration: todayTraining.duration ?? null,
        sets: todayTraining.sets ?? null,
        rpe: todayTraining.rpe ?? null,
        note: todayTraining.note || '',
      })
    }
  }, [todayTraining])

  const isRest = form.training_type === 'rest'

  // ===== 上次同類型訓練 =====
  const lastSameType = useMemo(() => {
    if (!form.training_type || form.training_type === 'rest') return null
    const sorted = (trainingLogs || [])
      .filter((l: any) => l.training_type === form.training_type && l.date !== today)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
    if (!sorted.length) return null
    const last = sorted[0]
    const daysAgo = Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24))
    return { ...last, daysAgo }
  }, [form.training_type, trainingLogs, today])

  const handleSubmit = async () => {
    if (!form.training_type) {
      alert('請選擇訓練類型')
      return
    }
    if (!isRest && (!form.duration || form.duration <= 0)) {
      alert('請填寫訓練時長')
      return
    }
    if (!isRest && !form.rpe) {
      alert('請選擇 RPE')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/training-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today,
          training_type: form.training_type,
          duration: isRest ? null : form.duration,
          sets: isRest ? null : form.sets,
          rpe: isRest ? null : form.rpe,
          note: form.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      onMutate()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch {
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== 本週摘要 =====
  const weeklySummary = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)
    const mondayStr = monday.toISOString().split('T')[0]

    const weekLogs = (trainingLogs || []).filter((l: any) => l.date >= mondayStr && l.date <= today)

    const days: { date: string; label: string; log: any }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayLabels = ['一', '二', '三', '四', '五', '六', '日']
      days.push({
        date: dateStr,
        label: dayLabels[i],
        log: weekLogs.find((l: any) => l.date === dateStr) || null
      })
    }

    const activeLogs = weekLogs.filter((l: any) => l.training_type !== 'rest')
    const trainingDays = activeLogs.length
    const totalDuration = activeLogs.reduce((sum: number, l: any) => sum + (l.duration || 0), 0)
    const totalSets = activeLogs.reduce((sum: number, l: any) => sum + (l.sets || 0), 0)
    const avgRpe = activeLogs.length > 0
      ? (activeLogs.reduce((sum: number, l: any) => sum + (l.rpe || 0), 0) / activeLogs.length).toFixed(1)
      : '--'

    return { days, trainingDays, totalDuration, totalSets, avgRpe }
  }, [trainingLogs, today])

  // ===== 訓練歷史日曆（近 5 週） =====
  const calendarWeeks = useMemo(() => {
    const now = new Date()
    // 找到本週一
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - mondayOffset)

    const weeks: { date: string; label: string; log: any; isToday: boolean; isFuture: boolean }[][] = []
    for (let w = 4; w >= 0; w--) {
      const week: typeof weeks[0] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(thisMonday)
        date.setDate(thisMonday.getDate() - w * 7 + d)
        const dateStr = date.toISOString().split('T')[0]
        week.push({
          date: dateStr,
          label: date.getDate().toString(),
          log: (trainingLogs || []).find((l: any) => l.date === dateStr) || null,
          isToday: dateStr === today,
          isFuture: dateStr > today,
        })
      }
      weeks.push(week)
    }
    return weeks
  }, [trainingLogs, today])

  const getTypeEmoji = (type: string) => {
    return TRAINING_TYPES.find(t => t.value === type)?.emoji || ''
  }

  const getTypeLabel = (type: string) => {
    return TRAINING_TYPES.find(t => t.value === type)?.label || type
  }

  const getTypeBgColor = (type: string) => {
    const colors: Record<string, string> = {
      push: 'bg-red-100 text-red-700',
      pull: 'bg-blue-100 text-blue-700',
      legs: 'bg-green-100 text-green-700',
      full_body: 'bg-purple-100 text-purple-700',
      cardio: 'bg-orange-100 text-orange-700',
      chest: 'bg-pink-100 text-pink-700',
      shoulder: 'bg-indigo-100 text-indigo-700',
      arms: 'bg-yellow-100 text-yellow-700',
      rest: 'bg-gray-100 text-gray-500',
    }
    return colors[type] || 'bg-gray-100 text-gray-500'
  }

  // ===== RPE 趨勢圖 =====
  const rpeChartData = useMemo(() => {
    if (!trainingLogs?.length) return []
    return [...trainingLogs]
      .filter((l: any) => l.rpe != null && l.training_type !== 'rest')
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        RPE: l.rpe,
        type: getTypeLabel(l.training_type),
      }))
  }, [trainingLogs])

  // ===== 訓練洞察：交叉分析訓練 × 恢復 =====
  const insights = useMemo(() => {
    if (!trainingLogs?.length || !wellness?.length) return null

    const wellnessMap: Record<string, any> = {}
    for (const w of wellness) {
      wellnessMap[w.date] = w
    }

    // 取得隔天日期
    const nextDay = (dateStr: string) => {
      const d = new Date(dateStr)
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    }

    // 每種訓練類型 → 隔天恢復數據
    const typeStats: Record<string, {
      count: number
      avgRpe: number
      avgDuration: number
      totalSets: number
      nextDaySleep: number[]
      nextDayEnergy: number[]
      nextDayMood: number[]
    }> = {}

    const activeLogs = trainingLogs.filter((l: any) => l.training_type !== 'rest')

    for (const log of activeLogs) {
      const type = log.training_type
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, avgRpe: 0, avgDuration: 0, totalSets: 0, nextDaySleep: [], nextDayEnergy: [], nextDayMood: [] }
      }
      const s = typeStats[type]
      s.count++
      s.avgRpe += log.rpe || 0
      s.avgDuration += log.duration || 0
      s.totalSets += log.sets || 0

      // 隔天恢復
      const nextW = wellnessMap[nextDay(log.date)]
      if (nextW) {
        if (nextW.sleep_quality != null) s.nextDaySleep.push(nextW.sleep_quality)
        if (nextW.energy_level != null) s.nextDayEnergy.push(nextW.energy_level)
        if (nextW.mood != null) s.nextDayMood.push(nextW.mood)
      }
    }

    // 計算平均
    const typeAnalysis = Object.entries(typeStats)
      .map(([type, s]) => {
        const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null
        return {
          type,
          label: getTypeLabel(type),
          emoji: getTypeEmoji(type),
          count: s.count,
          avgRpe: s.count > 0 ? (s.avgRpe / s.count).toFixed(1) : '--',
          avgDuration: s.count > 0 ? Math.round(s.avgDuration / s.count) : 0,
          avgNextSleep: avg(s.nextDaySleep),
          avgNextEnergy: avg(s.nextDayEnergy),
          avgNextMood: avg(s.nextDayMood),
        }
      })
      .sort((a, b) => b.count - a.count)

    // 找出恢復最差的訓練類型
    const withRecovery = typeAnalysis.filter(t => t.avgNextEnergy != null)
    let worstRecovery: typeof typeAnalysis[0] | null = null
    let bestRecovery: typeof typeAnalysis[0] | null = null
    if (withRecovery.length >= 2) {
      worstRecovery = withRecovery.reduce((worst, t) =>
        (t.avgNextEnergy ?? 5) < (worst.avgNextEnergy ?? 5) ? t : worst
      )
      bestRecovery = withRecovery.reduce((best, t) =>
        (t.avgNextEnergy ?? 0) > (best.avgNextEnergy ?? 0) ? t : best
      )
    }

    // 低潮日：RPE >= 9 或隔天精力 <= 2
    const roughDays: { date: string; type: string; reason: string }[] = []
    for (const log of activeLogs) {
      const nextW = wellnessMap[nextDay(log.date)]
      if (log.rpe >= 9) {
        roughDays.push({
          date: log.date,
          type: log.training_type,
          reason: `RPE ${log.rpe}`
        })
      }
      if (nextW && nextW.energy_level != null && nextW.energy_level <= 2) {
        roughDays.push({
          date: log.date,
          type: log.training_type,
          reason: `隔天精力 ${nextW.energy_level}/5`
        })
      }
    }
    // 去重同一天
    const uniqueRoughDays = roughDays.filter((d, i, arr) =>
      arr.findIndex(x => x.date === d.date) === i
    ).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

    return { typeAnalysis, worstRecovery, bestRecovery, roughDays: uniqueRoughDays }
  }, [trainingLogs, wellness])

  const [showInsights, setShowInsights] = useState(false)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const scoreBar = (value: number | null, max: number = 5) => {
    if (value == null) return <span className="text-gray-400 text-xs">--</span>
    const pct = (value / max) * 100
    const color = value >= 4 ? 'bg-green-400' : value >= 3 ? 'bg-yellow-400' : 'bg-red-400'
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-600 w-6 text-right">{value.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-lg">🎉</span>
          <span className="text-sm font-medium">訓練已記錄！</span>
        </div>
      )}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">訓練紀錄</h2>
      <div className="space-y-4">
        {/* 訓練類型 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">訓練類型</p>
          <div className="grid grid-cols-3 gap-2">
            {TRAINING_TYPES.map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setForm(prev => ({ ...prev, training_type: value }))}
                className={`min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                  form.training_type === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* 上次同類型提示 */}
        {lastSameType && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            上次{getTypeLabel(lastSameType.training_type)}：{lastSameType.daysAgo} 天前
            {lastSameType.duration && `，${lastSameType.duration} 分鐘`}
            {lastSameType.sets && `，${lastSameType.sets} 組`}
            {lastSameType.rpe && `，RPE ${lastSameType.rpe}`}
          </div>
        )}

        {/* 時長（休息時隱藏） */}
        {!isRest && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">⏱️ 時長（分鐘）</p>
              <input
                type="number"
                inputMode="numeric"
                value={form.duration ?? ''}
                onChange={(e) => setForm(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="60"
                min={1}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">📊 組數（選填）</p>
              <input
                type="number"
                inputMode="numeric"
                value={form.sets ?? ''}
                onChange={(e) => setForm(prev => ({ ...prev, sets: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20"
                min={1}
              />
            </div>
          </div>
        )}

        {/* RPE（休息時隱藏） */}
        {!isRest && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">💥 RPE（自覺強度 1-10）</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    onClick={() => setForm(prev => ({ ...prev, rpe: score }))}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                      form.rpe === score
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {[6, 7, 8, 9, 10].map(score => (
                  <button
                    key={score}
                    onClick={() => setForm(prev => ({ ...prev, rpe: score }))}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                      form.rpe === score
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 備註 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">備註</p>
          <textarea
            value={form.note}
            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder={isRest ? '今天好好休息！' : '訓練內容、感受...'}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? '提交中...' : todayTraining ? '更新訓練' : '記錄訓練'}
        </button>

        {/* ===== 本週摘要 ===== */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">本週訓練</p>
          <div className="flex gap-1 mb-3">
            {weeklySummary.days.map(({ date, label, log }) => (
              <div
                key={date}
                className={`flex-1 text-center py-2 rounded-lg text-xs ${
                  date === today ? 'ring-2 ring-blue-400' : ''
                } ${
                  log
                    ? log.training_type === 'rest'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-blue-50 text-blue-700'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className="text-base mt-0.5">{log ? getTypeEmoji(log.training_type) : '·'}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>🏋️ {weeklySummary.trainingDays} 天</span>
            <span>⏱️ {weeklySummary.totalDuration} 分鐘</span>
            {weeklySummary.totalSets > 0 && <span>📊 {weeklySummary.totalSets} 組</span>}
            <span>💥 RPE {weeklySummary.avgRpe}</span>
          </div>
        </div>

        {/* ===== 訓練歷史日曆（5 週） ===== */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">訓練日曆</p>
          <div className="space-y-1">
            {/* 星期標題 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                <div key={d} className="text-center text-xs text-gray-400 font-medium">{d}</div>
              ))}
            </div>
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map(({ date, label, log, isToday, isFuture }) => (
                  <div
                    key={date}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${
                      isToday ? 'ring-2 ring-blue-400' : ''
                    } ${
                      isFuture
                        ? 'bg-gray-50 text-gray-300'
                        : log
                          ? getTypeBgColor(log.training_type)
                          : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    <span className="text-[10px] leading-none">{label}</span>
                    <span className="text-sm leading-none mt-0.5">
                      {!isFuture && log ? getTypeEmoji(log.training_type) : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ===== RPE 趨勢圖 ===== */}
        {rpeChartData.length >= 2 && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-3">RPE 趨勢</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rpeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} fontSize={11} />
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `RPE ${value}（${props.payload.type}）`,
                    ''
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="RPE"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== 訓練洞察 ===== */}
        {insights && insights.typeAnalysis.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-700"
            >
              <span>🔍 訓練洞察</span>
              <span className="text-gray-400 text-xs">{showInsights ? '收起' : '展開'}</span>
            </button>

            {showInsights && (
              <div className="mt-3 space-y-4">
                {/* 自動洞察文字 */}
                {(insights.worstRecovery || insights.bestRecovery) && (
                  <div className="space-y-2">
                    {insights.bestRecovery && insights.bestRecovery.avgNextEnergy != null && (
                      <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-700">
                        ✅ {insights.bestRecovery.emoji} {insights.bestRecovery.label}日後恢復最好（隔天精力 {insights.bestRecovery.avgNextEnergy.toFixed(1)}/5）
                      </div>
                    )}
                    {insights.worstRecovery && insights.worstRecovery.avgNextEnergy != null && (
                      <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700">
                        ⚠️ {insights.worstRecovery.emoji} {insights.worstRecovery.label}日後恢復最差（隔天精力 {insights.worstRecovery.avgNextEnergy.toFixed(1)}/5）
                      </div>
                    )}
                  </div>
                )}

                {/* 各類型分析表 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">各類型統計（含隔天恢復）</p>
                  <div className="space-y-2">
                    {insights.typeAnalysis.map((t) => (
                      <div key={t.type} className="bg-gray-50 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{t.emoji} {t.label}</span>
                          <span className="text-xs text-gray-500">{t.count} 次 · 均 RPE {t.avgRpe} · {t.avgDuration} 分鐘</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-gray-400">隔天睡眠</span>
                            {scoreBar(t.avgNextSleep)}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400">隔天精力</span>
                            {scoreBar(t.avgNextEnergy)}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400">隔天心情</span>
                            {scoreBar(t.avgNextMood)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 低潮日 */}
                {insights.roughDays.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">需注意的訓練日</p>
                    <div className="space-y-1">
                      {insights.roughDays.map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 text-sm">
                          <span className="text-red-700">
                            {formatDate(d.date)} {getTypeEmoji(d.type)} {getTypeLabel(d.type)}
                          </span>
                          <span className="text-red-500 text-xs">{d.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
