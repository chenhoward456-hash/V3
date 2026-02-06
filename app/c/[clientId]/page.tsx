'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import SupplementChecklist from './components/SupplementChecklist'
import LabResultTrendChart from './components/LabResultTrendChart'
import BodyCompositionTracker from './components/BodyCompositionTracker'
import SupplementManager from './components/SupplementManager'
import LabResultEditor from './components/LabResultEditor'
import { calculateLabStatus } from '@/utils/labStatus'
import { useClientData } from '@/hooks/useClientData'

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
  
  const [showSupplementManager, setShowSupplementManager] = useState(false)
  const [showLabEditor, setShowLabEditor] = useState(false)
  
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
  
  // 計算趨勢資料
  const trendData = useMemo(() => {
    if (!clientData?.client?.lab_results) return {}
    
    const trends: Record<string, any[]> = {}
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
    return trends
  }, [clientData?.client?.lab_results])
  
  // 處理補品更新
  const handleSupplementUpdate = useCallback((updatedSupplements: any[]) => {
    mutate()
  }, [mutate])
  
  // 處理血檢結果更新
  const handleLabResultUpdate = useCallback((updatedResults: any[]) => {
    mutate()
  }, [mutate])
  
  // 處理趨勢數據
  const getTestTrend = useCallback((testName: string) => {
    if (!trendData[testName]) return []
    return trendData[testName]
  }, [trendData])
  
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
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-light text-gray-900">
              {client.name} 健康儀表板
            </h1>
            <p className="text-gray-600 mt-1">
              {client.age}歲 • {client.gender} • {new Date().toLocaleDateString('zh-TW')}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            client.status === 'normal' 
              ? 'bg-green-100 text-green-800'
              : client.status === 'attention'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {client.status === 'normal' ? '正常' : '需要關注'}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="space-y-6">
        {/* 補品管理 - 教練專用 */}
        {showSupplementManager && (
          <SupplementManager
            clientId={client.id}
            initialSupplements={client.supplements}
            onUpdate={handleSupplementUpdate}
          />
        )}
        
        {/* 補品打卡 - 最常用，放最上面 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">📅 今日補品 {new Date().toLocaleDateString('zh-TW')}</h2>
            <button
              onClick={() => setShowSupplementManager(!showSupplementManager)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              {showSupplementManager ? '隱藏管理' : '管理補品'}
            </button>
          </div>
          <SupplementChecklist
            clientId={client.id}
            supplements={client.supplements}
            initialLogs={clientData.todayLogs || []}
          />
        </div>
        
        {/* 身體數據記錄 - 教練常用，放中間 */}
        <BodyCompositionTracker
          clientId={client.id}
          initialData={clientData.bodyData || []}
        />
        
        {/* 血檢趨勢圖 - 長期追蹤，放下面 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">📈 血檢趨勢圖</h2>
            <button
              onClick={() => setShowLabEditor(!showLabEditor)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              {showLabEditor ? '隱藏編輯' : '編輯數值'}
            </button>
          </div>
          
          {/* 血檢編輯器 */}
          {showLabEditor && (
            <div className="mb-6">
              <LabResultEditor
                clientId={client.id}
                labResults={client.lab_results}
                onUpdate={handleLabResultUpdate}
              />
            </div>
          )}
          
          {/* 趨勢圖 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* HOMA-IR 趨勢 */}
            <LabResultTrendChart
              testName="HOMA-IR"
              unit=""
              data={getTestTrend('HOMA-IR')}
              referenceRange="<1.4"
              targetValue={1.4}
            />
            
            {/* 同半胱胺酸趨勢 */}
            <LabResultTrendChart
              testName="同半胱胺酸"
              unit="μmol/L"
              data={getTestTrend('同半胱胺酸')}
              referenceRange="<8.0"
              targetValue={8.0}
            />
            
            {/* 維生素D 趨勢 */}
            <LabResultTrendChart
              testName="維生素D"
              unit="ng/mL"
              data={getTestTrend('維生素D')}
              referenceRange=">50"
              targetValue={50}
            />
            
            {/* 鐵蛋白趨勢 */}
            <LabResultTrendChart
              testName="鐵蛋白"
              unit="ng/mL"
              data={getTestTrend('鐵蛋白')}
              referenceRange="50-150"
              targetValue={100}
            />
          </div>
        </div>
        
        {/* 原有的血檢數據列表 - 最下面 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">🔬 血檢數據詳情</h2>
          <div className="space-y-4">
            {client.lab_results.map((result: any) => (
              <div
                key={result.id}
                className={`border-l-4 p-4 rounded-lg ${
                  result.status === 'normal'
                    ? 'border-l-green-500 bg-green-50'
                    : result.status === 'attention'
                    ? 'border-l-yellow-500 bg-yellow-50'
                    : 'border-l-red-500 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{result.test_name}</h3>
                    <p className="text-sm text-gray-600">
                      參考範圍: {result.reference_range} {result.unit}
                    </p>
                    <p className="text-xs text-gray-500">
                      檢測日期: {new Date(result.date).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-light text-gray-900">
                      {result.value}
                    </div>
                    <div className="text-sm text-gray-600">{result.unit}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>健康管理系統 • Howard 教練 • 預防醫學 3.0</p>
        <p className="mt-1">此資料僅供健康管理參考，不具醫療建議性質</p>
      </div>
    </div>
  )
}
