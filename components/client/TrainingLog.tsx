'use client'

import { useState, useEffect, useMemo } from 'react'
import { TRAINING_TYPES } from './types'

interface TrainingLogProps {
  todayTraining: any
  trainingLogs: any[]
  clientId: string
  onMutate: () => void
}

export default function TrainingLog({ todayTraining, trainingLogs, clientId, onMutate }: TrainingLogProps) {
  const today = new Date().toISOString().split('T')[0]
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    training_type: todayTraining?.training_type ?? null as string | null,
    duration: todayTraining?.duration ?? null as number | null,
    rpe: todayTraining?.rpe ?? null as number | null,
    note: todayTraining?.note || ''
  })

  useEffect(() => {
    if (todayTraining) {
      setForm({
        training_type: todayTraining.training_type ?? null,
        duration: todayTraining.duration ?? null,
        rpe: todayTraining.rpe ?? null,
        note: todayTraining.note || '',
      })
    }
  }, [todayTraining])

  const isRest = form.training_type === 'rest'

  const handleSubmit = async () => {
    if (!form.training_type) {
      alert('請選擇訓練類型')
      return
    }
    if (!isRest && (!form.duration || form.duration <= 0)) {
      alert('請填寫訓練時長')
      return
    }
    if (!isRest && !form.rpe) {
      alert('請選擇 RPE')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/training-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: today,
          training_type: form.training_type,
          duration: isRest ? null : form.duration,
          rpe: isRest ? null : form.rpe,
          note: form.note || null
        })
      })
      if (!response.ok) throw new Error('提交失敗')
      onMutate()
      alert('訓練紀錄已記錄！')
    } catch {
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  // 本週摘要（週一到週日）
  const weeklySummary = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)
    const mondayStr = monday.toISOString().split('T')[0]

    const weekLogs = (trainingLogs || []).filter((l: any) => l.date >= mondayStr && l.date <= today)

    // 建立一週七天的對應
    const days: { date: string; label: string; log: any }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayLabels = ['一', '二', '三', '四', '五', '六', '日']
      days.push({
        date: dateStr,
        label: dayLabels[i],
        log: weekLogs.find((l: any) => l.date === dateStr) || null
      })
    }

    const activeLogs = weekLogs.filter((l: any) => l.training_type !== 'rest')
    const trainingDays = activeLogs.length
    const totalDuration = activeLogs.reduce((sum: number, l: any) => sum + (l.duration || 0), 0)
    const avgRpe = activeLogs.length > 0
      ? (activeLogs.reduce((sum: number, l: any) => sum + (l.rpe || 0), 0) / activeLogs.length).toFixed(1)
      : '--'

    return { days, trainingDays, totalDuration, avgRpe }
  }, [trainingLogs, today])

  const getTypeEmoji = (type: string) => {
    return TRAINING_TYPES.find(t => t.value === type)?.emoji || ''
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">訓練紀錄</h2>
      <div className="space-y-4">
        {/* 訓練類型 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">訓練類型</p>
          <div className="grid grid-cols-3 gap-2">
            {TRAINING_TYPES.map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setForm(prev => ({ ...prev, training_type: value }))}
                className={`min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                  form.training_type === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* 時長（休息時隱藏） */}
        {!isRest && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">⏱️ 訓練時長（分鐘）</p>
            <input
              type="number"
              inputMode="numeric"
              value={form.duration ?? ''}
              onChange={(e) => setForm(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如 60"
              min={1}
            />
          </div>
        )}

        {/* RPE（休息時隱藏） */}
        {!isRest && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">💥 RPE（自覺強度 1-10）</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    onClick={() => setForm(prev => ({ ...prev, rpe: score }))}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                      form.rpe === score
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {[6, 7, 8, 9, 10].map(score => (
                  <button
                    key={score}
                    onClick={() => setForm(prev => ({ ...prev, rpe: score }))}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium transition-all ${
                      form.rpe === score
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 備註 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">備註</p>
          <textarea
            value={form.note}
            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder={isRest ? '今天好好休息！' : '訓練內容、感受...'}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? '提交中...' : todayTraining ? '更新訓練' : '記錄訓練'}
        </button>

        {/* 本週摘要 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">本週訓練</p>
          <div className="flex gap-1 mb-3">
            {weeklySummary.days.map(({ date, label, log }) => (
              <div
                key={date}
                className={`flex-1 text-center py-2 rounded-lg text-xs ${
                  date === today
                    ? 'ring-2 ring-blue-400'
                    : ''
                } ${
                  log
                    ? log.training_type === 'rest'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-blue-50 text-blue-700'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className="text-base mt-0.5">{log ? getTypeEmoji(log.training_type) : '·'}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>🏋️ 訓練 {weeklySummary.trainingDays} 天</span>
            <span>⏱️ {weeklySummary.totalDuration} 分鐘</span>
            <span>💥 RPE {weeklySummary.avgRpe}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
