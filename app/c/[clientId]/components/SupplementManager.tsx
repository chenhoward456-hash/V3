'use client'

import { useState, useEffect } from 'react'

interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface SupplementManagerProps {
  clientId: string
  initialSupplements: Supplement[]
  onUpdate: (supplements: Supplement[]) => void
}

export default function SupplementManager({ 
  clientId, 
  initialSupplements, 
  onUpdate 
}: SupplementManagerProps) {
  const [supplements, setSupplements] = useState<Supplement[]>(initialSupplements)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newSupplement, setNewSupplement] = useState<Partial<Supplement>>({
    name: '',
    dosage: '',
    timing: '早餐',
    why: ''
  })
  const [loading, setLoading] = useState(false)

  // 常見補品模板
  const supplementTemplates = [
    { name: 'B群', dosage: '800mcg+1000mcg', timing: '早餐', why: '降同半胱胺酸' },
    { name: 'D3+K2', dosage: '5000IU+200mcg', timing: '早餐', why: '補維D' },
    { name: '鐵劑', dosage: '25mg', timing: '早餐', why: '補Ferritin' },
    { name: '肌醇', dosage: '2g', timing: '早餐', why: '改善胰島素敏感度' },
    { name: '鉻', dosage: '600mcg', timing: '午餐前', why: '保護β細胞' },
    { name: '魚油', dosage: '2g', timing: '晚餐', why: '抗發炎+心血管保護' },
    { name: '甘胺酸鎂', dosage: '400mg', timing: '睡前', why: '睡眠+降同半胱胺酸' },
    { name: '維生素C', dosage: '1000mg', timing: '早餐', why: '補鐵吸收' },
    { name: '輔酶Q10', dosage: '100mg', timing: '午餐', why: '抗氧化' },
    { name: '鋅', dosage: '15mg', timing: '晚餐', why: '免疫力' }
  ]

  const handleAdd = async () => {
    if (!newSupplement.name || !newSupplement.dosage) {
      alert('請填寫補品名稱和劑量')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          name: newSupplement.name,
          dosage: newSupplement.dosage,
          timing: newSupplement.timing || '早餐',
          why: newSupplement.why
        })
      })

      if (!response.ok) {
        throw new Error('新增失敗')
      }

      const data = await response.json()
      const updatedSupplements = [...supplements, data.data]
      setSupplements(updatedSupplements)
      onUpdate(updatedSupplements)
      
      setNewSupplement({ name: '', dosage: '', timing: '早餐', why: '' })
      setIsAdding(false)
    } catch (error) {
      console.error('新增補品失敗:', error)
      alert('新增失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<Supplement>) => {
    setLoading(true)
    try {
      const response = await fetch('/api/supplements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...updates
        })
      })

      if (!response.ok) {
        throw new Error('更新失敗')
      }

      const data = await response.json()
      const updatedSupplements = supplements.map(sup => 
        sup.id === id ? data.data : sup
      )
      setSupplements(updatedSupplements)
      onUpdate(updatedSupplements)
      setEditingId(null)
    } catch (error) {
      console.error('更新補品失敗:', error)
      alert('更新失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個補品嗎？')) return

    setLoading(true)
    try {
      const response = await fetch('/api/supplements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!response.ok) {
        throw new Error('刪除失敗')
      }

      const updatedSupplements = supplements.filter(supplement => supplement.id !== id)
      setSupplements(updatedSupplements)
      onUpdate(updatedSupplements)
    } catch (error) {
      console.error('刪除補品失敗:', error)
      alert('刪除失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const useTemplate = (template: typeof supplementTemplates[0]) => {
    setNewSupplement(template)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-gray-900 mb-2">💊 補品管理</h2>
        <p className="text-sm text-gray-600">
          管理學員的補品清單，新增、編輯或刪除補品項目
        </p>
      </div>

      {/* 補品列表 */}
      <div className="space-y-4 mb-6">
        {supplements.map(supplement => (
          <div key={supplement.id} className="border border-gray-200 rounded-lg p-4">
            {editingId === supplement.id ? (
              // 編輯模式
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={supplement.name}
                    onChange={(e) => handleUpdate(supplement.id, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="補品名稱"
                  />
                  <input
                    type="text"
                    value={supplement.dosage}
                    onChange={(e) => handleUpdate(supplement.id, { dosage: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="劑量"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={supplement.timing}
                    onChange={(e) => handleUpdate(supplement.id, { timing: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="早餐">早餐</option>
                    <option value="午餐前">午餐前</option>
                    <option value="午餐">午餐</option>
                    <option value="訓練後">訓練後</option>
                    <option value="晚餐">晚餐</option>
                    <option value="睡前">睡前</option>
                  </select>
                  <input
                    type="text"
                    value={supplement.why || ''}
                    onChange={(e) => handleUpdate(supplement.id, { why: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="目的說明"
                  />
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
                  <h4 className="font-medium text-gray-900">{supplement.name}</h4>
                  <p className="text-sm text-gray-600">
                    {supplement.dosage} • {supplement.timing}
                    {supplement.why && ` • ${supplement.why}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(supplement.id)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(supplement.id)}
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

      {/* 新增補品 */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 新增補品
        </button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-4">新增補品</h3>
          
          {/* 快速模板 */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">快速選擇常見補品：</p>
            <div className="flex flex-wrap gap-2">
              {supplementTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => useTemplate(template)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* 新增表單 */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={newSupplement.name}
                onChange={(e) => setNewSupplement(prev => ({ ...prev, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="補品名稱"
              />
              <input
                type="text"
                value={newSupplement.dosage}
                onChange={(e) => setNewSupplement(prev => ({ ...prev, dosage: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="劑量"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={newSupplement.timing}
                onChange={(e) => setNewSupplement(prev => ({ ...prev, timing: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="早餐">早餐</option>
                <option value="午餐前">午餐前</option>
                <option value="午餐">午餐</option>
                <option value="訓練後">訓練後</option>
                <option value="晚餐">晚餐</option>
                <option value="睡前">睡前</option>
              </select>
              <input
                type="text"
                value={newSupplement.why}
                onChange={(e) => setNewSupplement(prev => ({ ...prev, why: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="目的說明"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? '新增中...' : '新增'}
              </button>
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewSupplement({ name: '', dosage: '', timing: '早餐', why: '' })
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
