'use client'

interface QuickActionsProps {
  enabledSections: { id: string; icon: string; label: string; completed: boolean }[]
  onNavigate: (sectionId: string) => void
  topSummary?: {
    weight?: string | number | null
    daysLeft?: number | null
    todayCarbs?: number | null
    isTrainingDay?: boolean
    streak?: number | null
  }
}

export default function QuickActions({ enabledSections, onNavigate, topSummary }: QuickActionsProps) {
  if (enabledSections.length === 0) return null

  const completedCount = enabledSections.filter(s => s.completed).length
  const allDone = completedCount === enabledSections.length

  return (
    <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
      {/* 一行摘要 */}
      {topSummary && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {topSummary.weight && <span className="font-bold">{topSummary.weight}kg</span>}
            {topSummary.daysLeft != null && topSummary.daysLeft > 0 && (
              <span className="text-gray-400">· 🏆 {topSummary.daysLeft}天</span>
            )}
            {topSummary.todayCarbs != null && (
              <span className="text-gray-400">· 🍚 {topSummary.todayCarbs}g（{topSummary.isTrainingDay ? '訓練' : '休息'}）</span>
            )}
          </div>
          {topSummary.streak != null && topSummary.streak >= 3 && (
            <span className="text-xs font-bold text-orange-500">🔥 {topSummary.streak}天</span>
          )}
        </div>
      )}

      {/* 進度條 */}
      <div className="flex gap-1 mb-3">
        {enabledSections.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s.completed ? 'bg-green-400' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* 按鈕列 */}
      <div className="flex gap-1.5">
        {enabledSections.map(s => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className={`flex-1 flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all ${
              s.completed
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <span className="text-base mb-0.5">{s.completed ? '✅' : s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-xs text-green-600 font-medium mt-2">今天全部完成 💪</p>
      )}
    </div>
  )
}
