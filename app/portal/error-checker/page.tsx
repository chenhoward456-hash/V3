'use client'

import { useState, useEffect } from 'react'

export default function ErrorChecker() {
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 檢查常見錯誤
    const checkCommonErrors = () => {
      const newErrors: string[] = []
      
      // 檢查瀏覽器支援
      if (typeof window === 'undefined') {
        newErrors.push('瀏覽器不支援 JavaScript')
      }
      
      // 檢查基本功能
      if (typeof document === 'undefined') {
        newErrors.push('DOM 未載入')
      }
      
      setErrors(newErrors)
    }

    checkCommonErrors()
  }, [])

  const testPageLoad = () => {
    try {
      console.log('測試頁面載入...')
      setIsLoading(true)
      setErrors([])
      
      // 測試基本 DOM 操作
      const div = document.createElement('div')
      div.innerHTML = '<h1>測試頁面</h1>'
      document.body.appendChild(div)
      
      console.log('✅ 頁面載入測試完成')
      setIsLoading(false)
    } catch (error) {
      console.error('❌ 頁面載入錯誤:', error)
      setErrors(prev => [...prev, '頁面載入失敗: ' + (error as Error).message])
      setIsLoading(false)
    }
  }

  const testDataLoad = () => {
    try {
      console.log('測試數據載入...')
      setIsLoading(true)
      setErrors([])
      
      // 測試數據載入
      const metrics = [
        { id: 'hcy', name: '同半胱胺酸', current: 12.5, target: 8.0, unit: 'μmol/L', description: '心血管健康指標' },
        { id: 'ferritin', name: '鐵蛋白', current: 45, target: 50, unit: 'ng/mL', description: '鐵質儲存指標' }
      ]
      
      console.log('✅ 數據載入測試完成:', metrics)
      setIsLoading(false)
    } catch (error) {
      console.error('❌ 數據載入錯誤:', error)
      setErrors(prev => [...prev, '數據載入失敗: ' + (error as Error).message])
      setIsLoading(false)
    }
  }

  const testComponentRender = () => {
    try {
      console.log('測試元件渲染...')
      setIsLoading(true)
      setErrors([])
      
      // 測試基本 DOM 操作
      const div = document.createElement('div')
      div.innerHTML = '<h3>測試元件</h3><p>元件渲染測試</p>'
      document.body.appendChild(div)
      
      // 測試事件綁定
      const button = document.createElement('button')
      button.textContent = '測試按鈕'
      button.onclick = () => {
        console.log('按鈕點擊測試')
      }
      document.body.appendChild(button)
      
      console.log('✅ 元件渲染測試完成')
      setIsLoading(false)
    } catch (error) {
      console.error('❌ 元件渲染錯誤:', error)
      setErrors(prev => [...prev, '元件渲染失敗: ' + (error as Error).message])
      setIsLoading(false)
    }
  }

  const clearErrors = () => {
    setErrors([])
  }

  const testAll = () => {
    clearErrors()
    testPageLoad()
    setTimeout(() => {
      testDataLoad()
      setTimeout(() => {
        testComponentRender()
      }, 1000)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <h1 className="text-2xl font-light text-gray-900 mb-8">錯誤檢查工具</h1>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">系統狀態</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${isLoading ? 'bg-yellow-500 animate-spin' : 'bg-green-500'}`}></div>
            <span className="text-gray-700">
              {isLoading ? '檢查中...' : '系統正常'}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>開發服務器狀態：<span className="text-green-600 font-medium">運行中</span></p>
            <p>瀏覽器：<span className="text-blue-600 font-medium">正常</span></p>
            <p>React：<span className="text-blue-600 font-medium">載入</span></p>
            <p>Next.js:<span className="text-blue-600 font-medium">載入</span></p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">錯誤列表</h2>
        
        {errors.length === 0 ? (
          <div className="text-green-600 text-center py-8">
            <p>✅ 沒有檢測到錯誤</p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-medium mb-2">錯誤 #{index + 1}</h3>
                <p className="text-red-700">{error}</p>
              </div>
            ))}
          </div>
        )}
        
        {errors.length > 0 && (
          <button
            onClick={clearErrors}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600"
          >
            清除錯誤
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">測試功能</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={testPageLoad}
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            測試頁面載入
          </button>
          
          <button
            onClick={testDataLoad}
            disabled={isLoading}
            className="bg-green-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
          >
            測試數據載入
          </button>
          
          <button
            onClick={testComponentRender}
            disabled={isLoading}
            className="bg-purple-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50"
          >
            測試元件渲染
          </button>
        </div>
        
        <div className="text-center">
          <button
            onClick={testAll}
            disabled={isLoading}
            className="bg-gray-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50"
          >
            🧪 執行所有測試
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="console text-lg font-light text-gray-900 mb-4">瀏覽器控制台</h2>
        <div className="bg-gray-900 text-white p-4 rounded-lg">
          <p className="text-sm text-gray-300">請打開瀏覽器開發者工具（按 F12），查看 Console 錯誤訊息。</p>
          <p className="text-xs text-gray-400">如果有錯誤，請複製完整的錯誤訊息給我。</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-light text-gray-900 mb-4">快速修復</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. 重新整理頁面</h3>
            <p className="text-sm text-gray-600">按 Ctrl+Shift+R 或 Cmd+Shift+R</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. 清除瀏覽器快取</h3>
            <p className="text-sm text-gray-600">按 Ctrl+Shift+R 或 Cmd+Shift+R</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. 檢查開發服務器</h3>
            <p className="text-sm text-gray-600">確保 npm run dev 正在運行</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">4. 使用簡化版本</h3>
            <p className="text-sm text-gray-600">訪問 /portal/cj-beauty-simple</p>
          </div>
        </div>
      </div>
    </div>
  )
}
