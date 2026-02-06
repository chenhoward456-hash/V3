'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { calculateLabStatus } from '@/utils/labStatus'

interface Client {
  id: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
}

function MultiClientCleanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [clients] = useState<Client[]>([
    {
      id: 'chengjun',
      name: '承鈞',
      age: 25,
      gender: '女性',
      status: 'attention'
    },
    {
      id: 'test2',
      name: '測試客戶2',
      age: 30,
      gender: '男性',
      status: 'normal'
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
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-light text-gray-900">
            多客戶管理系統 - 簡潔版
          </h1>
          <p className="text-gray-600 mt-2">
            簡潔版的多客戶健康管理系統，專注於核心功能
          </p>
        </div>
        
        {/* Client Grid */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">客戶列表</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => router.push(`/c/${client.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{client.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                    {client.status === 'normal' ? '正常' : '需要關注'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {client.age}歲 • {client.gender}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">系統特色</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">👥</div>
              <h3 className="font-medium text-gray-900 mb-2">客戶管理</h3>
              <p className="text-sm text-gray-600">簡潔的客戶資料管理</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-medium text-gray-900 mb-2">健康監控</h3>
              <p className="text-sm text-gray-600">即時健康數據監控</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔧</div>
              <h3 className="font-medium text-gray-900 mb-2">簡潔設計</h3>
              <p className="text-sm text-gray-600">專注核心功能，操作簡單</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MultiClientCleanPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MultiClientCleanContent />
    </Suspense>
  )
}
