'use client'

import { useState, useEffect } from 'react'
import { cjBeautyData, supplementsData } from '@/data/cj-beauty'
import { TaskCompleteAnimation, ProgressRing, FloatingNotification, Confetti } from '@/components/ui/Animations'

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
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState<'success' | 'info' | 'warning'>('success')
  const [lastCompletedTask, setLastCompletedTask] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

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
    const supplement = supplementsData.find(s => s.id === taskId)
    if (supplement && !completedTasks.includes(taskId)) {
      setCompletedTasks(prev => [...prev, taskId])
      setLastCompletedTask(supplement.name)
      setShowConfetti(true)
      setNotificationMessage(`✅ ${supplement.name} 已完成！`)
      setNotificationType('success')
      setShowNotification(true)
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-gray-900 tracking-tight">承鈞 美麗儀表板</h1>
              <p className="text-gray-600 mt-1">個人化健康優化系統</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">最後更新</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('zh-TW')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 關鍵指標 */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">關鍵指標</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">需改善</span>
              <div className="w-2 h-2 bg-yellow-500 rounded-full ml-4"></div>
              <span className="text-sm text-gray-600">接近目標</span>
              <div className="w-2 h-2 bg-green-500 rounded-full ml-4"></div>
              <span className="text-sm text-gray-600">達標</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((metric) => {
              const status = getStatusColor(metric.current, metric.target)
              const emoji = getStatusEmoji(status)
              const progress = Math.min((metric.current / metric.target) * 100, 100)
              
              return (
                <div key={metric.id} className="group relative">
                  <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
                    status === 'red' ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    status === 'yellow' ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    'bg-gradient-to-br from-green-50 to-green-100'
                  }`}></div>
                  
                  <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">{metric.name}</h3>
                      <span className="text-3xl">{emoji}</span>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-light text-gray-900">{metric.current}</span>
                        <span className="text-sm text-gray-500">/ {metric.target} {metric.unit}</span>
                      </div>
                      
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            status === 'green' ? 'bg-green-500' : 
                            status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600">{metric.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* 今日任務 */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">今日任務</h2>
            <div className="text-sm text-gray-600">
              已完成 {completedTasks.length} / {supplementsData.filter(s => s.level === 1).length}
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {supplementsData
                .filter(supplement => supplement.level === 1)
                .map((supplement) => (
                  <button
                    key={supplement.id}
                    onClick={() => handleTaskComplete(supplement.id)}
                    disabled={completedTasks.includes(supplement.id)}
                    className={`relative group transition-all duration-300 ${
                      completedTasks.includes(supplement.id)
                        ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-not-allowed' 
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                    } rounded-xl p-4 text-left`}
                  >
                    {completedTasks.includes(supplement.id) && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        completedTasks.includes(supplement.id) ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        <span className="text-white text-lg">
                          {completedTasks.includes(supplement.id) ? '✓' : '💊'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium text-sm ${
                          completedTasks.includes(supplement.id) ? 'text-green-700' : 'text-gray-900'
                        }`}>
                          {supplement.name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">{supplement.dosage}</p>
                        <p className="text-xs text-gray-400">{supplement.timing}</p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* 動畫組件 */}
      <TaskCompleteAnimation 
        isComplete={lastCompletedTask !== ''} 
        onComplete={() => setLastCompletedTask('')}
      />
      
      <FloatingNotification
        message={notificationMessage}
        type={notificationType}
        onClose={() => setShowNotification(false)}
      />
      
      <Confetti trigger={showConfetti} />
    </div>
  )
}
