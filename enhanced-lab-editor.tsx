// 增強的血檢數據編輯組件
function EnhancedLabResultEditor({ result, index, onChange }: {
  result: any
  index: number
  onChange: (index: number, field: string, value: any) => void
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'attention': return 'bg-yellow-100 text-yellow-800'
      case 'alert': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return '🟢'
      case 'attention': return '🟡'
      case 'alert': return '🔴'
      default: return '⚪'
    }
  }
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常'
      case 'attention': return '注意'
      case 'alert': return '警示'
      default: return '未知'
    }
  }
  
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 檢測項目 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">檢測項目</label>
          <input
            type="text"
            value={result.test_name}
            onChange={(e) => onChange(index, 'test_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* 數值 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">數值</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={result.value}
              onChange={(e) => onChange(index, 'value', Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">{result.unit}</span>
          </div>
        </div>
        
        {/* 參考範圍 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">參考範圍</label>
          <input
            type="text"
            value={result.reference_range}
            onChange={(e) => onChange(index, 'reference_range', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* 狀態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
          <div className="flex items-center gap-2">
            <select
              value={result.status}
              onChange={(e) => onChange(index, 'status', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="normal">正常</option>
              <option value="attention">注意</option>
              <option value="alert">警示</option>
            </select>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
              {getStatusIcon(result.status)} {getStatusText(result.status)}
            </span>
          </div>
        </div>
      </div>
      
      {/* 檢測日期 */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">檢測日期</label>
        <input
          type="date"
          value={result.date}
          onChange={(e) => onChange(index, 'date', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* 快速操作 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            // 快速設定為正常範圍內
            const normalValues: Record<string, number> = {
              '同半胱胺酸': 7.0,
              '維生素D': 60,
              'HOMA-IR': 1.0,
              '空腹胰島素': 4.0,
              '空腹血糖': 85
            }
            const newValue = normalValues[result.test_name]
            if (newValue) {
              onChange(index, 'value', newValue)
            }
          }}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          設為正常值
        </button>
        <button
          onClick={() => {
            // 複製到其他學員
            console.log('複製到其他學員功能')
          }}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          複製到其他學員
        </button>
      </div>
    </div>
  )
}
