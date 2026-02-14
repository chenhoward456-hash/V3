'use client'

import { useState, useEffect } from 'react'

interface DailyWellnessProps {
  todayWellness: any
  clientId: string
  date?: string
  onMutate: () => void
}

export default function DailyWellness({ todayWellness, clientId, date, onMutate }: DailyWellnessProps) {
  const today = date || new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    sleep_quality: todayWellness?.sleep_quality ?? null as number | null,
    energy_level: todayWellness?.energy_level ?? null as number | null,
    mood: todayWellness?.mood ?? null as number | null,
    note: todayWellness?.note || ''
  })

  // 當 todayWellness 資料載入後同步表單
  useEffect(() => {
    if (todayWellness) {
      setForm({
        sleep_quality: todayWellness.sleep_quality ?? null,
        energy_level: todayWellness.energy_level ?? null,
        mood: todayWellness.mood ?? null,
        note: todayWellness.note || '',
      })
    }
  }, [todayWellness])

  const handleSubmit = async () => {
    if (!form.sleep_quality && !form.energy_level && !form.mood) {
      alert('請至少填寫一項評分')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/daily-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today,
          sleep_quality: form.sleep_quality,
          energy_level: form.energy_level,
          mood: form.mood,
          note: form.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      onMutate()
      alert('今日感受已記錄！')
    } catch {
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">每日感受</h2>
      <div className="space-y-4">
        {[
          { key: 'sleep_quality' as const, label: '睡眠品質', emoji: '😴' },
          { key: 'energy_level' as const, label: '精力水平', emoji: '⚡' },
          { key: 'mood' as const, label: '心情', emoji: '😊' },
        ].map(({ key, label, emoji }) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-700 mb-2">{emoji} {label}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  onClick={() => setForm(prev => ({ ...prev, [key]: score }))}
                  className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                    form[key] === score
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">今日感受記錄</p>
          <textarea
            value={form.note}
            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="今天感覺如何？"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? '提交中...' : todayWellness ? '更新感受' : '記錄感受'}
        </button>
      </div>
    </div>
  )
}
