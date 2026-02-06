'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface LabResult {
  id?: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
}

interface Supplement {
  id?: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface Client {
  id: string
  unique_code: string
  name: string
  age: number
  gender: string
  status: 'normal' | 'attention' | 'alert'
  lab_results: LabResult[]
  supplements: Supplement[]
}

export default function ClientEditor() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.clientId as string
  
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  useEffect(() => {
    if (clientId === 'new') {
      // 新增學員
      setClient({
        id: '',
        unique_code: '',
        name: '',
        age: 25,
        gender: '女性',
        status: 'normal',
        lab_results: [],
        supplements: []
      })
      setLoading(false)
    } else {
      // 編輯現有學員
      fetchClient()
    }
  }, [clientId])
  
  const fetchClient = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          lab_results (*),
          supplements (*)
        `)
        .eq('id', clientId)
        .single()
      
      if (error) {
        setError('載入學員資料失敗')
        return
      }
      
      setClient(data)
    } catch (error) {
      setError('載入學員資料失敗')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSave = async () => {
    if (!client) return
    
    setSaving(true)
    setError('')
    
    try {
      if (clientId === 'new') {
        // 新增學員
        const uniqueCode = generateUniqueCode()
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 3)
        
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            unique_code: uniqueCode,
            name: client.name,
            age: client.age,
            gender: client.gender,
            status: client.status,
            expires_at: expiresAt.toISOString()
          })
          .select()
          .single()
        
        if (clientError) {
          setError('新增學員失敗')
          return
        }
        
        // 新增檢測數據
        if (client.lab_results.length > 0) {
          const labResultsWithClientId = client.lab_results.map(result => ({
            ...result,
            client_id: newClient.id
          }))
          
          await supabase
            .from('lab_results')
            .insert(labResultsWithClientId)
        }
        
        // 新增補品
        if (client.supplements.length > 0) {
          const supplementsWithClientId = client.supplements.map(supplement => ({
            ...supplement,
            client_id: newClient.id
          }))
          
          await supabase
            .from('supplements')
            .insert(supplementsWithClientId)
        }
        
        router.push('/admin')
      } else {
        // 更新現有學員
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            name: client.name,
            age: client.age,
            gender: client.gender,
            status: client.status
          })
          .eq('id', clientId)
        
        if (clientError) {
          setError('更新學員資料失敗')
          return
        }
        
        // 更新檢測數據
        for (const result of client.lab_results) {
          if (result.id) {
            await supabase
              .from('lab_results')
              .update(result)
              .eq('id', result.id)
          } else {
            await supabase
              .from('lab_results')
              .insert({
                ...result,
                client_id: clientId
              })
          }
        }
        
        // 更新補品
        for (const supplement of client.supplements) {
          if (supplement.id) {
            await supabase
              .from('supplements')
              .update(supplement)
              .eq('id', supplement.id)
          } else {
            await supabase
              .from('supplements')
              .insert({
                ...supplement,
                client_id: clientId
              })
          }
        }
        
        router.push('/admin')
      }
    } catch (error) {
      setError('保存失敗，請重試')
    } finally {
      setSaving(false)
    }
  }
  
  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
  
  const updateClient = (field: string, value: any) => {
    if (!client) return
    setClient({ ...client, [field]: value })
  }
  
  const addLabResult = () => {
    if (!client) return
    setClient({
      ...client,
      lab_results: [...client.lab_results, {
        test_name: '',
        value: 0,
        unit: '',
        reference_range: '',
        status: 'normal',
        date: new Date().toISOString().split('T')[0]
      }]
    })
  }
  
  const updateLabResult = (index: number, field: string, value: any) => {
    if (!client) return
    const updatedResults = [...client.lab_results]
    updatedResults[index] = { ...updatedResults[index], [field]: value }
    setClient({ ...client, lab_results: updatedResults })
  }
  
  const removeLabResult = (index: number) => {
    if (!client) return
    const updatedResults = client.lab_results.filter((_, i) => i !== index)
    setClient({ ...client, lab_results: updatedResults })
  }
  
  const addSupplement = () => {
    if (!client) return
    setClient({
      ...client,
      supplements: [...client.supplements, {
        name: '',
        dosage: '',
        timing: '早餐',
        why: ''
      }]
    })
  }
  
  const updateSupplement = (index: number, field: string, value: any) => {
    if (!client) return
    const updatedSupplements = [...client.supplements]
    updatedSupplements[index] = { ...updatedSupplements[index], [field]: value }
    setClient({ ...client, supplements: updatedSupplements })
  }
  
  const removeSupplement = (index: number) => {
    if (!client) return
    const updatedSupplements = client.supplements.filter((_, i) => i !== index)
    setClient({ ...client, supplements: updatedSupplements })
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }
  
  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">找不到學員資料</h1>
          <Link href="/admin" className="text-blue-600 hover:text-blue-800">
            返回後台
          </Link>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900 mr-4">
                ← 返回
              </Link>
              <h1 className="text-xl font-bold text-gray-900">
                {clientId === 'new' ? '新增學員' : `編輯 ${client.name}`}
              </h1>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">基本資料</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
              <input
                type="text"
                value={client.name}
                onChange={(e) => updateClient('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">年齡</label>
              <input
                type="number"
                value={client.age}
                onChange={(e) => updateClient('age', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性別</label>
              <select
                value={client.gender}
                onChange={(e) => updateClient('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="女性">女性</option>
                <option value="男性">男性</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
              <select
                value={client.status}
                onChange={(e) => updateClient('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">正常</option>
                <option value="attention">需要關注</option>
                <option value="alert">警示</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Lab Results */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">血檢數據</h2>
            <button
              onClick={addLabResult}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              新增檢測項目
            </button>
          </div>
          
          <div className="space-y-4">
            {client.lab_results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">檢測項目</label>
                    <input
                      type="text"
                      value={result.test_name}
                      onChange={(e) => updateLabResult(index, 'test_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">數值</label>
                    <input
                      type="number"
                      step="0.01"
                      value={result.value}
                      onChange={(e) => updateLabResult(index, 'value', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">單位</label>
                    <input
                      type="text"
                      value={result.unit}
                      onChange={(e) => updateLabResult(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">參考範圍</label>
                    <input
                      type="text"
                      value={result.reference_range}
                      onChange={(e) => updateLabResult(index, 'reference_range', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
                    <select
                      value={result.status}
                      onChange={(e) => updateLabResult(index, 'status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="normal">正常</option>
                      <option value="attention">注意</option>
                      <option value="alert">警示</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">檢測日期</label>
                    <input
                      type="date"
                      value={result.date}
                      onChange={(e) => updateLabResult(index, 'date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeLabResult(index)}
                  className="mt-4 text-red-600 hover:text-red-800 text-sm"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Supplements */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">補品清單</h2>
            <button
              onClick={addSupplement}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              新增補品
            </button>
          </div>
          
          <div className="space-y-4">
            {client.supplements.map((supplement, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">補品名稱</label>
                    <input
                      type="text"
                      value={supplement.name}
                      onChange={(e) => updateSupplement(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">劑量</label>
                    <input
                      type="text"
                      value={supplement.dosage}
                      onChange={(e) => updateSupplement(index, 'dosage', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">服用時間</label>
                    <select
                      value={supplement.timing}
                      onChange={(e) => updateSupplement(index, 'timing', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="早餐">早餐</option>
                      <option value="午餐">午餐</option>
                      <option value="晚餐">晚餐</option>
                      <option value="訓練後">訓練後</option>
                      <option value="睡前">睡前</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">說明（可選）</label>
                    <input
                      type="text"
                      value={supplement.why || ''}
                      onChange={(e) => updateSupplement(index, 'why', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeSupplement(index)}
                  className="mt-4 text-red-600 hover:text-red-800 text-sm"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Link
            href="/admin"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
