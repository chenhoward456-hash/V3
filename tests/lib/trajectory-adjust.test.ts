import { describe, it, expect } from 'vitest'
import { computeTrajectoryAdjustment, type TrajectoryInput } from '@/lib/trajectory-adjust'

// 產生 N 週、體重平緩的每週量測（currentRate ≈ 0），讓引擎依目標/期限算出赤字
function flatEntries(weight: number, weeks = 8): Array<{ date: string; weight: number }> {
  const out: Array<{ date: string; weight: number }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let weeksAgo = weeks - 1; weeksAgo >= 0; weeksAgo--) {
    for (const dayOffset of [0, 3, 6]) {
      const d = new Date(today)
      d.setDate(today.getDate() - weeksAgo * 7 - dayOffset)
      out.push({ date: d.toISOString().split('T')[0], weight })
    }
  }
  return out
}

function dateInDays(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// 基礎 cut 情境：82kg 平緩、目標 80kg、35 天 → 想砍約 -440 kcal/天（不撞 min_calories）
function baseInput(overrides: Partial<TrajectoryInput> = {}): TrajectoryInput {
  return {
    bodyDataEntries: flatEntries(82),
    goalType: 'cut',
    targetWeight: 80,
    targetDate: dateInDays(35),
    currentCalories: 2200,
    currentProtein: 170,
    currentFat: 60,
    currentCarbs: 200,
    currentCarbsTrainingDay: null,
    currentCarbsRestDay: null,
    gender: 'male',
    bounds: null,
    lastAdjustAt: null,
    ...overrides,
  }
}

describe('computeTrajectoryAdjustment — 基因 + 體脂安全層', () => {
  it('沒給基因/體脂時，行為與舊版相同（backward compat）', () => {
    const withoutFields = computeTrajectoryAdjustment(baseInput())
    const withInertFields = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 25, geneticProfile: { mthfr: 'normal', serotonin: 'LL' } }))
    expect(withoutFields.shouldAdjust).toBe(true)
    expect(withInertFields.newMacros?.calories_target).toBe(withoutFields.newMacros?.calories_target)
    // 正常體脂 + 無突變 → 不應出現任何基因/體脂 boundary note
    expect(withInertFields.boundaryDetail ?? '').not.toMatch(/體脂|MTHFR|5-HTTLPR/)
  })

  it('體脂低於安全下限 → 每日赤字限縮到 -500（不砍到 min_calories）', () => {
    // 更激進的目標 → raw 赤字 > 500 + > min_calories 可承受範圍
    const aggressive = { targetWeight: 78, targetDate: dateInDays(35) }
    const normalBf = computeTrajectoryAdjustment(baseInput({ ...aggressive, bodyFatPct: 25 }))
    const lowBf = computeTrajectoryAdjustment(baseInput({ ...aggressive, bodyFatPct: 8 }))

    expect(lowBf.shouldAdjust).toBe(true)
    // 低體脂被體脂下限保護：赤字較小（熱量較高）
    expect(lowBf.newMacros!.calories_target).toBeGreaterThan(normalBf.newMacros!.calories_target)
    // 赤字幅度不超過 500
    expect(Math.abs(lowBf.kcalAdjustment!)).toBeLessThanOrEqual(500)
    expect(lowBf.hitBoundary).toBe(true)
    expect(lowBf.boundaryDetail).toMatch(/體脂.*安全下限/)
  })

  it('中文性別「女性」14% 體脂 → 套用女性下限 16% 保護（性別字串 bug 修正）', () => {
    const aggressive = { targetWeight: 78, targetDate: dateInDays(35) }
    // 14% 介於女性下限(16) 與男性下限(10) 之間：bug 版會誤判沒過下限而裸奔
    const female = computeTrajectoryAdjustment(baseInput({ ...aggressive, gender: '女性', bodyFatPct: 14 }))
    expect(female.hitBoundary).toBe(true)
    expect(female.boundaryDetail).toMatch(/安全下限 16%/)
    expect(Math.abs(female.kcalAdjustment!)).toBeLessThanOrEqual(500)
  })

  it('最新體重 >14 天沒記錄 → stale_data，不給建議（William 案例）', () => {
    // 8 週資料但整體往前推 20 天 → 最新一筆 = 20 天前
    const stale = flatEntries(82).map(e => {
      const d = new Date(e.date); d.setDate(d.getDate() - 20)
      return { date: d.toISOString().split('T')[0], weight: e.weight }
    })
    const r = computeTrajectoryAdjustment(baseInput({ bodyDataEntries: stale }))
    expect(r.shouldAdjust).toBe(false)
    expect(r.skipCategory).toBe('stale_data')
    expect(r.reason).toMatch(/未記錄/)
  })

  it('MTHFR 雜合突變 → 赤字收窄約 100 kcal（吃更多）', () => {
    const noGene = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20 }))
    const mthfrHet = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20, geneticProfile: { mthfr: 'heterozygous' } }))

    expect(mthfrHet.shouldAdjust).toBe(true)
    const diff = mthfrHet.newMacros!.calories_target - noGene.newMacros!.calories_target
    expect(diff).toBeGreaterThanOrEqual(90) // 約 +100（rounding 容差）
    expect(diff).toBeLessThanOrEqual(110)
    expect(mthfrHet.boundaryDetail).toMatch(/MTHFR.*雜合/)
  })

  it('5-HTTLPR SL → 碳水不低於 100g，赤字被碳水下限限縮', () => {
    const noGene = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20 }))
    const serotonin = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20, geneticProfile: { serotonin: 'SL' } }))

    expect(serotonin.shouldAdjust).toBe(true)
    // 碳水下限保護 → 碳水不低於 100g
    expect(serotonin.newMacros!.carbs_target).toBeGreaterThanOrEqual(100)
    // 赤字較小（熱量較高）
    expect(serotonin.newMacros!.calories_target).toBeGreaterThan(noGene.newMacros!.calories_target)
    expect(serotonin.boundaryDetail).toMatch(/5-HTTLPR/)
  })

  it('增肌（surplus）方向不受基因/體脂安全層影響', () => {
    // bulk + 目標體重高於現況 → 正向調整，不應被赤字保護觸發
    const bulk = computeTrajectoryAdjustment(baseInput({
      goalType: 'bulk', targetWeight: 86, bodyFatPct: 8,
      geneticProfile: { mthfr: 'homozygous', serotonin: 'SS' },
    }))
    if (bulk.shouldAdjust) {
      expect(bulk.boundaryDetail ?? '').not.toMatch(/體脂|MTHFR|5-HTTLPR/)
    }
  })
})

// ── 目標可行性 / 增肌上限 / 熱量天花板（2026-08-11 補洞）──
// 真實事故：孫凡鈞 target_date 剩 4 天、還差 9kg（bulk）→ 引擎算出需 15.17kg/週、
// 加 16131 kcal/天，直接寫進 DB（calories_target 19070 / carbs_target 4402）。
// 根因：needed rate 沒有合理性檢查，且 max_loss_per_week 只在 goalType==='cut' 時檢查。
describe('目標不可行時不用熱量硬追', () => {
  it('剩 4 天要增 9kg → 不調整，標記 target_unrealistic 交給教練重設目標', () => {
    const r = computeTrajectoryAdjustment(baseInput({
      goalType: 'bulk',
      bodyDataEntries: flatEntries(84),
      targetWeight: 93,
      targetDate: dateInDays(4),
      currentCalories: 2939,
      currentCarbs: 367,
    }))
    expect(r.shouldAdjust).toBe(false)
    expect(r.skipCategory).toBe('target_unrealistic')
    expect(r.newMacros).toBeNull()
    expect(r.reason).toContain('目標不可行')
  })

  it('減脂側同樣擋：剩 5 天要掉 8kg → 不調整', () => {
    const r = computeTrajectoryAdjustment(baseInput({
      bodyDataEntries: flatEntries(82),
      targetWeight: 74,
      targetDate: dateInDays(5),
    }))
    expect(r.shouldAdjust).toBe(false)
    expect(r.skipCategory).toBe('target_unrealistic')
  })

  it('可行的目標不受影響（回歸保護）', () => {
    const r = computeTrajectoryAdjustment(baseInput())
    expect(r.skipCategory).not.toBe('target_unrealistic')
    expect(r.shouldAdjust).toBe(true)
  })
})

describe('增肌側上限與熱量天花板', () => {
  it('bulk 進度落後但目標仍可行時，加幅被 max_gain_per_week 收住', () => {
    // 80kg → max_gain_per_week = 0.4 kg/週。目標 84kg / 60 天 ≈ 需 0.47 kg/週
    const r = computeTrajectoryAdjustment(baseInput({
      goalType: 'bulk',
      bodyDataEntries: flatEntries(80),
      targetWeight: 84,
      targetDate: dateInDays(60),
      currentCalories: 2600,
      currentCarbs: 300,
    }))
    expect(r.shouldAdjust).toBe(true)
    expect(r.hitBoundary).toBe(true)
    expect(r.boundaryDetail).toContain('max_gain_per_week')
    // 撞上限後的每週增重不會超過 0.4kg → 每日加幅 ≤ 0.4*7700/7 = 440
    expect(r.kcalAdjustment!).toBeLessThanOrEqual(440)
  })

  it('寫進 DB 的熱量永遠不超過天花板（80kg → 3600 kcal）', () => {
    const r = computeTrajectoryAdjustment(baseInput({
      goalType: 'bulk',
      bodyDataEntries: flatEntries(80),
      targetWeight: 84,
      targetDate: dateInDays(60),
      currentCalories: 3500,
      currentCarbs: 400,
      bounds: { max_gain_per_week: 5 } as never,  // 故意放寬速率上限，只測天花板這一層
    }))
    if (r.shouldAdjust) {
      expect(r.newMacros!.calories_target).toBeLessThanOrEqual(80 * 45)
    }
  })
})

describe('階段轉換：8 週回歸被 V 字洗掉（2026-08-16 陳胤豪真實案例）', () => {
  /** 產生每日體重：先降 daysDown 天，再升 daysUp 天 */
  function vShape(from: number, downPerDay: number, daysDown: number, upPerDay: number, daysUp: number) {
    const out: Array<{ date: string; weight: number }> = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const total = daysDown + daysUp
    let w = from
    for (let i = 0; i < total; i++) {
      const d = new Date(today.getTime() - (total - 1 - i) * 86400000)
      w += i < daysDown ? downPerDay : upPerDay
      out.push({ date: d.toISOString().slice(0, 10), weight: +w.toFixed(2) })
    }
    return out
  }

  const base = {
    goalType: 'bulk' as const,
    targetWeight: 86,
    targetDate: '2027-02-13',
    currentCalories: 3000,
    currentProtein: 175,
    currentFat: 85,
    currentCarbs: 385,
    currentCarbsTrainingDay: 420,
    currentCarbsRestDay: 350,
    gender: 'male',
    bounds: null,
    lastAdjustAt: null,
  }

  it('備賽減脂→賽後增肌的 V 字，不能被平均成「進度跟得上」', () => {
    // 前 28 天每天 -0.1（84 → 81.2），後 28 天每天 +0.065（→ 83.0）
    const body = vShape(84, -0.1, 28, 0.065, 28)
    const r = computeTrajectoryAdjustment({ ...base, bodyDataEntries: body })

    // 8 週回歸會把 V 字抵消趨近 0；取近 3 週後必須看得到「在漲」
    expect(r.currentRatePerWeek).not.toBeNull()
    expect(r.currentRatePerWeek!).toBeGreaterThan(0.3)
    expect(r.shouldAdjust).toBe(true)
    expect(r.kcalAdjustment!).toBeLessThan(0)   // bulk 漲太快 → 往下砍
  })

  it('cut 取較嚴格側：近期掉太快時不能被舊的平緩段稀釋', () => {
    // 前 28 天幾乎不動，後 28 天每天 -0.12（掉很快）
    const body = vShape(80, 0.005, 28, -0.12, 28)
    const r = computeTrajectoryAdjustment({
      ...base, goalType: 'cut', targetWeight: 74, bodyDataEntries: body,
    })
    expect(r.currentRatePerWeek!).toBeLessThan(-0.5)
  })

  it('單一方向的資料，兩種窗口結論一致（不因這個修改而變動）', () => {
    const body = vShape(80, 0.03, 28, 0.03, 28)   // 全程穩定微升
    const r = computeTrajectoryAdjustment({ ...base, bodyDataEntries: body })
    expect(r.currentRatePerWeek!).toBeGreaterThan(0.1)
    expect(r.currentRatePerWeek!).toBeLessThan(0.35)
  })
})
