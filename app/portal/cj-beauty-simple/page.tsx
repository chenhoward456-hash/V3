'use client'

import { useState, useEffect } from 'react'

export default function CJBeautyPortalSimple() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }, [])

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
          <div className="border rounded-xl p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">同半胱胺酸</h3>
              <span className="text-2xl">🔴</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-gray-900">12.5</span>
              <span className="text-sm text-gray-500">/ 8.0 μmol/L</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">心血管健康指標</p>
          </div>
          
          <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">鐵蛋白</h3>
              <span className="text-2xl">🟡</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-gray-900">45</span>
              <span className="text-sm text-gray-500">/ 50 ng/mL</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">鐵質儲存指標</p>
          </div>
          
          <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">體脂肪率</h3>
              <span className="text-2xl">🟡</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-gray-900">28.5</span>
              <span className="text-sm text-gray-500">/ 25.0 %</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">身體組成指標</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-light text-gray-900 mb-4">今日任務</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <button className="p-4 rounded-xl border border-gray-200 hover:border-gray-300">
            <div className="text-left">
              <h4 className="font-medium text-sm text-gray-900">葉酸</h4>
              <p className="text-xs text-gray-500 mt-1">800mcg</p>
              <p className="text-xs text-gray-400">早餐後</p>
            </div>
          </button>
          
          <button className="p-4 rounded-xl border border-gray-200 hover:border-gray-300">
            <div className="text-left">
              <h4 className="font-medium text-sm text-gray-900">維生素 B12</h4>
              <p className="text-xs text-gray-500 mt-1">1000mcg</p>
              <p className="text-xs text-gray-400">早餐後</p>
            </div>
          </button>
          
          <button className="p-4 rounded-xl border border-gray-200 hover:border-gray-300">
            <div className="text-left">
              <h4 className="font-medium text-sm text-gray-900">鐵質</h4>
              <p className="text-xs text-gray-500 mt-1">30mg</p>
              <p className="text-xs text-gray-400">午餐後</p>
            </div>
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          🎯 這是最簡化版本的承鈞美麗儀表板
        </p>
        <p className="text-sm text-gray-500">
          📊 包含基本指標和任務功能
        </p>
        <p className="text-sm text-gray-500">
          🚀 如果能看到這個，表示路由正常工作
        </p>
      </div>
    </div>
  )
}
