'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import React from 'react'

interface BodyComposition {
  id: string
  date: string
  height?: number | null
  weight?: number | null
  body_fat?: number | null
  muscle_mass?: number | null
  visceral_fat?: number | null
  bmi?: number | null
}

interface BodyCompositionTrackerProps {
  clientId: string
  initialData?: BodyComposition[]
}

function BodyCompositionTracker({
  clientId, 
  initialData = []
}: BodyCompositionTrackerProps) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const [records, setRecords] = useState<BodyComposition[]>(initialData)
  const [isAdding, setIsAdding] = useState(false)
  const [newRecord, setNewRecord] = useState<Partial<BodyComposition>>({
    date: new Date().toISOString().split('T')[0],
    height: undefined,
    weight: undefined,
    body_fat: undefined,
    muscle_mass: undefined,
    visceral_fat: undefined
  })
  const [loading, setLoading] = useState(false)

  // 計算 BMI
  const calculateBMI = (height: number, weight: number) => {
    if (!height || !weight) return null
    const heightInMeters = height / 100
    return Number((weight / (heightInMeters * heightInMeters)).toFixed(1))
  }

  // 新增記錄
  const handleAdd = async () => {
    if (!newRecord.date || !newRecord.weight || !newRecord.height) {
      alert('請填寫日期、身高和體重')
      return
    }

    setLoading(true)
    try {
      const bmi = calculateBMI(newRecord.height, newRecord.weight)
      
      const { data, error } = await supabase
        .from('body_composition')
        .insert({
          client_id: clientId,
          date: newRecord.date,
          height: newRecord.height,
          weight: newRecord.weight,
          body_fat: newRecord.body_fat,
          muscle_mass: newRecord.muscle_mass,
          visceral_fat: newRecord.visceral_fat,
          bmi: bmi
        })
        .select()
        .single()

      if (error) throw error

      setRecords(prev => [...prev, data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        height: undefined,
        weight: undefined,
        body_fat: undefined,
        muscle_mass: undefined,
        visceral_fat: undefined
      })
      setIsAdding(false)
    } catch (error) {
      console.error('新增失敗:', error)
      alert('新增失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 刪除記錄
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆記錄嗎？')) return

    try {
      const { error } = await supabase
        .from('body_composition')
        .delete()
        .eq('id', id)

      if (error) throw error

      setRecords(prev => prev.filter(record => record.id !== id))
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗，請重試')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium text-gray-900">🏋️ 身體數據記錄</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          + 新增記錄
        </button>
      </div>

      {/* 新增記錄表單 */}
      {isAdding && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">新增身體數據</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
              <input
                type="date"
                value={newRecord.date}
                onChange={(e) => setNewRecord(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">身高 (cm)</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.height || ''}
                onChange={(e) => setNewRecord(prev => ({ ...prev, height: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">體重 (kg)</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.weight || ''}
                onChange={(e) => setNewRecord(prev => ({ ...prev, weight: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">體脂肪率 (%)</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.body_fat || ''}
                onChange={(e) => setNewRecord(prev => ({ ...prev, body_fat: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">骨骼肌 (kg)</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.muscle_mass || ''}
                onChange={(e) => setNewRecord(prev => ({ ...prev, muscle_mass: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">內臟脂肪等級</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.visceral_fat || ''}
                onChange={(e) => setNewRecord(prev => ({ ...prev, visceral_fat: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {/* 記錄列表 */}
      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無身體數據記錄
          </div>
        ) : (
          records.map((record) => (
            <div key={record.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-900">
                  {new Date(record.date).toLocaleDateString('zh-TW')}
                </div>
                <button
                  onClick={() => handleDelete(record.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  刪除
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">身高：</span>
                  <span className="font-medium">{record.height || '-'} cm</span>
                </div>
                <div>
                  <span className="text-gray-600">體重：</span>
                  <span className="font-medium">{record.weight || '-'} kg</span>
                </div>
                <div>
                  <span className="text-gray-600">BMI：</span>
                  <span className="font-medium">{record.bmi || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600">體脂肪：</span>
                  <span className="font-medium">{record.body_fat ? `${record.body_fat}%` : '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600">骨骼肌：</span>
                  <span className="font-medium">{record.muscle_mass || '-'} kg</span>
                </div>
                <div>
                  <span className="text-gray-600">內臟脂肪：</span>
                  <span className="font-medium">{record.visceral_fat || '-'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default React.memo(BodyCompositionTracker)
