'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useClientData } from '@/hooks/useClientData'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { Lock, Unlock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import HealthOverview from '@/components/client/HealthOverview'
import DailyCheckIn from '@/components/client/DailyCheckIn'
import DailyWellness from '@/components/client/DailyWellness'
import BodyComposition from '@/components/client/BodyComposition'
import LabResults from '@/components/client/LabResults'
import SupplementModal from '@/components/client/SupplementModal'
import ActionPlan from '@/components/client/ActionPlan'
import WellnessTrend from '@/components/client/WellnessTrend'
import HealthReport from '@/components/client/HealthReport'
import TrainingLog from '@/components/client/TrainingLog'
import { isWeightTraining } from '@/components/client/types'
import NutritionLog from '@/components/client/NutritionLog'
import DailyNutritionTarget from '@/components/client/DailyNutritionTarget'
import PeakWeekPlan from '@/components/client/PeakWeekPlan'
import GoalDrivenStatus from '@/components/client/GoalDrivenStatus'
import WeeklyInsight from '@/components/client/WeeklyInsight'
import SelfManagedNutrition from '@/components/client/SelfManagedNutrition'
import PwaPrompt from '@/components/client/PwaPrompt'
import HealthModeAdvanced from '@/components/client/HealthModeAdvanced'
import LabNutritionAdviceCard from '@/components/client/LabNutritionAdviceCard'
import AiChatDrawer from '@/components/client/AiChatDrawer'
import { calcRecommendedStageWeight } from '@/lib/nutrition-engine'
import { calculateHealthScore } from '@/lib/health-score-engine'
import { getLocalDateStr } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast'

export default function ClientDashboard() {
  const { clientId } = useParams()
  const { data: clientData, error, isLoading, mutate } = useClientData(clientId as string)

  const today = getLocalDateStr()

  // 日期導航
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = getLocalDateStr(d)
    if (newDate > today) return
    setSelectedDate(newDate)
  }

  const formatSelectedDate = (dateStr: string) => {
    if (dateStr === today) return '今天'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === getLocalDateStr(yesterday)) return '昨天'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
  }

  // 教練模式
  const [isCoachMode, setIsCoachMode] = useState(false)
  const [showPinPopover, setShowPinPopover] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [savedPin, setSavedPin] = useState('')
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [togglingSupplements, setTogglingSupplements] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('')
  const [showCoachSummary, setShowCoachSummary] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)
  const [showAiUpgrade, setShowAiUpgrade] = useState(false)
  const [showPhaseSelector, setShowPhaseSelector] = useState(false)
  const [updatingPhase, setUpdatingPhase] = useState(false)
  const { showToast } = useToast()

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('coachMode')
      const pin = sessionStorage.getItem('coachPin')
      if (saved === 'true' && pin) {
        setIsCoachMode(true)
        setSavedPin(pin)
      }
    }
  }, [])

  const handlePinSubmit = async () => {
    if (!pinInput || pinLoading) return
    setPinLoading(true)
    setPinError(false)
    try {
      const res = await fetch('/api/coach/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.valid) {
          setIsCoachMode(true)
          setSavedPin(pinInput)
          sessionStorage.setItem('coachMode', 'true')
          sessionStorage.setItem('coachPin', pinInput)
          setShowPinPopover(false)
          setPinInput('')
        } else { setPinError(true) }
      } else { setPinError(true) }
    } catch { setPinError(true) }
    finally { setPinLoading(false) }
  }

  const coachHeaders = { 'Content-Type': 'application/json', 'x-coach-pin': savedPin }

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
          <p className="text-gray-600">{isSuspended ? '請聯繫你的教練重新啟用' : error.message}</p>
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
  const healthScore = isHealthMode ? calculateHealthScore({
    wellnessLast7: (clientData.wellness || []).slice(-7),
    nutritionLast7: (clientData.nutritionLogs || []).slice(-7),
    trainingLast7: (clientData.trainingLogs || []).slice(-7),
    supplementComplianceRate: supplementComplianceStats.weekRate / 100,
    labResults: c.lab_results || [],
    quarterlyStart: c.quarterly_cycle_start,
  }) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24">

        {/* 到期提醒 Banner */}
        {c.expires_at && (() => {
          const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (daysLeft > 7 || c.subscription_tier === 'free') return null
          const renewUrl = `/pay?tier=${c.subscription_tier}&name=${encodeURIComponent(c.name)}`
          if (daysLeft <= 0) {
            return (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-700">你的方案已到期</p>
                <p className="text-xs text-red-600 mt-1">續費後所有數據完整保留，不需重新設定。</p>
                <a href={renewUrl} className="inline-block mt-2 bg-red-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:bg-red-700 transition-colors">
                  立即續費
                </a>
              </div>
            )
          }
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-700">你的方案將在 {daysLeft} 天後到期</p>
              <p className="text-xs text-amber-600 mt-1">到期前續費，資料完整保留。</p>
              <a href={renewUrl} className="inline-block mt-2 bg-amber-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-amber-700 transition-colors">
                續費
              </a>
            </div>
          )
        })()}

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
            <div className="relative">
              <button
                onClick={() => {
                  if (isCoachMode) { setIsCoachMode(false); setSavedPin(''); sessionStorage.removeItem('coachMode'); sessionStorage.removeItem('coachPin') }
                  else { setShowPinPopover(!showPinPopover) }
                }}
                className={`p-2 rounded-full transition-colors ${isCoachMode ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                {isCoachMode ? <Unlock size={18} /> : <Lock size={18} />}
              </button>
              {showPinPopover && !isCoachMode && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border p-3 z-50 w-48">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value); setPinError(false) }}
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
              <input
                id="date-picker"
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= today) setSelectedDate(e.target.value)
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              {!isToday && (
                <p className="text-xs text-gray-400 pointer-events-none">{new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</p>
              )}
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>

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
                  const pillarsExplain: Record<string, string> = {
                    wellness: '身心狀態 25%',
                    nutrition: '營養合規 20%',
                    training: '訓練規律 20%',
                    supplement: '補品服從 15%',
                    lab: '血檢結果 20%',
                  }
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
              {/* 最低分柱提示 */}
              {(() => {
                const lowest = [...healthScore.pillars].sort((a, b) => a.score - b.score)[0]
                if (lowest && lowest.score < 70) {
                  const tips: Record<string, string> = {
                    wellness: '多休息、保持正面心態',
                    nutrition: '注意營養目標的執行',
                    training: '保持規律的訓練頻率',
                    supplement: '別忘了每天的補品打卡',
                    lab: '可考慮安排血檢追蹤',
                  }
                  return (
                    <div className="mt-2 pt-2 border-t border-emerald-200">
                      <p className="text-xs text-amber-600 font-medium">
                        💡 {lowest.label}分數偏低（{lowest.score}分）— {tips[lowest.pillar] || '持續改善中'}
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
            const phaseLabels: Record<string, string> = { off_season: '休賽期', bulk: '增肌期', cut: '減脂期', peak_week: 'Peak Week', competition: '比賽日', recovery: '賽後恢復' }
            const phaseOptions = [
              { value: 'off_season', label: '休賽期', icon: '🌙' },
              { value: 'bulk', label: '增肌期', icon: '💪' },
              { value: 'cut', label: '減脂期', icon: '🔥' },
              { value: 'peak_week', label: 'Peak Week', icon: '⚡' },
              { value: 'competition', label: '比賽日', icon: '🏆' },
              { value: 'recovery', label: '賽後恢復', icon: '🧘' },
            ]
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
                        {phaseLabels[phase] || phase}
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
                      {phaseOptions.map(opt => (
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
                      c.gender,
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

            // P2: Day 1-3 — 系統正在學習
            if (daysSinceSignup <= 3) {
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

            // P1: Day 7 — AI 顧問預覽
            if (daysSinceSignup >= 5 && daysSinceSignup <= 10 && c.nutrition_enabled) {
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
            />
          )}
        </div>

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

        {/* === 備賽選手：體重軌跡優先 === */}
        {isCompetition && c.body_composition_enabled && (
          <div id="section-body" className="scroll-mt-4"><BodyComposition
            latestBodyData={latestBodyData}
            prevBodyData={prevBodyData}
            bmi={bmi}
            trendData={trendData}
            bodyData={clientData.bodyData || []}
            clientId={clientId as string}
            competitionEnabled={clientData.client.competition_enabled}
            targetWeight={clientData.client.target_weight}
            competitionDate={clientData.client.competition_date}
            onMutate={mutate}
          /></div>
        )}

        {/* Goal-Driven 目標體重計畫（備賽 + 有目標體重 + 非 peak_week） */}
        {isCompetition && c.target_weight && c.prep_phase !== 'peak_week' && (
          <GoalDrivenStatus
            clientId={c.id}
            code={c.unique_code}
            isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
            onMutate={mutate}
          />
        )}

        {/* Peak Week 計畫（備賽階段為 peak_week 時顯示） */}
        {isCompetition && c.prep_phase === 'peak_week' && c.competition_date && latestBodyData?.weight && (() => {
          const peakDaysLeft = Math.ceil((new Date(c.competition_date).getTime() - Date.now()) / 86400000)
          if (peakDaysLeft > 8) {
            return (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm font-bold text-purple-700">Peak Week 模式已啟用</span>
                </div>
                <p className="text-xs text-purple-600">
                  距比賽還有 <strong>{peakDaysLeft}</strong> 天，Peak Week 每日計畫將在 <strong>比賽前 8 天</strong> 自動生成。
                  建議先在賽前 2-4 週做一次模擬 Peak Week，測試身體對碳水耗竭→超補的反應。
                </p>
              </div>
            )
          }
          return (
            <PeakWeekPlan
              clientId={c.id}
              code={c.unique_code}
              competitionDate={c.competition_date}
              bodyWeight={latestBodyData.weight}
            />
          )
        })()}

        {/* 飲食（備賽選手排第二） */}
        {isCompetition && c.nutrition_enabled && (
          <div id="section-nutrition" className="scroll-mt-4"><NutritionLog
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
            onMutate={mutate}
          /></div>
        )}

        {/* === 一般學員區塊順序 / 備賽學員剩餘區塊 === */}
        {/* 飲食目標 + 飲食紀錄優先（每日最常用） */}

        {/* 一般學員（非自主管理、非免費）的飲食目標卡片 */}
        {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && (c.calories_target || c.protein_target || c.carbs_target || c.fat_target || c.carbs_training_day || c.carbs_rest_day) && (
          <DailyNutritionTarget
            caloriesTarget={c.calories_target}
            proteinTarget={c.protein_target}
            carbsTarget={c.carbs_target}
            fatTarget={c.fat_target}
            carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
            isTrainingDay={!!(todayTraining && isWeightTraining(todayTraining.training_type))}
            carbsTrainingDay={c.carbs_training_day}
            carbsRestDay={c.carbs_rest_day}
          />
        )}

        {/* 一般學員的飲食紀錄（非備賽） */}
        {!isCompetition && c.nutrition_enabled && (
          <div id="section-nutrition-general" className="scroll-mt-4"><NutritionLog
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
            onMutate={mutate}
          /></div>
        )}

        {c.supplement_enabled && (
          <div id="section-supplements" className="scroll-mt-4"><DailyCheckIn
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
          /></div>
        )}

        {c.wellness_enabled && (
          <div id="section-wellness" className="scroll-mt-4"><DailyWellness
            todayWellness={todayWellness}
            clientId={clientId as string}
            date={selectedDate}
            competitionEnabled={clientData.client.competition_enabled}
            healthModeEnabled={clientData.client.health_mode_enabled}
            gender={c.gender}
            onMutate={mutate}
          /></div>
        )}

        {c.training_enabled && (
          <div id="section-training" className="scroll-mt-4"><TrainingLog
            todayTraining={todayTraining}
            trainingLogs={clientData.trainingLogs || []}
            wellness={clientData.wellness || []}
            clientId={clientId as string}
            date={selectedDate}
            onMutate={mutate}
            carbsTrainingDay={c.carbs_training_day}
            carbsRestDay={c.carbs_rest_day}
          /></div>
        )}

        {/* Combo 方案專屬區塊 */}
        {c.subscription_tier === 'combo' && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-3xl shadow-sm p-6 mb-6 border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🏆</span>
              <h2 className="text-lg font-bold text-gray-900">全方位方案</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg shrink-0">🏋️</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">一對一訓練</p>
                  <p className="text-xs text-gray-500 mt-0.5">台中 Coolday · 動作矯正與課表設計</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg shrink-0">💬</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">優先諮詢</p>
                  <p className="text-xs text-gray-500 mt-0.5">LINE 優先回覆 + 緊急諮詢通道</p>
                </div>
              </div>
              {c.coach_weekly_note && (
                <div className="bg-white rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">教練本週筆記</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.coach_weekly_note}</p>
                </div>
              )}
            </div>
          </div>
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
            onMutate={mutate}
          />
        )}

        {/* 一般學員（非自主管理、非免費）的每週智能分析 */}
        {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && c.body_composition_enabled && (
          <WeeklyInsight clientId={c.id} code={c.unique_code} onMutate={mutate} />
        )}

        {c.wellness_enabled && <WellnessTrend wellness={clientData.wellness || []} />}

        {/* 一般學員的身體數據（非備賽才在這裡顯示） */}
        {!isCompetition && c.body_composition_enabled && (
          <div id="section-body" className="scroll-mt-4"><BodyComposition
            latestBodyData={latestBodyData}
            prevBodyData={prevBodyData}
            bmi={bmi}
            trendData={trendData}
            bodyData={clientData.bodyData || []}
            clientId={clientId as string}
            competitionEnabled={clientData.client.competition_enabled}
            targetWeight={clientData.client.target_weight}
            competitionDate={clientData.client.competition_date}
            onMutate={mutate}
          /></div>
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

        {/* 血檢飲食建議 — 所有模式通用，有血檢資料就顯示 */}
        {c.lab_enabled && c.lab_results && c.lab_results.length > 0 && (
          <LabNutritionAdviceCard
            labResults={c.lab_results}
            gender={c.gender}
            goalType={c.goal_type}
          />
        )}

        <ActionPlan
          healthGoals={c.health_goals}
          nextCheckupDate={c.next_checkup_date}
          coachSummary={c.coach_summary}
          topSupplements={c.supplement_enabled ? topSupplements : []}
        />

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
                  <a href="/pay?tier=self_managed" className="block text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all">
                    升級自主管理版 NT$499/月
                  </a>
                  <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="block text-center bg-[#06C755] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#05b04d] transition-all">
                    💬 加 LINE 找 Howard
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-3 text-center">和教練討論開啟更多追蹤功能</p>
              )}
            </div>
          )
        })()}

        {isCoachMode && (
          <HealthReport client={c} latestBodyData={latestBodyData} bmi={bmi}
            weekRate={supplementComplianceStats.weekRate} monthRate={supplementComplianceStats.monthRate}
          />
        )}

        <PwaPrompt />
      </div>

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

      {/* 免費用戶 AI 升級提示（雙出口：候補 + LINE） */}
      {showAiUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setShowAiUpgrade(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="text-lg font-bold text-gray-900">本月免費次數已用完</h3>
              <p className="text-sm text-gray-500 mt-1">你可以選擇：</p>
            </div>
            <div className="space-y-3 mb-4">
              <a
                href="/pay?tier=self_managed"
                className="block w-full text-center bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 transition-colors"
              >
                升級自主管理版 NT$499/月
                <span className="block text-xs font-normal opacity-80 mt-0.5">解鎖無限 AI 顧問 + 訓練追蹤</span>
              </a>
              <a
                href="https://lin.ee/LP65rCc"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#06C755] text-white font-bold py-3 rounded-2xl hover:bg-[#05b04d] transition-colors"
              >
                💬 加 LINE 讓 Howard 直接幫你分析
                <span className="block text-xs font-normal opacity-80 mt-0.5">現在就可以，真人回覆</span>
              </a>
            </div>
            <button
              onClick={() => setShowAiUpgrade(false)}
              className="block w-full text-center text-sm text-gray-400 mt-1 py-1"
            >
              稍後再說
            </button>
          </div>
        </div>
      )}

      {/* AI 聊天抽屜（付費用戶 + 免費用戶月度免費額度） */}
      {c.nutrition_enabled && (
        <AiChatDrawer
          open={showAiChat}
          onClose={() => setShowAiChat(false)}
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
          latestWeight={latestBodyData?.weight}
          latestBodyFat={latestBodyData?.body_fat}
          nutritionLogs={clientData.nutritionLogs || []}
          wellnessLogs={clientData.wellness || []}
          trainingLogs={clientData.trainingLogs || []}
          supplements={c.supplements || []}
          supplementComplianceRate={supplementComplianceStats.weekRate}
          todayWellness={todayWellness}
          wearableData={{
            hrv: todayWellness?.hrv ?? null,
            resting_hr: todayWellness?.resting_hr ?? null,
            device_recovery_score: todayWellness?.device_recovery_score ?? null,
          }}
          onFirstMessage={undefined}
        />
      )}

      {/* 底部導航 */}
      {(() => {
        const tabs: { id: string; icon: string; label: string }[] = []
        if (isCompetition && c.body_composition_enabled) tabs.push({ id: 'section-body', icon: '⚖️', label: '身體' })
        if (c.nutrition_enabled) tabs.push({ id: isCompetition ? 'section-nutrition' : 'section-nutrition-general', icon: '🥗', label: '飲食' })
        if (c.supplement_enabled) tabs.push({ id: 'section-supplements', icon: '💊', label: '補品' })
        if (c.wellness_enabled) tabs.push({ id: 'section-wellness', icon: '😊', label: '感受' })
        if (c.training_enabled) tabs.push({ id: 'section-training', icon: '🏋️', label: '訓練' })
        if (!isCompetition && c.body_composition_enabled) tabs.push({ id: 'section-body', icon: '⚖️', label: '身體' })
        if (c.lab_enabled) tabs.push({ id: 'section-lab', icon: '🩸', label: '血檢' })
        if (tabs.length <= 1) return null

        // 每日任務完成狀態對應
        const completedMap: Record<string, boolean> = {
          'section-nutrition': !!todayNutrition,
          'section-nutrition-general': !!todayNutrition,
          'section-supplements': todaySupplementStats.total > 0 && todaySupplementStats.completed === todaySupplementStats.total,
          'section-wellness': !!todayWellness,
          'section-training': !!todayTraining,
        }

        return (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-4xl mx-auto flex">
              {tabs.map(tab => {
                const isDailyCompleted = isToday && completedMap[tab.id]
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`flex-1 flex flex-col items-center py-2 transition-colors relative ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
                  >
                    <span className="text-lg leading-none">{tab.icon}</span>
                    <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                    {isDailyCompleted && (
                      <span className="absolute top-1 right-1/2 translate-x-4 w-1.5 h-1.5 bg-green-400 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          </nav>
        )
      })()}
    </div>
  )
}
