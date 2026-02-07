'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { calculateLabStatus } from '@/utils/labStatus'
import { useClientData } from '@/hooks/useClientData'
import { LineChart, Tooltip, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Line } from 'recharts'
import { CheckCircle2, TrendingUp, TrendingDown, Calendar, Smile, BatteryCharging } from 'lucide-react'
import React from 'react'

interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
}

interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface SupplementLog {
  id: string
  supplement_id: string
  date: string
  completed: boolean
}

interface BodyComposition {
  id: string
  date: string
  height?: number | null
  weight?: number | null
  body_fat?: number | null
  muscle_mass?: number | null
  visceral_fat?: number | null
  bmi?: number | null
}

interface WellnessData {
  id: string
  client_id: string
  date: string
  sleep_quality: number | null
  energy_level: number | null
  mood: number | null
  note: string | null
  created_at: string
}

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  lab_results: LabResult[]
  supplements: Supplement[]
}

export default function ClientDashboard() {
  const params = useParams()
  const clientId = params.clientId as string
  
  // 使用 SWR 獲取客戶資料
  const { data: clientData, error, isLoading, mutate } = useClientData(clientId)
  
  // 計算血檢狀態統計
  const labStats = useMemo(() => {
    if (!clientData?.client?.lab_results) return { normal: 0, attention: 0, alert: 0 }
    
    return clientData.client.lab_results.reduce((stats: any, result: any) => {
      stats[result.status]++
      return stats
    }, { normal: 0, attention: 0, alert: 0 })
  }, [clientData?.client?.lab_results])
  
  // 計算補品完成率
  const supplementStats = useMemo(() => {
    if (!clientData?.todayLogs || !clientData?.client?.supplements) return { completed: 0, total: 0, rate: 0 }
    
    const completed = clientData.todayLogs.filter(log => log.completed).length
    const total = clientData.client.supplements.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { completed, total, rate }
  }, [clientData?.todayLogs, clientData?.client?.supplements])
  
  // 計算體脂趨勢
  const bodyFatTrend = useMemo(() => {
    if (!clientData?.bodyData || clientData.bodyData.length < 2) return null
    
    const sortedData = clientData.bodyData
      .filter(record => record.body_fat !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    if (sortedData.length < 2) return null
    
    const latest = sortedData[sortedData.length - 1]
    const previous = sortedData[sortedData.length - 2]
    const change = latest.body_fat - previous.body_fat
    const changePercent = previous.body_fat > 0 ? (change / previous.body_fat * 100) : 0
    
    return {
      current: latest.body_fat,
      change: changePercent,
      trend: changePercent > 0 ? 'up' : 'down'
    }
  }, [clientData?.bodyData])
  
  // 計算趨勢資料
  const trendData = useMemo(() => {
    const trends: Record<string, any[]> = {}
    
    // 血檢趨勢
    if (clientData?.client?.lab_results) {
      const uniqueTests = [...new Set(clientData.client.lab_results.map((r: any) => r.test_name))]
      uniqueTests.forEach((testName: any) => {
        trends[testName] = clientData.client.lab_results
          .filter((result: any) => result.test_name === testName)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((result: any) => ({
            date: new Date(result.date).toLocaleDateString('zh-TW', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit' 
            }),
            value: result.value,
            status: result.status
          }))
      })
    }
    
    // 身體數據趨勢
    if (clientData?.bodyData && clientData.bodyData.length > 0) {
      // 體重趨勢
      const weightData = clientData.bodyData
        .filter(record => record.weight !== null && record.weight !== undefined)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((record: any) => ({
          date: new Date(record.date).toLocaleDateString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }),
          value: record.weight,
          status: 'normal'
        }))
      
      if (weightData.length > 0) {
        trends['體重'] = weightData
      }
      
      // 體脂肪趨勢
      const bodyFatData = clientData.bodyData
        .filter(record => record.body_fat !== null && record.body_fat !== undefined)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((record: any) => ({
          date: new Date(record.date).toLocaleDateString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }),
          value: record.body_fat,
          status: 'normal'
        }))
      
      if (bodyFatData.length > 0) {
        trends['體脂肪'] = bodyFatData
      }
    }
    
    return trends
  }, [clientData?.client?.lab_results, clientData?.bodyData])
  
  // 處理補品打卡
  const handleSupplementToggle = useCallback(async (supplementId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    try {
      const response = await fetch('/api/supplement-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientData?.client?.id,
          supplement_id: supplementId,
          date: today,
          completed: !clientData?.todayLogs.find(log => log.supplement_id === supplementId)?.completed
        })
      })
      
      if (!response.ok) {
        throw new Error('打卡失敗')
      }
      
      // 重新獲取資料
      mutate()
    } catch (error) {
      console.error('打卡失敗:', error)
    }
  }, [clientData?.client?.todayLogs, clientData?.client?.id, mutate])
  
  // 處理每日感受提交
  const handleWellnessSubmit = useCallback(async (wellnessData: {
    sleep_quality: number
    energy_level: number
    mood: number
    note: string
  }) => {
    try {
      const response = await fetch('/api/daily-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId,
          date: new Date().toISOString().split('T')[0],
          ...wellnessData
        })
      })
      
      if (!response.ok) {
        throw new Error('提交失敗')
      }
      
      // 重新獲取資料
      mutate()
      
      // 顯示成功提示
      alert('每日感受已記錄！')
    } catch (error) {
      console.error('提交失敗:', error)
      alert('提交失敗，請重試')
    }
  }, [clientId, mutate])
  
  // 獲取今日感受
  const todayWellness = clientData?.wellness?.find(w => w.date === new Date().toISOString().split('T')[0])
  
  // 獲取連續打卡天數
  const streakDays = useMemo(() => {
    if (!clientData?.wellness || clientData.wellness.length === 0) return 0
    
    const sortedDates = clientData.wellness
      .map(w => w.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    
    let streak = 0
    const today = new Date().toISOString().split('T')[0]
    
    for (const date of sortedDates) {
      if (date === today) {
        streak++
      } else {
        break
      }
    }
    
    return streak
  }, [clientData?.wellness])
  
  // 獲取最新身體數據
  const latestBodyData = clientData?.bodyData?.[0]
  
  // 設計趨勢圖類型切換
  const [trendType, setTrendType] = useState<'weight' | 'body_fat'>('weight')
  
  // 每日感受狀態
  const [wellnessState, setWellnessState] = useState({
    sleep_quality: todayWellness?.sleep_quality || null,
    energy_level: todayWellness?.energy_level || null,
    mood: todayWellness?.mood || null,
    note: todayWellness?.note || ''
  })
  
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
        <div className="text-center bg-white rounded-2xl shadow-sm p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">錯誤</h1>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <p className="text-sm text-gray-500">
            請確認網址是否正確，或聯繫 Howard 教練
          </p>
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
  
  const client = clientData.client
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 區塊一：健康總覽 */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{client.name}</h1>
            <p className="text-lg text-gray-500">
              {new Date().toLocaleDateString('zh-TW', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            client.status === 'normal' 
              ? 'bg-green-100 text-green-800' 
              : client.status === 'attention'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {client.status === 'normal' ? '健康狀態良好' : '需要關注'}
          </div>
        </div>
        
        {/* 摘要統計卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* 補品服從率 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">📋 補品服從率</span>
              <span className="text-2xl font-bold text-blue-600">{supplementStats.rate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${supplementStats.rate}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 text-center">
              {supplementStats.completed}/{supplementStats.total} 已完成
            </div>
          </div>
          
          {/* 血檢狀態 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">🔬 血檢狀態</span>
              <span className="text-2xl font-bold text-green-600">{labStats.normal}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(labStats.normal / (labStats.normal + labStats.attention + labStats.alert)) * 100}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 text-center">
              {labStats.normal}/{labStats.normal + labStats.attention + labStats.alert} 項標正常
            </div>
          </div>
          
          {/* 體脂趨勢 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">📉 體脂趨勢</span>
              <span className="text-2xl font-bold text-purple-600">
                {latestBodyData?.body_fat || '--'}%
              </span>
            </div>
            <div className="flex items-center justify-center">
              {bodyFatTrend?.trend === 'up' ? (
                <TrendingUp className="text-red-500" size={16} />
              ) : (
                <TrendingDown className="text-green-500" size={16} />
              )}
              <span className="text-sm text-gray-600 ml-1">
                {bodyFatTrend?.change ? (bodyFatTrend.change > 0 ? '+' : '') + bodyFatTrend.change.toFixed(1) + '%' : '首次記錄'}
              </span>
            </div>
            <div className="text-xs text-gray-500 text-center">
              {bodyFatTrend?.change ? 'vs 上次: ' + (bodyFatTrend.current - (bodyFatTrend.change / 100)).toFixed(1) + '%' : '首次記錄'}
            </div>
          </div>
          
          {/* 今日感受 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">😊 今日感受</span>
              {todayWellness ? (
                <div className="flex items-center">
                  <span className="text-2xl mr-2">
                    {todayWellness.mood === 5 ? '😊' : todayWellness.mood === 4 ? '😊' : todayWellness.mood === 3 ? '😐' : todayWellness.mood === 2 ? '😐' : '😔'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {todayWellness.note || ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-gray-400">
                  <span className="text-2xl mr-2">📝</span>
                  <span className="text-sm text-gray-400">未記錄</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 區塊二：每日打卡區 */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">📅 今日打卡</h2>
            <p className="text-gray-500">
              {new Date().toLocaleDateString('zh-TW', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">連續打卡</span>
            <span className="ml-2 text-2xl font-bold text-blue-600">🔥 {streakDays}</span>
          </div>
        </div>
        
        {/* 補品打卡網格 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {clientData.client.supplements.map((supplement: Supplement) => {
            const isCompleted = clientData.todayLogs?.find(log => log.supplement_id === supplement.id)?.completed
            return (
              <div 
                key={supplement.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                  isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200'
                } transition-all duration-200 hover:shadow-md cursor-pointer`}
                onClick={() => handleSupplementToggle(supplement.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-all duration-200 ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isCompleted && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">{supplement.name}</h3>
                      <p className="text-sm text-gray-500">{supplement.dosage}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{supplement.timing}</div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* 每日感受滑桿 */}
        <div className="space-y-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">😴 睡眠品質</span>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      wellnessState.sleep_quality === value
                        ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                    onClick={() => setWellnessState(prev => ({ ...prev, sleep_quality: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">⚡ 精力水平</span>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      wellnessState.energy_level === value
                        ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                    onClick={() => setWellnessState(prev => ({ ...prev, energy_level: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">😊 心情</span>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      wellnessState.mood === value
                        ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                    onClick={() => setWellnessState(prev => ({ ...prev, mood: value }))}
                  >
                    {value === 1 ? '😔' : value === 2 ? '😐' : value === 3 ? '😊' : value === 4 ? '😊' : '😊'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <textarea
              placeholder="今日感受記錄..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={wellnessState.note}
              onChange={(e) => setWellnessState(prev => ({ ...prev, note: e.target.value }))}
            />
            <button
              onClick={() => {
                if (wellnessState.sleep_quality && wellnessState.energy_level && wellnessState.mood) {
                  handleWellnessSubmit(wellnessState)
                }
              }}
              className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              提交今日感受
            </button>
          </div>
        </div>
      </div>
      
      {/* 區塊三：身體組成趨勢 */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 身體數據追蹤</h2>
        
        {/* 最新數據卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* 體重 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">體重</div>
            <div className="text-3xl font-bold text-gray-900">{latestBodyData?.weight || '--'}</div>
            <div className="text-sm text-gray-500">kg</div>
            {latestBodyData?.weight && clientData.bodyData.length > 1 && (
              <div className="flex items-center text-sm text-gray-500">
                {clientData.bodyData[0].weight > clientData.bodyData[1].weight ? (
                  <TrendingUp className="text-green-500 text-sm" size={12} />
                ) : (
                  <TrendingDown className="text-red-500 text-sm" size={12} />
                )}
                <span className="ml-1">
                  {Math.abs(latestBodyData.weight - clientData.bodyData[1].weight).toFixed(1)} kg
                </span>
              </div>
            )}
          </div>
          
          {/* 體脂 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">體脂肪</div>
            <div className="text-3xl font-bold text-gray-900">{latestBodyData?.body_fat || '--'}</div>
            <div className="text-sm text-gray-500">%</div>
            {bodyFatTrend && (
              <div className="flex items-center text-sm text-gray-500">
                {bodyFatTrend?.trend === 'up' ? (
                  <TrendingUp className="text-red-500 text-sm" size={12} />
                ) : (
                  <TrendingDown className="text-green-500 text-sm" size={12} />
                )}
                <span className="ml-1">
                  {Math.abs(bodyFatTrend?.change).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          {/* BMI */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">BMI</div>
            <div className="text-3xl font-bold text-gray-900">{latestBodyData?.bmi || '--'}</div>
            <div className="text-sm text-gray-500">kg/m²</div>
          </div>
          
          {/* 肌肉量 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">肌肉量</div>
            <div className="text-3xl font-bold text-gray-900">{latestBodyData?.muscle_mass || '--'}</div>
            <div className="text-sm text-gray-500">kg</div>
          </div>
        </div>
        
        {/* 趨勢圖 */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">📈 身體數據趨勢圖</h3>
          <div className="mb-4">
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
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData[trendType] || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 區塊四：血檢追蹤 */}
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔬 血檢指標</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(trendData).filter(testName => !['體重', '體脂肪'].includes(testName)).map((testName) => {
            const testResults = trendData[testName]
            if (testResults.length === 0) return null
            
            const latestResult = testResults[testResults.length - 1]
            const status = latestResult.status
            const value = latestResult.value
            const unit = latestResult.unit
            const referenceRange = latestResult.reference_range
            
            // 白話解釋
            let explanation = ''
            if (testName === 'HOMA-IR') {
              if (value < 1.4) explanation = '胰島素敏感度很好'
              else if (value < 1.4) explanation = '胰島素敏感度正常'
              else explanation = '胰島素敏感度需要改善'
            } else if (testName === '同半胱胺酸') {
              if (value < 8) explanation = '甲基化代謝正常'
              else explanation = '甲基化代謝需要改善'
            } else if (testName === '維生素D') {
              if (value > 50) explanation = '維生素D充足'
              else if (value >= 30) explanation = '維生素D偏低，建議補充'
              else explanation = '維生素D不足'
            } else if (testName === '鐵蛋白') {
              if (value >= 50 && value <= 150) explanation = '鐵儲存正常'
              else explanation = '鐵儲存偏低'
            }
            
            return (
              <div key={testName} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      status === 'normal' 
                        ? 'bg-green-500' 
                        : status === 'attention' 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}></div>
                    <div>
                      <h3 className="font-medium text-gray-900">{testName}</h3>
                      <p className="text-sm text-gray-600">{referenceRange} {unit}</p>
                    </div>
                  </div>
                  <div className={`text-2xl font-light text-gray-900 ${
                    status === 'normal' 
                      ? 'text-green-600' 
                      : status === 'attention' 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                  }`}>
                    {value}
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">{explanation}</div>
                {testResults.length > 1 && (
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={testResults}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }} />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 區塊五：Howard 教練備註 */}
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
            <span className="text-2xl">👨</span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">Howard 教練</h3>
            <p className="text-gray-600">
              {clientData?.client?.coach_note || '持續追蹤中，有問題隨時 LINE 我！— Howard 教練'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
