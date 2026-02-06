'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { calculateLabStatus } from '@/utils/labStatus'

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

interface Client {
  id: string
  name: string
  age: number
  gender: string
  lastUpdate: string
  status: 'normal' | 'attention' | 'alert'
  labResults: LabResult[]
}

interface SupplementTask {
  id: string
  name: string
  dosage: string
  time: string
  icon: string
}

function HealthMonitoringContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client')
  
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
          description: '胰島素抵抗正常，藥物壓低-真實狀況未知'
        },
        {
          name: '空腹胰島素',
          category: '胰島素檢測',
          value: 1.36,
          unit: 'µIU/mL',
          reference: '<5.0',
          status: 'normal',
          date: '2024/01/15',
          description: '空腹胰島素正常，藥物壓低-真實狀況未知'
        },
        {
          name: '空腹血糖',
          category: '血糖檢測',
          value: 80,
          unit: 'mg/dL',
          reference: '<90',
          status: 'normal',
          date: '2024/01/15',
          description: '空腹血糖正常'
        },
        {
          name: 'HOMA1-%β',
          category: '胰島素檢測',
          value: 87.2,
          unit: '%',
          reference: '>30',
          status: 'normal',
          date: '2024/01/15',
          description: 'β細胞功能正常'
        },
        {
          name: '三酸甘油酯',
          category: '血脂檢測',
          value: 58,
          unit: 'mg/dL',
          reference: '<100',
          status: 'normal',
          date: '2024/01/15',
          description: '三酸甘油酯正常'
        },
        {
          name: '同半胱胺酸',
          category: '心血管檢測',
          value: 14.8,
          unit: 'µmol/L',
          reference: '<8.0',
          status: 'high',
          date: '2024/01/15',
          description: '嚴重偏高(最大問題)，需要立即處理'
        },
        {
          name: 'Lp(a)',
          category: '心血管檢測',
          value: 24.7,
          unit: 'mg/dL',
          reference: '<30',
          status: 'normal',
          date: '2024/01/15',
          description: '脂蛋白(a)正常'
        },
        {
          name: 'ApoB',
          category: '心血管檢測',
          value: 69,
          unit: 'mg/dL',
          reference: '<80',
          status: 'normal',
          date: '2024/01/15',
          description: 'ApoB正常'
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
        },
        {
          name: '鎂',
          category: '礦物質檢測',
          value: 2.0,
          unit: 'mg/dL',
          reference: '2.0-2.4',
          status: 'normal',
          date: '2024/01/15',
          description: '鎂含量正常'
        },
        {
          name: '鋅',
          category: '礦物質檢測',
          value: 874,
          unit: 'µg/dL',
          reference: '700-1200',
          status: 'normal',
          date: '2024/01/15',
          description: '鋅含量正常'
        }
      ]
    }
  ])
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId)
      if (client) {
        setSelectedClient(client)
      }
    }
  }, [clientId, clients])
  
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
          <h1 className="text-2xl md:text-3xl font-light text-gray-900 mb-2">
            健康監控系統
          </h1>
          <p className="text-gray-600">
            即時監控學員健康數據，提供個人化健康管理方案
          </p>
        </div>
        
        {/* Client Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">選擇客戶</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedClient?.id === client.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedClient(client)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{client.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                    {client.status === 'normal' ? '正常' : '需要關注'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {client.age}歲 • {client.gender} • 最後更新：{client.lastUpdate}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Selected Client Details */}
        {selectedClient && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-gray-900">
                {selectedClient.name} 健康監控
              </h2>
              <button
                onClick={() => router.push(`/c/${selectedClient.id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看完整儀表板
              </button>
            </div>
            
            {/* Lab Results */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">檢測結果</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedClient.labResults.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{result.name}</h4>
                      <span className={`text-sm font-medium ${getLabStatusColor(result.status)}`}>
                        {result.status === 'normal' ? '正常' : result.status === 'low' ? '偏低' : '偏高'}
                      </span>
                    </div>
                    <div className="text-2xl font-light text-gray-900 mb-1">
                      {result.value} {result.unit}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      參考範圍：{result.reference}
                    </div>
                    <div className="text-sm text-gray-500">
                      {result.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Health Summary */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">健康總結</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">正常指標</h4>
                  <div className="space-y-1">
                    {selectedClient.labResults
                      .filter(r => r.status === 'normal')
                      .map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">✓</span>
                          <span>{result.name}: {result.value} {result.unit}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">需要關注</h4>
                  <div className="space-y-1">
                    {selectedClient.labResults
                      .filter(r => r.status !== 'normal')
                      .map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="text-yellow-600">!</span>
                          <span>{result.name}: {result.value} {result.unit}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">系統特色</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-medium text-gray-900 mb-2">即時監控</h3>
              <p className="text-sm text-gray-600">24/7 健康數據監控</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-medium text-gray-900 mb-2">趨勢分析</h3>
              <p className="text-sm text-gray-600">長期健康趨勢追蹤</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💊</div>
              <h3 className="font-medium text-gray-900 mb-2">補品管理</h3>
              <p className="text-sm text-gray-600">個人化補品方案</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔔</div>
              <h3 className="font-medium text-gray-900 mb-2">安全可靠</h3>
              <p className="text-sm text-gray-600">資料加密保護</p>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">使用說明</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">如何使用：</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>選擇要監控的客戶</li>
                <li>查看客戶的檢測結果和健康狀態</li>
                <li>點擊「查看完整儀表板」進入詳細管理</li>
                <li>💊 <strong>每日補品打卡</strong>：點擊補品按鈕記錄服用</li>
                <li>📊 <strong>檢測數據監控</strong>：查看實驗室檢測結果和健康狀態</li>
                <li>🔗 <strong>個人化網址</strong>：每個學員都有專屬監控網址</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HealthMonitoringPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HealthMonitoringContent />
    </Suspense>
  )
}
