'use client'

import { useState } from 'react'
import { Check, Calendar, ChevronRight, Trophy } from 'lucide-react'

interface PostCompetitionRecoveryProps {
  daysPostCompetition: number
  onSetNextCompetition: () => void
}

interface WeekPhase {
  weekLabel: string
  dayRange: string
  items: string[]
  isCurrent: boolean
  isCompleted: boolean
}

export default function PostCompetitionRecovery({
  daysPostCompetition,
  onSetNextCompetition,
}: PostCompetitionRecoveryProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [nextCompDate, setNextCompDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentWeek = Math.ceil(Math.max(daysPostCompetition, 1) / 7)

  const phases: WeekPhase[] = [
    {
      weekLabel: '第 1 週',
      dayRange: '第 1-7 天',
      items: [
        '每天增加 100-200 kcal（reverse diet）',
        '只做散步和伸展，不做重訓',
        '多睡，目標 8-9 小時',
        '心理：允許自己放鬆，不要急著看體重',
      ],
      isCurrent: currentWeek === 1,
      isCompleted: currentWeek > 1,
    },
    {
      weekLabel: '第 2 週',
      dayRange: '第 8-14 天',
      items: [
        '繼續增加熱量，目標回到維持熱量的 80%',
        '可開始輕量重訓（RPE 5-6，組數砍半）',
        '開始補回水分和鈉攝取',
      ],
      isCurrent: currentWeek === 2,
      isCompleted: currentWeek > 2,
    },
    {
      weekLabel: '第 3-4 週',
      dayRange: '第 15-28 天',
      items: [
        '熱量回到維持水平',
        '訓練量漸進恢復到 70-80%',
        '體重會上升 2-4kg，這是正常的（糖原+水分回填）',
      ],
      isCurrent: currentWeek >= 3 && currentWeek <= 4,
      isCompleted: currentWeek > 4,
    },
  ]

  const isRecoveryComplete = daysPostCompetition > 28

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Trophy size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">
            賽後恢復計畫
          </h2>
          <p className="text-xs text-gray-500">
            比賽後第 {daysPostCompetition} 天
            {currentWeek <= 4 && ` · 第 ${currentWeek} 週`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400">恢復進度</span>
          <span className="text-[10px] text-gray-400">
            {Math.min(daysPostCompetition, 28)} / 28 天
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((daysPostCompetition / 28) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {phases.map((phase, idx) => (
          <div
            key={idx}
            className={`rounded-2xl border-2 p-4 transition-all ${
              phase.isCurrent
                ? 'border-emerald-300 bg-emerald-50'
                : phase.isCompleted
                ? 'border-gray-100 bg-gray-50'
                : 'border-gray-100 bg-white'
            }`}
          >
            {/* Phase header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {phase.isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                ) : phase.isCurrent ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-[10px] text-gray-500">{idx + 1}</span>
                  </div>
                )}
                <span className={`text-sm font-semibold ${
                  phase.isCurrent ? 'text-emerald-700' : phase.isCompleted ? 'text-gray-500' : 'text-gray-600'
                }`}>
                  {phase.weekLabel}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">{phase.dayRange}</span>
            </div>

            {/* Items */}
            <div className="space-y-1.5 ml-8">
              {phase.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  {phase.isCompleted ? (
                    <Check size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <span className={`text-xs mt-0.5 shrink-0 ${
                      phase.isCurrent ? 'text-emerald-500' : 'text-gray-300'
                    }`}>
                      {phase.isCurrent ? '→' : '·'}
                    </span>
                  )}
                  <p className={`text-xs leading-relaxed ${
                    phase.isCompleted ? 'text-gray-400 line-through' : phase.isCurrent ? 'text-gray-700' : 'text-gray-500'
                  }`}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recovery complete / Next steps */}
      {isRecoveryComplete && (
        <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎉</span>
            <p className="text-sm font-bold text-gray-800">恢復期結束，準備下一階段</p>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            你的身體已經回到穩定狀態，可以開始規劃下一場比賽或切換到增肌/減脂目標。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex items-center justify-center gap-1.5 bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Calendar size={14} />
              設定下一場比賽日期
            </button>
            <button
              onClick={onSetNextCompetition}
              className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              切換到增肌/減脂
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Inline date picker for setting next competition */}
      {showDatePicker && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">設定下一場比賽日期</p>
          <input
            type="date"
            value={nextCompDate}
            onChange={(e) => setNextCompDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors mb-3"
          />
          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!nextCompDate) {
                  setError('請選擇日期')
                  return
                }
                setSaving(true)
                setError('')
                try {
                  // Dispatch custom event with the selected date
                  // The parent component handles the actual API call
                  window.dispatchEvent(new CustomEvent('set-next-competition', {
                    detail: { date: nextCompDate },
                  }))
                  setShowDatePicker(false)
                  setNextCompDate('')
                } catch {
                  setError('設定失敗，請重試')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving || !nextCompDate}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? '儲存中...' : '確認'}
            </button>
            <button
              onClick={() => { setShowDatePicker(false); setNextCompDate(''); setError('') }}
              className="px-4 bg-white border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Encouragement note */}
      {!isRecoveryComplete && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            💡 賽後恢復是下一場比賽的起點。體重上升是正常的（糖原 + 水分回填），不要急著限制飲食。
            系統會幫你追蹤恢復進度，確保身體準備好迎接下一個目標。
          </p>
        </div>
      )}
    </div>
  )
}
