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

  const loadProposals = async () => {
    setProposalsLoading(true)
    try {
      const res = await fetch('/api/admin/proposals?status=pending')
      const json = await res.json()
      if (json.success) setProposals(json.data)
    } catch {}
    finally { setProposalsLoading(false) }
  }

  useEffect(() => { loadProposals() }, [])

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
            <h1 className="text-2xl font-bold">🤖 AI Agent Playground</h1>
            <p className="text-sm text-gray-500">Phase 1 MVP — 測試 AI Agent tool use + propose flow</p>
          </div>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">← 返回後台</Link>
        </div>

        {/* Input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Context Hint（會 prepend 到 user message 前）</label>
          <input
            type="text"
            value={contextHint}
            onChange={(e) => setContextHint(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 text-sm"
          />
          <label className="block text-xs font-semibold text-gray-600 mb-1">學員 / 教練講的話（測試輸入）</label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            rows={4}
            placeholder="範例：我這週體重沒掉，是不是要再砍一點？"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400">
              💡 試試：「我膝蓋有點痛 cardio 還要做嗎」、「我這週吃比較多但體重沒升」、「我下週出國 3 天不能準備餐」
            </div>
            <button
              onClick={runAgent}
              disabled={running || !userMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? '🧠 思考中…（10-30 秒）' : '🚀 Run Agent'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3">📝 AI 回應</h2>
            <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap mb-4 leading-relaxed">{response.finalText}</div>

            {response.toolCalls.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">🛠️ Tool Calls ({response.toolCalls.length})</h3>
                <div className="space-y-2">
                  {response.toolCalls.map((tc, i) => (
                    <details key={i} className="bg-gray-50 rounded-lg p-2">
                      <summary className="text-xs cursor-pointer font-mono">
                        {i + 1}. <span className="text-blue-600">{tc.name}</span>
                      </summary>
                      <div className="mt-2 text-xs">
                        <div className="text-gray-500 mb-1">input:</div>
                        <pre className="bg-white p-2 rounded text-[10px] overflow-auto">{JSON.stringify(tc.input, null, 2)}</pre>
                        <div className="text-gray-500 mt-2 mb-1">result:</div>
                        <pre className="bg-white p-2 rounded text-[10px] overflow-auto max-h-60">{JSON.stringify(tc.result, null, 2)}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}
            <p className="text-[10px] text-gray-400 mt-3">tokens: in {response.totalTokens.input} / out {response.totalTokens.output}</p>
          </div>
        )}

        {/* Pending Proposals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">⏳ Pending Proposals ({proposals.length})</h2>
            <button onClick={loadProposals} className="text-xs text-blue-600 hover:underline">↻ 重新整理</button>
          </div>

          {proposalsLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">載入中…</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">沒有 pending 提案</p>
          ) : (
            <div className="space-y-3">
              {proposals.map(p => (
                <div key={p.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-amber-800">
                      {p.clients?.name ?? p.client_id} · {p.proposal_type} · by {p.proposed_by}
                    </span>
                    <span className="text-[10px] text-gray-500">{new Date(p.proposed_at).toLocaleString('zh-TW')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">目前</p>
                      <pre className="bg-white p-2 rounded text-[10px]">{JSON.stringify(p.current_state, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">提議</p>
                      <pre className="bg-white p-2 rounded text-[10px]">{JSON.stringify(p.proposed_changes, null, 2)}</pre>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-gray-700 mb-1">理由</p>
                  <p className="text-xs text-gray-700 mb-3 whitespace-pre-wrap bg-white p-2 rounded">{p.reasoning}</p>

                  {p.safety_check_result?.warnings?.length > 0 && (
                    <div className="bg-amber-100 rounded p-2 mb-3 text-xs text-amber-800">
                      ⚠️ {p.safety_check_result.warnings.join('; ')}
                    </div>
                  )}

                  <input
                    type="text"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="教練註記（選填）..."
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => actOnProposal(p.id, 'approve')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700">✓ 核准套用</button>
                    <button onClick={() => actOnProposal(p.id, 'reject')} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700">✗ 拒絕</button>
                    <button onClick={() => actOnProposal(p.id, 'discuss')} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700">💬 再聊</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
