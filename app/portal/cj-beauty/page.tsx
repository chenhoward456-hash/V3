'use client'

import { useState, useEffect } from 'react'
import { MetricCard, TaskButton, ProgressChart } from '@/components/portal'
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
    // 模擬載入數據
    setTimeout(() => {
      setMetrics(cjBeautyData.metrics)
      setCompletedTasks([])
      setIsLoading(false)
    }, 1000)
  }, [])

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
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light text-gray-900">承鈞 美麗儀表板</h1>
              <p className="text-sm text-gray-500 mt-1">個人化健康優化系統</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">最後更新</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('zh-TW')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 關鍵指標 */}
        <div className="mb-8">
          <h2 className="text-lg font-light text-gray-900 mb-4">關鍵指標</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric) => {
              const status = getStatusColor(metric.current, metric.target)
              const emoji = getStatusEmoji(status)
              
              return (
                <MetricCard
                  key={metric.id}
                  title={metric.name}
                  current={metric.current}
                  target={metric.target}
                  unit={metric.unit}
                  status={status}
                  emoji={emoji}
                  description={metric.description}
                />
              )
            })}
          </div>
        </div>

        {/* 今日任務 */}
        <div className="mb-8">
          <h2 className="text-lg font-light text-gray-900 mb-4">今日任務</h2>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {supplementsData
                .filter(supplement => supplement.level === 1)
                .map((supplement) => (
                  <TaskButton
                    key={supplement.id}
                    name={supplement.name}
                    dosage={supplement.dosage}
                    timing={supplement.timing}
                    completed={completedTasks.includes(supplement.id)}
                    onComplete={() => handleTaskComplete(supplement.id)}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* 進度圖表 */}
        <div className="mb-8">
          <h2 className="text-lg font-light text-gray-900 mb-4">六週目標對比</h2>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <ProgressChart metrics={metrics} />
          </div>
        </div>

        {/* 討論區 */}
        <div>
          <h2 className="text-lg font-light text-gray-900 mb-4">優化重點</h2>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">同半胱胺酸 (Hcy) 優化</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    目前值偏高，需要加強 B 群維他命與葉酸攝取，建議優先處理。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">鐵蛋白平衡</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    接近目標值，維持當前補鐵策略，注意維生素 C 攝取。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">體脂肪率</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    進展良好，維持當前訓練強度與飲食控制。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
