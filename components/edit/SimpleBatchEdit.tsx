'use client'

import React, { useState, useMemo } from 'react'
import { Edit3, Save, X, Download, Trash2, CheckSquare, Square, TrendingUp, TrendingDown, Target, Award } from 'lucide-react'

interface SimpleBatchEditProps {
  data: any[]
  onSave: (updatedData: any[]) => void
}

const SimpleBatchEdit = ({ data, onSave }: SimpleBatchEditProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [editedData, setEditedData] = useState<any[]>([])

  React.useEffect(() => {
    if (isEditing && data) {
      setEditedData([...data])
    }
  }, [isEditing, data])

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const updateEditedItem = (id: string, field: string, value: string) => {
    setEditedData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleSave = () => {
    onSave(editedData)
    setIsEditing(false)
    setSelectedItems(new Set())
  }

  const handleExport = () => {
    const csv = editedData.map(item => 
      `${item.date},${item.weight || ''},${item.body_fat || ''},${item.muscle_mass || ''}`
    ).join('\n')
    
    const blob = new Blob([`日期,體重,體脂率,肌肉量\n${csv}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'body_data.csv')
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
            onClick={() => setIsEditing(false)}
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2">選擇</th>
              <th className="text-left py-2 px-2">日期</th>
              <th className="text-left py-2 px-2">體重</th>
              <th className="text-left py-2 px-2">體脂率</th>
              <th className="text-left py-2 px-2">肌肉量</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SimpleBatchEdit
