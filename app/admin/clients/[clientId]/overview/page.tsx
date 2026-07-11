'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts'
import dynamic from 'next/dynamic'
import { FileText } from 'lucide-react'
import { daysUntilDateTW } from '@/lib/date-utils'
import { TRAINING_TYPES, isWeightTraining } from '@/components/client/types'
import { generateSupplementSuggestions } from '@/lib/supplement-engine'
import { isCompetitionMode, isHealthMode, PHASE_LABELS, BODYBUILDING_PHASE_OPTIONS, ATHLETIC_PHASE_OPTIONS } from '@/lib/client-mode'
import TrainingProgressCard from '@/components/client/TrainingProgressCard'

const LabNutritionAdviceCard = dynamic(() => import('@/components/client/LabNutritionAdviceCard'), { ssr: false })
const LabInsightsCard = dynamic(() => import('@/components/client/LabInsightsCard'), { ssr: false })

export default function ClientOverview() {
  const { clientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedTraining, setCopiedTraining] = useState(false)
  const [copiedAi, setCopiedAi] = useState(false)
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('14')
  const [suggestion, setSuggestion] = useState<any>(null)
  const [suggestionMeta, setSuggestionMeta] = useState<any>(null)
  const [applyingsuggestion, setApplyingsuggestion] = useState(false)
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [client, setClient] = useState<any>(null)
  const [supplements, setSupplements] = useState<any[]>([])
  const [supplementLogs, setSupplementLogs] = useState<any[]>([])
  const [wellness, setWellness] = useState<any[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [personalNotes, setPersonalNotes] = useState<any[]>([])
  const [bodyData, setBodyData] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([])
  const [trainingSets, setTrainingSets] = useState<any[]>([])
  const [coachSummary, setCoachSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  // ===== 快速操作 state =====
  const [quickAction, setQuickAction] = useState<'calories' | 'phase' | 'note' | null>(null)
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickToast, setQuickToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [caloriesDraft, setCaloriesDraft] = useState<number | null>(null)
  const [phaseDraft, setPhaseDraft] = useState<string>('')
  const [noteDraft, setNoteDraft] = useState<string>('')
  // ===== 手機快速行動：發訊息 =====
  const [showCompose, setShowCompose] = useState(false)
  const [composeMsg, setComposeMsg] = useState('')
  const [composeBusy, setComposeBusy] = useState(false)

  const sendCoachMessage = async () => {
    const msg = composeMsg.trim()
    if (!msg || !client?.id) return
    setComposeBusy(true)
    try {
      const res = await fetch('/api/admin/weekly-coaching/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, message: msg, mode: 'adjust' }),
      })
      if (!res.ok) throw new Error()
      setShowCompose(false)
      setComposeMsg('')
      setQuickToast({ type: 'success', msg: '訊息已送出，學員打開就看得到' })
      setTimeout(() => setQuickToast(null), 3000)
    } catch {
      setQuickToast({ type: 'error', msg: '送出失敗，請重試' })
      setTimeout(() => setQuickToast(null), 3000)
    } finally {
      setComposeBusy(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [clientId])

  const fetchAllData = async () => {
    try {
      const res = await fetch(`/api/client-overview?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      setClient(data.client)
      setSupplements(data.supplements || [])
      setSupplementLogs(data.supplementLogs || [])
      setWellness(data.wellness || [])
      setTrainingLogs(data.trainingLogs || [])
      setBodyData(data.bodyData || [])
      setLabResults(data.labResults || [])
      setNutritionLogs(data.nutritionLogs || [])
      setTrainingSets(data.trainingSets || [])
      setPersonalNotes(data.personalNotes || [])
      // 同時抓取營養分析
      if (data.client?.goal_type && data.client?.nutrition_enabled) {
        fetch(`/api/nutrition-suggestions?clientId=${data.client.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) { setSuggestion(d.suggestion); setSuggestionMeta(d.meta) } })
          .catch(() => {})
      }
    } catch (err) {
      console.error('載入資料錯誤:', err)
    } finally {
      setLoading(false)
    }
  }

  // 一鍵套用建議
  const applySuggestion = async () => {
    if (!suggestion || suggestion.status === 'insufficient_data' || suggestion.status === 'low_compliance') return
    // on_track 時只有安全修正才需要套用（autoApply = true 時表示有修正）
    if (suggestion.status === 'on_track' && !suggestion.autoApply) return
    setApplyingsuggestion(true)
    try {
      const updates: any = {}
      if (suggestion.suggestedCalories != null) updates.calories_target = suggestion.suggestedCalories
      if (suggestion.suggestedProtein != null) updates.protein_target = suggestion.suggestedProtein
      if (suggestion.suggestedCarbs != null) updates.carbs_target = suggestion.suggestedCarbs
      if (suggestion.suggestedFat != null) updates.fat_target = suggestion.suggestedFat
      if (suggestion.suggestedCarbsTrainingDay != null) updates.carbs_training_day = suggestion.suggestedCarbsTrainingDay
      if (suggestion.suggestedCarbsRestDay != null) updates.carbs_rest_day = suggestion.suggestedCarbsRestDay

      const res = await fetch('/api/admin/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, clientData: updates }),
      })
      if (res.ok) {
        setSuggestionApplied(true)
        // 更新本地 client state
        setClient((prev: any) => ({ ...prev, ...updates }))
        setTimeout(() => setSuggestionApplied(false), 3000)
      }
    } catch (err) {
      console.error('套用建議失敗:', err)
    } finally {
      setApplyingsuggestion(false)
    }
  }

  const fetchCoachSummary = async () => {
    setSummaryLoading(true)
    setCoachSummary(null)
    try {
      const res = await fetch(`/api/admin/coach-summary?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCoachSummary(data.summary)
    } catch (err) {
      console.error('生成教練建議失敗:', err)
      setCoachSummary('生成失敗，請稍後再試。')
    } finally {
      setSummaryLoading(false)
    }
  }

  // ===== 快速操作：儲存學員資料更新 =====
  const saveQuickAction = async (updates: Record<string, unknown>, successMsg: string) => {
    if (!client?.id) return
    setQuickSaving(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, clientData: updates }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // 本地 state 同步更新（避免重新 fetch 整頁）
      setClient((prev: any) => ({ ...prev, ...updates }))
      setQuickToast({ type: 'success', msg: successMsg })
      setQuickAction(null)
      setTimeout(() => setQuickToast(null), 2500)
    } catch (err) {
      console.error('快速操作儲存失敗:', err)
      setQuickToast({ type: 'error', msg: '儲存失敗，請稍後再試' })
      setTimeout(() => setQuickToast(null), 3500)
    } finally {
      setQuickSaving(false)
    }
  }

  // 開啟快速操作面板時，把當前值帶進 draft
  const openQuickAction = (action: 'calories' | 'phase' | 'note') => {
    if (action === 'calories') {
      const cur = client?.calories_target ? parseInt(client.calories_target) : null
      setCaloriesDraft(cur)
    } else if (action === 'phase') {
      setPhaseDraft(client?.prep_phase || '')
    } else if (action === 'note') {
      setNoteDraft(client?.coach_weekly_note || '')
    }
    setQuickAction(action)
  }

  // ===== 核心指標 =====
  const keyMetrics = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const rangeDays = parseInt(dateRange)
    const rangeStart = new Date(today); rangeStart.setDate(today.getDate() - (rangeDays - 1))
    const weekStart = rangeStart.toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 29)
    const monthStart = thirtyDaysAgo.toISOString().split('T')[0]

    // 補品服從率
    const totalSupps = supplements.length
    const weekLogs = supplementLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.completed)
    const monthLogs = supplementLogs.filter(l => l.date >= monthStart && l.date <= todayStr && l.completed)
    const weekCompliance = totalSupps > 0 ? Math.round((weekLogs.length / (rangeDays * totalSupps)) * 100) : 0
    const monthCompliance = totalSupps > 0 ? Math.round((monthLogs.length / (30 * totalSupps)) * 100) : 0

    // 本週訓練
    const weekTraining = trainingLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.training_type !== 'rest')
    const weekTrainingDays = weekTraining.length

    // 近 7 天平均感受
    const recentWellness = wellness.filter(w => w.date >= weekStart && w.date <= todayStr)
    const avgEnergy = recentWellness.length > 0
      ? (recentWellness.reduce((s, w) => s + (w.energy_level || 0), 0) / recentWellness.filter(w => w.energy_level).length).toFixed(1)
      : '--'

    // 體重變化
    const recentBody = bodyData.filter(b => b.weight != null)
    let weightChange = null as string | null
    if (recentBody.length >= 2) {
      const latest = recentBody[recentBody.length - 1].weight
      const prev = recentBody[recentBody.length - 2].weight
      weightChange = (latest - prev).toFixed(1)
    }

    // 飲食合規率
    const weekNutrition = nutritionLogs.filter(l => l.date >= weekStart && l.date <= todayStr)
    const weekNutritionCompliant = weekNutrition.filter(l => l.compliant).length
    const weekNutritionRate = weekNutrition.length > 0 ? Math.round((weekNutritionCompliant / weekNutrition.length) * 100) : null

    const monthNutrition = nutritionLogs.filter(l => l.date >= monthStart && l.date <= todayStr)
    const monthNutritionCompliant = monthNutrition.filter(l => l.compliant).length
    const monthNutritionRate = monthNutrition.length > 0 ? Math.round((monthNutritionCompliant / monthNutrition.length) * 100) : null

    // 蛋白質達標率 + 平均偏差
    const proteinTarget = client?.protein_target
    const weekNutritionWithProtein = weekNutrition.filter(l => l.protein_grams != null && proteinTarget)
    const proteinHitDays = weekNutritionWithProtein.filter(l => l.protein_grams >= proteinTarget * 0.9).length
    const proteinHitRate = weekNutritionWithProtein.length > 0 ? Math.round((proteinHitDays / weekNutritionWithProtein.length) * 100) : null
    const avgProtein = weekNutritionWithProtein.length > 0 ? Math.round(weekNutritionWithProtein.reduce((s, l) => s + l.protein_grams, 0) / weekNutritionWithProtein.length) : null
    const proteinDeltaPct = avgProtein && proteinTarget ? Math.round(((avgProtein - proteinTarget) / proteinTarget) * 100) : null

    // 蛋白質連續未達標天數（從最近一天往回數）
    const sortedProteinDays = [...weekNutritionWithProtein].sort((a, b) => b.date.localeCompare(a.date))
    let proteinMissStreak = 0
    for (const day of sortedProteinDays) {
      if (day.protein_grams < proteinTarget * 0.9) { proteinMissStreak++ } else break
    }

    // 體重變化 %BW
    const latestWeight = recentBody.length > 0 ? recentBody[recentBody.length - 1].weight : null
    const weightChangePct = latestWeight && weightChange ? ((Number(weightChange) / latestWeight) * 100).toFixed(1) : null

    // 14 天體重移動平均趨勢
    const fourteenDayBody = recentBody.filter(b => b.date >= weekStart)
    let weightTrend: 'down' | 'up' | 'flat' | null = null
    if (fourteenDayBody.length >= 4) {
      const half = Math.floor(fourteenDayBody.length / 2)
      const firstHalf = fourteenDayBody.slice(0, half)
      const secondHalf = fourteenDayBody.slice(half)
      const avgFirst = firstHalf.reduce((s: number, b: any) => s + b.weight, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((s: number, b: any) => s + b.weight, 0) / secondHalf.length
      const diff = avgSecond - avgFirst
      weightTrend = diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'flat'
    }

    // ===== HRV 個人基線 + 異常偵測 =====
    // 取最近 14 天有 HRV 的資料，去除最近 3 天作為基線
    const hrvData = wellness.filter(w => w.hrv != null && w.hrv > 0).sort((a, b) => a.date.localeCompare(b.date))
    let avgHrv: number | null = null
    let hrvBaseline: number | null = null
    let hrvLowStreak = 0
    if (hrvData.length >= 1) {
      const last3 = hrvData.slice(-3)
      avgHrv = Math.round(last3.reduce((s, w) => s + w.hrv, 0) / last3.length)
    }
    // 基線需要 7 天以上資料（不含最近 3 天）
    const baselineSample = hrvData.slice(0, -3)
    if (baselineSample.length >= 7) {
      const sorted = [...baselineSample].map(w => w.hrv).sort((a, b) => a - b)
      hrvBaseline = sorted[Math.floor(sorted.length / 2)]
    }
    // 計算連續低於基線 10% 的天數（從最近往回）
    if (hrvBaseline) {
      const threshold = hrvBaseline * 0.9
      const recent = [...hrvData].sort((a, b) => b.date.localeCompare(a.date))
      for (const day of recent) {
        if (day.hrv < threshold) hrvLowStreak++
        else break
      }
    }

    // ===== Resting HR（最新值） =====
    const rhrData = wellness.filter(w => w.resting_hr != null && w.resting_hr > 0).sort((a, b) => b.date.localeCompare(a.date))
    const latestRhr: number | null = rhrData.length > 0 ? rhrData[0].resting_hr : null

    // ===== 目標進度 =====
    // 目標日期（優先用 competition_date，其次 target_date）
    const goalDateStr = client?.competition_date || client?.target_date || null
    const daysToGoal = goalDateStr ? Math.floor((new Date(goalDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

    // 距離目標體重 / 體脂
    const targetWeightNum = client?.target_weight ? parseFloat(client.target_weight) : null
    const targetBfNum = client?.target_body_fat || client?.body_fat_target ? parseFloat(client?.target_body_fat || client?.body_fat_target) : null
    const latestBodyFat = recentBody.length > 0 ? recentBody[recentBody.length - 1].body_fat : null
    const weightToGo = (targetWeightNum && latestWeight) ? +(latestWeight - targetWeightNum).toFixed(1) : null
    const bfToGo = (targetBfNum && latestBodyFat != null) ? +(latestBodyFat - targetBfNum).toFixed(1) : null

    // 進度條：用最早一筆數據當起點
    const startingWeight = recentBody.length > 0 ? recentBody[0].weight : null
    const startingBodyFat = recentBody.find((b: any) => b.body_fat != null)?.body_fat ?? null
    const startingDate = recentBody.length > 0 ? recentBody[0].date : null

    // 體重進度（達成度 %）
    let weightProgress: number | null = null
    if (startingWeight && targetWeightNum && latestWeight && Math.abs(startingWeight - targetWeightNum) > 0.1) {
      const total = startingWeight - targetWeightNum
      const done = startingWeight - latestWeight
      // 不論 cut/bulk 都用同向度量
      weightProgress = Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    }

    // 體脂進度
    let bfProgress: number | null = null
    if (startingBodyFat && targetBfNum && latestBodyFat != null && Math.abs(startingBodyFat - targetBfNum) > 0.5) {
      const total = startingBodyFat - targetBfNum
      const done = startingBodyFat - latestBodyFat
      bfProgress = Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    }

    // 時間進度（從起始到目標日的百分比）
    let timeProgress: number | null = null
    if (startingDate && goalDateStr) {
      const startMs = new Date(startingDate).getTime()
      const goalMs = new Date(goalDateStr).getTime()
      const nowMs = Date.now()
      if (goalMs > startMs) {
        timeProgress = Math.max(0, Math.min(100, Math.round(((nowMs - startMs) / (goalMs - startMs)) * 100)))
      }
    }

    return { weekCompliance, monthCompliance, weekTrainingDays, avgEnergy, weightChange, weightChangePct, latestWeight, weekNutritionRate, monthNutritionRate, proteinHitRate, avgProtein, proteinDeltaPct, proteinTarget, proteinMissStreak, weightTrend, avgHrv, hrvBaseline, hrvLowStreak, latestRhr, daysToGoal, targetWeightNum, targetBfNum, latestBodyFat, weightToGo, bfToGo, startingWeight, startingBodyFat, startingDate, weightProgress, bfProgress, timeProgress }
  }, [supplements, supplementLogs, wellness, trainingLogs, bodyData, nutritionLogs, dateRange, client])

  // ===== 補品服從率趨勢（每日） =====
  const complianceTrend = useMemo(() => {
    if (!supplements.length || !supplementLogs.length) return []
    const total = supplements.length
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const byDate: Record<string, number> = {}
    for (const log of supplementLogs) {
      if (log.completed && log.date >= startStr && log.date <= todayStr) {
        byDate[log.date] = (byDate[log.date] || 0) + 1
      }
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        服從率: Math.round((count / total) * 100),
      }))
  }, [supplements, supplementLogs, dateRange])

  // ===== 感受趨勢 =====
  const wellnessTrend = useMemo(() => {
    if (!wellness.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    return wellness
      .filter(w => w.date >= startStr && w.date <= todayStr && (w.sleep_quality != null || w.energy_level != null || w.mood != null))
      .map(w => ({
        date: new Date(w.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        睡眠: w.sleep_quality,
        精力: w.energy_level,
        心情: w.mood,
      }))
  }, [wellness, dateRange])

  // ===== 訓練日曆（6 週） =====
  const calendarWeeks = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - mondayOffset)

    const weeks: { date: string; label: string; log: any; isToday: boolean; isFuture: boolean }[][] = []
    for (let w = 5; w >= 0; w--) {
      const week: typeof weeks[0] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(thisMonday)
        date.setDate(thisMonday.getDate() - w * 7 + d)
        const dateStr = date.toISOString().split('T')[0]
        week.push({
          date: dateStr,
          label: date.getDate().toString(),
          log: trainingLogs.find(l => l.date === dateStr) || null,
          isToday: dateStr === today,
          isFuture: dateStr > today,
        })
      }
      weeks.push(week)
    }
    return weeks
  }, [trainingLogs])

  // ===== 訓練類型分佈 =====
  const trainingDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      counts[log.training_type] = (counts[log.training_type] || 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({
        name: TRAINING_TYPES.find(t => t.value === type)?.label || type,
        次數: count,
      }))
      .sort((a, b) => b.次數 - a.次數)
  }, [trainingLogs])

  // ===== RPE 趨勢 =====
  const rpeTrend = useMemo(() => {
    return trainingLogs
      .filter(l => l.rpe != null && l.training_type !== 'rest')
      .map(l => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        RPE: l.rpe,
        type: TRAINING_TYPES.find(t => t.value === l.training_type)?.label || l.training_type,
      }))
  }, [trainingLogs])

  // ===== 週平均體重（滾動 7 天 × 8 週） =====
  const weeklyWeightStats = useMemo(() => {
    const withWeight = bodyData
      .filter(b => b.weight != null && !Number.isNaN(Number(b.weight)))
      .map(b => ({ date: b.date as string, weight: Number(b.weight) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (withWeight.length === 0) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weeks: Array<{ label: string; startDate: string; endDate: string; avg: number | null; count: number }> = []

    for (let i = 7; i >= 0; i--) {
      const end = new Date(today); end.setDate(today.getDate() - i * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]
      const inWeek = withWeight.filter(e => e.date >= startStr && e.date <= endStr)
      const avg = inWeek.length > 0 ? inWeek.reduce((s, e) => s + e.weight, 0) / inWeek.length : null
      weeks.push({ label: i === 0 ? '本週' : `${i} 週前`, startDate: startStr, endDate: endStr, avg, count: inWeek.length })
    }

    const filled = weeks.filter(w => w.avg != null)
    const current = filled[filled.length - 1] ?? null
    const previous = filled[filled.length - 2] ?? null
    const fourWeeksAgo = filled.length >= 5 ? filled[filled.length - 5] : null
    const delta1w = current && previous ? current.avg! - previous.avg! : null
    const delta4w = current && fourWeeksAgo ? current.avg! - fourWeeksAgo.avg! : null

    // 線性回歸斜率（kg/週）— 比 delta4w/4 穩定
    let regressionSlope: number | null = null
    const points = weeks
      .map((w, idx) => ({ x: idx, y: w.avg }))
      .filter(p => p.y != null) as Array<{ x: number; y: number }>
    if (points.length >= 3) {
      const n = points.length
      const meanX = points.reduce((s, p) => s + p.x, 0) / n
      const meanY = points.reduce((s, p) => s + p.y, 0) / n
      let num = 0, den = 0
      for (const p of points) {
        num += (p.x - meanX) * (p.y - meanY)
        den += (p.x - meanX) ** 2
      }
      if (den > 0) regressionSlope = num / den
    }

    // 近 4 週斜率：對照長期斜率用（早期平台期會把 8 週斜率拖慢 → 誤判「落後」）。只改顯示、不進處方。
    let recentSlope: number | null = null
    const recentPts = points.slice(-4)
    if (recentPts.length >= 3) {
      const n2 = recentPts.length
      const mx = recentPts.reduce((s, p) => s + p.x, 0) / n2
      const my = recentPts.reduce((s, p) => s + p.y, 0) / n2
      let nu = 0, de = 0
      for (const p of recentPts) { nu += (p.x - mx) * (p.y - my); de += (p.x - mx) ** 2 }
      if (de > 0) recentSlope = nu / de
    }

    const trendReversed = delta1w != null && delta4w != null &&
      Math.sign(delta1w) !== Math.sign(delta4w) &&
      Math.abs(delta1w) > 0.15

    return { weeks, current, delta1w, delta4w, regressionSlope, recentSlope, trendReversed }
  }, [bodyData])

  // ===== 體組成趨勢 =====
  const bodyTrend = useMemo(() => {
    if (!bodyData.length) return { weight: [], bodyFat: [] }
    const weight = bodyData.filter(b => b.weight != null).map(b => ({
      date: new Date(b.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
      體重: b.weight,
    }))
    const bodyFat = bodyData.filter(b => b.body_fat != null).map(b => ({
      date: new Date(b.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
      體脂: b.body_fat,
    }))
    return { weight, bodyFat }
  }, [bodyData])

  // ===== 血檢最新值 =====
  const latestLabs = useMemo(() => {
    const byName = new Map<string, any>()
    for (const r of labResults) {
      if (!byName.has(r.test_name)) byName.set(r.test_name, r)
    }
    return [...byName.values()]
  }, [labResults])

  // ===== 補品建議（依血檢數值）=====
  const supplementSuggestions = useMemo(() => {
    if (!latestLabs.length) return []
    const recentRPELogs = trainingLogs.filter(t => t.rpe != null).slice(-3)
    const hasHighRPE = recentRPELogs.length >= 3 && recentRPELogs.every((t: any) => t.rpe > 8.5)
    return generateSupplementSuggestions(latestLabs, {
      gender: client?.gender,
      isCompetitionPrep: isCompetitionMode(client?.client_mode),
      hasHighRPE,
      goalType: client?.goal_type || null,
      isHealthMode: isHealthMode(client?.client_mode),
      genetics: {
        mthfr: client?.gene_mthfr,
        apoe: client?.gene_apoe,
        depressionRisk: client?.gene_depression_risk,
      },
      prepPhase: client?.prep_phase || null,
    })
  }, [latestLabs, client, trainingLogs])

  // ===== 訓練×恢復交叉分析 =====
  const recoveryAnalysis = useMemo(() => {
    if (!trainingLogs.length || !wellness.length) return []
    const wellnessMap: Record<string, any> = {}
    for (const w of wellness) wellnessMap[w.date] = w

    const nextDay = (dateStr: string) => {
      const d = new Date(dateStr); d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    }

    const typeStats: Record<string, { count: number; energy: number[]; sleep: number[]; mood: number[]; rpe: number[] }> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      const t = log.training_type
      if (!typeStats[t]) typeStats[t] = { count: 0, energy: [], sleep: [], mood: [], rpe: [] }
      typeStats[t].count++
      if (log.rpe != null) typeStats[t].rpe.push(log.rpe)
      const nextW = wellnessMap[nextDay(log.date)]
      if (nextW) {
        if (nextW.energy_level != null) typeStats[t].energy.push(nextW.energy_level)
        if (nextW.sleep_quality != null) typeStats[t].sleep.push(nextW.sleep_quality)
        if (nextW.mood != null) typeStats[t].mood.push(nextW.mood)
      }
    }

    return Object.entries(typeStats).map(([type, s]) => {
      const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--'
      return {
        type: TRAINING_TYPES.find(t => t.value === type)?.label || type,
        emoji: TRAINING_TYPES.find(t => t.value === type)?.emoji || '',
        count: s.count,
        avgRpe: avg(s.rpe),
        avgEnergy: avg(s.energy),
        avgSleep: avg(s.sleep),
        avgMood: avg(s.mood),
      }
    }).sort((a, b) => b.count - a.count)
  }, [trainingLogs, wellness])

  // ===== E1RM 趨勢（主項力量）=====
  const e1rmTrend = useMemo(() => {
    if (!trainingSets.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }
    const mainLiftNames = ['深蹲', '臥推', '硬舉', '肩推']
    const mainSets = trainingSets.filter(
      (s: any) => s.is_main_lift || mainLiftNames.some(n => s.exercise_name?.includes(n))
    )
    if (!mainSets.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }

    // Group by exercise and date, pick best E1RM per exercise per date
    const byExercise: Record<string, Record<string, number>> = {}
    for (const s of mainSets) {
      if (!s.weight || !s.reps || s.reps > 10 || s.reps < 1) continue
      const e1rm = s.weight * (36 / (37 - s.reps))
      const name = s.exercise_name
      if (!byExercise[name]) byExercise[name] = {}
      if (!byExercise[name][s.date] || e1rm > byExercise[name][s.date]) {
        byExercise[name][s.date] = Math.round(e1rm * 10) / 10
      }
    }

    const exercises = Object.keys(byExercise)
    if (!exercises.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }

    // Collect all dates
    const allDates = new Set<string>()
    for (const ex of exercises) {
      for (const d of Object.keys(byExercise[ex])) allDates.add(d)
    }
    const sortedDates = Array.from(allDates).sort()

    const chartData = sortedDates.map(date => {
      const point: any = { date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) }
      for (const ex of exercises) {
        if (byExercise[ex][date]) point[ex] = byExercise[ex][date]
      }
      return point
    })

    // % change from first to last
    const changes: Record<string, string> = {}
    for (const ex of exercises) {
      const dates = Object.keys(byExercise[ex]).sort()
      if (dates.length >= 2) {
        const first = byExercise[ex][dates[0]]
        const last = byExercise[ex][dates[dates.length - 1]]
        const pct = ((last - first) / first) * 100
        changes[ex] = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
      }
    }

    return { exercises, chartData, changes }
  }, [trainingSets])

  // ===== 每週訓練量（Tonnage）趨勢 =====
  const weeklyTonnage = useMemo(() => {
    if (!trainingSets.length) return []
    // Group sets into ISO weeks (Mon-Sun)
    const weekMap: Record<string, number> = {}
    for (const s of trainingSets) {
      if (!s.weight || !s.reps) continue
      const d = new Date(s.date)
      const day = d.getDay()
      const diff = day === 0 ? 6 : day - 1
      const monday = new Date(d)
      monday.setDate(d.getDate() - diff)
      const key = monday.toISOString().split('T')[0]
      weekMap[key] = (weekMap[key] || 0) + (s.weight * s.reps)
    }
    const sorted = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
    return sorted.map(([weekStart, tonnage], i) => {
      const prevTonnage = i > 0 ? sorted[i - 1][1] : tonnage
      return {
        week: new Date(weekStart).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        訓練量: Math.round(tonnage),
        increased: tonnage >= prevTonnage,
      }
    })
  }, [trainingSets])

  // ===== 每肌群週組數 =====
  const muscleGroupSets = useMemo(() => {
    if (!trainingSets.length) return []
    // Get current week (Mon-Sun)
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    const mondayStr = monday.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]

    // Count distinct sets per muscle group this week
    const groupCounts: Record<string, number> = {}
    for (const s of trainingSets) {
      if (!s.muscle_group || s.date < mondayStr || s.date > todayStr) continue
      groupCounts[s.muscle_group] = (groupCounts[s.muscle_group] || 0) + 1
    }

    const labelMap: Record<string, string> = {
      chest: '胸', back: '背', shoulders: '肩', legs: '腿', arms: '手臂', core: '核心',
      glutes: '臀', hamstrings: '腿後', quads: '腿前', calves: '小腿',
    }

    return Object.entries(groupCounts)
      .map(([group, sets]) => ({
        muscle: labelMap[group] || group,
        組數: sets,
      }))
      .sort((a, b) => b.組數 - a.組數)
  }, [trainingSets])

  // ===== 飲食合規趨勢 =====
  const nutritionTrend = useMemo(() => {
    if (!nutritionLogs.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const byWeek: Record<string, { compliant: number; total: number }> = {}
    for (const log of nutritionLogs.filter((l: any) => l.date >= startStr && l.date <= todayStr)) {
      const d = new Date(log.date)
      const weekStart = new Date(d)
      const day = d.getDay()
      const diff = day === 0 ? 6 : day - 1
      weekStart.setDate(d.getDate() - diff)
      const key = weekStart.toISOString().split('T')[0]
      if (!byWeek[key]) byWeek[key] = { compliant: 0, total: 0 }
      byWeek[key].total++
      if (log.compliant) byWeek[key].compliant++
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        飲食合規率: Math.round((stats.compliant / stats.total) * 100),
      }))
  }, [nutritionLogs, dateRange])

  // ===== 蛋白質/水量趨勢 =====
  const proteinWaterTrend = useMemo(() => {
    if (!nutritionLogs.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    return nutritionLogs
      .filter((l: any) => l.date >= startStr && l.date <= todayStr && (l.protein_grams != null || l.water_ml != null))
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        蛋白質: l.protein_grams ?? null,
        飲水量: l.water_ml ? Math.round(l.water_ml / 100) * 100 : null,
      }))
  }, [nutritionLogs, dateRange])

  // ===== 備賽巨量營養素趨勢 =====
  const macroTrend = useMemo(() => {
    if (!isCompetitionMode(client?.client_mode) || !nutritionLogs.length) return { calories: [], carbs: [], fat: [] }
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const filteredLogs = nutritionLogs.filter((l: any) => l.date >= startStr && l.date <= todayStr)
    const calories = filteredLogs
      .filter((l: any) => l.calories != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        熱量: l.calories,
      }))
    const carbs = filteredLogs
      .filter((l: any) => l.carbs_grams != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        碳水: l.carbs_grams,
      }))
    const fat = filteredLogs
      .filter((l: any) => l.fat_grams != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        脂肪: l.fat_grams,
      }))
    return { calories, carbs, fat }
  }, [nutritionLogs, client?.client_mode, dateRange])

  // ===== 巨量營養素偏差報告 =====
  const macroDeviation = useMemo(() => {
    if (!client || !nutritionLogs.length) return null
    const hasCarbCycling = client.carbs_training_day && client.carbs_rest_day
    const hasTargets = client.calories_target || client.protein_target || client.carbs_target || client.fat_target || hasCarbCycling

    if (!hasTargets) return null

    // 取近 N 天的資料
    const rangeDays = parseInt(dateRange)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const rangeStart = new Date(today); rangeStart.setDate(today.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]

    const recentLogs = nutritionLogs
      .filter((l: any) => l.date >= startStr && l.date <= todayStr)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))

    if (recentLogs.length === 0) return null

    // 每日偏差（百分比）
    const dailyData = recentLogs.map((l: any) => {
      const day: any = {
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        rawDate: l.date,
      }
      if (client.calories_target && l.calories != null) {
        day.calDev = Math.round(((l.calories - client.calories_target) / client.calories_target) * 100)
        day.calories = l.calories
      }
      if (client.protein_target && l.protein_grams != null) {
        day.proDev = Math.round(((l.protein_grams - client.protein_target) / client.protein_target) * 100)
        day.protein = l.protein_grams
      }
      // 碳水：碳循環模式下根據當天有無訓練動態選擇目標
      const dailyCarbTarget = hasCarbCycling
        ? (trainingLogs.some((t: any) => t.date === l.date && isWeightTraining(t.training_type)) ? client.carbs_training_day : client.carbs_rest_day)
        : client.carbs_target
      if (dailyCarbTarget && l.carbs_grams != null) {
        day.carbDev = Math.round(((l.carbs_grams - dailyCarbTarget) / dailyCarbTarget) * 100)
        day.carbs = l.carbs_grams
        day.carbTarget = dailyCarbTarget
        day.isTrainingDay = trainingLogs.some((t: any) => t.date === l.date && isWeightTraining(t.training_type))
      }
      if (client.fat_target && l.fat_grams != null) {
        day.fatDev = Math.round(((l.fat_grams - client.fat_target) / client.fat_target) * 100)
        day.fat = l.fat_grams
      }
      return day
    })

    // 計算平均偏差
    const avgDev = (key: string) => {
      const vals = dailyData.filter((d: any) => d[key] != null).map((d: any) => d[key])
      return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
    }

    // 超標天數
    const overDays = (key: string, threshold: number) => {
      return dailyData.filter((d: any) => d[key] != null && Math.abs(d[key]) > threshold).length
    }

    return {
      dailyData,
      avgCalDev: avgDev('calDev'),
      avgProDev: avgDev('proDev'),
      avgCarbDev: avgDev('carbDev'),
      avgFatDev: avgDev('fatDev'),
      calOverDays: overDays('calDev', 10),
      proOverDays: overDays('proDev', 10),
      carbOverDays: overDays('carbDev', 10),
      fatOverDays: overDays('fatDev', 10),
      totalDays: dailyData.length,
    }
  }, [nutritionLogs, client, trainingLogs, dateRange])

  // ===== 週報自動產出 =====
  const weeklyReport = useMemo(() => {
    const rangeDays = parseInt(dateRange)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const periodStart = new Date(today); periodStart.setDate(today.getDate() - (rangeDays - 1))
    const weekStart = periodStart.toISOString().split('T')[0]
    const prevPeriodStart = new Date(today); prevPeriodStart.setDate(today.getDate() - (rangeDays * 2 - 1))
    const lastWeekStart = prevPeriodStart.toISOString().split('T')[0]
    const prevPeriodEnd = new Date(today); prevPeriodEnd.setDate(today.getDate() - rangeDays)
    const lastWeekEndStr = prevPeriodEnd.toISOString().split('T')[0]

    // 訓練摘要
    const weekTraining = trainingLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.training_type !== 'rest')
    const trainingDays = weekTraining.length
    const typeCounts: Record<string, number> = {}
    let totalRpe = 0, rpeCount = 0
    for (const l of weekTraining) {
      typeCounts[l.training_type] = (typeCounts[l.training_type] || 0) + 1
      if (l.rpe != null) { totalRpe += l.rpe; rpeCount++ }
    }
    const avgRpe = rpeCount > 0 ? (totalRpe / rpeCount).toFixed(1) : null
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([type, count]) => `${TRAINING_TYPES.find(t => t.value === type)?.label || type}${count}次`)

    // 身心趨勢
    const weekWellness = wellness.filter(w => w.date >= weekStart && w.date <= todayStr)
    const lastWeekWellness = wellness.filter(w => w.date >= lastWeekStart && w.date <= lastWeekEndStr)
    const avg = (arr: any[], field: string) => {
      const vals = arr.filter(w => w[field] != null).map(w => w[field])
      return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
    }
    const avgSleep = avg(weekWellness, 'sleep_quality')
    const avgEnergy = avg(weekWellness, 'energy_level')
    const avgMood = avg(weekWellness, 'mood')
    const lastAvgSleep = avg(lastWeekWellness, 'sleep_quality')
    const lastAvgEnergy = avg(lastWeekWellness, 'energy_level')
    const lastAvgMood = avg(lastWeekWellness, 'mood')
    const arrow = (curr: number | null, prev: number | null) => {
      if (curr == null || prev == null) return ''
      const diff = curr - prev
      if (Math.abs(diff) < 0.2) return ''
      return diff > 0 ? ' ↑' : ' ↓'
    }

    // 補品合規率
    const totalSupps = supplements.length
    const weekSuppLogs = supplementLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.completed)
    const lastWeekSuppLogs = supplementLogs.filter(l => l.date >= lastWeekStart && l.date <= lastWeekEndStr && l.completed)
    const weekSuppRate = totalSupps > 0 ? Math.round((weekSuppLogs.length / (rangeDays * totalSupps)) * 100) : null
    const lastWeekSuppRate = totalSupps > 0 ? Math.round((lastWeekSuppLogs.length / (rangeDays * totalSupps)) * 100) : null

    // 體重變化
    const recentBody = bodyData.filter(b => b.weight != null)
    const weekBody = recentBody.filter(b => b.date >= weekStart && b.date <= todayStr)
    const lastWeekBody = recentBody.filter(b => b.date >= lastWeekStart && b.date <= lastWeekEndStr)
    let weightDelta: string | null = null
    if (weekBody.length > 0 && lastWeekBody.length > 0) {
      const latestW = weekBody[weekBody.length - 1].weight
      const lastW = lastWeekBody[lastWeekBody.length - 1].weight
      weightDelta = (latestW - lastW).toFixed(1)
    }

    // 飲食合規
    const weekNutrition = nutritionLogs.filter(l => l.date >= weekStart && l.date <= todayStr)
    const lastWeekNutrition = nutritionLogs.filter(l => l.date >= lastWeekStart && l.date <= lastWeekEndStr)
    const weekNutRate = weekNutrition.length > 0 ? Math.round((weekNutrition.filter(l => l.compliant).length / weekNutrition.length) * 100) : null
    const lastWeekNutRate = lastWeekNutrition.length > 0 ? Math.round((lastWeekNutrition.filter(l => l.compliant).length / lastWeekNutrition.length) * 100) : null

    // 自動產出文字摘要
    const lines: string[] = []
    if (trainingDays > 0) {
      lines.push(`本週訓練 ${trainingDays} 天${topTypes.length > 0 ? `（${topTypes.join('、')}）` : ''}${avgRpe ? `，平均 RPE ${avgRpe}` : ''}。`)
    } else {
      lines.push('本週無訓練記錄。')
    }

    const wellnessParts: string[] = []
    if (avgSleep != null) wellnessParts.push(`睡眠 ${avgSleep.toFixed(1)}${arrow(avgSleep, lastAvgSleep)}`)
    if (avgEnergy != null) wellnessParts.push(`精力 ${avgEnergy.toFixed(1)}${arrow(avgEnergy, lastAvgEnergy)}`)
    if (avgMood != null) wellnessParts.push(`心情 ${avgMood.toFixed(1)}${arrow(avgMood, lastAvgMood)}`)
    if (wellnessParts.length > 0) {
      lines.push(`身心狀態：${wellnessParts.join('、')}。`)
    }

    const complianceParts: string[] = []
    if (weekSuppRate != null) {
      const suppDelta = lastWeekSuppRate != null ? weekSuppRate - lastWeekSuppRate : null
      complianceParts.push(`補品 ${weekSuppRate}%${suppDelta != null && Math.abs(suppDelta) >= 5 ? (suppDelta > 0 ? ' ↑' : ' ↓') : ''}`)
    }
    if (weekNutRate != null) {
      const nutDelta = lastWeekNutRate != null ? weekNutRate - lastWeekNutRate : null
      complianceParts.push(`飲食 ${weekNutRate}%${nutDelta != null && Math.abs(nutDelta) >= 5 ? (nutDelta > 0 ? ' ↑' : ' ↓') : ''}`)
    }
    if (complianceParts.length > 0) {
      lines.push(`合規率：${complianceParts.join('、')}。`)
    }

    if (weightDelta != null) {
      const w = Number(weightDelta)
      if (Math.abs(w) >= 0.1) {
        lines.push(`體重${w > 0 ? '增加' : '減少'} ${Math.abs(w)} kg。`)
      }
    }

    // 蛋白質/水量平均
    const weekNutritionWithProtein = weekNutrition.filter((l: any) => l.protein_grams != null)
    const avgProtein = weekNutritionWithProtein.length > 0
      ? Math.round(weekNutritionWithProtein.reduce((s: number, l: any) => s + l.protein_grams, 0) / weekNutritionWithProtein.length)
      : null
    const weekNutritionWithWater = weekNutrition.filter((l: any) => l.water_ml != null)
    const avgWater = weekNutritionWithWater.length > 0
      ? Math.round(weekNutritionWithWater.reduce((s: number, l: any) => s + l.water_ml, 0) / weekNutritionWithWater.length)
      : null

    // 備賽巨量營養素平均
    const weekNutritionWithCalories = weekNutrition.filter((l: any) => l.calories != null)
    const avgCalories = weekNutritionWithCalories.length > 0
      ? Math.round(weekNutritionWithCalories.reduce((s: number, l: any) => s + l.calories, 0) / weekNutritionWithCalories.length)
      : null
    const weekNutritionWithCarbs = weekNutrition.filter((l: any) => l.carbs_grams != null)
    const avgCarbs = weekNutritionWithCarbs.length > 0
      ? Math.round(weekNutritionWithCarbs.reduce((s: number, l: any) => s + l.carbs_grams, 0) / weekNutritionWithCarbs.length)
      : null
    const weekNutritionWithFat = weekNutrition.filter((l: any) => l.fat_grams != null)
    const avgFat = weekNutritionWithFat.length > 0
      ? Math.round(weekNutritionWithFat.reduce((s: number, l: any) => s + l.fat_grams, 0) / weekNutritionWithFat.length)
      : null

    const nutrientParts: string[] = []
    if (avgProtein != null) {
      nutrientParts.push(`蛋白質平均 ${avgProtein}g${client?.protein_target ? `（目標 ${client.protein_target}g）` : ''}`)
    }
    if (avgWater != null) {
      nutrientParts.push(`飲水平均 ${avgWater}ml${client?.water_target ? `（目標 ${client.water_target}ml）` : ''}`)
    }
    if (nutrientParts.length > 0) {
      lines.push(`營養攝取：${nutrientParts.join('、')}。`)
    }

    // 備賽巨量摘要
    if (isCompetitionMode(client?.client_mode)) {
      const macroParts: string[] = []
      if (avgCalories != null) macroParts.push(`熱量 ${avgCalories}kcal${client?.calories_target ? `/${client.calories_target}` : ''}`)
      if (avgCarbs != null) macroParts.push(`碳水 ${avgCarbs}g${client?.carbs_target ? `/${client.carbs_target}` : ''}`)
      if (avgFat != null) macroParts.push(`脂肪 ${avgFat}g${client?.fat_target ? `/${client.fat_target}` : ''}`)
      if (macroParts.length > 0) {
        lines.push(`備賽巨量：${macroParts.join('、')}。`)
      }
    }

    return {
      trainingDays, topTypes, avgRpe,
      avgSleep, avgEnergy, avgMood,
      sleepArrow: arrow(avgSleep, lastAvgSleep),
      energyArrow: arrow(avgEnergy, lastAvgEnergy),
      moodArrow: arrow(avgMood, lastAvgMood),
      weekSuppRate, lastWeekSuppRate,
      weekNutRate, lastWeekNutRate,
      weightDelta,
      avgProtein, avgWater,
      avgCalories, avgCarbs, avgFat,
      summary: lines.join('\n'),
      weekLabel: `${periodStart.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - ${today.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}`,
    }
  }, [trainingLogs, wellness, supplements, supplementLogs, bodyData, nutritionLogs, dateRange])

  // ===== 訓練端週摘要（給 CONQUER / 外部教練團隊） =====
  const generateTrainingSummary = () => {
    const wr = weeklyReport
    const km = keyMetrics
    const lines: string[] = []

    // Header
    lines.push(`【訓練端週摘要】${wr.weekLabel}`)
    lines.push(`學員：${client.name}${isCompetitionMode(client.client_mode) ? ` ｜ ${PHASE_LABELS[client.prep_phase || ''] || ''}` : ''}${
      client.competition_date ? ` ｜ 距比賽 ${daysUntilDateTW(client.competition_date)} 天` : ''
    }`)
    lines.push('')

    // 體重
    if (km.latestWeight) {
      let weightLine = `■ 體重：${km.latestWeight} kg`
      if (km.weightChange) weightLine += `（週 ${Number(km.weightChange) > 0 ? '+' : ''}${km.weightChange} kg`
      if (km.weightChangePct) weightLine += ` / ${Number(km.weightChangePct) > 0 ? '+' : ''}${km.weightChangePct}%`
      if (km.weightChange) weightLine += '）'
      if (km.weightTrend) weightLine += ` 趨勢${km.weightTrend === 'up' ? '↑' : km.weightTrend === 'down' ? '↓' : '→'}`
      lines.push(weightLine)
    }

    // 體脂
    const latestBf = bodyData.filter(b => b.body_fat != null).slice(-1)[0]
    if (latestBf) {
      lines.push(`■ 體脂：${latestBf.body_fat}%（量測 ${latestBf.date}）`)
    }
    lines.push('')

    // 營養達標率
    lines.push('■ 營養達標率：')
    if (km.avgProtein != null && km.proteinTarget) {
      const pctDiff = km.proteinDeltaPct || 0
      lines.push(`  蛋白質：${km.proteinHitRate}%（平均 ${km.avgProtein}g / 目標 ${km.proteinTarget}g，偏差 ${pctDiff > 0 ? '+' : ''}${pctDiff}%）${pctDiff <= -15 ? ' ⚠️' : ''}`)
    }
    if (wr.avgCalories != null && client.calories_target) {
      const calDiff = Math.round(((wr.avgCalories - client.calories_target) / client.calories_target) * 100)
      lines.push(`  熱量：${calDiff > 0 ? '+' : ''}${calDiff}%（${wr.avgCalories} / ${client.calories_target} kcal）`)
    }
    if (wr.avgCarbs != null && client.carbs_target) {
      const carbDiff = Math.round(((wr.avgCarbs - client.carbs_target) / client.carbs_target) * 100)
      lines.push(`  碳水：${carbDiff > 0 ? '+' : ''}${carbDiff}%（${wr.avgCarbs} / ${client.carbs_target}g）`)
    }
    if (wr.avgFat != null && client.fat_target) {
      const fatDiff = Math.round(((wr.avgFat - client.fat_target) / client.fat_target) * 100)
      lines.push(`  脂肪：${fatDiff > 0 ? '+' : ''}${fatDiff}%（${wr.avgFat} / ${client.fat_target}g）`)
    }
    lines.push('')

    // 恢復指標
    lines.push('■ 恢復指標：')
    const wellParts: string[] = []
    if (wr.avgSleep != null) wellParts.push(`睡眠 ${wr.avgSleep.toFixed(1)}`)
    if (wr.avgEnergy != null) wellParts.push(`精力 ${wr.avgEnergy.toFixed(1)}`)
    if (wr.avgMood != null) wellParts.push(`心情 ${wr.avgMood.toFixed(1)}`)
    if (wellParts.length > 0) lines.push(`  ${wellParts.join(' / ')}`)
    // 找隔天恢復最差的訓練類型
    const worstRecovery = recoveryAnalysis.filter(r => r.avgEnergy !== '--').sort((a, b) => Number(a.avgEnergy) - Number(b.avgEnergy))[0]
    if (worstRecovery && Number(worstRecovery.avgEnergy) < 4.5) {
      lines.push(`  ${worstRecovery.type}日隔天精力最低（${worstRecovery.avgEnergy}）⚠️`)
    }
    lines.push('')

    // 訓練概況
    lines.push('■ 訓練概況：')
    lines.push(`  ${dateRange}天訓練 ${wr.trainingDays} 天${wr.topTypes.length > 0 ? `（${wr.topTypes.join('、')}）` : ''}`)
    if (wr.avgRpe) lines.push(`  平均 RPE ${wr.avgRpe}${alerts.some(a => a.includes('RPE')) ? '｜多次 RPE ≥ 9 ⚠️' : ''}`)
    lines.push('')

    // 荷爾蒙警報（從 alerts 抓）
    const hormoneAlert = alerts.find(a => a.includes('荷爾蒙'))
    if (hormoneAlert) {
      lines.push('■ 荷爾蒙警報：')
      // 列出具體數值
      const hormoneLabNames = ['testosterone', '睪固酮', 'free_testosterone', '游離睪固酮', 'bioavailable']
      const latestHormones = labResults.filter(l =>
        hormoneLabNames.some(n => l.test_name.toLowerCase().includes(n))
      ).sort((a: any, b: any) => b.date?.localeCompare(a.date || '') || 0)
      const seen = new Set<string>()
      for (const lab of latestHormones) {
        if (seen.has(lab.test_name)) continue
        seen.add(lab.test_name)
        lines.push(`  ${lab.test_name} ${lab.value} ${lab.unit || ''}`)
      }
      lines.push('')
    }

    // 教練備註（從 alerts 抓重點）
    const noteAlerts = alerts.filter(a => !a.includes('荷爾蒙'))
    if (noteAlerts.length > 0) {
      lines.push('■ 系統備註：')
      for (const a of noteAlerts) {
        lines.push(`  ${a}`)
      }
    }

    return lines.join('\n')
  }

  // ===== AI 完整摘要（教練用，含血檢/補品/基因） =====
  const generateAiFullSummary = () => {
    const wr = weeklyReport
    const km = keyMetrics
    const lines: string[] = []
    const today = new Date().toISOString().split('T')[0]

    lines.push(`【${client.name} 完整健康數據】${today}`)
    lines.push('')

    // 基本資料
    lines.push('■ 基本資料')
    const infoParts = [client.age ? `${client.age}歲` : null, client.gender, km.latestWeight ? `${km.latestWeight}kg` : null].filter(Boolean)
    if (client.goal_type) infoParts.push(`目標：${client.goal_type}`)
    if (isCompetitionMode(client.client_mode) && client.competition_date) {
      const d = daysUntilDateTW(client.competition_date)
      infoParts.push(`${PHASE_LABELS[client.prep_phase || ''] || ''}（距比賽 ${d} 天）`)
    }
    lines.push(infoParts.join(' / '))
    if (client.coach_summary) lines.push(`教練備註：${client.coach_summary}`)
    lines.push('')

    // 營養
    if (wr.avgProtein != null || wr.avgCalories != null) {
      lines.push('■ 近 14 天營養')
      if (wr.avgCalories != null) lines.push(`  熱量 ${wr.avgCalories} kcal${client.calories_target ? ` / 目標 ${client.calories_target}` : ''}`)
      if (wr.avgProtein != null) {
        const diff = client.protein_target ? Math.round(((wr.avgProtein - client.protein_target) / client.protein_target) * 100) : null
        lines.push(`  蛋白質 ${wr.avgProtein}g${client.protein_target ? ` / 目標 ${client.protein_target}g（${diff != null ? `${diff > 0 ? '+' : ''}${diff}%` : ''}）` : ''}${diff != null && diff <= -15 ? ' ⚠️' : ''}`)
      }
      if (wr.avgCarbs != null) lines.push(`  碳水 ${wr.avgCarbs}g${client.carbs_target ? ` / 目標 ${client.carbs_target}g` : ''}`)
      if (wr.avgFat != null) lines.push(`  脂肪 ${wr.avgFat}g${client.fat_target ? ` / 目標 ${client.fat_target}g` : ''}`)
      if (wr.avgWater != null) lines.push(`  飲水 ${wr.avgWater}ml${client.water_target ? ` / 目標 ${client.water_target}ml` : ''}`)
      if (km.proteinHitRate != null) lines.push(`  蛋白質達標率 ${km.proteinHitRate}%${km.proteinMissStreak >= 3 ? `（連續 ${km.proteinMissStreak} 天未達標）` : ''}`)
      lines.push('')
    }

    // 體重
    if (km.latestWeight) {
      lines.push('■ 體重趨勢')
      lines.push(`  最新 ${km.latestWeight}kg`)
      if (km.weightChange) lines.push(`  週變化 ${Number(km.weightChange) > 0 ? '+' : ''}${km.weightChange}kg（${km.weightChangePct ? `${Number(km.weightChangePct) > 0 ? '+' : ''}${km.weightChangePct}%` : ''}）`)
      if (km.weightTrend) lines.push(`  14天趨勢：${km.weightTrend === 'up' ? '上升↑' : km.weightTrend === 'down' ? '下降↓' : '持平→'}`)
      const latestBf = bodyData.filter(b => b.body_fat != null).slice(-1)[0]
      if (latestBf) lines.push(`  體脂 ${latestBf.body_fat}%（${latestBf.date}）`)
      lines.push('')
    }

    // 訓練
    if (wr.trainingDays > 0) {
      lines.push('■ 訓練（近 14 天）')
      lines.push(`  ${wr.trainingDays} 天${wr.topTypes.length > 0 ? `（${wr.topTypes.join('、')}）` : ''}`)
      if (wr.avgRpe) lines.push(`  平均 RPE ${wr.avgRpe}`)
      // 恢復分析
      if (recoveryAnalysis.length > 0) {
        const worst = recoveryAnalysis.filter(r => r.avgEnergy !== '--').sort((a, b) => Number(a.avgEnergy) - Number(b.avgEnergy))[0]
        if (worst && Number(worst.avgEnergy) < 4.5) lines.push(`  ⚠️ ${worst.type}日隔天精力最低（${worst.avgEnergy}）`)
      }
      lines.push('')
    }

    // 身心
    if (wr.avgSleep != null || wr.avgEnergy != null) {
      lines.push('■ 身心狀態（近 7 天）')
      const parts = []
      if (wr.avgSleep != null) parts.push(`睡眠 ${wr.avgSleep.toFixed(1)}/5`)
      if (wr.avgEnergy != null) parts.push(`精力 ${wr.avgEnergy.toFixed(1)}/5`)
      if (wr.avgMood != null) parts.push(`心情 ${wr.avgMood.toFixed(1)}/5`)
      lines.push(`  ${parts.join(' / ')}`)
      lines.push('')
    }

    // 血檢
    if (labResults.length > 0) {
      lines.push('■ 血檢指標（最新值）')
      const seen = new Set<string>()
      const sorted = [...labResults].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
      for (const lab of sorted) {
        if (seen.has(lab.test_name)) continue
        seen.add(lab.test_name)
        const s = lab.status === 'alert' ? ' ⚠️' : lab.status === 'attention' ? ' ⚡' : ''
        lines.push(`  ${lab.test_name}: ${lab.value} ${lab.unit || ''}${s}（${lab.date}）`)
      }

      // 變化追蹤
      const labsByName = new Map<string, any[]>()
      for (const lab of sorted) {
        if (!labsByName.has(lab.test_name)) labsByName.set(lab.test_name, [])
        labsByName.get(lab.test_name)!.push(lab)
      }
      const changes: string[] = []
      for (const [name, labs] of labsByName) {
        if (labs.length < 2) continue
        const latest = labs[0].value
        const oldest = labs[labs.length - 1].value
        if (oldest <= 0) continue
        const pct = Math.round(((latest - oldest) / oldest) * 100)
        if (Math.abs(pct) >= 15) changes.push(`${name} ${pct > 0 ? '+' : ''}${pct}%`)
      }
      if (changes.length > 0) {
        lines.push(`  趨勢變化：${changes.join('、')}`)
      }
      lines.push('')
    }

    // 補品
    if (supplements.length > 0) {
      lines.push('■ 目前補品')
      for (const s of supplements) {
        lines.push(`  ${s.name}${s.dosage ? ` ${s.dosage}` : ''}${s.timing ? `（${s.timing}）` : ''}`)
      }
      if (km.weekCompliance != null) lines.push(`  服從率 ${km.weekCompliance}%`)
      lines.push('')
    }

    // 基因
    if (client.gene_mthfr || client.gene_apoe || client.gene_depression_risk) {
      lines.push('■ 基因資料')
      if (client.gene_mthfr) lines.push(`  MTHFR: ${client.gene_mthfr}`)
      if (client.gene_apoe) lines.push(`  APOE: ${client.gene_apoe}`)
      if (client.gene_depression_risk) lines.push(`  5-HTTLPR: ${client.gene_depression_risk}`)
      if (client.gene_notes) lines.push(`  備註：${client.gene_notes}`)
      lines.push('')
    }

    // 系統建議
    if (suggestion) {
      lines.push('■ 系統目前建議')
      if (suggestion.suggestedCalories) lines.push(`  每日熱量 ${suggestion.suggestedCalories} kcal`)
      if (suggestion.suggestedProtein) lines.push(`  蛋白質 ${suggestion.suggestedProtein}g`)
      if (suggestion.suggestedCarbsTrainingDay && suggestion.suggestedCarbsRestDay) {
        lines.push(`  碳循環：訓練日 ${suggestion.suggestedCarbsTrainingDay}g / 休息日 ${suggestion.suggestedCarbsRestDay}g`)
      }
      if (suggestion.statusLabel) lines.push(`  狀態：${suggestion.statusLabel}`)
      lines.push('')
    }

    // 警報
    if (alerts.length > 0) {
      lines.push('■ 系統警報')
      for (const a of alerts) lines.push(`  ${a}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('此數據由 Howard Protocol 系統自動產出。')

    return lines.join('\n')
  }

  // ===== 需注意事項 =====
  const alerts = useMemo(() => {
    const items: string[] = []

    // 蛋白質嚴重不足（最高優先級）
    if (keyMetrics.proteinDeltaPct != null && keyMetrics.proteinDeltaPct <= -20) {
      const streak = keyMetrics.proteinMissStreak > 1 ? `，連續 ${keyMetrics.proteinMissStreak} 天未達標` : ''
      items.push(`蛋白質嚴重不足（平均 ${keyMetrics.avgProtein}g / 目標 ${keyMetrics.proteinTarget}g，偏差 ${keyMetrics.proteinDeltaPct}%${streak}）`)
    } else if (keyMetrics.proteinDeltaPct != null && keyMetrics.proteinDeltaPct <= -10) {
      const streak = keyMetrics.proteinMissStreak > 1 ? `，連續 ${keyMetrics.proteinMissStreak} 天未達標` : ''
      items.push(`蛋白質偏低（平均 ${keyMetrics.avgProtein}g / 目標 ${keyMetrics.proteinTarget}g，偏差 ${keyMetrics.proteinDeltaPct}%${streak}）`)
    }

    // 體重趨勢與目標方向不符
    if (keyMetrics.weightTrend && client?.goal_type === 'cut' && keyMetrics.weightTrend === 'up') {
      items.push(`體重 14 天趨勢上升，與減脂目標方向相反`)
    } else if (keyMetrics.weightTrend && client?.goal_type === 'bulk' && keyMetrics.weightTrend === 'down') {
      items.push(`體重 14 天趨勢下降，與增肌目標方向相反`)
    }

    // 荷爾蒙變化追蹤（從血檢數據抓）
    const hormoneAlerts: string[] = []
    const recentLabs = labResults.filter(l => l.date)
    const labsByName = new Map<string, any[]>()
    for (const lab of recentLabs) {
      const name = lab.test_name.toLowerCase()
      if (!labsByName.has(name)) labsByName.set(name, [])
      labsByName.get(name)!.push(lab)
    }
    for (const [name, labs] of labsByName) {
      if (labs.length < 2) continue
      const sorted = [...labs].sort((a, b) => a.date.localeCompare(b.date))
      const oldest = sorted[0].value
      const latest = sorted[sorted.length - 1].value
      if (oldest <= 0) continue
      const changePct = Math.round(((latest - oldest) / oldest) * 100)
      if (/testosterone|睪固酮/.test(name) && changePct <= -20) {
        const label = name.includes('free') || name.includes('游離') ? '游離睪固酮' : name.includes('bioavail') ? 'Bioavailable T' : '睪固酮'
        hormoneAlerts.push(`${label} ${changePct}%`)
      }
    }
    if (hormoneAlerts.length > 0) {
      items.push(`荷爾蒙下滑：${hormoneAlerts.join('、')}`)
    }

    if (keyMetrics.weekCompliance < 50 && supplements.length > 0) items.push(`本週補品服從率僅 ${keyMetrics.weekCompliance}%`)
    const recentWellness = wellness.slice(-7)
    const lowEnergy = recentWellness.filter(w => w.energy_level != null && w.energy_level <= 2)
    if (lowEnergy.length >= 3) items.push(`近 7 天有 ${lowEnergy.length} 天精力偏低`)
    const highRpe = trainingLogs.filter(l => l.rpe >= 9).slice(-3)
    if (highRpe.length >= 2) items.push(`近期多次 RPE ≥ 9，注意過度訓練`)

    // HRV 異常：連 3 天低於基線 10% → 強烈過度訓練訊號
    if (keyMetrics.hrvLowStreak >= 3 && keyMetrics.hrvBaseline) {
      items.push(`HRV 連 ${keyMetrics.hrvLowStreak} 天低於基線 10%（基線 ${keyMetrics.hrvBaseline}ms），恢復不足`)
    } else if (keyMetrics.hrvLowStreak >= 2 && keyMetrics.hrvBaseline) {
      items.push(`HRV 連 ${keyMetrics.hrvLowStreak} 天低於基線，留意是否需 deload`)
    }

    // 訓練×恢復：找出隔天精力最低的訓練類型
    const validRecovery = recoveryAnalysis.filter(r => r.avgEnergy !== '--' && r.count >= 2)
    if (validRecovery.length > 0) {
      const worst = [...validRecovery].sort((a, b) => Number(a.avgEnergy) - Number(b.avgEnergy))[0]
      if (worst && Number(worst.avgEnergy) <= 2.5) {
        items.push(`${worst.type}日隔天精力僅 ${worst.avgEnergy}/5（${worst.count} 次平均），考慮降強度`)
      }
    }
    if (client?.next_checkup_date) {
      const diff = Math.floor((new Date(client.next_checkup_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (diff < 0) items.push(`回檢已逾期 ${Math.abs(diff)} 天`)
      else if (diff <= 7) items.push(`回檢日期在 ${diff} 天後`)
    }
    return items
  }, [keyMetrics, wellness, trainingLogs, supplements, client, labResults, recoveryAnalysis])

  const getTypeBgColor = (type: string) => {
    const colors: Record<string, string> = {
      push: 'bg-slate-100', pull: 'bg-slate-100', legs: 'bg-slate-100',
      full_body: 'bg-slate-100', cardio: 'bg-slate-100', chest: 'bg-slate-100',
      shoulder: 'bg-slate-100', arms: 'bg-slate-100', rest: 'bg-slate-100',
    }
    return colors[type] || 'bg-slate-100'
  }

  const getTypeEmoji = (type: string) => TRAINING_TYPES.find(t => t.value === type)?.emoji || ''

  const getStatusColor = (status: string) => {
    if (status === 'normal') return 'bg-emerald-100 text-emerald-700'
    if (status === 'attention') return 'bg-amber-100 text-amber-700'
    return 'bg-rose-100 text-rose-700'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入學員資料...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">找不到學員資料</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">← 返回</Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{client.name} — 學員總覽</h1>
                  {isCompetitionMode(client.client_mode) && client.competition_date && (() => {
                    const d = daysUntilDateTW(client.competition_date)
                    return d > 0 ? <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${d <= 14 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>賽前 {d} 天</span> : null
                  })()}
                </div>
                <p className="text-xs text-gray-500">{client.age}歲 · {client.gender}{isCompetitionMode(client.client_mode) ? ` · ${PHASE_LABELS[client.prep_phase || ''] || ''}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`/admin/clients/${clientId}/report`, '_blank')}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                title="產生健康報告"
              >
                <FileText size={15} /> 健康報告
              </button>
              <Link
                href={`/admin/clients/${clientId}`}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                編輯資料
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* 日期範圍篩選 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">顯示範圍：</span>
          {(['7', '14', '30'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d} 天
            </button>
          ))}
        </div>

        {/* ===== 頂部快速摘要：紅綠燈 ===== */}
        <div className={`rounded-2xl p-5 border ${
          alerts.length >= 2 ? 'bg-rose-50 border-rose-200' : alerts.length === 1 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${alerts.length >= 2 ? 'bg-rose-500' : alerts.length === 1 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <div>
                <h2 className="text-base font-bold text-gray-900">{client.name} — 快速摘要</h2>
                <p className="text-xs text-gray-500">
                  {isCompetitionMode(client.client_mode) && client.competition_date && (() => {
                    const d = daysUntilDateTW(client.competition_date)
                    return d > 0 ? `距比賽 ${d} 天 · ${
                      (PHASE_LABELS[client.prep_phase || ''] || client.prep_phase || '')
                    }` : '比賽已結束'
                  })()}
                  {!isCompetitionMode(client.client_mode) && (client.health_goals || `${client.age}歲 · ${client.gender}`)}
                </p>
              </div>
            </div>
            <Link href={`/admin/clients/${clientId}`} className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs hover:bg-gray-100 transition-colors shadow-sm">
              編輯
            </Link>
          </div>

          {/* 關鍵指標一排 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
            {client.supplement_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">補品</p>
                <p className={`text-lg font-bold tabular-nums ${keyMetrics.weekCompliance >= 80 ? 'text-emerald-600' : keyMetrics.weekCompliance >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{keyMetrics.weekCompliance}%</p>
              </div>
            )}
            {client.nutrition_enabled && keyMetrics.weekNutritionRate != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">飲食</p>
                <p className={`text-lg font-bold tabular-nums ${keyMetrics.weekNutritionRate >= 80 ? 'text-emerald-600' : keyMetrics.weekNutritionRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{keyMetrics.weekNutritionRate}%</p>
              </div>
            )}
            {client.training_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">訓練</p>
                <p className="text-lg font-bold tabular-nums text-blue-600">{keyMetrics.weekTrainingDays}天</p>
              </div>
            )}
            {client.wellness_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">精力</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">{keyMetrics.avgEnergy}</p>
              </div>
            )}
            {client.body_composition_enabled && keyMetrics.latestWeight && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">體重</p>
                <p className="text-lg font-bold tabular-nums text-gray-900">{keyMetrics.latestWeight}<span className="text-xs font-normal">kg</span></p>
              </div>
            )}
            {client.body_composition_enabled && keyMetrics.weightChange && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">週變化</p>
                <p className={`text-lg font-bold tabular-nums ${Number(keyMetrics.weightChange) > 0 ? (client.goal_type === 'bulk' ? 'text-emerald-500' : 'text-rose-500') : Number(keyMetrics.weightChange) < 0 ? (client.goal_type === 'cut' ? 'text-emerald-500' : 'text-rose-500') : 'text-gray-500'}`}>
                  {Number(keyMetrics.weightChange) > 0 ? '+' : ''}{keyMetrics.weightChange}
                  {keyMetrics.weightChangePct && <span className="text-[11px] font-normal text-gray-400 ml-0.5">({Number(keyMetrics.weightChangePct) > 0 ? '+' : ''}{keyMetrics.weightChangePct}%)</span>}
                </p>
              </div>
            )}
            {keyMetrics.weightTrend && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">14天趨勢</p>
                <p className={`text-lg font-bold ${
                  keyMetrics.weightTrend === 'down' ? (client.goal_type === 'cut' ? 'text-emerald-600' : 'text-rose-600')
                  : keyMetrics.weightTrend === 'up' ? (client.goal_type === 'bulk' ? 'text-emerald-600' : 'text-rose-600')
                  : 'text-gray-500'
                }`}>
                  {keyMetrics.weightTrend === 'down' ? '↓' : keyMetrics.weightTrend === 'up' ? '↑' : '→'}
                </p>
              </div>
            )}
            {client.nutrition_enabled && keyMetrics.proteinHitRate != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">蛋白質達標</p>
                <p className={`text-lg font-bold tabular-nums ${keyMetrics.proteinHitRate >= 80 ? 'text-emerald-600' : keyMetrics.proteinHitRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{keyMetrics.proteinHitRate}%</p>
                {keyMetrics.proteinMissStreak >= 3 && (
                  <p className="text-[11px] text-rose-500">連{keyMetrics.proteinMissStreak}天</p>
                )}
              </div>
            )}
            {keyMetrics.avgHrv != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">HRV</p>
                <p className={`text-lg font-bold tabular-nums ${
                  keyMetrics.hrvLowStreak >= 3 ? 'text-rose-600' :
                  keyMetrics.hrvLowStreak >= 2 ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {keyMetrics.avgHrv}<span className="text-[11px] font-normal text-gray-400 ml-0.5">ms</span>
                </p>
                {keyMetrics.hrvBaseline && (
                  <p className="text-[11px] text-gray-400">基線 {keyMetrics.hrvBaseline}</p>
                )}
              </div>
            )}
            {keyMetrics.latestRhr != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[11px] text-gray-500">RHR</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {keyMetrics.latestRhr}<span className="text-[11px] font-normal text-gray-400 ml-0.5">bpm</span>
                </p>
              </div>
            )}
          </div>

          {/* 警報文字 */}
          {alerts.length > 0 && (
            <div className="bg-white/50 rounded-lg px-3 py-2">
              {alerts.map((a, i) => (
                <p key={i} className="text-xs text-rose-700">{a}</p>
              ))}
            </div>
          )}
        </div>

        {/* 原有警示區塊已整合到頂部摘要 */}

        {/* ===== 核心指標卡片（置頂，一眼看狀況）===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {client.supplement_enabled && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '週' : `${dateRange}天`}補品服從率</p>
              <p className={`text-3xl font-bold tabular-nums ${keyMetrics.weekCompliance >= 80 ? 'text-emerald-600' : keyMetrics.weekCompliance >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {keyMetrics.weekCompliance}%
              </p>
              <p className="text-xs text-gray-400 mt-1">月 {keyMetrics.monthCompliance}%</p>
            </div>
          )}
          {client.training_enabled && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '本週' : `近${dateRange}天`}訓練</p>
              <p className="text-3xl font-bold tabular-nums text-blue-600">{keyMetrics.weekTrainingDays} 天</p>
            </div>
          )}
          {client.wellness_enabled && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">近 {dateRange} 天精力</p>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{keyMetrics.avgEnergy}</p>
              <p className="text-xs text-gray-400 mt-1">滿分 5</p>
            </div>
          )}
          {client.body_composition_enabled && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">最新體重</p>
              <p className="text-3xl font-bold tabular-nums text-gray-900">{keyMetrics.latestWeight ?? '--'}</p>
              {keyMetrics.weightChange && (
                <p className={`text-xs mt-1 ${Number(keyMetrics.weightChange) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {Number(keyMetrics.weightChange) > 0 ? '↑' : '↓'} {Math.abs(Number(keyMetrics.weightChange))} kg
                </p>
              )}
            </div>
          )}
          {client.lab_enabled && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">血檢指標</p>
              <p className="text-3xl font-bold tabular-nums text-gray-900">
                {latestLabs.filter(l => l.status === 'normal').length}/{latestLabs.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">正常</p>
            </div>
          )}
          {client.nutrition_enabled && keyMetrics.weekNutritionRate != null && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '週' : `${dateRange}天`}飲食合規</p>
              <p className={`text-3xl font-bold tabular-nums ${keyMetrics.weekNutritionRate >= 80 ? 'text-emerald-600' : keyMetrics.weekNutritionRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {keyMetrics.weekNutritionRate}%
              </p>
              {keyMetrics.monthNutritionRate != null && (
                <p className="text-xs text-gray-400 mt-1">月 {keyMetrics.monthNutritionRate}%</p>
              )}
            </div>
          )}
        </div>

        {/* ===== 目標進度卡（時間/體重/體脂） ===== */}
        {(keyMetrics.daysToGoal != null || keyMetrics.weightToGo != null || keyMetrics.bfToGo != null) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">目標進度</h3>
              </div>
              <Link href={`/admin/clients/${clientId}`} className="text-xs text-gray-500 hover:text-gray-700">
                編輯目標 →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 距目標日 */}
              {keyMetrics.daysToGoal != null && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-semibold tracking-wider uppercase mb-1">
                    {client.competition_date ? '距比賽日' : '距目標日'}
                  </p>
                  <p className={`text-2xl font-bold tabular-nums ${
                    keyMetrics.daysToGoal <= 0 ? 'text-gray-400' :
                    keyMetrics.daysToGoal <= 14 ? 'text-rose-600' :
                    keyMetrics.daysToGoal <= 30 ? 'text-amber-600' :
                    'text-slate-900'
                  }`}>
                    {keyMetrics.daysToGoal <= 0 ? '已過' : `${keyMetrics.daysToGoal} 天`}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {client.competition_date || client.target_date}
                  </p>
                  {keyMetrics.timeProgress != null && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${keyMetrics.timeProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">時程已過 {keyMetrics.timeProgress}%</p>
                    </div>
                  )}
                </div>
              )}

              {/* 距目標體重 */}
              {keyMetrics.weightToGo != null && keyMetrics.targetWeightNum && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-semibold tracking-wider uppercase mb-1">距目標體重</p>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-2xl font-bold tabular-nums ${
                      Math.abs(keyMetrics.weightToGo) <= 0.5 ? 'text-emerald-700' :
                      client.goal_type === 'cut' && keyMetrics.weightToGo > 0 ? 'text-amber-600' :
                      client.goal_type === 'bulk' && keyMetrics.weightToGo < 0 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {keyMetrics.weightToGo > 0 ? '+' : ''}{keyMetrics.weightToGo}
                    </p>
                    <span className="text-xs font-normal text-gray-500">kg</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {keyMetrics.latestWeight}kg → 目標 {keyMetrics.targetWeightNum}kg
                  </p>
                  {keyMetrics.weightProgress != null && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${keyMetrics.weightProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        進度 {keyMetrics.weightProgress}%
                        {keyMetrics.startingWeight && ` · 起點 ${keyMetrics.startingWeight}kg`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 距目標體脂 */}
              {keyMetrics.bfToGo != null && keyMetrics.targetBfNum && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-slate-700 font-semibold tracking-wider uppercase mb-1">距目標體脂</p>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-2xl font-bold tabular-nums ${
                      Math.abs(keyMetrics.bfToGo) <= 1 ? 'text-slate-900' :
                      keyMetrics.bfToGo > 3 ? 'text-amber-600' :
                      'text-slate-700'
                    }`}>
                      {keyMetrics.bfToGo > 0 ? '+' : ''}{keyMetrics.bfToGo}
                    </p>
                    <span className="text-xs font-normal text-gray-500">%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {keyMetrics.latestBodyFat}% → 目標 {keyMetrics.targetBfNum}%
                  </p>
                  {keyMetrics.bfProgress != null && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${keyMetrics.bfProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        進度 {keyMetrics.bfProgress}%
                        {keyMetrics.startingBodyFat && ` · 起點 ${keyMetrics.startingBodyFat}%`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 週平均體重（滾動 7 天 × 8 週） ===== */}
        {weeklyWeightStats?.current && (() => {
          const { weeks, current, delta1w, delta4w, regressionSlope, recentSlope, trendReversed } = weeklyWeightStats
          const target = keyMetrics.targetWeightNum
          const remaining = target != null ? current.avg! - target : null
          const remainingDays = keyMetrics.daysToGoal
          const goalType = client?.goal_type

          let progressTag: { text: string; color: string } | null = null
          if (goalType === 'cut' && delta1w != null) {
            if (delta1w < -0.1) progressTag = { text: '減重中', color: 'text-emerald-600' }
            else if (delta1w > 0.2) progressTag = { text: '體重上升', color: 'text-rose-600' }
            else progressTag = { text: '停滯', color: 'text-amber-600' }
          } else if (goalType === 'bulk' && delta1w != null) {
            if (delta1w > 0.1) progressTag = { text: '增重中', color: 'text-emerald-600' }
            else if (delta1w < -0.2) progressTag = { text: '體重下降', color: 'text-rose-600' }
            else progressTag = { text: '停滯', color: 'text-amber-600' }
          }

          // 預估達標：用線性回歸斜率，並偵測趨勢反轉
          let projectedDays: number | null = null
          if (!trendReversed && regressionSlope != null && remaining != null && Math.abs(regressionSlope) > 0.05) {
            const weeksNeeded = -remaining / regressionSlope
            if (weeksNeeded > 0 && weeksNeeded < 200) projectedDays = Math.round(weeksNeeded * 7)
          }

          // 熱量缺口建議
          let kcalAdjustment: number | null = null
          let neededRate: number | null = null
          let currentRate: number | null = null
          if (remaining != null && remainingDays != null && remainingDays > 0) {
            neededRate = -remaining / (remainingDays / 7)
            currentRate = regressionSlope ?? delta1w ?? 0
            const gap = neededRate - currentRate
            if (Math.abs(gap) > 0.05) {
              kcalAdjustment = Math.round(gap * 7700 / 7)
            }
          }

          const currentCalTarget = client?.calories_target ? Number(client.calories_target) : null
          const currentProtein = client?.protein_target ? Number(client.protein_target) : null
          const currentFat = client?.fat_target ? Number(client.fat_target) : null
          const currentCarbTarget = client?.carbs_target ? Number(client.carbs_target) : null
          const currentCarbTrain = client?.carbs_training_day ? Number(client.carbs_training_day) : null
          const currentCarbRest = client?.carbs_rest_day ? Number(client.carbs_rest_day) : null

          // 從 personal_notes 解析個人化下限（weight ≥ 8）
          // 規則：note 含「低碳」「碳水必須 ≥」「SHBG」等關鍵字 → 提高碳水下限
          //       note 含「脂肪不能 ≤」→ 提高脂肪下限
          const noteFloors = (() => {
            const floors = {
              minCarbsTraining: 50,
              minCarbsRest: 50,
              minCarbsAvg: 50,
              minFat: Math.round(0.4 * (current.avg ?? 70)),  // T 合成下限（0.4 g/kg）
              avoidCarbCut: false,
              triggeredNotes: [] as Array<{ note: string; weight: number; rule: string }>,
            }
            for (const n of personalNotes) {
              if (n.weight < 8) continue
              const text: string = n.note || ''
              // 抓「訓練日 ≥ X」「非訓 ≥ Y」具體數字
              const trainMatch = text.match(/訓練日?[^\d]{0,8}≥\s*(\d+)\s*g/)
              if (trainMatch) {
                floors.minCarbsTraining = Math.max(floors.minCarbsTraining, parseInt(trainMatch[1]))
                floors.triggeredNotes.push({ note: text.slice(0, 80), weight: n.weight, rule: `訓練日碳水 ≥ ${trainMatch[1]}g` })
              }
              const restMatch = text.match(/非訓[練日]*[^\d]{0,8}≥\s*(\d+)\s*g/)
              if (restMatch) {
                floors.minCarbsRest = Math.max(floors.minCarbsRest, parseInt(restMatch[1]))
                floors.triggeredNotes.push({ note: text.slice(0, 80), weight: n.weight, rule: `非訓碳水 ≥ ${restMatch[1]}g` })
              }
              // 模糊抓「低碳」「200g 失敗」「SHBG」→ 標記避開砍碳
              if (/低碳.*失敗|SHBG.*敏感|碳水.*雷區|碳水必須維持/.test(text)) {
                floors.avoidCarbCut = true
                if (!floors.triggeredNotes.some(t => t.rule === '避免砍碳水')) {
                  floors.triggeredNotes.push({ note: text.slice(0, 80), weight: n.weight, rule: '避免砍碳水（優先砍脂肪 + cardio）' })
                }
              }
              // 脂肪下限
              const fatMatch = text.match(/脂肪[^\d]{0,8}(?:不能|不可|≥|大於)[^\d]{0,4}(\d+)\s*g/)
              if (fatMatch) {
                floors.minFat = Math.max(floors.minFat, parseInt(fatMatch[1]))
                floors.triggeredNotes.push({ note: text.slice(0, 80), weight: n.weight, rule: `脂肪 ≥ ${fatMatch[1]}g` })
              }
            }
            return floors
          })()

          // 套用建議計算（含個人化保護）
          const minCal = client?.gender === 'female' ? 1200 : 1500
          let newCal = currentCalTarget != null && kcalAdjustment != null
            ? Math.max(minCal, Math.round((currentCalTarget + kcalAdjustment) / 10) * 10)
            : null
          let actualKcalShift = newCal != null && currentCalTarget != null ? newCal - currentCalTarget : null
          let newCarb: number | null = null
          let newCarbTrain: number | null = null
          let newCarbRest: number | null = null
          let newFat: number | null = currentFat
          let strategyNote = ''
          let unfilledKcal = 0

          if (actualKcalShift != null && actualKcalShift < 0) {
            const totalCutKcal = -actualKcalShift
            if (noteFloors.avoidCarbCut) {
              // 路徑 B：保碳水、砍脂肪、剩餘 cardio
              const fatRoomG = Math.max(0, (currentFat ?? 0) - noteFloors.minFat)
              const fatCutKcalMax = fatRoomG * 9
              const fatCutKcal = Math.min(totalCutKcal, fatCutKcalMax)
              newFat = (currentFat ?? 0) - Math.round(fatCutKcal / 9)
              newCarb = currentCarbTarget
              newCarbTrain = currentCarbTrain
              newCarbRest = currentCarbRest
              unfilledKcal = totalCutKcal - fatCutKcal
              strategyNote = `依個人歷史：保碳水、砍脂肪 (-${Math.round(fatCutKcal)} kcal/天)` + (unfilledKcal > 50 ? `，剩 ${Math.round(unfilledKcal)} kcal 需從 cardio 取得（約 +${Math.ceil(unfilledKcal / 6)} min Zone 2）` : '')
              // 重算 newCal（因為實際只砍 fat 那部分）
              newCal = currentCalTarget != null ? currentCalTarget - Math.round(fatCutKcal) : null
              actualKcalShift = -Math.round(fatCutKcal)
            } else {
              // 路徑 A：原本邏輯，碳水吸收，但用個人化 floor
              const carbShift = Math.round((actualKcalShift / 4) / 5) * 5
              const clampedCarbTrain = currentCarbTrain != null ? Math.max(noteFloors.minCarbsTraining, currentCarbTrain + carbShift) : null
              const clampedCarbRest = currentCarbRest != null ? Math.max(noteFloors.minCarbsRest, currentCarbRest + carbShift) : null
              const clampedCarbAvg = currentCarbTarget != null ? Math.max(noteFloors.minCarbsAvg, currentCarbTarget + carbShift) : null
              newCarbTrain = clampedCarbTrain
              newCarbRest = clampedCarbRest
              newCarb = clampedCarbAvg
              // 計算被 floor 卡掉多少 kcal，剩下從 fat 或 cardio
              const desiredCarbCut = -carbShift * 4
              const actualCarbCut =
                (currentCarbTarget != null && clampedCarbAvg != null ? (currentCarbTarget - clampedCarbAvg) * 4 : desiredCarbCut)
              unfilledKcal = Math.max(0, desiredCarbCut - actualCarbCut)
              if (unfilledKcal > 50) {
                strategyNote = `撞個人碳水下限，剩 ${Math.round(unfilledKcal)} kcal 建議從 cardio 取得（約 +${Math.ceil(unfilledKcal / 6)} min Zone 2）`
              }
            }
          } else {
            newCarb = currentCarbTarget
            newCarbTrain = currentCarbTrain
            newCarbRest = currentCarbRest
          }

          const filledWeeks = weeks.filter(w => w.avg != null)
          const maxAvg = filledWeeks.length > 0 ? Math.max(...filledWeeks.map(w => w.avg as number)) : 0
          const minAvg = filledWeeks.length > 0 ? Math.min(...filledWeeks.map(w => w.avg as number)) : 0
          const range = Math.max(maxAvg - minAvg, 0.5)

          const projectedOverdue = remainingDays != null && projectedDays != null && projectedDays > remainingDays

          return (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">週平均體重</h3>
                    <p className="text-[11px] text-gray-400">滾動 7 天平均 · 最近 8 週 · 用來判斷有沒有在進度上</p>
                  </div>
                </div>
                {progressTag && <span className={`text-xs font-semibold ${progressTag.color}`}>{progressTag.text}</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-blue-700 font-semibold tracking-wider uppercase mb-1">本週平均</p>
                  <p className="text-2xl font-bold tabular-nums text-blue-900">{current.avg!.toFixed(1)}<span className="text-xs font-normal text-gray-500 ml-1">kg</span></p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{current.count} 筆紀錄</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-gray-600 font-semibold tracking-wider uppercase mb-1">vs 上週</p>
                  <p className={`text-xl font-bold tabular-nums ${
                    delta1w == null ? 'text-gray-400'
                      : delta1w > 0 ? 'text-rose-600'
                      : delta1w < 0 ? 'text-emerald-600'
                      : 'text-gray-600'
                  }`}>
                    {delta1w == null ? '—' : `${delta1w > 0 ? '+' : ''}${delta1w.toFixed(2)}`}
                  </p>
                  {delta1w != null && <p className="text-[11px] text-gray-500 mt-0.5">kg / 週</p>}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-gray-600 font-semibold tracking-wider uppercase mb-1">vs 4 週前</p>
                  <p className={`text-xl font-bold tabular-nums ${
                    delta4w == null ? 'text-gray-400'
                      : delta4w > 0 ? 'text-rose-600'
                      : delta4w < 0 ? 'text-emerald-600'
                      : 'text-gray-600'
                  }`}>
                    {delta4w == null ? '—' : `${delta4w > 0 ? '+' : ''}${delta4w.toFixed(2)}`}
                  </p>
                  {delta4w != null && <p className="text-[11px] text-gray-500 mt-0.5">kg / 月</p>}
                </div>
                <div className={`border rounded-xl p-3 ${
                  trendReversed ? 'bg-amber-50 border-amber-200'
                    : projectedOverdue ? 'bg-rose-50 border-rose-200'
                    : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <p className={`text-[11px] font-semibold tracking-wider uppercase mb-1 ${
                    trendReversed ? 'text-amber-700'
                      : projectedOverdue ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}>預估達標</p>
                  {trendReversed ? (
                    <>
                      <p className="text-base font-bold text-amber-700">趨勢反轉</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">本週與 4 週前方向相反，先看 2-3 週</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-xl font-bold ${projectedOverdue ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {projectedDays != null ? `${projectedDays} 天` : '—'}
                      </p>
                      {projectedDays != null && remainingDays != null && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {projectedOverdue ? `比目標慢 ${projectedDays - remainingDays} 天` : `比目標快 ${remainingDays - projectedDays} 天`}
                        </p>
                      )}
                      {/* 早期平台期會把 8 週斜率拖慢 → 落後其實被高估；近 4 週加速就提醒教練別只看長期 */}
                      {projectedOverdue && projectedDays != null && remainingDays != null && recentSlope != null && regressionSlope != null &&
                        (goalType === 'bulk' ? recentSlope > regressionSlope + 0.05 : recentSlope < regressionSlope - 0.05) && (
                        <p className="text-[11px] text-emerald-600 mt-1 leading-snug">
                          近 4 週已加速到 {recentSlope.toFixed(2)} kg/週（8 週平均 {regressionSlope.toFixed(2)}）→ 「慢 {projectedDays - remainingDays} 天」是被早期平台期拖到偏悲觀，實際可能更樂觀
                        </p>
                      )}
                      {projectedDays == null && (
                        <p className="text-[11px] text-gray-500 mt-0.5">速度不足以推算</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-end gap-1 h-14 mb-1">
                {weeks.map((w, i) => {
                  if (w.avg == null) {
                    return <div key={i} className="flex-1 bg-gray-100 rounded" style={{ height: '6%' }} title={`${w.label} 無紀錄`} />
                  }
                  const pct = ((w.avg - minAvg) / range) * 75 + 25
                  const isCurrent = i === weeks.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[11px] text-gray-500">{w.avg.toFixed(1)}</span>
                      <div
                        className={`w-full rounded transition-all ${isCurrent ? 'bg-blue-500' : 'bg-blue-200'}`}
                        style={{ height: `${pct}%` }}
                        title={`${w.label}（${w.startDate} ~ ${w.endDate}）：${w.avg.toFixed(1)} kg · ${w.count} 筆`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>7 週前</span>
                <span>本週</span>
              </div>

              {/* 動態調整建議 + 一鍵套用 */}
              {kcalAdjustment != null && remainingDays != null && remainingDays > 0 && remaining != null && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 mb-1">動態調整建議</p>
                      {client.auto_adjust_enabled && (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mb-1.5">
                          此學員自動調整中{client.last_auto_adjust_at ? `（上次 ${String(client.last_auto_adjust_at).slice(0, 10)}）` : ''}。下方為即時參考，系統會在冷卻期後自動評估，通常不需手動套用。
                        </p>
                      )}
                      <p className="text-xs text-gray-600 leading-relaxed">
                        距目標 <strong className="text-gray-900">{Math.abs(remaining).toFixed(1)} kg</strong>、剩 <strong className="text-gray-900">{remainingDays} 天</strong>。
                        {currentRate != null && (
                          <>目前速率 <strong className={currentRate < 0 ? 'text-emerald-700' : 'text-rose-700'}>{currentRate >= 0 ? '+' : ''}{currentRate.toFixed(2)} kg/週</strong>{recentSlope != null && regressionSlope != null && Math.abs(recentSlope - regressionSlope) > 0.05 ? <span className="text-gray-400">（近 4 週 {recentSlope >= 0 ? '+' : ''}{recentSlope.toFixed(2)}）</span> : null}，</>
                        )}
                        {neededRate != null && (
                          <>需 <strong className="text-gray-900">{neededRate >= 0 ? '+' : ''}{neededRate.toFixed(2)} kg/週</strong> 才會準時。</>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className={`text-2xl font-bold ${kcalAdjustment < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {kcalAdjustment > 0 ? '+' : ''}{kcalAdjustment} kcal/天
                        </span>
                        {currentCalTarget != null && newCal != null && (
                          <span className="text-xs text-gray-500">
                            熱量 {currentCalTarget} → <strong className="text-gray-700">{newCal}</strong>
                          </span>
                        )}
                        {currentCarbTarget != null && newCarb != null && (
                          <span className="text-xs text-gray-500">
                            · 碳水 {currentCarbTarget}g → <strong className="text-gray-700">{newCarb}g</strong>
                          </span>
                        )}
                      </div>
                      {(currentCarbTrain != null || currentCarbRest != null) && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          {currentCarbTrain != null && newCarbTrain != null && (
                            <>訓練日：{currentCarbTrain}g → <strong>{newCarbTrain}g</strong></>
                          )}
                          {currentCarbTrain != null && currentCarbRest != null && '　·　'}
                          {currentCarbRest != null && newCarbRest != null && (
                            <>非訓練日：{currentCarbRest}g → <strong>{newCarbRest}g</strong></>
                          )}
                        </p>
                      )}

                      {currentCalTarget != null && newCal != null && newCal !== currentCalTarget && (
                        <button
                          onClick={async () => {
                            const summary = [
                              `熱量：${currentCalTarget} → ${newCal} kcal`,
                              currentFat != null && newFat != null && newFat !== currentFat ? `脂肪：${currentFat}g → ${newFat}g` : null,
                              currentCarbTarget != null && newCarb != null && newCarb !== currentCarbTarget ? `碳水：${currentCarbTarget}g → ${newCarb}g` : null,
                              currentCarbTrain != null && newCarbTrain != null && newCarbTrain !== currentCarbTrain ? `訓練日碳水：${currentCarbTrain}g → ${newCarbTrain}g` : null,
                              currentCarbRest != null && newCarbRest != null && newCarbRest !== currentCarbRest ? `非訓練日碳水：${currentCarbRest}g → ${newCarbRest}g` : null,
                              strategyNote ? `\n${strategyNote}` : null,
                            ].filter(Boolean).join('\n')
                            if (!confirm(`確定套用？\n\n${summary}`)) return
                            const updates: Record<string, number | string> = {
                              calories_target: newCal!,
                              last_auto_adjust_at: new Date().toISOString(),
                            }
                            if (currentFat != null && newFat != null && newFat !== currentFat) updates.fat_target = newFat
                            if (currentCarbTarget != null && newCarb != null && newCarb !== currentCarbTarget) updates.carbs_target = newCarb
                            if (currentCarbTrain != null && newCarbTrain != null && newCarbTrain !== currentCarbTrain) updates.carbs_training_day = newCarbTrain
                            if (currentCarbRest != null && newCarbRest != null && newCarbRest !== currentCarbRest) updates.carbs_rest_day = newCarbRest
                            await saveQuickAction(updates, 'macros 已調整')
                            // Audit log
                            try {
                              await fetch('/api/admin/macro-adjustment-log', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  clientId: client.id,
                                  applied_by: 'coach',
                                  trigger_source: 'manual',
                                  old_macros: {
                                    calories_target: currentCalTarget,
                                    carbs_target: currentCarbTarget,
                                    carbs_training_day: currentCarbTrain,
                                    carbs_rest_day: currentCarbRest,
                                  },
                                  new_macros: updates,
                                  reason: `教練手動套用建議：${currentRate?.toFixed(2)} → ${neededRate?.toFixed(2)} kg/週`,
                                }),
                              })
                            } catch {/* silent */}
                          }}
                          disabled={quickSaving}
                          className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors ${client.auto_adjust_enabled ? 'bg-white border border-slate-300 text-gray-600 hover:bg-slate-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                          {quickSaving ? '套用中…' : client.auto_adjust_enabled ? '手動立即套用（通常不需）' : '一鍵套用建議'}
                        </button>
                      )}
                      {/* 個人化保護觸發提示 */}
                      {noteFloors.triggeredNotes.length > 0 && (
                        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs">
                          <p className="font-semibold text-emerald-800 mb-1">已套用個人歷史保護</p>
                          {strategyNote && <p className="text-emerald-700 mb-1.5">{strategyNote}</p>}
                          <ul className="text-emerald-600 space-y-0.5">
                            {noteFloors.triggeredNotes.map((t, i) => (
                              <li key={i}>· <span className="font-medium">{t.rule}</span> <span className="text-emerald-500">（weight {t.weight}）</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2 leading-snug">
                        7700 kcal ≈ 1 kg 純脂肪推算（未區分肌脂、未含 NEAT 變化）。建議搭配 1-2 週體重驗證後再進一步調。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ===== 🏋️ 近 30 天訓練紀錄 + 學員備註（含疼痛紅標）===== */}
        {trainingLogs.length > 0 && (() => {
          const PAIN_KEYWORDS = ['痛', '不適', '受傷', '酸', '痠', '麻', '緊', '拉傷', '扭', '刺痛']
          const hasFlag = (n: string | null) => !!n && PAIN_KEYWORDS.some(k => n.includes(k))
          const recent30 = (trainingLogs as any[]).filter(t => {
            const d = new Date(t.date)
            return d.getTime() >= Date.now() - 30 * 86_400_000
          }).sort((a, b) => b.date.localeCompare(a.date))
          const flagged = recent30.filter(r => hasFlag(r.note))
          const withNotes = recent30.filter(r => r.note && !hasFlag(r.note))
          if (flagged.length === 0 && withNotes.length === 0) return null
          const fmtType = (t: string | null) => {
            if (!t) return '—'
            const map: Record<string, string> = {
              cardio: '有氧', strength: '重訓', mixed: '混合',
              rest: '休息', flexibility: '柔軟度', sports: '運動',
              push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower',
            }
            return map[t] || t
          }
          return (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">近 30 天訓練紀錄（學員回報）</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">含「痛 / 不適 / 受傷 / 酸 / 麻 / 緊」自動紅標置頂</p>
                </div>
              </div>

              {flagged.length > 0 && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm font-semibold text-rose-700 mb-2">
                    {flagged.length} 筆紀錄含疼痛/不適關鍵字，建議優先處理
                  </p>
                  <div className="space-y-2">
                    {flagged.map((r: any) => (
                      <div key={r.id} className="bg-white border border-rose-200 rounded p-2 text-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <span className="font-mono">{r.date}</span>
                          <span>{fmtType(r.training_type)}</span>
                          {r.rpe != null && <span>RPE {r.rpe}</span>}
                          {r.duration != null && <span>{r.duration} 分鐘</span>}
                        </div>
                        <p className="text-rose-900 whitespace-pre-wrap">{r.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {withNotes.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-600 font-semibold">
                    其他學員備註（{withNotes.length} 筆）
                  </summary>
                  <div className="space-y-1.5 mt-2">
                    {withNotes.map((r: any) => (
                      <div key={r.id} className="border border-slate-200 rounded p-2 bg-slate-50">
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-0.5">
                          <span className="font-mono">{r.date}</span>
                          <span>{fmtType(r.training_type)}</span>
                          {r.rpe != null && <span>RPE {r.rpe}</span>}
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{r.note}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })()}

        {/* ===== 教練快速操作 ===== */}
        <div id="coach-quick-actions" className="bg-white border border-slate-200 rounded-2xl p-5 scroll-mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">教練快速操作</h3>
              {client?.calories_target && (
                <span className="text-xs text-gray-400 ml-2">
                  熱量 {client.calories_target} · {PHASE_LABELS[client.prep_phase || ''] || client.prep_phase || '未設階段'}
                </span>
              )}
            </div>
            {quickToast && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                quickToast.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {quickToast.msg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => openQuickAction(quickAction === 'calories' ? null as any : 'calories')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                quickAction === 'calories' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              改熱量
            </button>
            <button
              onClick={() => openQuickAction(quickAction === 'phase' ? null as any : 'phase')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                quickAction === 'phase' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              切階段
            </button>
            <button
              onClick={() => openQuickAction(quickAction === 'note' ? null as any : 'note')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                quickAction === 'note' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              加備註
            </button>
          </div>

          {/* 改熱量 inline editor */}
          {quickAction === 'calories' && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-blue-700 font-semibold">調整每日總熱量目標（kcal）</p>
                <button onClick={() => setQuickAction(null)} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCaloriesDraft(prev => Math.max(1000, (prev || 2000) - 100))}
                  className="px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-100"
                >−100</button>
                <button
                  onClick={() => setCaloriesDraft(prev => Math.max(1000, (prev || 2000) - 50))}
                  className="px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-100"
                >−50</button>
                <input
                  type="number"
                  value={caloriesDraft ?? ''}
                  onChange={e => setCaloriesDraft(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="例如 2000"
                />
                <button
                  onClick={() => setCaloriesDraft(prev => Math.min(5000, (prev || 2000) + 50))}
                  className="px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-100"
                >+50</button>
                <button
                  onClick={() => setCaloriesDraft(prev => Math.min(5000, (prev || 2000) + 100))}
                  className="px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-100"
                >+100</button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-gray-500">
                  目前：{client?.calories_target || '—'} kcal
                  {caloriesDraft && client?.calories_target && (
                    <span className={`ml-2 font-semibold ${
                      caloriesDraft - parseInt(client.calories_target) > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      ({caloriesDraft - parseInt(client.calories_target) > 0 ? '+' : ''}{caloriesDraft - parseInt(client.calories_target)})
                    </span>
                  )}
                </p>
                <button
                  disabled={quickSaving || !caloriesDraft || caloriesDraft < 1000 || caloriesDraft > 5000}
                  onClick={() => saveQuickAction({ calories_target: String(caloriesDraft) }, `熱量改為 ${caloriesDraft} kcal`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {quickSaving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          )}

          {/* 切 prep_phase inline editor */}
          {quickAction === 'phase' && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-700 font-semibold">切換訓練階段（prep_phase）</p>
                <button onClick={() => setQuickAction(null)} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {(client?.client_mode === 'athletic' ? ATHLETIC_PHASE_OPTIONS : BODYBUILDING_PHASE_OPTIONS).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPhaseDraft(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      phaseDraft === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-500">
                  目前：{PHASE_LABELS[client?.prep_phase || ''] || client?.prep_phase || '—'}
                </p>
                <button
                  disabled={quickSaving || !phaseDraft || phaseDraft === client?.prep_phase}
                  onClick={() => saveQuickAction({ prep_phase: phaseDraft }, `階段改為 ${PHASE_LABELS[phaseDraft] || phaseDraft}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {quickSaving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          )}

          {/* 加 coach_weekly_note inline editor */}
          {quickAction === 'note' && (
            <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-amber-800 font-semibold">本週教練備註</p>
                <button onClick={() => setQuickAction(null)} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
              </div>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="例：本週 HRV 偏低，建議降強度 20%；下週起改成減脂期收 200kcal"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-gray-500">
                  {noteDraft.length} / 500 字
                </p>
                <button
                  disabled={quickSaving || noteDraft.length > 500 || noteDraft === (client?.coach_weekly_note || '')}
                  onClick={() => saveQuickAction({ coach_weekly_note: noteDraft || null }, '教練備註已更新')}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {quickSaving ? '儲存中...' : '儲存'}
                </button>
              </div>
              {client?.coach_weekly_note && noteDraft !== client.coach_weekly_note && (
                <p className="text-[11px] text-gray-500 mt-2 italic">
                  原備註：「{client.coach_weekly_note}」
                </p>
              )}
            </div>
          )}
        </div>

        {/* ===== AI 教練建議 ===== */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">本週建議調整</h3>
            </div>
            <button
              onClick={fetchCoachSummary}
              disabled={summaryLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                summaryLoading
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {summaryLoading ? '生成中...' : coachSummary ? '重新生成' : '生成教練建議'}
            </button>
          </div>

          {summaryLoading && (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-700">AI 正在分析學員數據...</p>
            </div>
          )}

          {!summaryLoading && coachSummary && (
            <div className="bg-white/70 rounded-xl p-4">
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{coachSummary}</div>
            </div>
          )}

          {!summaryLoading && !coachSummary && (
            <p className="text-xs text-slate-600">點擊「生成教練建議」，AI 將根據近 14 天數據產出具體建議。</p>
          )}
        </div>

        {/* ===== 本週報告 ===== */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-900">{dateRange === '7' ? '本週' : `近 ${dateRange} 天`}報告</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">{weeklyReport.weekLabel}</span>
              <button
                onClick={() => {
                  const text = `📋 ${client.name} 週報（${weeklyReport.weekLabel}）\n\n${weeklyReport.summary}`
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? '已複製' : '複製文字'}
              </button>
              <button
                onClick={() => {
                  const text = generateTrainingSummary()
                  navigator.clipboard.writeText(text).then(() => {
                    setCopiedTraining(true)
                    setTimeout(() => setCopiedTraining(false), 2000)
                  })
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  copiedTraining ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copiedTraining ? '已複製' : '訓練端摘要'}
              </button>
              <button
                onClick={() => {
                  const text = generateAiFullSummary()
                  navigator.clipboard.writeText(text).then(() => {
                    setCopiedAi(true)
                    setTimeout(() => setCopiedAi(false), 2000)
                  })
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  copiedAi ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copiedAi ? '已複製' : 'AI 完整摘要'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {client.training_enabled && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">訓練天數</p>
                <p className="text-2xl font-bold tabular-nums text-blue-700">{weeklyReport.trainingDays}</p>
                {weeklyReport.avgRpe && <p className="text-xs text-gray-400">RPE {weeklyReport.avgRpe}</p>}
              </div>
            )}
            {client.wellness_enabled && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">精力</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {weeklyReport.avgEnergy != null ? weeklyReport.avgEnergy.toFixed(1) : '--'}
                </p>
                {weeklyReport.energyArrow && <p className="text-xs text-gray-400">vs 上週{weeklyReport.energyArrow}</p>}
              </div>
            )}
            {client.supplement_enabled && weeklyReport.weekSuppRate != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">補品服從</p>
                <p className={`text-2xl font-bold tabular-nums ${weeklyReport.weekSuppRate >= 80 ? 'text-emerald-600' : weeklyReport.weekSuppRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {weeklyReport.weekSuppRate}%
                </p>
                {weeklyReport.lastWeekSuppRate != null && (
                  <p className="text-xs text-gray-400">上週 {weeklyReport.lastWeekSuppRate}%</p>
                )}
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.weekNutRate != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">飲食合規</p>
                <p className={`text-2xl font-bold tabular-nums ${weeklyReport.weekNutRate >= 80 ? 'text-emerald-600' : weeklyReport.weekNutRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {weeklyReport.weekNutRate}%
                </p>
                {weeklyReport.lastWeekNutRate != null && (
                  <p className="text-xs text-gray-400">上週 {weeklyReport.lastWeekNutRate}%</p>
                )}
              </div>
            )}
            {client.body_composition_enabled && weeklyReport.weightDelta != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">體重變化</p>
                <p className={`text-2xl font-bold tabular-nums ${Number(weeklyReport.weightDelta) > 0 ? 'text-rose-600' : Number(weeklyReport.weightDelta) < 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                  {Number(weeklyReport.weightDelta) > 0 ? '+' : ''}{weeklyReport.weightDelta}
                </p>
                <p className="text-xs text-gray-400">kg</p>
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.avgProtein != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均蛋白質</p>
                <p className={`text-2xl font-bold tabular-nums ${client.protein_target && weeklyReport.avgProtein >= client.protein_target ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {weeklyReport.avgProtein}g
                </p>
                {client.protein_target && <p className="text-xs text-gray-400">目標 {client.protein_target}g</p>}
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.avgWater != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均飲水</p>
                <p className={`text-2xl font-bold tabular-nums ${client.water_target && weeklyReport.avgWater >= client.water_target ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {weeklyReport.avgWater}ml
                </p>
                {client.water_target && <p className="text-xs text-gray-400">目標 {client.water_target}ml</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgCalories != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均熱量</p>
                <p className={`text-2xl font-bold tabular-nums ${client.calories_target && weeklyReport.avgCalories >= client.calories_target * 0.9 && weeklyReport.avgCalories <= client.calories_target * 1.1 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {weeklyReport.avgCalories}
                </p>
                {client.calories_target && <p className="text-xs text-gray-400">目標 {client.calories_target}kcal</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgCarbs != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均碳水</p>
                <p className={`text-2xl font-bold tabular-nums ${client.carbs_target && weeklyReport.avgCarbs >= client.carbs_target * 0.9 && weeklyReport.avgCarbs <= client.carbs_target * 1.1 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {weeklyReport.avgCarbs}g
                </p>
                {client.carbs_target && <p className="text-xs text-gray-400">目標 {client.carbs_target}g</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgFat != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均脂肪</p>
                <p className={`text-2xl font-bold tabular-nums ${client.fat_target && weeklyReport.avgFat >= client.fat_target * 0.9 && weeklyReport.avgFat <= client.fat_target * 1.1 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {weeklyReport.avgFat}g
                </p>
                {client.fat_target && <p className="text-xs text-gray-400">目標 {client.fat_target}g</p>}
              </div>
            )}
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{weeklyReport.summary}</p>
          </div>
        </div>

        {/* ===== 營養分析引擎 ===== */}
        {suggestion && suggestion.status !== 'insufficient_data' && (
          <div className={`rounded-2xl p-5 border ${
            isCompetitionMode(client.client_mode) ? 'bg-slate-50 border-slate-200' :
            suggestion.status === 'on_track' ? 'bg-emerald-50 border-emerald-200' :
            suggestion.status === 'low_compliance' ? 'bg-gray-50 border-gray-200' :
            suggestion.status === 'too_fast' || suggestion.status === 'wrong_direction' ? 'bg-rose-50 border-rose-200' :
            'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{suggestion.statusEmoji}</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">營養分析引擎{isCompetitionMode(client.client_mode) ? ' · 僅供對照' : ''}</h3>
                  <p className="text-xs text-gray-500">
                    {suggestionMeta?.goalType === 'cut' ? '減脂模式' : '增肌模式'}
                    {suggestion.weeklyWeightChangeRate != null && ` · 週變化 ${suggestion.weeklyWeightChangeRate > 0 ? '+' : ''}${suggestion.weeklyWeightChangeRate.toFixed(2)}%`}
                    {suggestion.estimatedTDEE && ` · 估算 TDEE ${suggestion.estimatedTDEE} kcal`}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                isCompetitionMode(client.client_mode) ? 'bg-slate-100 text-slate-500' :
                suggestion.status === 'on_track' ? 'bg-emerald-100 text-emerald-700' :
                suggestion.status === 'low_compliance' ? 'bg-gray-100 text-gray-600' :
                suggestion.status === 'plateau' ? 'bg-amber-100 text-amber-700' :
                suggestion.status === 'peak_week' || suggestion.status === 'athletic_competition' ? 'bg-amber-100 text-amber-700' :
                suggestion.status === 'athletic_rebound' ? 'bg-amber-100 text-amber-700' :
                suggestion.status === 'athletic_weigh_in' ? 'bg-amber-100 text-amber-700' :
                'bg-rose-100 text-rose-700'
              }`}>{isCompetitionMode(client.client_mode) ? '僅供對照' : suggestion.statusLabel}</span>
            </div>

            <p className="text-sm text-gray-700 mb-4">{suggestion.message}</p>

            {/* 參考調整表 */}
            {suggestion.status !== 'low_compliance' && !(suggestion.status === 'on_track' && !suggestion.autoApply) && (
              <div className="bg-white/70 rounded-xl p-4 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">參考調整：</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {suggestion.suggestedCalories != null && (
                    <div className="text-center">
                      <p className="text-[11px] text-gray-500">熱量</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedCalories}</p>
                      <p className={`text-xs font-medium ${suggestion.caloriesDelta > 0 ? 'text-emerald-600' : suggestion.caloriesDelta < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {suggestion.caloriesDelta > 0 ? '+' : ''}{suggestion.caloriesDelta} kcal
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedProtein != null && (
                    <div className="text-center">
                      <p className="text-[11px] text-gray-500">蛋白質</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedProtein}g</p>
                      <p className={`text-xs font-medium ${suggestion.proteinDelta > 0 ? 'text-emerald-600' : suggestion.proteinDelta < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {suggestion.proteinDelta === 0 ? '維持' : `${suggestion.proteinDelta > 0 ? '+' : ''}${suggestion.proteinDelta}g`}
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedCarbs != null && (
                    <div className="text-center">
                      <p className="text-[11px] text-gray-500">碳水</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedCarbs}g</p>
                      <p className={`text-xs font-medium ${suggestion.carbsDelta > 0 ? 'text-emerald-600' : suggestion.carbsDelta < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {suggestion.carbsDelta > 0 ? '+' : ''}{suggestion.carbsDelta}g
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedFat != null && (
                    <div className="text-center">
                      <p className="text-[11px] text-gray-500">脂肪</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedFat}g</p>
                      <p className={`text-xs font-medium ${suggestion.fatDelta > 0 ? 'text-emerald-600' : suggestion.fatDelta < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {suggestion.fatDelta === 0 ? '維持' : `${suggestion.fatDelta > 0 ? '+' : ''}${suggestion.fatDelta}g`}
                      </p>
                    </div>
                  )}
                </div>
                {/* 碳循環分配 */}
                {suggestion.suggestedCarbsTrainingDay != null && suggestion.suggestedCarbsRestDay != null && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[11px] text-gray-500 mb-1">碳循環分配</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-slate-600">訓練日：{suggestion.suggestedCarbsTrainingDay}g</span>
                      <span className="text-gray-500">休息日：{suggestion.suggestedCarbsRestDay}g</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 警告 */}
            {suggestion.warnings?.length > 0 && (
              <div className="bg-white/50 rounded-lg px-3 py-2 mb-3">
                {suggestion.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-xs text-amber-700">{w}</p>
                ))}
              </div>
            )}

            {/* 操作按鈕（比賽模式不給套用，避免跟下方比賽引擎打架 → 一鍵套用會把備賽吃爆） */}
            {!isCompetitionMode(client.client_mode) && suggestion.status !== 'low_compliance' && !(suggestion.status === 'on_track' && !suggestion.autoApply) && (
              <div className="flex gap-2">
                <button
                  onClick={applySuggestion}
                  disabled={applyingsuggestion || suggestionApplied}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    suggestionApplied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  }`}
                >
                  {suggestionApplied ? '已套用' : applyingsuggestion ? '套用中...' : '一鍵套用'}
                </button>
                <Link
                  href={`/admin/clients/${clientId}`}
                  className="flex-1 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-medium text-center hover:bg-slate-50 transition-colors border border-slate-200"
                >
                  手動微調
                </Link>
              </div>
            )}
            {isCompetitionMode(client.client_mode) && (
              <div className="bg-white/60 border border-slate-200 rounded-lg px-3 py-2 text-xs text-gray-500 leading-snug">
                比賽模式：實際營養素由下方「動態調整建議（比賽引擎 trajectory）」為準，此卡數字僅供對照、不提供套用。
              </div>
            )}

            {/* 資料來源 */}
            {suggestionMeta && (
              <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                <span>體重：{suggestionMeta.latestWeight}kg</span>
                <span>合規率：{suggestionMeta.nutritionCompliance}%</span>
                {suggestionMeta.avgDailyCalories && <span>均攝取：{suggestionMeta.avgDailyCalories}kcal</span>}
                <span>訓練：{suggestionMeta.trainingDaysPerWeek}天/週</span>
                {suggestion.dietDurationWeeks != null && <span>已執行：{suggestion.dietDurationWeeks}週</span>}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">以上數據由系統根據體重趨勢自動運算，僅供教練參考，不構成營養指導。最終調整請依教練專業判斷。</p>
          </div>
        )}

        {/* ===== 深度圖表（收合）：營養・感受・補品 ===== */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-900 px-1 py-2 select-none">營養・感受・補品 圖表（點開）</summary>
          <div className="space-y-6 mt-2">

        {/* ===== 第一排圖表：補品 + 感受 ===== */}
        {(client.supplement_enabled || client.wellness_enabled) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 補品服從率趨勢 */}
            {client.supplement_enabled && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">補品服從率趨勢</h3>
                {complianceTrend.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={200} minWidth={0}>
                    <LineChart data={complianceTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip formatter={(v: any) => [`${v}%`, '服從率']} />
                      <Line type="monotone" dataKey="服從率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">資料不足</div>
                )}
              </div>
            )}

            {/* 感受趨勢 */}
            {client.wellness_enabled && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">感受趨勢</h3>
                {wellnessTrend.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={200} minWidth={0}>
                    <LineChart data={wellnessTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="睡眠" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="精力" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="心情" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">資料不足</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 飲食合規趨勢 ===== */}
        {client.nutrition_enabled && nutritionTrend.length >= 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">飲食合規趨勢（週）</h3>
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <BarChart data={nutritionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip formatter={(v: any) => [`${v}%`, '飲食合規率']} />
                <Bar dataKey="飲食合規率" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== 蛋白質/水量趨勢 ===== */}
        {client.nutrition_enabled && proteinWaterTrend.length >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {proteinWaterTrend.some(d => d.蛋白質 != null) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">蛋白質攝取趨勢</h3>
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <BarChart data={proteinWaterTrend.filter(d => d.蛋白質 != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => [`${v}g`, '蛋白質']} />
                    {client.protein_target && (
                      <Line type="monotone" dataKey={() => client.protein_target} stroke="#ef4444" strokeDasharray="5 5" dot={false} name="目標" />
                    )}
                    <Bar dataKey="蛋白質" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {client.protein_target && (
                  <p className="text-xs text-gray-400 mt-1 text-center">目標：{client.protein_target}g / 天</p>
                )}
              </div>
            )}
            {proteinWaterTrend.some(d => d.飲水量 != null) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">飲水量趨勢</h3>
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <BarChart data={proteinWaterTrend.filter(d => d.飲水量 != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => [`${v}ml`, '飲水量']} />
                    <Bar dataKey="飲水量" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {client.water_target && (
                  <p className="text-xs text-gray-400 mt-1 text-center">目標：{client.water_target}ml / 天</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 備賽巨量營養素趨勢 ===== */}
        {isCompetitionMode(client.client_mode) && (macroTrend.calories.length >= 2 || macroTrend.carbs.length >= 2 || macroTrend.fat.length >= 2) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">備賽巨量營養素趨勢</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {macroTrend.calories.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">熱量 (kcal)</p>
                  <ResponsiveContainer width="100%" height={160} minWidth={0}>
                    <LineChart data={macroTrend.calories}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v} kcal`, '熱量']} />
                      <Line type="monotone" dataKey="熱量" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.calories_target && <p className="text-xs text-gray-400 text-center">目標：{client.calories_target} kcal</p>}
                </div>
              )}
              {macroTrend.carbs.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">碳水 (g)</p>
                  <ResponsiveContainer width="100%" height={160} minWidth={0}>
                    <LineChart data={macroTrend.carbs}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v}g`, '碳水']} />
                      <Line type="monotone" dataKey="碳水" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.carbs_target && <p className="text-xs text-gray-400 text-center">目標：{client.carbs_target}g</p>}
                </div>
              )}
              {macroTrend.fat.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">脂肪 (g)</p>
                  <ResponsiveContainer width="100%" height={160} minWidth={0}>
                    <LineChart data={macroTrend.fat}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v}g`, '脂肪']} />
                      <Line type="monotone" dataKey="脂肪" stroke="#eab308" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.fat_target && <p className="text-xs text-gray-400 text-center">目標：{client.fat_target}g</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 巨量營養素偏差報告 ===== */}
        {macroDeviation && macroDeviation.dailyData.length >= 3 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">巨量營養素偏差報告</h3>
            <p className="text-xs text-gray-400 mb-4">近 14 天每日攝取 vs 目標的偏差百分比，綠色 = ±10% 以內</p>

            {/* 偏差摘要卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {macroDeviation.avgCalDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgCalDev) <= 10 ? 'bg-emerald-50' : Math.abs(macroDeviation.avgCalDev) <= 20 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">熱量偏差</p>
                  <p className={`text-xl font-bold tabular-nums ${Math.abs(macroDeviation.avgCalDev) <= 10 ? 'text-emerald-600' : Math.abs(macroDeviation.avgCalDev) <= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {macroDeviation.avgCalDev > 0 ? '+' : ''}{macroDeviation.avgCalDev}%
                  </p>
                  <p className="text-[11px] text-gray-400">{macroDeviation.calOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgProDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgProDev) <= 10 ? 'bg-emerald-50' : Math.abs(macroDeviation.avgProDev) <= 20 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">蛋白質偏差</p>
                  <p className={`text-xl font-bold tabular-nums ${Math.abs(macroDeviation.avgProDev) <= 10 ? 'text-emerald-600' : Math.abs(macroDeviation.avgProDev) <= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {macroDeviation.avgProDev > 0 ? '+' : ''}{macroDeviation.avgProDev}%
                  </p>
                  <p className="text-[11px] text-gray-400">{macroDeviation.proOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgCarbDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgCarbDev) <= 10 ? 'bg-emerald-50' : Math.abs(macroDeviation.avgCarbDev) <= 20 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">碳水偏差</p>
                  <p className={`text-xl font-bold tabular-nums ${Math.abs(macroDeviation.avgCarbDev) <= 10 ? 'text-emerald-600' : Math.abs(macroDeviation.avgCarbDev) <= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {macroDeviation.avgCarbDev > 0 ? '+' : ''}{macroDeviation.avgCarbDev}%
                  </p>
                  <p className="text-[11px] text-gray-400">{macroDeviation.carbOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgFatDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgFatDev) <= 10 ? 'bg-emerald-50' : Math.abs(macroDeviation.avgFatDev) <= 20 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">脂肪偏差</p>
                  <p className={`text-xl font-bold tabular-nums ${Math.abs(macroDeviation.avgFatDev) <= 10 ? 'text-emerald-600' : Math.abs(macroDeviation.avgFatDev) <= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {macroDeviation.avgFatDev > 0 ? '+' : ''}{macroDeviation.avgFatDev}%
                  </p>
                  <p className="text-[11px] text-gray-400">{macroDeviation.fatOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
            </div>

            {/* 偏差柱狀圖 — 熱量 */}
            {macroDeviation.dailyData.some((d: any) => d.calDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">每日熱量偏差 (%)（目標 {client.calories_target} kcal）</p>
                <ResponsiveContainer width="100%" height={140} minWidth={0}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.calDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.calories} kcal）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="calDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.calDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.calDev) <= 10 ? '#22c55e' : Math.abs(entry.calDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 蛋白質 */}
            {macroDeviation.dailyData.some((d: any) => d.proDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">每日蛋白質偏差 (%)（目標 {client.protein_target}g）</p>
                <ResponsiveContainer width="100%" height={140} minWidth={0}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.proDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.protein}g）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="proDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.proDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.proDev) <= 10 ? '#22c55e' : Math.abs(entry.proDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 碳水 */}
            {macroDeviation.dailyData.some((d: any) => d.carbDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  每日碳水偏差 (%)
                  {client.carbs_training_day && client.carbs_rest_day
                    ? `（訓練日 ${client.carbs_training_day}g / 休息日 ${client.carbs_rest_day}g）`
                    : `（目標 ${client.carbs_target}g）`
                  }
                </p>
                <ResponsiveContainer width="100%" height={140} minWidth={0}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.carbDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.carbs}g${props.payload.carbTarget ? ` / 目標${props.payload.carbTarget}g` : ''}${props.payload.isTrainingDay != null ? (props.payload.isTrainingDay ? ' 訓練日' : ' 休息日') : ''}）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="carbDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.carbDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.carbDev) <= 10 ? '#22c55e' : Math.abs(entry.carbDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 脂肪 */}
            {macroDeviation.dailyData.some((d: any) => d.fatDev != null) && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">每日脂肪偏差 (%)（目標 {client.fat_target}g）</p>
                <ResponsiveContainer width="100%" height={140} minWidth={0}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.fatDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.fat}g）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="fatDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.fatDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.fatDev) <= 10 ? '#22c55e' : Math.abs(entry.fatDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

          </div>
        </details>

        {/* ===== 深度圖表（收合）：訓練・身體 ===== */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-900 px-1 py-2 select-none">訓練・身體 圖表（點開）</summary>
          <div className="space-y-6 mt-2">

        {/* 動作進步追蹤（每動作推估 1RM/PR/停滯）— 與學員端同一引擎 */}
        {client.training_enabled && (trainingSets?.length ?? 0) > 0 && (
          <TrainingProgressCard sets={trainingSets} />
        )}

        {/* ===== 第二排：訓練日曆 + RPE + 訓練分佈 ===== */}
        {client.training_enabled && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 訓練日曆 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">訓練日曆（6 週）</h3>
              <div className="space-y-1">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                    <div key={d} className="text-center text-xs text-gray-400 font-medium">{d}</div>
                  ))}
                </div>
                {calendarWeeks.map((week, wi) => {
                  // Deload 偵測：該週所有有 RPE 的訓練都 ≤ 6.5
                  const weekLogs = week.filter(d => d.log && d.log.training_type !== 'rest' && d.log.rpe != null)
                  const isDeloadWeek = weekLogs.length >= 2 && weekLogs.every(d => d.log.rpe <= 6.5)
                  return (
                  <div key={wi} className="grid grid-cols-7 gap-1 relative">
                    {isDeloadWeek && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-600 bg-slate-100 px-1 py-0.5 rounded -rotate-90 origin-center whitespace-nowrap" style={{ transform: 'translateX(-100%) translateY(-50%) rotate(-90deg)' }}>DELOAD</div>
                    )}
                    {week.map(({ date, label, log, isToday, isFuture }) => (
                      <div
                        key={date}
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${
                          isToday ? 'ring-2 ring-blue-400' : ''
                        } ${
                          isFuture ? 'bg-gray-50 text-gray-300'
                            : isDeloadWeek && log ? 'bg-slate-100 border border-slate-200'
                            : log ? getTypeBgColor(log.training_type)
                            : 'bg-gray-50 text-gray-400'
                        }`}
                        title={log ? `${TRAINING_TYPES.find(t => t.value === log.training_type)?.label} ${log.duration ? log.duration + '分' : ''} ${log.rpe ? 'RPE' + log.rpe : ''}` : ''}
                      >
                        <span className="text-[11px] leading-none">{label}</span>
                        <span className="text-sm leading-none mt-0.5">{!isFuture && log ? getTypeEmoji(log.training_type) : ''}</span>
                      </div>
                    ))}
                  </div>
                  )
                })}
              </div>
            </div>

            {/* 訓練類型分佈 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">訓練分佈</h3>
              {trainingDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <BarChart data={trainingDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={40} />
                    <Tooltip />
                    <Bar dataKey="次數" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">無訓練資料</div>
              )}
            </div>
          </div>
        )}

        {/* RPE 趨勢 */}
        {client.training_enabled && rpeTrend.length >= 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">RPE 趨勢</h3>
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <LineChart data={rpeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} fontSize={11} />
                <Tooltip formatter={(v: any, _: any, props: any) => [`RPE ${v}（${props.payload.type}）`, '']} />
                <Line type="monotone" dataKey="RPE" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== 第三排：體組成趨勢 ===== */}
        {client.body_composition_enabled && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bodyTrend.weight.length >= 2 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">體重趨勢</h3>
              <ResponsiveContainer width="100%" height={200} minWidth={0}>
                <LineChart data={bodyTrend.weight}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="體重" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {bodyTrend.bodyFat.length >= 2 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">體脂趨勢</h3>
              <ResponsiveContainer width="100%" height={200} minWidth={0}>
                <LineChart data={bodyTrend.bodyFat}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="體脂" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>}

        {/* ===== 訓練 × 恢復分析 ===== */}
        {client.training_enabled && client.wellness_enabled && recoveryAnalysis.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">訓練 × 恢復分析</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs text-gray-500">訓練類型</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">次數</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">平均RPE</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">隔天精力</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">隔天睡眠</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">隔天心情</th>
                  </tr>
                </thead>
                <tbody>
                  {recoveryAnalysis.map((r, i) => {
                    const rpeColor = r.avgRpe !== '--' && Number(r.avgRpe) >= 9 ? 'bg-rose-100 text-rose-700'
                      : r.avgRpe !== '--' && Number(r.avgRpe) >= 7.5 ? 'bg-amber-100 text-amber-700'
                      : r.avgRpe !== '--' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                    const cellColor = (val: string) => val !== '--' && Number(val) >= 4 ? 'bg-emerald-100 text-emerald-700'
                      : val !== '--' && Number(val) >= 3 ? 'bg-amber-100 text-amber-700'
                      : val !== '--' ? 'bg-rose-100 text-rose-700'
                      : 'bg-gray-100 text-gray-500'
                    return (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="py-2 px-3 font-medium">{r.emoji} {r.type}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{r.count}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rpeColor}`}>{r.avgRpe}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cellColor(r.avgEnergy)}`}>{r.avgEnergy}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cellColor(r.avgSleep)}`}>{r.avgSleep}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cellColor(r.avgMood)}`}>{r.avgMood}</span>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== E1RM 趨勢（主項力量）===== */}
        {client.training_enabled && e1rmTrend.exercises.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">主項力量趨勢（E1RM）</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              {e1rmTrend.exercises.map((ex: string) => {
                const change = e1rmTrend.changes[ex]
                return (
                  <span key={ex} className="text-xs text-gray-600">
                    {ex}
                    {change && (
                      <span className={`ml-1 font-semibold ${change.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {change}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <LineChart data={e1rmTrend.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} domain={['auto', 'auto']} unit="kg" />
                <Tooltip formatter={(v: any) => [`${v} kg`, '']} />
                <Legend />
                {e1rmTrend.exercises.map((ex: string, i: number) => {
                  const colors: Record<string, string> = { '深蹲': '#3b82f6', '臥推': '#ef4444', '硬舉': '#22c55e', '肩推': '#f59e0b' }
                  const fallbackColors = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6']
                  const color = Object.entries(colors).find(([k]) => ex.includes(k))?.[1] || fallbackColors[i % fallbackColors.length]
                  return (
                    <Line
                      key={ex}
                      type="monotone"
                      dataKey={ex}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color }}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">Brzycki E1RM = weight x 36/(37-reps)，僅取 reps &le; 10 的組數</p>
          </div>
        )}

        {/* ===== 每週訓練量趨勢 ===== */}
        {client.training_enabled && weeklyTonnage.length >= 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">每週訓練量趨勢</h3>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <BarChart data={weeklyTonnage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} kg`, '訓練量']} />
                <Bar dataKey="訓練量" radius={[4, 4, 0, 0]}>
                  {weeklyTonnage.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.increased ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">訓練量 = 所有組數的 weight x reps 加總（綠色 = 較上週增加，紅色 = 減少）</p>
          </div>
        )}

        {/* ===== 每肌群週組數 ===== */}
        {client.training_enabled && muscleGroupSets.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">每肌群週組數</h3>
            <ResponsiveContainer width="100%" height={Math.max(180, muscleGroupSets.length * 36)} minWidth={0}>
              <BarChart data={muscleGroupSets} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="muscle" fontSize={12} width={45} />
                <Tooltip formatter={(v: any) => [`${v} 組`, '']} />
                <ReferenceLine x={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'MEV', position: 'top', fontSize: 10, fill: '#f59e0b' }} />
                <ReferenceLine x={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'MRV', position: 'top', fontSize: 10, fill: '#ef4444' }} />
                <Bar dataKey="組數" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">本週（週一至今）各肌群組數，MEV=最小有效量（10組）、MRV=最大恢復量（20組）</p>
          </div>
        )}

          </div>
        </details>

        {/* ===== 深度圖表（收合）：血檢（預設展開，Howard 主戰場）===== */}
        <details className="group" open>
          <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-900 px-1 py-2 select-none">血檢 圖表與建議</summary>
          <div className="space-y-6 mt-2">

        {/* ===== 血檢指標 ===== */}
        {client.lab_enabled && latestLabs.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">血檢指標（最新）</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {latestLabs.map((lab) => (
                <div key={lab.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{lab.test_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lab.status)}`}>
                      {lab.status === 'normal' ? '正常' : lab.status === 'attention' ? '注意' : '警示'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{lab.value} <span className="text-sm font-normal text-gray-500">{lab.unit}</span></p>
                  <p className="text-xs text-gray-400 mt-1">參考：{lab.reference_range} · {new Date(lab.date).toLocaleDateString('zh-TW')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 補品建議（依血檢）===== */}
        {supplementSuggestions.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">補品建議</h3>
              <span className="text-xs text-gray-400 ml-auto">依血檢數值與訓練狀態自動分析</span>
            </div>
            <div className="space-y-4">
              {supplementSuggestions.map((s, i) => (
                <div key={i} className={`rounded-xl border overflow-hidden ${
                  s.priority === 'high' ? 'border-rose-200' :
                  s.priority === 'medium' ? 'border-amber-200' :
                  'border-slate-200'
                }`}>
                  {/* 標題列 */}
                  <div className={`px-5 py-3 flex items-center gap-2 flex-wrap ${
                    s.priority === 'high' ? 'bg-rose-50' :
                    s.priority === 'medium' ? 'bg-amber-50' :
                    'bg-slate-50'
                  }`}>
                    <span className="text-base font-bold text-gray-900">{s.name}</span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                      s.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                      s.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.priority === 'high' ? '強烈建議' : s.priority === 'medium' ? '建議' : '可考慮'}</span>
                    <span className={`px-2.5 py-0.5 text-[11px] rounded-full ${
                      s.category === 'deficiency' ? 'bg-blue-100 text-blue-700' :
                      s.category === 'hormonal' ? 'bg-slate-100 text-slate-600' :
                      s.category === 'performance' ? 'bg-slate-100 text-slate-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>{
                      s.category === 'deficiency' ? '補充缺乏' :
                      s.category === 'hormonal' ? '荷爾蒙' :
                      s.category === 'performance' ? '運動表現' : '恢復'
                    }</span>
                  </div>

                  {/* 內容區 */}
                  <div className="px-5 py-4 bg-white space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{s.reason}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                        <p className="text-[11px] font-medium text-gray-400 mb-1">劑量</p>
                        <p className="text-sm font-medium text-gray-800">{s.dosage}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                        <p className="text-[11px] font-medium text-gray-400 mb-1">服用時機</p>
                        <p className="text-sm font-medium text-gray-800">{s.timing}</p>
                      </div>
                    </div>

                    {s.triggerTests.length > 0 && (
                      <p className="text-xs text-gray-400">觸發指標：{s.triggerTests.join('、')}</p>
                    )}
                    <p className="text-xs text-gray-400 italic">文獻：{s.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 血檢飲食建議 + 深度分析（與學員端同步）===== */}
        {client.lab_enabled && labResults.length > 0 && (
          <>
            <LabNutritionAdviceCard
              labResults={labResults}
              gender={(client.gender as '男性' | '女性') ?? undefined}
              goalType={client.goal_type as 'cut' | 'bulk' | null | undefined}
            />
            <LabInsightsCard
              mode="coach"
              labResults={labResults}
              gender={(client.gender as '男性' | '女性') ?? undefined}
              bodyFatPct={bodyData.length ? bodyData[bodyData.length - 1]?.body_fat ?? null : null}
            />
          </>
        )}

          </div>
        </details>

        {/* ===== 教練備註 ===== */}
        {client.coach_summary && (
          <div className="bg-blue-50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">教練備註</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{client.coach_summary}</p>
            {client.health_goals && (
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-blue-100">目標：{client.health_goals}</p>
            )}
          </div>
        )}

        {/* ===== 手機快速行動列（固定底部，桌機隱藏）===== */}
        <div className="h-20 sm:hidden" aria-hidden />
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex gap-2"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setShowCompose(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            發訊息
          </button>
          <button
            onClick={() => { openQuickAction('calories'); document.getElementById('coach-quick-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 text-sm font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
          >
            調整
          </button>
        </div>
      </div>

      {/* ===== 發訊息 compose modal ===== */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => !composeBusy && setShowCompose(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">發訊息給 {client.name}</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <textarea
              value={composeMsg}
              onChange={e => setComposeMsg(e.target.value)}
              rows={4}
              autoFocus
              placeholder="這週體重控制得不錯，碳水可以再加一點…"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <p className="text-xs text-gray-400 mb-3">學員打開 app 最上面就會看到這則訊息（有開推播會同時收到通知）。</p>
            <button
              onClick={sendCoachMessage}
              disabled={composeBusy || !composeMsg.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {composeBusy ? '送出中…' : '送出'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
