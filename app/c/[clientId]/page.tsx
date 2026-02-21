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
import PwaPrompt from '@/components/client/PwaPrompt'

export default function ClientDashboard() {
  const { clientId } = useParams()
  const { data: clientData, error, isLoading, mutate } = useClientData(clientId as string)

  const today = new Date().toISOString().split('T')[0]

  // 日期導航
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    const newDate = d.toISOString().split('T')[0]
    if (newDate > today) return
    const thirtyAgo = new Date()
    thirtyAgo.setDate(thirtyAgo.getDate() - 30)
    if (newDate < thirtyAgo.toISOString().split('T')[0]) return
    setSelectedDate(newDate)
  }

  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (dateStr === today) return '今天'
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === yesterday.toISOString().split('T')[0]) return '昨天'
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
            <div className="text-center">
              <button
                onClick={() => setSelectedDate(today)}
                className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${isToday ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
              >
                {formatSelectedDate(selectedDate)}
              </button>
              {!isToday && (
                <p className="text-xs text-gray-400">{new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</p>
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
                  <span className="text-xs text-gray-400">今天還沒有記錄，開始吧！</span>
                )}
              </div>

              {/* 備賽模式：今日體重 vs 目標 */}
              {isCompetition && c.target_weight && latestBodyData?.weight && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-blue-100">
                  <span className="text-xs text-gray-500">⚖️ 最新體重</span>
                  <span className="text-sm font-bold text-gray-800">{latestBodyData.weight} kg</span>
                  <span className="text-xs text-gray-400">→</span>
                  <span className="text-xs text-gray-500">🎯 目標</span>
                  <span className="text-sm font-bold text-red-500">{c.target_weight} kg</span>
                  <span className={`text-xs font-medium ml-auto ${Math.abs(latestBodyData.weight - c.target_weight) <= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                    差 {Math.abs(latestBodyData.weight - c.target_weight).toFixed(1)} kg
                  </span>
                </div>
              )}
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
            carbsTarget={c.carbs_target}
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
            onManageSupplements={() => setShowSupplementModal(true)}
          /></div>
        )}

        {c.wellness_enabled && (
          <div id="section-wellness" className="scroll-mt-4"><DailyWellness
            todayWellness={todayWellness}
            clientId={clientId as string}
            date={selectedDate}
            competitionEnabled={clientData.client.competition_enabled}
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

        {/* 一般學員的飲食（非備賽才在這裡顯示） */}
        {!isCompetition && c.nutrition_enabled && (
          <div id="section-nutrition" className="scroll-mt-4"><NutritionLog
            todayNutrition={todayNutrition}
            nutritionLogs={clientData.nutritionLogs || []}
            clientId={clientId as string}
            date={selectedDate}
            proteinTarget={c.protein_target}
            waterTarget={c.water_target}
            competitionEnabled={c.competition_enabled}
            carbsTarget={c.carbs_target}
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
              <p className="text-xs text-gray-400 mt-3 text-center">和教練討論開啟更多追蹤功能</p>
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

      {/* 底部導航 */}
      {(() => {
        const tabs: { id: string; icon: string; label: string }[] = []
        if (isCompetition && c.body_composition_enabled) tabs.push({ id: 'section-body', icon: '⚖️', label: '身體' })
        if (c.nutrition_enabled) tabs.push({ id: 'section-nutrition', icon: '🥗', label: '飲食' })
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
