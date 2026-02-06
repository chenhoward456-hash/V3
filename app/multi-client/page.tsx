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

function MultiClientContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client')
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showAddClient, setShowAddClient] = useState(false)
  const [clients, setClients] = useState<Client[]>([
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
  
  const [searchTerm, setSearchTerm] = useState('')
  
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId)
      if (client) {
        setSelectedClient(client)
      }
    }
  }, [clientId, clients])
  
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-light text-gray-900">
              多客戶健康管理系統
            </h1>
            <button
              onClick={() => setShowAddClient(!showAddClient)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddClient ? '取消' : '新增客戶'}
            </button>
          </div>
          
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="搜尋客戶..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedClient(client)}
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
              </div>
            ))}
          </div>
        </div>
        
        {/* Selected Client Details */}
        {selectedClient && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-gray-900">{selectedClient.name} 健康詳情</h2>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            {/* Supplements */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">補品清單</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedClient.supplements.map((supplement) => (
                  <div key={supplement.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{supplement.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{supplement.name}</h4>
                        <p className="text-sm text-gray-600">{supplement.dosage} • {supplement.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MultiClientPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MultiClientContent />
    </Suspense>
  )
}
