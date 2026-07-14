'use client'

import { useState } from 'react'
import { Calendar, ChevronRight, Trophy, AlertTriangle } from 'lucide-react'

/**
 * 賽後恢復卡 — Recovery Diet，不是 reverse diet。
 *
 * ⚠️ 2026-07-15 重寫。舊版寫死了三段週表，內容跟證據相反：
 *   - 「每天增加 100-200 kcal（reverse diet）」→ 慢速爬升沒有實證支持，且可能拖長恢復
 *     （Lima 2022 scoping review, PMID 35966021）
 *   - 「只做散步和伸展，不做重訓」→ 直接寫反了。持續阻力訓練是搶回瘦體重的必要條件
 *   - 「第 2 週回到維持熱量的 80%」→ 第 1 週就該回到 100% 維持
 *
 * 現在的數字全部來自 lib/recovery-diet.ts 引擎，不在這裡硬編。
 */

interface PostCompetitionRecoveryProps {
  daysPostCompetition: number
  onSetNextCompetition: () => void
  /** 引擎算出的恢復期建議（來自 nutrition-suggestions） */
  recovery?: {
    phaseLabel: string
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
    maintenanceCalories: number | null
    regainRatePctPerWeek: number | null
    eaBreached: boolean
  } | null
}

export default function PostCompetitionRecovery({
  daysPostCompetition,
  onSetNextCompetition,
  recovery,
}: PostCompetitionRecoveryProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [nextCompDate, setNextCompDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentWeek = Math.ceil(Math.max(daysPostCompetition, 1) / 7)

  // 恢復期的三件事 —— 全部有證據，順序就是優先序
  const principles: { title: string; detail: string }[] = [
    {
      title: '熱量直接回到維持量，不要慢慢加',
      detail:
        '恢復是靠體重和能量回升帶動的，不是靠「加熱量的速度慢」。每週小幅爬升只會把身體留在半飢餓狀態更久。',
    },
    {
      title: '重訓不要停',
      detail:
        '這跟直覺相反，但賽後停練是掉肌肉最快的方式。繼續照課表練（強度可以降，但不要停），這是把瘦體重搶回來的必要條件。有氧則是慢慢減，不用一次砍光。',
    },
    {
      title: '體重會上升，那是機制不是失敗',
      detail:
        '肝醣、水分、腸道內容物會先回填，之後才是體脂。體重回升得太少，反而代表代謝和荷爾蒙恢復得最差。看到數字往上不要慌，繼續量。',
    },
  ]

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Trophy size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">賽後恢復</h2>
          <p className="text-xs text-gray-500">
            比賽後第 <span className="tabular-nums">{daysPostCompetition}</span> 天
            {recovery?.phaseLabel ? ` · ${recovery.phaseLabel}` : currentWeek <= 4 ? ` · 第 ${currentWeek} 週` : ''}
          </p>
        </div>
      </div>

      {/* 引擎算出的今日目標 */}
      {recovery?.calories != null && (
        <div className="mb-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs text-gray-500">今天的目標</span>
            {recovery.maintenanceCalories != null && (
              <span className="text-[11px] text-gray-400">
                維持量估計 <span className="tabular-nums">{recovery.maintenanceCalories}</span> kcal
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: '熱量', value: recovery.calories, unit: 'kcal' },
              { label: '蛋白', value: recovery.protein, unit: 'g' },
              { label: '碳水', value: recovery.carbs, unit: 'g' },
              { label: '脂肪', value: recovery.fat, unit: 'g' },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{m.value ?? '—'}</p>
                <p className="text-[11px] text-gray-400">
                  {m.label}
                  <span className="ml-0.5">{m.unit}</span>
                </p>
              </div>
            ))}
          </div>
          {recovery.regainRatePctPerWeek != null && (
            <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-gray-500">
              目前體重回增速率{' '}
              <span className="tabular-nums font-semibold text-gray-700">
                {recovery.regainRatePctPerWeek > 0 ? '+' : ''}
                {recovery.regainRatePctPerWeek}%
              </span>{' '}
              / 週（目標 0.5–1.0%）
            </p>
          )}
        </div>
      )}

      {/* EA 警告 —— 最高優先的煞車 */}
      {recovery?.eaBreached && (
        <div className="mb-5 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-rose-700">
            你的能量可用性低於安全底線。系統已經把熱量往上調——這條優先於任何體脂目標，先吃夠再說。
          </p>
        </div>
      )}

      {/* 恢復期原則 */}
      <div className="space-y-3">
        {principles.map((p, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[11px] font-semibold text-gray-500 tabular-nums">{idx + 1}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{p.title}</p>
                <p className="text-xs leading-relaxed text-gray-600">{p.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      {!showDatePicker && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowDatePicker(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-primary-100 transition-colors"
          >
            <Calendar size={14} />
            設定下一場比賽
          </button>
          <button
            onClick={onSetNextCompetition}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            切換到增肌/減脂
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Inline date picker */}
      {showDatePicker && (
        <div className="mt-4 bg-primary-50 border border-primary-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">設定下一場比賽日期</p>
          <input
            type="date"
            value={nextCompDate}
            onChange={(e) => setNextCompDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-500 transition-colors mb-3"
          />
          {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!nextCompDate) {
                  setError('請選擇日期')
                  return
                }
                setSaving(true)
                setError('')
                try {
                  window.dispatchEvent(
                    new CustomEvent('set-next-competition', { detail: { date: nextCompDate } })
                  )
                  setShowDatePicker(false)
                  setNextCompDate('')
                } catch {
                  setError('設定失敗，請重試')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving || !nextCompDate}
              className="flex-1 bg-primary-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? '儲存中...' : '確認'}
            </button>
            <button
              onClick={() => {
                setShowDatePicker(false)
                setNextCompDate('')
                setError('')
              }}
              className="px-4 bg-white border border-slate-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
