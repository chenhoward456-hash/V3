'use client'

import { useState } from 'react'

export default function DataSyncSettings() {
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [csvFiles, setCsvFiles] = useState({
    metrics: null as File | null,
    supplements: null as File | null,
    progress: null as File | null
  })

  const handleConnect = async () => {
    if (!spreadsheetId) {
      alert('請輸入 Google Sheets ID')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/sync-google-sheets?spreadsheetId=${spreadsheetId}`)
      const data = await response.json()
      
      if (data.error) {
        alert('連接失敗：' + data.error)
      } else {
        setIsConnected(true)
        setLastSync(new Date())
        alert('連接成功！數據已同步')
      }
    } catch (error) {
      alert('連接失敗：' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    if (!spreadsheetId) {
      alert('請先連接 Google Sheets')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/sync-google-sheets?spreadsheetId=${spreadsheetId}`)
      const data = await response.json()
      
      if (data.error) {
        alert('同步失敗：' + data.error)
      } else {
        setLastSync(new Date())
        alert('同步成功！')
      }
    } catch (error) {
      alert('同步失敗：' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCSVUpload = async () => {
    if (!csvFiles.metrics && !csvFiles.supplements && !csvFiles.progress) {
      alert('請至少選擇一個 CSV 檔案')
      return
    }

    setIsLoading(true)
    
    try {
      const formData = new FormData()
      
      if (csvFiles.metrics) formData.append('metrics', csvFiles.metrics)
      if (csvFiles.supplements) formData.append('supplements', csvFiles.supplements)
      if (csvFiles.progress) formData.append('progress', csvFiles.progress)

      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.error) {
        alert('上傳失敗：' + data.error)
      } else {
        setLastSync(new Date())
        alert('CSV 上傳成功！')
      }
    } catch (error) {
      alert('上傳失敗：' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (type: 'metrics' | 'supplements' | 'progress', file: File) => {
    setCsvFiles(prev => ({
      ...prev,
      [type]: file
    }))
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-light text-gray-900 mb-8">數據同步設定</h1>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-light text-gray-900 mb-4">Google Sheets 連接</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Sheets ID
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="請輸入 Google Sheets ID"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                從 Google Sheets URL 中複製 ID：https://docs.google.com/spreadsheets/d/[ID]/edit
              </p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? '連接中...' : '連接'}
              </button>
              
              {isConnected && (
                <button
                  onClick={handleSync}
                  disabled={isLoading}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
                >
                  {isLoading ? '同步中...' : '同步數據'}
                </button>
              )}
            </div>
            
            {isConnected && lastSync && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ 已連接 | 最後同步：{lastSync.toLocaleString('zh-TW')}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-light text-gray-900 mb-4">Google Sheets 格式要求</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📊 指標工作表</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">需要包含以下欄位：</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• 指標名稱 (如：同半胱胺酸)</li>
                  <li>• 現值 (如：12.5)</li>
                  <li>• 目標值 (如：8.0)</li>
                  <li>• 單位 (如：μmol/L)</li>
                  <li>• 描述 (如：心血管健康指標)</li>
                </ul>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">💊 補品工作表</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">需要包含以下欄位：</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• 補品名稱 (如：葉酸)</li>
                  <li>• 劑量 (如：800mcg)</li>
                  <li>• 服用時間 (如：早餐後)</li>
                  <li>• 等級 (如：1)</li>
                  <li>• 目的 (如：降低同半胱胺酸)</li>
                </ul>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📈 進度工作表</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">需要包含以下欄位：</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• 週次 (如：Week 1)</li>
                  <li>• 各指標的歷史數值</li>
                  <li>• 每週更新的進度數據</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
