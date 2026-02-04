'use client'

import { useState } from 'react'

export default function CSVImportPage() {
  const [csvFiles, setCsvFiles] = useState({
    metrics: null as File | null,
    supplements: null as File | null,
    progress: null as File | null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)

  const handleFileChange = (type: 'metrics' | 'supplements' | 'progress', file: File) => {
    setCsvFiles(prev => ({
      ...prev,
      [type]: file
    }))
  }

  const handleUpload = async () => {
    if (!csvFiles.metrics && !csvFiles.supplements && !csvFiles.progress) {
      alert('請至少選擇一個 CSV 檔案')
      return
    }

    setIsLoading(true)
    setUploadResult(null)
    
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
        setUploadResult(data)
        
        // 保存到 localStorage
        if (data.metrics) {
          localStorage.setItem('cj-beauty-metrics', JSON.stringify(data.metrics))
        }
        if (data.supplements) {
          localStorage.setItem('cj-beauty-supplements', JSON.stringify(data.supplements))
        }
        
        alert('CSV 上傳成功！')
      }
    } catch (error) {
      alert('上傳失敗：' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadTemplate = (type: 'metrics' | 'supplements' | 'progress') => {
    let content = ''
    
    if (type === 'metrics') {
      content = '指標名稱,現值,目標值,單位,描述\n同半胱胺酸,12.5,8.0,μmol/L,心血管健康指標\n鐵蛋白,45,50,ng/mL,鐵質儲存指標\n體脂肪率,28.5,25.0,%,身體組成指標'
    } else if (type === 'supplements') {
      content = '補品名稱,劑量,服用時間,等級,目的\n葉酸,800mcg,早餐後,1,降低同半胱胺酸\n維生素B12,1000mcg,早餐後,1,降低同半胱胺酸\n鐵質,30mg,午餐後,1,提升鐵蛋白'
    } else if (type === 'progress') {
      content = '週次,同半胱胺酸,鐵蛋白,體脂肪率,維生素D,Omega3,C-反應蛋白\nWeek 1,15.2,38,30.2,28,5.5,4.2\nWeek 2,14.8,42,29.5,32,6.0,3.8\nWeek 3,14.2,44,29.0,34,6.3,3.5'
    }
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${type}_template.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-light text-gray-900 mb-8">CSV 數據導入</h1>
        
        {/* 檔案上傳 */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-light text-gray-900 mb-4">上傳 CSV 檔案</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* 指標檔案 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 指標數據
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileChange('metrics', file)
              }}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => downloadTemplate('metrics')}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                下載範本
              </button>
              {csvFiles.metrics && (
                <p className="mt-2 text-xs text-green-600">✅ 已選擇: {csvFiles.metrics.name}</p>
              )}
            </div>
            
            {/* 補品檔案 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💊 補品數據
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileChange('supplements', file)
              }}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => downloadTemplate('supplements')}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                下載範本
              </button>
              {csvFiles.supplements && (
                <p className="mt-2 text-xs text-green-600">✅ 已選擇: {csvFiles.supplements.name}</p>
              )}
            </div>
            
            {/* 進度檔案 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📈 進度數據
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileChange('progress', file)
              }}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => downloadTemplate('progress')}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                下載範本
              </button>
              {csvFiles.progress && (
                <p className="mt-2 text-xs text-green-600">✅ 已選擇: {csvFiles.progress.name}</p>
              )}
            </div>
          </div>
          
          <button
            onClick={handleUpload}
            disabled={isLoading}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? '上傳中...' : '上傳 CSV'}
          </button>
        </div>
        
        {/* 上傳結果 */}
        {uploadResult && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-light text-gray-900 mb-4">上傳結果</h2>
            
            <div className="space-y-4">
              {uploadResult.metrics && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">📊 指標數據</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      成功導入 {uploadResult.metrics.length} 個指標
                    </p>
                    <div className="mt-2 text-xs text-gray-500">
                      {uploadResult.metrics.map((metric: any, index: number) => (
                        <div key={index}>
                          {metric.name}: {metric.current}/{metric.target} {metric.unit}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {uploadResult.supplements && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">💊 補品數據</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      成功導入 {uploadResult.supplements.length} 個補品
                    </p>
                    <div className="mt-2 text-xs text-gray-500">
                      {uploadResult.supplements.map((supplement: any, index: number) => (
                        <div key={index}>
                          {supplement.name}: {supplement.dosage} - {supplement.timing}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {uploadResult.progress && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">📈 進度數據</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      成功導入 {uploadResult.progress.length} 週的進度數據
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <a
                href="/portal/cj-beauty"
                className="bg-green-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-600 inline-block"
              >
                查看儀表板
              </a>
            </div>
          </div>
        )}
        
        {/* 格式說明 */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-light text-gray-900 mb-4">CSV 格式說明</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📊 指標數據格式</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">必須包含以下欄位：</p>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                  指標名稱,現值,目標值,單位,描述
                </code>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">💊 補品數據格式</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">必須包含以下欄位：</p>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                  補品名稱,劑量,服用時間,等級,目的
                </code>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📈 進度數據格式</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">必須包含以下欄位：</p>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                  週次,指標1,指標2,指標3,...
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
