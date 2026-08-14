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

/**
 * 外推距離的上限（天）。
 *
 * ⚠️ 2026-08-14 修：這函式是為「備賽末期還剩幾週」設計的，但教練端備賽倒數
 * 對距賽 351 天的人照樣呼叫——14 天窗算出 +0.1kg/天，乘 351 天就變成
 * 「預測 117.2kg、體重落後 31.2kg」。Howard 當時 81.8kg。
 *
 * 短窗口的斜率只在近期成立（賽後回水、一次腸胃炎、一趟出差都能主導它）。
 * 規則：外推不超過取樣窗口的 6 倍，且硬上限 84 天（12 週）。超過就回 null——
 * 呼叫端本來就處理 null（顯示「多記幾天才能預測趨勢」或整段不顯示），
 * 給不出可信數字時閉嘴，比給一個荒謬數字好。
 */
const MAX_HORIZON_DAYS = 84
const HORIZON_WINDOW_RATIO = 6

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

  // 外推太遠就不給數字（見 MAX_HORIZON_DAYS）
  const lastX = pts[pts.length - 1].x
  const horizon = xAtComp - lastX
  if (horizon > Math.min(MAX_HORIZON_DAYS, windowDays * HORIZON_WINDOW_RATIO)) return null

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

/**
 * 只算近期速率，不外推——距比賽還很遠（休賽季/增肌段）時該看的是這個。
 * 「預測比賽日體重」在那個距離沒有意義，但「這週長多快」有。
 */
export function metricSlopePerWeek(
  rows: { date: string; value: number | null }[],
  windowDays = 21,
): number | null {
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
  // 借用同一條回歸，xAtComp 隨便給（只取 slope）
  return project(pts, 0)?.slopePerWeek ?? null
}
