/**
 * 訓練週期化（方案 A：純日曆版）
 *
 * 課表 plan_json 的選配 `mesocycle` 鍵 → 推算「現在是第幾週 / 是不是減量週」。
 * 純日曆計算，不碰任何 training log（log 髒，見 docs/DESIGN_TRAINING_PERIODIZATION.md §1.5）。
 *
 * Howard 定調（2026-07-04）：
 * - 週期的本體 = 動作選擇，系統只做時間軸記帳（第幾週/塊標籤/減量週標記）。
 * - 減量週的換算「只動主項」（每天 exercises[0]）：RPE 上限 6、組數 -2（下限 2 組）。
 *   附屬動作完全照舊。
 * - 沒有 mesocycle = 功能靜默關閉（回 null），舊課表零影響。
 *
 * 時區一律 Asia/Taipei，與 components/client/TodayWorkout.tsx 同算法（抽到這裡共用）。
 */

// ── 結構型別（structural，避免 lib 反向依賴 hooks/） ──

export interface Mesocycle {
  /** 週期起始日 YYYY-MM-DD（慣例上是週一）。公版 template 不帶，套用學員時才填。 */
  startDate: string
  /** 一輪幾週 */
  weeks: number
  /** 第幾週是減量週（1-based，選配） */
  deloadWeek?: number
  /** 塊身分標籤（增肌 / 減脂前期 / 減脂後期…自由字串） */
  blockLabel?: string
  /** 選填備註 */
  note?: string
}

export interface PeriodizedExercise {
  name: string
  sets?: string
  reps?: string
  rpe?: string
  note?: string
  /** deload 換算後才有：標記主項已被調整＋保留原值供 UI 劃線顯示 */
  deloadAdjusted?: boolean
  originalSets?: string
  originalRpe?: string
}

export interface PeriodizedDay {
  dayOfWeek: number
  label: string
  exercises: PeriodizedExercise[]
}

export interface PeriodizedPlan {
  name?: string
  days?: PeriodizedDay[]
  mesocycle?: Mesocycle | null
}

export interface CycleState {
  /** 1-based；週期結束後會 > totalWeeks */
  week: number
  totalWeeks: number
  isDeloadWeek: boolean
  /** week > totalWeeks（週期已結束，等教練排下一塊） */
  ended: boolean
  blockLabel: string | null
}

// ── 時區工具（Asia/Taipei，跟 TodayWorkout 同算法） ──

/** 台北時區的今天，YYYY-MM-DD */
export function getTaipeiDateStr(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

/** 台北時區的今天星期幾：1=週一 … 7=週日 */
export function getTaipeiDayOfWeek(now: Date = new Date()): number {
  const taipeiDate = new Date(getTaipeiDateStr(now) + 'T12:00:00')
  const jsDay = taipeiDate.getDay()
  return jsDay === 0 ? 7 : jsDay
}

// ── 週期狀態 ──

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateStr(s: string): number | null {
  if (!DATE_RE.test(s)) return null
  const t = Date.parse(s + 'T00:00:00Z')
  return Number.isNaN(t) ? null : t
}

/**
 * 推算課表目前的週期狀態。
 *
 * @param plan 課表 JSON（clients.training_plan）
 * @param todayTaipei 台北時區的今天（YYYY-MM-DD），預設取現在
 * @returns 週期狀態；以下情況回 null（= 功能靜默關閉）：
 *   - 沒有 mesocycle / 欄位缺漏或格式錯（寬容，不炸）
 *   - 今天還沒到 startDate（週期未開始）
 */
export function getCycleState(
  plan: PeriodizedPlan | null | undefined,
  todayTaipei: string = getTaipeiDateStr()
): CycleState | null {
  const meso = plan?.mesocycle
  if (!meso) return null
  if (typeof meso.startDate !== 'string' || typeof meso.weeks !== 'number') return null
  const totalWeeks = Math.floor(meso.weeks)
  if (!Number.isFinite(totalWeeks) || totalWeeks < 1) return null

  const start = parseDateStr(meso.startDate)
  const today = parseDateStr(todayTaipei)
  if (start == null || today == null) return null

  const diffDays = Math.floor((today - start) / 86400000)
  if (diffDays < 0) return null // 週期還沒開始 → 不顯示

  const week = Math.floor(diffDays / 7) + 1
  const ended = week > totalWeeks
  const deloadWeek =
    typeof meso.deloadWeek === 'number' && Number.isFinite(meso.deloadWeek)
      ? Math.floor(meso.deloadWeek)
      : null

  return {
    week,
    totalWeeks,
    isDeloadWeek: !ended && deloadWeek != null && week === deloadWeek,
    ended,
    blockLabel: typeof meso.blockLabel === 'string' && meso.blockLabel.trim() ? meso.blockLabel.trim() : null,
  }
}

// ── Deload 換算（只動主項 exercises[0]） ──

export const DELOAD_RPE_CAP = 6
export const DELOAD_SETS_REDUCTION = 2
export const DELOAD_MIN_SETS = 2

/** 取字串裡第一個數字（"8-10"→8、"RPE 8"→8）；沒有回 null */
function firstNumber(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/**
 * 減量週的顯示換算。**只動主項（exercises[0]）**：
 * - RPE 上限 6（原 RPE ≤6 不動）
 * - 組數 -2，下限 2 組（原本就 ≤2 組不動）
 * 附屬動作（exercises[1..]）完全照舊——Howard 定調「重量只調主項」。
 *
 * 解析不出數字的欄位（如 sets 沒填）保持原樣不動。
 * 回傳新物件，不改動輸入。
 */
export function applyDeloadToDay<T extends PeriodizedDay>(day: T): T {
  if (!day?.exercises?.length) return day

  const main = day.exercises[0]
  const adjusted: PeriodizedExercise = { ...main }
  let changed = false

  const sets = firstNumber(main.sets)
  if (sets != null && sets > DELOAD_MIN_SETS) {
    const newSets = Math.max(DELOAD_MIN_SETS, sets - DELOAD_SETS_REDUCTION)
    if (newSets !== sets) {
      adjusted.sets = String(newSets)
      adjusted.originalSets = main.sets
      changed = true
    }
  }

  const rpe = firstNumber(main.rpe)
  if (rpe != null && rpe > DELOAD_RPE_CAP) {
    adjusted.rpe = String(DELOAD_RPE_CAP)
    adjusted.originalRpe = main.rpe
    changed = true
  }

  if (!changed) return day
  adjusted.deloadAdjusted = true
  return { ...day, exercises: [adjusted, ...day.exercises.slice(1)] }
}

// ── 疲勞旗標（第二波：方案 B 第 ⑤ 步） ──
//
// 輸入訊號白名單「僅二」（docs/DESIGN_TRAINING_PERIODIZATION.md §方案 B）：
//   1. 手填 wellness 基線偏移（sleep_quality / energy_level / training_drive，1–5 制）
//   2. 體重掉速異常（僅 cut / 備賽學員）
// 明確排除：HRV / 穿戴數據 / training_logs 的 RPE、重量、ACWR（髒訊號）。
// 引擎只提醒（隨教練週報一句話），絕不自動改課表。

/** Howard 拍板（2026-07-04）：7 天均值比自己前 30 天基線低 0.5 分（1–5 制）算偏移。要校準只改這裡。 */
export const FATIGUE_WELLNESS_DROP = 0.5
/** Howard 拍板（2026-07-04）：偏移要連續 2 週才 flag。 */
export const FATIGUE_CONSECUTIVE_WEEKS = 2
export const FATIGUE_RECENT_WINDOW_DAYS = 7
export const FATIGUE_BASELINE_WINDOW_DAYS = 30
/** 資料門檻：近 7 天 wellness 至少填幾天，否則整體回 null（不出旗標） */
export const FATIGUE_MIN_RECENT_FILLED = 4
/** 資料門檻：基線期（前 30 天）至少填幾天，否則整體回 null */
export const FATIGUE_MIN_BASELINE_FILLED = 10
/** 體重訊號：14 天窗掉速 >1.5%/週（沿用 CutHealthCard 拍板閾值），僅 cut/備賽 */
export const FATIGUE_WEIGHT_DROP_PCT_PER_WEEK = 1.5
export const FATIGUE_WEIGHT_WINDOW_DAYS = 14
/** 體重 14 天窗 <5 筆 → 跳過體重訊號（不擋 wellness 訊號） */
export const FATIGUE_WEIGHT_MIN_ENTRIES = 5

export interface FatigueWellnessEntry {
  date: string // YYYY-MM-DD
  sleep_quality?: number | null
  energy_level?: number | null
  training_drive?: number | null
}

export interface FatigueWeightEntry {
  date: string // YYYY-MM-DD
  weight: number | null
}

export interface FatigueFlagResult {
  flagged: boolean
  /** low = 只評估得了單一訊號（文案要帶「訊號單一，僅供參考」） */
  confidence: 'normal' | 'low'
  /** 給教練看的一句話理由（已是人話） */
  reasons: string[]
  /** 各訊號結果；weight = null 表示被跳過（非 cut/備賽 或 資料不足） */
  signals: { wellness: boolean; weight: boolean | null }
  /** 本週 7 天均值低於基線多少分（正值 = 低於基線）；null = 算不出 */
  wellnessDrop: number | null
  /** 體重掉速 %/週（正值 = 在掉）；null = 訊號被跳過 */
  weightWeeklyLossPct: number | null
}

/** 單日 wellness 綜合分：三項有填的取平均；一項都沒填回 null（= 該日沒填） */
function wellnessDayScore(w: FatigueWellnessEntry): number | null {
  const vals = [w.sleep_quality, w.energy_level, w.training_drive].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** anchor 日往回看：近 7 天窗 vs 前 30 天基線窗的均值與填寫天數 */
function wellnessWindowStats(
  scoresByTs: Map<number, number>,
  anchorTs: number
): { recentDays: number; recentAvg: number; baselineDays: number; baselineAvg: number } {
  let recentSum = 0
  let recentDays = 0
  let baselineSum = 0
  let baselineDays = 0
  for (const [ts, score] of scoresByTs) {
    const daysAgo = Math.round((anchorTs - ts) / 86400000)
    if (daysAgo < 0) continue
    if (daysAgo < FATIGUE_RECENT_WINDOW_DAYS) {
      recentSum += score
      recentDays++
    } else if (daysAgo < FATIGUE_RECENT_WINDOW_DAYS + FATIGUE_BASELINE_WINDOW_DAYS) {
      baselineSum += score
      baselineDays++
    }
  }
  return {
    recentDays,
    recentAvg: recentDays ? recentSum / recentDays : 0,
    baselineDays,
    baselineAvg: baselineDays ? baselineSum / baselineDays : 0,
  }
}

/** 14 天窗體重線性回歸 → kg/週（負值 = 在掉）。點數 <FATIGUE_WEIGHT_MIN_ENTRIES 或跨度 <5 天回 null。 */
function weightWeeklySlope(
  weights: FatigueWeightEntry[],
  anchorTs: number
): { slopeKgPerWeek: number; latestWeight: number } | null {
  const pts = weights
    .map((w) => ({ ts: parseDateStr(w.date), weight: w.weight }))
    .filter((p): p is { ts: number; weight: number } => p.ts != null && typeof p.weight === 'number' && Number.isFinite(p.weight))
    .filter((p) => {
      const daysAgo = (anchorTs - p.ts) / 86400000
      return daysAgo >= 0 && daysAgo < FATIGUE_WEIGHT_WINDOW_DAYS
    })
    .sort((a, b) => a.ts - b.ts)

  if (pts.length < FATIGUE_WEIGHT_MIN_ENTRIES) return null
  const spanDays = (pts[pts.length - 1].ts - pts[0].ts) / 86400000
  if (spanDays < 5) return null

  const t0 = pts[0].ts
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (const p of pts) {
    const x = (p.ts - t0) / 86400000
    sx += x; sy += p.weight; sxy += x * p.weight; sxx += x * x
  }
  const n = pts.length
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  return {
    slopeKgPerWeek: ((n * sxy - sx * sy) / denom) * 7,
    latestWeight: pts[pts.length - 1].weight,
  }
}

/**
 * 疲勞旗標（純函式）。
 *
 * @returns null = wellness 資料不足（近 7 天 <4 天有填 或 基線期 <10 天有填）→ 不出旗標。
 *   其餘一律回結果物件（flagged 可能為 false）。
 *
 * 判定：
 * - wellness 訊號：近 7 天綜合均值比前 30 天基線低 ≥0.5 分，且上一週（往前平移 7 天）同樣成立
 *   （= 連續 2 週；上一週資料不足門檻視為「不成立」，不 flag）。
 * - 體重訊號：僅 goalType='cut' 或備賽（isPrep）評估；14 天窗回歸掉速 >1.5%/週。
 *   資料 <5 筆或跨度 <5 天 → 跳過（signals.weight = null）。
 * - 只評估得了單一訊號 → confidence='low'。
 */
export function computeFatigueFlag(input: {
  wellness: FatigueWellnessEntry[]
  weights?: FatigueWeightEntry[]
  goalType?: string | null
  /** 備賽（clients.prep_phase 有值） */
  isPrep?: boolean
  todayTaipei?: string
}): FatigueFlagResult | null {
  const today = parseDateStr(input.todayTaipei ?? getTaipeiDateStr())
  if (today == null) return null

  // ── wellness 訊號 ──
  const scoresByTs = new Map<number, number>()
  for (const w of input.wellness || []) {
    const ts = parseDateStr(w.date)
    const score = wellnessDayScore(w)
    if (ts != null && score != null) scoresByTs.set(ts, score)
  }

  const cur = wellnessWindowStats(scoresByTs, today)
  // 資料門檻：本週不足 → 整體回 null（不出旗標）
  if (cur.recentDays < FATIGUE_MIN_RECENT_FILLED || cur.baselineDays < FATIGUE_MIN_BASELINE_FILLED) {
    return null
  }
  const EPS = 1e-9
  const curDrop = cur.baselineAvg - cur.recentAvg
  const curBelow = curDrop >= FATIGUE_WELLNESS_DROP - EPS

  // 連續 2 週：把窗往前平移 7 天再判一次；上一週資料不足視為不成立
  const prev = wellnessWindowStats(scoresByTs, today - FATIGUE_RECENT_WINDOW_DAYS * 86400000)
  const prevBelow =
    prev.recentDays >= FATIGUE_MIN_RECENT_FILLED &&
    prev.baselineDays >= FATIGUE_MIN_BASELINE_FILLED &&
    prev.baselineAvg - prev.recentAvg >= FATIGUE_WELLNESS_DROP - EPS

  const wellnessSignal = curBelow && prevBelow

  // ── 體重訊號（僅 cut / 備賽） ──
  const weightApplies = input.goalType === 'cut' || input.isPrep === true
  let weightSignal: boolean | null = null
  let weightWeeklyLossPct: number | null = null
  if (weightApplies) {
    const fit = weightWeeklySlope(input.weights || [], today)
    if (fit && fit.latestWeight > 0) {
      const lossPct = (-fit.slopeKgPerWeek / fit.latestWeight) * 100 // 正值 = 在掉
      weightWeeklyLossPct = Math.round(lossPct * 100) / 100
      weightSignal = lossPct > FATIGUE_WEIGHT_DROP_PCT_PER_WEEK
    }
  }

  const signalsEvaluated = 1 + (weightSignal != null ? 1 : 0)
  const confidence: 'normal' | 'low' = signalsEvaluated >= 2 ? 'normal' : 'low'

  const reasons: string[] = []
  if (wellnessSignal) {
    reasons.push(`狀態連 ${FATIGUE_CONSECUTIVE_WEEKS} 週低於自己基線（近 7 天均值低 ${curDrop.toFixed(1)} 分）`)
  }
  if (weightSignal === true && weightWeeklyLossPct != null) {
    reasons.push(`體重掉速 ${weightWeeklyLossPct.toFixed(1)}%/週（>${FATIGUE_WEIGHT_DROP_PCT_PER_WEEK}%/週）`)
  }

  return {
    flagged: wellnessSignal || weightSignal === true,
    confidence,
    reasons,
    signals: { wellness: wellnessSignal, weight: weightSignal },
    wellnessDrop: Math.round(curDrop * 100) / 100,
    weightWeeklyLossPct,
  }
}
