'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useClientData } from '@/hooks/useClientData'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useCoachMode } from '@/hooks/useCoachMode'
import { Lock, Unlock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings } from 'lucide-react'
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
import { isWeightTraining } from '@/components/client/types'
import NutritionLog from '@/components/client/NutritionLog'
import DailyNutritionTarget from '@/components/client/DailyNutritionTarget'
import PeakWeekPlan from '@/components/client/PeakWeekPlan'
import GoalDrivenStatus from '@/components/client/GoalDrivenStatus'
import WeeklyInsight from '@/components/client/WeeklyInsight'
const SelfManagedNutrition = dynamic(() => import('@/components/client/SelfManagedNutrition'), { ssr: false })
import PwaPrompt from '@/components/client/PwaPrompt'
import { calcRecommendedStageWeight } from '@/lib/stage-weight'
import { calculateHealthScore } from '@/lib/health-score-engine'

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
import { generateSupplementSuggestions } from '@/lib/supplement-engine'
import { getLocalDateStr } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'
import { trackEvent } from '@/lib/analytics'
import ABTest from '@/components/ABTest'
import { trackConversion, peekVariant } from '@/lib/ab-testing'
import ErrorBoundary from '@/components/ErrorBoundary'

// ── Module-level constants (avoid re-creation on every render) ──

const PILLARS_EXPLAIN: Record<string, string> = {
  wellness: '身心狀態 25%',
  nutrition: '營養合規 20%',
  training: '訓練規律 20%',
  supplement: '補品服從 15%',
  lab: '血檢結果 20%',
}

const PILLAR_TIPS: Record<string, string> = {
  wellness: '多休息、保持正面心態',
  nutrition: '注意營養目標的執行',
  training: '保持規律的訓練頻率',
  supplement: '別忘了每天的補品打卡',
  lab: '可考慮安排血檢追蹤',
}

const PHASE_LABELS: Record<string, string> = {
  off_season: '休賽期',
  bulk: '增肌期',
  cut: '減脂期',
  peak_week: 'Peak Week',
  competition: '比賽日',
  recovery: '賽後恢復',
}

const PHASE_OPTIONS = [
  { value: 'off_season', label: '休賽期', icon: '🌙' },
  { value: 'bulk', label: '增肌期', icon: '💪' },
  { value: 'cut', label: '減脂期', icon: '🔥' },
  { value: 'peak_week', label: 'Peak Week', icon: '⚡' },
  { value: 'competition', label: '比賽日', icon: '🏆' },
  { value: 'recovery', label: '賽後恢復', icon: '🧘' },
] as const

/** Dismissable retention card — stores dismissed state in localStorage */
function RetentionCard({ children, onDismiss, id }: { children: React.ReactNode; onDismiss: () => void; id: string }) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(`retention_${id}_dismissed`)) {
      setDismissed(true)
    }
  }, [id])
  if (dismissed) return null
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mb-3 relative">
      <button
        onClick={() => {
          localStorage.setItem(`retention_${id}_dismissed`, '1')
          setDismissed(true)
          onDismiss()
        }}
        className="absolute top-2 right-2 text-gray-300 hover:text-gray-500 transition-colors p-1"
        aria-label="關閉"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      {children}
    </div>
  )
}

/** Day 14 TDEE Calibration WOW Moment Card */
function TDEECalibrationCard({ client }: { client: any }) {
  const [dismissed, setDismissed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(`tdee_calibration_${client.id}_seen`)) {
      setDismissed(true)
    }
  }, [client.id])

  if (dismissed) return null

  // Calculate initial vs calibrated TDEE difference
  const initialTDEE = client.calories_target ? Math.round(client.calories_target / 0.8) : null // rough estimate of original TDEE
  const currentCalories = client.calories_target
  if (!currentCalories) return null

  // We show the card as a "report" style
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5 mb-3 shadow-sm">
      <div className="text-center mb-4">
        <span className="text-3xl">🧠</span>
        <h3 className="text-base font-bold text-gray-900 mt-2">14 天智能校正完成</h3>
      </div>

      <div className="bg-white/70 rounded-xl p-4 mb-4 space-y-3">
        <p className="text-xs text-gray-500 text-center">
          根據你過去 14 天的真實體重趨勢，系統已自動校正你的代謝估算。
        </p>
        {initialTDEE && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">初始估算 TDEE</p>
              <p className="text-lg font-bold text-gray-500">{initialTDEE.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-indigo-500">校正後目標熱量</p>
              <p className="text-lg font-bold text-indigo-700">{currentCalories.toLocaleString()}</p>
              <p className="text-[10px] text-indigo-500">kcal</p>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          你的新目標已自動更新 ✓
        </p>
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs text-gray-500">想知道接下來怎麼調整策略？</p>
        <a
          href="https://lin.ee/LP65rCc"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('tdee_calibration_line_click')}
          className="inline-block bg-[#06C755] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#05b04d] transition-colors"
        >
          💬 加 LINE 找 Howard 分析
        </a>
      </div>

      {!confirmed ? (
        <button
          onClick={() => {
            setConfirmed(true)
            localStorage.setItem(`tdee_calibration_${client.id}_seen`, '1')
            trackEvent('tdee_calibration_confirmed')
            setTimeout(() => setDismissed(true), 500)
          }}
          className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          我知道了
        </button>
      ) : (
        <p className="text-center text-xs text-green-500 mt-3">✓ 已確認</p>
      )}
    </div>
  )
}

export default function ClientDashboard() {
  const { clientId } = useParams()
  const { data: clientData, error, isLoading, mutate } = useClientData(clientId as string)

  // 儲存 clientId 到 localStorage，讓 PWA 從主畫面開啟時能跳轉到儀表板
  useEffect(() => {
    if (clientId && typeof window !== 'undefined') {
      localStorage.setItem('hp_client_id', clientId as string)
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
    const isPeakWeek = clientData?.client?.competition_enabled &&
      (clientData.client.prep_phase === 'peak_week' || clientData.client.prep_phase === 'competition')
    const maxDate = isPeakWeek ? tomorrow : today
    if (newDate > maxDate) return
    setSelectedDate(newDate)
  }

  const formatSelectedDate = (dateStr: string) => {
    if (dateStr === today) return '今天'
    if (dateStr === tomorrow) return '明天'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === getLocalDateStr(yesterday)) return '昨天'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
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

  const toggleSimpleMode = async () => {
    if (!clientData?.client) return
    const newVal = !clientData.client.simple_mode
    try {
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientData.client.unique_code, simple_mode: newVal })
      })
      if (!res.ok) throw new Error()
      mutate()
      showToast(newVal ? '已切換為簡單模式' : '已切換為完整模式', 'success')
      setShowSettings(false)
    } catch { showToast('切換失敗，請重試', 'error') }
  }

  const handleCancelSubscription = async () => {
    if (!clientData?.client) return
    setCancellingSubscription(true)
    try {
      const res = await fetch('/api/subscribe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientData.client.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '取消失敗')
      showToast('已取消定期定額，帳號可使用至到期日', 'success')
      setShowCancelConfirm(false)
      setShowSettings(false)
    } catch (err: any) {
      showToast(err.message || '取消失敗，請重試', 'error')
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
    const daysSinceSignup = Math.floor((Date.now() - new Date(clientData.client.created_at).getTime()) / 86400000)
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
      mutate((prev: any) => {
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
    const uncompleted = supplements.filter((s: any) => {
      const log = selectedDateLogs?.find((l: any) => l.supplement_id === s.id)
      return !log?.completed
    })
    if (uncompleted.length === 0) return
    // 把所有未完成的 supplement 加入 toggling 狀態
    setTogglingSupplements(prev => {
      const next = new Set(prev)
      uncompleted.forEach((s: any) => next.add(s.id))
      return next
    })
    try {
      const results = await Promise.all(uncompleted.map((s: any) =>
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

  // 生成補品建議（必須在所有條件 return 之前，遵守 React Hooks 規則）
  const supplementSuggestions = useMemo(() => {
    const c = clientData?.client
    if (!c) return []
    const isHealthMode = c.health_mode_enabled
    const isCompetition = c.competition_enabled
    const hasGenetics = !!(c.gene_mthfr || c.gene_apoe || c.gene_depression_risk)
    if (!isHealthMode && !isCompetition) return []
    if (!isHealthMode && !hasGenetics) return []
    const recentTraining = (clientData.trainingLogs || []).slice(-7)
    const hasHighRPE = recentTraining.filter((t: any) => t.rpe != null && t.rpe >= 9).length >= 3
    return generateSupplementSuggestions(
      (c.lab_results || []).map((r: any) => ({
        test_name: r.test_name,
        value: r.value,
        unit: r.unit,
        status: r.status,
      })),
      {
        gender: c.gender as '男性' | '女性' | undefined,
        isHealthMode,
        isCompetitionPrep: isCompetition,
        hasHighRPE,
        goalType: (c.goal_type as 'cut' | 'bulk' | null) || null,
        genetics: {
          mthfr: c.gene_mthfr as any,
          apoe: c.gene_apoe as any,
          depressionRisk: c.gene_depression_risk as any,
        },
        prepPhase: (c.prep_phase as 'off_season' | 'bulk' | 'cut' | 'peak_week' | 'competition' | 'recovery' | null) || null,
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

  // 所有有營養追蹤的學員：頁面載入時自動觸發營養引擎更新目標
  // 備賽客戶由 GoalDrivenStatus 處理，這裡處理一般學員
  const autoNutritionTriggered = useRef(false)
  useEffect(() => {
    const c = clientData?.client
    if (!c || !c.nutrition_enabled || !c.goal_type) return
    if (c.competition_enabled) return // 備賽客戶由 GoalDrivenStatus 處理
    if (autoNutritionTriggered.current) return
    autoNutritionTriggered.current = true

    const triggerAutoAdjust = async () => {
      try {
        const code = clientId as string
        const res = await fetch(`/api/nutrition-suggestions?clientId=${code}&autoApply=true&code=${code}`)
        if (!res.ok) {
          console.error('[AutoNutrition] API 失敗:', res.status)
          return
        }
        const json = await res.json()
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
        // 無論 applied 是否為 true，都刷新 SWR 確保 UI 顯示最新 DB 值
        if (mutate) {
          mutate()
        }
      } catch (err) {
        console.error('[AutoNutrition] 錯誤:', err)
      }
    }
    triggerAutoAdjust()
  }, [clientData?.client, clientId, mutate])

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
  const isCompetition = c.competition_enabled
  const isHealthMode = c.health_mode_enabled
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {c.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{c.name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.status === 'normal' ? 'bg-green-100 text-green-700'
                  : c.status === 'attention' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  {c.status === 'normal' ? '● 狀態良好' : '● 需要關注'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-full transition-colors text-gray-400 hover:bg-gray-100"
                >
                  <Settings size={18} />
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border p-4 z-50 w-56">
                    <p className="text-xs font-semibold text-gray-500 mb-3">顯示設定</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">簡單模式</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">只顯示核心欄位</p>
                      </div>
                      <button
                        onClick={toggleSimpleMode}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          c.simple_mode ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          c.simple_mode ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* 取消訂閱 */}
                    {c.subscription_tier !== 'free' && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        {!showCancelConfirm ? (
                          <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            取消定期定額
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-red-600 font-medium">確定要取消嗎？</p>
                            <p className="text-[10px] text-gray-500">取消後不再自動扣款，帳號可使用至到期日。</p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleCancelSubscription}
                                disabled={cancellingSubscription}
                                className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                              >
                                {cancellingSubscription ? '處理中...' : '確認取消'}
                              </button>
                              <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                返回
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={toggleCoachMode}
                  className={`p-2 rounded-full transition-colors ${isCoachMode ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  {isCoachMode ? <Unlock size={18} /> : <Lock size={18} />}
                </button>
                {showPinPopover && !isCoachMode && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border p-3 z-50 w-48">
                    <input
                      type="password"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                      placeholder="輸入教練密碼"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${pinError ? 'border-red-400' : 'border-gray-300'}`}
                      autoFocus
                    />
                    {pinError && <p className="text-xs text-red-500 mt-1">密碼錯誤</p>}
                    <button onClick={handlePinSubmit} className="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-sm hover:bg-blue-700">解鎖</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 日期導航 */}
          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-3 py-2 mb-3">
            <button onClick={() => changeDate(-1)} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center relative">
              <button
                onClick={() => {
                  const picker = document.getElementById('date-picker') as HTMLInputElement
                  if (picker) { picker.showPicker?.(); picker.focus() }
                }}
                className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${isToday ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
              >
                {formatSelectedDate(selectedDate)}
              </button>
              {(() => {
                const isPeakWeekNav = isCompetition && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition')
                const maxDate = isPeakWeekNav ? tomorrow : today
                return (
                  <input
                    id="date-picker"
                    type="date"
                    value={selectedDate}
                    max={maxDate}
                    onChange={(e) => {
                      if (e.target.value && e.target.value <= maxDate) setSelectedDate(e.target.value)
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                )
              })()}
              {!isToday && (
                <p className="text-xs text-gray-400 pointer-events-none">{new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</p>
              )}
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={isCompetition && (c.prep_phase === 'peak_week' || c.prep_phase === 'competition') ? selectedDate >= tomorrow : isToday}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 明日預覽 Banner */}
          {selectedDate > today && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-3 flex items-center gap-2">
              <span className="text-base">🔮</span>
              <p className="text-sm font-semibold text-indigo-700">明日預覽模式</p>
              <p className="text-xs text-indigo-500 ml-auto">查看明天的 Peak Week 計畫</p>
            </div>
          )}

          {/* 健康模式 Banner */}
          {isHealthMode && healthScore && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌿</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">健康優化模式</p>
                    {healthScore.daysInCycle != null && (
                      <p className="text-[10px] text-emerald-500">第 {healthScore.daysInCycle} 天 / 90 天季度</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-black text-emerald-700">{healthScore.total}</span>
                    <div>
                      <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${
                        healthScore.grade === 'A' ? 'bg-emerald-600 text-white' :
                        healthScore.grade === 'B' ? 'bg-blue-500 text-white' :
                        healthScore.grade === 'C' ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>{healthScore.grade}</span>
                      <p className="text-[10px] text-emerald-600">健康分數</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* 五柱進度條（附解釋） */}
              <div className="grid grid-cols-5 gap-1">
                {healthScore.pillars.map(p => {
                  return (
                    <div key={p.pillar} className="text-center">
                      <div className="text-base leading-none mb-1">{p.emoji}</div>
                      <div className="w-full bg-emerald-100 rounded-full h-1.5 mb-0.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            p.score >= 80 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                      <p className={`text-[9px] font-medium ${
                        p.score >= 80 ? 'text-emerald-600' : p.score >= 50 ? 'text-yellow-600' : 'text-red-500'
                      }`}>{p.score}</p>
                      <p className="text-[8px] text-gray-400">{p.label}</p>
                    </div>
                  )
                })}
              </div>
              {/* 血檢 & 獎勵加減分 */}
              {(healthScore.labBonus > 0 || healthScore.labPenalty < 0) && (
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  {healthScore.labBonus > 0 && (
                    <span className="text-emerald-600 font-medium bg-emerald-100 px-1.5 py-0.5 rounded">
                      +{healthScore.labBonus} 優秀獎勵
                    </span>
                  )}
                  {healthScore.labPenalty < 0 && (
                    <span className="text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                      {healthScore.labPenalty} 血檢異常
                    </span>
                  )}
                </div>
              )}
              {/* 最低分柱提示 */}
              {(() => {
                const lowest = [...healthScore.pillars].sort((a, b) => a.score - b.score)[0]
                if (lowest && lowest.score < 70) {
                  return (
                    <div className="mt-2 pt-2 border-t border-emerald-200">
                      <p className="text-xs text-amber-600 font-medium">
                        💡 {lowest.label}分數偏低（{lowest.score}分）— {PILLAR_TIPS[lowest.pillar] || '持續改善中'}
                      </p>
                    </div>
                  )
                }
                return null
              })()}
              {healthScore.daysUntilBloodTest != null && healthScore.daysUntilBloodTest <= 21 && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <p className="text-xs text-emerald-600 font-medium">
                    🩸 季度血檢倒數 {healthScore.daysUntilBloodTest} 天
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 健康模式進階功能：血檢飲食建議 + 季度對比 + 微營養素 */}
          {isHealthMode && (
            <HealthModeAdvanced clientId={c.id} code={c.unique_code} />
          )}

          {/* 備賽倒數 Banner */}
          {isCompetition && c.competition_date && (() => {
            const daysLeft = Math.ceil((new Date(c.competition_date).getTime() - new Date().getTime()) / 86400000)
            const phase = c.prep_phase || 'off_season'
            const urgencyColor = daysLeft <= 7 ? 'from-red-500 to-red-600' : daysLeft <= 14 ? 'from-amber-500 to-orange-500' : daysLeft <= 30 ? 'from-amber-400 to-yellow-500' : 'from-blue-500 to-blue-600'
            const urgencyBg = daysLeft <= 7 ? 'bg-red-50 border-red-200' : daysLeft <= 14 ? 'bg-amber-50 border-amber-200' : daysLeft <= 30 ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
            return (
              <div className={`${urgencyBg} border rounded-2xl p-4 mb-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏆</span>
                      <button
                        onClick={() => setShowPhaseSelector(!showPhaseSelector)}
                        className={`px-2 py-0.5 text-xs font-bold rounded-full text-white bg-gradient-to-r ${urgencyColor} flex items-center gap-1 transition-all active:scale-95`}
                      >
                        {PHASE_LABELS[phase] || phase}
                        <ChevronDown className={`w-3 h-3 transition-transform ${showPhaseSelector ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(c.competition_date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-gray-900">{Math.max(0, daysLeft)}</p>
                    <p className="text-xs text-gray-500 font-medium">{daysLeft > 0 ? '天後比賽' : daysLeft === 0 ? '今天比賽！' : '已結束'}</p>
                  </div>
                </div>
                {/* 階段選擇器 */}
                {showPhaseSelector && (
                  <div className="mt-3 pt-3 border-t border-gray-200/60">
                    <p className="text-xs text-gray-500 mb-2 font-medium">切換備賽階段</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PHASE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handlePrepPhaseChange(opt.value)}
                          disabled={updatingPhase || opt.value === phase}
                          className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                            opt.value === phase
                              ? 'bg-gray-900 text-white shadow-sm'
                              : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-sm active:scale-95'
                          } ${updatingPhase ? 'opacity-50' : ''}`}
                        >
                          <span className="block text-sm mb-0.5">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* 今日概覽卡片 */}
          {isToday && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <span className="text-sm font-semibold text-gray-700">今日概覽</span>
                </div>
                {overallStreak > 0 && (
                  <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm">
                    <span className="text-sm">🔥</span>
                    <span className="text-sm font-bold text-orange-600">{overallStreak}</span>
                    <span className="text-[10px] text-gray-500">天連續</span>
                  </div>
                )}
              </div>

              {/* 今日完成項目 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {todayCompletedItems.length > 0 ? (
                  todayCompletedItems.map(item => (
                    <span key={item.label} className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-2.5 py-1 text-xs font-medium">
                      <span>{item.icon}</span> {item.label} ✓
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">👋 今天還沒有紀錄，往下滑開始吧</p>
                )}
              </div>

              {/* 備賽模式：今日體重 vs 目標 */}
              {isCompetition && c.target_weight && latestBodyData?.weight && (
                <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                  {/* Peak Week 體重拆分 */}
                  {(() => {
                    const totalGap = Math.abs(latestBodyData.weight - c.target_weight)
                    const waterCutPct = 0.02  // 2% BW
                    const peakWeekLoss = Math.round(latestBodyData.weight * waterCutPct * 10) / 10
                    const prePeakTarget = Math.round((c.target_weight + peakWeekLoss) * 10) / 10
                    const dietGap = Math.max(0, Math.round((latestBodyData.weight - prePeakTarget) * 10) / 10)
                    const daysLeft = c.competition_date ? Math.ceil((new Date(c.competition_date).getTime() - Date.now()) / 86400000) : null
                    const showSplit = daysLeft != null && daysLeft > 7 && c.prep_phase !== 'peak_week'

                    return (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">⚖️ 最新</span>
                          <span className="text-sm font-bold text-gray-800">{latestBodyData.weight} kg</span>
                          <span className="text-xs text-gray-400">→</span>
                          <span className="text-xs text-gray-500">🎯 上台</span>
                          <span className="text-sm font-bold text-red-500">{c.target_weight} kg</span>
                          <span className={`text-xs font-medium ml-auto ${totalGap <= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                            差 {totalGap.toFixed(1)} kg
                          </span>
                        </div>
                        {showSplit && totalGap > peakWeekLoss && (
                          <div className="flex items-center gap-2 text-[10px] text-indigo-500 bg-indigo-50 rounded-lg px-2 py-1">
                            <span>💧 飲食目標 {dietGap} kg</span>
                            <span className="text-gray-300">+</span>
                            <span>Peak Week 約 {peakWeekLoss} kg</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                  {/* 體態推算參考範圍（需要體脂率才顯示） */}
                  {latestBodyData.body_fat && (() => {
                    const rec = calcRecommendedStageWeight(
                      latestBodyData.weight!,
                      latestBodyData.body_fat!,
                      c.gender ?? '男性',
                      latestBodyData.height
                    )
                    return (
                      <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                        <span>🔬 FFM {rec.ffm} kg</span>
                        <span className="text-gray-300">｜</span>
                        <span>參考上台範圍</span>
                        <span className="font-semibold text-blue-600">{rec.recommendedLow}–{rec.recommendedHigh} kg</span>
                        <span className="text-gray-400">（體脂 {rec.targetBFLow}–{rec.targetBFHigh}%）</span>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Day-based 導流提示（免費 / 自主管理用戶） */}
          {(isFree || isSelfManaged) && c.created_at && (() => {
            const daysSinceSignup = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)

            // 計算蛋白質達標率和熱量合規天數（Day 3 卡片用）
            const recentNutritionLogs = clientData.nutritionLogs || []
            const logsWithProtein = recentNutritionLogs.filter((n: any) => n.protein_grams != null)
            const pTarget = c.protein_target as number | null
            const proteinHitRate = logsWithProtein.length > 0 && pTarget
              ? Math.round((logsWithProtein.filter((n: any) => n.protein_grams >= pTarget * 0.9).length / logsWithProtein.length) * 100)
              : null
            const logsWithCalories = recentNutritionLogs.filter((n: any) => n.calories != null)
            const calTarget = c.calories_target as number | null
            const caloriesCompliantDays = logsWithCalories.length > 0 && calTarget
              ? logsWithCalories.filter((n: any) => Math.abs(n.calories - calTarget) <= calTarget * 0.1).length
              : null

            // Day 1-2 — 系統正在學習
            if (daysSinceSignup < 3) {
              return (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🧠</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-1">系統正在學習你的代謝特性</p>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">
                        你剛開始使用 Howard Protocol，系統需要約 14 天的數據才能精準計算你的實際 TDEE。
                      </p>
                      <div className="text-xs text-gray-500 leading-relaxed space-y-1">
                        <p>現階段請：</p>
                        <p>• 每天記錄體重（越準確越好）</p>
                        <p>• 正常飲食，不用刻意改變</p>
                      </div>
                      <p className="text-[10px] text-blue-500 mt-2">系統會在背景持續分析你的數據趨勢</p>
                    </div>
                  </div>
                </div>
              )
            }

            // P0: Day 3 — 第3天留存觸發卡片
            if (daysSinceSignup >= 3 && daysSinceSignup <= 4) {
              const totalLogDays = recentNutritionLogs.length
              return (
                <RetentionCard onDismiss={() => {}} id="day3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🎯</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 mb-2">你已連續記錄 {Math.min(totalLogDays, daysSinceSignup)} 天</p>
                      <div className="space-y-1.5 mb-3">
                        {proteinHitRate != null && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">蛋白質平均達標率</span>
                            <span className={`font-bold ${proteinHitRate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>{proteinHitRate}%</span>
                          </div>
                        )}
                        {caloriesCompliantDays != null && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">熱量合規天數</span>
                            <span className="font-bold text-gray-800">{caloriesCompliantDays}/{logsWithCalories.length} 天</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        系統正在學習你的代謝特性，繼續記錄到第 14 天，TDEE 會根據你的真實數據自動校正。
                      </p>
                    </div>
                  </div>
                </RetentionCard>
              )
            }

            // P1: Day 7 — AI 顧問預覽
            if (daysSinceSignup >= 7 && daysSinceSignup <= 10 && c.nutrition_enabled) {
              return (
                <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🤖</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 mb-1">試試 AI 飲食顧問</p>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3">
                        系統已經收集了一週的數據。你可以問 AI 顧問「今天剩下的量要怎麼吃？」，它會根據你的目標和已攝取量推薦具體的外食組合。
                      </p>
                      <button
                        onClick={() => setShowAiChat(true)}
                        className="inline-flex items-center gap-1.5 bg-[#2563eb] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#1d4ed8] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        試試看
                        {!c.ai_chat_enabled && <span className="text-[10px] opacity-80">（每月 1 次免費）</span>}
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            // P0: Day 14+ — TDEE 校正完成 WOW Moment
            if (daysSinceSignup >= 14 && daysSinceSignup <= 21) {
              return <TDEECalibrationCard client={c} />
            }

            return null
          })()}

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
                      <p className="text-sm font-semibold text-gray-900">步驟 3：問 AI 顧問怎麼吃</p>
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
          )}
        </div>

        {/* === Onboarding Checklist: persistent task checklist for new users (first 14 days) === */}
        {(() => {
          if (checklistDismissed) return null
          if (!c.created_at) return null
          const daysSinceCreation = Math.floor(
            (Date.now() - new Date(c.created_at).getTime()) / 86400000
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

        {/* 身體數據記錄（ALL modes — 每日量體重最優先） */}
        {c.body_composition_enabled && (
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
              competitionEnabled={clientData.client.competition_enabled}
              targetWeight={clientData.client.target_weight}
              competitionDate={clientData.client.competition_date}
              simpleMode={clientData.client.simple_mode}
              onMutate={mutateWithTargets}
            />
          </CollapsibleSection>
        )}

        {/* 飲食目標 + 飲食紀錄 */}
        {c.nutrition_enabled && (
          <CollapsibleSection
            id={isCompetition ? 'section-nutrition' : 'section-nutrition-general'}
            icon="🥗"
            title="飲食紀錄"
            isCompleted={!!todayNutrition}
            summaryLine={todayNutrition ? `${todayNutrition.calories ? `${todayNutrition.calories} kcal` : ''}${c.calories_target ? ` / ${c.calories_target} kcal` : ''}${todayNutrition.compliant === true ? ' ✓ 合規' : todayNutrition.compliant === false ? ' ✗ 未合規' : ''}` : undefined}
            isToday={isToday}
          >
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
              competitionEnabled={c.competition_enabled}
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
              onMutate={mutate}
            />
          </CollapsibleSection>
        )}

        {/* 補品打卡 */}
        {c.supplement_enabled && (
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
        )}

        {/* 每日感受 */}
        {c.wellness_enabled && (
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
              healthModeEnabled={clientData.client.health_mode_enabled}
              gender={c.gender ?? undefined}
              onMutate={mutate}
            />
          </CollapsibleSection>
        )}

        {/* 訓練紀錄 */}
        {c.training_enabled && (
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
            />
          </CollapsibleSection>
        )}

        {/* ================================================================ */}
        {/* === SEE section: 狀態與趨勢（唯讀分析） === */}
        {/* ================================================================ */}

        {/* 恢復評估儀表板 */}
        {c.wellness_enabled && (
          <div className="mb-3">
            <RecoveryDashboard clientId={c.unique_code} />
          </div>
        )}

        {/* DEBUG: Peak Week 條件診斷 — 確認後刪除 */}
        <div className="bg-red-600 text-white text-[11px] font-mono rounded-lg px-3 py-2 mb-3">
          PEAK-DEBUG v3 | isComp={String(!!isCompetition)} | compDate={c.competition_date || 'NULL'} | weight={String(latestBodyData?.weight ?? 'NULL')} | prepPhase={c.prep_phase || 'NULL'}
          {c.competition_date && (() => {
            const dl = Math.ceil((new Date(c.competition_date).getTime() - Date.now()) / 86400000)
            return ` | daysLeft=${dl} | showPW=${dl <= 14 && !!latestBodyData?.weight}`
          })()}
        </div>

        {/* Goal-Driven + Peak Week（備賽客戶）*/}
        {isCompetition && (() => {
          const compDaysLeft = c.competition_date
            ? Math.ceil((new Date(c.competition_date).getTime() - Date.now()) / 86400000)
            : null
          const showPeakWeek = compDaysLeft != null && compDaysLeft <= 14 && latestBodyData?.weight
          return (
            <>
              {(!showPeakWeek || compDaysLeft! > 8) && (
                <GoalDrivenStatus
                  clientId={c.id}
                  code={c.unique_code}
                  isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
                  onMutate={mutateWithTargets}
                />
              )}
              {showPeakWeek && (
                <PeakWeekPlan
                  clientId={c.id}
                  code={c.unique_code}
                  competitionDate={c.competition_date!}
                  bodyWeight={latestBodyData!.weight}
                  previewDate={selectedDate > today ? selectedDate : undefined}
                />
              )}
            </>
          )
        })()}

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

        {c.wellness_enabled && <WellnessTrend wellness={clientData.wellness || []} />}

        {/* ================================================================ */}
        {/* === REFERENCE section: 參考資料（少變動） === */}
        {/* ================================================================ */}

        {/* 推薦好友卡片 — 至少使用 7 天以上且非免費用戶才顯示 */}
        {c.created_at && (() => {
          const daysSinceSignup = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
          if (daysSinceSignup < 7) return null
          if (c.subscription_tier === 'free' && streakDays < 7) return null
          return <ReferralCard clientId={c.unique_code} />
        })()}

        {/* 基因檔案卡片 */}
        <GeneProfileCard
          mthfr={c.gene_mthfr as string | null}
          apoe={c.gene_apoe as string | null}
          serotonin={c.gene_depression_risk as string | null}
          notes={c.gene_notes as string | null}
          geneticCorrections={geneCorrections}
          clientId={c.unique_code}
          onMutate={mutate}
        />

        {/* 目標設定 */}
        {c.calories_target && (
          <div className="mb-3">
            <GoalSettings
              clientId={c.id}
              uniqueCode={c.unique_code}
              currentGoalType={c.goal_type}
              currentTargetWeight={c.target_weight}
              currentTargetBodyFat={(c.target_body_fat as number) ?? null}
              currentTargetDate={c.target_date}
              competitionEnabled={!!c.competition_enabled}
              competitionDate={c.competition_date || null}
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
            <>
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
            </>
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
              <p className="text-xs text-gray-500 mt-1">
                升級後解鎖 AI 飲食顧問、身心狀態追蹤、訓練紀錄，讓系統更完整地幫你分析。
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
          <HealthReport client={c as any} latestBodyData={latestBodyData} bmi={bmi}
            weekRate={supplementComplianceStats.weekRate} monthRate={supplementComplianceStats.monthRate}
          />
        )}

        <PwaPrompt />
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
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">1次免費</span>
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
          trainingLogs={(clientData.trainingLogs || []) as any[]}
          supplements={c.supplements || []}
          supplementComplianceRate={supplementComplianceStats.weekRate}
          todayWellness={todayWellness}
          wearableData={{
            hrv: todayWellness?.hrv ?? null,
            resting_hr: todayWellness?.resting_hr ?? null,
            device_recovery_score: todayWellness?.device_recovery_score ?? null,
          }}
          labResults={c.lab_enabled ? (c.lab_results || []).map((r: any) => ({
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
