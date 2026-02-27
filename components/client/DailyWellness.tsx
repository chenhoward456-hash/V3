'use client'

import { useState, useEffect } from 'react'

interface DailyWellnessProps {
  todayWellness: any
  clientId: string
  date?: string
  competitionEnabled?: boolean
  healthModeEnabled?: boolean
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

const HUNGER_OPTIONS = [
  { score: 1, emoji: '🤤', label: '很餓' },
  { score: 2, emoji: '😋', label: '有點餓' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '😌', label: '剛好' },
  { score: 5, emoji: '🫃', label: '很飽' },
]

const DIGESTION_OPTIONS = [
  { score: 1, emoji: '🤢', label: '很差' },
  { score: 2, emoji: '😣', label: '不好' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '😊', label: '不錯' },
  { score: 5, emoji: '💪', label: '很好' },
]

const TRAINING_DRIVE_OPTIONS = [
  { score: 1, emoji: '😩', label: '不想' },
  { score: 2, emoji: '😔', label: '勉強' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '💪', label: '想練' },
  { score: 5, emoji: '🔥', label: '超想' },
]

const COGNITIVE_OPTIONS = [
  { score: 1, emoji: '🌫️', label: '腦霧' },
  { score: 2, emoji: '😵', label: '模糊' },
  { score: 3, emoji: '😐', label: '普通' },
  { score: 4, emoji: '🧠', label: '清晰' },
  { score: 5, emoji: '✨', label: '極清' },
]

const STRESS_OPTIONS = [
  { score: 1, emoji: '😌', label: '很低' },
  { score: 2, emoji: '🙂', label: '輕微' },
  { score: 3, emoji: '😐', label: '中等' },
  { score: 4, emoji: '😰', label: '偏高' },
  { score: 5, emoji: '🤯', label: '極高' },
]

export default function DailyWellness({ todayWellness, clientId, date, competitionEnabled, healthModeEnabled, onMutate }: DailyWellnessProps) {
  const today = date || new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState({
    sleep_quality: todayWellness?.sleep_quality ?? null as number | null,
    energy_level: todayWellness?.energy_level ?? null as number | null,
    mood: todayWellness?.mood ?? null as number | null,
    hunger: todayWellness?.hunger ?? null as number | null,
    digestion: todayWellness?.digestion ?? null as number | null,
    training_drive: todayWellness?.training_drive ?? null as number | null,
    cognitive_clarity: todayWellness?.cognitive_clarity ?? null as number | null,
    stress_level: todayWellness?.stress_level ?? null as number | null,
    period_start: todayWellness?.period_start ?? false as boolean,
    note: todayWellness?.note || ''
  })
  const isFemale = true // 由外部傳入更好，但目前先讓所有人都能標記（男性自然不會按）

  useEffect(() => {
    if (todayWellness) {
      setForm({
        sleep_quality: todayWellness.sleep_quality ?? null,
        energy_level: todayWellness.energy_level ?? null,
        mood: todayWellness.mood ?? null,
        hunger: todayWellness.hunger ?? null,
        digestion: todayWellness.digestion ?? null,
        training_drive: todayWellness.training_drive ?? null,
        cognitive_clarity: todayWellness.cognitive_clarity ?? null,
        stress_level: todayWellness.stress_level ?? null,
        period_start: todayWellness.period_start ?? false,
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
          hunger: form.hunger ?? null,
          digestion: form.digestion ?? null,
          training_drive: form.training_drive ?? null,
          cognitive_clarity: form.cognitive_clarity ?? null,
          stress_level: form.stress_level ?? null,
          period_start: form.period_start || false,
          note: form.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      onMutate()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch {
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  const fields: { key: 'sleep_quality' | 'energy_level' | 'mood' | 'hunger' | 'digestion' | 'training_drive' | 'cognitive_clarity' | 'stress_level'; label: string; options: { score: number; emoji: string; label: string }[]; compOnly: boolean; healthOnly: boolean }[] = [
    { key: 'sleep_quality',    label: '睡眠品質',   options: SLEEP_OPTIONS,          compOnly: false, healthOnly: false },
    { key: 'energy_level',     label: '精力水平',   options: ENERGY_OPTIONS,         compOnly: false, healthOnly: false },
    { key: 'mood',             label: '今日心情',   options: MOOD_OPTIONS,           compOnly: false, healthOnly: false },
    { key: 'cognitive_clarity',label: '認知清晰度', options: COGNITIVE_OPTIONS,      compOnly: false, healthOnly: true  },
    { key: 'stress_level',     label: '壓力指數',   options: STRESS_OPTIONS,         compOnly: false, healthOnly: true  },
    { key: 'hunger',           label: '飢餓感',     options: HUNGER_OPTIONS,         compOnly: true,  healthOnly: false },
    { key: 'digestion',        label: '消化狀況',   options: DIGESTION_OPTIONS,      compOnly: true,  healthOnly: false },
    { key: 'training_drive',   label: '訓練慾望',   options: TRAINING_DRIVE_OPTIONS, compOnly: true,  healthOnly: false },
  ]

  const visibleFields = fields.filter(item => {
    if (item.compOnly && !competitionEnabled) return false
    if (item.healthOnly && !healthModeEnabled) return false
    return true
  })

  const allFilled = form.sleep_quality && form.energy_level && form.mood

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-lg">🎉</span>
          <span className="text-sm font-medium">感受已記錄！</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">每日感受</h2>
        {todayWellness && (
          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">已記錄</span>
        )}
      </div>

      <div className="space-y-5">
        {visibleFields.map(({ key, label, options, compOnly, healthOnly }, idx) => (
          <div key={key}>
            {healthOnly && idx > 0 && !visibleFields[idx - 1].healthOnly && (
              <div className="border-t border-emerald-200 pt-3 mb-3">
                <p className="text-xs font-semibold text-emerald-600 mb-2">🌿 健康模式指標</p>
              </div>
            )}
            {compOnly && idx > 0 && !visibleFields[idx - 1].compOnly && (
              <div className="border-t border-amber-200 pt-3 mb-3">
                <p className="text-xs font-semibold text-amber-600 mb-2">🏆 備賽指標</p>
              </div>
            )}
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

        {/* 月經週期標記（女性專用） */}
        <div className="border-t border-pink-100 pt-3">
          <button
            onClick={() => setForm(prev => ({ ...prev, period_start: !prev.period_start }))}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              form.period_start
                ? 'bg-pink-100 border-2 border-pink-400'
                : 'bg-gray-50 border-2 border-gray-200 hover:bg-pink-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🩸</span>
              <span className={`text-sm font-medium ${form.period_start ? 'text-pink-700' : 'text-gray-600'}`}>
                今天月經來了
              </span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              form.period_start ? 'bg-pink-200 text-pink-700' : 'text-gray-400'
            }`}>
              {form.period_start ? '已標記' : '點擊標記'}
            </span>
          </button>
          <p className="text-[10px] text-gray-400 mt-1 px-1">
            標記經期第一天，系統會自動排除荷爾蒙造成的體重浮動
          </p>
        </div>

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
