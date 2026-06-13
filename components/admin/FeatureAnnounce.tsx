'use client'

import { useState } from 'react'

/**
 * 功能公告廣播：教練打標題＋一句話＋連結 → Web Push 給所有開了推播的學員。
 * 後端 /api/push/send（admin 限定、不傳 clientId = 發給全部訂閱者）。
 * 注意：url 必須是相對路徑（sw.js 只允許同源），預設 /dashboard。
 */
export default function FeatureAnnounce() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/dashboard')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const send = async () => {
    if (!title.trim() || !body.trim()) { setResult('⚠️ 標題和內容都要填'); return }
    if (!window.confirm(`確定發送這則公告推播給所有開了推播的學員？\n\n${title}\n${body}`)) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setResult(`❌ ${data.error || '發送失敗'}`); return }
      setResult(`✅ 已送達 ${data.sent}/${data.total} 位訂閱者${data.expired ? `（清掉 ${data.expired} 個失效訂閱）` : ''}`)
      if (data.sent > 0) { setTitle(''); setBody('') }
    } catch {
      setResult('❌ 發送失敗，請稍後再試')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-base font-semibold text-gray-900">📢 發布功能公告（推播給學員）</span>
        <span className="text-gray-400 text-sm">{open ? '收合 ▴' : '展開 ▾'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">標題</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="例：新功能上線 🎉"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">內容（一句話）</label>
            <input
              type="text" value={body} onChange={e => setBody(e.target.value)}
              placeholder="例：現在可以在儀表板看完整健康報告了"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">點擊導向（相對路徑）</label>
            <input
              type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="/dashboard"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">只能用同源相對路徑（如 /dashboard），外部網址會被導回首頁。</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={send} disabled={sending}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {sending ? '發送中…' : '發送公告推播'}
            </button>
            {result && <span className="text-xs text-gray-600">{result}</span>}
          </div>
          <p className="text-[11px] text-amber-600">
            目前只送達「已開啟推播」的學員（多數還沒開），LINE 不受影響。推播開通率上來後這則才會觸及更多人。
          </p>
        </div>
      )}
    </div>
  )
}
