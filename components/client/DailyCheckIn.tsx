'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Supplement } from './types'

interface DailyCheckInProps {
  supplements: Supplement[]
  todayLogs: any[]
  todayStats: { completed: number; total: number; rate: number }
  streakDays: number
  streakMessage: string
  isCoachMode: boolean
  togglingSupplements: Set<string>
  recentLogs: any[]
  onToggleSupplement: (id: string, completed: boolean) => void
  onManageSupplements: () => void
}

const rateColor = (rate: number) => rate >= 80 ? '#22c55e' : rate >= 50 ? '#eab308' : '#ef4444'

export default function DailyCheckIn({
  supplements, todayLogs, todayStats,
  streakDays, streakMessage,
  isCoachMode, togglingSupplements, recentLogs,
  onToggleSupplement, onManageSupplements
}: DailyCheckInProps) {
  const trendData = useMemo(() => {
    const total = supplements.length
    if (!total || !recentLogs?.length) return []
    const now = new Date()
    const result: { date: string; rate: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
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
            {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
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
                onClick={() => onToggleSupplement(supplement.id, isCompleted)}
                disabled={isToggling}
                className={`flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                  isCompleted
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                } ${isToggling ? 'opacity-50' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${
                  isCompleted ? 'border-green-500 bg-green-500' : 'border-gray-300'
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
        <p className="text-gray-400 text-center py-4">尚未設定補品清單</p>
      )}
    </div>
  )
}
