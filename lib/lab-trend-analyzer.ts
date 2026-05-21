/**
 * 血檢趨勢分析引擎
 *
 * 用途：避免教練在寫 panel note 時 cherry-pick 漂亮的數據而漏掉惡化中的指標。
 * 將原始 lab_results 轉換成「findings」— 每個指標的最新狀態 + 趨勢 + 是否需注意。
 *
 * 這支引擎是純函式，不依賴 DB。AI 草稿引擎與學員端警示 banner 都吃它的輸出。
 */

import {
  LAB_THRESHOLDS,
  LAB_OPTIMAL_RANGES,
  calculateLabStatus,
  isInOptimalRange,
  type LabStatus,
} from '@/utils/labStatus'

// ── 與 utils/labStatus.ts 同步的常數 ──
const FEMALE_VARIANTS = new Set([
  '鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸',
  'GGT', '肌酸酐', 'DHEA-S', '雌二醇', 'SHBG', '血紅素',
])
const HIGHER_IS_BETTER = new Set(['HDL-C', 'HDL-C_female', '白蛋白', 'eGFR'])

export interface LabResultRow {
  test_name: string
  value: number | string
  unit?: string | null
  date: string  // YYYY-MM-DD
  status?: string | null
}

export type FindingSeverity =
  | 'critical'    // 警示等級 (alert) 或顯著惡化 (>20% 退步)
  | 'attention'   // 注意等級或中度退步 (10-20%)
  | 'watch'       // 在正常但漂離最佳 / 接近邊界
  | 'improving'   // 顯著進步（>15% 改善）
  | 'optimal'     // 已達 Howard 最佳

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'unknown'

export interface LabFinding {
  testName: string
  unit: string | null
  latestValue: number
  latestDate: string
  previousValue: number | null
  previousDate: string | null
  latestStatus: LabStatus
  previousStatus: LabStatus | null
  changePercent: number | null  // 相對 prev 的變化百分比；null = 無前次
  trend: TrendDirection         // 數值面的「變好/變壞」
  severity: FindingSeverity
  inOptimal: boolean
  optimalText: string | null
  /** 自動產生的人類可讀標籤，給 AI 草稿引擎用 */
  autoLabel: string
  /** 排序權重：嚴重者大 */
  sortWeight: number
}

function resolveLookupName(testName: string, gender?: '男性' | '女性'): string {
  if (gender === '女性' && FEMALE_VARIANTS.has(testName)) {
    return `${testName}_female`
  }
  return testName
}

function higherIsBetter(testName: string, gender?: '男性' | '女性'): boolean {
  return HIGHER_IS_BETTER.has(resolveLookupName(testName, gender))
}

function isRangeBased(testName: string, gender?: '男性' | '女性'): boolean {
  const t = (LAB_THRESHOLDS as Record<string, { normal: number | { min: number; max: number } }>)[
    resolveLookupName(testName, gender)
  ]
  return !!t && typeof t.normal === 'object'
}

/**
 * 判斷數值變化方向（變好 vs 變壞），考慮 higher-is-better、範圍型、optimal range
 */
function judgeTrend(
  testName: string,
  latest: number,
  prev: number,
  gender?: '男性' | '女性'
): TrendDirection {
  if (latest === prev) return 'stable'
  const lookupName = resolveLookupName(testName, gender)
  const optimal = LAB_OPTIMAL_RANGES[lookupName]

  // 範圍型（如 TSH / 鐵蛋白 / 維生素D）：用「距離最佳區間中心」判斷
  if (typeof optimal === 'object') {
    const mid = (optimal.min + optimal.max) / 2
    const distLatest = Math.abs(latest - mid)
    const distPrev = Math.abs(prev - mid)
    if (distLatest < distPrev) return 'improving'
    if (distLatest > distPrev) return 'declining'
    return 'stable'
  }

  // 越高越好：上升=好
  if (higherIsBetter(testName, gender)) {
    return latest > prev ? 'improving' : 'declining'
  }

  // 越低越好（單一數值閾值）：下降=好
  if (typeof optimal === 'number') {
    return latest < prev ? 'improving' : 'declining'
  }

  // 沒定義 optimal：用 status 判斷，否則 unknown
  return 'unknown'
}

function severityFor(
  status: LabStatus,
  trend: TrendDirection,
  changePercent: number | null,
  inOptimal: boolean,
  prevStatus: LabStatus | null
): FindingSeverity {
  // 直接 alert 一定 critical
  if (status === 'alert') return 'critical'

  const declined = trend === 'declining'
  const improved = trend === 'improving'
  const absChange = Math.abs(changePercent ?? 0)

  // 跨閾值劣化：normal → attention（attention → alert 已在上方 alert 早退）
  const statusWorsened = prevStatus === 'normal' && status === 'attention'

  if (statusWorsened || (declined && absChange >= 20)) return 'critical'
  if (declined && absChange >= 10) return 'attention'

  // 顯著進步優先於「目前還在 attention」 — 鼓勵效果 + 避免漏掉好趨勢
  if (improved && absChange >= 15) return 'improving'

  if (status === 'attention') return 'attention'

  if (inOptimal) return 'optimal'

  // 在正常但偏離 optimal
  return 'watch'
}

function severityWeight(s: FindingSeverity): number {
  switch (s) {
    case 'critical':   return 100
    case 'attention':  return 70
    case 'watch':      return 30
    case 'improving':  return 20  // 仍想顯示但放後面
    case 'optimal':    return 5
  }
}

/**
 * 找出 latest 之前、距離 >= minDaysGap 天的最近一筆作為比較基準。
 * 避免短期內多次抽血互相比較造成雜訊。
 */
function findPreviousPoint(
  sorted: { date: string; value: number }[],
  latestIdx: number,
  minDaysGap = 14
): { date: string; value: number } | null {
  const latestTime = new Date(sorted[latestIdx].date).getTime()
  for (let i = latestIdx - 1; i >= 0; i--) {
    const daysDiff = (latestTime - new Date(sorted[i].date).getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff >= minDaysGap) return sorted[i]
  }
  // 沒有達到 gap 的，就用最近的前一筆（如果存在）
  if (latestIdx >= 1) return sorted[latestIdx - 1]
  return null
}

/**
 * 主要 API：吃所有 lab_results，輸出每個 test_name 的 finding。
 */
export function analyzeLabs(
  labs: LabResultRow[],
  options: { gender?: '男性' | '女性' } = {}
): LabFinding[] {
  const { gender } = options
  if (!labs || labs.length === 0) return []

  // 按 test_name 分組，每組依日期升序
  const grouped = new Map<string, { date: string; value: number; unit: string | null }[]>()
  for (const r of labs) {
    const value = typeof r.value === 'string' ? parseFloat(r.value) : r.value
    if (!r.test_name || !Number.isFinite(value)) continue
    const arr = grouped.get(r.test_name) || []
    arr.push({ date: r.date, value, unit: r.unit ?? null })
    grouped.set(r.test_name, arr)
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const findings: LabFinding[] = []

  for (const [testName, history] of grouped.entries()) {
    if (history.length === 0) continue
    const latestIdx = history.length - 1
    const latest = history[latestIdx]
    const prev = findPreviousPoint(history, latestIdx, 14)

    const latestStatus = calculateLabStatus(testName, latest.value, gender)
    const previousStatus = prev ? calculateLabStatus(testName, prev.value, gender) : null
    const inOptimal = isInOptimalRange(testName, latest.value, gender)

    const changePercent =
      prev && prev.value !== 0
        ? ((latest.value - prev.value) / prev.value) * 100
        : null

    const trend = prev
      ? judgeTrend(testName, latest.value, prev.value, gender)
      : 'unknown'

    const severity = severityFor(latestStatus, trend, changePercent, inOptimal, previousStatus)

    // 取得 optimal range 文字 — 用既有 util 即可，這裡單獨計算
    let optimalText: string | null = null
    const lookupName = resolveLookupName(testName, gender)
    const optimal = LAB_OPTIMAL_RANGES[lookupName]
    if (optimal !== undefined) {
      if (typeof optimal === 'object') optimalText = `${optimal.min}-${optimal.max}`
      else optimalText = higherIsBetter(testName, gender) ? `>${optimal}` : `<${optimal}`
    }

    const unit = latest.unit || ''
    const changeStr =
      changePercent !== null
        ? ` (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`
        : ''
    const optimalStr = optimalText ? `, 最佳 ${optimalText}` : ''

    let label = `${testName} ${latest.value}${unit ? ' ' + unit : ''}`
    if (prev) {
      label = `${testName} ${prev.value} → ${latest.value}${unit ? ' ' + unit : ''}${changeStr}${optimalStr}`
    } else {
      label = `${testName} ${latest.value}${unit ? ' ' + unit : ''}${optimalStr}`
    }

    findings.push({
      testName,
      unit: latest.unit,
      latestValue: latest.value,
      latestDate: latest.date,
      previousValue: prev?.value ?? null,
      previousDate: prev?.date ?? null,
      latestStatus,
      previousStatus,
      changePercent,
      trend,
      severity,
      inOptimal,
      optimalText,
      autoLabel: label,
      sortWeight: severityWeight(severity),
    })
  }

  // 按嚴重度遞減排
  findings.sort((a, b) => b.sortWeight - a.sortWeight)
  return findings
}

/**
 * 從 findings 取出該凸顯的子集（給 AI 草稿 / 學員端 banner）
 */
export function selectKeyFindings(findings: LabFinding[]): {
  critical: LabFinding[]
  attention: LabFinding[]
  improving: LabFinding[]
  optimal: LabFinding[]
} {
  return {
    critical: findings.filter(f => f.severity === 'critical'),
    attention: findings.filter(f => f.severity === 'attention'),
    improving: findings.filter(f => f.severity === 'improving'),
    optimal: findings.filter(f => f.severity === 'optimal'),
  }
}
