'use client'

import GaugeCard from '@/components/ui/GaugeCard'

interface WearableData {
  device_recovery_score?: number | null
  resting_hr?: number | null
  hrv?: number | null
  wearable_sleep_score?: number | null
  respiratory_rate?: number | null
}

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
  wearable?: WearableData | null
}

function getRecoveryStatus(score: number): { label: string; color: string } {
  if (score >= 67) return { label: '恢復良好', color: 'text-green-600' }
  if (score >= 34) return { label: '中等', color: 'text-amber-600' }
  return { label: '需要休息', color: 'text-red-500' }
}

function getHrStatus(hr: number): { label: string; color: string } {
  if (hr <= 60) return { label: '優秀', color: 'text-green-600' }
  if (hr <= 72) return { label: '正常', color: 'text-blue-600' }
  return { label: '偏高', color: 'text-amber-600' }
}

function getHrvStatus(hrv: number): { label: string; color: string } {
  if (hrv >= 60) return { label: '狀態佳', color: 'text-green-600' }
  if (hrv >= 30) return { label: '正常', color: 'text-blue-600' }
  return { label: '偏低', color: 'text-amber-600' }
}

function getSleepStatus(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '睡得不錯', color: 'text-green-600' }
  if (score >= 60) return { label: '尚可', color: 'text-amber-600' }
  return { label: '需改善', color: 'text-red-500' }
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
  wearable = null,
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
          {todayCalories ? `${pct}% of ${caloriesTarget}kcal` : '尚未記錄，點飲食區填寫'}
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

  // 判斷是否有穿戴裝置數據
  const hasWearableData = wearable && (
    wearable.device_recovery_score != null ||
    wearable.resting_hr != null ||
    wearable.hrv != null ||
    wearable.wearable_sleep_score != null
  )

  if (cards.length === 0 && !hasWearableData && !wearable) return null

  const gridCols = cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-2' : cards.length === 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'

  const recoveryStatus = wearable?.device_recovery_score != null ? getRecoveryStatus(wearable.device_recovery_score) : null
  const hrStatus = wearable?.resting_hr != null ? getHrStatus(wearable.resting_hr) : null
  const hrvStatus = wearable?.hrv != null ? getHrvStatus(wearable.hrv) : null
  const sleepStatus = wearable?.wearable_sleep_score != null ? getSleepStatus(wearable.wearable_sleep_score) : null

  return (
    <div className="space-y-3">
      {/* 既有卡片 */}
      {cards.length > 0 && (
        <div className={`grid ${gridCols} gap-3`}>
          {cards}
        </div>
      )}

      {/* 穿戴裝置 Gauge 四宮格（Garmin 風格） */}
      {/* 穿戴裝置空狀態：已填寫 wellness 但沒有任何裝置數據 */}
      {wearable && !hasWearableData && (
        <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg shrink-0">⌚</span>
          <p className="text-xs text-gray-400 leading-relaxed">
            連結穿戴裝置可自動同步睡眠與心率數據
          </p>
        </div>
      )}

      {hasWearableData && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400">⌚ 穿戴裝置數據</p>
            {wearable?.respiratory_rate != null && (
              <span className="text-[10px] text-gray-500">
                呼吸 {wearable.respiratory_rate} 次/分
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* 恢復分數 / Body Battery */}
            <GaugeCard
              icon="⚡"
              label="恢復分數"
              value={wearable?.device_recovery_score ?? null}
              max={100}
              color="#10b981"
              bgColor="bg-gray-800"
              dark
              statusLabel={recoveryStatus?.label}
              statusColor={recoveryStatus?.color}
              sourceLabel="穿戴裝置"
            />

            {/* 睡眠分數 */}
            <GaugeCard
              icon="😴"
              label="睡眠分數"
              value={wearable?.wearable_sleep_score ?? null}
              max={100}
              color="#8b5cf6"
              bgColor="bg-gray-800"
              dark
              statusLabel={sleepStatus?.label}
              statusColor={sleepStatus?.color}
            />

            {/* 靜息心率 — max 設為 120 讓視覺比例合理 */}
            <GaugeCard
              icon="❤️"
              label="靜息心率"
              value={wearable?.resting_hr ?? null}
              max={120}
              unit="bpm"
              color="#ef4444"
              bgColor="bg-gray-800"
              dark
              statusLabel={hrStatus?.label}
              statusColor={hrStatus?.color}
            />

            {/* HRV */}
            <GaugeCard
              icon="📊"
              label="HRV"
              value={wearable?.hrv ?? null}
              max={150}
              unit="ms"
              color="#3b82f6"
              bgColor="bg-gray-800"
              dark
              statusLabel={hrvStatus?.label}
              statusColor={hrvStatus?.color}
            />
          </div>
        </div>
      )}
    </div>
  )
}
