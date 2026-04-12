'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, Loader2 } from 'lucide-react'
import { Supplement } from './types'
import { getLocalDateStr } from '@/lib/date-utils'

interface DailyCheckInProps {
  supplements: Supplement[]
  todayLogs: any[]
  todayStats: { completed: number; total: number; rate: number }
  streakDays: number
  streakMessage: string
  isCoachMode: boolean
  togglingSupplements: Set<string>
  recentLogs: any[]
  selectedDate?: string
  clientId?: string
  onToggleSupplement: (id: string, completed: boolean) => void
  onMarkAllComplete?: () => void
  onManageSupplements: () => void
  onMutate?: () => void
}

const rateColor = (rate: number) => rate >= 80 ? '#22c55e' : rate >= 50 ? '#eab308' : '#ef4444'

const TIMING_OPTIONS = [
  '早餐前', '早餐後', '午餐前', '午餐後',
  '晚餐前', '晚餐後', '睡前', '訓練前', '訓練後',
] as const

export default function DailyCheckIn({
  supplements, todayLogs, todayStats,
  streakDays, streakMessage,
  isCoachMode, togglingSupplements, recentLogs,
  selectedDate, clientId,
  onToggleSupplement, onMarkAllComplete, onManageSupplements, onMutate
}: DailyCheckInProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', dosage: '', timing: '早餐後' })
  const trendData = useMemo(() => {
    const total = supplements.length
    if (!total || !recentLogs?.length) return []
    const now = new Date()
    const result: { date: string; rate: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = getLocalDateStr(d)
      const completed = recentLogs.filter((l: any) => l.date === dateStr && l.completed).length
      result.push({
        date: d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        rate: Math.round((completed / total) * 100),
      })
    }
    return result
  }, [recentLogs, supplements.length])

  const hasEnoughData = useMemo(() => {
    if (!recentLogs?.length) return false
    const dates = new Set(recentLogs.filter((l: any) => l.completed).map((l: any) => l.date))
    return dates.size >= 2
  }, [recentLogs])

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            今日打卡
            <span className="ml-2 text-sm font-normal text-gray-500">{streakMessage}</span>
          </h2>
          <p className="text-sm text-gray-500">
            {selectedDate
              ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCoachMode && (
            <button onClick={onManageSupplements} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
              管理補品
            </button>
          )}
          {streakDays > 0 && (
            <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              連續 {streakDays} 天
            </div>
          )}
        </div>
      </div>

      {supplements.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">
              {todayStats.completed === todayStats.total && todayStats.total > 0
                ? '今日全數完成'
                : `${todayStats.completed}/${todayStats.total} 已完成`}
            </span>
            <span className="text-sm font-medium text-gray-700">{todayStats.rate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                todayStats.completed === todayStats.total && todayStats.total > 0
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${todayStats.rate}%` }}
            />
          </div>
        </div>
      )}

      {/* 全部完成按鈕 */}
      {supplements.length > 0 && todayStats.completed < todayStats.total && onMarkAllComplete && (
        <div className="mb-4">
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate([30, 50, 30])
              onMarkAllComplete()
            }}
            className="w-full py-2.5 bg-green-50 border-2 border-green-200 text-green-700 text-sm font-semibold rounded-2xl hover:bg-green-100 transition-all active:scale-[0.98]"
          >
            ✅ 全部完成
          </button>
        </div>
      )}

      {supplements.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">打卡率趨勢（近 14 天）</h3>
          {hasEnoughData ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} tickLine={false} />
                <Tooltip formatter={(value) => [`${value}%`, '打卡率']} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {trendData.map((entry, index) => (
                    <Cell key={index} fill={rateColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              持續打卡後會顯示趨勢
            </div>
          )}
        </div>
      )}

      {supplements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {supplements.map((supplement) => {
            const log = todayLogs?.find((l: any) => l.supplement_id === supplement.id)
            const isCompleted = log?.completed || false
            const isToggling = togglingSupplements.has(supplement.id)

            return (
              <button
                key={supplement.id}
                role="checkbox"
                aria-checked={isCompleted}
                onClick={() => {
                  if (!isCompleted && navigator.vibrate) {
                    navigator.vibrate(30)
                  }
                  onToggleSupplement(supplement.id, isCompleted)
                }}
                disabled={isToggling}
                className={`flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                  isCompleted
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 active:scale-[0.97]'
                } ${isToggling ? 'opacity-50' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 transition-all ${
                  isCompleted ? 'border-green-500 bg-green-500 animate-check-pop' : 'border-gray-300'
                }`}>
                  {isCompleted && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div className="min-w-0">
                  <p className={`font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                    {supplement.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {supplement.dosage}{supplement.timing ? ` · ${supplement.timing}` : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-400">尚未設定補品清單</p>
          <p className="text-xs text-gray-300 mt-1">你可以自行新增，或由教練設定個人化補品方案</p>
        </div>
      )}

      {/* Client-side Add Supplement */}
      {clientId && (
        <div className="mt-4">
          {!showAddForm ? (
            <button
              onClick={() => { setShowAddForm(true); setAddError(null) }}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center transition-colors"
            >
              <Plus size={16} className="mr-1" /> 新增補品
            </button>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">新增補品</h4>
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null) }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    補品名稱 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例如：魚油"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    maxLength={50}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">劑量</label>
                  <input
                    type="text"
                    value={addForm.dosage}
                    onChange={(e) => setAddForm((p) => ({ ...p, dosage: e.target.value }))}
                    placeholder="例如：1000mg"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    服用時間 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={addForm.timing}
                    onChange={(e) => setAddForm((p) => ({ ...p, timing: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {TIMING_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {addError && (
                <p className="text-xs text-red-500 mt-2">{addError}</p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null) }}
                  className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (!addForm.name.trim()) {
                      setAddError('請輸入補品名稱')
                      return
                    }
                    setAddLoading(true)
                    setAddError(null)
                    try {
                      const res = await fetch('/api/supplements/client', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          clientId,
                          name: addForm.name.trim(),
                          dosage: addForm.dosage.trim(),
                          timing: addForm.timing,
                        }),
                      })
                      const json = await res.json()
                      if (!res.ok) {
                        setAddError(json.error || '新增失敗')
                        return
                      }
                      // Reset form & close
                      setAddForm({ name: '', dosage: '', timing: '早餐後' })
                      setShowAddForm(false)
                      onMutate?.()
                    } catch {
                      setAddError('網路錯誤，請重試')
                    } finally {
                      setAddLoading(false)
                    }
                  }}
                  disabled={addLoading}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {addLoading && <Loader2 size={14} className="animate-spin" />}
                  {addLoading ? '新增中...' : '新增'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
