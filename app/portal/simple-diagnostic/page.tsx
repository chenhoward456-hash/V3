'use client'

export default function SimpleDiagnostic() {
  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <h1 className="text-2xl font-light text-gray-900 mb-8">簡單診斷</h1>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">系統檢查</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-700">React 正常載入</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Next.js 正常載入</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-700">瀏覽器支援 JavaScript</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-700">DOM 正常載入</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">測試頁面</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. 基本渲染</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p>✅ 你可以看到這段文字，表示基本渲染正常</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. 樣式載入</h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p>✅ 你可以看到藍色背景，表示樣式正常載入</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. 互動功能</h3>
            <button 
              onClick={() => alert('按鈕點擊測試成功！')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              點擊測試
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-light text-gray-900 mb-4">問題診斷</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">如果看到程式碼</h3>
            <p className="text-sm text-gray-600">
              可能是 JavaScript 錯誤導致頁面無法正常渲染
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">如果看到空白頁面</h3>
            <p className="text-sm text-gray-600">
              可能是組件導入錯誤或路由問題
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">如果看到錯誤訊息</h3>
            <p className="text-sm text-gray-600">
              請複製完整的錯誤訊息給我
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-light text-gray-900 mb-4">快速修復</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. 重新整理</h3>
            <p className="text-sm text-gray-600">按 Ctrl+Shift+R 或 Cmd+Shift+R</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. 清除快取</h3>
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
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-light text-gray-900 mb-4">聯絡我</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            如果問題持續存在，請告訴我：
          </p>
          
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-2">
            <li>具體看到什麼（程式碼、空白、錯誤訊息）</li>
            <li>瀏覽器控制台的錯誤訊息</li>
            <li>嘗試過哪些修復方法</li>
            <li>開發服務器的狀態</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
