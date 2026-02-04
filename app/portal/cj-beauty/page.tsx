'use client'

import { useState, useEffect } from 'react'
import { cjBeautyData, supplementsData } from '@/data/cj-beauty'

interface Metric {
  id: string
  name: string
  current: number
  target: number
  unit: string
  description: string
}

export default function CJBeautyPortal() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 載入真實數據
    loadRealData()
  }, [])

  const loadRealData = async () => {
    try {
      setIsLoading(true)
      
      // 嘗試從 localStorage 載入數據
      const savedMetrics = localStorage.getItem('cj-beauty-metrics')
      const savedSupplements = localStorage.getItem('cj-beauty-supplements')
      
      if (savedMetrics) {
        setMetrics(JSON.parse(savedMetrics))
      } else {
        // 如果沒有保存的數據，使用模擬數據
        setMetrics(cjBeautyData.metrics)
      }
      
      setCompletedTasks([])
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading real data:', error)
      // 如果載入失敗，使用模擬數據
      setMetrics(cjBeautyData.metrics)
      setCompletedTasks([])
      setIsLoading(false)
    }
  }

  const syncFromWebhook = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'manual'
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.metrics) {
        setMetrics(data.metrics)
        localStorage.setItem('cj-beauty-metrics', JSON.stringify(data.metrics))
        alert('數據同步成功！')
      } else {
        alert('同步失敗：' + (data.error || '未知錯誤'))
      }
    } catch (error) {
      alert('同步失敗：' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskComplete = (taskId: string) => {
    setCompletedTasks(prev => [...prev, taskId])
  }

  const getStatusColor = (current: number, target: number) => {
    const ratio = current / target
    if (ratio >= 0.9) return 'green'
    if (ratio >= 0.7) return 'yellow'
    return 'red'
  }

  const getStatusEmoji = (color: string) => {
    switch(color) {
      case 'green': return '🟢'
      case 'yellow': return '🟡'
      case 'red': return '🔴'
      default: return '⚪'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
          <p className="text-xs text-gray-400 mt-2">承鈞美麗儀表板</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <h1 className="text-2xl font-light text-gray-900 mb-4">承鈞 美麗儀表板</h1>
      <p className="text-gray-600 mb-4">個人化健康優化系統</p>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">關鍵指標</h2>
        <div className="space-y-4">
          {metrics.map((metric) => {
            const status = getStatusColor(metric.current, metric.target)
            const emoji = getStatusEmoji(status)
            
            return (
              <div key={metric.id} className="border rounded-xl p-4 bg-red-50 border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{metric.name}</h3>
                  <span className="text-2xl">{emoji}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light text-gray-900">{metric.current}</span>
                  <span className="text-sm text-gray-500">/ {metric.target} {metric.unit}</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">{metric.description}</p>
              </div>
            )
          })}
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-light text-gray-900 mb-4">今日任務</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {supplementsData
            .filter(supplement => supplement.level === 1)
            .map((supplement) => (
              <button
                key={supplement.id}
                onClick={() => handleTaskComplete(supplement.id)}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  completedTasks.includes(supplement.id)
                    ? 'bg-green-50 border-green-200 cursor-not-allowed' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-left">
                  <h4 className={`font-medium text-sm ${completedTasks.includes(supplement.id) ? 'text-green-700' : 'text-gray-900'}`}>
                    {supplement.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">{supplement.dosage}</p>
                  <p className="text-xs text-gray-400">{supplement.timing}</p>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
