'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

interface SupplementModalProps {
  supplements: any[]
  clientId: string
  coachHeaders: Record<string, string>
  onClose: () => void
  onMutate: () => void
}

export default function SupplementModal({ supplements, clientId, coachHeaders, onClose, onMutate }: SupplementModalProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', dosage: '', timing: '早餐', why: '', sort_order: '0' })

  const openForm = (supp?: any) => {
    if (supp) {
      setEditing(supp)
      setForm({ name: supp.name, dosage: supp.dosage, timing: supp.timing || '早餐', why: supp.why || '', sort_order: String(supp.sort_order || 0) })
    } else {
      setEditing(null)
      setForm({ name: '', dosage: '', timing: '早餐', why: '', sort_order: '0' })
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.dosage || !form.timing) { alert('請填寫必要欄位'); return }
    try {
      const url = '/api/supplements'
      const body = editing
        ? { id: editing.id, name: form.name, dosage: form.dosage, timing: form.timing, why: form.why, sortOrder: Number(form.sort_order) || 0 }
        : { clientId, name: form.name, dosage: form.dosage, timing: form.timing, why: form.why, sortOrder: Number(form.sort_order) || 0 }
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: coachHeaders, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('操作失敗')
      setShowForm(false)
      setEditing(null)
      onMutate()
    } catch { alert('操作失敗，請重試') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此補品？')) return
    try {
      const res = await fetch(`/api/supplements?id=${id}`, { method: 'DELETE', headers: coachHeaders })
      if (!res.ok) throw new Error('刪除失敗')
      onMutate()
    } catch { alert('刪除失敗') }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end md:items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-6 md:mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">管理補品</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {!showForm ? (
          <>
            <div className="space-y-2 mb-4">
              {supplements.map((supp: any) => (
                <div key={supp.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{supp.name}</p>
                    <p className="text-xs text-gray-500">{supp.dosage} · {supp.timing}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openForm(supp)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil size={14} className="text-gray-500" /></button>
                    <button onClick={() => handleDelete(supp.id)} className="p-1.5 hover:bg-gray-100 rounded"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                </div>
              ))}
              {supplements.length === 0 && (
                <p className="text-gray-400 text-center py-4 text-sm">尚無補品</p>
              )}
            </div>
            <button onClick={() => openForm()} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center">
              <Plus size={16} className="mr-1" /> 新增補品
            </button>
          </>
        ) : (
          <>
            <h4 className="text-sm font-medium text-gray-700 mb-3">{editing ? '編輯補品' : '新增補品'}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">劑量 *</label>
                <input type="text" value={form.dosage} onChange={(e) => setForm(p => ({ ...p, dosage: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：1000mg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服用時間 *</label>
                <select value={form.timing} onChange={(e) => setForm(p => ({ ...p, timing: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="早餐">早餐</option>
                  <option value="午餐前">午餐前</option>
                  <option value="晚餐">晚餐</option>
                  <option value="睡前">睡前</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                <input type="text" value={form.why} onChange={(e) => setForm(p => ({ ...p, why: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="為什麼要吃" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">返回</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">儲存</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
