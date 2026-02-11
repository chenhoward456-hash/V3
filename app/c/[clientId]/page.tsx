'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useClientData } from '@/hooks/useClientData'
import { Calendar, X, Plus, Scale, Activity, Dumbbell, Ruler, Heart } from 'lucide-react'
import React from 'react'
import LazyChart from '@/components/charts/LazyChart'

interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
}

function getLabAdvice(testName: string, value: number): string {
  switch(testName) {
    case 'HOMA-IR': return value < 1.0 ? '胰島素敏感度很好' : value < 1.4 ? '胰島素敏感度正常' : '胰島素阻抗偏高'
    case '同半胱胺酸': return value < 8 ? '甲基化代謝正常' : '甲基化代謝需要改善'
    case '維生素D': return value > 50 ? '維生素D充足' : value > 30 ? '維生素D偏低，建議補充' : '維生素D不足'
    case '鐵蛋白': return value >= 50 && value <= 150 ? '鐵儲存正常' : value < 50 ? '鐵儲存偏低' : '鐵儲存偏高'
    default: return ''
  }
}

export default function ClientDashboard() {
  const { clientId } = useParams()
  const { data: clientData, error, isLoading, mutate } = useClientData(clientId as string)

  const today = new Date().toISOString().split('T')[0]

  // 新增身體數據 Modal 狀態
  const [showAddBodyDataModal, setShowAddBodyDataModal] = useState(false)
  const [newBodyData, setNewBodyData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    body_fat: '',
    muscle_mass: '',
    height: '',
    visceral_fat: ''
  })

  // 趨勢圖狀態
  const [trendType, setTrendType] = useState<'weight' | 'body_fat'>('weight')

  // 補品打卡 loading 狀態
  const [togglingSupplements, setTogglingSupplements] = useState<Set<string>>(new Set())

  // 每日感受表單
  const [submittingWellness, setSubmittingWellness] = useState(false)
  const [wellnessForm, setWellnessForm] = useState({
    sleep_quality: null as number | null,
    energy_level: null as number | null,
    mood: null as number | null,
    note: ''
  })

  // 今日感受資料
  const todayWellness = useMemo(() => {
    return clientData?.wellness?.find((w: any) => w.date === today) || null
  }, [clientData?.wellness, today])

  // 載入後填入今日感受預設值
  useEffect(() => {
    if (todayWellness) {
      setWellnessForm({
        sleep_quality: todayWellness.sleep_quality,
        energy_level: todayWellness.energy_level,
        mood: todayWellness.mood,
        note: todayWellness.note || ''
      })
    }
  }, [todayWellness])

  // 最新 & 前一筆身體數據
  const latestBodyData = useMemo(() => {
    if (!clientData?.bodyData || clientData.bodyData.length === 0) return null
    return clientData.bodyData.reduce((latest: any, current: any) =>
      new Date(current.date) > new Date(latest.date) ? current : latest
    )
  }, [clientData?.bodyData])

  const prevBodyData = useMemo(() => {
    if (!clientData?.bodyData || clientData.bodyData.length < 2) return null
    const sorted = [...clientData.bodyData].sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    return sorted[1]
  }, [clientData?.bodyData])

  // BMI
  const bmi = useMemo(() => {
    if (!latestBodyData?.weight || !latestBodyData?.height) return null
    return (latestBodyData.weight / ((latestBodyData.height / 100) ** 2)).toFixed(1)
  }, [latestBodyData])

  // 血檢統計
  const labStats = useMemo(() => {
    if (!clientData?.client?.lab_results) return { normal: 0, total: 0 }
    const normal = clientData.client.lab_results.filter((r: any) => r.status === 'normal').length
    return { normal, total: clientData.client.lab_results.length }
  }, [clientData?.client?.lab_results])

  // 今日補品完成率
  const todaySupplementStats = useMemo(() => {
    if (!clientData?.todayLogs || !clientData?.client?.supplements) return { completed: 0, total: 0, rate: 0 }
    const completed = clientData.todayLogs.filter((log: any) => log.completed).length
    const total = clientData.client.supplements.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, total, rate }
  }, [clientData?.todayLogs, clientData?.client?.supplements])

  // 本週 / 本月 / 上週補品服從率
  const supplementComplianceStats = useMemo(() => {
    const totalSupplements = clientData?.client?.supplements?.length || 0
    if (!totalSupplements || !clientData?.recentLogs) return { weekRate: 0, monthRate: 0, weekDelta: null as number | null }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const daysAgo = (n: number) => {
      const d = new Date(now)
      d.setDate(d.getDate() - n)
      return d.toISOString().split('T')[0]
    }

    const logs = clientData.recentLogs as any[]

    // 本週（最近 7 天）
    const weekStart = daysAgo(6)
    const weekCompleted = logs.filter((l: any) => l.date >= weekStart && l.date <= todayStr && l.completed).length
    const weekRate = Math.round((weekCompleted / (7 * totalSupplements)) * 100)

    // 本月（最近 30 天）
    const monthStart = daysAgo(29)
    const monthCompleted = logs.filter((l: any) => l.date >= monthStart && l.date <= todayStr && l.completed).length
    const monthRate = Math.round((monthCompleted / (30 * totalSupplements)) * 100)

    // 上週（7-13 天前）
    const lastWeekStart = daysAgo(13)
    const lastWeekEnd = daysAgo(7)
    const lastWeekCompleted = logs.filter((l: any) => l.date >= lastWeekStart && l.date <= lastWeekEnd && l.completed).length
    const lastWeekRate = Math.round((lastWeekCompleted / (7 * totalSupplements)) * 100)

    const weekDelta = weekRate - lastWeekRate

    return { weekRate, monthRate, weekDelta }
  }, [clientData?.recentLogs, clientData?.client?.supplements])

  // 體脂趨勢比較
  const bodyFatTrend = useMemo(() => {
    if (!latestBodyData?.body_fat || !prevBodyData?.body_fat) return null
    const diff = latestBodyData.body_fat - prevBodyData.body_fat
    return { diff: Math.abs(diff).toFixed(1), direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
  }, [latestBodyData, prevBodyData])

  // 連續打卡天數（用 supplement_logs，每天至少一筆 completed=true 就算）
  const streakDays = useMemo(() => {
    if (!clientData?.recentLogs?.length) return 0
    const completedLogs = (clientData.recentLogs as any[]).filter((l: any) => l.completed)
    if (!completedLogs.length) return 0

    // 取得有打卡的不重複日期（降序）
    const datesWithCompleted = [...new Set(completedLogs.map((l: any) => l.date))].sort().reverse()

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const startOffset = datesWithCompleted[0] === todayStr ? 0 : 1
    let streak = 0
    for (let i = 0; i < datesWithCompleted.length; i++) {
      const expected = new Date(now)
      expected.setDate(expected.getDate() - (i + startOffset))
      const expectedStr = expected.toISOString().split('T')[0]
      if (datesWithCompleted[i] === expectedStr) {
        streak++
      } else {
        break
      }
    }
    return streak
  }, [clientData?.recentLogs])

  // 激勵文字
  const streakMessage = useMemo(() => {
    if (streakDays >= 30) return '健康達人！'
    if (streakDays >= 14) return '超棒的習慣！'
    if (streakDays >= 7) return '一週達成！'
    if (streakDays >= 3) return '保持下去！'
    if (streakDays >= 1) return '好的開始！'
    return '今天開始吧！'
  }, [streakDays])

  // 趨勢圖數據（修正 key 對應）
  const trendData = useMemo(() => {
    const trends: Record<string, any[]> = {}
    if (clientData?.bodyData && clientData.bodyData.length > 0) {
      const weightData = clientData.bodyData
        .filter((record: any) => record.weight != null)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((record: any) => ({
          date: new Date(record.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
          value: record.weight
        }))
      if (weightData.length > 0) trends['weight'] = weightData

      const bodyFatData = clientData.bodyData
        .filter((record: any) => record.body_fat != null)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((record: any) => ({
          date: new Date(record.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
          value: record.body_fat
        }))
      if (bodyFatData.length > 0) trends['body_fat'] = bodyFatData
    }
    return trends
  }, [clientData?.bodyData])

  // 新增身體數據
  const handleAddBodyData = async () => {
    if (!newBodyData.weight || newBodyData.weight.trim() === '') {
      alert('請輸入體重')
      return
    }
    const weight = parseFloat(newBodyData.weight)
    if (isNaN(weight) || weight < 20 || weight > 300) {
      alert('體重請輸入 20-300kg 之間的數值')
      return
    }
    try {
      const response = await fetch('/api/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          date: newBodyData.date,
          weight,
          bodyFat: newBodyData.body_fat ? parseFloat(newBodyData.body_fat) : null,
          muscleMass: newBodyData.muscle_mass ? parseFloat(newBodyData.muscle_mass) : null,
          height: newBodyData.height ? parseFloat(newBodyData.height) : null,
          visceralFat: newBodyData.visceral_fat ? parseFloat(newBodyData.visceral_fat) : null
        })
      })
      if (!response.ok) throw new Error('保存失敗')
      setShowAddBodyDataModal(false)
      setNewBodyData({ date: new Date().toISOString().split('T')[0], weight: '', body_fat: '', muscle_mass: '', height: '', visceral_fat: '' })
      mutate()
      alert('身體數據已成功記錄！')
    } catch (err) {
      console.error('新增失敗:', err)
      alert('新增失敗，請重試')
    }
  }

  // 切換補品打卡
  const handleToggleSupplement = async (supplementId: string, currentCompleted: boolean) => {
    setTogglingSupplements(prev => new Set(prev).add(supplementId))
    try {
      const response = await fetch('/api/supplement-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          supplementId,
          date: today,
          completed: !currentCompleted
        })
      })
      if (!response.ok) throw new Error('打卡失敗')
      mutate()
    } catch (err) {
      console.error('打卡失敗:', err)
      alert('打卡失敗，請重試')
    } finally {
      setTogglingSupplements(prev => {
        const next = new Set(prev)
        next.delete(supplementId)
        return next
      })
    }
  }

  // 提交每日感受
  const handleSubmitWellness = async () => {
    if (!wellnessForm.sleep_quality && !wellnessForm.energy_level && !wellnessForm.mood) {
      alert('請至少填寫一項評分')
      return
    }
    setSubmittingWellness(true)
    try {
      const response = await fetch('/api/daily-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          date: today,
          sleep_quality: wellnessForm.sleep_quality,
          energy_level: wellnessForm.energy_level,
          mood: wellnessForm.mood,
          note: wellnessForm.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      mutate()
      alert('今日感受已記錄！')
    } catch (err) {
      console.error('提交失敗:', err)
      alert('提交失敗，請重試')
    } finally {
      setSubmittingWellness(false)
    }
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

        {/* ===== 標題區 ===== */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{clientData.client.name}</h1>
              <p className="text-gray-600">
                {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              clientData.client.status === 'normal'
                ? 'bg-green-100 text-green-800'
                : clientData.client.status === 'attention'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {clientData.client.status === 'normal' ? '健康狀態良好' : '需要關注'}
            </div>
          </div>

          {/* 教練健康分析卡片 */}
          {clientData.client.coach_summary && (
            <div className="bg-blue-50 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Howard 教練的健康分析</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{clientData.client.coach_summary}</p>
              {(clientData.client.next_checkup_date || clientData.client.health_goals) && (
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-blue-100">
                  {clientData.client.next_checkup_date && (
                    <span className="text-xs text-gray-600">
                      📅 下次回檢：{new Date(clientData.client.next_checkup_date).toLocaleDateString('zh-TW')}
                    </span>
                  )}
                  {clientData.client.health_goals && (
                    <span className="text-xs text-gray-600">
                      🎯 目標：{clientData.client.health_goals}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 區塊一：健康總覽摘要卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">本週服從率</p>
              <p className="text-2xl font-bold text-blue-600">{supplementComplianceStats.weekRate}%</p>
              <div className="text-xs text-gray-400">
                <span>本月 {supplementComplianceStats.monthRate}%</span>
                {supplementComplianceStats.weekDelta !== null && supplementComplianceStats.weekDelta !== 0 && (
                  <span className={`ml-1 ${supplementComplianceStats.weekDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {supplementComplianceStats.weekDelta > 0 ? '↑' : '↓'}{Math.abs(supplementComplianceStats.weekDelta)}%
                  </span>
                )}
              </div>
            </div>
            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">血檢正常</p>
              <p className="text-2xl font-bold text-green-600">{labStats.normal}/{labStats.total}</p>
              <p className="text-xs text-gray-400">指標正常</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">體脂趨勢</p>
              <p className="text-2xl font-bold text-orange-600">
                {latestBodyData?.body_fat ? `${latestBodyData.body_fat}%` : '--'}
              </p>
              <p className="text-xs text-gray-400">
                {bodyFatTrend
                  ? bodyFatTrend.direction === 'down' ? `↓${bodyFatTrend.diff}%` : bodyFatTrend.direction === 'up' ? `↑${bodyFatTrend.diff}%` : '持平'
                  : ''}
              </p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">今日感受</p>
              <p className="text-2xl">
                {todayWellness?.mood ? ['', '😫', '😔', '😐', '😊', '😄'][todayWellness.mood] : '--'}
              </p>
              <p className="text-xs text-gray-400">{todayWellness ? '已記錄' : '未記錄'}</p>
            </div>
          </div>
        </div>

        {/* ===== 區塊二：每日打卡 ===== */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                今日打卡
                <span className="ml-2 text-sm font-normal text-gray-500">{streakMessage}</span>
              </h2>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
              </p>
            </div>
            {streakDays > 0 && (
              <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                連續 {streakDays} 天
              </div>
            )}
          </div>

          {/* 今日完成率進度條 */}
          {clientData.client.supplements && clientData.client.supplements.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  {todaySupplementStats.completed === todaySupplementStats.total && todaySupplementStats.total > 0
                    ? '今日全數完成'
                    : `${todaySupplementStats.completed}/${todaySupplementStats.total} 已完成`}
                </span>
                <span className="text-sm font-medium text-gray-700">{todaySupplementStats.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    todaySupplementStats.completed === todaySupplementStats.total && todaySupplementStats.total > 0
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${todaySupplementStats.rate}%` }}
                />
              </div>
            </div>
          )}

          {clientData.client.supplements && clientData.client.supplements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clientData.client.supplements.map((supplement: any) => {
                const log = clientData.todayLogs?.find((l: any) => l.supplement_id === supplement.id)
                const isCompleted = log?.completed || false
                const isToggling = togglingSupplements.has(supplement.id)

                return (
                  <button
                    key={supplement.id}
                    onClick={() => handleToggleSupplement(supplement.id, isCompleted)}
                    disabled={isToggling}
                    className={`flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                      isCompleted
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    } ${isToggling ? 'opacity-50' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${
                      isCompleted ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}>
                      {isCompleted && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                        {supplement.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {supplement.dosage}{supplement.timing ? ` · ${supplement.timing}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">尚未設定補品清單</p>
          )}
        </div>

        {/* ===== 區塊三：每日感受 ===== */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">每日感受</h2>

          <div className="space-y-4">
            {[
              { key: 'sleep_quality' as const, label: '睡眠品質', emoji: '😴' },
              { key: 'energy_level' as const, label: '精力水平', emoji: '⚡' },
              { key: 'mood' as const, label: '心情', emoji: '😊' },
            ].map(({ key, label, emoji }) => (
              <div key={key}>
                <p className="text-sm font-medium text-gray-700 mb-2">{emoji} {label}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => setWellnessForm(prev => ({ ...prev, [key]: score }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        wellnessForm[key] === score
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">今日感受記錄</p>
              <textarea
                value={wellnessForm.note}
                onChange={(e) => setWellnessForm(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="今天感覺如何？"
              />
            </div>

            <button
              onClick={handleSubmitWellness}
              disabled={submittingWellness}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submittingWellness ? '提交中...' : todayWellness ? '更新感受' : '記錄感受'}
            </button>
          </div>
        </div>

        {/* ===== 區塊四：身體數據追蹤 ===== */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">身體數據追蹤</h2>

          {/* 身體數據卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">體重</p>
              <p className="text-xl font-bold text-gray-900">
                {latestBodyData?.weight ? `${latestBodyData.weight} kg` : '--'}
              </p>
              {prevBodyData?.weight != null && latestBodyData?.weight != null && prevBodyData.weight !== latestBodyData.weight && (
                <p className={`text-xs mt-1 ${latestBodyData.weight < prevBodyData.weight ? 'text-green-600' : 'text-red-500'}`}>
                  {latestBodyData.weight < prevBodyData.weight ? '↓' : '↑'}
                  {Math.abs(latestBodyData.weight - prevBodyData.weight).toFixed(1)} kg
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">體脂</p>
              <p className="text-xl font-bold text-gray-900">
                {latestBodyData?.body_fat ? `${latestBodyData.body_fat}%` : '--'}
              </p>
              {prevBodyData?.body_fat != null && latestBodyData?.body_fat != null && prevBodyData.body_fat !== latestBodyData.body_fat && (
                <p className={`text-xs mt-1 ${latestBodyData.body_fat < prevBodyData.body_fat ? 'text-green-600' : 'text-red-500'}`}>
                  {latestBodyData.body_fat < prevBodyData.body_fat ? '↓' : '↑'}
                  {Math.abs(latestBodyData.body_fat - prevBodyData.body_fat).toFixed(1)}%
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">BMI</p>
              <p className="text-xl font-bold text-gray-900">{bmi || '--'}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">肌肉量</p>
              <p className="text-xl font-bold text-gray-900">
                {latestBodyData?.muscle_mass ? `${latestBodyData.muscle_mass} kg` : '--'}
              </p>
              {prevBodyData?.muscle_mass != null && latestBodyData?.muscle_mass != null && prevBodyData.muscle_mass !== latestBodyData.muscle_mass && (
                <p className={`text-xs mt-1 ${latestBodyData.muscle_mass > prevBodyData.muscle_mass ? 'text-green-600' : 'text-red-500'}`}>
                  {latestBodyData.muscle_mass > prevBodyData.muscle_mass ? '↑' : '↓'}
                  {Math.abs(latestBodyData.muscle_mass - prevBodyData.muscle_mass).toFixed(1)} kg
                </p>
              )}
            </div>
          </div>

          {/* 趨勢圖切換按鈕 */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setTrendType('weight')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                trendType === 'weight'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              體重趨勢
            </button>
            <button
              onClick={() => setTrendType('body_fat')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                trendType === 'body_fat'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              體脂趨勢
            </button>
          </div>

          {/* 趨勢圖 */}
          <div className="h-64 w-full min-w-0">
            <LazyChart
              data={trendData[trendType] || []}
              height={256}
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </div>
        </div>

        {/* ===== 區塊五：血檢指標 ===== */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">血檢指標</h2>

          {clientData.client.lab_results && clientData.client.lab_results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientData.client.lab_results.map((result: any) => {
                const advice = getLabAdvice(result.test_name, result.value)
                const statusColor =
                  result.status === 'normal' ? 'border-green-200 bg-green-50'
                  : result.status === 'attention' ? 'border-yellow-200 bg-yellow-50'
                  : 'border-red-200 bg-red-50'
                const dotColor =
                  result.status === 'normal' ? 'bg-green-500'
                  : result.status === 'attention' ? 'bg-yellow-500'
                  : 'bg-red-500'

                return (
                  <div key={result.id} className={`rounded-xl p-4 border ${statusColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{result.test_name}</h3>
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {result.value} <span className="text-sm font-normal text-gray-500">{result.unit}</span>
                    </p>
                    {advice && <p className="text-sm text-gray-600 mt-2">{advice}</p>}
                    <p className="text-xs text-gray-400 mt-1">參考範圍：{result.reference_range}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">尚無血檢資料</p>
          )}
        </div>

        {/* ===== 行動計畫 / 教練備註 ===== */}
        {(() => {
          const hasGoals = !!clientData.client.health_goals
          const hasCheckup = !!clientData.client.next_checkup_date
          const hasSummary = !!clientData.client.coach_summary
          const hasAny = hasGoals || hasCheckup || hasSummary

          if (hasAny) {
            const checkupDate = hasCheckup ? new Date(clientData.client.next_checkup_date) : null
            const isOverdue = checkupDate ? checkupDate < new Date() : false
            const topSupplements = clientData.client.supplements
              ?.slice()
              .sort((a: any, b: any) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity))
              .slice(0, 3)

            return (
              <div className="bg-white rounded-3xl shadow-sm p-6 mb-20">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 你的行動計畫</h2>
                <div className="space-y-3">
                  {hasGoals && (
                    <div className="flex items-start">
                      <span className="mr-2 flex-shrink-0">🎯</span>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">目標：</span>{clientData.client.health_goals}
                      </p>
                    </div>
                  )}
                  {hasCheckup && (
                    <div className="flex items-start">
                      <span className="mr-2 flex-shrink-0">📅</span>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">下次回檢：</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {checkupDate!.toLocaleDateString('zh-TW')}
                          {isOverdue && ' （已逾期）'}
                        </span>
                      </p>
                    </div>
                  )}
                  {topSupplements && topSupplements.length > 0 && (
                    <div className="flex items-start">
                      <span className="mr-2 flex-shrink-0">💊</span>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">今日重點：</span>
                        {topSupplements.map((s: any) => s.name).join('、')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div className="bg-white rounded-3xl shadow-sm p-6 mb-20">
              <p className="text-gray-600">持續追蹤中，有問題隨時 LINE 我！— Howard 教練</p>
            </div>
          )
        })()}
      </div>

      {/* 固定底部新增按鈕 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-[100]">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowAddBodyDataModal(true)}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Plus size={20} className="mr-2" />
            新增身體紀錄
          </button>
        </div>
      </div>

      {/* 新增身體數據 Modal */}
      {showAddBodyDataModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-end justify-center z-[100] backdrop-blur-sm"
          onClick={() => setShowAddBodyDataModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Plus size={16} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">新增身體數據</h3>
              </div>
              <button
                onClick={() => setShowAddBodyDataModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Calendar size={16} className="mr-1 text-gray-500" />
                  日期
                </label>
                <input
                  type="date"
                  value={newBodyData.date}
                  onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Scale size={16} className="mr-1 text-gray-500" />
                  體重 (kg) <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    value={newBodyData.weight}
                    onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, weight: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="請輸入體重"
                  />
                  <span className="absolute right-3 top-3 text-gray-500 text-sm">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Activity size={16} className="mr-1 text-gray-500" />
                  體脂 (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="60"
                    value={newBodyData.body_fat}
                    onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, body_fat: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="選填"
                  />
                  <span className="absolute right-3 top-3 text-gray-500 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Dumbbell size={16} className="mr-1 text-gray-500" />
                  肌肉量 (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="10"
                    max="100"
                    value={newBodyData.muscle_mass}
                    onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, muscle_mass: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="選填"
                  />
                  <span className="absolute right-3 top-3 text-gray-500 text-sm">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Ruler size={16} className="mr-1 text-gray-500" />
                  身高 (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="100"
                    max="250"
                    value={newBodyData.height}
                    onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, height: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="選填"
                  />
                  <span className="absolute right-3 top-3 text-gray-500 text-sm">cm</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Heart size={16} className="mr-1 text-gray-500" />
                  內臟脂肪
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="30"
                  value={newBodyData.visceral_fat}
                  onChange={(e) => setNewBodyData((prev: any) => ({ ...prev, visceral_fat: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="選填"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleAddBodyData}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-blue-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shadow-lg"
              >
                <Plus size={20} className="mr-2" />
                儲存紀錄
              </button>
              <button
                onClick={() => setShowAddBodyDataModal(false)}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
