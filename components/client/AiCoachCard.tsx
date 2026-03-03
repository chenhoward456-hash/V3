'use client'

import { useState } from 'react'

interface AiCoachCardProps {
  clientId: string
}

export default function AiCoachCard({ clientId }: AiCoachCardProps) {
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAdvice = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '無法取得建議')
      }
      const data = await res.json()
      setAdvice(data.advice)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h2 className="text-lg font-bold text-gray-900">AI 教練建議</h2>
        </div>
        {advice && (
          <button
            onClick={fetchAdvice}
            disabled={loading}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            重新生成
          </button>
        )}
      </div>

      {!advice && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">
            根據你的近期數據，AI 教練會給你個人化的本週建議
          </p>
          <button
            onClick={fetchAdvice}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            取得本週建議
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">AI 教練分析中...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
          <button onClick={fetchAdvice} className="ml-2 underline">重試</button>
        </div>
      )}

      {advice && !loading && (
        <div className="bg-blue-50 rounded-xl px-4 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {advice}
        </div>
      )}
    </div>
  )
}
