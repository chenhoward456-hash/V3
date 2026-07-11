'use client'

import React, { useState, useMemo } from 'react'
import { Edit3, Save, X, Download, Upload, Trash2, CheckSquare, Square } from 'lucide-react'

interface BatchEditProps {
  data: any[]
  onSave: (updatedData: any[]) => void
  type: 'bodyData' | 'labResults'
}

const BatchEdit = ({ data, onSave, type }: BatchEditProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [editedData, setEditedData] = useState<any[]>([])

  // 初始化編輯數據
  React.useEffect(() => {
    if (isEditing) {
      setEditedData([...data])
    }
  }, [isEditing, data])

  // 切換選擇狀態
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (selectedItems.size === editedData.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(editedData.map(item => item.id)))
    }
  }

  // 更新編輯數據
  const updateEditedItem = (id: string, field: string, value: string) => {
    setEditedData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // 批量刪除
  const handleBatchDelete = () => {
    if (selectedItems.size === 0) return
    
    const filteredData = editedData.filter(item => !selectedItems.has(item.id))
    setEditedData(filteredData)
    setSelectedItems(new Set())
  }

  // 保存更改
  const handleSave = () => {
    onSave(editedData)
    setIsEditing(false)
    setSelectedItems(new Set())
  }

  // 取消編輯
  const handleCancel = () => {
    setIsEditing(false)
    setSelectedItems(new Set())
    setEditedData([])
  }

  // 導出數據
  const handleExport = () => {
    const csv = convertToCSV(editedData)
    downloadCSV(csv, `${type}_data.csv`)
  }

  // 轉換為 CSV
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return ''

    const headers = type === 'bodyData' 
      ? ['日期', '體重', '體脂率', '肌肉量', '身高', '內臟脂肪']
      : ['日期', '檢測項目', '數值', '單位', '參考範圍', '狀態']

    const rows = data.map(item => {
      if (type === 'bodyData') {
        return [
          item.date,
          item.weight || '',
          item.body_fat || '',
          item.muscle_mass || '',
          item.height || '',
          item.visceral_fat || ''
        ]
      } else {
        return [
          item.date,
          item.test_name,
          item.value,
          item.unit,
          item.reference_range,
          item.status
        ]
      }
    })

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  // 下載 CSV
  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isEditing) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">📝 批量編輯</h2>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit3 size={16} className="mr-2" />
            開始編輯
          </button>
        </div>
        
        <div className="text-center text-gray-500 py-8">
          <Edit3 size={48} className="mx-auto mb-4 text-gray-300" />
          <p>點擊「開始編輯」進入批量編輯模式</p>
          <p className="text-sm mt-2">可以批量修改、刪除、導出數據</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">📝 批量編輯</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={16} className="mr-1" />
            導出
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={selectedItems.size === 0}
            className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} className="mr-1" />
            刪除 ({selectedItems.size})
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={16} className="mr-1" />
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Save size={16} className="mr-1" />
            保存
          </button>
        </div>
      </div>

      {/* 全選控制 */}
      <div className="flex items-center mb-4 pb-4 border-b">
        <button
          onClick={toggleSelectAll}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          {selectedItems.size === editedData.length ? (
            <CheckSquare size={20} className="mr-2" />
          ) : (
            <Square size={20} className="mr-2" />
          )}
          全選 ({selectedItems.size}/{editedData.length})
        </button>
      </div>

      {/* 編輯表格 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2">選擇</th>
              {type === 'bodyData' ? (
                <>
                  <th className="text-left py-2 px-2">日期</th>
                  <th className="text-left py-2 px-2">體重</th>
                  <th className="text-left py-2 px-2">體脂率</th>
                  <th className="text-left py-2 px-2">肌肉量</th>
                  <th className="text-left py-2 px-2">身高</th>
                  <th className="text-left py-2 px-2">內臟脂肪</th>
                </>
              ) : (
                <>
                  <th className="text-left py-2 px-2">日期</th>
                  <th className="text-left py-2 px-2">檢測項目</th>
                  <th className="text-left py-2 px-2">數值</th>
                  <th className="text-left py-2 px-2">單位</th>
                  <th className="text-left py-2 px-2">參考範圍</th>
                  <th className="text-left py-2 px-2">狀態</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {editedData.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-2">
                  <button
                    onClick={() => toggleSelection(item.id)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </td>
                
                {type === 'bodyData' ? (
                  <>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateEditedItem(item.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.weight || ''}
                        onChange={(e) => updateEditedItem(item.id, 'weight', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="kg"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.body_fat || ''}
                        onChange={(e) => updateEditedItem(item.id, 'body_fat', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="%"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.muscle_mass || ''}
                        onChange={(e) => updateEditedItem(item.id, 'muscle_mass', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="kg"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.height || ''}
                        onChange={(e) => updateEditedItem(item.id, 'height', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="cm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.visceral_fat || ''}
                        onChange={(e) => updateEditedItem(item.id, 'visceral_fat', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateEditedItem(item.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.test_name}
                        onChange={(e) => updateEditedItem(item.id, 'test_name', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.value}
                        onChange={(e) => updateEditedItem(item.id, 'value', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateEditedItem(item.id, 'unit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.reference_range}
                        onChange={(e) => updateEditedItem(item.id, 'reference_range', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.status}
                        onChange={(e) => updateEditedItem(item.id, 'status', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="normal">正常</option>
                        <option value="attention">注意</option>
                        <option value="alert">警報</option>
                      </select>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BatchEdit
