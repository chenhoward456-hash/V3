'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getLabAdvice } from './types'

interface LabResultsProps {
  labResults: any[]
  isCoachMode: boolean
  clientId: string
  coachHeaders: Record<string, string>
  onMutate: () => void
}

interface GroupedLab {
  testName: string
  latest: any
  prev: any | null
  history: { date: string; value: number }[]
}

export default function LabResults({ labResults, isCoachMode, clientId, coachHeaders, onMutate }: LabResultsProps) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ test_name: '', value: '', unit: '', reference_range: '', date: new Date().toISOString().split('T')[0], custom_advice: '', custom_target: '' })

  // 按 test_name 分組，每組按 date 排序
  const grouped = useMemo<GroupedLab[]>(() => {
    if (!labResults?.length) return []
    const map = new Map<string, any[]>()
    for (const r of labResults) {
      const arr = map.get(r.test_name) || []
      arr.push(r)
      map.set(r.test_name, arr)
    }
    const result: GroupedLab[] = []
    for (const [testName, items] of map) {
      const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const latest = sorted[sorted.length - 1]
      const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
      const history = sorted.map(r => ({
        date: new Date(r.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        value: r.value,
      }))
      result.push({ testName, latest, prev, history })
    }
    return result
  }, [labResults])

  // addFor: 從現有卡片「新增紀錄」，帶入名稱/單位/範圍但清空數值
  const openModal = (lab?: any, addFor?: any) => {
    if (addFor) {
      // 對已有指標新增一筆歷史紀錄
      setEditing(null)
      setForm({ test_name: addFor.test_name, value: '', unit: addFor.unit || '', reference_range: addFor.reference_range || '', date: new Date().toISOString().split('T')[0], custom_advice: addFor.custom_advice || '', custom_target: addFor.custom_target || '' })
    } else if (lab) {
      setEditing(lab)
      setForm({ test_name: lab.test_name, value: String(lab.value), unit: lab.unit || '', reference_range: lab.reference_range || '', date: lab.date, custom_advice: lab.custom_advice || '', custom_target: lab.custom_target || '' })
    } else {
      setEditing(null)
      setForm({ test_name: '', value: '', unit: '', reference_range: '', date: new Date().toISOString().split('T')[0], custom_advice: '', custom_target: '' })
    }
    setShowModal(true)
  }

  // 取得已有的不重複指標名稱（用於新增時下拉選單）
  const existingTestNames = useMemo(() => {
    if (!labResults?.length) return []
    return [...new Set(labResults.map((r: any) => r.test_name))]
  }, [labResults])

  const handleSave = async () => {
    if (!form.test_name || !form.value || !form.date) { alert('請填寫必要欄位'); return }
    try {
      const url = '/api/lab-results'
      const body = editing
        ? { id: editing.id, testName: form.test_name, value: Number(form.value), unit: form.unit, referenceRange: form.reference_range, date: form.date, customAdvice: form.custom_advice || null, customTarget: form.custom_target || null }
        : { clientId, testName: form.test_name, value: Number(form.value), unit: form.unit, referenceRange: form.reference_range, date: form.date, customAdvice: form.custom_advice || null, customTarget: form.custom_target || null }
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: coachHeaders, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('操作失敗')
      setShowModal(false)
      setEditing(null)
      onMutate()
    } catch { alert('操作失敗，請重試') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除？')) return
    try {
      const res = await fetch(`/api/lab-results?id=${id}`, { method: 'DELETE', headers: coachHeaders })
      if (!res.ok) throw new Error('刪除失敗')
      onMutate()
    } catch { alert('刪除失敗') }
  }

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">血檢指標</h2>
          {isCoachMode && (
            <button onClick={() => openModal()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 flex items-center">
              <Plus size={16} className="mr-1" /> 新增血檢
            </button>
          )}
        </div>

        {grouped.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grouped.map((group) => {
              const { latest, prev, history } = group
              const advice = getLabAdvice(latest.test_name, latest.value)
              const statusColor = latest.status === 'normal' ? 'border-green-200 bg-green-50' : latest.status === 'attention' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'
              const dotColor = latest.status === 'normal' ? 'bg-green-500' : latest.status === 'attention' ? 'bg-yellow-500' : 'bg-red-500'
              const lineColor = latest.status === 'normal' ? '#22c55e' : latest.status === 'attention' ? '#eab308' : '#ef4444'

              // 變化計算
              let changeText = ''
              if (prev) {
                const diff = latest.value - prev.value
                const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : ''
                if (diff !== 0) changeText = `${arrow} ${Math.abs(diff).toFixed(2)} vs 上次`
              }

              return (
                <div key={group.testName} className={`rounded-xl p-4 border ${statusColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{latest.test_name}</h3>
                    <div className="flex items-center gap-1">
                      {isCoachMode && (
                        <>
                          <button onClick={() => openModal(latest)} className="p-1 hover:bg-white/50 rounded"><Pencil size={14} className="text-gray-500" /></button>
                          <button onClick={() => handleDelete(latest.id)} className="p-1 hover:bg-white/50 rounded"><Trash2 size={14} className="text-red-400" /></button>
                        </>
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {latest.value} <span className="text-sm font-normal text-gray-500">{latest.unit}</span>
                  </p>
                  {(latest.custom_advice || advice) && (
                    <p className="text-sm text-gray-600 mt-2">{latest.custom_advice || advice}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">參考範圍：{latest.custom_target || latest.reference_range}</p>
                  {isCoachMode && (
                    <button
                      onClick={() => openModal(undefined, latest)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Plus size={12} className="mr-0.5" /> 新增此指標紀錄
                    </button>
                  )}

                  {/* 迷你趨勢圖 */}
                  {history.length >= 2 && (
                    <div className="mt-3 pt-3 border-t border-gray-200/50">
                      {changeText && <p className="text-xs text-gray-500 mb-1">{changeText}</p>}
                      <ResponsiveContainer width="100%" height={60}>
                        <LineChart data={history}>
                          <XAxis
                            dataKey="date"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#9ca3af' }}
                            interval="preserveStartEnd"
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value} ${latest.unit}`, latest.test_name]}
                            labelFormatter={(label) => `日期：${label}`}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: lineColor }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">尚無血檢資料</p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end md:items-center justify-center z-[100] backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-6 md:mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing ? '編輯血檢' : '新增血檢'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">指標名稱 *</label>
                {!editing && existingTestNames.length > 0 ? (
                  <>
                    <select
                      value={existingTestNames.includes(form.test_name) ? form.test_name : '__new__'}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setForm(p => ({ ...p, test_name: '' }))
                        } else {
                          // 選擇已有指標時，自動帶入單位和參考範圍
                          const existing = labResults.find((r: any) => r.test_name === e.target.value)
                          setForm(p => ({
                            ...p,
                            test_name: e.target.value,
                            unit: existing?.unit || p.unit,
                            reference_range: existing?.reference_range || p.reference_range,
                          }))
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    >
                      {existingTestNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value="__new__">+ 新增指標...</option>
                    </select>
                    {!existingTestNames.includes(form.test_name) && (
                      <input type="text" value={form.test_name} onChange={(e) => setForm(p => ({ ...p, test_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="輸入新指標名稱" />
                    )}
                  </>
                ) : (
                  <input type="text" value={form.test_name} onChange={(e) => setForm(p => ({ ...p, test_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：HOMA-IR" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">數值 *</label>
                  <input type="number" step="0.01" value={form.value} onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">單位</label>
                  <input type="text" value={form.unit} onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">參考範圍</label>
                <input type="text" value={form.reference_range} onChange={(e) => setForm(p => ({ ...p, reference_range: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：<1.4" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">檢測日期 *</label>
                <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">自訂目標範圍</label>
                <input type="text" value={form.custom_target} onChange={(e) => setForm(p => ({ ...p, custom_target: e.target.value }))} placeholder="留空則使用預設範圍" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">自訂建議</label>
                <textarea value={form.custom_advice} onChange={(e) => setForm(p => ({ ...p, custom_advice: e.target.value }))} rows={2} placeholder="留空則使用預設建議" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">儲存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
