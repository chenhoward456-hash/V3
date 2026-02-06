'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LabResult {
  name: string
  category: string
  value: number
  unit: string
  reference: string
  status: 'normal' | 'low' | 'high'
  date: string
  description: string
}

interface SupplementTask {
  id: string
  name: string
  dosage: string
  time: string
  icon: string
}

interface Client {
  id: string
  name: string
  age: number
  gender: string
  lastUpdate: string
  status: 'normal' | 'attention' | 'alert'
  labResults: LabResult[]
}

export default function HealthAdminPanel() {
  const router = useRouter()
  
  const [client, setClient] = useState<Client>({
    id: 'chengjun',
    name: '承鈞',
    age: 25,
    gender: '女性',
    lastUpdate: new Date().toLocaleDateString('zh-TW'),
    status: 'attention',
    labResults: [
      {
        name: 'HOMA-IR',
        category: '胰島素抵抗',
        value: 0.27,
        unit: '',
        reference: '<1.4',
        status: 'normal',
        date: '2024/01/15',
        description: '胰島素抵抗正常，藥物壓低-真實狀況未知'
      },
      {
        name: '空腹胰島素',
        category: '胰島素檢測',
        value: 1.36,
        unit: 'µIU/mL',
        reference: '<5.0',
        status: 'normal',
        date: '2024/01/15',
        description: '空腹胰島素正常，藥物壓低-真實狀況未知'
      },
      {
        name: '空腹血糖',
        category: '血糖檢測',
        value: 80,
        unit: 'mg/dL',
        reference: '<90',
        status: 'normal',
        date: '2024/01/15',
        description: '空腹血糖正常'
      },
      {
        name: 'HOMA1-%β',
        category: '胰島素功能',
        value: 29,
        unit: '%',
        reference: '≥48.9',
        status: 'low',
        date: '2024/01/15',
        description: 'β細胞功能不足(僅60%)，需要關注'
      },
      {
        name: '三酸甘油酯',
        category: '血脂檢測',
        value: 61,
        unit: 'mg/dL',
        reference: '<100',
        status: 'normal',
        date: '2024/01/15',
        description: '三酸甘油酯優秀'
      },
      {
        name: '同半胱胺酸',
        category: '心血管檢測',
        value: 14.8,
        unit: 'µmol/L',
        reference: '<8.0',
        status: 'high',
        date: '2024/01/15',
        description: '嚴重偏高(最大問題)，需要立即處理'
      },
      {
        name: 'Lp(a)',
        category: '心血管檢測',
        value: 10.0,
        unit: 'mg/dL',
        reference: '<30',
        status: 'normal',
        date: '2024/01/15',
        description: 'Lp(a)神級水平，心血管保護極佳'
      },
      {
        name: 'ApoB',
        category: '血脂檢測',
        value: 71,
        unit: 'mg/dL',
        reference: '<80',
        status: 'normal',
        date: '2024/01/15',
        description: 'ApoB正常'
      },
      {
        name: '鐵蛋白',
        category: '礦物質檢測',
        value: 45.9,
        unit: 'ng/mL',
        reference: '50-150',
        status: 'low',
        date: '2024/01/15',
        description: '鐵蛋白偏低，需要補充'
      },
      {
        name: '維生素D',
        category: '維生素檢測',
        value: 35.3,
        unit: 'ng/mL',
        reference: '>50',
        status: 'low',
        date: '2024/01/15',
        description: '維生素D不足，需要補充'
      },
      {
        name: '鎂',
        category: '礦物質檢測',
        value: 2.2,
        unit: 'mg/dL',
        reference: '2.0-2.4',
        status: 'normal',
        date: '2024/01/15',
        description: '鎂正常'
      },
      {
        name: '鋅',
        category: '礦物質檢測',
        value: 901,
        unit: 'µg/dL',
        reference: '700-1200',
        status: 'normal',
        date: '2024/01/15',
        description: '鋅正常'
      },
      {
        name: '體重',
        category: '身體組成',
        value: 58,
        unit: 'kg',
        reference: '55-57',
        status: 'high',
        date: '2024/01/15',
        description: '體重略高，可減1-3kg'
      },
      {
        name: '體脂率',
        category: '身體組成',
        value: 23.60,
        unit: '%',
        reference: '20-22',
        status: 'high',
        date: '2024/01/15',
        description: '體脂率偏高，可降1.6-3.6%'
      },
      {
        name: '內臟脂肪',
        category: '身體組成',
        value: 3,
        unit: '',
        reference: '<10',
        status: 'normal',
        date: '2024/01/15',
        description: '內臟脂肪優秀'
      },
      {
        name: '骨骼肌',
        category: '身體組成',
        value: 24.5,
        unit: 'kg',
        reference: '-',
        status: 'normal',
        date: '2024/01/15',
        description: '骨骼肌正常'
      }
    ]
  })
  
  const [supplements, setSupplements] = useState<SupplementTask[]>([
    { id: 'b_complex', name: 'B群(5-MTHF+B12)', dosage: '800mcg+1000mcg', time: '早餐', icon: '💊' },
    { id: 'd3_k2', name: 'D3+K2', dosage: '5000IU+200mcg', time: '早餐', icon: '💊' },
    { id: 'iron', name: '鐵劑(雙甘胺酸鐵)', dosage: '25mg', time: '早餐', icon: '🔴' },
    { id: 'inositol', name: '肌醇(40:1)', dosage: '2g', time: '早餐', icon: '💊' },
    { id: 'chromium', name: '鉻', dosage: '600mcg', time: '午餐前', icon: '💊' },
    { id: 'fish_oil', name: '魚油', dosage: '2g', time: '晚餐', icon: '🐟' },
    { id: 'glycine_magnesium', name: '甘胺酸鎂', dosage: '400mg', time: '睡前', icon: '💊' }
  ])
  
  const [editingLabResult, setEditingLabResult] = useState<LabResult | null>(null)
  const [editingSupplement, setEditingSupplement] = useState<SupplementTask | null>(null)
  
  // 載入和保存數據
  useEffect(() => {
    const savedClient = localStorage.getItem('health-client-data')
    if (savedClient) {
      setClient(JSON.parse(savedClient))
    }
    
    const savedSupplements = localStorage.getItem('health-supplements')
    if (savedSupplements) {
      setSupplements(JSON.parse(savedSupplements))
    }
  }, [])
  
  useEffect(() => {
    localStorage.setItem('health-client-data', JSON.stringify(client))
  }, [client])
  
  useEffect(() => {
    localStorage.setItem('health-supplements', JSON.stringify(supplements))
  }, [supplements])
  
  const handleLabResultChange = (index: number, field: keyof LabResult, value: string | number) => {
    const updatedResults = [...client.labResults]
    updatedResults[index] = {
      ...updatedResults[index],
      [field]: field === 'value' || field === 'reference' ? Number(value) : value
    }
    
    // 自動判斷狀態
    if (field === 'value' || field === 'reference') {
      const currentValue = Number(updatedResults[index].value)
      const reference = updatedResults[index].reference
      
      if (reference.includes('<')) {
        const refValue = Number(reference.replace('<', ''))
        updatedResults[index].status = currentValue >= refValue ? 'high' : 'normal'
      } else if (reference.includes('>')) {
        const refValue = Number(reference.replace('>', ''))
        updatedResults[index].status = currentValue <= refValue ? 'low' : 'normal'
      } else if (reference.includes('-')) {
        const [min, max] = reference.split('-').map(Number)
        updatedResults[index].status = currentValue < min || currentValue > max ? 'high' : 'normal'
      } else if (reference === '≥48.9') {
        updatedResults[index].status = currentValue >= 48.9 ? 'normal' : 'low'
      }
    }
    
    setClient(prev => ({
      ...prev,
      labResults: updatedResults
    }))
  }
  
  const handleSupplementChange = (index: number, field: keyof SupplementTask, value: string) => {
    const updatedSupplements = [...supplements]
    updatedSupplements[index] = {
      ...updatedSupplements[index],
      [field]: value
    }
    setSupplements(updatedSupplements)
  }
  
  const addLabResult = () => {
    const newResult: LabResult = {
      name: '新檢測項目',
      category: '檢測類別',
      value: 0,
      unit: '單位',
      reference: '參考範圍',
      status: 'normal',
      date: new Date().toLocaleDateString('zh-TW'),
      description: '檢測描述'
    }
    setClient(prev => ({
      ...prev,
      labResults: [...prev.labResults, newResult]
    }))
  }
  
  const addSupplement = () => {
    const newSupplement: SupplementTask = {
      id: 'new_' + Date.now(),
      name: '新補品',
      dosage: '劑量',
      time: '時間',
      icon: '💊'
    }
    setSupplements(prev => [...prev, newSupplement])
  }
  
  const deleteLabResult = (index: number) => {
    setClient(prev => ({
      ...prev,
      labResults: prev.labResults.filter((_, i) => i !== index)
    }))
  }
  
  const deleteSupplement = (index: number) => {
    setSupplements(prev => prev.filter((_, i) => i !== index))
  }
  
  const saveToDashboard = () => {
    // 保存到主儀表板
    localStorage.setItem('health-client-data', JSON.stringify(client))
    localStorage.setItem('health-supplements', JSON.stringify(supplements))
    alert('✅ 數據已保存到儀表板！')
  }
  
  const goToDashboard = () => {
    router.push('/health-monitoring?client=chengjun')
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600'
      case 'low': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常'
      case 'low': return '偏低'
      case 'high': return '偏高'
      default: return '未知'
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 rounded-t-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-gray-900 tracking-tight">
                健康數據管理面板
              </h1>
              <p className="text-gray-600 mt-1">
                統一管理檢測數據和補品清單
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={saveToDashboard}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                💾 保存到儀表板
              </button>
              <button
                onClick={goToDashboard}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                👀 查看儀表板
              </button>
            </div>
          </div>
        </div>
        
        {/* Client Info */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 mb-8 border border-gray-200/50">
          <h2 className="text-2xl font-light text-gray-900 mb-6">學員資訊</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
              <input
                type="text"
                value={client.name}
                onChange={(e) => setClient(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">年齡</label>
              <input
                type="number"
                value={client.age}
                onChange={(e) => setClient(prev => ({ ...prev, age: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性別</label>
              <select
                value={client.gender}
                onChange={(e) => setClient(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="女性">女性</option>
                <option value="男性">男性</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Lab Results */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 mb-8 border border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">檢測數據管理</h2>
            <button
              onClick={addLabResult}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              ➕ 新增檢測項目
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">檢測項目</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">類別</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">數值</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">單位</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">參考範圍</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">狀態</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">日期</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">操作</th>
                </tr>
              </thead>
              <tbody>
                {client.labResults.map((result, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={result.name}
                        onChange={(e) => handleLabResultChange(index, 'name', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={result.category}
                        onChange={(e) => handleLabResultChange(index, 'category', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={result.value}
                        onChange={(e) => handleLabResultChange(index, 'value', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={result.unit}
                        onChange={(e) => handleLabResultChange(index, 'unit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={result.reference}
                        onChange={(e) => handleLabResultChange(index, 'reference', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className={`py-3 px-4 font-medium ${getStatusColor(result.status)}`}>
                      {getStatusText(result.status)}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={result.date}
                        onChange={(e) => handleLabResultChange(index, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => deleteLabResult(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        🗑️ 刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Supplements */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">補品清單管理</h2>
            <button
              onClick={addSupplement}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              ➕ 新增補品
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplements.map((supplement, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={supplement.name}
                    onChange={(e) => handleSupplementChange(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={() => deleteSupplement(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    🗑️
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600 w-16">劑量:</label>
                    <input
                      type="text"
                      value={supplement.dosage}
                      onChange={(e) => handleSupplementChange(index, 'dosage', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600 w-16">時間:</label>
                    <input
                      type="text"
                      value={supplement.time}
                      onChange={(e) => handleSupplementChange(index, 'time', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600 w-16">圖標:</label>
                    <input
                      type="text"
                      value={supplement.icon}
                      onChange={(e) => handleSupplementChange(index, 'icon', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
