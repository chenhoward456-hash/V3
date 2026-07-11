'use client'

import { useState, useEffect } from 'react'

interface Note {
  id: string
  category: string
  note: string
  weight: number
  relevant_until: string | null
  added_at: string
  added_by: string
}

const CATEGORIES = [
  { value: 'historical_failure', label: '歷史失敗', color: 'rose' },
  { value: 'physiological_response', label: '生理反應', color: 'violet' },
  { value: 'preference', label: '偏好', color: 'blue' },
  { value: 'constraint', label: '限制', color: 'amber' },
  { value: 'context', label: '背景', color: 'gray' },
  { value: 'goal_change', label: '目標變動', color: 'emerald' },
]

const colorMap: Record<string, string> = {
  rose: 'bg-slate-50 border-slate-200 text-slate-800',
  violet: 'bg-slate-50 border-slate-200 text-slate-800',
  blue: 'bg-slate-50 border-slate-200 text-slate-800',
  amber: 'bg-slate-50 border-slate-200 text-slate-800',
  gray: 'bg-slate-50 border-slate-200 text-slate-800',
  emerald: 'bg-slate-50 border-slate-200 text-slate-800',
}

export default function PersonalNotesEditor({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: 'physiological_response',
    note: '',
    weight: 7,
    relevant_until: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/personal-notes?clientId=${clientId}`)
      const json = await res.json()
      if (json.success) setNotes(json.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  const resetForm = () => {
    setForm({ category: 'physiological_response', note: '', weight: 7, relevant_until: '' })
    setShowAdd(false)
    setEditId(null)
  }

  const handleSave = async () => {
    if (!form.note.trim()) { alert('請輸入筆記內容'); return }
    try {
      if (editId) {
        await fetch(`/api/admin/personal-notes?id=${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/admin/personal-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, ...form }),
        })
      }
      resetForm()
      load()
    } catch (err) {
      alert('儲存失敗')
    }
  }

  const handleEdit = (n: Note) => {
    setForm({
      category: n.category,
      note: n.note,
      weight: n.weight,
      relevant_until: n.relevant_until ?? '',
    })
    setEditId(n.id)
    setShowAdd(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除這條筆記？')) return
    await fetch(`/api/admin/personal-notes?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-medium text-gray-900">個人化記憶（AI Agent 紅線）</h2>
          <p className="text-xs text-gray-500 mt-0.5">AI 每次提案前都會讀這些；weight ≥ 8 = 絕對禁區</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(!showAdd) }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          {showAdd ? '取消' : '+ 新增'}
        </button>
      </div>

      {showAdd && (
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">分類</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">重要性 (1-10)</label>
              <input
                type="number"
                min={1} max={10}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 5 })}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">內容</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              placeholder="例：對 SHBG 敏感，低碳 1-2 週就會看到 SHBG 上升..."
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              有效到（選填，限期型筆記用，例如出差日期）
            </label>
            <input
              type="date"
              value={form.relevant_until}
              onChange={(e) => setForm({ ...form, relevant_until: e.target.value })}
              className="px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded">
              {editId ? '更新' : '新增'}
            </button>
            <button onClick={resetForm} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded">取消</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-6">載入中…</p>
      ) : notes.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">尚無筆記。點上方「+ 新增」加入第一條。</p>
      ) : (
        <div className="space-y-2">
          {notes.map(n => {
            const cat = CATEGORIES.find(c => c.value === n.category) ?? CATEGORIES[4]
            return (
              <div key={n.id} className={`border rounded p-3 ${colorMap[cat.color]}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-white/60 font-medium">{cat.label}</span>
                    <span className="font-semibold">weight: {n.weight}/10</span>
                    {n.relevant_until && (
                      <span className="text-gray-600">有效到 {n.relevant_until}</span>
                    )}
                    <span className="text-gray-500">by {n.added_by}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(n)}
                      className="text-xs px-2 py-0.5 bg-white/60 rounded hover:bg-white"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded hover:bg-rose-200"
                    >
                      刪除
                    </button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.note}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
