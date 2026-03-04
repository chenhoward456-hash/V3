'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIAdvisorPage() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, clientId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '回覆失敗')
      }

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `抱歉，發生錯誤：${err.message || '請稍後再試'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="max-w-3xl mx-auto px-4 py-10 md:py-16 flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-block bg-[#2563eb]/10 text-[#2563eb] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          AI 健康顧問
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Howard Protocol AI 助手
        </h1>
        <p className="text-gray-500 text-sm">
          營養規劃 · 訓練建議 · 恢復策略 · 補劑諮詢
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" style={{ minHeight: '300px', maxHeight: '55vh' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-6">有任何健康、營養、訓練相關問題都可以問我</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md">
                {[
                  '根據我這週的數據，今天該怎麼吃？',
                  '我的 TDEE 校正完了，接下來要怎麼調整？',
                  '分析我最近的飲食紀錄，有哪裡可以改善？',
                  '我的訓練日跟休息日，碳水該怎麼分配？',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="text-left text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-[#2563eb] px-4 py-3 rounded-xl transition-colors border border-gray-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 md:p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入你的問題..."
              rows={1}
              className="flex-1 resize-none px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-[#2563eb] text-white p-3 rounded-xl hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            AI 建議僅供參考，不構成醫療診斷。如有健康疑慮，請諮詢專業醫師。
          </p>
        </div>
      </div>
    </section>
  )
}
