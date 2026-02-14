'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useClientData } from '@/hooks/useClientData'
import { Lock, Unlock, ChevronLeft, ChevronRight } from 'lucide-react'
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
    // 限制不能超過今天，不能早於 30 天前
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
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [togglingSupplements, setTogglingSupplements] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('coachMode')
      if (saved === 'true') setIsCoachMode(true)
    }
  }, [])

  const handlePinSubmit = () => {
    if (pinInput === process.env.NEXT_PUBLIC_COACH_PIN) {
      setIsCoachMode(true)
      sessionStorage.setItem('coachMode', 'true')
      setShowPinPopover(false)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
    }
  }

  const coachHeaders = { 'Content-Type': 'application/json', 'x-coach-pin': process.env.NEXT_PUBLIC_COACH_PIN || '' }

  // 切換補品打卡
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

  // 選擇日的感受
  const todayWellness = useMemo(() => {
    return clientData?.wellness?.find((w: any) => w.date === selectedDate) || null
  }, [clientData?.wellness, selectedDate])

  // 選擇日的訓練
  const todayTraining = useMemo(() => {
    return clientData?.trainingLogs?.find((t: any) => t.date === selectedDate) || null
  }, [clientData?.trainingLogs, selectedDate])

  // 選擇日的飲食
  const todayNutrition = useMemo(() => {
    return clientData?.nutritionLogs?.find((n: any) => n.date === selectedDate) || null
  }, [clientData?.nutritionLogs, selectedDate])

  // 選擇日的補品打卡（從 recentLogs 篩選）
  const selectedDateLogs = useMemo(() => {
    if (!clientData?.recentLogs) return clientData?.todayLogs || []
    if (selectedDate === today) return clientData?.todayLogs || []
    return clientData.recentLogs.filter((l: any) => l.date === selectedDate)
  }, [clientData?.recentLogs, clientData?.todayLogs, selectedDate, today])

  // 身體數據 — 每個欄位各自找最新有值的那筆
  const sortedBodyData = useMemo(() => {
    if (!clientData?.bodyData?.length) return []
    return [...clientData.bodyData].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [clientData?.bodyData])

  const latestByField = useMemo(() => {
    const find = (field: string) => sortedBodyData.find((r: any) => r[field] != null)
    return {
      weight: find('weight'),
      body_fat: find('body_fat'),
      muscle_mass: find('muscle_mass'),
      height: find('height'),
    }
  }, [sortedBodyData])

  // 整筆最新（給 BodyComposition 傳所有欄位用）
  const latestBodyData = useMemo(() => {
    if (!sortedBodyData.length) return null
    // 組合各欄位最新值
    return {
      ...sortedBodyData[0],
      weight: latestByField.weight?.weight ?? null,
      body_fat: latestByField.body_fat?.body_fat ?? null,
      muscle_mass: latestByField.muscle_mass?.muscle_mass ?? null,
      height: latestByField.height?.height ?? null,
    }
  }, [sortedBodyData, latestByField])

  const prevBodyData = useMemo(() => {
    // 每個欄位各自找第二新的
    const findPrev = (field: string) => {
      const items = sortedBodyData.filter((r: any) => r[field] != null)
      return items.length >= 2 ? items[1] : null
    }
    return {
      weight: findPrev('weight')?.weight ?? null,
      body_fat: findPrev('body_fat')?.body_fat ?? null,
      muscle_mass: findPrev('muscle_mass')?.muscle_mass ?? null,
    }
  }, [sortedBodyData])

  const bmi = useMemo(() => {
    const w = latestByField.weight?.weight
    const h = latestByField.height?.height
    if (!w || !h) return null
    return (w / ((h / 100) ** 2)).toFixed(1)
  }, [latestByField])

  // 血檢統計（按指標分組，取每個指標最新一筆的狀態）
  const labStats = useMemo(() => {
    if (!clientData?.client?.lab_results?.length) return { normal: 0, total: 0 }
    const latestByName = new Map<string, any>()
    for (const r of clientData.client.lab_results) {
      const existing = latestByName.get(r.test_name)
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        latestByName.set(r.test_name, r)
      }
    }
    let normal = 0
    for (const r of latestByName.values()) {
      if (r.status === 'normal') normal++
    }
    return { normal, total: latestByName.size }
  }, [clientData?.client?.lab_results])

  // 補品統計
  const todaySupplementStats = useMemo(() => {
    if (!selectedDateLogs || !clientData?.client?.supplements) return { completed: 0, total: 0, rate: 0 }
    const completed = selectedDateLogs.filter((log: any) => log.completed).length
    const total = clientData.client.supplements.length
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [selectedDateLogs, clientData?.client?.supplements])

  const supplementComplianceStats = useMemo(() => {
    const totalSupplements = clientData?.client?.supplements?.length || 0
    if (!totalSupplements || !clientData?.recentLogs) return { weekRate: 0, monthRate: 0, weekDelta: null as number | null }
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
    const logs = clientData.recentLogs as any[]
    const weekStart = daysAgo(6)
    const weekCompleted = logs.filter((l: any) => l.date >= weekStart && l.date <= todayStr && l.completed).length
    const weekRate = Math.round((weekCompleted / (7 * totalSupplements)) * 100)
    const monthStart = daysAgo(29)
    const monthCompleted = logs.filter((l: any) => l.date >= monthStart && l.date <= todayStr && l.completed).length
    const monthRate = Math.round((monthCompleted / (30 * totalSupplements)) * 100)
    const lastWeekStart = daysAgo(13)
    const lastWeekEnd = daysAgo(7)
    const lastWeekCompleted = logs.filter((l: any) => l.date >= lastWeekStart && l.date <= lastWeekEnd && l.completed).length
    const lastWeekRate = Math.round((lastWeekCompleted / (7 * totalSupplements)) * 100)
    return { weekRate, monthRate, weekDelta: weekRate - lastWeekRate }
  }, [clientData?.recentLogs, clientData?.client?.supplements])

  // 體脂趨勢
  const bodyFatTrend = useMemo(() => {
    const latest = latestByField.body_fat?.body_fat
    const prev = prevBodyData?.body_fat
    if (latest == null || prev == null) return null
    const diff = latest - prev
    return { diff: Math.abs(diff).toFixed(1), direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
  }, [latestByField, prevBodyData])

  // 連續天數
  const streakDays = useMemo(() => {
    if (!clientData?.recentLogs?.length) return 0
    const completedLogs = (clientData.recentLogs as any[]).filter((l: any) => l.completed)
    if (!completedLogs.length) return 0
    const datesWithCompleted = [...new Set(completedLogs.map((l: any) => l.date))].sort().reverse()
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const startOffset = datesWithCompleted[0] === todayStr ? 0 : 1
    let streak = 0
    for (let i = 0; i < datesWithCompleted.length; i++) {
      const expected = new Date(now)
      expected.setDate(expected.getDate() - (i + startOffset))
      if (datesWithCompleted[i] === expected.toISOString().split('T')[0]) { streak++ } else { break }
    }
    return streak
  }, [clientData?.recentLogs])

  const streakMessage = useMemo(() => {
    if (streakDays >= 30) return '健康達人！'
    if (streakDays >= 14) return '超棒的習慣！'
    if (streakDays >= 7) return '一週達成！'
    if (streakDays >= 3) return '保持下去！'
    if (streakDays >= 1) return '好的開始！'
    return '今天開始吧！'
  }, [streakDays])

  // 趨勢圖
  const trendData = useMemo(() => {
    const trends: Record<string, any[]> = {}
    if (clientData?.bodyData?.length) {
      for (const key of ['weight', 'body_fat'] as const) {
        const data = clientData.bodyData
          .filter((r: any) => r[key] != null)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((r: any) => ({ date: new Date(r.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }), value: r[key] }))
        if (data.length > 0) trends[key] = data
      }
    }
    return trends
  }, [clientData?.bodyData])

  // Top supplements for action plan
  const topSupplements = useMemo(() => {
    return clientData?.client?.supplements?.slice().sort((a: any, b: any) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)).slice(0, 3)
  }, [clientData?.client?.supplements])

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">載入失敗</h1>
          <p className="text-gray-600">{error.message}</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* 標題區 */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{clientData.client.name}</h1>
              <p className="text-gray-600">
                {new Date(selectedDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                clientData.client.status === 'normal' ? 'bg-green-100 text-green-800'
                : clientData.client.status === 'attention' ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
              }`}>
                <span className="hidden sm:inline">{clientData.client.status === 'normal' ? '健康狀態良好' : '需要關注'}</span>
                <span className="sm:hidden">{clientData.client.status === 'normal' ? '良好' : '關注'}</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => {
                    if (isCoachMode) { setIsCoachMode(false); sessionStorage.removeItem('coachMode') }
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
          </div>

          {clientData.client.coach_summary && (
            <div className="bg-blue-50 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Howard 教練的健康分析</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{clientData.client.coach_summary}</p>
              {(clientData.client.next_checkup_date || clientData.client.health_goals) && (
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-3 pt-3 border-t border-blue-100">
                  {clientData.client.next_checkup_date && (
                    <span className="text-xs text-gray-600">📅 下次回檢：{new Date(clientData.client.next_checkup_date).toLocaleDateString('zh-TW')}</span>
                  )}
                  {clientData.client.health_goals && (
                    <span className="text-xs text-gray-600">🎯 目標：{clientData.client.health_goals}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 日期導航 */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setSelectedDate(today)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isToday
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatSelectedDate(selectedDate)}
            </button>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={20} />
            </button>
          </div>

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
            supplementEnabled={clientData.client.supplement_enabled}
            labEnabled={clientData.client.lab_enabled}
            bodyCompositionEnabled={clientData.client.body_composition_enabled}
            wellnessEnabled={clientData.client.wellness_enabled}
          />
        </div>

        {clientData.client.supplement_enabled && (
          <DailyCheckIn
            supplements={clientData.client.supplements || []}
            todayLogs={selectedDateLogs}
            todayStats={todaySupplementStats}
            streakDays={streakDays}
            streakMessage={streakMessage}
            isCoachMode={isCoachMode}
            togglingSupplements={togglingSupplements}
            recentLogs={clientData.recentLogs || []}
            onToggleSupplement={handleToggleSupplement}
            onManageSupplements={() => setShowSupplementModal(true)}
          />
        )}

        {clientData.client.wellness_enabled && (
          <DailyWellness
            todayWellness={todayWellness}
            clientId={clientId as string}
            date={selectedDate}
            onMutate={mutate}
          />
        )}

        {clientData.client.training_enabled && (
          <TrainingLog
            todayTraining={todayTraining}
            trainingLogs={clientData.trainingLogs || []}
            wellness={clientData.wellness || []}
            clientId={clientId as string}
            date={selectedDate}
            onMutate={mutate}
          />
        )}

        {clientData.client.nutrition_enabled && (
          <NutritionLog
            todayNutrition={todayNutrition}
            nutritionLogs={clientData.nutritionLogs || []}
            clientId={clientId as string}
            date={selectedDate}
            proteinTarget={clientData.client.protein_target}
            waterTarget={clientData.client.water_target}
            onMutate={mutate}
          />
        )}

        {clientData.client.wellness_enabled && (
          <WellnessTrend wellness={clientData.wellness || []} />
        )}

        {clientData.client.body_composition_enabled && (
          <BodyComposition
            latestBodyData={latestBodyData}
            prevBodyData={prevBodyData}
            bmi={bmi}
            trendData={trendData}
            bodyData={clientData.bodyData || []}
            clientId={clientId as string}
            onMutate={mutate}
          />
        )}

        {clientData.client.lab_enabled && (
          <LabResults
            labResults={clientData.client.lab_results || []}
            isCoachMode={isCoachMode}
            clientId={clientId as string}
            coachHeaders={coachHeaders}
            onMutate={mutate}
          />
        )}

        <ActionPlan
          healthGoals={clientData.client.health_goals}
          nextCheckupDate={clientData.client.next_checkup_date}
          coachSummary={clientData.client.coach_summary}
          topSupplements={clientData.client.supplement_enabled ? topSupplements : []}
        />

        {/* 未開放功能提示 */}
        {(() => {
          const locked = []
          if (!clientData.client.wellness_enabled) locked.push({ icon: '😊', label: '每日感受紀錄' })
          if (!clientData.client.nutrition_enabled) locked.push({ icon: '🥗', label: '飲食追蹤' })
          if (!clientData.client.training_enabled) locked.push({ icon: '🏋️', label: '訓練追蹤' })
          if (!clientData.client.supplement_enabled) locked.push({ icon: '💊', label: '補品管理' })
          if (!clientData.client.lab_enabled) locked.push({ icon: '🩸', label: '血檢追蹤' })
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
          <HealthReport
            client={clientData.client}
            latestBodyData={latestBodyData}
            bmi={bmi}
            weekRate={supplementComplianceStats.weekRate}
            monthRate={supplementComplianceStats.monthRate}
          />
        )}

        <PwaPrompt />
      </div>

      {showSupplementModal && clientData.client.supplement_enabled && (
        <SupplementModal
          supplements={clientData.client.supplements || []}
          clientId={clientId as string}
          coachHeaders={coachHeaders}
          onClose={() => setShowSupplementModal(false)}
          onMutate={mutate}
        />
      )}
    </div>
  )
}
