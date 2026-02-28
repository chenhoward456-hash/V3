'use client'

import { useState, useEffect } from 'react'

interface DailyWellnessProps {
  todayWellness: any
  clientId: string
  date?: string
  competitionEnabled?: boolean
  healthModeEnabled?: boolean
  gender?: string
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

export default function DailyWellness({ todayWellness, clientId, date, competitionEnabled, healthModeEnabled, gender, onMutate }: DailyWellnessProps) {
  const today = date || new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showMore, setShowMore] = useState(false) // 展開更多指標
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
  const isFemale = gender === '女性' || gender === 'female'

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
      // 如果已經有填寫過額外指標，預設展開
      if (todayWellness.hunger || todayWellness.digestion || todayWellness.training_drive || todayWellness.cognitive_clarity || todayWellness.stress_level) {
        setShowMore(true)
      }
    }
  }, [todayWellness])

  const handleSubmit = async () => {
    if (!form.sleep_quality || !form.energy_level || !form.mood) {
      alert('請填寫睡眠、精力、心情三項必填指標')
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

  // 核心三項（所有模式必填）
  const coreFields: { key: 'sleep_quality' | 'energy_level' | 'mood'; label: string; options: { score: number; emoji: string; label: string }[] }[] = [
    { key: 'sleep_quality',    label: '😴 睡眠品質',   options: SLEEP_OPTIONS },
    { key: 'energy_level',     label: '⚡ 精力水平',   options: ENERGY_OPTIONS },
    { key: 'mood',             label: '😊 今日心情',   options: MOOD_OPTIONS },
  ]

  // 進階指標（根據模式顯示）
  const extraFields: { key: 'hunger' | 'digestion' | 'training_drive' | 'cognitive_clarity' | 'stress_level'; label: string; options: { score: number; emoji: string; label: string }[]; groupLabel?: string }[] = []

  if (healthModeEnabled) {
    extraFields.push(
      { key: 'cognitive_clarity', label: '🧠 認知清晰度', options: COGNITIVE_OPTIONS, groupLabel: '🌿 健康模式指標' },
      { key: 'stress_level',     label: '😰 壓力指數',   options: STRESS_OPTIONS },
    )
  }
  if (competitionEnabled) {
    extraFields.push(
      { key: 'hunger',          label: '🍽️ 飢餓感',    options: HUNGER_OPTIONS, groupLabel: '🏆 備賽指標' },
      { key: 'digestion',       label: '🫃 消化狀況',   options: DIGESTION_OPTIONS },
      { key: 'training_drive',  label: '💪 訓練慾望',   options: TRAINING_DRIVE_OPTIONS },
    )
  }

  const coreFilled = form.sleep_quality && form.energy_level && form.mood

  // 快速摘要（已填寫的數據）
  const filledSummary = todayWellness ? (() => {
    const items = []
    if (todayWellness.sleep_quality) items.push(SLEEP_OPTIONS[todayWellness.sleep_quality - 1]?.emoji)
    if (todayWellness.energy_level) items.push(ENERGY_OPTIONS[todayWellness.energy_level - 1]?.emoji)
    if (todayWellness.mood) items.push(MOOD_OPTIONS[todayWellness.mood - 1]?.emoji)
    const avg = [todayWellness.sleep_quality, todayWellness.energy_level, todayWellness.mood].filter(Boolean)
    const avgScore = avg.length > 0 ? (avg.reduce((a: number, b: number) => a + b, 0) / avg.length).toFixed(1) : null
    return { emojis: items.join(' '), avgScore }
  })() : null

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
        {todayWellness && filledSummary && (
          <div className="flex items-center gap-2">
            <span className="text-sm">{filledSummary.emojis}</span>
            {filledSummary.avgScore && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                Number(filledSummary.avgScore) >= 4 ? 'bg-green-100 text-green-700' :
                Number(filledSummary.avgScore) >= 3 ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {filledSummary.avgScore}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* 核心三項（必填） */}
        {coreFields.map(({ key, label, options }) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {label} <span className="text-red-400 text-xs">*</span>
            </p>
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

        {/* 進階指標（可展開） */}
        {extraFields.length > 0 && (
          <>
            {!showMore ? (
              <button
                onClick={() => setShowMore(true)}
                className="w-full py-2.5 text-sm text-blue-600 font-medium bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
              >
                📋 填寫更多指標 <span className="text-gray-400 text-xs">（選填，讓分析更精準）</span>
              </button>
            ) : (
              <>
                {extraFields.map(({ key, label, options, groupLabel }, idx) => (
                  <div key={key}>
                    {groupLabel && (idx === 0 || extraFields[idx - 1].groupLabel !== groupLabel) && (
                      <div className="border-t border-gray-100 pt-3 mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">{groupLabel}</p>
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
                <button
                  onClick={() => setShowMore(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  收起更多指標 ▲
                </button>
              </>
            )}
          </>
        )}

        {/* 月經週期標記（女性專用） */}
        {isFemale && (
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
        )}

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
          disabled={submitting || !coreFilled}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
        >
          {submitting ? '儲存中...' : todayWellness ? '更新感受' : '記錄感受'}
        </button>

        {/* 必填提示 */}
        {!coreFilled && (
          <p className="text-xs text-center text-gray-400">
            請填寫 <span className="text-red-400">*</span> 標記的三項必填指標
          </p>
        )}
      </div>
    </div>
  )
}
