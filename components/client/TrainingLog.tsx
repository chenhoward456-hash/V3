'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TRAINING_TYPES, isWeightTraining } from './types'
import { getLocalDateStr } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'

interface ModeReason {
  signal: string
  emoji: string
  description: string
}

interface GeneticCorrection {
  gene: string
  variant: string
  effect: string
  emoji: string
}

interface ModeRecommendation {
  recommendedMode: string
  modeLabel: string
  modeEmoji: string
  modeColor: string
  volumeAdjustment: number
  targetRpeRange: [number, number]
  suggestedSets: string
  suggestions: string[]
  focusAreas: string[]
  reasons: ModeReason[]
  geneticTrainingCorrections: GeneticCorrection[]
  confidence: 'high' | 'medium' | 'low'
  sameSplitWarning?: string | null
}

interface TrainingReadiness {
  recommendedIntensity: 'high' | 'moderate' | 'low' | 'rest'
  recoveryScore: number
  reasons: string[]
  suggestion: string
  modeRecommendation?: ModeRecommendation
}

// 靜態 Tailwind class map（避免動態 class 被 purge）
const MODE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; tagBg: string }> = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', tagBg: 'bg-purple-100' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    tagBg: 'bg-red-100' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   tagBg: 'bg-blue-100' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  tagBg: 'bg-amber-100' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   tagBg: 'bg-teal-100' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  tagBg: 'bg-green-100' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200',   tagBg: 'bg-cyan-100' },
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200',   tagBg: 'bg-gray-100' },
}

interface TrainingLogProps {
  todayTraining: any
  trainingLogs: any[]
  wellness: any[]
  clientId: string
  date?: string
  onMutate: () => void
  carbsTrainingDay?: number | null
  carbsRestDay?: number | null
  simpleMode?: boolean
}

export default function TrainingLog({ todayTraining, trainingLogs, wellness, clientId, date, onMutate, carbsTrainingDay, carbsRestDay, simpleMode }: TrainingLogProps) {
  const today = date || getLocalDateStr()
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()
  const [readiness, setReadiness] = useState<TrainingReadiness | null>(null)
  const [showTrainingAdvanced, setShowTrainingAdvanced] = useState(false)

  // 載入今日訓練準備度
  useEffect(() => {
    const controller = new AbortController()
    async function fetchReadiness() {
      try {
        const res = await fetch(`/api/training-readiness?clientId=${clientId}`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setReadiness(data)
        }
      } catch {
        // 靜默失敗（含 AbortError）
      }
    }
    fetchReadiness()
    return () => controller.abort()
  }, [clientId])

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
    } else {
      setForm({ training_type: null, duration: null, sets: null, rpe: null, note: '' })
    }
  }, [todayTraining])

  const isRest = form.training_type === 'rest'
  const isCardio = form.training_type === 'cardio'
  const hasCarbCycling = !!(carbsTrainingDay && carbsRestDay)

  // ===== 上次同類型訓練 =====
  const lastSameType = useMemo(() => {
    if (!form.training_type || form.training_type === 'rest') return null
    const sorted = (trainingLogs || [])
      .filter((l: any) => l.training_type === form.training_type && l.date !== today)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
    if (!sorted.length) return null
    const last = sorted[0]
    const [yr, mo, dy] = last.date.split('-').map(Number)
    const daysAgo = Math.floor((Date.now() - new Date(yr, mo - 1, dy).getTime()) / (1000 * 60 * 60 * 24))
    return { ...last, daysAgo }
  }, [form.training_type, trainingLogs, today])

  const handleSubmit = async () => {
    if (!form.training_type) {
      showToast('請選擇訓練類型', 'error')
      return
    }
    if (!simpleMode && !isRest && (!form.duration || form.duration <= 0)) {
      showToast('請填寫訓練時長', 'error')
      return
    }
    if (!simpleMode && !isRest && !isCardio && !form.rpe) {
      showToast('請選擇 RPE', 'error')
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
          rpe: isRest ? null : (form.rpe || null),
          note: form.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      const result = await response.json()
      onMutate()
      showToast('訓練已記錄！', 'success', '🎉')
      // 顯示恢復警告（如果有）
      if (result.recoveryWarning) {
        setTimeout(() => showToast(result.recoveryWarning, 'error'), 500)
      }
    } catch {
      showToast('提交失敗，請重試', 'error')
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
    const mondayStr = getLocalDateStr(monday)

    const weekLogs = (trainingLogs || []).filter((l: any) => l.date >= mondayStr && l.date <= today)

    const days: { date: string; label: string; log: any }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = getLocalDateStr(d)
      const dayLabels = ['一', '二', '三', '四', '五', '六', '日']
      days.push({
        date: dateStr,
        label: dayLabels[i],
        log: weekLogs.find((l: any) => l.date === dateStr) || null
      })
    }

    const activeLogs = weekLogs.filter((l: any) => l.training_type !== 'rest')
    const weightLogs = weekLogs.filter((l: any) => isWeightTraining(l.training_type))
    const cardioLogs = weekLogs.filter((l: any) => l.training_type === 'cardio')
    const trainingDays = activeLogs.length
    const weightDays = weightLogs.length
    const cardioDays = cardioLogs.length
    const totalDuration = activeLogs.reduce((sum: number, l: any) => sum + (l.duration || 0), 0)
    const totalSets = weightLogs.reduce((sum: number, l: any) => sum + (l.sets || 0), 0)
    const weightLogsWithRpe = weightLogs.filter((l: any) => l.rpe != null)
    const avgRpe = weightLogsWithRpe.length > 0
      ? (weightLogsWithRpe.reduce((sum: number, l: any) => sum + l.rpe, 0) / weightLogsWithRpe.length).toFixed(1)
      : '--'

    return { days, trainingDays, weightDays, cardioDays, totalDuration, totalSets, avgRpe }
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
        const dateStr = getLocalDateStr(date)
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
      return getLocalDateStr(d)
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
      <h2 className="text-xl font-semibold text-gray-900 mb-4">訓練紀錄</h2>
      <div className="space-y-4">
        {/* 今日訓練準備度（簡單模式隱藏） */}
        {!simpleMode && readiness && readiness.recoveryScore != null && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            readiness.recommendedIntensity === 'high'
              ? 'bg-green-50 text-green-700'
              : readiness.recommendedIntensity === 'moderate'
                ? 'bg-blue-50 text-blue-700'
                : readiness.recommendedIntensity === 'low'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">
                {readiness.recommendedIntensity === 'high' ? '🟢 狀態良好' :
                 readiness.recommendedIntensity === 'moderate' ? '🔵 狀態一般' :
                 readiness.recommendedIntensity === 'low' ? '🟡 恢復偏差' :
                 '🔴 建議休息'}
              </span>
              <span className="text-xs opacity-70">
                恢復分數 {readiness.recoveryScore}/100
              </span>
            </div>
            <p className="text-xs opacity-80">{readiness.suggestion}</p>
            {readiness.reasons.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {readiness.reasons.map((r, i) => (
                  <span key={i} className="text-[10px] bg-white/50 rounded px-1.5 py-0.5">{r}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 訓練模式建議（簡單模式隱藏） ===== */}
        {!simpleMode && readiness?.modeRecommendation && (() => {
          const mode = readiness.modeRecommendation
          const colors = MODE_COLOR_MAP[mode.modeColor] || MODE_COLOR_MAP.blue
          const totalReasons = mode.reasons.length + mode.geneticTrainingCorrections.length
          return (
            <div className={`rounded-xl border px-4 py-3 text-sm ${colors.bg} ${colors.text} ${colors.border}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {mode.modeEmoji} 建議模式：{mode.modeLabel}
                </span>
                <span className="text-xs opacity-70">
                  {mode.confidence === 'high' ? '信心高' : mode.confidence === 'medium' ? '信心中' : '信心低'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-80 mb-2">
                <span>目標 RPE {mode.targetRpeRange[0]}-{mode.targetRpeRange[1]}</span>
                <span>建議 {mode.suggestedSets}</span>
                {mode.volumeAdjustment !== 0 && (
                  <span>容量 {mode.volumeAdjustment > 0 ? '+' : ''}{mode.volumeAdjustment}%</span>
                )}
              </div>
              <ul className="space-y-1 mb-2">
                {mode.suggestions.map((s, i) => (
                  <li key={i} className="text-xs opacity-80">- {s}</li>
                ))}
              </ul>
              {mode.sameSplitWarning && (
                <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  ⚠️ {mode.sameSplitWarning}
                </div>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {mode.focusAreas.map((area, i) => (
                  <span key={i} className={`text-[10px] ${colors.tagBg} rounded px-1.5 py-0.5`}>{area}</span>
                ))}
              </div>
              {totalReasons > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                    查看分析依據（{totalReasons} 項信號）
                  </summary>
                  <div className="mt-2 space-y-1">
                    {mode.reasons.map((r, i) => (
                      <div key={i} className="opacity-80">
                        {r.emoji} {r.description}
                      </div>
                    ))}
                    {mode.geneticTrainingCorrections.map((g, i) => (
                      <div key={`g-${i}`} className="text-purple-700">
                        {g.emoji} {g.gene} {g.variant}：{g.effect}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })()}

        {/* 訓練類型 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">重訓</p>
          <div className="grid grid-cols-4 gap-2">
            {TRAINING_TYPES.filter(t => isWeightTraining(t.value)).map(({ value, label, emoji }) => (
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
          <div className="grid grid-cols-2 gap-2 mt-2">
            {TRAINING_TYPES.filter(t => !isWeightTraining(t.value)).map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setForm(prev => ({ ...prev, training_type: value }))}
                className={`min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                  form.training_type === value
                    ? value === 'rest' ? 'bg-gray-600 text-white' : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* 碳循環提示（簡單模式隱藏） */}
        {!simpleMode && hasCarbCycling && form.training_type && (
          <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            isWeightTraining(form.training_type)
              ? 'bg-cyan-50 text-cyan-700'
              : 'bg-gray-50 text-gray-600'
          }`}>
            🔄 今日碳水：{isWeightTraining(form.training_type) ? `${carbsTrainingDay}g（訓練日）` : `${carbsRestDay}g（休息日）`}
          </div>
        )}

        {/* 上次同類型提示（簡單模式隱藏） */}
        {!simpleMode && lastSameType && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            上次{getTypeLabel(lastSameType.training_type)}：{lastSameType.daysAgo} 天前
            {lastSameType.duration && `，${lastSameType.duration} 分鐘`}
            {lastSameType.sets && `，${lastSameType.sets} 組`}
            {lastSameType.rpe && `，RPE ${lastSameType.rpe}`}
          </div>
        )}

        {/* 時長/組數/RPE/備註（簡單模式下收合） */}
        {(!simpleMode || showTrainingAdvanced) && !isRest && (
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

        {(!simpleMode || showTrainingAdvanced) && !isRest && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">💥 RPE（自覺強度 1-10）{isCardio && <span className="text-gray-400 font-normal">（選填）</span>}</p>
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

        {(!simpleMode || showTrainingAdvanced) && (
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
        )}

        {/* 簡單模式：展開進階按鈕 */}
        {simpleMode && !showTrainingAdvanced && !isRest && (
          <button
            onClick={() => setShowTrainingAdvanced(true)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            展開時長/組數/RPE ▾
          </button>
        )}

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
          {!simpleMode && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span>🏋️ {weeklySummary.weightDays} 天</span>
              {weeklySummary.cardioDays > 0 && <span>🏃 {weeklySummary.cardioDays} 天</span>}
              <span>⏱️ {weeklySummary.totalDuration} 分鐘</span>
              {weeklySummary.totalSets > 0 && <span>📊 {weeklySummary.totalSets} 組</span>}
              <span>💥 RPE {weeklySummary.avgRpe}</span>
            </div>
          )}
        </div>

        {/* ===== 訓練歷史日曆（5 週）（簡單模式隱藏） ===== */}
        {!simpleMode && <div className="pt-4 border-t border-gray-100">
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
        </div>}

        {/* ===== RPE 趨勢圖（簡單模式隱藏） ===== */}
        {!simpleMode && rpeChartData.length >= 2 && (
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

        {/* ===== 訓練洞察頂部摘要（不需展開即可看到） ===== */}
        {!simpleMode && insights && insights.bestRecovery && insights.bestRecovery.avgNextEnergy != null && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 mb-2">Sleep x Training Insight</p>
            <p className="text-sm text-emerald-800">
              {insights.bestRecovery.emoji} {insights.bestRecovery.label}日後恢復最好（隔天精力 {insights.bestRecovery.avgNextEnergy.toFixed(1)}/5）
            </p>
            {/* Mini bar chart: 各訓練類型的隔天精力 */}
            {insights.typeAnalysis.filter(t => t.avgNextEnergy != null).length >= 2 && (
              <div className="mt-2 space-y-1">
                {insights.typeAnalysis
                  .filter(t => t.avgNextEnergy != null)
                  .map(t => (
                    <div key={t.type} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-12 text-right truncate">{t.label}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${(t.avgNextEnergy ?? 0) >= 4 ? 'bg-green-400' : (t.avgNextEnergy ?? 0) >= 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${((t.avgNextEnergy ?? 0) / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-600 w-6">{t.avgNextEnergy?.toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 訓練洞察（簡單模式隱藏） ===== */}
        {!simpleMode && insights && insights.typeAnalysis.length > 0 && (
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
