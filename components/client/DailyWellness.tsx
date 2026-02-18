'use client'

import { useState, useEffect } from 'react'

interface DailyWellnessProps {
  todayWellness: any
  clientId: string
  date?: string
  onMutate: () => void
}

const SLEEP_OPTIONS = [
  { score: 1, emoji: '😩', label: '很差' },
  { score: 2, emoji: '😪', label: '不好' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '😌', label: '不錯' },
  { score: 5, emoji: '😴', label: '很好' },
]

const ENERGY_OPTIONS = [
  { score: 1, emoji: '🪫', label: '沒電' },
  { score: 2, emoji: '😓', label: '疲憊' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '⚡', label: '充沛' },
  { score: 5, emoji: '🔥', label: '滿滿' },
]

const MOOD_OPTIONS = [
  { score: 1, emoji: '😫', label: '很差' },
  { score: 2, emoji: '😔', label: '不好' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '😊', label: '不錯' },
  { score: 5, emoji: '😄', label: '很好' },
]

export default function DailyWellness({ todayWellness, clientId, date, onMutate }: DailyWellnessProps) {
  const today = date || new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    sleep_quality: todayWellness?.sleep_quality ?? null as number | null,
    energy_level: todayWellness?.energy_level ?? null as number | null,
    mood: todayWellness?.mood ?? null as number | null,
    note: todayWellness?.note || ''
  })

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
    } catch {
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  const fields = [
    { key: 'sleep_quality' as const, label: '睡眠品質', options: SLEEP_OPTIONS },
    { key: 'energy_level' as const, label: '精力水平', options: ENERGY_OPTIONS },
    { key: 'mood' as const, label: '今日心情', options: MOOD_OPTIONS },
  ]

  const allFilled = form.sleep_quality && form.energy_level && form.mood

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">每日感受</h2>
        {todayWellness && (
          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">已記錄</span>
        )}
      </div>

      <div className="space-y-5">
        {fields.map(({ key, label, options }) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
            <div className="flex gap-2">
              {options.map(({ score, emoji, label: optLabel }) => {
                const selected = form[key] === score
                return (
                  <button
                    key={score}
                    onClick={() => setForm(prev => ({ ...prev, [key]: selected ? null : score }))}
                    className={`flex-1 flex flex-col items-center py-2.5 rounded-xl text-center transition-all ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm scale-105'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xl leading-none mb-1">{emoji}</span>
                    <span className={`text-[10px] font-medium ${selected ? 'text-blue-100' : 'text-gray-400'}`}>{optLabel}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">備註 <span className="text-gray-400 font-normal">（選填）</span></p>
          <textarea
            value={form.note}
            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50 text-sm"
            rows={2}
            placeholder="今天特別的感受？"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !allFilled}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
        >
          {submitting ? '儲存中...' : todayWellness ? '更新感受' : '記錄感受'}
        </button>
      </div>
    </div>
  )
}
