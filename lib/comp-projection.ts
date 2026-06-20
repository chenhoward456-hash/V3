// 共用備賽投影：把某指標(體重/體脂)近 windowDays 天線性回歸，預測到比賽日。
// 學員端作戰室(CompWarRoom)與教練端 /admin 備賽倒數共用，確保兩邊看到的判斷一致。

function project(points: { x: number; y: number }[], xAtComp: number) {
  const n = points.length
  if (n < 3) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x }
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { projected: intercept + slope * xAtComp, slopePerWeek: slope * 7 }
}

const DAY = 86400000

export function projectMetricToDate(
  rows: { date: string; value: number | null }[],
  targetDate: string,
  windowDays = 21,
): { projected: number; slopePerWeek: number } | null {
  const valid = rows
    .filter(r => r.value != null)
    .map(r => ({ date: r.date, value: r.value as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (valid.length < 3) return null
  const lastDate = new Date(valid[valid.length - 1].date + 'T00:00:00').getTime()
  const recent = valid.filter(v => (lastDate - new Date(v.date + 'T00:00:00').getTime()) / DAY <= windowDays)
  if (recent.length < 3) return null
  const r0 = new Date(recent[0].date + 'T00:00:00').getTime()
  const spanDays = (new Date(recent[recent.length - 1].date + 'T00:00:00').getTime() - r0) / DAY
  if (spanDays < 5) return null
  const pts = recent.map(v => ({ x: (new Date(v.date + 'T00:00:00').getTime() - r0) / DAY, y: v.value }))
  const xAtComp = (new Date(targetDate + 'T00:00:00').getTime() - r0) / DAY
  return project(pts, xAtComp)
}

export type WeightVerdict = {
  projected: number
  slopePerWeek: number
  gap: number          // 預測比賽日體重 − 目標；>0 = 仍高於目標(還沒到)
  onTrack: boolean     // 預測會達標(含 0.3kg 容差)
}

/** 體重達標判定（cut：越低越好）。資料不足回 null。 */
// 用 14 天窗（教練端 recentBody 與學員端都拿得到 → 兩邊預測一致）。
// 容差 1.0kg：比賽日預測落在目標 1kg 內視為「會準時」(37 天還差 0.8kg 不算落後)。
export function projectWeightVerdict(
  bodyPoints: { date: string; value: number | null }[],
  compDate: string,
  targetWeight: number | null,
): WeightVerdict | null {
  const w = projectMetricToDate(bodyPoints, compDate, 14)
  if (!w || targetWeight == null) return null
  const gap = w.projected - targetWeight
  return { projected: w.projected, slopePerWeek: w.slopePerWeek, gap, onTrack: gap <= 1.0 }
}
