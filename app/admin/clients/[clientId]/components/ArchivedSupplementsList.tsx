'use client'

import { useEffect, useState } from 'react'

interface ArchivedSupplement {
  id: string
  name: string
  dosage: string
  timing: string
  why: string | null
  started_at: string | null
  archived_at: string | null
  archive_reason: string | null
  replaced_by_id: string | null
  coach_rationale: string | null
  mode_context: string | null
}

interface Props {
  clientUniqueCode: string
  /** Bump this to force refresh after archiving */
  refreshKey?: number
}

export default function ArchivedSupplementsList({ clientUniqueCode, refreshKey }: Props) {
  const [items, setItems] = useState<ArchivedSupplement[]>([])
  const [allActive, setAllActive] = useState<ArchivedSupplement[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!clientUniqueCode) return
      setLoading(true)
      try {
        const res = await fetch(`/api/supplements/history?clientId=${encodeURIComponent(clientUniqueCode)}`)
        const json = await res.json()
        if (cancelled) return
        if (json?.success && json.data) {
          setItems((json.data.archived || []) as ArchivedSupplement[])
          setAllActive((json.data.active || []) as ArchivedSupplement[])
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clientUniqueCode, refreshKey])

  async function restore(id: string) {
    if (!window.confirm('要還原這個補品到「目前在吃」嗎？')) return
    setRestoring(id)
    try {
      const res = await fetch(`/api/supplements/archive?supplementId=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json?.success) {
        setItems(prev => prev.filter(s => s.id !== id))
        alert('已還原（請重新整理頁面看到 active 區塊）')
      } else {
        alert(`還原失敗：${json?.error || ''}`)
      }
    } catch {
      alert('還原失敗')
    } finally {
      setRestoring(null)
    }
  }

  function findReplacement(id: string | null): string | null {
    if (!id) return null
    const found = allActive.find(s => s.id === id)
    return found ? found.name : null
  }

  if (loading && items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <p className="text-sm text-gray-400">載入過去 protocol...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return null  // 沒有封存的就不顯示
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-base font-medium text-gray-900">
            過去 protocol（已封存）
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length} 筆歷史紀錄 — 開始 / 停止日期 / 取代關係
          </p>
        </div>
        <span className="text-sm text-gray-400">{expanded ? '收合 ▴' : '展開 ▾'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {items.map(s => {
            const replacedByName = findReplacement(s.replaced_by_id)
            return (
              <div key={s.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-600">
                      {s.dosage} · {s.timing}
                      {s.mode_context && <span className="ml-2 text-slate-600">mode: {s.mode_context}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      期間：{s.started_at || '—'} → {s.archived_at || '—'}
                    </div>
                    {s.coach_rationale && (
                      <div className="mt-2 text-xs text-emerald-700">
                        <span className="font-medium">當時 rationale：</span>{s.coach_rationale}
                      </div>
                    )}
                    {s.archive_reason && (
                      <div className="mt-1 text-xs text-amber-700">
                        <span className="font-medium">停掉原因：</span>{s.archive_reason}
                      </div>
                    )}
                    {replacedByName && (
                      <div className="mt-1 text-xs text-slate-600">
                        ↪ 被「{replacedByName}」取代
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => restore(s.id)}
                    disabled={restoring === s.id}
                    className="text-xs px-2 py-1 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50"
                  >
                    {restoring === s.id ? '還原中...' : '還原'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
