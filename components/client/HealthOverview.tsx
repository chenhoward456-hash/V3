'use client'

interface HealthOverviewProps {
  weekRate: number
  monthRate: number
  weekDelta: number | null
  labNormal: number
  labTotal: number
  bodyFat: number | null
  bodyFatTrend: { diff: string; direction: string } | null
  todayMood: number | null
  hasWellness: boolean
  supplementEnabled?: boolean
  labEnabled?: boolean
  bodyCompositionEnabled?: boolean
  wellnessEnabled?: boolean
  competitionEnabled?: boolean
  todayCalories?: number | null
  caloriesTarget?: number | null
}

export default function HealthOverview({
  weekRate, monthRate, weekDelta,
  labNormal, labTotal,
  bodyFat, bodyFatTrend,
  todayMood, hasWellness,
  supplementEnabled = true,
  labEnabled = true,
  bodyCompositionEnabled = true,
  wellnessEnabled = true,
  competitionEnabled = false,
  todayCalories = null,
  caloriesTarget = null,
}: HealthOverviewProps) {
  const cards = []

  if (supplementEnabled) {
    const deltaColor = weekDelta !== null && weekDelta > 0 ? 'text-green-600' : 'text-red-500'
    const barColor = weekRate >= 80 ? 'bg-green-500' : weekRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
    cards.push(
      <div key="supplement" className="bg-blue-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-blue-600">💊 本週服從率</p>
          {weekDelta !== null && weekDelta !== 0 && (
            <span className={`text-xs font-semibold ${deltaColor}`}>
              {weekDelta > 0 ? '↑' : '↓'}{Math.abs(weekDelta)}%
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900 mb-2">{weekRate}<span className="text-lg font-medium text-gray-500">%</span></p>
        <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden mb-1">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${weekRate}%` }} />
        </div>
        <p className="text-xs text-gray-400">本月 {monthRate}%</p>
      </div>
    )
  }

  if (labEnabled) {
    const labRate = labTotal > 0 ? Math.round((labNormal / labTotal) * 100) : 0
    const labColor = labRate >= 80 ? 'text-green-600' : labRate >= 50 ? 'text-yellow-600' : 'text-red-500'
    const barColor = labRate >= 80 ? 'bg-green-500' : labRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
    cards.push(
      <div key="lab" className="bg-green-50 rounded-2xl p-4">
        <p className="text-xs font-medium text-green-600 mb-2">🩸 血檢指標</p>
        <p className={`text-3xl font-bold mb-2 ${labTotal > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
          {labTotal > 0 ? labNormal : '--'}
          <span className="text-lg font-medium text-gray-500">{labTotal > 0 ? `/${labTotal}` : ''}</span>
        </p>
        {labTotal > 0 && (
          <>
            <div className="w-full h-1.5 bg-green-100 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${labRate}%` }} />
            </div>
            <p className="text-xs text-gray-400">正常指標 {labRate}%</p>
          </>
        )}
        {labTotal === 0 && <p className="text-xs text-gray-400">尚無血檢資料</p>}
      </div>
    )
  }

  if (bodyCompositionEnabled) {
    const trendIcon = bodyFatTrend
      ? bodyFatTrend.direction === 'down' ? '↓' : bodyFatTrend.direction === 'up' ? '↑' : '→'
      : null
    const trendColor = bodyFatTrend
      ? bodyFatTrend.direction === 'down' ? 'text-green-600' : bodyFatTrend.direction === 'up' ? 'text-red-500' : 'text-gray-500'
      : ''
    cards.push(
      <div key="body" className="bg-orange-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-orange-600">⚖️ 體脂率</p>
          {bodyFatTrend && (
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trendIcon}{bodyFatTrend.direction !== 'same' ? `${bodyFatTrend.diff}%` : '持平'}
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {bodyFat != null ? bodyFat : '--'}
          <span className="text-lg font-medium text-gray-500">{bodyFat != null ? '%' : ''}</span>
        </p>
        <p className="text-xs text-gray-400">{bodyFat != null ? '最新量測值' : '尚無數據'}</p>
      </div>
    )
  }

  if (caloriesTarget) {
    const pct = todayCalories ? Math.round((todayCalories / caloriesTarget) * 100) : 0
    const calStatus = todayCalories
      ? pct >= 90 && pct <= 110
        ? { label: '熱量合規', color: 'text-green-600', bg: 'bg-green-50' }
        : pct < 80
        ? { label: '熱量偏低', color: 'text-red-500', bg: 'bg-red-50' }
        : pct > 110
        ? { label: '熱量偏高', color: 'text-red-500', bg: 'bg-red-50' }
        : { label: '接近目標', color: 'text-amber-600', bg: 'bg-amber-50' }
      : null
    cards.push(
      <div key="calories" className={`${calStatus?.bg || 'bg-amber-50'} rounded-2xl p-4 text-center`}>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <p className="text-xs text-gray-500">今日熱量</p>
          {calStatus && <span className={`text-[10px] font-medium ${calStatus.color}`}>{calStatus.label}</span>}
        </div>
        <p className={`text-2xl font-bold ${calStatus?.color || 'text-amber-600'}`}>
          {todayCalories ? `${todayCalories}` : '--'}
        </p>
        <p className="text-xs text-gray-400">
          {todayCalories ? `${pct}% of ${caloriesTarget}kcal` : `目標 ${caloriesTarget}kcal`}
        </p>
      </div>
    )
  }

  if (wellnessEnabled) {
    const moodEmojis = ['', '😫', '😔', '😐', '😊', '😄']
    const moodLabels = ['', '很差', '不好', '普通', '不錯', '很好']
    cards.push(
      <div key="wellness" className="bg-purple-50 rounded-2xl p-4">
        <p className="text-xs font-medium text-purple-600 mb-2">😊 今日感受</p>
        <p className="text-3xl mb-2">
          {todayMood ? moodEmojis[todayMood] : <span className="text-gray-400 font-bold">--</span>}
        </p>
        <p className="text-xs text-gray-400">
          {todayMood ? moodLabels[todayMood] : hasWellness ? '已記錄' : '尚未記錄'}
        </p>
      </div>
    )
  }

  if (cards.length === 0) return null

  const gridCols = cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-2' : cards.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'

  return (
    <div className={`grid ${gridCols} gap-3`}>
      {cards}
    </div>
  )
}
