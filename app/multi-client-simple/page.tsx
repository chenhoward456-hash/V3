'use client'

import { useState, useEffect, Suspense } from 'react'
import { calculateLabStatus } from '@/utils/labStatus'
import { useRouter, useSearchParams } from 'next/navigation'

interface LabResult {
  name: string
  category: string
  value: number
  unit: string
  reference: string
  status: 'normal' | 'low' | 'high'
  date: string
  description: string
}

interface SupplementTask {
  id: string
  name: string
  dosage: string
  time: string
  icon: string
  completed: boolean
}

interface Client {
  id: string
  name: string
  age: number
  gender: string
  lastUpdate: string
  status: 'normal' | 'attention' | 'alert'
  labResults: LabResult[]
  supplements: SupplementTask[]
}

function MultiClientSimpleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [clients] = useState<Client[]>([
    {
      id: 'chengjun',
      name: '承鈞',
      age: 25,
      gender: '女性',
      lastUpdate: '2024/01/15',
      status: 'attention',
      labResults: [
        {
          name: 'HOMA-IR',
          category: '胰島素抵抗',
          value: 0.27,
          unit: '',
          reference: '<1.4',
          status: 'normal',
          date: '2024/01/15',
          description: '胰島素抵抗正常'
        },
        {
          name: '同半胱胺酸',
          category: '心血管檢測',
          value: 14.8,
          unit: 'µmol/L',
          reference: '<8.0',
          status: 'high',
          date: '2024/01/15',
          description: '嚴重偏高，需要立即處理'
        },
        {
          name: '維生素D',
          category: '維生素檢測',
          value: 35.3,
          unit: 'ng/mL',
          reference: '>50',
          status: 'low',
          date: '2024/01/15',
          description: '維生素D不足，需要補充'
        },
        {
          name: '鐵蛋白',
          category: '礦物質檢測',
          value: 45.9,
          unit: 'ng/mL',
          reference: '50-150',
          status: 'low',
          date: '2024/01/15',
          description: '鐵蛋白偏低，需要補充'
        }
      ],
      supplements: [
        { id: 'b_complex', name: 'B群(5-MTHF+B12)', dosage: '800mcg+1000mcg', time: '早餐', icon: '💊', completed: false },
        { id: 'd3_k2', name: 'D3+K2', dosage: '5000IU+200mcg', time: '早餐', icon: '💊', completed: false },
        { id: 'iron', name: '鐵劑(雙甘胺酸鐵)', dosage: '25mg', time: '早餐', icon: '🔴', completed: false },
        { id: 'inositol', name: '肌醇(40:1)', dosage: '2g', time: '早餐', icon: '💊', completed: false },
        { id: 'chromium', name: '鉻', dosage: '600mcg', time: '午餐前', icon: '💊', completed: false },
        { id: 'fish_oil', name: '魚油', dosage: '2g', time: '晚餐', icon: '🐟', completed: false },
        { id: 'glycine_magnesium', name: '甘胺酸鎂', dosage: '400mg', time: '睡前', icon: '💊', completed: false }
      ]
    }
  ])
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'attention': return 'bg-yellow-100 text-yellow-800'
      case 'alert': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const getLabStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600'
      case 'low': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-light text-gray-900 mb-6">
            多客戶健康管理系統 - 簡化版
          </h1>
          
          {/* Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/c/${client.id}`)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{client.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                    {client.status === 'normal' ? '正常' : '需要關注'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <p>{client.age}歲 • {client.gender}</p>
                  <p>最後更新：{client.lastUpdate}</p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">檢測項目</span>
                    <span className="text-sm font-medium">{client.labResults.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">補品項目</span>
                    <span className="text-sm font-medium">{client.supplements.length}</span>
                  </div>
                </div>
                
                {/* Quick Status */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">關鍵指標</h4>
                  <div className="space-y-1">
                    {client.labResults.slice(0, 3).map((result, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{result.name}</span>
                        <span className={`font-medium ${getLabStatusColor(result.status)}`}>
                          {result.value} {result.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">系統特色</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-medium text-gray-900 mb-2">即時數據監控</h3>
              <p className="text-sm text-gray-600">血檢數據即時更新，趨勢圖表一目了然</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💊</div>
              <h3 className="font-medium text-gray-900 mb-2">智能補品管理</h3>
              <p className="text-sm text-gray-600">個人化補品方案，打卡提醒功能</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-medium text-gray-900 mb-2">健康趨勢分析</h3>
              <p className="text-sm text-gray-600">長期健康數據追蹤，改善狀況清晰可見</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔄</div>
              <h3 className="font-medium text-gray-900 mb-2">方便替換</h3>
              <p className="text-sm text-gray-600">輕鬆更新學員數據，資料同步無縫接軌</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="font-medium text-gray-900 mb-2">資料安全保護</h3>
              <p className="text-sm text-gray-600">隱私保護機制，健康資料安全可靠</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📱</div>
              <h3 className="font-medium text-gray-900 mb-2">行動裝置支援</h3>
              <p className="text-sm text-gray-600">手機平板皆可使用，隨時隨地管理健康</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MultiClientSimplePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MultiClientSimpleContent />
    </Suspense>
  )
}
