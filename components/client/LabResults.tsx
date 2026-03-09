'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getLocalDateStr } from '@/lib/date-utils'
import { getLabAdvice } from './types'
import { isInOptimalRange, getOptimalRangeText } from '@/utils/labStatus'
import { useToast } from '@/components/ui/Toast'

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
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ test_name: '', value: '', unit: '', reference_range: '', date: getLocalDateStr(), custom_advice: '', custom_target: '' })

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
      // 找到距離最新日期至少 14 天的前一筆（避免同期檢測互相比較）
      let prev: any = null
      const latestTime = new Date(latest.date).getTime()
      for (let i = sorted.length - 2; i >= 0; i--) {
        const daysDiff = (latestTime - new Date(sorted[i].date).getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff >= 14) {
          prev = sorted[i]
          break
        }
      }
      if (!prev && sorted.length >= 2) prev = sorted[sorted.length - 2]
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
      setForm({ test_name: addFor.test_name, value: '', unit: addFor.unit || '', reference_range: addFor.reference_range || '', date: getLocalDateStr(), custom_advice: addFor.custom_advice || '', custom_target: addFor.custom_target || '' })
    } else if (lab) {
      setEditing(lab)
      setForm({ test_name: lab.test_name, value: String(lab.value), unit: lab.unit || '', reference_range: lab.reference_range || '', date: lab.date, custom_advice: lab.custom_advice || '', custom_target: lab.custom_target || '' })
    } else {
      setEditing(null)
      // 預設選第一個已有指標，若無則選第一個預設模板
      const defaultTest = existingTestNames[0] || availablePresets[0]?.name || ''
      const defaultExisting = labResults?.find((r: any) => r.test_name === defaultTest)
      const defaultPreset = presetTests.find(t => t.name === defaultTest)
      setForm({
        test_name: defaultTest,
        value: '',
        unit: defaultExisting?.unit || defaultPreset?.unit || '',
        reference_range: defaultExisting?.reference_range || defaultPreset?.reference || '',
        date: getLocalDateStr(),
        custom_advice: '',
        custom_target: ''
      })
    }
    setShowModal(true)
  }

  // 取得已有的不重複指標名稱（用於新增時下拉選單）
  const existingTestNames = useMemo(() => {
    if (!labResults?.length) return []
    return [...new Set(labResults.map((r: any) => r.test_name))]
  }, [labResults])

  // 完整的預設指標模板（涵蓋系統支援的所有檢測項目）
  const presetTests = [
    // 代謝 / 血糖
    { name: 'HOMA-IR', unit: '', reference: '<2.0' },
    { name: '空腹血糖', unit: 'mg/dL', reference: '<90' },
    { name: '空腹胰島素', unit: 'μIU/mL', reference: '<5.0' },
    { name: 'HbA1c', unit: '%', reference: '<5.5' },
    { name: '尿酸', unit: 'mg/dL', reference: '<7.0' },
    // 血脂
    { name: '三酸甘油酯', unit: 'mg/dL', reference: '<100' },
    { name: 'ApoB', unit: 'mg/dL', reference: '<80' },
    { name: 'Lp(a)', unit: 'mg/dL', reference: '<30' },
    { name: 'LDL-C', unit: 'mg/dL', reference: '<100' },
    { name: 'HDL-C', unit: 'mg/dL', reference: '>40' },
    { name: '總膽固醇', unit: 'mg/dL', reference: '<200' },
    // 肝功能
    { name: 'AST', unit: 'U/L', reference: '<40' },
    { name: 'ALT', unit: 'U/L', reference: '<40' },
    { name: 'GGT', unit: 'U/L', reference: '<60' },
    { name: '白蛋白', unit: 'g/dL', reference: '>3.5' },
    // 腎功能
    { name: '肌酸酐', unit: 'mg/dL', reference: '0.7-1.3' },
    { name: 'BUN', unit: 'mg/dL', reference: '7-20' },
    { name: 'eGFR', unit: 'mL/min', reference: '>90' },
    // 甲狀腺
    { name: 'TSH', unit: 'mIU/L', reference: '0.4-4.0' },
    { name: 'Free T4', unit: 'ng/dL', reference: '0.8-1.8' },
    { name: 'Free T3', unit: 'pg/mL', reference: '2.3-4.2' },
    // 鐵代謝
    { name: '鐵蛋白', unit: 'ng/mL', reference: '50-150' },
    { name: '血紅素', unit: 'g/dL', reference: '13.5-17.5' },
    { name: 'MCV', unit: 'fL', reference: '80-100' },
    // 發炎
    { name: 'CRP', unit: 'mg/L', reference: '<1.0' },
    { name: '同半胱胺酸', unit: 'μmol/L', reference: '<8.0' },
    // 維生素
    { name: '維生素D', unit: 'ng/mL', reference: '50-100' },
    { name: '維生素B12', unit: 'pg/mL', reference: '400-900' },
    { name: '葉酸', unit: 'ng/mL', reference: '5.4-20' },
    // 礦物質
    { name: '鎂', unit: 'mg/dL', reference: '2.0-2.4' },
    { name: '鋅', unit: 'μg/dL', reference: '70-120' },
    { name: '鈣', unit: 'mg/dL', reference: '8.5-10.5' },
    // 荷爾蒙
    { name: '睪固酮', unit: 'ng/dL', reference: '300-1000' },
    { name: '游離睪固酮', unit: 'pg/mL', reference: '47-244' },
    { name: '皮質醇', unit: 'μg/dL', reference: '6-18' },
    { name: 'DHEA-S', unit: 'μg/dL', reference: '100-500' },
    { name: '雌二醇', unit: 'pg/mL', reference: '10-40' },
    { name: 'SHBG', unit: 'nmol/L', reference: '10-57' },
    // 血球
    { name: '白血球', unit: '/μL', reference: '4000-10000' },
    { name: '血小板', unit: '/μL', reference: '150000-400000' },
  ]

  // 過濾掉使用者已有的指標，只顯示尚未新增的
  const availablePresets = useMemo(() => {
    return presetTests.filter(t => !existingTestNames.includes(t.name))
  }, [existingTestNames])

  const handleSave = async () => {
    if (!form.test_name || !form.value || !form.date) { showToast('請填寫必要欄位', 'error'); return }
    try {
      const url = '/api/lab-results'
      const isSelfEntry = !isCoachMode && !editing
      const body = editing
        ? { id: editing.id, testName: form.test_name, value: Number(form.value), unit: form.unit, referenceRange: form.reference_range, date: form.date, customAdvice: form.custom_advice || null, customTarget: form.custom_target || null }
        : { clientId, testName: form.test_name, value: Number(form.value), unit: form.unit, referenceRange: form.reference_range, date: form.date, customAdvice: form.custom_advice || null, customTarget: form.custom_target || null, ...(isSelfEntry ? { selfEntry: true } : {}) }
      const headers = isSelfEntry ? { 'Content-Type': 'application/json' } : coachHeaders
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('操作失敗')
      setShowModal(false)
      setEditing(null)
      onMutate()
    } catch { showToast('操作失敗，請重試', 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除？')) return
    try {
      const res = await fetch(`/api/lab-results?id=${id}`, { method: 'DELETE', headers: coachHeaders })
      if (!res.ok) throw new Error('刪除失敗')
      onMutate()
    } catch { showToast('刪除失敗', 'error') }
  }

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">血檢數據紀錄</h2>
          <button onClick={() => openModal()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 flex items-center">
            <Plus size={16} className="mr-1" /> 新增血檢
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            此頁面僅供數據紀錄與趨勢追蹤，不構成醫療診斷或健康評估。數值判讀請以你的醫師意見為準。
          </p>
        </div>

        {grouped.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grouped.map((group) => {
              const { latest, prev, history } = group
              const advice = getLabAdvice(latest.test_name, latest.value)
              const isOptimal = latest.status === 'normal' && isInOptimalRange(latest.test_name, latest.value)
              const canOptimize = latest.status === 'normal' && !isOptimal
              const optimalRange = canOptimize ? getOptimalRangeText(latest.test_name) : null
              const statusColor = latest.status !== 'normal'
                ? (latest.status === 'attention' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50')
                : isOptimal ? 'border-green-200 bg-green-50' : 'border-blue-100 bg-blue-50'
              const dotColor = latest.status !== 'normal'
                ? (latest.status === 'attention' ? 'bg-yellow-500' : 'bg-red-500')
                : isOptimal ? 'bg-green-500' : 'bg-blue-500'
              const lineColor = latest.status !== 'normal'
                ? (latest.status === 'attention' ? '#eab308' : '#ef4444')
                : isOptimal ? '#22c55e' : '#3b82f6'

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
                  <p className="text-xs text-gray-400 mt-1">
                    參考範圍：{latest.custom_target || latest.reference_range}
                    {optimalRange && <span className="text-blue-500">｜最佳：{optimalRange}</span>}
                  </p>
                  <button
                    onClick={() => openModal(undefined, latest)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Plus size={12} className="mr-0.5" /> 新增此指標紀錄
                  </button>

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
          <div className="text-center py-4">
            <p className="text-gray-400">尚無血檢資料</p>
            <p className="text-xs text-gray-300 mt-1">點擊「新增血檢」上傳你的檢驗數據</p>
          </div>
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
                {!editing ? (
                  <>
                    <select
                      value={
                        existingTestNames.includes(form.test_name) ? form.test_name
                        : presetTests.some(t => t.name === form.test_name) ? form.test_name
                        : '__new__'
                      }
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setForm(p => ({ ...p, test_name: '', unit: '', reference_range: '' }))
                        } else {
                          // 從已有資料或預設模板帶入單位和參考範圍
                          const existing = labResults.find((r: any) => r.test_name === e.target.value)
                          const preset = presetTests.find(t => t.name === e.target.value)
                          setForm(p => ({
                            ...p,
                            test_name: e.target.value,
                            unit: existing?.unit || preset?.unit || p.unit,
                            reference_range: existing?.reference_range || preset?.reference || p.reference_range,
                          }))
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    >
                      {existingTestNames.length > 0 && (
                        <optgroup label="已有指標">
                          {existingTestNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </optgroup>
                      )}
                      {availablePresets.length > 0 && (
                        <optgroup label="新增指標">
                          {availablePresets.map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__new__">✏️ 自行輸入...</option>
                    </select>
                    {!existingTestNames.includes(form.test_name) && !presetTests.some(t => t.name === form.test_name) && (
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
              {isCoachMode && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">自訂目標範圍</label>
                    <input type="text" value={form.custom_target} onChange={(e) => setForm(p => ({ ...p, custom_target: e.target.value }))} placeholder="留空則使用預設範圍" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">自訂建議</label>
                    <textarea value={form.custom_advice} onChange={(e) => setForm(p => ({ ...p, custom_advice: e.target.value }))} rows={2} placeholder="留空則使用預設建議" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
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
