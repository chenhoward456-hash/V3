'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ToolCall {
  name: string
  input: any
  result: any
}

interface Proposal {
  id: string
  client_id: string
  proposed_by: string
  proposed_at: string
  status: string
  proposal_type: string
  current_state: any
  proposed_changes: any
  reasoning: string
  safety_check_result: any
  clients?: { name: string }
}

export default function AgentPlayground() {
  const [userMessage, setUserMessage] = useState('')
  const [contextHint, setContextHint] = useState('陳胤豪 (client_id=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4)')
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState<{ finalText: string; toolCalls: ToolCall[]; totalTokens: any } | null>(null)
  const [error, setError] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  const loadProposals = async () => {
    setProposalsLoading(true)
    try {
      const res = await fetch('/api/admin/proposals?status=pending')
      const json = await res.json()
      if (json.success) setProposals(json.data)
    } catch {}
    finally { setProposalsLoading(false) }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/macro-adjustment-log?clientId=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4')
      const json = await res.json()
      if (json.success) setHistory(json.data)
    } catch {}
    finally { setHistoryLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'pending') loadProposals()
    else loadHistory()
  }, [activeTab])

  const runAgent = async () => {
    if (!userMessage.trim()) return
    setRunning(true); setError(''); setResponse(null)
    try {
      const res = await fetch('/api/admin/agent-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, contextHint }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'failed')
      setResponse(json)
      loadProposals()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  const actOnProposal = async (id: string, action: 'approve' | 'reject' | 'discuss') => {
    try {
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id, action, review_note: reviewNote || null }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'failed')
      setReviewNote('')
      loadProposals()
    } catch (err: any) {
      alert('失敗: ' + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Agent Playground</h1>
            <p className="text-sm text-gray-500">Phase 1 MVP — 測試 AI Agent tool use + propose flow</p>
          </div>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">← 返回後台</Link>
        </div>

        {/* Input */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Context Hint（會 prepend 到 user message 前）</label>
          <input
            type="text"
            value={contextHint}
            onChange={(e) => setContextHint(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3 text-sm"
          />
          <label className="block text-xs font-semibold text-gray-600 mb-1">學員 / 教練講的話（測試輸入）</label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            rows={4}
            placeholder="範例：我這週體重沒掉，是不是要再砍一點？"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400">
              試試：「我膝蓋有點痛 cardio 還要做嗎」、「我這週吃比較多但體重沒升」、「我下週出國 3 天不能準備餐」
            </div>
            <button
              onClick={runAgent}
              disabled={running || !userMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? '思考中…（10-30 秒）' : 'Run Agent'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3">AI 回應</h2>
            <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap mb-4 leading-relaxed">{response.finalText}</div>

            {response.toolCalls.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">Tool Calls ({response.toolCalls.length})</h3>
                <div className="space-y-2">
                  {response.toolCalls.map((tc, i) => (
                    <details key={i} className="bg-gray-50 rounded-lg p-2">
                      <summary className="text-xs cursor-pointer font-mono">
                        {i + 1}. <span className="text-blue-600">{tc.name}</span>
                      </summary>
                      <div className="mt-2 text-xs">
                        <div className="text-gray-500 mb-1">input:</div>
                        <pre className="bg-white p-2 rounded text-[11px] overflow-auto">{JSON.stringify(tc.input, null, 2)}</pre>
                        <div className="text-gray-500 mt-2 mb-1">result:</div>
                        <pre className="bg-white p-2 rounded text-[11px] overflow-auto max-h-60">{JSON.stringify(tc.result, null, 2)}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}
            <p className="text-[11px] text-gray-400 mt-3">tokens: in {response.totalTokens.input} / out {response.totalTokens.output}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-1 mb-4 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'pending' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Pending ({proposals.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'history' ? 'bg-emerald-100 text-emerald-800' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              歷史調整 ({history.length})
            </button>
            <div className="ml-auto">
              <button onClick={activeTab === 'pending' ? loadProposals : loadHistory} className="text-xs text-blue-600 hover:underline">↻ 重新整理</button>
            </div>
          </div>

        {activeTab === 'pending' && (proposalsLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">載入中…</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">沒有 pending 提案</p>
          ) : (
            <div className="space-y-3">
              {proposals.map(p => {
                const isNote = p.proposal_type === 'personal_note'
                const ch: any = p.proposed_changes ?? {}
                return (
                <div key={p.id} className={`border rounded-xl p-4 ${isNote ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${isNote ? 'text-slate-700' : 'text-amber-800'}`}>
                      {p.clients?.name ?? p.client_id} · {isNote ? '個人筆記提案' : 'macros 調整提案'} · by {p.proposed_by}
                    </span>
                    <span className="text-[11px] text-gray-500">{new Date(p.proposed_at).toLocaleString('zh-TW')}</span>
                  </div>

                  {isNote ? (
                    <div className="bg-white rounded p-3 mb-3 text-sm">
                      <div className="flex items-center gap-2 text-xs mb-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{ch.category}</span>
                        <span className="text-gray-500">weight: {ch.weight}/10</span>
                        {ch.relevant_until && <span className="text-gray-500">有效到: {ch.relevant_until}</span>}
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{ch.note}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">目前</p>
                        <pre className="bg-white p-2 rounded text-[11px]">{JSON.stringify(p.current_state, null, 2)}</pre>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">提議</p>
                        <pre className="bg-white p-2 rounded text-[11px]">{JSON.stringify(p.proposed_changes, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  <p className="text-xs font-semibold text-gray-700 mb-1">理由</p>
                  <p className="text-xs text-gray-700 mb-3 whitespace-pre-wrap bg-white p-2 rounded">{p.reasoning}</p>

                  {p.safety_check_result?.warnings?.length > 0 && (
                    <div className="bg-amber-100 rounded p-2 mb-3 text-xs text-amber-800">
                      {p.safety_check_result.warnings.join('; ')}
                    </div>
                  )}

                  <input
                    type="text"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="教練註記（選填）..."
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => actOnProposal(p.id, 'approve')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700">核准套用</button>
                    <button onClick={() => actOnProposal(p.id, 'reject')} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700">拒絕</button>
                    <button onClick={() => actOnProposal(p.id, 'discuss')} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700">再聊</button>
                  </div>
                </div>
              )})}
            </div>
          ))}

          {activeTab === 'history' && (historyLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">載入中…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">尚無歷史紀錄</p>
          ) : (
            <div className="space-y-3">
              {history.map((h: any) => {
                const isAi = (h.reason || '').includes('AI 提案')
                return (
                  <div key={h.id} className={`border rounded-xl p-4 ${isAi ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold ${isAi ? 'text-blue-800' : 'text-gray-800'}`}>
                        {isAi ? 'AI 提案 → 教練核准' : '教練手動'}
                        {' · '}
                        {h.applied_by} · {h.trigger_source}
                      </span>
                      <span className="text-[11px] text-gray-500">{new Date(h.applied_at).toLocaleString('zh-TW')}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">舊值</p>
                        <pre className="bg-white p-2 rounded text-[11px] max-h-32 overflow-auto">{JSON.stringify(h.old_macros, null, 2)}</pre>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">新值</p>
                        <pre className="bg-white p-2 rounded text-[11px] max-h-32 overflow-auto">{JSON.stringify(h.new_macros, null, 2)}</pre>
                      </div>
                    </div>

                    {h.reason && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 font-semibold">查看完整理由</summary>
                        <p className="mt-1 whitespace-pre-wrap bg-white p-2 rounded">{h.reason}</p>
                      </details>
                    )}

                    {h.hit_boundary && (
                      <div className="bg-rose-100 rounded p-2 mt-2 text-xs text-rose-800">
                        撞邊界：{h.boundary_detail}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
