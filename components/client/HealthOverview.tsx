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
}: HealthOverviewProps) {
  const cards = []

  if (supplementEnabled) {
    cards.push(
      <div key="supplement" className="bg-blue-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">本週服從率</p>
        <p className="text-2xl font-bold text-blue-600">{weekRate}%</p>
        <div className="text-xs text-gray-400">
          <span>本月 {monthRate}%</span>
          {weekDelta !== null && weekDelta !== 0 && (
            <span className={`ml-1 ${weekDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {weekDelta > 0 ? '↑' : '↓'}{Math.abs(weekDelta)}%
            </span>
          )}
        </div>
      </div>
    )
  }

  if (labEnabled) {
    cards.push(
      <div key="lab" className="bg-green-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">血檢正常</p>
        <p className="text-2xl font-bold text-green-600">{labNormal}/{labTotal}</p>
        <p className="text-xs text-gray-400">指標正常</p>
      </div>
    )
  }

  if (bodyCompositionEnabled) {
    cards.push(
      <div key="body" className="bg-orange-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">體脂趨勢</p>
        <p className="text-2xl font-bold text-orange-600">
          {bodyFat ? `${bodyFat}%` : '--'}
        </p>
        <p className="text-xs text-gray-400">
          {bodyFatTrend
            ? bodyFatTrend.direction === 'down' ? `↓${bodyFatTrend.diff}%` : bodyFatTrend.direction === 'up' ? `↑${bodyFatTrend.diff}%` : '持平'
            : ''}
        </p>
      </div>
    )
  }

  if (wellnessEnabled) {
    cards.push(
      <div key="wellness" className="bg-purple-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">今日感受</p>
        <p className="text-2xl">
          {todayMood ? ['', '😫', '😔', '😐', '😊', '😄'][todayMood] : '--'}
        </p>
        <p className="text-xs text-gray-400">{hasWellness ? '已記錄' : '未記錄'}</p>
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
