'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useClientData, type Client, type ClientDataPayload } from '@/hooks/useClientData'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useCoachMode } from '@/hooks/useCoachMode'
import { Lock, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import BottomNav from '@/components/client/BottomNav'
import CollapsibleSection from '@/components/client/CollapsibleSection'
import QuickActions from '@/components/client/QuickActions'
import UpgradeGate from '@/components/client/UpgradeGate'
import HealthOverview from '@/components/client/HealthOverview'
import RecoveryDashboard from '@/components/client/RecoveryDashboard'
import DailyCheckIn from '@/components/client/DailyCheckIn'
import DailyWellness from '@/components/client/DailyWellness'
import BodyComposition from '@/components/client/BodyComposition'
const LabResults = dynamic(() => import('@/components/client/LabResults'), { ssr: false })
const SupplementModal = dynamic(() => import('@/components/client/SupplementModal'), { ssr: false })
import WellnessTrend from '@/components/client/WellnessTrend'
const HealthReport = dynamic(() => import('@/components/client/HealthReport'), { ssr: false })
const TrainingLog = dynamic(() => import('@/components/client/TrainingLog'), { ssr: false })
import TodayWorkout from '@/components/client/TodayWorkout'
import { isWeightTraining } from '@/components/client/types'
import NutritionLog from '@/components/client/NutritionLog'
import DailyNutritionTarget from '@/components/client/DailyNutritionTarget'
import PeakWeekPlan from '@/components/client/PeakWeekPlan'
import PostCompetitionRecovery from '@/components/client/PostCompetitionRecovery'
import AthleticReboundTimeline from '@/components/client/AthleticReboundTimeline'
import GoalDrivenStatus from '@/components/client/GoalDrivenStatus'
import WeeklyInsight from '@/components/client/WeeklyInsight'
const SelfManagedNutrition = dynamic(() => import('@/components/client/SelfManagedNutrition'), { ssr: false })
const NutritionStrategyCard = dynamic(() => import('@/components/client/NutritionStrategyCard'), { ssr: false })
import PwaPrompt from '@/components/client/PwaPrompt'
import ClientHeader from '@/components/client/ClientHeader'
import HealthScoreBanner from '@/components/client/HealthScoreBanner'
import TodayOverviewCard from '@/components/client/TodayOverviewCard'
import DayBasedCards from '@/components/client/DayBasedCards'
import { calculateHealthScore } from '@/lib/health-score-engine'
import { isCompetitionMode, isHealthMode as isHealthModeHelper } from '@/lib/client-mode'

// Dynamic imports for code splitting (client-only components)
const AiChatDrawer = dynamic(() => import('@/components/client/AiChatDrawer'), { ssr: false })
const AiInsightsPanel = dynamic(() => import('@/components/client/AiInsightsPanel'), { ssr: false })
const GeneProfileCard = dynamic(() => import('@/components/client/GeneProfileCard'), { ssr: false })
const LabInsightsCard = dynamic(() => import('@/components/client/LabInsightsCard'), { ssr: false })
const LabNutritionAdviceCard = dynamic(() => import('@/components/client/LabNutritionAdviceCard'), { ssr: false })
const GoalSettings = dynamic(() => import('@/components/client/GoalSettings'), { ssr: false })
const HealthModeAdvanced = dynamic(() => import('@/components/client/HealthModeAdvanced'), { ssr: false })
const OnboardingGuide = dynamic(() => import('@/components/client/OnboardingGuide'), { ssr: false })
const OnboardingChecklist = dynamic(() => import('@/components/client/OnboardingChecklist'), { ssr: false })
const ReferralCard = dynamic(() => import('@/components/client/ReferralCard'), { ssr: false })
const FreeInsightTeaser = dynamic(() => import('@/components/client/FreeInsightTeaser'), { ssr: false })
const UpgradeTrigger = dynamic(() => import('@/components/client/UpgradeTrigger'), { ssr: false })
import { generateSupplementSuggestions, type GeneticProfile } from '@/lib/supplement-engine'
import type { NutritionSuggestion } from '@/lib/nutrition-engine'
import { getLocalDateStr, daysUntilDateTW, DAY_MS } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'
import { trackEvent } from '@/lib/analytics'
import ABTest from '@/components/ABTest'
import { trackConversion, peekVariant } from '@/lib/ab-testing'
import ErrorBoundary, { SectionErrorBoundary } from '@/components/ErrorBoundary'

export default function ClientDashboard() {
  const { clientId } = useParams()

  // LINE 內建瀏覽器記憶體不足會崩潰，偵測後提示用 Safari 開啟
  const [isLineBrowser, setIsLineBrowser] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && /Line/i.test(navigator.userAgent)) {
      setIsLineBrowser(true)
    }
  }, [])

  const { data: clientData, error, isLoading, mutate } = useClientData(clientId as string)

  // 儲存 clientId 到 localStorage + cookie，讓 PWA 從主畫面開啟時能跳轉到儀表板
  useEffect(() => {
    if (clientId && typeof window !== 'undefined') {
      localStorage.setItem('hp_client_id', clientId as string)
      // 同時設 cookie，讓 middleware 能讀取（localStorage 在 middleware 不可用）
      document.cookie = `hp_client_id=${encodeURIComponent(clientId as string)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
    }
  }, [clientId])

  const today = getLocalDateStr()

  // 日期導航
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

  // Peak Week 允許看明天的計畫
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return getLocalDateStr(d)
  })()

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = getLocalDateStr(d)
    // Peak Week / competition: 最多看到明天；一般模式: 最多到今天
    const isPeakWeek = isCompetitionMode(clientData?.client?.client_mode) &&
      (clientData?.client?.prep_phase === 'peak_week' || clientData?.client?.prep_phase === 'competition')
    const maxDate = isPeakWeek ? tomorrow : today
    if (newDate > maxDate) return
    setSelectedDate(newDate)
  }

  // 教練模式
  const {
    isCoachMode, showPinPopover, pinInput, pinError, pinLoading,
    coachHeaders, setShowPinPopover, setPinInput, handlePinSubmit, toggleCoachMode,
  } = useCoachMode()
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [togglingSupplements, setTogglingSupplements] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('')
  const [showCoachSummary, setShowCoachSummary] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)
  const [aiChatInitialPrompt, setAiChatInitialPrompt] = useState<string | undefined>()
  const [showPhaseSelector, setShowPhaseSelector] = useState(false)
  const [updatingPhase, setUpdatingPhase] = useState(false)
  const [showMoreAnalysis, setShowMoreAnalysis] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [checklistDismissed, setChecklistDismissed] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const { showToast } = useToast()

  // 監聽血檢「問 AI」按鈕的 custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.prompt) {
        setAiChatInitialPrompt(detail.prompt)
        setShowAiChat(true)
      }
    }
    window.addEventListener('open-ai-chat', handler)
    return () => window.removeEventListener('open-ai-chat', handler)
  }, [])

  // 滾動超過 600px 顯示「回到頂部」按鈕
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleFeature = async (key: string) => {
    if (!clientData?.client) return
    const newVal = !(clientData.client as Record<string, unknown>)[key]
    try {
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientData.client.unique_code, [key]: newVal })
      })
      if (!res.ok) throw new Error()
      mutate()
      showToast(newVal ? '已開啟' : '已關閉', 'success')
    } catch { showToast('切換失敗，請重試', 'error') }
  }

  const handleCancelSubscription = async () => {
    if (!clientData?.client) return
    setCancellingSubscription(true)
    try {
      const res = await fetch('/api/subscribe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientData.client.id, uniqueCode: clientData.client.unique_code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '取消失敗')
      showToast('已取消定期定額，帳號可使用至到期日', 'success')
      setShowCancelConfirm(false)
      setShowSettings(false)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '取消失敗，請重試', 'error')
    } finally {
      setCancellingSubscription(false)
    }
  }

  // Scroll-based bottom nav highlighting
  const sectionIds = useRef<string[]>([])
  useEffect(() => {
    const ids = [
      'section-body', 'section-nutrition', 'section-nutrition-general',
      'section-supplements', 'section-wellness', 'section-training', 'section-lab'
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )
    const elements = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [clientData])

  // 追蹤留存事件（從 render 移至 useEffect，避免每次 re-render 重複觸發）
  const trackedEventsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!clientData?.client?.created_at) return
    const daysSinceSignup = Math.floor((Date.now() - new Date(clientData.client.created_at).getTime()) / DAY_MS)
    const track = (event: string) => {
      if (!trackedEventsRef.current.has(event)) {
        trackedEventsRef.current.add(event)
        trackEvent(event)
      }
    }
    if (daysSinceSignup >= 3 && daysSinceSignup <= 4) track('user_day_3_active')
    if (daysSinceSignup >= 7 && daysSinceSignup <= 10) track('user_day_7_active')
    if (daysSinceSignup >= 14 && daysSinceSignup <= 21) {
      track('user_day_14_active')
      track('tdee_calibration_complete')
    }
  }, [clientData?.client?.created_at])

  // 共用的 optimistic SWR update：引擎寫入 DB 後，直接同步本地快取
  const mutateWithTargets = useCallback((appliedTargets?: Record<string, number | undefined>) => {
    if (appliedTargets) {
      mutate((prev: ClientDataPayload | undefined) => {
        if (!prev?.client) return prev
        const updates: Record<string, number> = {}
        for (const [k, v] of Object.entries(appliedTargets)) {
          if (v != null) updates[k] = v
        }
        return { ...prev, client: { ...prev.client, ...updates } }
      }, { revalidate: true })
    } else {
      mutate()
    }
  }, [mutate])

  const handleToggleSupplement = async (supplementId: string, currentCompleted: boolean) => {
    setTogglingSupplements(prev => new Set(prev).add(supplementId))
    try {
      const res = await fetch('/api/supplement-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, supplementId, date: selectedDate, completed: !currentCompleted })
      })
      if (!res.ok) throw new Error('打卡失敗')
      mutate()
    } catch { showToast('打卡失敗，請重試', 'error') }
    finally {
      setTogglingSupplements(prev => { const next = new Set(prev); next.delete(supplementId); return next })
    }
  }

  const handleMarkAllSupplementsComplete = async () => {
    const supplements = clientData?.client?.supplements || []
    const uncompleted = supplements.filter((s) => {
      const log = selectedDateLogs?.find((l: { supplement_id: string; completed?: boolean }) => l.supplement_id === s.id)
      return !log?.completed
    })
    if (uncompleted.length === 0) return
    // 把所有未完成的 supplement 加入 toggling 狀態
    setTogglingSupplements(prev => {
      const next = new Set(prev)
      uncompleted.forEach((s) => next.add(s.id))
      return next
    })
    try {
      const results = await Promise.all(uncompleted.map((s) =>
        fetch('/api/supplement-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, supplementId: s.id, date: selectedDate, completed: true })
        })
      ))
      if (results.some(r => !r.ok)) throw new Error('部分打卡失敗')
      mutate()
    } catch { showToast('打卡失敗，請重試', 'error') }
    finally {
      setTogglingSupplements(new Set())
    }
  }

  const handlePrepPhaseChange = async (newPhase: string) => {
    setUpdatingPhase(true)
    try {
      const res = await fetch('/api/prep-phase', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, prepPhase: newPhase })
      })
      if (!res.ok) throw new Error('更新失敗')
      mutate()
      setShowPhaseSelector(false)
      showToast('備賽階段已更新', 'success')
    } catch {
      showToast('更新失敗，請重試', 'error')
    } finally {
      setUpdatingPhase(false)
    }
  }

  // 設定下一場比賽日期（從 PostCompetitionRecovery 元件觸發）
  const handleSetNextCompetition = useCallback(async (date: string) => {
    try {
      // 1. 更新 competition_date
      const res = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, competition_date: date }),
      })
      if (!res.ok) throw new Error('更新比賽日期失敗')

      // 2. 切換 prep_phase 到 cut
      const res2 = await fetch('/api/prep-phase', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, prepPhase: 'cut' }),
      })
      if (!res2.ok) throw new Error('更新階段失敗')

      mutate()
      showToast('已設定新比賽日期，切換到減脂期', 'success')
    } catch {
      showToast('設定失敗，請重試', 'error')
    }
  }, [clientId, mutate, showToast])

  // 監聽 PostCompetitionRecovery 的 custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.date) {
        handleSetNextCompetition(detail.date)
      }
    }
    window.addEventListener('set-next-competition', handler)
    return () => window.removeEventListener('set-next-competition', handler)
  }, [handleSetNextCompetition])

  // 所有統計數據從 hook 取得
  const {
    todayWellness, todayTraining, todayNutrition,
    selectedDateLogs,
    latestBodyData, prevBodyData, latestByField, bmi,
    labStats, todaySupplementStats, supplementComplianceStats,
    bodyFatTrend, streakDays, streakMessage,
    overallStreak, todayCompletedItems,
    trendData, topSupplements,
  } = useDashboardStats(clientData, selectedDate, today)

  // AI Chat 用的體重/體脂趨勢（最近 14 天）
  const weightTrendForAi = useMemo(() => {
    if (!clientData?.bodyData?.length) return []
    return clientData.bodyData
      .filter((b) => b.weight != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((b) => ({ date: b.date, weight: b.weight as number }))
  }, [clientData?.bodyData])

  const bodyFatTrendForAi = useMemo(() => {
    if (!clientData?.bodyData?.length) return []
    return clientData.bodyData
      .filter((b) => b.body_fat != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((b) => ({ date: b.date, bodyFat: b.body_fat as number }))
  }, [clientData?.bodyData])

  // Upgrade trigger: weight entries + meals logged during plateau period
  const weightEntriesForTrigger = useMemo(() => {
    if (!clientData?.bodyData?.length) return []
    return clientData.bodyData
      .filter((b) => b.weight != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({ date: b.date, weight: b.weight as number }))
  }, [clientData?.bodyData])

  const upgradeTriggerDaysTracked = useMemo(() => {
    const dates = new Set<string>()
    ;(clientData?.bodyData || []).forEach((b) => dates.add(b.date))
    ;(clientData?.nutritionLogs || []).forEach((n) => { if (n.date) dates.add(n.date) })
    return dates.size
  }, [clientData?.bodyData, clientData?.nutritionLogs])

  const mealsLoggedDuringPlateau = useMemo(() => {
    if (!weightEntriesForTrigger.length || !clientData?.nutritionLogs?.length) return 0
    // Find earliest plateau date: walk backwards from last entry within 0.5kg
    const sorted = weightEntriesForTrigger
    if (sorted.length < 14) return 0
    const baseWeight = sorted[sorted.length - 1].weight
    let plateauStartDate = sorted[sorted.length - 1].date
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (Math.abs(sorted[i].weight - baseWeight) <= 0.5) {
        plateauStartDate = sorted[i].date
      } else {
        break
      }
    }
    // Count nutrition logs on or after plateauStartDate
    return clientData.nutritionLogs.filter(
      (n) => n.date && n.date >= plateauStartDate
    ).length
  }, [weightEntriesForTrigger, clientData?.nutritionLogs])

  // 訓練計畫 → 今天的 training_type 預設值
  const todayPlanType = useMemo(() => {
    const plan = clientData?.client?.training_plan
    if (!plan?.days?.length) return null
    const now = new Date()
    const taipeiStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    const taipeiDate = new Date(taipeiStr + 'T12:00:00')
    const jsDay = taipeiDate.getDay()
    const dow = jsDay === 0 ? 7 : jsDay
    const todayPlan = plan.days.find((d: any) => d.dayOfWeek === dow)
    if (!todayPlan) return 'rest'
    // 將課表 label 映射到 training_type
    const label = (todayPlan.label || '').toLowerCase()
    if (/upper|上肢/.test(label)) return 'upper_body'
    if (/lower|下肢/.test(label)) return 'legs'
    if (/push|推/.test(label)) return 'push'
    if (/pull|拉|背/.test(label)) return 'pull'
    if (/leg|腿/.test(label)) return 'legs'
    if (/chest|胸/.test(label)) return 'chest'
    if (/shoulder|肩/.test(label)) return 'shoulder'
    if (/arm|手臂|二頭|三頭/.test(label)) return 'arms'
    if (/full|全身/.test(label)) return 'full_body'
    if (/cardio|有氧|跑/.test(label)) return 'cardio'
    if (/rest|休息/.test(label)) return 'rest'
    return null
  }, [clientData?.client?.training_plan])

  // 生成補品建議（必須在所有條件 return 之前，遵守 React Hooks 規則）
  const supplementSuggestions = useMemo(() => {
    const c = clientData?.client
    if (!c) return []
    const healthMode = isHealthModeHelper(c.client_mode)
    const isCompetition = isCompetitionMode(c.client_mode)
    const hasGenetics = !!(c.gene_mthfr || c.gene_apoe || c.gene_depression_risk)
    if (!healthMode && !isCompetition) return []
    if (!healthMode && !hasGenetics) return []
    const recentTraining = (clientData.trainingLogs || []).slice(-7)
    const hasHighRPE = recentTraining.filter((t) => t.rpe != null && t.rpe >= 9).length >= 3
    return generateSupplementSuggestions(
      (c.lab_results || []).map((r) => ({
        test_name: r.test_name,
        value: r.value,
        unit: r.unit,
        status: r.status,
      })),
      {
        gender: c.gender as '男性' | '女性' | undefined,
        isHealthMode: healthMode,
        isCompetitionPrep: isCompetition,
        hasHighRPE,
        goalType: (c.goal_type as 'cut' | 'bulk' | null) || null,
        genetics: {
          mthfr: c.gene_mthfr as GeneticProfile['mthfr'],
          apoe: c.gene_apoe as GeneticProfile['apoe'],
          depressionRisk: c.gene_depression_risk as GeneticProfile['depressionRisk'],
        },
        prepPhase: (c.prep_phase as 'off_season' | 'bulk' | 'cut' | 'peak_week' | 'competition' | 'recovery' | 'preparation' | 'weigh_in' | 'rebound' | null) || null,
      }
    )
  }, [clientData?.client, clientData?.trainingLogs])

  // 基因修正提示（從基因欄位推導，用於營養目標旁顯示）
  const geneCorrections = useMemo(() => {
    const c = clientData?.client
    if (!c) return []
    const corrections: { gene: string; rule: string; adjustment: string }[] = []
    if (c.gene_mthfr === 'homozygous') {
      corrections.push({ gene: 'mthfr', rule: 'MTHFR 純合突變', adjustment: '因 MTHFR 純合突變，每日赤字已收窄 150 kcal' })
    } else if (c.gene_mthfr === 'heterozygous') {
      corrections.push({ gene: 'mthfr', rule: 'MTHFR 雜合突變', adjustment: '因 MTHFR 雜合突變，每日赤字已收窄 100 kcal' })
    }
    if (c.gene_depression_risk === 'SS' || c.gene_depression_risk === 'high') {
      corrections.push({ gene: 'depression', rule: '5-HTTLPR SS', adjustment: '因 5-HTTLPR SS 型，碳水下限提高至 120g' })
    } else if (c.gene_depression_risk === 'SL' || c.gene_depression_risk === 'moderate') {
      corrections.push({ gene: 'depression', rule: '5-HTTLPR SL', adjustment: '因 5-HTTLPR SL 型，碳水下限提高至 100g' })
    }
    if (c.gene_apoe === 'e4/e4') {
      corrections.push({ gene: 'apoe4', rule: 'APOE e4/e4', adjustment: '因 APOE e4/e4，飽和脂肪應 <7% 總熱量，優先 MUFA/MCT' })
    } else if (c.gene_apoe === 'e3/e4') {
      corrections.push({ gene: 'apoe4', rule: 'APOE e3/e4', adjustment: '因 APOE e3/e4，注意控制飽和脂肪比例' })
    }
    return corrections
  }, [clientData?.client])

  // 營養引擎分析結果（傳給 AI Chat 用）
  const [nutritionEngineSuggestion, setNutritionEngineSuggestion] = useState<NutritionSuggestion | null>(null)
  const [coachOverrideInfo, setCoachOverrideInfo] = useState<{
    expiresAt: string | null
    reason: string | null
    daysRemaining: number | null
    overrideValues: Record<string, number | null> | null
  } | null>(null)

  // 所有有營養追蹤的學員：頁面載入時自動觸發營養引擎更新目標
  // 備賽客戶由 GoalDrivenStatus 處理目標套用，但這裡仍需取得引擎數據給 AI Chat
  const autoNutritionTriggered = useRef(false)
  useEffect(() => {
    const c = clientData?.client
    if (!c || !c.nutrition_enabled || !c.goal_type) return
    if (autoNutritionTriggered.current) return
    autoNutritionTriggered.current = true

    const isComp = isCompetitionMode(c.client_mode)
    const triggerAutoAdjust = async () => {
      try {
        const code = clientId as string
        // 備賽客戶不 autoApply（由 GoalDrivenStatus 處理），但仍需取得完整引擎數據
        const res = await fetch(`/api/nutrition-suggestions?clientId=${code}${isComp ? '' : '&autoApply=true'}&code=${code}`)
        if (!res.ok) {
          console.error('[AutoNutrition] API 失敗:', res.status)
          return
        }
        const json = await res.json()
        if (json.suggestion) setNutritionEngineSuggestion(json.suggestion)
        if (json.coachOverrideInfo) setCoachOverrideInfo(json.coachOverrideInfo)
        console.log('[AutoNutrition] 引擎結果:', {
          status: json.suggestion?.status,
          autoApply: json.suggestion?.autoApply,
          applied: json.applied,
          coachLocked: json.coachLocked,
          suggestedCalories: json.suggestion?.suggestedCalories,
          suggestedProtein: json.suggestion?.suggestedProtein,
          suggestedCarbs: json.suggestion?.suggestedCarbs,
          suggestedFat: json.suggestion?.suggestedFat,
        })
        // 非備賽客戶：刷新 SWR 確保 UI 顯示最新 DB 值
        if (!isComp && mutate) {
          mutate()
        }
      } catch (err) {
        console.error('[AutoNutrition] 錯誤:', err)
      }
    }
    triggerAutoAdjust()
  }, [clientData?.client, clientId, mutate])

  // LINE 瀏覽器：顯示引導頁面，不載入完整儀表板（避免記憶體崩潰）
  if (isLineBrowser) {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">請用 Safari 開啟</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            LINE 內建瀏覽器不支援完整功能。<br />
            請點下方按鈕用 Safari 開啟，體驗更順暢。
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors mb-3"
          >
            用 Safari 開啟
          </a>
          <button
            onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(url)
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            複製網址
          </button>
          <p className="text-xs text-gray-400 mt-4">
            開啟後建議「加入主畫面」，下次一鍵進入
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isSuspended = error.message.includes('暫停')
    const isExpired = error.message.includes('過期')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">{isSuspended ? '⛔' : isExpired ? '⏰' : '❌'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{isSuspended ? '帳號已暫停' : isExpired ? '帳號已過期' : '載入失敗'}</h1>
          <p className="text-gray-600 mb-4">{isSuspended ? '請聯繫你的教練重新啟用' : isExpired ? '你的方案已到期，續約後即可繼續使用。' : error.message}</p>
          {isExpired && (
            <div className="space-y-3 mt-4">
              <a href="/pay?tier=self_managed" className="block bg-[#2563eb] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm">
                續約自主管理版 NT$499/月
              </a>
              <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="block bg-[#06C755] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#05b04d] transition-colors text-sm">
                💬 加 LINE 聯繫 Howard
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!clientData?.client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">找不到學員資料</h1>
          <p className="text-gray-600">請確認網址是否正確</p>
        </div>
      </div>
    )
  }

  const c = clientData.client
  const isCompetition = isCompetitionMode(c.client_mode)
  const isHealthMode = isHealthModeHelper(c.client_mode)
  const isSelfManaged = c.subscription_tier === 'self_managed'
  const isFree = c.subscription_tier === 'free'

  // 健康模式：計算健康分數
  // HRV baseline：用 7 天前以前的所有 HRV 數據算長期平均
  const allWellness = clientData.wellness || []
  const hrvOlder = allWellness.slice(0, -7)
    .map((w: { hrv?: number | null }) => w.hrv)
    .filter((v: number | null | undefined): v is number => v != null)
  const hrvBaseline = hrvOlder.length >= 7
    ? hrvOlder.reduce((a: number, b: number) => a + b, 0) / hrvOlder.length
    : null
  const healthScore = isHealthMode ? calculateHealthScore({
    wellnessLast7: allWellness.slice(-7),
    nutritionLast7: (clientData.nutritionLogs || []).slice(-7),
    trainingLast7: (clientData.trainingLogs || []).slice(-7),
    supplementComplianceRate: supplementComplianceStats.weekRate / 100,
    labResults: c.lab_results || [],
    hrvBaseline,
    quarterlyStart: c.quarterly_cycle_start,
  }) : null

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24">

        {/* 訂閱狀態 Banner */}
        {c.expires_at && (() => {
          const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (c.subscription_tier === 'free') return null
          // 定期定額用戶：到期前不顯示續費按鈕（會自動扣款），只在到期後顯示重新訂閱
          if (daysLeft <= 0) {
            const renewUrl = `/pay?tier=${c.subscription_tier}&name=${encodeURIComponent(c.name)}`
            return (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-700">你的方案已到期</p>
                <p className="text-xs text-red-600 mt-1">重新訂閱後所有數據完整保留，不需重新設定。</p>
                <a href={renewUrl} className="inline-block mt-2 bg-red-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:bg-red-700 transition-colors">
                  重新訂閱
                </a>
              </div>
            )
          }
          if (daysLeft <= 7) {
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-blue-700">下次扣款日：{new Date(c.expires_at).toLocaleDateString('zh-TW')}</p>
                <p className="text-xs text-blue-600 mt-1">系統將自動續訂，無需手動操作。如需取消，請至右上角設定。</p>
              </div>
            )
          }
          return null
        })()}

        {/* LINE 綁定提示 Banner */}
        {!c.line_user_id && (
          <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">💬</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">用 LINE 記錄更快！</p>
                <p className="text-xs text-gray-600 mt-1">
                  綁定 LINE 後，傳訊息就能記體重、飲食、訓練，還會收到每日提醒和週報。
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Step 1</span>
                    <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="text-[#06C755] font-semibold hover:underline">
                      加入 LINE 好友
                    </a>
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Step 2</span>　傳送「<span className="font-mono bg-white px-1.5 py-0.5 rounded border text-gray-700">綁定 {c.unique_code}</span>」即完成
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 標題區 */}
        <div className="bg-white rounded-3xl shadow-sm p-5 mb-6">
          <ClientHeader
            client={c}
            isCoachMode={isCoachMode}
            selectedDate={selectedDate}
            isToday={isToday}
            today={today}
            tomorrow={tomorrow}
            isCompetition={isCompetition}
            isFree={isFree}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            showPinPopover={showPinPopover}
            pinInput={pinInput}
            pinError={pinError}
            setPinInput={setPinInput}
            handlePinSubmit={handlePinSubmit}
            onDateChange={changeDate}
            onDateSelect={setSelectedDate}
            onToggleCoachMode={toggleCoachMode}
            onToggleFeature={toggleFeature}
            showPhaseSelector={showPhaseSelector}
            setShowPhaseSelector={setShowPhaseSelector}
            updatingPhase={updatingPhase}
            onPrepPhaseChange={handlePrepPhaseChange}
            showCancelConfirm={showCancelConfirm}
            setShowCancelConfirm={setShowCancelConfirm}
            cancellingSubscription={cancellingSubscription}
            onCancelSubscription={handleCancelSubscription}
          />

          {isHealthMode && healthScore && <HealthScoreBanner healthScore={healthScore} />}

          {/* 健康模式進階功能：血檢飲食建議 + 季度對比 + 微營養素 */}
          {isHealthMode && (
            <HealthModeAdvanced clientId={c.id} code={c.unique_code} />
          )}

          {/* 賽後恢復提示：比賽日期已過但階段仍為 peak_week/competition */}
          {isCompetition && c.competition_date && (() => {
            const daysLeft = daysUntilDateTW(c.competition_date)
            // 比賽日當天(0)或之後(<0)，且還沒選擇下一步
            const needsRecoveryPrompt = daysLeft <= 0 && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition')
            if (!needsRecoveryPrompt) return null
            return (
              <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-5 mb-4">
                <div className="text-center mb-3">
                  <span className="text-3xl">🏆</span>
                  <h3 className="text-lg font-bold text-gray-900 mt-2">比賽結束了！辛苦了！</h3>
                  <p className="text-sm text-gray-500 mt-1">接下來你想怎麼做？</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handlePrepPhaseChange('recovery')}
                    disabled={updatingPhase}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-left px-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🧘</span>
                      <div>
                        <p className="text-sm font-bold">進入賽後恢復期</p>
                        <p className="text-xs font-normal opacity-80">2-4 週 reverse diet + 漸進恢復訓練</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const dateStr = prompt('下一場比賽日期（YYYY-MM-DD）')
                      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        handleSetNextCompetition(dateStr)
                      }
                    }}
                    disabled={updatingPhase}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-left px-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🎯</span>
                      <div>
                        <p className="text-sm font-bold">直接備下一場比賽</p>
                        <p className="text-xs font-normal opacity-80">設定日期，系統自動開始備賽倒數</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePrepPhaseChange('off_season')}
                    disabled={updatingPhase}
                    className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    先回到一般模式（增肌/減脂）
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Goal-Driven + Peak Week（備賽客戶）— moved up for competition mode */}
          {isCompetition && (() => {
            const compDaysLeft = c.competition_date ? daysUntilDateTW(c.competition_date) : null
            const showPeakWeek = compDaysLeft != null && compDaysLeft >= 0 && compDaysLeft <= 14 && latestBodyData?.weight
            return (
              <SectionErrorBoundary name="goal-driven">
                {(!showPeakWeek || compDaysLeft! > 7) && (
                  <GoalDrivenStatus
                    clientId={c.id}
                    code={c.unique_code}
                    isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
                    onMutate={mutateWithTargets}
                  />
                )}
                {/* 備賽模式：目標設定放在倒數旁邊，方便隨時調整 */}
                <div className="mb-3" data-section="goal-settings">
                  <GoalSettings
                    clientId={c.id}
                    uniqueCode={c.unique_code}
                    currentGoalType={c.goal_type}
                    currentTargetWeight={c.target_weight}
                    currentTargetBodyFat={(c.target_body_fat as number) ?? null}
                    currentTargetDate={c.target_date}
                    competitionEnabled={isCompetitionMode(c.client_mode)}
                    competitionDate={c.competition_date || null}
                    prepPhase={c.prep_phase || null}
                    latestWeight={latestBodyData?.weight || null}
                    latestBodyFat={latestBodyData?.body_fat || null}
                    onMutate={mutate}
                  />
                </div>
                {showPeakWeek && (
                  <PeakWeekPlan
                    clientId={c.id}
                    code={c.unique_code}
                    competitionDate={c.competition_date!}
                    bodyWeight={latestBodyData!.weight}
                    previewDate={selectedDate > today ? selectedDate : undefined}
                    onMutate={mutateWithTargets}
                    geneDepressionRisk={c.gene_depression_risk as string | null}
                  />
                )}
              </SectionErrorBoundary>
            )
          })()}

          {/* Athletic 超補償期時間軸（秤重 → 比賽） */}
          {c.client_mode === 'athletic' && c.prep_phase === 'rebound' && nutritionEngineSuggestion?.athleticRebound && latestBodyData && (
            <AthleticReboundTimeline
              gapHours={nutritionEngineSuggestion.athleticRebound.gapHours}
              strategy={nutritionEngineSuggestion.athleticRebound.strategy}
              waterPerHour={nutritionEngineSuggestion.athleticRebound.waterPerHour}
              bodyWeight={latestBodyData.weight}
            />
          )}

          {/* 賽後恢復期計畫卡片（備賽模式 recovery 階段） */}
          {isCompetition && c.prep_phase === 'recovery' && c.competition_date && (() => {
            const daysLeft = daysUntilDateTW(c.competition_date)
            // 比賽日當天算 Day 1，之後遞增
            const daysPostCompetition = daysLeft <= 0 ? Math.abs(daysLeft) + 1 : 0
            if (daysPostCompetition === 0) return null
            return (
              <PostCompetitionRecovery
                daysPostCompetition={daysPostCompetition}
                onSetNextCompetition={() => {
                  // 滾動到 GoalSettings 區域讓用戶設定
                  const goalSettings = document.querySelector('[data-section="goal-settings"]')
                  if (goalSettings) {
                    goalSettings.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              />
            )
          })()}

          {/* 身體數據記錄 — 最優先，每日量體重放最上面 */}
          {c.body_composition_enabled && (
            <SectionErrorBoundary name="body-composition">
            <CollapsibleSection
              id="section-body"
              icon="⚖️"
              title="身體數據"
              isCompleted={!!latestBodyData && latestBodyData.date === selectedDate}
              summaryLine={latestBodyData ? `體重 ${latestBodyData.weight ?? '--'} kg${latestBodyData.body_fat ? ` | 體脂 ${latestBodyData.body_fat}%` : ''}` : undefined}
              isToday={isToday}
            >
              <BodyComposition
                latestBodyData={latestBodyData}
                prevBodyData={prevBodyData}
                bmi={bmi}
                trendData={trendData}
                bodyData={clientData.bodyData || []}
                clientId={clientId as string}
                competitionEnabled={isCompetitionMode(clientData.client.client_mode)}
                targetWeight={clientData.client.target_weight}
                competitionDate={clientData.client.competition_date}
                simpleMode={clientData.client.simple_mode}
                goalType={clientData.client.goal_type}
                prepPhase={clientData.client.prep_phase}
                tier={c.subscription_tier || 'free'}
                caloriesTarget={c.calories_target}
                proteinTarget={c.protein_target}
                height={latestByField.height?.height ?? null}
                hasLineBinding={!!c.line_user_id}
                uniqueCode={c.unique_code}
                onMutate={mutateWithTargets}
              />
            </CollapsibleSection>
            </SectionErrorBoundary>
          )}

          {isToday && (
            <SectionErrorBoundary name="today-overview">
            <TodayOverviewCard
              overallStreak={overallStreak}
              todayCompletedItems={todayCompletedItems}
              isCompetition={isCompetition}
              targetWeight={c.target_weight}
              competitionDate={c.competition_date || null}
              prepPhase={c.prep_phase || null}
              gender={c.gender ?? null}
              latestBodyData={latestBodyData}
            />
            </SectionErrorBoundary>
          )}

          <DayBasedCards
            client={c}
            isFree={isFree}
            isSelfManaged={isSelfManaged}
            nutritionLogs={clientData.nutritionLogs || []}
            setShowAiChat={setShowAiChat}
          />

          {/* 教練資訊（合併：查看時間 + 週回饋 + 健康分析） */}
          {(c.coach_last_viewed_at || c.coach_weekly_note || c.coach_summary) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <span className="text-xs font-semibold text-amber-700">教練回饋</span>
                </div>
                {c.coach_last_viewed_at && (
                  <span className="text-[10px] text-gray-400">
                    ✓ {(() => {
                      const viewed = new Date(c.coach_last_viewed_at)
                      const now = new Date()
                      const diffH = Math.floor((now.getTime() - viewed.getTime()) / 3600000)
                      if (diffH < 1) return '剛剛查看'
                      if (diffH < 24) return `${diffH}小時前查看`
                      const diffD = Math.floor(diffH / 24)
                      if (diffD === 1) return '昨天查看'
                      if (diffD < 7) return `${diffD}天前查看`
                      return viewed.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) + '查看'
                    })()}
                  </span>
                )}
              </div>
              {c.coach_weekly_note && (
                <p className="text-sm text-gray-700 leading-relaxed mb-2">{c.coach_weekly_note}</p>
              )}
              {c.coach_summary && (
                <>
                  <button
                    onClick={() => setShowCoachSummary(!showCoachSummary)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ChevronDown size={12} className={`transition-transform ${showCoachSummary ? 'rotate-180' : ''}`} />
                    {showCoachSummary ? '收起健康分析' : '查看健康分析'}
                  </button>
                  {showCoachSummary && (
                    <div className="bg-white/60 rounded-xl p-3 mt-2">
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.coach_summary}</p>
                      {(c.next_checkup_date || c.health_goals) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-amber-200/50">
                          {c.next_checkup_date && <span className="text-xs text-blue-600">📅 下次回檢：{new Date(c.next_checkup_date).toLocaleDateString('zh-TW')}</span>}
                          {c.health_goals && <span className="text-xs text-blue-600">🎯 {c.health_goals}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 新手引導 — 免費用戶未設定營養目標時，直接顯示營養計算器 */}
          {(isFree || isSelfManaged) && !c.calories_target && c.body_composition_enabled ? (
            <SelfManagedNutrition
              clientId={c.id}
              uniqueCode={c.unique_code}
              goalType={c.goal_type || null}
              activityProfile={c.activity_profile || null}
              gender={c.gender || null}
              caloriesTarget={c.calories_target}
              proteinTarget={c.protein_target}
              carbsTarget={c.carbs_target}
              fatTarget={c.fat_target}
              targetWeight={c.target_weight || null}
              targetDate={c.target_date || null}
              isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
              latestWeight={latestBodyData?.weight || null}
              latestBodyFat={latestBodyData?.body_fat || null}
              clientHeight={null}
              onMutate={mutate}
            />
          ) : !latestBodyData && (!clientData.nutritionLogs || clientData.nutritionLogs.length === 0) ? (
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-5 border border-blue-100">
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">👋</div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">歡迎使用 Howard Protocol！</h2>
                <p className="text-xs text-gray-500">跟著以下步驟，開始你的健康追蹤旅程</p>
              </div>

              <div className="space-y-2.5">
                {c.body_composition_enabled && (
                  <button
                    onClick={() => document.getElementById('section-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl shrink-0">⚖️</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">步驟 1：記錄你的體重</p>
                      <p className="text-xs text-gray-500 mt-0.5">點擊下方「身體數據」區塊，輸入今天的體重</p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </button>
                )}

                {c.nutrition_enabled && (
                  <button
                    onClick={() => (document.getElementById('section-nutrition') || document.getElementById('section-nutrition-general'))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl shrink-0">🍽️</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">步驟 2：記錄你的飲食</p>
                      <p className="text-xs text-gray-500 mt-0.5">拍照或手動輸入，追蹤每天的營養攝取</p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </button>
                )}

                {c.ai_chat_enabled && (
                  <button
                    onClick={() => setShowAiChat(true)}
                    className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xl shrink-0">🤖</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">步驟 3：問 AI 顧問任何問題</p>
                      <p className="text-xs text-gray-500 mt-0.5">不知道吃什麼？告訴 AI 你剛吃了什麼，它幫你估算營養素</p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </button>
                )}

                <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl shrink-0">📊</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">持續追蹤，看見改變</p>
                    <p className="text-xs text-gray-500 mt-0.5">每天記錄，系統會自動分析你的趨勢和進步</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <SectionErrorBoundary name="health-overview">
            <HealthOverview
              weekRate={supplementComplianceStats.weekRate}
              monthRate={supplementComplianceStats.monthRate}
              weekDelta={supplementComplianceStats.weekDelta}
              labNormal={labStats.normal}
              labTotal={labStats.total}
              bodyFat={latestByField.body_fat?.body_fat ?? null}
              bodyFatTrend={bodyFatTrend}
              todayMood={todayWellness?.mood}
              hasWellness={!!todayWellness}
              supplementEnabled={c.supplement_enabled}
              labEnabled={!isCompetition && c.lab_enabled}
              bodyCompositionEnabled={c.body_composition_enabled}
              wellnessEnabled={c.wellness_enabled}
              competitionEnabled={isCompetition}
              todayCalories={todayNutrition?.calories}
              caloriesTarget={c.calories_target}
              wearable={todayWellness ? {
                device_recovery_score: todayWellness.device_recovery_score,
                resting_hr: todayWellness.resting_hr,
                hrv: todayWellness.hrv,
                wearable_sleep_score: todayWellness.wearable_sleep_score,
                respiratory_rate: todayWellness.respiratory_rate,
              } : null}
            />
            </SectionErrorBoundary>
          )}
        </div>

        {/* === Onboarding Checklist: persistent task checklist for new users (first 14 days) === */}
        {(() => {
          if (checklistDismissed) return null
          if (!c.created_at) return null
          const daysSinceCreation = Math.floor(
            (Date.now() - new Date(c.created_at).getTime()) / DAY_MS
          )
          if (daysSinceCreation > 14) return null
          const hasWeight = (clientData.bodyData || []).length > 0
          const hasNutrition = (clientData.nutritionLogs || []).length > 0
          const hasTraining = (clientData.trainingLogs || []).length > 0
          const hasWellness = (clientData.wellness || []).length > 0
          const hasLineBinding = !!c.line_user_id
          const trainingEnabled = !!c.training_enabled
          const wellnessEnabled = !!c.wellness_enabled
          // Build items to check if all are already complete
          const checkItems = [hasWeight, hasNutrition, hasLineBinding]
          if (trainingEnabled) checkItems.push(hasTraining)
          if (wellnessEnabled) checkItems.push(hasWellness)
          const allComplete = checkItems.every(Boolean)
          if (allComplete) return null
          return (
            <OnboardingChecklist
              clientId={clientId as string}
              clientName={c.name}
              tier={c.subscription_tier || 'free'}
              hasWeight={hasWeight}
              hasNutrition={hasNutrition}
              hasTraining={hasTraining}
              hasWellness={hasWellness}
              hasLineBinding={hasLineBinding}
              trainingEnabled={trainingEnabled}
              wellnessEnabled={wellnessEnabled}
              onDismiss={() => setChecklistDismissed(true)}
            />
          )
        })()}

        {/* === QuickActions: 未完成項目快速導航 === */}
        {isToday && (
          <QuickActions
            enabledSections={[
              ...(c.body_composition_enabled ? [{ id: 'section-body', icon: '⚖️', label: '記錄體重', completed: !!latestBodyData && latestBodyData.date === selectedDate }] : []),
              ...(c.nutrition_enabled ? [{ id: isCompetition ? 'section-nutrition' : 'section-nutrition-general', icon: '🥗', label: '記錄飲食', completed: !!todayNutrition }] : []),
              ...(c.supplement_enabled ? [{ id: 'section-supplements', icon: '💊', label: '補品打卡', completed: todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total }] : []),
              ...(c.wellness_enabled ? [{ id: 'section-wellness', icon: '😊', label: '記錄感受', completed: !!todayWellness }] : []),
              ...(c.training_enabled ? [{ id: 'section-training', icon: '🏋️', label: '記錄訓練', completed: !!todayTraining }] : []),
            ]}
            onNavigate={(sectionId) => {
              setActiveTab(sectionId)
              document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )}

        {/* 性別未設定提示 — 僅 free/self_managed 可自行設定，coached 由教練處理 */}
        {!c.gender && (isFree || isSelfManaged) && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-purple-800 mb-2">請設定你的生理性別</p>
            <p className="text-xs text-purple-600 mb-3">性別會影響蛋白質、脂肪建議量及荷爾蒙安全底線的計算。未設定時系統預設為男性參數。</p>
            <div className="grid grid-cols-2 gap-2">
              {(['男性', '女性'] as const).map(g => (
                <button
                  key={g}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/clients', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId: c.unique_code, gender: g })
                      })
                      if (!res.ok) throw new Error()
                      mutate()
                      showToast(`已設定為${g}`, 'success')
                    } catch { showToast('設定失敗，請重試', 'error') }
                  }}
                  className="py-2.5 rounded-xl text-sm font-semibold border-2 border-purple-200 bg-white text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  {g === '男性' ? '♂' : '♀'} {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* === DO section: 每日記錄（wrapped in CollapsibleSection） === */}
        {/* ================================================================ */}

        {/* 飲食目標 + 飲食紀錄 */}
        {c.nutrition_enabled && (
          <SectionErrorBoundary name="nutrition">
          <CollapsibleSection
            id={isCompetition ? 'section-nutrition' : 'section-nutrition-general'}
            icon="🥗"
            title="飲食紀錄"
            isCompleted={!!todayNutrition}
            summaryLine={todayNutrition ? `${todayNutrition.calories ? `${todayNutrition.calories} kcal` : ''}${c.calories_target ? ` / ${c.calories_target} kcal` : ''}${todayNutrition.compliant === true ? ' ✓ 合規' : todayNutrition.compliant === false ? ' ✗ 未合規' : ''}` : undefined}
            isToday={isToday}
          >
            {/* 教練覆寫提示 */}
            {coachOverrideInfo && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔒</span>
                  <span className="text-xs text-amber-700">
                    教練手動設定中{coachOverrideInfo.daysRemaining != null ? `（剩 ${coachOverrideInfo.daysRemaining} 天）` : ''}
                  </span>
                </div>
                {coachOverrideInfo.reason && (
                  <span className="text-[10px] text-amber-500">{coachOverrideInfo.reason}</span>
                )}
              </div>
            )}
            {/* 教練模式：顯示系統建議值 */}
            {isCoachMode && coachOverrideInfo && nutritionEngineSuggestion && (
              nutritionEngineSuggestion.suggestedCalories != null || nutritionEngineSuggestion.suggestedProtein != null
            ) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-2">
                <p className="text-[10px] text-blue-500">
                  系統建議：{nutritionEngineSuggestion.suggestedCalories?.toLocaleString() ?? '—'} kcal / P {nutritionEngineSuggestion.suggestedProtein ?? '—'}g / C {nutritionEngineSuggestion.suggestedCarbs ?? '—'}g / F {nutritionEngineSuggestion.suggestedFat ?? '—'}g
                </p>
              </div>
            )}
            {/* 飲食策略摘要卡片 */}
            <NutritionStrategyCard
              client={{
                goal_type: c.goal_type,
                calories_target: c.calories_target,
                protein_target: c.protein_target,
                carbs_target: c.carbs_target,
                fat_target: c.fat_target,
                carbs_training_day: c.carbs_training_day,
                carbs_rest_day: c.carbs_rest_day,
                gene_depression_risk: c.gene_depression_risk as string | null,
                subscription_tier: c.subscription_tier || 'free',
              }}
              labMacroModifiers={
                nutritionEngineSuggestion?.labMacroModifiers?.length
                  ? nutritionEngineSuggestion.labMacroModifiers.map((m: { nutrient: string; direction: string; reason: string }) => ({
                      nutrient: m.nutrient,
                      direction: m.direction,
                      reason: m.reason,
                    }))
                  : null
              }
              weeklyAdjustmentCount={0}
            />
            {/* 一般學員（非自主管理、非免費）的飲食目標卡片 */}
            {!isCompetition && !isSelfManaged && !isFree && (c.calories_target || c.protein_target || c.carbs_target || c.fat_target || c.carbs_training_day || c.carbs_rest_day) && (
              <DailyNutritionTarget
                caloriesTarget={c.calories_target}
                proteinTarget={c.protein_target}
                carbsTarget={c.carbs_target}
                fatTarget={c.fat_target}
                carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
                isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
                carbsTrainingDay={c.carbs_training_day}
                carbsRestDay={c.carbs_rest_day}
                geneticCorrections={geneCorrections}
              />
            )}
            <NutritionLog
              todayNutrition={todayNutrition}
              nutritionLogs={clientData.nutritionLogs || []}
              clientId={clientId as string}
              date={selectedDate}
              proteinTarget={c.protein_target}
              waterTarget={c.water_target}
              competitionEnabled={isCompetitionMode(c.client_mode)}
              carbsTarget={c.carbs_training_day && c.carbs_rest_day
                ? (todayTraining && isWeightTraining(todayTraining.training_type) ? c.carbs_training_day : c.carbs_rest_day)
                : c.carbs_target}
              carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
              isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
              carbsTrainingDay={c.carbs_training_day}
              carbsRestDay={c.carbs_rest_day}
              fatTarget={c.fat_target}
              caloriesTarget={c.calories_target}
              simpleMode={c.simple_mode}
              sodiumTarget={c.prep_phase === 'peak_week' ? c.sodium_target : null}
              onMutate={mutate}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* 補品打卡 */}
        {c.supplement_enabled && (
          <SectionErrorBoundary name="supplements">
          <CollapsibleSection
            id="section-supplements"
            icon="💊"
            title="補品打卡"
            isCompleted={todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total}
            summaryLine={todaySupplementStats.total > 0 ? `${todaySupplementStats.completed}/${todaySupplementStats.total} 已完成` : undefined}
            isToday={isToday}
          >
            <DailyCheckIn
              supplements={c.supplements || []}
              todayLogs={selectedDateLogs}
              todayStats={todaySupplementStats}
              streakDays={streakDays}
              streakMessage={streakMessage}
              isCoachMode={isCoachMode}
              togglingSupplements={togglingSupplements}
              recentLogs={clientData.recentLogs || []}
              selectedDate={selectedDate}
              onToggleSupplement={handleToggleSupplement}
              onMarkAllComplete={handleMarkAllSupplementsComplete}
              onManageSupplements={() => setShowSupplementModal(true)}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* 每日感受 */}
        {c.wellness_enabled && (
          <SectionErrorBoundary name="wellness">
          <CollapsibleSection
            id="section-wellness"
            icon="😊"
            title="每日感受"
            isCompleted={!!todayWellness}
            summaryLine={todayWellness ? `睡眠 ${todayWellness.sleep_quality ?? '--'}/5 | 精力 ${todayWellness.energy_level ?? '--'}/5 | 心情 ${todayWellness.mood ?? '--'}/5` : undefined}
            isToday={isToday}
          >
            <DailyWellness
              todayWellness={todayWellness}
              clientId={clientId as string}
              date={selectedDate}
              healthModeEnabled={isHealthModeHelper(clientData.client.client_mode)}
              gender={c.gender ?? undefined}
              onMutate={mutate}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* 今日訓練計畫（教練指導用戶 + 有訓練計畫） */}
        {c.training_enabled && c.training_plan && c.subscription_tier === 'coached' && (
          <SectionErrorBoundary name="today-workout">
          <TodayWorkout trainingPlan={c.training_plan} todayTrainingType={todayTraining?.training_type} />
          </SectionErrorBoundary>
        )}

        {/* 訓練紀錄 */}
        {c.training_enabled && (
          <SectionErrorBoundary name="training">
          <CollapsibleSection
            id="section-training"
            icon="🏋️"
            title="訓練紀錄"
            isCompleted={!!todayTraining}
            summaryLine={todayTraining ? `${todayTraining.training_type ? todayTraining.training_type : '訓練'}${todayTraining.rpe ? ` · RPE ${todayTraining.rpe}` : ''}` : undefined}
            isToday={isToday}
          >
            <TrainingLog
              todayTraining={todayTraining}
              trainingLogs={clientData.trainingLogs || []}
              wellness={clientData.wellness || []}
              clientId={clientId as string}
              date={selectedDate}
              onMutate={mutate}
              carbsTrainingDay={c.carbs_training_day}
              carbsRestDay={c.carbs_rest_day}
              simpleMode={c.simple_mode}
              todayPlanType={todayPlanType}
              tier={c.subscription_tier || 'free'}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* ================================================================ */}
        {/* === SEE section: 狀態與趨勢（唯讀分析） === */}
        {/* ================================================================ */}

        {/* 恢復評估儀表板 */}
        {c.wellness_enabled && (
          <SectionErrorBoundary name="recovery">
          <div className="mb-3">
            <RecoveryDashboard clientId={c.unique_code} />
          </div>
          </SectionErrorBoundary>
        )}

        {/* 自主管理 / 免費學員的智能營養計算（已完成 onboarding 才顯示，避免跟頂部重複） */}
        {!isCompetition && (isSelfManaged || isFree) && c.body_composition_enabled && c.calories_target && (
          <SelfManagedNutrition
            clientId={c.id}
            uniqueCode={c.unique_code}
            goalType={c.goal_type || null}
            activityProfile={c.activity_profile || null}
            gender={c.gender || null}
            caloriesTarget={c.calories_target}
            proteinTarget={c.protein_target}
            carbsTarget={c.carbs_target}
            fatTarget={c.fat_target}
            targetWeight={c.target_weight || null}
            targetDate={c.target_date || null}
            isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
            latestWeight={latestBodyData?.weight || null}
            latestBodyFat={latestBodyData?.body_fat || null}
            clientHeight={c.height || null}
            geneticCorrections={geneCorrections}
            onMutate={mutate}
          />
        )}

        {/* 一般學員（非自主管理、非免費）的每週智能分析 */}
        {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && c.body_composition_enabled && (
          <WeeklyInsight clientId={c.id} code={c.unique_code} onMutate={mutate} />
        )}

        {/* 免費學員的 AI 洞察預告 — 顯示真實分析但鎖定詳細建議 */}
        {!isCompetition && isFree && c.body_composition_enabled && (
          <FreeInsightTeaser
            nutritionLogs={(clientData.nutritionLogs || []) as any}
            bodyData={(clientData.bodyData || []) as any}
            targets={{
              calories: c.calories_target,
              protein: c.protein_target,
              carbs: c.carbs_target,
              fat: c.fat_target,
              water: c.water_target,
            }}
          />
        )}

        {c.wellness_enabled && <WellnessTrend wellness={clientData.wellness || []} />}

        {/* ================================================================ */}
        {/* === REFERENCE section: 參考資料（少變動） === */}
        {/* ================================================================ */}

        {/* 推薦好友卡片 — 至少使用 7 天以上且非免費用戶才顯示 */}
        {c.created_at && (() => {
          const daysSinceSignup = Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY_MS)
          if (daysSinceSignup < 7) return null
          if (c.subscription_tier === 'free' && streakDays < 7) return null
          return <ReferralCard clientId={c.unique_code} />
        })()}

        {/* 基因檔案卡片 */}
        {isFree ? (
          <UpgradeGate
            feature="基因檔案"
            description="升級後可填寫基因檢測結果，獲得個人化營養建議"
            tier="coached"
          />
        ) : (
          <GeneProfileCard
            mthfr={c.gene_mthfr as string | null}
            apoe={c.gene_apoe as string | null}
            serotonin={c.gene_depression_risk as string | null}
            notes={c.gene_notes as string | null}
            geneticCorrections={geneCorrections}
            clientId={c.unique_code}
            onMutate={mutate}
          />
        )}

        {/* 目標設定（非備賽模式才在這裡顯示，備賽模式已在 GoalDrivenStatus 旁邊） */}
        {!isCompetition && (
          <div className="mb-3" data-section="goal-settings">
            <GoalSettings
              clientId={c.id}
              uniqueCode={c.unique_code}
              currentGoalType={c.goal_type}
              currentTargetWeight={c.target_weight}
              currentTargetBodyFat={(c.target_body_fat as number) ?? null}
              currentTargetDate={c.target_date}
              competitionEnabled={isCompetitionMode(c.client_mode)}
              competitionDate={c.competition_date || null}
              prepPhase={c.prep_phase || null}
              latestWeight={latestBodyData?.weight || null}
              latestBodyFat={latestBodyData?.body_fat || null}
              onMutate={mutate}
            />
          </div>
        )}

        {c.lab_enabled && (
          <div id="section-lab" className="scroll-mt-4"><LabResults
            labResults={c.lab_results || []}
            isCoachMode={isCoachMode}
            clientId={clientId as string}
            coachHeaders={coachHeaders}
            onMutate={mutate}
          /></div>
        )}

        {/* 更多分析 — 預設收合以減少滑動長度 */}
        {(() => {
          const hasLabAnalysis = c.lab_enabled && c.lab_results && c.lab_results.length > 0
          const hasAi = c.ai_chat_enabled
          if (!hasLabAnalysis && !hasAi) return null
          return (
            <SectionErrorBoundary name="advanced-analysis">
              <button
                onClick={() => setShowMoreAnalysis(prev => !prev)}
                className="w-full flex items-center justify-center gap-2 py-3 mb-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors border border-gray-100"
              >
                <span className="text-sm font-medium text-gray-500">
                  {showMoreAnalysis ? '收合進階分析' : '展開進階分析'}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showMoreAnalysis ? 'rotate-180' : ''}`} />
              </button>
              {showMoreAnalysis && (
                <>
                  {hasLabAnalysis && (
                    <LabNutritionAdviceCard
                      labResults={c.lab_results}
                      gender={(c.gender as '男性' | '女性') ?? undefined}
                      goalType={c.goal_type as 'cut' | 'bulk' | null | undefined}
                    />
                  )}
                  {hasLabAnalysis && (
                    <LabInsightsCard
                      labResults={c.lab_results}
                      gender={(c.gender as '男性' | '女性') ?? undefined}
                      bodyFatPct={latestBodyData?.body_fat ?? null}
                    />
                  )}
                  {hasAi && (
                    <div id="section-ai" className="scroll-mt-4">
                      <AiInsightsPanel
                        clientId={c.unique_code}
                        isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
                      />
                    </div>
                  )}
                </>
              )}
            </SectionErrorBoundary>
          )
        })()}

        {/* 免費用戶升級提示（使用數據後提示） */}
        {isFree && streakDays >= 3 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 mb-6">
            <div className="text-center mb-3">
              <span className="text-2xl">🎯</span>
              <p className="text-sm font-bold text-gray-800 mt-1">
                你已經連續記錄 {streakDays} 天了！
              </p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                你的數據已經開始累積趨勢了。升級後 AI 能根據這些數據幫你判斷進度、調整方向——不用自己猜。
              </p>
            </div>
            <Link
              href={`/upgrade?from=${c.subscription_tier}`}
              onClick={() => {
                trackEvent('upgrade_cta_clicked', { source: 'streak_prompt', streak_days: streakDays })
                trackConversion('pricing_cta', peekVariant('pricing_cta') ?? 'original', 'click_upgrade')
              }}
              className="block text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <ABTest
                experimentId="pricing_cta"
                variants={{
                  original: <span>升級自主管理版 — NT$499/月</span>,
                  urgency: <span>限時優惠：首月 NT$399（原價 NT$499）</span>,
                  social_proof: <span>200+ 學員正在使用 — 升級 NT$499/月</span>,
                }}
                fallback={<span>升級自主管理版 — NT$499/月</span>}
              />
            </Link>
          </div>
        )}

        {/* 自主管理用戶升級教練指導提示 */}
        {isSelfManaged && streakDays >= 7 && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-3xl p-5 mb-6">
            <div className="text-center mb-3">
              <span className="text-2xl">👑</span>
              <p className="text-sm font-bold text-gray-800 mt-1">
                想讓教練幫你看數據？
              </p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                你已經累積了 {streakDays} 天的數據。升級教練指導方案，每週由 CSCS 教練審閱你的進度、調整營養計畫。
              </p>
            </div>
            <a
              href="https://lin.ee/LP65rCc"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('upgrade_cta_clicked', { source: 'coached_prompt', streak_days: streakDays })}
              className="block text-center bg-[#06C755] text-white text-sm font-bold py-3 rounded-xl hover:bg-[#05b04d] transition-all"
            >
              加 LINE 諮詢升級 — NT$2,999/月
            </a>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">開啟 LINE 後輸入「升級」即可</p>
          </div>
        )}

        {/* 未開放功能提示 */}
        {(() => {
          const locked = []
          if (!c.wellness_enabled) locked.push({ icon: '😊', label: '每日感受紀錄' })
          if (!c.nutrition_enabled) locked.push({ icon: '🥗', label: '飲食追蹤' })
          if (!c.training_enabled) locked.push({ icon: '🏋️', label: '訓練追蹤' })
          if (!c.supplement_enabled) locked.push({ icon: '💊', label: '補品管理' })
          if (!c.lab_enabled) locked.push({ icon: '🩸', label: '血檢追蹤' })
          if (locked.length === 0) return null
          return (
            <div className="bg-gray-50 rounded-3xl p-6 mb-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-500">更多功能</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {locked.map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 opacity-50">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
              {c.subscription_tier === 'free' ? (
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/upgrade?from=${c.subscription_tier}`}
                    onClick={() => trackEvent('upgrade_cta_clicked', { source: 'locked_features' })}
                    className="block text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
                  >
                    升級自主管理版 NT$499/月
                  </Link>
                  <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="block text-center bg-[#06C755] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#05b04d] transition-all">
                    加 LINE 找 Howard
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-3 text-center">和教練討論開啟更多追蹤功能</p>
              )}
            </div>
          )
        })()}

        {/* 教練報告（教練模式） */}
        {isCoachMode && (
          <HealthReport client={{ name: c.name, age: c.age ?? 0, gender: c.gender ?? '', coach_summary: c.coach_summary ?? undefined, health_goals: c.health_goals ?? undefined, next_checkup_date: c.next_checkup_date ?? undefined, lab_results: c.lab_results, supplements: c.supplements }} latestBodyData={latestBodyData} bmi={bmi}
            weekRate={supplementComplianceStats.weekRate} monthRate={supplementComplianceStats.monthRate}
          />
        )}

        {!isFree && <PwaPrompt />}
      </div>

      <OnboardingGuide
        clientId={clientId as string}
        clientName={c.name}
        tier={c.subscription_tier!}
        features={{
          body_composition_enabled: c.body_composition_enabled,
          nutrition_enabled: c.nutrition_enabled,
          training_enabled: c.training_enabled,
          wellness_enabled: c.wellness_enabled,
          supplement_enabled: c.supplement_enabled,
          lab_enabled: c.lab_enabled,
          ai_chat_enabled: c.ai_chat_enabled,
        }}
        nutritionTargets={{
          calories: c.calories_target,
          protein: c.protein_target,
          carbs: c.carbs_target,
          fat: c.fat_target,
        }}
        goalInfo={{
          goalType: c.goal_type,
          currentWeight: latestBodyData?.weight ?? null,
          targetWeight: c.target_weight ?? null,
        }}
      />

      {/* Contextual upgrade trigger for free-tier users */}
      {isFree && (
        <UpgradeTrigger
          plan={c.subscription_tier || 'free'}
          daysTracked={upgradeTriggerDaysTracked}
          mealsLogged={(clientData.nutritionLogs || []).length}
          weightEntries={weightEntriesForTrigger}
          mealsLoggedDuringPlateau={mealsLoggedDuringPlateau}
        />
      )}

      {showSupplementModal && c.supplement_enabled && (
        <SupplementModal
          supplements={c.supplements || []}
          clientId={clientId as string}
          coachHeaders={coachHeaders}
          onClose={() => setShowSupplementModal(false)}
          onMutate={mutate}
        />
      )}

      {/* AI 飲食顧問浮動按鈕 */}
      {c.nutrition_enabled && (
        <button
          onClick={() => setShowAiChat(true)}
          className="fixed z-40 bg-[#2563eb] text-white rounded-full shadow-lg hover:bg-[#1d4ed8] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 px-4 py-3"
          style={{ bottom: 'calc(70px + env(safe-area-inset-bottom))', right: '16px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm font-medium">AI 顧問</span>
          {!c.ai_chat_enabled && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">3次免費</span>
          )}
        </button>
      )}


      {/* AI 聊天抽屜（付費用戶 + 健康模式用戶 + 免費用戶月度免費額度） */}
      {(c.nutrition_enabled || isHealthMode) && (
        <AiChatDrawer
          open={showAiChat}
          onClose={() => { setShowAiChat(false); setAiChatInitialPrompt(undefined) }}
          initialPrompt={aiChatInitialPrompt}
          clientId={c.unique_code}
          clientName={c.name}
          gender={c.gender}
          goalType={c.goal_type}
          todayNutrition={todayNutrition}
          caloriesTarget={c.calories_target}
          proteinTarget={c.protein_target}
          carbsTarget={c.carbs_training_day && c.carbs_rest_day
            ? (todayTraining && isWeightTraining(todayTraining.training_type) ? c.carbs_training_day : c.carbs_rest_day)
            : c.carbs_target}
          fatTarget={c.fat_target}
          waterTarget={c.water_target}
          isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
          competitionEnabled={isCompetition}
          prepPhase={c.prep_phase as string | null}
          competitionDate={c.competition_date as string | null}
          latestWeight={latestBodyData?.weight}
          latestBodyFat={latestBodyData?.body_fat}
          nutritionLogs={clientData.nutritionLogs || []}
          wellnessLogs={clientData.wellness || []}
          trainingLogs={(clientData.trainingLogs || []).map(t => ({ ...t, note: t.note ?? undefined }))}
          supplements={c.supplements || []}
          supplementComplianceRate={supplementComplianceStats.weekRate}
          todayWellness={todayWellness}
          wearableData={{
            hrv: todayWellness?.hrv ?? null,
            resting_hr: todayWellness?.resting_hr ?? null,
            device_recovery_score: todayWellness?.device_recovery_score ?? null,
          }}
          labResults={c.lab_enabled ? (c.lab_results || []).map((r) => ({
            test_name: r.test_name,
            value: r.value,
            unit: r.unit,
            status: r.status,
            date: r.date,
            custom_advice: r.custom_advice,
          })) : undefined}
          onFirstMessage={undefined}
          healthModeEnabled={isHealthMode}
          healthScore={healthScore}
          supplementSuggestions={supplementSuggestions}
          geneticProfile={c.gene_mthfr || c.gene_apoe || c.gene_depression_risk ? {
            mthfr: c.gene_mthfr as string | null,
            apoe: c.gene_apoe as string | null,
            serotonin: ['LL', 'SL', 'SS'].includes(c.gene_depression_risk as string) ? c.gene_depression_risk as string : null,
            depressionRisk: ['low', 'moderate', 'high'].includes(c.gene_depression_risk as string) ? c.gene_depression_risk as string : null,
            notes: c.gene_notes as string | null,
          } : undefined}
          weightTrend={weightTrendForAi}
          bodyFatTrend={bodyFatTrendForAi}
          nutritionEngineStatus={nutritionEngineSuggestion ? {
            status: nutritionEngineSuggestion.status,
            message: nutritionEngineSuggestion.message,
            estimatedTDEE: nutritionEngineSuggestion.estimatedTDEE,
            weeklyWeightChangeRate: nutritionEngineSuggestion.weeklyWeightChangeRate,
            dietBreakSuggested: nutritionEngineSuggestion.dietBreakSuggested ?? false,
            warnings: nutritionEngineSuggestion.warnings || [],
            currentState: nutritionEngineSuggestion.currentState,
            readinessScore: nutritionEngineSuggestion.readinessScore,
            statusLabel: nutritionEngineSuggestion.statusLabel,
            refeedSuggested: nutritionEngineSuggestion.refeedSuggested,
            refeedReason: nutritionEngineSuggestion.refeedReason,
            refeedDays: nutritionEngineSuggestion.refeedDays,
            energyAvailability: nutritionEngineSuggestion.energyAvailability,
            suggestedCalories: nutritionEngineSuggestion.suggestedCalories,
            suggestedProtein: nutritionEngineSuggestion.suggestedProtein,
            suggestedCarbs: nutritionEngineSuggestion.suggestedCarbs,
            suggestedFat: nutritionEngineSuggestion.suggestedFat,
            suggestedCarbsTrainingDay: nutritionEngineSuggestion.suggestedCarbsTrainingDay,
            suggestedCarbsRestDay: nutritionEngineSuggestion.suggestedCarbsRestDay,
            deadlineInfo: nutritionEngineSuggestion.deadlineInfo,
            peakWeekPlan: nutritionEngineSuggestion.peakWeekPlan,
            athleticRebound: nutritionEngineSuggestion.athleticRebound,
            geneticCorrections: nutritionEngineSuggestion.geneticCorrections,
            wearableInsight: nutritionEngineSuggestion.wearableInsight,
            metabolicStress: nutritionEngineSuggestion.metabolicStress ? {
              score: nutritionEngineSuggestion.metabolicStress.score,
              level: nutritionEngineSuggestion.metabolicStress.level,
            } : null,
          } : undefined}
          recoveryAssessment={nutritionEngineSuggestion?.recoveryAssessment ?? undefined}
          coachSummary={c.coach_summary as string | null}
          coachWeeklyNote={c.coach_weekly_note as string | null}
          streakDays={streakDays}
          streakMessage={streakMessage}
          targetWeight={c.target_weight as number | null}
          targetBodyFat={(c.target_body_fat as number) ?? null}
          dietStartDate={c.diet_start_date as string | null}
        />
      )}

      {/* 底部導航 */}
      {(() => {
        const tabs: { id: string; icon: string; label: string }[] = []
        if (c.body_composition_enabled) tabs.push({ id: 'section-body', icon: '⚖️', label: '身體' })
        if (c.nutrition_enabled) tabs.push({ id: isCompetition ? 'section-nutrition' : 'section-nutrition-general', icon: '🥗', label: '飲食' })
        if (c.supplement_enabled) tabs.push({ id: 'section-supplements', icon: '💊', label: '補品' })
        if (c.wellness_enabled) tabs.push({ id: 'section-wellness', icon: '😊', label: '感受' })
        if (c.training_enabled) tabs.push({ id: 'section-training', icon: '🏋️', label: '訓練' })
        if (c.lab_enabled) tabs.push({ id: 'section-lab', icon: '🩸', label: '血檢' })

        const completedMap: Record<string, boolean> = {
          'section-nutrition': !!todayNutrition,
          'section-nutrition-general': !!todayNutrition,
          'section-supplements': todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total,
          'section-wellness': !!todayWellness,
          'section-training': !!todayTraining,
        }

        return (
          <BottomNav
            tabs={tabs}
            activeTab={activeTab}
            completedMap={completedMap}
            isToday={isToday}
            onTabClick={(id) => {
              setActiveTab(id)
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )
      })()}

      {/* 回到頂部按鈕 */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-4 z-40 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-opacity"
          aria-label="回到頂部"
        >
          <ChevronUp size={20} className="text-gray-600" />
        </button>
      )}
    </div>
    </ErrorBoundary>
  )
}
