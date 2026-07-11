'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useClientData, type Client, type ClientDataPayload } from '@/hooks/useClientData'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useCoachMode } from '@/hooks/useCoachMode'
import { Lock, ChevronDown, ChevronUp, ChevronRight, Scale, Utensils, Pill, Smile, Dumbbell } from 'lucide-react'
import BottomNav from '@/components/client/BottomNav'
import CollapsibleSection from '@/components/client/CollapsibleSection'
import NewUserLanding, { shouldUseNewUserMode } from '@/components/client/NewUserLanding'
import QuickActions from '@/components/client/QuickActions'
import EngineStatusLine from '@/components/client/EngineStatusLine'
import UpgradeGate from '@/components/client/UpgradeGate'
import UpgradeWelcome from '@/components/client/UpgradeWelcome'
import HealthOverview from '@/components/client/HealthOverview'
const TrainingProgressCardLazy = dynamic(() => import('@/components/client/TrainingProgressCardLazy'), { ssr: false })
const DailyCheckIn = dynamic(() => import('@/components/client/DailyCheckIn'), { ssr: false })
import DailyWellness from '@/components/client/DailyWellness'
const BodyComposition = dynamic(() => import('@/components/client/BodyComposition'), { ssr: false })
import StageWeightEstimator from '@/components/client/StageWeightEstimator'
// LabResults inline removed in B integration — main page now shows compact summary card linking to /health/timeline
const SupplementModal = dynamic(() => import('@/components/client/SupplementModal'), { ssr: false })
const WellnessTrend = dynamic(() => import('@/components/client/WellnessTrend'), { ssr: false })
const TrainingLog = dynamic(() => import('@/components/client/TrainingLog'), { ssr: false })
import TodayWorkout from '@/components/client/TodayWorkout'
import { isWeightTraining, TRAINING_TYPES } from '@/components/client/types'
import { labelToTrainingType } from '@/lib/training-split'
import NutritionLog from '@/components/client/NutritionLog'
import CompWarRoom from '@/components/client/CompWarRoom'
import CutHealthCard from '@/components/client/CutHealthCard'
import DailyNutritionTarget from '@/components/client/DailyNutritionTarget'
import { ForYouFeed } from '@/components/client/ForYouFeed'
import WeeklyInsight from '@/components/client/WeeklyInsight'
const SelfManagedNutrition = dynamic(() => import('@/components/client/SelfManagedNutrition'), { ssr: false })
const NutritionStrategyCard = dynamic(() => import('@/components/client/NutritionStrategyCard'), { ssr: false })
import PwaPrompt from '@/components/client/PwaPrompt'
import ClientHeader from '@/components/client/ClientHeader'
import WelcomeBanner from '@/components/client/WelcomeBanner'
import HealthScoreBanner from '@/components/client/HealthScoreBanner'
import ProgressJourney from '@/components/client/ProgressJourney'
import PushNotificationPrompt from '@/components/client/PushNotificationPrompt'
import SupplementStrategyCard from '@/components/client/SupplementStrategyCard'
import SeeTabSection from '@/components/client/SeeTabSection'
import TodayOverviewCard from '@/components/client/TodayOverviewCard'
import CoachMessageBanner from '@/components/client/CoachMessageBanner'
import TodayHeadline from '@/components/client/TodayHeadline'
import MyPlanSection from '@/components/client/MyPlanSection'
import DayBasedCards from '@/components/client/DayBasedCards'
import { calculateHealthScore } from '@/lib/health-score-engine'
import { isCompetitionMode, isHealthMode as isHealthModeHelper } from '@/lib/client-mode'

// Dynamic imports for code splitting (client-only components)
const AiChatDrawer = dynamic(() => import('@/components/client/AiChatDrawer'), { ssr: false })
const RecoveryDashboard = dynamic(() => import('@/components/client/RecoveryDashboard'), { ssr: false })
const AiInsightsPanel = dynamic(() => import('@/components/client/AiInsightsPanel'), { ssr: false })
const GeneProfileCard = dynamic(() => import('@/components/client/GeneProfileCard'), { ssr: false })
const LabInsightsCard = dynamic(() => import('@/components/client/LabInsightsCard'), { ssr: false })
const LabNutritionAdviceCard = dynamic(() => import('@/components/client/LabNutritionAdviceCard'), { ssr: false })
const GoalSettings = dynamic(() => import('@/components/client/GoalSettings'), { ssr: false })
const GoalDrivenStatus = dynamic(() => import('@/components/client/GoalDrivenStatus'), { ssr: false })
const HealthModeAdvanced = dynamic(() => import('@/components/client/HealthModeAdvanced'), { ssr: false })
const OnboardingGuide = dynamic(() => import('@/components/client/OnboardingGuide'), { ssr: false })
const OnboardingChecklist = dynamic(() => import('@/components/client/OnboardingChecklist'), { ssr: false })
const ReferralCard = dynamic(() => import('@/components/client/ReferralCard'), { ssr: false })
const FreeInsightTeaser = dynamic(() => import('@/components/client/FreeInsightTeaser'), { ssr: false })
const UpgradeTrigger = dynamic(() => import('@/components/client/UpgradeTrigger'), { ssr: false })
import { generateSupplementSuggestions, type GeneticProfile } from '@/lib/supplement-engine'
import type { NutritionSuggestion } from '@/lib/nutrition-engine'
import { degradeToSafe } from '@/lib/compliance-scrub'
import { getLocalDateStr, daysUntilDateTW, DAY_MS } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'
import { trackEvent } from '@/lib/analytics'
import ABTest from '@/components/ABTest'
import { trackConversion, peekVariant } from '@/lib/ab-testing'
import ErrorBoundary, { SectionErrorBoundary } from '@/components/ErrorBoundary'

// 首屏卡片 props 穩定引用：`|| []` 每次 render 都產生新陣列，會打穿子元件的 React.memo
const EMPTY_ARRAY: never[] = []

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
  // 真分頁：一次只顯示一個畫面（取代「一長卷到底」）。首頁=今日打卡+備賽進度，其餘各自進分頁。
  const [view, setView] = useState<'home' | 'data' | 'training' | 'lab' | 'more'>('home')
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
    // 將課表 label 映射到 training_type（共用邏輯，見 lib/training-split）
    return labelToTrainingType(todayPlan.label)
  }, [clientData?.client?.training_plan])

  // 課表卡手動切分化時，連動下方訓練紀錄表單的預選類型（null = 沿用 todayPlanType）
  const [switchedTrainingType, setSwitchedTrainingType] = useState<string | null>(null)

  // 統一判斷今天是否為訓練日：已填記錄優先，沒填就看課表
  // 這樣碳水循環在你還沒填記錄時就能正確顯示訓練日碳水
  const isTrainingDayResolved = useMemo(() => {
    // 1. 已填訓練記錄 → 用記錄判斷
    if (todayTraining) return isWeightTraining(todayTraining.training_type)
    // 2. 沒填 → 看課表今天排什麼
    if (todayPlanType && todayPlanType !== 'rest') return true
    if (todayPlanType === 'rest') return false
    // 3. 都沒有 → 預設休息日
    return false
  }, [todayTraining, todayPlanType])

  // 生成補品建議（必須在所有條件 return 之前，遵守 React Hooks 規則）
  // 消費者只有「更多」視圖的 SupplementStrategyCard 和 AI 聊天抽屜 → 首屏不跑引擎，等真的需要才算
  const supplementSuggestions = useMemo(() => {
    if (view !== 'more' && !showAiChat) return []
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
  }, [clientData?.client, clientData?.trainingLogs, view, showAiChat])

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

  // 健康模式：健康分數 + HRV baseline（memo 化，避免每次 render 重算）
  // HRV baseline：用 7 天前以前的所有 HRV 數據算長期平均
  const healthScore = useMemo(() => {
    const c = clientData?.client
    if (!c || !isHealthModeHelper(c.client_mode)) return null
    const allWellness = clientData.wellness || []
    const hrvOlder = allWellness.slice(0, -7)
      .map((w: { hrv?: number | null }) => w.hrv)
      .filter((v: number | null | undefined): v is number => v != null)
    const hrvBaseline = hrvOlder.length >= 7
      ? hrvOlder.reduce((a: number, b: number) => a + b, 0) / hrvOlder.length
      : null
    return calculateHealthScore({
      wellnessLast7: allWellness.slice(-7),
      nutritionLast7: (clientData.nutritionLogs || []).slice(-7),
      trainingLast7: (clientData.trainingLogs || []).slice(-7),
      supplementComplianceRate: supplementComplianceStats.weekRate / 100,
      labResults: c.lab_results || [],
      hrvBaseline,
      quarterlyStart: c.quarterly_cycle_start,
    })
  }, [clientData?.client, clientData?.wellness, clientData?.nutritionLogs, clientData?.trainingLogs, supplementComplianceStats.weekRate])

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
  // 跑營養引擎：
  //   autoApply=true  → 把建議寫回 DB（首次載入用；備賽客戶一律不套用，由 GoalDrivenStatus 處理）
  //   autoApply=false → 只取得建議刷新顯示（記錄後用，不動 macros，避免雙重套用）
  const engineRunningRef = useRef(false)
  // 回聲用：上一次引擎判定的快照。只在「記錄後判定真的變了」才開口，其餘閉嘴（安靜版）。
  const echoSnapshotRef = useRef<{ status: string; refeedSuggested: boolean } | null>(null)
  const runEngine = useCallback(async (autoApply: boolean, echo = false) => {
    const c = clientData?.client
    if (!c || !c.nutrition_enabled || !c.goal_type) return
    if (engineRunningRef.current) return
    engineRunningRef.current = true
    const apply = autoApply && !isCompetitionMode(c.client_mode)
    try {
      const code = clientId as string
      const res = await fetch(`/api/nutrition-suggestions?clientId=${code}${apply ? '&autoApply=true' : ''}&code=${code}`)
      if (!res.ok) {
        console.error('[AutoNutrition] API 失敗:', res.status)
        return
      }
      const json = await res.json()
      if (json.suggestion) {
        const next = json.suggestion as NutritionSuggestion
        const prev = echoSnapshotRef.current
        // 回聲：這筆記錄讓引擎判定改變 → 一句話。判定沒變 → 不吵（記錄成功已有自己的 toast）。
        if (echo && prev && next.status !== prev.status && next.statusLabel) {
          showToast(`這筆記錄讓判定更新了：${degradeToSafe(next.statusLabel).text}`, 'info')
        } else if (echo && prev && next.refeedSuggested && !prev.refeedSuggested) {
          showToast('引擎建議安排 refeed，細節看計畫分頁', 'info')
        }
        echoSnapshotRef.current = { status: next.status, refeedSuggested: !!next.refeedSuggested }
        setNutritionEngineSuggestion(next)
      }
      if (json.coachOverrideInfo) setCoachOverrideInfo(json.coachOverrideInfo)
      if (apply && mutate) mutate()
    } catch (err) {
      console.error('[AutoNutrition] 錯誤:', err)
    } finally {
      engineRunningRef.current = false
    }
  }, [clientData?.client, clientId, mutate, showToast])

  // 記錄後只刷新引擎建議顯示，不動 macros；echo=true 讓判定變化時回一句話
  const refreshEngineSuggestion = useCallback(() => { void runEngine(false, true) }, [runEngine])

  // 飲食記錄後：刷新 SWR + 引擎建議（讓「系統在幫我算」的回饋跟記錄動作即時連動）
  const mutateAndRefreshEngine = useCallback(() => {
    mutate()
    refreshEngineSuggestion()
  }, [mutate, refreshEngineSuggestion])

  // 體重記錄後：體重 API 已自行套用 macros，這裡同步快取 + 刷新引擎建議顯示
  const mutateWithTargetsAndRefreshEngine = useCallback((appliedTargets?: Record<string, number | undefined>) => {
    mutateWithTargets(appliedTargets)
    refreshEngineSuggestion()
  }, [mutateWithTargets, refreshEngineSuggestion])

  // 首次載入跑一次（autoApply）— 但延後到首屏穩定後 + 一天只跑一次寫 DB，
  // 不然每次點進來都在首屏關鍵期打 nutrition-suggestions(寫 DB) + 觸發整包 refetch，畫面很卡。
  const autoNutritionTriggered = useRef(false)
  useEffect(() => {
    if (autoNutritionTriggered.current) return
    const c = clientData?.client
    if (!c || !c.nutrition_enabled || !c.goal_type) return
    autoNutritionTriggered.current = true
    // 本日是否已 autoApply 過（寫 DB 一天一次就夠）
    let appliedToday = false
    try {
      const key = `hp_engine_applied_${clientId}_${new Date().toISOString().slice(0, 10)}`
      appliedToday = localStorage.getItem(key) === '1'
      if (!appliedToday) localStorage.setItem(key, '1')
    } catch { /* ignore */ }
    // 延到首屏穩定後再跑，避免和首屏渲染/主請求搶資源
    const run = () => { void runEngine(!appliedToday) } // 今天已套用過 → 只取建議顯示(false)，不再寫 DB/重抓
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const t = ric ? ric(run, { timeout: 2500 }) : window.setTimeout(run, 1500)
    return () => { if (!ric) window.clearTimeout(t as number) }
  }, [clientData?.client, runEngine, clientId])

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
            className="block bg-primary-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-primary-700 transition-colors mb-3"
          >
            用 Safari 開啟
          </a>
          <button
            onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(url)
            }}
            className="text-sm text-primary-600 hover:underline"
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
      <div className="min-h-screen bg-gray-50">
        {/* Skeleton header bar */}
        <div className="bg-white shadow-sm px-4 py-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="h-6 w-32 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          {/* 教練訊息先秀（自抓，不等整包資料）→ 點推播進來馬上看到內容 */}
          <CoachMessageBanner clientCode={clientId as string} />
          {/* Skeleton card 1 - main stats */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
          </div>
          {/* Skeleton card 2 - training */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-4 gap-2">
              <div className="h-11 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-11 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-11 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-11 bg-gray-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          </div>
          {/* Skeleton card 3 - nutrition */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
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
              <a href="/pay?tier=self_managed" className="block bg-[#1E4A73] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#16385A] transition-colors text-sm">
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

  // 新人模式：完全沒打卡資料 + 沒按過 escape hatch → 簡化首頁
  const useNewUserMode = isToday && shouldUseNewUserMode(clientData)
  if (useNewUserMode) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {/* ConsentGate 已移至 app/c/[clientId]/layout.tsx，包住所有子頁（含血檢路由） */}
          <NewUserLanding
            client={c}
            clientData={clientData}
            selectedDate={selectedDate}
            mutate={mutate}
            onShowFullDashboard={() => window.location.reload()}
          />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-50">
      {/* 法律同意 gate 已移至 app/c/[clientId]/layout.tsx（包住所有子頁，含血檢路由） */}

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
              <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-primary-700">下次扣款日：{new Date(c.expires_at).toLocaleDateString('zh-TW')}</p>
                <p className="text-xs text-primary-600 mt-1">系統將自動續訂，無需手動操作。如需取消，請至右上角設定。</p>
              </div>
            )
          }
          return null
        })()}

        {/* LINE 綁定提示 Banner */}
        {!c.has_line_binding && (
          <div className="bg-[#06C755]/10 border-2 border-[#06C755] rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">還沒綁 LINE — 90% 的人 5 天內就忘了回來</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  綁定後我會在你習慣的時間提醒你，傳訊息就能記體重、飲食、訓練，每週還會收到進度報告。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href="https://lin.ee/LP65rCc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center bg-[#06C755] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-[#05a548] transition-colors"
                  >
                    ① 加好友
                  </a>
                  <a
                    href={`https://line.me/R/oaMessage/%40howardprotocol/?${encodeURIComponent(`綁定 ${c.unique_code}`)}`}
                    className="block text-center bg-white text-[#06C755] text-xs font-bold py-2.5 rounded-lg border-2 border-[#06C755] hover:bg-[#06C755]/5 transition-colors"
                  >
                    ② 一鍵綁定
                  </a>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  ②會自動開 LINE 並填好「綁定 {c.unique_code}」，按送出即可
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 教練訊息置頂 — 點推播進來第一眼就看到全文（之前藏在「為你更新」中段看不到）*/}
        {isToday && clientData.recentCoachMessage && (
          <CoachMessageBanner msg={clientData.recentCoachMessage} clientCode={c.unique_code} />
        )}

        {/* 今日主線 — 首屏脊椎：一句判定 + 今天一個動作（吸收原「本週任務」判定，收斂多卡為一個聲音）*/}
        {view === 'home' && isToday && (
          <TodayHeadline
            prepPhase={c.prep_phase || null}
            competitionDate={c.competition_date || null}
            isCompetition={isCompetition}
            targetWeight={c.target_weight ?? null}
            isTrainingDay={isTrainingDayResolved}
            carbsTrainingDay={c.carbs_training_day ?? null}
            carbsRestDay={c.carbs_rest_day ?? null}
            carbsTarget={c.carbs_target ?? null}
            weeklyTasks={c.weekly_tasks}
            hasAttention={!!c.status && c.status !== 'normal'}
            recentlyActive={streakDays > 0}
            engine={nutritionEngineSuggestion}
          />
        )}

        {/* 我的計畫 — 靜態參考（菜單/課表/補品/SOP）收合式，reference 層 */}
        {view === 'home' && isToday && <MyPlanSection data={c.onboarding_notes_rendered} />}

        {/* 首次來訪導覽 banner（dismissible）*/}
        {view === 'home' && isToday && <WelcomeBanner clientId={clientId as string} />}

        {/* 推播開通 — 已下移到行動/判決卡之後（開通推播=留存槓桿，但別佔掉第一屏；gated）*/}

        {/* 核心邏輯一句話 — 暫藏 2026-06-12（去雜訊，常駐文案無資訊量；移除 false 即還原） */}
        {false && isToday && (
          <div className="mb-4 px-4 py-2.5 bg-zinc-50 border-l-2 border-emerald-500 rounded-r-lg">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 mr-1.5">重點</span>
              不是「算營養素」，是<b className="text-zinc-900">連續追蹤 + 累積對照</b>。連續打卡 14 天，趨勢才會說話。
            </p>
          </div>
        )}

        {/* 🔥 streak chip — 暫藏 2026-06-12（streak 已在 TodayOverviewCard 顯示，避免重複；移除 false 即還原） */}
        {false && isToday && streakDays >= 3 && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-200 rounded-full">
            <span className="text-lg">🔥</span>
            <div>
              <span className="text-sm font-semibold text-orange-900">
                連續 {streakDays} 天
              </span>
              <span className="text-xs text-orange-700 ml-2">
                {streakMessage}
              </span>
            </div>
          </div>
        )}

        {/* 標題區 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <ClientHeader
            client={c}
            isCoachMode={isCoachMode}
            hideStatusBadge={true}
            showCountdown={view === 'home'}
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
        </div>

        {/* 🎯 今日教練指令 — 首頁最上面一句話：今天該幹嘛 + 還剩幾項沒打卡（打完變慶祝） */}
        {view === 'home' && isToday && (() => {
          const daily = [
            c.body_composition_enabled ? !!(latestBodyData && latestBodyData.date === selectedDate) : null,
            c.nutrition_enabled ? !!todayNutrition : null,
            (c.supplement_enabled && (c.supplements || []).length > 0) ? (todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total) : null,
            c.wellness_enabled ? !!todayWellness : null,
            c.training_enabled ? !!todayTraining : null,
          ].filter(v => v !== null) as boolean[]
          if (daily.length === 0) return null
          const unlogged = daily.filter(v => !v).length
          const allDone = unlogged === 0
          return (
            <div className={`border rounded-2xl p-4 mb-3 flex items-center gap-2.5 ${allDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              <p className="text-sm text-gray-700 leading-snug">
                <span className="font-semibold text-gray-900">今日重點</span>
                {/* 訓練日/碳水已由上方 TodayHeadline 講過，這裡不重複（去重複頁首） */}
                {' · '}
                {allDone
                  ? <span className="text-emerald-700 font-semibold">五項打卡完成，今天收工</span>
                  : <span className="text-slate-400 tabular-nums">今天還有 {unlogged} 項可記（記了引擎才調得準）</span>}
              </p>
            </div>
          )
        })()}

        {/* ===== INSIGHT: 每日洞察 + 完成進度（進「數據」分頁看） ===== */}
          {view === 'data' && isToday && (
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
              trainingLogs={clientData.trainingLogs ?? EMPTY_ARRAY}
              wellness={clientData.wellness ?? EMPTY_ARRAY}
              bodyData={clientData.bodyData ?? EMPTY_ARRAY}
            />
            </SectionErrorBoundary>
          )}

          {/* ===== 為你更新：精簡主動卡片（血檢趨勢 / 回檢 / macro 調整）===== */}
          {view === 'home' && isToday && (
            <SectionErrorBoundary name="for-you-feed">
              <ForYouFeed
                labs={c.lab_results ?? EMPTY_ARRAY}
                gender={c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined}
                nextCheckupDate={c.next_checkup_date}
                macroAdjustment={clientData.recentMacroAdjustment ?? null}
                clientCode={c.unique_code}
              />
            </SectionErrorBoundary>
          )}

          {/* ===== 進步總覽 — 暫藏 2026-06-12（與 TodayOverviewCard 的現況/洞察重疊；要還原把下面整段註解打開即可） =====
          {isToday && (
            <SectionErrorBoundary name="progress-journey">
              <ProgressJourney
                bodyData={(clientData.bodyData || []).map((b: any) => ({ date: b.date, weight: b.weight, body_fat: b.body_fat }))}
                wellness={(clientData.wellness || []).map((w: any) => ({ date: w.date, sleep_quality: w.sleep_quality, energy_level: w.energy_level, mood: w.mood }))}
                nutritionLogs={(clientData.nutritionLogs || []).map((n: any) => ({ date: n.date, compliant: n.compliant, protein_grams: n.protein_grams }))}
                trainingLogs={(clientData.trainingLogs || []).map((t: any) => ({ date: t.date, training_type: t.training_type }))}
                bodyWeight={latestBodyData?.weight ?? c.target_weight ?? 70}
                goalType={c.goal_type as string | null}
                prepPhase={c.prep_phase as string | null}
              />
            </SectionErrorBoundary>
          )}
          ===== */}

          {/* 賽後恢復提示：比賽日期已過但階段仍為 peak_week/competition */}
          {view === 'home' && isCompetition && c.competition_date && (() => {
            const daysLeft = daysUntilDateTW(c.competition_date)
            // 比賽日當天(0)或之後(<0)，且還沒選擇下一步
            const needsRecoveryPrompt = daysLeft <= 0 && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition')
            if (!needsRecoveryPrompt) return null
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-gray-900">比賽結束了！辛苦了！</h3>
                  <p className="text-sm text-gray-500 mt-1">接下來你想怎麼做？</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handlePrepPhaseChange('recovery')}
                    disabled={updatingPhase}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-left px-4"
                  >
                    <div className="flex items-center gap-3">
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
                    className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 text-left px-4"
                  >
                    <div className="flex items-center gap-3">
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

          {/* 新手引導 — 只有完全沒數據的新用戶才看到（營養設定移到 DO section 後） */}
          {view === 'home' && !latestBodyData && (!clientData.nutritionLogs || clientData.nutritionLogs.length === 0) && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
              <p className="text-sm text-primary-700 font-medium">歡迎！往下滑開始記錄你的第一筆數據</p>
            </div>
          )}

        {/* === QuickActions: 一鍵打卡（每天打開最常做的事，擺在判決卡前面，不用滑過 3 張卡才摸得到） === */}
        {view === 'home' && isToday && (
          <QuickActions
            enabledSections={[
              ...(c.body_composition_enabled ? [{ id: 'section-body', icon: <Scale size={16} className="text-slate-500" />, label: '體重', completed: !!latestBodyData && latestBodyData.date === selectedDate }] : []),
              ...(c.nutrition_enabled ? [{ id: isCompetition ? 'section-nutrition' : 'section-nutrition-general', icon: <Utensils size={16} className="text-slate-500" />, label: '飲食', completed: !!todayNutrition }] : []),
              ...(c.supplement_enabled ? [{ id: 'section-supplements', icon: <Pill size={16} className="text-slate-500" />, label: '補品', completed: todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total }] : []),
              ...(c.wellness_enabled ? [{ id: 'section-wellness', icon: <Smile size={16} className="text-slate-500" />, label: '感受', completed: !!todayWellness }] : []),
              ...(c.training_enabled ? [{ id: 'section-training', icon: <Dumbbell size={16} className="text-slate-500" />, label: '訓練', completed: !!todayTraining }] : []),
            ]}
            topSummary={{
              weight: latestBodyData?.weight,
              daysLeft: c.competition_date ? daysUntilDateTW(c.competition_date) : null,
              todayCarbs: (c.carbs_training_day && c.carbs_rest_day)
                ? (isTrainingDayResolved ? c.carbs_training_day : c.carbs_rest_day)
                : c.carbs_target, // 跟飲食卡/今日指令/達標一致（碳循環當日值）
              isTrainingDay: isTrainingDayResolved,
              streak: overallStreak,
            }}
            onNavigate={(sectionId) => {
              // 分頁化後：點「看細節」→ 切到該功能所在的分頁（不再是捲到隱藏的區塊）
              const toView: Record<string, 'data' | 'training' | 'more'> = {
                'section-body': 'data',
                'section-nutrition': 'data',
                'section-nutrition-general': 'data',
                'section-supplements': 'more',
                'section-wellness': 'more',
                'section-training': 'training',
              }
              const v = toView[sectionId]
              if (v) { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }
            }}
            showQuickWeight={c.body_composition_enabled && !(latestBodyData && latestBodyData.date === selectedDate)}
            onQuickWeight={async (weight) => {
              try {
                // 回聲素材：記之前先抓上一筆體重（此時 latestBodyData 還是舊資料）
                const prevW = latestBodyData?.weight != null ? Number(latestBodyData.weight) : null
                const res = await fetch('/api/body-composition', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, date: today, weight }),
                })
                if (!res.ok) throw new Error()
                await mutate()
                // 回聲：同一顆 toast 帶意義（跟上次比多少），不多彈一顆
                const diff = prevW != null && Number.isFinite(prevW) ? Math.round((weight - prevW) * 10) / 10 : null
                showToast(
                  diff != null && diff !== 0
                    ? `記好了 ${weight}kg，比上次 ${diff > 0 ? '+' : ''}${diff}kg`
                    : `記好了 ${weight}kg`,
                  'success',
                )
                refreshEngineSuggestion()
                return true
              } catch { showToast('記錄失敗，請重試', 'error'); return false }
            }}
            showQuickNutrition={c.nutrition_enabled && !todayNutrition}
            onQuickNutrition={async (compliant) => {
              try {
                // 「達標」= 今天照飲食卡上看到的目標吃 → 碳循環時用當日(訓練/休息)值，
                // 例：訓練日 = carbs_training_day(236)，不是 base 177、更不是引擎另算的 301。熱量跟著巨量算、水分一起填。
                const effCarbs = (c.carbs_training_day && c.carbs_rest_day)
                  ? (isTrainingDayResolved ? c.carbs_training_day : c.carbs_rest_day)
                  : c.carbs_target
                const effCals = (c.protein_target != null && effCarbs != null && c.fat_target != null)
                  ? Math.round(c.protein_target * 4 + effCarbs * 4 + c.fat_target * 9)
                  : (c.calories_target ?? null)
                const macros = compliant
                  ? {
                      calories: effCals,
                      protein_grams: c.protein_target ?? null,
                      carbs_grams: effCarbs ?? null,
                      fat_grams: c.fat_target ?? null,
                      water_ml: c.water_target ?? null,
                    }
                  : {}
                const res = await fetch('/api/nutrition-logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, date: today, compliant, ...macros }),
                })
                if (!res.ok) throw new Error()
                await mutate()
                showToast(compliant ? '記好了，達標，已照目標填好營養素' : '記好了，明天再追上', 'success')
                refreshEngineSuggestion() // 記錄後重跑引擎（只刷顯示不動 macros）；判定變了會回聲一句
                return true
              } catch { showToast('記錄失敗，請重試', 'error'); return false }
            }}
            showQuickSupplements={c.supplement_enabled && (c.supplements || []).length > 0 && !(todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total)}
            onQuickSupplements={async () => {
              try {
                // 一鍵「全部吃了」：把今天清單每個補品標完成（細項要改再進補品分頁）
                const sups = (c.supplements || []) as Array<{ id: string }>
                await Promise.all(sups.map(s => fetch('/api/supplement-logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, supplementId: s.id, date: today, completed: true }),
                })))
                await mutate()
                showToast('補品今天全部標完成', 'success')
                return true
              } catch { showToast('記錄失敗，請重試', 'error'); return false }
            }}
            showQuickWellness={c.wellness_enabled && !todayWellness}
            onQuickWellness={async (level) => {
              try {
                // 一鍵感受：好/普通/累 → 對應睡眠+精力+心情；要記睡眠分數/HRV 再進感受分頁
                const map = { good: 4, ok: 3, tired: 2 }[level]
                const res = await fetch('/api/daily-wellness', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, date: today, sleep_quality: map, energy_level: map, mood: map }),
                })
                if (!res.ok) throw new Error()
                await mutate()
                showToast('今天感受記好了', 'success')
                return true
              } catch { showToast('記錄失敗，請重試', 'error'); return false }
            }}
            showQuickTraining={c.training_enabled && !todayTraining}
            onQuickTraining={async (trainingType) => {
              try {
                // 一鍵訓練：選肌群=同時標記今天練了；要記重量/組數再進訓練分頁
                const res = await fetch('/api/training-logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, date: today, training_type: trainingType }),
                })
                if (!res.ok) throw new Error()
                await mutate()
                showToast(trainingType === 'rest' ? '今天休息日，記好了' : '今天訓練記好了', 'success')
                return true
              } catch { showToast('記錄失敗，請重試', 'error'); return false }
            }}
          />
        )}

        {/* === 「進度」分頁頭牌：你在贏嗎（作戰室 + 減脂體檢）—— 從首頁搬來，進度問句的單一去處 === */}
        {view === 'data' && (isCompetition || c.prep_phase === 'cut' || /cut|loss|fat|減/.test((c.goal_type || '').toLowerCase())) && (
          <div className="space-y-4 mb-4">
            {isCompetition && c.competition_date && (
              <CompWarRoom
                bodyData={clientData.bodyData ?? EMPTY_ARRAY}
                competitionDate={c.competition_date}
                targetWeight={c.target_weight}
                targetBodyFat={c.target_body_fat}
                prepPhase={c.prep_phase}
              />
            )}
            <CutHealthCard
              bodyData={clientData.bodyData ?? EMPTY_ARRAY}
              wellness={clientData.wellness ?? EMPTY_ARRAY}
              currentWeight={latestBodyData?.weight ?? null}
            />
          </div>
        )}

        {/* 推播開通 — 下移到行動/判決卡之後（留存槓桿但不佔第一屏；gated，含 iPhone 加主畫面引導）*/}
        {view === 'home' && isToday && <div className="mb-4"><PushNotificationPrompt code={c.unique_code} /></div>}

        {/* === 系統校正狀態（一行，讓學員看得到引擎在算、為何按住、何時再動）=== */}
        {view === 'home' && (
        <EngineStatusLine
          caloriesTarget={c.calories_target}
          autoAdjustEnabled={c.auto_adjust_enabled}
          lastAutoAdjustAt={c.last_auto_adjust_at}
          coachOverride={c.coach_macro_override}
          competitionDate={c.competition_date}
          targetDate={c.target_date}
        />
        )}

        {/* === 我的完整數據入口 === */}
        {view === 'data' && (
        <Link
          href={`/c/${c.unique_code}/overview`}
          className="block bg-white border border-slate-200 rounded-2xl p-5 hover:bg-slate-50 transition-colors mb-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">My Data</p>
              <p className="text-lg font-bold tracking-tight mt-1 text-slate-900">完整數據儀表板</p>
              <p className="text-xs text-slate-500 mt-0.5">趨勢、日曆、累積成果</p>
            </div>
            <span className="text-2xl text-primary-600 font-light">→</span>
          </div>
        </Link>
        )}

        {/* 性別未設定提示 — 僅 free/self_managed 可自行設定，coached 由教練處理 */}
        {view === 'more' && !c.gender && (isFree || isSelfManaged) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <p className="text-sm font-medium text-slate-900 mb-2">請設定你的生理性別</p>
            <p className="text-xs text-slate-500 mb-3">性別會影響蛋白質、脂肪建議量及荷爾蒙安全底線的計算。未設定時系統預設為男性參數。</p>
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
                  className="py-2.5 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
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

        {/* 身體數據記錄 — DO section 第一項 */}
        {view === 'data' && c.body_composition_enabled && (
          <SectionErrorBoundary name="body-composition">
          <CollapsibleSection
            id="section-body"
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
              targetDate={clientData.client.target_date}
              simpleMode={clientData.client.simple_mode}
              goalType={clientData.client.goal_type}
              prepPhase={clientData.client.prep_phase}
              tier={c.subscription_tier || 'free'}
              caloriesTarget={c.calories_target}
              proteinTarget={c.protein_target}
              height={latestByField.height?.height ?? null}
              hasLineBinding={!!c.has_line_binding}
              uniqueCode={c.unique_code}
              onMutate={mutateWithTargetsAndRefreshEngine}
            />
            {isCompetition && latestBodyData?.body_fat && (
              <StageWeightEstimator
                currentWeight={latestBodyData.weight}
                currentBodyFat={latestBodyData.body_fat}
                targetWeight={c.target_weight}
                targetBodyFat={c.target_body_fat}
                competitionDate={c.competition_date}
              />
            )}
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* 營養目標設定 — 免費/自主管理用戶還沒設定目標時顯示 */}
        {view === 'training' && (isFree || isSelfManaged) && !c.calories_target && c.body_composition_enabled && (
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
            isTrainingDay={isTrainingDayResolved}
            latestWeight={latestBodyData?.weight || null}
            latestBodyFat={latestBodyData?.body_fat || null}
            clientHeight={null}
            onMutate={mutate}
          />
        )}

        {/* 備賽處方（今日飲食目標 / 分餐蛋白 / 血檢建議）— 計畫分頁，與 SeeTabSection 進度分頁的 GoalDrivenStatus 共用同一元件、只是渲染另一半 */}
        {view === 'training' && isCompetition && c.nutrition_enabled && (
          <SectionErrorBoundary name="goal-driven-plan">
            <GoalDrivenStatus
              section="plan"
              clientId={c.id}
              code={c.unique_code}
              isTrainingDay={isTrainingDayResolved}
              targetWeight={c.target_weight}
              initialData={nutritionEngineSuggestion}
              dbTargets={{
                calories: c.calories_target,
                protein: c.protein_target,
                fat: c.fat_target,
                carbsTrainingDay: c.carbs_training_day,
                carbsRestDay: c.carbs_rest_day,
              }}
            />
          </SectionErrorBoundary>
        )}

        {/* 目標設定（備賽）— 從進度分頁搬來：改目標是「計畫」的事，進度只看「在贏嗎」 */}
        {view === 'training' && isCompetition && (
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

        {/* 飲食目標 + 飲食紀錄 */}
        {view === 'training' && c.nutrition_enabled && (
          <SectionErrorBoundary name="nutrition">
          <CollapsibleSection
            id={isCompetition ? 'section-nutrition' : 'section-nutrition-general'}
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
                  <span className="text-[11px] text-amber-500">{coachOverrideInfo.reason}</span>
                )}
              </div>
            )}
            {/* 教練模式：顯示系統建議值 */}
            {isCoachMode && coachOverrideInfo && nutritionEngineSuggestion && (
              nutritionEngineSuggestion.suggestedCalories != null || nutritionEngineSuggestion.suggestedProtein != null
            ) && (
              <div className="bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 mb-2">
                <p className="text-[11px] text-primary-500">
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
            {/* 🏃 今日 cardio 目標（教練或 AI Agent 核准的）*/}
            {!isFree && (c as any).cardio_minutes_per_day && (
              <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl">🏃</div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">教練建議今日 cardio</p>
                    <p className="text-2xl font-bold text-emerald-700">{(c as any).cardio_minutes_per_day} 分鐘</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Zone 2（鼻呼吸還能講話）· 116-136 bpm</p>
                  </div>
                </div>
              </div>
            )}
            {/* 一般學員（非免費）的飲食目標卡片 */}
            {!isCompetition && !isFree && (c.calories_target || c.protein_target || c.carbs_target || c.fat_target || c.carbs_training_day || c.carbs_rest_day) && (
              <DailyNutritionTarget
                caloriesTarget={c.calories_target}
                proteinTarget={c.protein_target}
                carbsTarget={c.carbs_target}
                fatTarget={c.fat_target}
                carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
                isTrainingDay={isTrainingDayResolved}
                carbsTrainingDay={c.carbs_training_day}
                carbsRestDay={c.carbs_rest_day}
                geneticCorrections={geneCorrections}
                engineStatus={nutritionEngineSuggestion ? {
                  status: nutritionEngineSuggestion.status,
                  statusLabel: nutritionEngineSuggestion.statusLabel || '',
                  message: nutritionEngineSuggestion.message || '',
                } : null}
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
                ? (isTrainingDayResolved ? c.carbs_training_day : c.carbs_rest_day)
                : c.carbs_target}
              carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
              isTrainingDay={isTrainingDayResolved}
              carbsTrainingDay={c.carbs_training_day}
              carbsRestDay={c.carbs_rest_day}
              fatTarget={c.fat_target}
              caloriesTarget={c.calories_target}
              simpleMode={c.simple_mode}
              sodiumTarget={c.prep_phase === 'peak_week' ? c.sodium_target : null}
              onMutate={mutateAndRefreshEngine}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}


        {/* 補品策略（引擎依血檢/基因推導的「為什麼」，端給學員看）*/}
        {view === 'training' && isToday && supplementSuggestions.length > 0 && (
          <SectionErrorBoundary name="supplement-strategy">
            <SupplementStrategyCard suggestions={supplementSuggestions} />
          </SectionErrorBoundary>
        )}

        {/* 補品打卡 */}
        {view === 'training' && c.supplement_enabled && (
          <SectionErrorBoundary name="supplements">
          <CollapsibleSection
            id="section-supplements"
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
              clientId={clientId as string}
              onToggleSupplement={handleToggleSupplement}
              onMarkAllComplete={handleMarkAllSupplementsComplete}
              onManageSupplements={() => setShowSupplementModal(true)}
              onMutate={mutate}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* 每日感受 */}
        {view === 'lab' && c.wellness_enabled && (
          <SectionErrorBoundary name="wellness">
          <CollapsibleSection
            id="section-wellness"
            title="每日感受"
            isCompleted={!!todayWellness}
            summaryLine={todayWellness ? `睡眠 ${todayWellness.sleep_quality ?? '--'}/5 | 精力 ${todayWellness.energy_level ?? '--'}/5 | 想練 ${todayWellness.training_drive ?? '--'}/5` : undefined}
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
          {/* 恢復判決放在折疊區「外面」且不綁 isToday——記過感受會自動收合、恢復評估本來就是「當前」狀態，
              一律顯示(只要有開 wellness)，才不會像之前那樣找不到 */}
          <div className="mt-3">
            <RecoveryDashboard clientId={c.unique_code} recentWellness={clientData.wellness || []} trainingPlan={c.training_plan} />
          </div>
          </SectionErrorBoundary>
        )}

        {/* 今日訓練計畫（教練指導用戶 + 有訓練計畫） */}
        {view === 'training' && c.training_enabled && c.training_plan && c.subscription_tier === 'coached' && (
          <SectionErrorBoundary name="today-workout">
          <TodayWorkout trainingPlan={c.training_plan} todayTrainingType={todayTraining?.training_type} onOverrideTypeChange={setSwitchedTrainingType} />
          </SectionErrorBoundary>
        )}
        {view === 'training' && c.training_enabled && !c.training_plan && c.subscription_tier === 'coached' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-3 text-center">
            <p className="text-sm text-slate-700">📋 教練將為你製作個人化訓練計畫</p>
            <p className="text-[11px] text-slate-400 mt-1">設定完成後會顯示在這裡</p>
          </div>
        )}

        {/* 訓練紀錄 */}
        {view === 'training' && c.training_enabled && (
          <SectionErrorBoundary name="training">
          <CollapsibleSection
            id="section-training"
            title="訓練紀錄"
            isCompleted={!!todayTraining}
            summaryLine={todayTraining ? `${(() => { const t = TRAINING_TYPES.find(x => x.value === todayTraining.training_type); return t ? `${t.emoji} ${t.label}` : '訓練' })()}${todayTraining.rpe ? ` · RPE ${todayTraining.rpe}` : ''}` : undefined}
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
              overrideType={switchedTrainingType}
              trainingPlan={c.training_plan}
              tier={c.subscription_tier || 'free'}
            />
          </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* === Onboarding & Upgrade（DO section 之後） === */}
        {view === 'more' && (() => {
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
          const hasLineBinding = !!c.has_line_binding
          const trainingEnabled = !!c.training_enabled
          const wellnessEnabled = !!c.wellness_enabled
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

        {view === 'more' && (
        <UpgradeWelcome
          clientId={c.unique_code}
          tier={c.subscription_tier}
          todayBody={!!latestBodyData && latestBodyData.date === today}
          todayNutrition={!!todayNutrition}
          todayTraining={!!todayTraining}
          todayWellness={!!todayWellness}
          supplementCount={(c.supplements || []).length}
          labResultCount={(c.lab_results || []).length}
          hasGeneData={!!c.gene_mthfr}
          onOpenAiChat={() => setShowAiChat(true)}
        />
        )}

        {/* ================================================================ */}
        {/* === SEE section: 被動資訊（記錄完再看） === */}
        {/* ================================================================ */}

        {/* HealthOverview 概覽 — 暫藏 2026-06-12（與 TodayOverviewCard 指標重疊；移除 false && 即還原） */}
        {view === 'data' && false && <SectionErrorBoundary name="health-overview">
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
        </SectionErrorBoundary>}

        {/* 健康分數 + 健康模式進階 */}
        {/* 感受趨勢：從 SeeTabSection(進度) 抽來「健康」分頁，跟每日感受記錄同區 */}
        {view === 'lab' && c.wellness_enabled && (
          <div className="mb-4"><WellnessTrend wellness={clientData.wellness || []} /></div>
        )}

        {view === 'lab' && isHealthMode && healthScore && <HealthScoreBanner healthScore={healthScore} />}
        {view === 'lab' && isHealthMode && (
          <HealthModeAdvanced clientId={c.id} code={c.unique_code} />
        )}

        {/* 教練資訊（從頂部移到這裡） */}
        {view === 'more' && (c.coach_last_viewed_at || c.coach_weekly_note || c.coach_summary) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="text-xs font-semibold text-amber-700">教練回饋</span>
              </div>
              {c.coach_last_viewed_at && (
                <span className="text-[11px] text-gray-400">
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
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors"
                >
                  <ChevronDown size={12} className={`transition-transform ${showCoachSummary ? 'rotate-180' : ''}`} />
                  {showCoachSummary ? '收起健康分析' : '查看健康分析'}
                </button>
                {showCoachSummary && (
                  <div className="bg-white/60 rounded-xl p-3 mt-2">
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.coach_summary}</p>
                    {(c.next_checkup_date || c.health_goals) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-amber-200/50">
                        {c.next_checkup_date && new Date(c.next_checkup_date + 'T00:00:00') >= new Date(new Date().setHours(0,0,0,0)) && <span className="text-xs text-primary-600">📅 下次回檢：{new Date(c.next_checkup_date).toLocaleDateString('zh-TW')}</span>}
                        {c.health_goals && <span className="text-xs text-primary-600">🎯 {c.health_goals}</span>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === 'data' && (
        <DayBasedCards
          client={c}
          isFree={isFree}
          isSelfManaged={isSelfManaged}
          nutritionLogs={clientData.nutritionLogs || []}
          setShowAiChat={setShowAiChat}
        />
        )}

        {view === 'data' && (
        <SeeTabSection
          c={c}
          clientData={clientData}
          isFree={isFree}
          latestBodyData={latestBodyData}
          nutritionEngineSuggestion={nutritionEngineSuggestion}
          geneCorrections={geneCorrections}
          todayTraining={todayTraining}
          isCompetition={isCompetition}
          mutateWithTargets={mutateWithTargets}
          selectedDate={selectedDate}
          today={today}
          hideWellnessTrend={true}
        />
        )}

        {/* ============================================================
            📊 進階分析（預設折疊：智能營養 / 每週分析 / AI 洞察）
            ============================================================ */}
        {view === 'data' && (() => {
          const hasAdvanced =
            (!isCompetition && (isSelfManaged || isFree) && c.body_composition_enabled && c.calories_target) ||
            (!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && c.body_composition_enabled) ||
            (!isCompetition && isFree && c.body_composition_enabled)
          if (!hasAdvanced) return null

          return (
            <details className="group bg-white border border-gray-200 rounded-2xl mb-3 overflow-hidden">
              <summary className="cursor-pointer px-4 py-3 list-none flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <span className="text-sm font-medium text-gray-900">進階分析</span>
                  <span className="text-[11px] text-gray-400">智能營養 / 每週洞察</span>
                </div>
                <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
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
                    isTrainingDay={isTrainingDayResolved}
                    latestWeight={latestBodyData?.weight || null}
                    latestBodyFat={latestBodyData?.body_fat || null}
                    clientHeight={c.height || null}
                    geneticCorrections={geneCorrections}
                    onMutate={mutate}
                  />
                )}
                {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && c.body_composition_enabled && (
                  <WeeklyInsight clientId={c.id} code={c.unique_code} onMutate={mutate} />
                )}
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
              </div>
            </details>
          )
        })()}

        {/* WellnessTrend 已移至 SeeTabSection 的分析 tab */}

        {/* ================================================================ */}
        {/* === REFERENCE section: 參考資料（少變動） === */}
        {/* ================================================================ */}

        {/* 推薦好友卡片 — 至少使用 7 天以上且非免費用戶才顯示 */}
        {view === 'more' && c.created_at && (() => {
          const daysSinceSignup = Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY_MS)
          if (daysSinceSignup < 7) return null
          if (c.subscription_tier === 'free' && streakDays < 7) return null
          return <ReferralCard clientId={c.unique_code} />
        })()}

        {/* ============================================================
            ⚙️ 設定 / 工具（預設折疊：基因檔案 / 目標設定）
            ============================================================ */}
        {view === 'more' && (
        <details className="group bg-white border border-gray-200 rounded-2xl mb-3 overflow-hidden">
          <summary className="cursor-pointer px-4 py-3 list-none flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <span className="text-sm font-medium text-gray-900">設定 / 工具</span>
              <span className="text-[11px] text-gray-400">基因檔案 · 目標設定</span>
            </div>
            <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
            {/* 基因檔案卡片 */}
            {(isFree || isSelfManaged) ? (
              <UpgradeGate
                feature="基因檔案"
                description="升級教練方案後可填寫基因檢測結果，獲得個人化營養建議"
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
              <div data-section="goal-settings">
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
          </div>
        </details>
        )}

        {view === 'lab' && c.lab_enabled && (
          <div id="section-lab" className="scroll-mt-4 mb-4">
            {(() => {
              const labs = c.lab_results || []
              if (labs.length === 0) {
                // 空狀態：直接導向上傳
                return (
                  <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center">
                    <div className="text-sm text-gray-700 font-medium mb-1">🩸 還沒有血檢資料</div>
                    <div className="text-xs text-gray-500 mb-4">上傳一份健檢報告就能開始追蹤</div>
                    <Link
                      href={`/c/${clientId}/health/upload`}
                      className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded"
                    >
                      📥 上傳血檢
                    </Link>
                  </div>
                )
              }
              // 計算最近一筆抽血日期 + 該日有幾筆指標
              const latestDate = labs.reduce(
                (max: string, r: { date: string }) => (r.date > max ? r.date : max),
                labs[0].date as string,
              )
              const latestCount = labs.filter((r: { date: string }) => r.date === latestDate).length
              // 該日異常 / 注意項數量
              const latestRows = labs.filter((r: { date: string }) => r.date === latestDate)
              const alertCount = latestRows.filter((r: { status?: string }) => r.status === 'alert').length
              const attnCount = latestRows.filter((r: { status?: string }) => r.status === 'attention').length
              // 血檢旅程：抽血次數 + 橫跨月數（突出「整個進程」）
              const testDates = [...new Set(labs.map((r: { date: string }) => r.date))].sort()
              const drawCount = testDates.length
              const firstDate = testDates[0] as string | undefined
              const spanMonths = firstDate ? Math.max(1, Math.round((new Date(latestDate).getTime() - new Date(firstDate).getTime()) / (30 * 86400000))) : 0

              return (
                <>
                  <Link
                    href={`/c/${clientId}/health/timeline`}
                    className="block bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-2xl p-5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-emerald-900">🩸 你的血檢旅程</span>
                          {(alertCount > 0 || attnCount > 0) && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                              {alertCount > 0 ? `${alertCount} 警示` : `${attnCount} 注意`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-emerald-800 font-medium">
                          已追蹤 {drawCount} 次抽血{spanMonths > 0 ? ` · 橫跨 ${spanMonths} 個月` : ''} · {labs.length} 筆指標
                        </div>
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          最近 {latestDate}（{latestCount} 項）· Howard 最佳化範圍 · 看完整時間軸 →
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
                    </div>
                  </Link>
                  {/* 最新這批血檢的實際數值 — 直接顯示，不用點進時間軸才看得到 */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-2">
                    <p className="text-sm font-semibold text-gray-900 mb-3">🩸 最新血檢 · {latestDate}（{latestCount} 項）</p>
                    <div className="space-y-1.5">
                      {latestRows.map((r: { test_name: string; value: number; unit?: string; status?: string }, i: number) => {
                        const prev = labs
                          .filter((x: { test_name: string; date: string }) => x.test_name === r.test_name && x.date < latestDate)
                          .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))[0] as { value: number } | undefined
                        const dot = r.status === 'alert' ? 'bg-rose-500' : r.status === 'attention' ? 'bg-amber-400' : 'bg-emerald-400'
                        const col = r.status === 'alert' ? 'text-rose-600' : r.status === 'attention' ? 'text-amber-700' : 'text-gray-900'
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-gray-700"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{r.test_name}</span>
                            <span className="tabular-nums">
                              {prev != null && Number(prev.value) !== Number(r.value) && <span className="text-gray-400 text-xs">{prev.value}→</span>}
                              <span className={`font-semibold ${col}`}>{r.value}</span>
                              <span className="text-gray-400 text-xs"> {r.unit || ''}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">趨勢圖、最佳範圍、判讀 → 點上方卡片看完整時間軸</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs px-1">
                    <Link
                      href={`/c/${clientId}/health/upload`}
                      className="bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 flex-1 justify-center"
                    >
                      📥 上傳新血檢
                    </Link>
                    <Link
                      href={`/c/${clientId}/health/standards`}
                      className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-1.5"
                    >
                      📏 標準對照
                    </Link>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* 更多分析 — 預設收合以減少滑動長度 */}
        {view === 'lab' && (() => {
          const hasLabAnalysis = c.lab_enabled && c.lab_results && c.lab_results.length > 0
          const hasAi = c.ai_chat_enabled
          if (!hasLabAnalysis && !hasAi) return null
          return (
            <SectionErrorBoundary name="advanced-analysis">
              <button
                onClick={() => setShowMoreAnalysis(prev => !prev)}
                className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors border border-gray-100"
              >
                <span className="text-xs text-gray-400">
                  {showMoreAnalysis ? '收合' : '展開'} 過往分析報告（規則式建議 + AI 洞察 — 建議優先看上方儀表板）
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showMoreAnalysis ? 'rotate-180' : ''}`} />
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
                  {/* LabInsightsCard 暫藏 2026-06-12（變化追蹤/複檢提醒與 /health/timeline「血檢旅程」重複；移除 false && 即還原） */}
                  {false && hasLabAnalysis && (
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
                        isTrainingDay={isTrainingDayResolved}
                      />
                    </div>
                  )}
                </>
              )}
            </SectionErrorBoundary>
          )
        })()}

        {/* 免費用戶升級提示（使用數據後提示） */}
        {view === 'more' && isFree && streakDays >= 3 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
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
              className="block text-center bg-primary-600 text-white text-sm font-bold py-3 rounded-xl hover:bg-primary-700 transition-colors"
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
        {view === 'more' && isSelfManaged && streakDays >= 7 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
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
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">開啟 LINE 後輸入「升級」即可</p>
          </div>
        )}

        {/* 未開放功能提示 */}
        {view === 'more' && (() => {
          const locked = []
          if (!c.wellness_enabled) locked.push({ icon: '😊', label: '每日感受紀錄' })
          if (!c.nutrition_enabled) locked.push({ icon: '🥗', label: '飲食追蹤' })
          if (!c.training_enabled) locked.push({ icon: '🏋️', label: '訓練追蹤' })
          if (!c.supplement_enabled) locked.push({ icon: '💊', label: '補品管理' })
          if (!c.lab_enabled) locked.push({ icon: '🩸', label: '血檢追蹤' })
          if (locked.length === 0) return null
          return (
            <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200">
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
                    className="block text-center bg-primary-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
                  >
                    升級自主管理版 NT$499/月
                  </Link>
                  <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="block text-center bg-[#06C755] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#05b04d] transition-all">
                    加 LINE 找 Howard
                  </a>
                </div>
              ) : isSelfManaged ? (
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/upgrade?from=self_managed`}
                    onClick={() => trackEvent('upgrade_cta_clicked', { source: 'locked_features_self_managed' })}
                    className="block text-center bg-primary-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
                  >
                    升級教練方案解鎖 →
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-3 text-center">和教練討論開啟更多追蹤功能</p>
              )}
            </div>
          )
        })()}

        {/* 完整健康報告入口（與教練看到的同一份；點開可看 + 列印存 PDF，學員自助、教練不用再傳）
            注意：gate 改用「有血檢資料」而非 isCoachMode——isCoachMode 是教練 PIN 模式，
            學員本人看不到，那樣就達不到「學員自助」的目的。*/}
        {view === 'lab' && isToday && (c.lab_results?.length ?? 0) > 0 && (
          <Link
            href={`/c/${c.unique_code}/report`}
            className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-primary-300 hover:shadow transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-2xl leading-none">📄</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">看我的完整健康報告</p>
                <p className="text-xs text-gray-500 mt-0.5">本次重點、血檢趨勢、補品、下次回診建議——可列印存檔</p>
              </div>
            </div>
            <span className="text-primary-600 text-sm shrink-0">開啟 →</span>
          </Link>
        )}

        {/* 訓練進步追蹤（有逐組紀錄才顯示）*/}
        {view === 'training' && isToday && c.training_enabled && (
          <div className="mt-4"><TrainingProgressCardLazy clientCode={c.unique_code} /></div>
        )}

        {view === 'more' && !isFree && <PwaPrompt />}
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

      {/* AI 飲食顧問浮動按鈕 — 圓形 icon-only，壓到內容的面積最小化；額度資訊進抽屜再講 */}
      {c.nutrition_enabled && (
        <button
          onClick={() => setShowAiChat(true)}
          aria-label="AI 顧問"
          title="AI 顧問"
          className="fixed z-40 w-12 h-12 bg-primary text-white rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{ bottom: 'calc(70px + env(safe-area-inset-bottom))', right: '16px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}


      {/* AI 聊天抽屜（付費用戶 + 健康模式用戶 + 免費用戶月度免費額度） */}
      {(c.nutrition_enabled || isHealthMode) && (
        <AiChatDrawer
          open={showAiChat}
          onClose={() => { setShowAiChat(false); setAiChatInitialPrompt(undefined) }}
          initialPrompt={aiChatInitialPrompt}
          isCoachMode={isCoachMode}
          clientId={c.unique_code}
          clientName={c.name}
          gender={c.gender}
          goalType={c.goal_type}
          todayNutrition={todayNutrition}
          caloriesTarget={c.calories_target}
          proteinTarget={c.protein_target}
          carbsTarget={c.carbs_training_day && c.carbs_rest_day
            ? (isTrainingDayResolved ? c.carbs_training_day : c.carbs_rest_day)
            : c.carbs_target}
          fatTarget={c.fat_target}
          waterTarget={c.water_target}
          isTrainingDay={isTrainingDayResolved}
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
        // 真分頁：一次顯示一個畫面。點 tab = 切換畫面 + 捲回頂部（不再是捲到底）。
        // IA 改成「使用者的問句」而非「資料種類」：今日=做什麼 / 進度=在贏嗎 / 計畫=照什麼做 / 健康=身體怎樣。
        // 內部 view id 不動（避免大改），只換 label+icon。
        const tabs: { id: string; icon: string; label: string }[] = [
          { id: 'home', icon: '🎯', label: '今日' },
          { id: 'data', icon: '📈', label: '進度' },
        ]
        // 計畫=處方（課表＋營養＋補品），健康=身體（血檢＋恢復）：任一內容存在就顯示該分頁，
        // 不然把營養搬進「計畫」後、只有營養沒訓練的學員會看不到。
        if (c.training_enabled || c.nutrition_enabled || c.supplement_enabled) tabs.push({ id: 'training', icon: '📋', label: '計畫' })
        if (c.lab_enabled || c.wellness_enabled) tabs.push({ id: 'lab', icon: '🩺', label: '健康' })
        tabs.push({ id: 'more', icon: '☰', label: '更多' })

        // 「今日」分頁：當天該打的卡全打完 → 顯示綠點
        const homeDone = (!c.body_composition_enabled || !!(latestBodyData && latestBodyData.date === selectedDate))
          && (!c.nutrition_enabled || !!todayNutrition)
          && (!c.wellness_enabled || !!todayWellness)
          && (!c.training_enabled || !!todayTraining)
        const completedMap: Record<string, boolean> = { home: homeDone }

        return (
          <BottomNav
            tabs={tabs}
            activeTab={view}
            completedMap={completedMap}
            isToday={isToday}
            onTabClick={(id) => {
              setView(id as 'home' | 'data' | 'training' | 'lab' | 'more')
              window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {/* 法律連結 footer */}
      <div className="max-w-4xl mx-auto px-4 pb-24 pt-4">
        <div className="text-center text-[11px] text-gray-400 space-x-2 border-t border-gray-100 pt-3">
          <Link href="/terms" className="hover:underline">服務條款</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:underline">隱私政策</Link>
          <span>·</span>
          <Link href="/medical-disclaimer" className="hover:underline">醫療免責聲明</Link>
          <span>·</span>
          <Link href="/refund-policy" className="hover:underline">退費政策</Link>
        </div>
        <p className="text-center text-[11px] text-gray-300 mt-2">
          本服務為健康管理工具，不構成醫療建議。緊急情況請撥 119。
        </p>
      </div>
    </div>
    </ErrorBoundary>
  )
}
