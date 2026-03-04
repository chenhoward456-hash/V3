'use client'

import { useState, useEffect } from 'react'
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
    } catch { alert('打卡失敗，請重試') }
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
      await Promise.all(uncompleted.map((s: any) =>
        fetch('/api/supplement-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, supplementId: s.id, date: selectedDate, completed: true })
        })
      ))
      mutate()
    } catch { alert('打卡失敗，請重試') }
    finally {
      setTogglingSupplements(new Set())
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
            <HealthModeAdvanced clientId={c.id} />
          )}

          {/* 備賽倒數 Banner */}
          {isCompetition && c.competition_date && (() => {
            const daysLeft = Math.ceil((new Date(c.competition_date).getTime() - new Date().getTime()) / 86400000)
            const phaseLabels: Record<string, string> = { off_season: '休賽期', bulk: '增肌期', cut: '減脂期', peak_week: 'Peak Week', competition: '比賽日', recovery: '賽後恢復' }
            const phase = c.prep_phase || 'off_season'
            const urgencyColor = daysLeft <= 7 ? 'from-red-500 to-red-600' : daysLeft <= 14 ? 'from-amber-500 to-orange-500' : daysLeft <= 30 ? 'from-amber-400 to-yellow-500' : 'from-blue-500 to-blue-600'
            const urgencyBg = daysLeft <= 7 ? 'bg-red-50 border-red-200' : daysLeft <= 14 ? 'bg-amber-50 border-amber-200' : daysLeft <= 30 ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
            return (
              <div className={`${urgencyBg} border rounded-2xl p-4 mb-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏆</span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full text-white bg-gradient-to-r ${urgencyColor}`}>
                        {phaseLabels[phase] || phase}
                      </span>
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
                  <div className="w-full">
                    <p className="text-xs text-gray-500 mb-2">👋 今天還沒有紀錄，從這裡開始：</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.supplement_enabled && !todaySupplementStats.completed && (
                        <button onClick={() => document.getElementById('section-supplements')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">💊 補品打卡</button>
                      )}
                      {c.wellness_enabled && !todayWellness && (
                        <button onClick={() => document.getElementById('section-wellness')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full hover:bg-purple-100 transition-colors">😊 記錄感受</button>
                      )}
                      {c.nutrition_enabled && !todayNutrition && (
                        <button onClick={() => (document.getElementById('section-nutrition') || document.getElementById('section-nutrition-general'))?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors">🍽️ 飲食紀錄</button>
                      )}
                      {c.training_enabled && !todayTraining && (
                        <button onClick={() => document.getElementById('section-training')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors">🏋️ 訓練紀錄</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 備賽模式：今日體重 vs 目標 */}
              {isCompetition && c.target_weight && latestBodyData?.weight && (
                <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">⚖️ 最新體重</span>
                    <span className="text-sm font-bold text-gray-800">{latestBodyData.weight} kg</span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className="text-xs text-gray-500">🎯 目標</span>
                    <span className="text-sm font-bold text-red-500">{c.target_weight} kg</span>
                    <span className={`text-xs font-medium ml-auto ${Math.abs(latestBodyData.weight - c.target_weight) <= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                      差 {Math.abs(latestBodyData.weight - c.target_weight).toFixed(1)} kg
                    </span>
                  </div>
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

          {/* 教練已查看標記 */}
          {c.coach_last_viewed_at && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-green-500 text-xs">✓</span>
              <span className="text-xs text-gray-400">
                教練上次查看：{(() => {
                  const viewed = new Date(c.coach_last_viewed_at)
                  const now = new Date()
                  const diffH = Math.floor((now.getTime() - viewed.getTime()) / 3600000)
                  if (diffH < 1) return '剛剛'
                  if (diffH < 24) return `${diffH} 小時前`
                  const diffD = Math.floor(diffH / 24)
                  if (diffD === 1) return '昨天'
                  if (diffD < 7) return `${diffD} 天前`
                  return viewed.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
                })()}
              </span>
            </div>
          )}

          {/* 教練本週回饋 */}
          {c.coach_weekly_note && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">💬</span>
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">教練本週回饋</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.coach_weekly_note}</p>
                </div>
              </div>
            </div>
          )}

          {/* 教練健康摘要（可展開） */}
          {c.coach_summary && (
            <div className="mb-3">
              <button
                onClick={() => setShowCoachSummary(!showCoachSummary)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ChevronDown size={14} className={`transition-transform ${showCoachSummary ? 'rotate-180' : ''}`} />
                {showCoachSummary ? '收起健康分析' : '查看教練健康分析'}
              </button>
              {showCoachSummary && (
                <div className="bg-blue-50 rounded-2xl p-4 mt-2">
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.coach_summary}</p>
                  {(c.next_checkup_date || c.health_goals) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-blue-100">
                      {c.next_checkup_date && <span className="text-xs text-blue-600">📅 下次回檢：{new Date(c.next_checkup_date).toLocaleDateString('zh-TW')}</span>}
                      {c.health_goals && <span className="text-xs text-blue-600">🎯 {c.health_goals}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 新手引導 — 沒有任何資料時取代 HealthOverview */}
          {!latestBodyData && (!clientData.nutritionLogs || clientData.nutritionLogs.length === 0) ? (
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
            isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
            onMutate={mutate}
          />
        )}

        {/* Peak Week 計畫（備賽階段為 peak_week 時顯示） */}
        {isCompetition && c.prep_phase === 'peak_week' && c.competition_date && latestBodyData?.weight && (
          <PeakWeekPlan
            clientId={c.id}
            competitionDate={c.competition_date}
            bodyWeight={latestBodyData.weight}
          />
        )}

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
              ? (todayTraining && todayTraining.training_type !== 'rest' ? c.carbs_training_day : c.carbs_rest_day)
              : c.carbs_target}
            carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
            isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
            carbsTrainingDay={c.carbs_training_day}
            carbsRestDay={c.carbs_rest_day}
            fatTarget={c.fat_target}
            caloriesTarget={c.calories_target}
            onMutate={mutate}
          /></div>
        )}

        {/* === 一般學員區塊順序 / 備賽學員剩餘區塊 === */}

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
          /></div>
        )}

        {/* 自主管理 / 免費學員的智能營養計算（取代 WeeklyInsight + DailyNutritionTarget） */}
        {!isCompetition && (isSelfManaged || isFree) && c.body_composition_enabled && (
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
            isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
            latestWeight={latestBodyData?.weight || null}
            latestBodyFat={latestBodyData?.body_fat || null}
            clientHeight={c.height || null}
            onMutate={mutate}
          />
        )}

        {/* 一般學員（非自主管理、非免費）的每週智能分析 */}
        {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && c.body_composition_enabled && (
          <WeeklyInsight clientId={c.id} onMutate={mutate} />
        )}

        {/* 一般學員（非自主管理、非免費）的飲食目標卡片 */}
        {!isCompetition && !isSelfManaged && !isFree && c.nutrition_enabled && (c.calories_target || c.protein_target || c.carbs_target || c.fat_target || c.carbs_training_day || c.carbs_rest_day) && (
          <DailyNutritionTarget
            caloriesTarget={c.calories_target}
            proteinTarget={c.protein_target}
            carbsTarget={c.carbs_target}
            fatTarget={c.fat_target}
            carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
            isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
            carbsTrainingDay={c.carbs_training_day}
            carbsRestDay={c.carbs_rest_day}
          />
        )}

        {/* 一般學員的飲食（非備賽才在這裡顯示） */}
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
              ? (todayTraining && todayTraining.training_type !== 'rest' ? c.carbs_training_day : c.carbs_rest_day)
              : c.carbs_target}
            carbsCyclingEnabled={!!(c.carbs_training_day && c.carbs_rest_day)}
            isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
            carbsTrainingDay={c.carbs_training_day}
            carbsRestDay={c.carbs_rest_day}
            fatTarget={c.fat_target}
            caloriesTarget={c.calories_target}
            onMutate={mutate}
          /></div>
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
                <a href="/remote" className="block text-xs text-blue-500 mt-3 text-center hover:text-blue-700 transition-colors font-medium">
                  升級方案，解鎖完整功能 →
                </a>
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
        </button>
      )}

      {/* AI 聊天抽屜 */}
      {c.nutrition_enabled && (
        <AiChatDrawer
          open={showAiChat}
          onClose={() => setShowAiChat(false)}
          clientName={c.name}
          gender={c.gender}
          goalType={c.goal_type}
          todayNutrition={todayNutrition}
          caloriesTarget={c.calories_target}
          proteinTarget={c.protein_target}
          carbsTarget={c.carbs_training_day && c.carbs_rest_day
            ? (todayTraining && todayTraining.training_type !== 'rest' ? c.carbs_training_day : c.carbs_rest_day)
            : c.carbs_target}
          fatTarget={c.fat_target}
          waterTarget={c.water_target}
          isTrainingDay={!!(todayTraining && todayTraining.training_type !== 'rest')}
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
        return (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-4xl mx-auto flex">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`flex-1 flex flex-col items-center py-2 transition-colors ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
                >
                  <span className="text-lg leading-none">{tab.icon}</span>
                  <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        )
      })()}
    </div>
  )
}
