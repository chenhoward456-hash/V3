'use client'

import { useEffect, useState, useMemo } from 'react'

interface LabRow {
  test_name: string
  value: number
  date: string
  status?: string
}

interface PanelNote {
  id?: string
  client_id?: string
  panel_date: string
  summary?: string | null
  priorities?: string | null
  next_review_date?: string | null
  updated_at?: string
}

interface Props {
  clientUniqueCode: string  // unique_code，用來打 API
  labResults: LabRow[]
}

interface FindingBrief {
  testName: string
  severity: 'critical' | 'attention' | 'watch' | 'improving' | 'optimal'
  trend: 'improving' | 'declining' | 'stable' | 'unknown'
  latestValue: number
  changePercent: number | null
  label: string
}

export default function LabPanelNotesEditor({ clientUniqueCode, labResults }: Props) {
  const [notes, setNotes] = useState<Record<string, PanelNote>>({})
  const [loading, setLoading] = useState(false)
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [draftingDate, setDraftingDate] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [draftFindings, setDraftFindings] = useState<Record<string, FindingBrief[]>>({})

  // 從 lab_results 萃取出所有 unique 的 panel_date（降冪）
  const panelDates = useMemo(() => {
    const set = new Set<string>()
    for (const r of labResults || []) {
      if (r.date) set.add(r.date)
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1))
  }, [labResults])

  // 每個 panel_date 包含的指標數量（顯示用）
  const labCountByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of labResults || []) {
      m.set(r.date, (m.get(r.date) ?? 0) + 1)
    }
    return m
  }, [labResults])

  // 載入已有的 notes
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!clientUniqueCode) return
      setLoading(true)
      try {
        const res = await fetch(`/api/lab-panel-notes?clientId=${encodeURIComponent(clientUniqueCode)}`)
        const json = await res.json()
        if (cancelled) return
        if (json?.success && Array.isArray(json.data)) {
          const map: Record<string, PanelNote> = {}
          for (const n of json.data as PanelNote[]) {
            map[n.panel_date] = n
          }
          setNotes(map)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clientUniqueCode])

  function update(date: string, field: keyof PanelNote, value: string) {
    setNotes(prev => ({
      ...prev,
      [date]: { ...(prev[date] || { panel_date: date }), [field]: value },
    }))
  }

  async function save(date: string) {
    const note = notes[date]
    if (!note) return
    setSavingDate(date)
    setSavedMsg(null)
    try {
      const res = await fetch('/api/lab-panel-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientUniqueCode,
          panelDate: date,
          summary: note.summary || '',
          priorities: note.priorities || '',
          nextReviewDate: note.next_review_date || null,
        }),
      })
      const json = await res.json()
      if (json?.success) {
        setSavedMsg(`${date} 已儲存`)
        setTimeout(() => setSavedMsg(null), 2500)
      } else {
        setSavedMsg(`儲存失敗：${json?.error || '未知錯誤'}`)
      }
    } catch (e) {
      setSavedMsg('儲存失敗')
    } finally {
      setSavingDate(null)
    }
  }

  async function generateDraft(date: string) {
    const existing = notes[date]
    if (existing?.summary || existing?.priorities) {
      const ok = window.confirm(
        '此日期已有內容，產生 AI 草稿會覆蓋目前的「觀察筆記」與「優先處理」欄位。確定？'
      )
      if (!ok) return
    }
    setDraftingDate(date)
    setSavedMsg('AI 生成中（約 10-15 秒）...')
    try {
      const res = await fetch('/api/lab-panel-notes/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientUniqueCode, panelDate: date }),
      })
      const json = await res.json()
      if (json?.success && json.data) {
        setNotes(prev => ({
          ...prev,
          [date]: {
            ...(prev[date] || { panel_date: date }),
            summary: json.data.summary || '',
            priorities: json.data.priorities || '',
          },
        }))
        setDraftFindings(prev => ({
          ...prev,
          [date]: (json.data.findingsBrief || []) as FindingBrief[],
        }))
        setSavedMsg(`✨ 草稿已生成（分析 ${json.data.findingsCount} 個指標）— 請審核後按「儲存」`)
        setTimeout(() => setSavedMsg(null), 6000)
      } else {
        setSavedMsg(`生成失敗：${json?.error || '未知錯誤'}`)
      }
    } catch {
      setSavedMsg('生成失敗，網路或伺服器錯誤')
    } finally {
      setDraftingDate(null)
    }
  }

  function severityStyle(sev: FindingBrief['severity']): { bg: string; text: string; label: string } {
    switch (sev) {
      case 'critical':  return { bg: 'bg-rose-100',    text: 'text-rose-800',    label: '🚨 critical' }
      case 'attention': return { bg: 'bg-amber-100',   text: 'text-amber-800',   label: '⚠️ attention' }
      case 'watch':     return { bg: 'bg-slate-100',   text: 'text-slate-700',   label: '👀 watch' }
      case 'improving': return { bg: 'bg-emerald-50',  text: 'text-emerald-700', label: '📈 improving' }
      case 'optimal':   return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '✅ optimal' }
    }
  }

  if (panelDates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          🩺 整組血檢觀察筆記（教練 Notes）
        </h2>
        <p className="text-sm text-gray-500">
          先在上方新增至少一筆血檢資料，這裡就會列出每個檢測日期供你寫教練觀察筆記。
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">
          🩺 整組血檢觀察筆記（教練 Notes）
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          NT$4,999 Protocol 層的核心交付 — 每次抽血後寫一段教練觀察筆記、生活方式調整優先序、下次追蹤日期。**本內容為教練建議，非醫療診斷或處方。**
        </p>
        {loading && <p className="text-xs text-gray-400 mt-2">載入中...</p>}
        {savedMsg && (
          <p className="text-xs text-emerald-700 mt-2">{savedMsg}</p>
        )}
      </div>

      {panelDates.map(date => {
        const note = notes[date] || { panel_date: date }
        const count = labCountByDate.get(date) ?? 0
        return (
          <div key={date} className="border border-gray-200 rounded-lg p-4 bg-gray-50/60">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <div className="font-medium text-gray-900">{date}</div>
                <div className="text-xs text-gray-500">{count} 項指標</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => generateDraft(date)}
                  disabled={draftingDate === date || savingDate === date}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50 flex items-center gap-1"
                  title="AI 自動生成教練觀察筆記草稿（會分析所有指標趨勢，避免 cherry-pick）"
                >
                  {draftingDate === date ? '生成中...' : '✨ AI 草稿'}
                </button>
                <button
                  onClick={() => save(date)}
                  disabled={savingDate === date || draftingDate === date}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
                >
                  {savingDate === date ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>

            {/* AI 偵測到的 findings 摘要（生成後顯示） */}
            {draftFindings[date] && draftFindings[date].length > 0 && (
              <div className="mb-3 p-3 bg-white border border-indigo-200 rounded">
                <div className="text-xs font-medium text-indigo-700 mb-2">
                  AI 偵測到的關鍵指標（依嚴重度排序，前 12 項）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draftFindings[date].map((f, i) => {
                    const s = severityStyle(f.severity)
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center text-[11px] px-2 py-1 rounded ${s.bg} ${s.text}`}
                        title={f.label}
                      >
                        {s.label} · {f.testName}
                        {f.changePercent !== null && (
                          <span className="ml-1 opacity-75">
                            ({f.changePercent > 0 ? '+' : ''}{f.changePercent.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  教練觀察筆記（這次整組血檢的趨勢觀察）
                </label>
                <textarea
                  value={note.summary || ''}
                  onChange={e => update(date, 'summary', e.target.value)}
                  rows={4}
                  placeholder="例：心血管風險面看 ApoB 與 hsCRP 都從上一季的注意區降到正常，但游離睪固酮仍偏低，與睡眠品質下降相關。代謝端 HOMA-IR 持平，建議維持目前策略再觀察一季..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  優先處理項目 / 介入順序
                </label>
                <textarea
                  value={note.priorities || ''}
                  onChange={e => update(date, 'priorities', e.target.value)}
                  rows={3}
                  placeholder="1) 提高睡眠時長至 7h 以上（最高優先）\n2) Omega-3 提升至 3g / day\n3) 加做 SHBG + 雌二醇追蹤"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  下次建議追蹤日期
                </label>
                <input
                  type="date"
                  value={note.next_review_date || ''}
                  onChange={e => update(date, 'next_review_date', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
