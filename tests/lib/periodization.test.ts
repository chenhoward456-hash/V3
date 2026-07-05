import { describe, it, expect } from 'vitest'
import {
  getCycleState,
  applyDeloadToDay,
  getTaipeiDateStr,
  getTaipeiDayOfWeek,
  type PeriodizedPlan,
  type PeriodizedDay,
} from '@/lib/periodization'

// ── Helpers ──

function makePlan(mesocycle: any): PeriodizedPlan {
  return { name: '測試計畫', days: [], mesocycle }
}

function makeDay(overrides: Partial<PeriodizedDay> = {}): PeriodizedDay {
  return {
    dayOfWeek: 1,
    label: 'Push Day',
    exercises: [
      { name: '槓鈴臥推', sets: '4', reps: '6-8', rpe: '9', note: '主項' },
      { name: '上斜啞鈴臥推', sets: '3', reps: '10-12', rpe: '7' },
      { name: '繩索飛鳥', sets: '3', reps: '12-15', rpe: '8' },
    ],
    ...overrides,
  }
}

// startDate 2026-06-29 是週一
const MESO = { startDate: '2026-06-29', weeks: 4, deloadWeek: 2, blockLabel: '減脂後期' }

describe('getCycleState', () => {
  it('沒有 mesocycle 回 null（功能靜默關閉）', () => {
    expect(getCycleState(null, '2026-07-04')).toBeNull()
    expect(getCycleState(undefined, '2026-07-04')).toBeNull()
    expect(getCycleState({ name: 'x', days: [] }, '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan(null), '2026-07-04')).toBeNull()
  })

  it('欄位缺漏或格式錯回 null，不炸', () => {
    expect(getCycleState(makePlan({ weeks: 4 }), '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan({ startDate: '2026-06-29' }), '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan({ startDate: 'not-a-date', weeks: 4 }), '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan({ startDate: '2026-6-29', weeks: 4 }), '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan({ startDate: '2026-06-29', weeks: 0 }), '2026-07-04')).toBeNull()
    expect(getCycleState(makePlan({ startDate: '2026-06-29', weeks: -3 }), '2026-07-04')).toBeNull()
  })

  it('週期還沒開始（今天 < startDate）回 null', () => {
    expect(getCycleState(makePlan(MESO), '2026-06-28')).toBeNull()
  })

  it('第 1 週：起始日當天與第 7 天都算第 1 週', () => {
    const d1 = getCycleState(makePlan(MESO), '2026-06-29')
    expect(d1).toMatchObject({ week: 1, totalWeeks: 4, isDeloadWeek: false, ended: false })
    const d7 = getCycleState(makePlan(MESO), '2026-07-05') // 週日 = 第 7 天
    expect(d7).toMatchObject({ week: 1, isDeloadWeek: false })
  })

  it('跨週界線：第 8 天進入第 2 週', () => {
    const state = getCycleState(makePlan(MESO), '2026-07-06') // 下週一
    expect(state).toMatchObject({ week: 2, totalWeeks: 4, isDeloadWeek: true, ended: false })
  })

  it('deload 週判定：week === deloadWeek 才是 true', () => {
    expect(getCycleState(makePlan(MESO), '2026-07-04')!.isDeloadWeek).toBe(false) // 第 1 週
    expect(getCycleState(makePlan(MESO), '2026-07-08')!.isDeloadWeek).toBe(true)  // 第 2 週
    expect(getCycleState(makePlan(MESO), '2026-07-13')!.isDeloadWeek).toBe(false) // 第 3 週
    // 沒設 deloadWeek → 永遠 false
    const noDeload = getCycleState(makePlan({ startDate: '2026-06-29', weeks: 4 }), '2026-07-08')
    expect(noDeload!.isDeloadWeek).toBe(false)
  })

  it('週期結束：week > totalWeeks → ended，且不再標 deload', () => {
    // 4 週 = 28 天，2026-07-27（第 29 天）進入第 5 週
    const lastDay = getCycleState(makePlan(MESO), '2026-07-26')
    expect(lastDay).toMatchObject({ week: 4, ended: false })
    const over = getCycleState(makePlan({ ...MESO, deloadWeek: 5 }), '2026-07-27')
    expect(over).toMatchObject({ week: 5, totalWeeks: 4, ended: true, isDeloadWeek: false })
  })

  it('blockLabel 帶出；空字串當 null', () => {
    expect(getCycleState(makePlan(MESO), '2026-07-04')!.blockLabel).toBe('減脂後期')
    const noLabel = getCycleState(makePlan({ startDate: '2026-06-29', weeks: 4 }), '2026-07-04')
    expect(noLabel!.blockLabel).toBeNull()
    const blank = getCycleState(makePlan({ ...MESO, blockLabel: '  ' }), '2026-07-04')
    expect(blank!.blockLabel).toBeNull()
  })
})

describe('applyDeloadToDay', () => {
  it('只動主項：exercises[0] 組數 -2、RPE 上限 6；附屬完全照舊', () => {
    const day = makeDay()
    const out = applyDeloadToDay(day)
    expect(out.exercises[0]).toMatchObject({
      name: '槓鈴臥推',
      sets: '2',           // 4 - 2
      rpe: '6',            // 9 → 上限 6
      reps: '6-8',         // 次數不動
      deloadAdjusted: true,
      originalSets: '4',
      originalRpe: '9',
    })
    // 附屬動作原封不動（同一參考）
    expect(out.exercises[1]).toBe(day.exercises[1])
    expect(out.exercises[2]).toBe(day.exercises[2])
  })

  it('不改動輸入物件（immutable）', () => {
    const day = makeDay()
    applyDeloadToDay(day)
    expect(day.exercises[0].sets).toBe('4')
    expect(day.exercises[0].rpe).toBe('9')
  })

  it('主項組數下限 2：3 組 → 2 組；原本 2 組不動', () => {
    const from3 = applyDeloadToDay(makeDay({ exercises: [{ name: '深蹲', sets: '3', rpe: '9' }] }))
    expect(from3.exercises[0].sets).toBe('2')
    const from2 = applyDeloadToDay(makeDay({ exercises: [{ name: '深蹲', sets: '2', rpe: '9' }] }))
    expect(from2.exercises[0].sets).toBe('2')
    expect(from2.exercises[0].originalSets).toBeUndefined() // 組數沒變就不標原值
    expect(from2.exercises[0].rpe).toBe('6') // RPE 還是要 cap
  })

  it('RPE 原本 ≤6 不動', () => {
    const out = applyDeloadToDay(makeDay({ exercises: [{ name: '深蹲', sets: '5', rpe: '6' }] }))
    expect(out.exercises[0].rpe).toBe('6')
    expect(out.exercises[0].originalRpe).toBeUndefined()
    expect(out.exercises[0].sets).toBe('3')
  })

  it('欄位解析不出數字就保持原樣；完全沒得調時回原 day', () => {
    const noNumbers = makeDay({ exercises: [{ name: '走路', note: '30 分' }] })
    // note 不參與換算；sets/rpe 都沒有 → 不動
    const out = applyDeloadToDay({ ...noNumbers, exercises: [{ name: '走路' }] } as PeriodizedDay)
    expect(out.exercises[0]).toMatchObject({ name: '走路' })
    expect(out.exercises[0].deloadAdjusted).toBeUndefined()

    const alreadyLight = makeDay({ exercises: [{ name: '深蹲', sets: '2', rpe: '5' }] })
    expect(applyDeloadToDay(alreadyLight)).toBe(alreadyLight)
  })

  it('range 型字串取第一個數字：RPE "8-9" → "6"、sets "4組" → "2"', () => {
    const out = applyDeloadToDay(makeDay({ exercises: [{ name: '硬舉', sets: '4組', rpe: '8-9' }] }))
    expect(out.exercises[0].sets).toBe('2')
    expect(out.exercises[0].rpe).toBe('6')
  })

  it('空 exercises 或空 day 安全返回', () => {
    const empty = makeDay({ exercises: [] })
    expect(applyDeloadToDay(empty)).toBe(empty)
  })
})

describe('Taipei 時區工具', () => {
  it('getTaipeiDateStr 回 YYYY-MM-DD', () => {
    // UTC 2026-07-04 18:00 = 台北 2026-07-05 02:00
    expect(getTaipeiDateStr(new Date('2026-07-04T18:00:00Z'))).toBe('2026-07-05')
    expect(getTaipeiDateStr(new Date('2026-07-04T06:00:00Z'))).toBe('2026-07-04')
  })

  it('getTaipeiDayOfWeek：1=週一 … 7=週日（跟 TodayWorkout 同算法）', () => {
    // 2026-07-06 是週一
    expect(getTaipeiDayOfWeek(new Date('2026-07-06T06:00:00Z'))).toBe(1)
    // 2026-07-05 是週日 → 7
    expect(getTaipeiDayOfWeek(new Date('2026-07-05T06:00:00Z'))).toBe(7)
    // UTC 週六 18:00 = 台北週日 02:00
    expect(getTaipeiDayOfWeek(new Date('2026-07-04T18:00:00Z'))).toBe(7)
  })
})

// ══════════════════════════════════════════════════════════════
// computeFatigueFlag（第二波：疲勞旗標）
// ══════════════════════════════════════════════════════════════

import {
  computeFatigueFlag,
  FATIGUE_WELLNESS_DROP,
  FATIGUE_WEIGHT_DROP_PCT_PER_WEEK,
  type FatigueWellnessEntry,
  type FatigueWeightEntry,
} from '@/lib/periodization'

const TODAY = '2026-07-05'

/** TODAY 往回 daysAgo 天的日期字串 */
function dAgo(daysAgo: number): string {
  const t = Date.parse(TODAY + 'T00:00:00Z') - daysAgo * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * 造 wellness 序列（以 TODAY 為錨）：
 * - recentCur：本週（day 0–6）每天的分數
 * - recentPrev：上週（day 7–13）每天的分數
 * - baseline：day 14–43（30 天）每天的分數
 * 窗口對應：本週判定的基線窗 = day 7–36（含上週值）；上週判定的基線窗 = day 14–43。
 */
function makeWellness(recentCur: number, recentPrev: number, baseline: number, opts?: {
  curDays?: number[]   // 本週有填的 daysAgo（預設 0–6 全填）
  prevDays?: number[]  // 上週有填的 daysAgo（預設 7–13 全填）
  baseDays?: number[]  // 基線期有填的 daysAgo（預設 14–43 全填）
}): FatigueWellnessEntry[] {
  const out: FatigueWellnessEntry[] = []
  const curDays = opts?.curDays ?? [0, 1, 2, 3, 4, 5, 6]
  const prevDays = opts?.prevDays ?? [7, 8, 9, 10, 11, 12, 13]
  const baseDays = opts?.baseDays ?? Array.from({ length: 30 }, (_, i) => i + 14)
  for (const d of curDays) out.push({ date: dAgo(d), sleep_quality: recentCur, energy_level: recentCur, training_drive: recentCur })
  for (const d of prevDays) out.push({ date: dAgo(d), sleep_quality: recentPrev, energy_level: recentPrev, training_drive: recentPrev })
  for (const d of baseDays) out.push({ date: dAgo(d), sleep_quality: baseline, energy_level: baseline, training_drive: baseline })
  return out
}

/** 造 14 天每日體重：today 體重 = endKg，往回每天 +perDayKg（= 每天掉 perDayKg） */
function makeWeights(endKg: number, perDayKg: number, days = 14): FatigueWeightEntry[] {
  return Array.from({ length: days }, (_, i) => ({ date: dAgo(i), weight: endKg + i * perDayKg }))
}

describe('computeFatigueFlag — 資料門檻（不足回 null）', () => {
  it('wellness 全空 → null', () => {
    expect(computeFatigueFlag({ wellness: [], todayTaipei: TODAY })).toBeNull()
  })

  it('近 7 天只填 3 天（<4）→ null', () => {
    const w = makeWellness(3.0, 4.0, 4.0, { curDays: [0, 2, 4] })
    expect(computeFatigueFlag({ wellness: w, todayTaipei: TODAY })).toBeNull()
  })

  it('近 7 天填滿 4 天（門檻剛好過）→ 不是 null', () => {
    const w = makeWellness(3.0, 4.0, 4.0, { curDays: [0, 1, 2, 3] })
    expect(computeFatigueFlag({ wellness: w, todayTaipei: TODAY })).not.toBeNull()
  })

  it('本週基線期（day 7–36）只填 9 天（<10）→ null', () => {
    // 上週 7 天全填 + 基線期只填 2 天 = 本週的基線窗只有 9 天
    const w = makeWellness(3.0, 4.0, 4.0, { baseDays: [14, 15] })
    expect(computeFatigueFlag({ wellness: w, todayTaipei: TODAY })).toBeNull()
  })

  it('三項全 null 的那天不算「有填」', () => {
    const w = makeWellness(3.0, 4.0, 4.0, { curDays: [0, 1, 2] })
    w.push({ date: dAgo(3), sleep_quality: null, energy_level: null, training_drive: null })
    expect(computeFatigueFlag({ wellness: w, todayTaipei: TODAY })).toBeNull()
  })
})

describe('computeFatigueFlag — wellness 基線偏移 + 連 2 週判定', () => {
  it('連 2 週都低於基線 ≥0.5 → flagged', () => {
    // 上週 3.4 vs 基線 4.0（低 0.6）；本週 3.0 vs 混合基線 3.86（低 0.86）
    const r = computeFatigueFlag({ wellness: makeWellness(3.0, 3.4, 4.0), todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: true, signals: { wellness: true } })
    expect(r!.reasons.join('')).toContain('連 2 週')
  })

  it('只有本週低（上週正常）→ 不 flag', () => {
    const r = computeFatigueFlag({ wellness: makeWellness(3.0, 4.0, 4.0), todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: false, signals: { wellness: false } })
  })

  it('上週低但本週回升 → 不 flag', () => {
    const r = computeFatigueFlag({ wellness: makeWellness(4.0, 3.4, 4.0), todayTaipei: TODAY })
    expect(r!.flagged).toBe(false)
  })

  it('閾值邊界：上週剛好低 0.5 → 算偏移；低 0.49 → 不算', () => {
    // 上週 3.5 vs 基線 4.0 = 剛好 0.5 → prevBelow 成立；本週夠低 → flagged
    const exactly = computeFatigueFlag({ wellness: makeWellness(3.0, 3.5, 4.0), todayTaipei: TODAY })
    expect(exactly!.flagged).toBe(true)
    // 上週 3.51 vs 基線 4.0 = 0.49 → prevBelow 不成立 → 不 flag
    const justUnder = computeFatigueFlag({ wellness: makeWellness(3.0, 3.51, 4.0), todayTaipei: TODAY })
    expect(justUnder!.flagged).toBe(false)
  })

  it('上週資料不足（<4 天）→ 連 2 週不成立、不 flag（但不回 null）', () => {
    const w = makeWellness(3.0, 3.0, 4.0, { prevDays: [7, 8, 9] })
    const r = computeFatigueFlag({ wellness: w, todayTaipei: TODAY })
    expect(r).not.toBeNull()
    expect(r!.flagged).toBe(false)
  })

  it('wellnessDrop 回報本週偏移量', () => {
    const r = computeFatigueFlag({ wellness: makeWellness(3.0, 4.0, 4.0), todayTaipei: TODAY })
    expect(r!.wellnessDrop).toBeCloseTo(1.0, 1) // 本週 3.0 vs 基線窗全 4.0
  })
})

describe('computeFatigueFlag — 體重訊號（僅 cut / 備賽）', () => {
  const okWellness = makeWellness(4.0, 4.0, 4.0) // wellness 正常
  // 80kg、每天掉 0.25kg ≈ 1.75kg/週 ≈ 2.2%/週 > 1.5%
  const fastDrop = makeWeights(80, 0.25)
  // 每天掉 0.1kg ≈ 0.7kg/週 ≈ 0.9%/週 < 1.5%
  const okDrop = makeWeights(80, 0.1)

  it('cut 學員掉太快 → flagged（體重單訊號也能 flag）', () => {
    const r = computeFatigueFlag({ wellness: okWellness, weights: fastDrop, goalType: 'cut', todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: true, confidence: 'normal', signals: { wellness: false, weight: true } })
    expect(r!.reasons.join('')).toContain('體重掉速')
    expect(r!.weightWeeklyLossPct).toBeGreaterThan(FATIGUE_WEIGHT_DROP_PCT_PER_WEEK)
  })

  it('cut 學員掉速正常 → 不 flag，confidence normal（兩訊號都評估了）', () => {
    const r = computeFatigueFlag({ wellness: okWellness, weights: okDrop, goalType: 'cut', todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: false, confidence: 'normal', signals: { weight: false } })
  })

  it('非 cut 非備賽 → 體重訊號不評估（weight: null）、confidence low', () => {
    const r = computeFatigueFlag({ wellness: okWellness, weights: fastDrop, goalType: 'bulk', todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: false, confidence: 'low', signals: { weight: null } })
    expect(r!.weightWeeklyLossPct).toBeNull()
  })

  it('bulk 但備賽（isPrep）→ 體重訊號要評估', () => {
    const r = computeFatigueFlag({ wellness: okWellness, weights: fastDrop, goalType: 'bulk', isPrep: true, todayTaipei: TODAY })
    expect(r!.signals.weight).toBe(true)
    expect(r!.flagged).toBe(true)
  })

  it('14 天窗 <5 筆 → 體重訊號跳過、只剩 wellness 單訊號 → confidence low', () => {
    const few = makeWeights(80, 0.25, 4)
    const r = computeFatigueFlag({ wellness: okWellness, weights: few, goalType: 'cut', todayTaipei: TODAY })
    expect(r).toMatchObject({ confidence: 'low', signals: { weight: null } })
  })

  it('體重在漲（bulk 中的 cut 標錯也一樣）→ 不觸發掉速訊號', () => {
    const gaining = makeWeights(80, -0.25) // 每天 +0.25kg
    const r = computeFatigueFlag({ wellness: okWellness, weights: gaining, goalType: 'cut', todayTaipei: TODAY })
    expect(r!.signals.weight).toBe(false)
    expect(r!.flagged).toBe(false)
  })

  it('wellness 連 2 週低 + cut 掉太快 → 兩個 reasons、confidence normal', () => {
    const r = computeFatigueFlag({ wellness: makeWellness(3.0, 3.4, 4.0), weights: fastDrop, goalType: 'cut', todayTaipei: TODAY })
    expect(r).toMatchObject({ flagged: true, confidence: 'normal', signals: { wellness: true, weight: true } })
    expect(r!.reasons).toHaveLength(2)
  })
})

describe('computeFatigueFlag — 常數（Howard 校準單一入口）', () => {
  it('拍板值：0.5 分、1.5%/週', () => {
    expect(FATIGUE_WELLNESS_DROP).toBe(0.5)
    expect(FATIGUE_WEIGHT_DROP_PCT_PER_WEEK).toBe(1.5)
  })
})
