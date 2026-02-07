'use client'

import { useState } from 'react'
import { calculateLabStatus } from '@/utils/labStatus'

interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
}

interface LabResultEditorProps {
  clientId: string
  labResults: LabResult[]
  onUpdate: (updatedResults: LabResult[]) => void
}

export default function LabResultEditor({ 
  clientId, 
  labResults, 
  onUpdate 
}: LabResultEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [newResult, setNewResult] = useState<Partial<LabResult>>({
    test_name: '',
    value: 0,
    unit: '',
    reference_range: '',
    date: new Date().toISOString().split('T')[0]
  })

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

  const handleUpdate = async (id: string, field: string, value: any) => {
    setLoading(true)
    try {
      const updatedResult = labResults.find(r => r.id === id)
      if (!updatedResult) return

      const updates: any = { [field]: value }
      
      // 如果更新的是數值，自動計算狀態
      if (field === 'value') {
        updates.status = calculateLabStatus(updatedResult.test_name, Number(value))
      }

      const response = await fetch('/api/lab-results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })

      if (!response.ok) {
        throw new Error('更新失敗')
      }

      const data = await response.json()
      const updatedResults = labResults.map(result => 
        result.id === id ? data.data : result
      )
      onUpdate(updatedResults)
    } catch (error) {
      console.error('更新失敗:', error)
      alert('更新失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newResult.test_name || !newResult.value) {
      alert('請填寫檢測項目和數值')
      return
    }

    setLoading(true)
    try {
      const status = calculateLabStatus(newResult.test_name!, Number(newResult.value))
      
      const response = await fetch('/api/lab-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          test_name: newResult.test_name,
          value: Number(newResult.value),
          unit: newResult.unit || '',
          reference_range: newResult.reference_range || '',
          status,
          date: newResult.date
        })
      })

      if (!response.ok) {
        throw new Error('新增失敗')
      }

      const data = await response.json()
      const updatedResults = [...labResults, data.data]
      onUpdate(updatedResults)
      
      setNewResult({
        test_name: '',
        value: 0,
        unit: '',
        reference_range: '',
        date: new Date().toISOString().split('T')[0]
      })
    } catch (error) {
      console.error('新增失敗:', error)
      alert('新增失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個檢測結果嗎？')) return

    setLoading(true)
    try {
      const response = await fetch('/api/lab-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!response.ok) {
        throw new Error('刪除失敗')
      }

      const updatedResults = labResults.filter(result => result.id !== id)
      onUpdate(updatedResults)
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 常見檢測項目模板
  const commonTests = [
    { name: 'HOMA-IR', unit: '', reference: '<1.4' },
    { name: '同半胱胺酸', unit: 'μmol/L', reference: '<8.0' },
    { name: '空腹胰島素', unit: 'μIU/mL', reference: '<5.0' },
    { name: '空腹血糖', unit: 'mg/dL', reference: '<90' },
    { name: '維生素D', unit: 'ng/mL', reference: '>50' },
    { name: '鐵蛋白', unit: 'ng/mL', reference: '50-150' },
    { name: '三酸甘油酯', unit: 'mg/dL', reference: '<100' },
    { name: 'Lp(a)', unit: 'mg/dL', reference: '<30' },
    { name: 'ApoB', unit: 'mg/dL', reference: '<80' },
    { name: '鎂', unit: 'mg/dL', reference: '2.0-2.4' },
    { name: '鋅', unit: 'μg/dL', reference: '700-1200' }
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-gray-900 mb-2">🔬 血檢數據編輯</h2>
        <p className="text-sm text-gray-600">
          直接修改血檢數值，圖表會立即更新顯示
        </p>
      </div>

      {/* 現有血檢數據 */}
      <div className="space-y-4 mb-6">
        {labResults.map(result => (
          <div key={result.id} className="border border-gray-200 rounded-lg p-4">
            {editingId === result.id ? (
              // 編輯模式
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={result.test_name}
                    onChange={(e) => handleUpdate(result.id, 'test_name', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="檢測項目"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={result.value}
                      onChange={(e) => handleUpdate(result.id, 'value', Number(e.target.value))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="數值"
                    />
                    <input
                      type="text"
                      value={result.unit}
                      onChange={(e) => handleUpdate(result.id, 'unit', e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="單位"
                    />
                  </div>
                  <input
                    type="text"
                    value={result.reference_range}
                    onChange={(e) => handleUpdate(result.id, 'reference_range', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="參考範圍"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={result.date}
                    onChange={(e) => handleUpdate(result.id, 'date', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)} {result.status === 'normal' ? '正常' : result.status === 'attention' ? '注意' : '警示'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              // 顯示模式
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">{result.test_name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                      {getStatusIcon(result.status)} {result.status === 'normal' ? '正常' : result.status === 'attention' ? '注意' : '警示'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span className="font-medium text-lg">{result.value} {result.unit}</span>
                    <span>參考: {result.reference_range}</span>
                    <span>{new Date(result.date).toLocaleDateString('zh-TW')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(result.id)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(result.id)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 新增血檢數據 */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">新增血檢數據</h3>
        
        {/* 快速模板 */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">快速選擇常見檢測項目：</p>
          <div className="flex flex-wrap gap-2">
            {commonTests.map((test, index) => (
              <button
                key={index}
                onClick={() => setNewResult({
                  test_name: test.name,
                  value: 0,
                  unit: test.unit,
                  reference_range: test.reference,
                  date: new Date().toISOString().split('T')[0]
                })}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
              >
                {test.name}
              </button>
            ))}
          </div>
        </div>

        {/* 新增表單 */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newResult.test_name}
              onChange={(e) => setNewResult(prev => ({ ...prev, test_name: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="檢測項目"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={newResult.value}
                onChange={(e) => setNewResult(prev => ({ ...prev, value: Number(e.target.value) }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="數值"
              />
              <input
                type="text"
                value={newResult.unit}
                onChange={(e) => setNewResult(prev => ({ ...prev, unit: e.target.value }))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="單位"
              />
            </div>
            <input
              type="text"
              value={newResult.reference_range}
              onChange={(e) => setNewResult(prev => ({ ...prev, reference_range: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="參考範圍"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={newResult.date}
              onChange={(e) => setNewResult(prev => ({ ...prev, date: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? '新增中...' : '新增'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
