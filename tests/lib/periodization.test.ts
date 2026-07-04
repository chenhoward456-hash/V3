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
