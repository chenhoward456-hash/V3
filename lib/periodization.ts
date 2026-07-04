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
