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
  clientMessage: string
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
  todayPlanType?: string | null
  trainingPlan?: any
  tier?: string
}

export default function TrainingLog({ todayTraining, trainingLogs, wellness, clientId, date, onMutate, carbsTrainingDay, carbsRestDay, simpleMode, todayPlanType, trainingPlan, tier }: TrainingLogProps) {
  const today = date || getLocalDateStr()
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()
  const [readiness, setReadiness] = useState<TrainingReadiness | null>(null)
  const [showTrainingAdvanced, setShowTrainingAdvanced] = useState(false)
  const [showRestForm, setShowRestForm] = useState(false)

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
    training_type: todayTraining?.training_type ?? todayPlanType ?? null as string | null,
    duration: todayTraining?.duration ?? null as number | null,
    sets: todayTraining?.sets ?? null as number | null,
    rpe: todayTraining?.rpe ?? null as number | null,
    compound_weight: todayTraining?.compound_weight ?? null as number | null,
    compound_reps: todayTraining?.compound_reps ?? null as number | null,
    note: todayTraining?.note || ''
  })

  // ===== 動作明細 =====
  interface ExerciseSet {
    exercise_name: string
    muscle_group: string
    set_number: number
    num_sets: number  // 該重量做幾組
    weight: number | null
    reps: number | null
    rpe: number | null
    is_main_lift: boolean
  }
  const [detailedSets, setDetailedSets] = useState<ExerciseSet[]>([])
  const [showDetailedSets, setShowDetailedSets] = useState(false)
  const [lastTypeSets, setLastTypeSets] = useState<ExerciseSet[]>([])
  const [detailedLoaded, setDetailedLoaded] = useState(false)

  // 載入今日已存的動作明細 + 上次同類型
  useEffect(() => {
    if (!showDetailedSets || detailedLoaded || !form.training_type) return
    setDetailedLoaded(true)
    const loadSets = async () => {
      try {
        const params = new URLSearchParams({ clientId, date: today })
        if (form.training_type) params.set('trainingType', form.training_type)
        const res = await fetch(`/api/training-sets?${params}`)
        if (!res.ok) return
        const data = await res.json()
        // 從 DB 的多筆 rows 合併成每個動作一行 + num_sets
        const groupSets = (rows: any[]) => {
          const grouped: Record<string, ExerciseSet> = {}
          for (const s of rows) {
            const key = s.exercise_name
            if (!grouped[key]) {
              grouped[key] = {
                exercise_name: s.exercise_name,
                muscle_group: s.muscle_group || '',
                set_number: s.set_number,
                num_sets: 1,
                weight: s.weight,
                reps: s.reps,
                rpe: s.rpe,
                is_main_lift: s.is_main_lift || false,
              }
            } else {
              grouped[key].num_sets++
            }
          }
          return Object.values(grouped)
        }
        const todaySets = groupSets(data.data?.sets || [])
        const prevSets = groupSets(data.data?.lastSameType?.sets || [])
        if (todaySets.length > 0) {
          setDetailedSets(todaySets)
        } else if (prevSets.length > 0) {
          setDetailedSets(prevSets.map(s => ({ ...s, rpe: null })))
        } else if (trainingPlan?.days?.length > 0) {
          // Fallback: 從課表帶入今天的動作
          const now = new Date()
          const taipeiStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
          const taipeiDate = new Date(taipeiStr + 'T12:00:00')
          const jsDay = taipeiDate.getDay()
          const dow = jsDay === 0 ? 7 : jsDay
          const todayPlan = trainingPlan.days.find((d: any) => d.dayOfWeek === dow)
          if (todayPlan?.exercises?.length > 0) {
            setDetailedSets(todayPlan.exercises.map((ex: any, i: number) => {
              const setsMatch = ex.sets?.match(/(\d+)/)
              const repsMatch = ex.reps?.match(/(\d+)/)
              return {
                exercise_name: ex.name,
                muscle_group: '',
                set_number: i + 1,
                num_sets: setsMatch ? parseInt(setsMatch[1]) : 3,
                weight: null,  // 重量留空讓客戶填
                reps: repsMatch ? parseInt(repsMatch[1]) : null,
                rpe: null,
                is_main_lift: i === 0,
              }
            }))
          }
        }
        setLastTypeSets(prevSets.map(s => ({ ...s, rpe: null })))
      } catch { /* silent */ }
    }
    loadSets()
  }, [showDetailedSets, detailedLoaded, form.training_type, clientId, today])

  // 重置 detailedLoaded when training type changes
  useEffect(() => { setDetailedLoaded(false); setDetailedSets([]); setLastTypeSets([]) }, [form.training_type])

  const addExercise = (name: string = '', muscleGroup: string = '') => {
    const nextSet = detailedSets.length > 0 ? Math.max(...detailedSets.map(s => s.set_number)) + 1 : 1
    setDetailedSets(prev => [...prev, { exercise_name: name, muscle_group: muscleGroup, set_number: nextSet, num_sets: 3, weight: null, reps: null, rpe: null, is_main_lift: false }])
  }

  const updateSet = (index: number, field: keyof ExerciseSet, value: any) => {
    setDetailedSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const removeSet = (index: number) => {
    setDetailedSets(prev => prev.filter((_, i) => i !== index))
  }

  const duplicateSet = (index: number) => {
    const src = detailedSets[index]
    setDetailedSets(prev => [...prev.slice(0, index + 1), { ...src, set_number: src.set_number + 1, num_sets: 4 }, ...prev.slice(index + 1)])
  }

  useEffect(() => {
    if (todayTraining) {
      const rawNote = todayTraining.note || ''
      const cardioMatch = rawNote.match(/^\[有氧:(.*?)\]\s*/)
      setCardioSubtype(cardioMatch ? cardioMatch[1] : null)
      setForm({
        training_type: todayTraining.training_type ?? null,
        duration: todayTraining.duration ?? null,
        sets: todayTraining.sets ?? null,
        rpe: todayTraining.rpe ?? null,
        compound_weight: todayTraining.compound_weight ?? null,
        compound_reps: todayTraining.compound_reps ?? null,
        note: cardioMatch ? rawNote.replace(cardioMatch[0], '') : rawNote,
      })
    } else {
      setCardioSubtype(null)
      setForm({ training_type: todayPlanType ?? null, duration: null, sets: null, rpe: null, compound_weight: null, compound_reps: null, note: '' })
    }
  }, [todayTraining, todayPlanType])

  const isRest = form.training_type === 'rest'
  const isCardio = form.training_type === 'cardio'
  const hasCarbCycling = !!(carbsTrainingDay && carbsRestDay)

  // 有氧子類型
  const CARDIO_SUBTYPES = [
    { value: '登階機', emoji: '🪜' },
    { value: '走路', emoji: '🚶' },
    { value: '跑步', emoji: '🏃' },
    { value: '單車', emoji: '🚴' },
    { value: '其他', emoji: '⚡' },
  ]
  const [cardioSubtype, setCardioSubtype] = useState<string | null>(() => {
    // 從 note 裡解析已存的有氧類型
    const note = todayTraining?.note || ''
    const match = note.match(/^\[有氧:(.*?)\]/)
    return match ? match[1] : null
  })

  // 主項名稱對應（根據訓練類型）
  const COMPOUND_LIFT: Record<string, string> = {
    push: '臥推', pull: '槓鈴划船', legs: '深蹲',
    chest: '臥推', shoulder: '肩推', arms: '彎舉',
    full_body: '深蹲', upper_body: '臥推',
  }
  const compoundLiftName = form.training_type ? COMPOUND_LIFT[form.training_type] : null

  // 主項歷史紀錄（最近 5 次同類型，有填 compound_weight 的）
  const compoundHistory = useMemo(() => {
    if (!form.training_type || !compoundLiftName) return []
    return (trainingLogs || [])
      .filter((l: any) => l.training_type === form.training_type && l.compound_weight != null && l.date !== today)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [form.training_type, trainingLogs, today, compoundLiftName])

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
      // 從動作明細自動計算 sets（如果 form.sets 沒填）
      const filledSets = detailedSets.filter(s => s.exercise_name.trim())
      const autoSets = form.sets ?? (filledSets.length > 0
        ? filledSets.reduce((sum, s) => sum + Math.max(1, s.num_sets || 1), 0)
        : null)

      const response = await fetch('/api/training-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today,
          training_type: form.training_type,
          duration: isRest ? null : form.duration,
          sets: isRest ? null : autoSets,
          rpe: isRest ? null : (form.rpe || null),
          compound_weight: isRest || isCardio ? null : (form.compound_weight || null),
          compound_reps: isRest || isCardio ? null : (form.compound_reps || null),
          note: (isCardio && cardioSubtype ? `[有氧:${cardioSubtype}] ` : '') + (form.note || '') || null
        })
      })
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || '提交失敗')
      }
      const result = await response.json()

      // 儲存動作明細（如果有填）
      if (filledSets.length > 0) {
        const setsRes = await fetch('/api/training-sets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId, date: today,
            sets: filledSets.flatMap((s) => {
              const count = Math.max(1, s.num_sets || 1)
              return Array.from({ length: count }, (_, j) => ({
                exercise_name: s.exercise_name.trim(),
                muscle_group: s.muscle_group || null,
                set_number: j + 1,
                weight: s.weight,
                reps: s.reps,
                rpe: s.rpe,
                is_main_lift: s.is_main_lift,
              }))
            }),
          }),
        })
        if (!setsRes.ok) {
          const setsErr = await setsRes.json().catch(() => ({}))
          console.warn('training-sets save failed:', setsErr.error)
        }
      }

      onMutate()

      // ── 提交後回饋：進步提示 ──
      const tonnage = filledSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0) * (s.num_sets || 1), 0)
      const weekActiveDays = (trainingLogs || []).filter((l: any) => {
        const targetDate = new Date(today + 'T12:00:00')
        const dow = targetDate.getDay()
        const mondayOffset = dow === 0 ? 6 : dow - 1
        const monday = new Date(targetDate)
        monday.setDate(targetDate.getDate() - mondayOffset)
        const mondayStr = getLocalDateStr(monday)
        return l.date >= mondayStr && l.date <= today && l.training_type !== 'rest'
      }).length + (isRest ? 0 : 1) // +1 for today's submission

      // 跟上次同類型比較訓練量
      let progressMsg = ''
      if (tonnage > 0 && lastSameType) {
        // 取上次同類型的動作明細計算 tonnage
        const prevTonnage = lastTypeSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0) * (s.num_sets || 1), 0)
        if (prevTonnage > 0) {
          const diff = tonnage - prevTonnage
          const pct = Math.round((diff / prevTonnage) * 100)
          if (diff > 0) {
            progressMsg = ` 📈 比上次多 ${Math.round(diff).toLocaleString()}kg（+${pct}%）`
          } else if (diff === 0) {
            progressMsg = ' 🔒 跟上次一樣穩'
          }
        }
      }

      const streakMsg = weekActiveDays >= 4 ? ` 🔥 本週第 ${weekActiveDays} 天！` : weekActiveDays >= 2 ? ` 💪 本週第 ${weekActiveDays} 天` : ''
      const tonnageMsg = tonnage > 0 ? ` · ${Math.round(tonnage).toLocaleString()}kg` : ''

      showToast(`訓練已記錄！${tonnageMsg}${progressMsg}${streakMsg}`, 'success', '🎉')

      // 顯示恢復警告（如果有）
      if (result.recoveryWarning) {
        setTimeout(() => showToast(result.recoveryWarning, 'error'), 500)
      }
    } catch (err: any) {
      showToast(err?.message || '提交失敗，請重試', 'error')
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
              {/* 主訊息：一句話告訴學員今天怎麼練 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{mode.modeEmoji}</span>
                <p className="font-medium">{mode.clientMessage}</p>
              </div>

              {/* 建議組數 */}
              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`text-[10px] ${colors.tagBg} rounded px-1.5 py-0.5`}>建議 {mode.suggestedSets}</span>
                {mode.focusAreas.map((area, i) => (
                  <span key={i} className={`text-[10px] ${colors.tagBg} rounded px-1.5 py-0.5`}>{area}</span>
                ))}
              </div>

              {tier === 'self_managed' && (
                <p className="text-[10px] text-blue-500 mb-2">
                  🔒 <a href="/upgrade?from=self_managed&feature=personalized_sets" className="hover:underline">升級教練指導，獲得根據你的經驗、恢復和基因計算的個人化建議 →</a>
                </p>
              )}

              {mode.sameSplitWarning && (
                <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  ⚠️ {mode.sameSplitWarning}
                </div>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  ▶ 查看分析依據（{totalReasons} 項信號）
                </summary>
                <div className="mt-2 space-y-2">
                  {/* 技術參數 */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 opacity-70">
                    <span>RPE {mode.targetRpeRange[0]}-{mode.targetRpeRange[1]}</span>
                    {mode.volumeAdjustment !== 0 && (
                      <span>容量 {mode.volumeAdjustment > 0 ? '+' : ''}{mode.volumeAdjustment}%</span>
                    )}
                  </div>
                  {/* 技術建議 */}
                  {mode.suggestions.map((s, i) => (
                    <div key={i} className="opacity-80">- {s}</div>
                  ))}
                  {/* 信號依據 */}
                  {mode.reasons.map((r, i) => (
                    <div key={`r-${i}`} className="opacity-80">
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

        {/* 休息日已儲存：顯示簡潔訊息 */}
        {isRest && todayTraining && todayTraining.training_type === 'rest' && !showRestForm ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-gray-600">今天休息 😴</span>
            <button
              onClick={() => setShowRestForm(true)}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              修改
            </button>
          </div>
        ) : (<>

        {/* 有氧子類型選擇 */}
        {isCardio && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">有氧類型</p>
            <div className="flex gap-2 flex-wrap">
              {CARDIO_SUBTYPES.map(({ value, emoji }) => (
                <button
                  key={value}
                  onClick={() => setCardioSubtype(cardioSubtype === value ? null : value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    cardioSubtype === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {emoji} {value}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* 主項重量追蹤（展開動作明細時隱藏，避免重複填） */}
        {(!simpleMode || showTrainingAdvanced) && !isRest && !isCardio && compoundLiftName && !showDetailedSets && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-amber-800 mb-2">🏆 主項：{compoundLiftName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">重量（kg）</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  value={form.compound_weight ?? ''}
                  onChange={(e) => setForm(prev => ({ ...prev, compound_weight: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2.5 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">次數</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.compound_reps ?? ''}
                  onChange={(e) => setForm(prev => ({ ...prev, compound_reps: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2.5 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  placeholder="8"
                />
              </div>
            </div>
            {compoundHistory.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <p className="text-[10px] text-amber-600 mb-1">最近紀錄</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {compoundHistory.map((h: any, i: number) => (
                    <span key={i} className="text-[11px] text-gray-600">
                      {h.date.slice(5)} <span className="font-medium">{h.compound_weight}kg×{h.compound_reps}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 動作明細（展開式） */}
        {(!simpleMode || showTrainingAdvanced) && !isRest && !isCardio && (
          <div>
            {!showDetailedSets ? (
              <button
                onClick={() => setShowDetailedSets(true)}
                className="w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                📝 記錄每個動作（重量/次數/組數）
              </button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">動作明細</p>
                  <button onClick={() => setShowDetailedSets(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button>
                </div>

                {/* 上次紀錄提示 */}
                {lastTypeSets.length > 0 && detailedSets.length === 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                    <p className="text-xs text-blue-700 mb-1">上次{form.training_type ? ` ${TRAINING_TYPES.find(t => t.value === form.training_type)?.label || form.training_type} ` : ''}紀錄：</p>
                    <div className="space-y-0.5">
                      {Array.from(new Set(lastTypeSets.map(s => s.exercise_name))).map(name => {
                        const sets = lastTypeSets.filter(s => s.exercise_name === name)
                        const first = sets[0]
                        return (
                          <p key={name} className="text-[11px] text-blue-600">
                            {name}: {first.weight}kg x {first.reps} x {first.num_sets || 1}組
                          </p>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setDetailedSets(lastTypeSets.map((s, i) => ({ ...s, set_number: i + 1 })))}
                      className="mt-1.5 text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      複製上次紀錄
                    </button>
                  </div>
                )}

                {/* 動作列表 */}
                {detailedSets.map((set, i) => {
                  const prevSame = lastTypeSets.find(s => s.exercise_name === set.exercise_name && s.set_number === set.set_number)
                  return (
                    <div key={i} className="bg-white rounded-lg p-2.5 border border-gray-100 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={set.exercise_name}
                          onChange={(e) => updateSet(i, 'exercise_name', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="動作名稱"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">#{set.set_number}</span>
                        <button onClick={() => duplicateSet(i)} className="text-gray-400 hover:text-blue-500 text-xs" title="複製這組">+</button>
                        <button onClick={() => removeSet(i)} className="text-gray-400 hover:text-red-500 text-xs" title="刪除">x</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 block">重量(kg)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="2.5"
                            value={set.weight ?? ''}
                            onChange={(e) => updateSet(i, 'weight', e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder={prevSame?.weight ? String(prevSame.weight) : ''}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block">次數</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={set.reps ?? ''}
                            onChange={(e) => updateSet(i, 'reps', e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder={prevSame?.reps ? String(prevSame.reps) : ''}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block">組數</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="20"
                            value={set.num_sets || ''}
                            onChange={(e) => updateSet(i, 'num_sets', e.target.value ? Number(e.target.value) : 1)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="3"
                          />
                        </div>
                      </div>
                      {prevSame && (
                        <p className="text-[10px] text-gray-400">上次：{prevSame.weight}kg x {prevSame.reps} x {prevSame.num_sets || 1}組</p>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => addExercise()}
                  className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + 新增動作
                </button>

                {/* Tonnage 摘要 */}
                {detailedSets.some(s => s.weight && s.reps) && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                    總訓練量：{Math.round(detailedSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0) * (s.num_sets || 1), 0)).toLocaleString()} kg
                  </div>
                )}
              </div>
            )}
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

        </>)}

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
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
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
