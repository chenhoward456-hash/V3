import { describe, it, expect } from 'vitest'
import { computeWeeklyCoachingDraft, FAT_FLOOR_PCT, type WCInput } from '@/lib/weekly-coaching'

/**
 * 週訊草稿的兩條紅線（2026-09-19）。
 *
 * 這支草稿會**直接發給學員**，所以錯的話是錯在學員臉上。
 * 兩個實際踩到的問題，都在震宣身上：
 *   1. 草稿說「體重持平」—— 但那是碳水回補的水，他其實在掉 0.53kg/週
 *   2. 草稿說「蛋白拉到至少 148g」—— 但 Howard 開的處方是 170g（引擎把教練設定往下砍）
 */

const days = (n: number, from: string) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10))

const base = (o: Partial<WCInput> = {}): WCInput => ({
  client: {
    id: 'x', name: '震宣', unique_code: 'Q', goal_type: 'cut',
    target_weight: 77, calories_target: 2070, protein_target: 170,
  } as never,
  weights: [], nutrition: [], training: [], wellness: [], labs: [],
  now: '2026-09-18',
  ...o,
})

describe('🚨 紅線 3：引擎不可以把教練的處方往下砍', () => {
  it('蛋白不足時要他拉到「教練設定」，不是拉到實證下限', () => {
    // 震宣真實數字：處方 P170、體重 82.45（下限 1.8×82.45 = 148）、實際吃 138
    const d = computeWeeklyCoachingDraft(base({
      weights: days(14, '2026-09-05').map(date => ({ date, weight: 82.45 })),
      nutrition: days(14, '2026-09-05').map(date => ({ date, calories: 2075, protein_grams: 138 })),
    }))
    const adj = d.adjustments.join(' ')
    expect(adj).toContain('170')          // 教練的數字
    expect(adj).toContain('教練設定')
    expect(adj).not.toMatch(/拉到至少 148/)  // 不可以把 170 砍成 148
  })

  it('教練處方本身低於實證下限 → 那是要教練看的，不是叫學員照著吃', () => {
    const d = computeWeeklyCoachingDraft(base({
      client: { id: 'x', name: 'A', unique_code: 'A', goal_type: 'cut', calories_target: 2000, protein_target: 100 } as never,
      weights: days(14, '2026-09-05').map(date => ({ date, weight: 82 })),
      nutrition: days(14, '2026-09-05').map(date => ({ date, calories: 2000, protein_grams: 90 })),
    }))
    expect(d.needsCoachReview).toBe(true)
    expect(d.flags.join(' ')).toContain('低於')
  })
})

describe('🚨 碳水回補期不可以跟學員說「你持平」', () => {
  const carbUp = (date: string) => [{
    applied_at: `${date}T01:00:00Z`,
    old_macros: { carbs_target: 156 }, new_macros: { carbs_target: 224 },
  }]

  it('回補窗內：不下趨勢結論，直接講原因', () => {
    const d = computeWeeklyCoachingDraft(base({
      now: '2026-09-18',
      macroLog: carbUp('2026-09-15'),                      // 3 天前調高碳水
      weights: days(14, '2026-09-05').map(date => ({ date, weight: 82.45 })),
      nutrition: days(14, '2026-09-05').map(date => ({ date, calories: 2075, protein_grams: 170 })),
    }))
    const text = d.bullets.join(' ')
    expect(text).toContain('肝醣')
    expect(text).not.toContain('持平')
  })

  it('🚨 窗過了要把那幾天從趨勢裡扣掉 —— 否則真實的下降會被水蓋掉', () => {
    // 震宣真實資料：碳水 8/25 調高，前 14 天是水，之後才是真趨勢
    const raw: [string, number][] = [
      ['2026-09-05',81.75],['2026-09-07',82.5],['2026-09-08',82.6],['2026-09-10',83],
      ['2026-09-11',82.8],['2026-09-12',82.8],['2026-09-14',83],['2026-09-15',82.15],
      ['2026-09-16',82.4],['2026-09-17',81.9],['2026-09-18',82.45],
    ]
    const weights = raw.map(([date, weight]) => ({ date, weight }))
    const nutrition = raw.map(([date]) => ({ date, calories: 2075, protein_grams: 170 }))

    const withWater = computeWeeklyCoachingDraft(base({ weights, nutrition }))
    const without = computeWeeklyCoachingDraft(base({ weights, nutrition, macroLog: carbUp('2026-08-25') }))

    expect(withWater.headline).toContain('持平')            // 含水 → 看起來卡住
    expect(without.headline).toContain('下降')              // 扣掉 → 真實下降
    expect(without.headline).toContain('已扣掉碳水回補')     // 而且要講出來，不能偷偷改數字
  })

  it('沒有碳水調整時行為完全不變', () => {
    const weights = days(14, '2026-09-05').map(date => ({ date, weight: 82.45 }))
    const a = computeWeeklyCoachingDraft(base({ weights }))
    const b = computeWeeklyCoachingDraft(base({ weights, macroLog: [] }))
    expect(a.headline).toBe(b.headline)
  })
})

describe('脂肪（Howard 2026-09-19：「應該提醒他脂肪要控制更仔細」）', () => {
  const feed = (o: { cal: number; p: number; f: number }) => ({
    weights: days(14, '2026-09-05').map(date => ({ date, weight: 82.45 })),
    nutrition: days(14, '2026-09-05').map(date => ({ date, calories: o.cal, protein_grams: o.p, fat_grams: o.f })),
  })

  it('🚨 脂肪超標 + 蛋白不足 → 要講成「換位置」，不是兩條各自的指令', () => {
    // 震宣真實數字：熱量 2075、蛋白 138/170、脂肪 70/55
    const d = computeWeeklyCoachingDraft(base({
      client: { name: '震宣', goal_type: 'cut', calories_target: 2070, protein_target: 170, fat_target: 55 } as never,
      ...feed({ cal: 2075, p: 138, f: 70 }),
    }))
    const adj = d.adjustments.join(' ')
    expect(adj).toContain('換位置')
    expect(adj).toContain('55')
    expect(d.bullets.join(' ')).toContain('拿蛋白換脂肪')
  })

  it('🚨 要講出「為什麼脂肪要抓更細」—— 9 大卡 vs 4 大卡', () => {
    const d = computeWeeklyCoachingDraft(base({
      client: { name: 'A', goal_type: 'cut', calories_target: 2070, protein_target: 170, fat_target: 55 } as never,
      ...feed({ cal: 2075, p: 138, f: 70 }),
    }))
    const adj = d.adjustments.join(' ')
    expect(adj).toContain('9 大卡')
    expect(adj).toContain('油和醬')
  })

  it(`脂肪低於 ${FAT_FLOOR_PCT}% 熱量 → 地板優先，叫他往上加不是往下砍`, () => {
    // 2000 kcal 的 20% = 400 kcal = 44g。給 30g（13.5%）
    const d = computeWeeklyCoachingDraft(base({
      client: { name: 'A', goal_type: 'cut', calories_target: 2000, protein_target: 150, fat_target: 55 } as never,
      ...feed({ cal: 2000, p: 160, f: 30 }),
    }))
    const adj = d.adjustments.join(' ')
    expect(adj).toContain('脂肪拉到至少')
    expect(adj).toContain('荷爾蒙')
    expect(adj).not.toContain('收回')
  })

  it('🚨 脂肪低於教練目標但在地板之上 → 不要吵（Howard 的做法本來就是把脂肪調低）', () => {
    // 林宥任真實數字：熱量 2140、脂肪 52/69 → 52×9/2140 = 21.9%，在 20% 地板之上
    const d = computeWeeklyCoachingDraft(base({
      client: { name: '林宥任', goal_type: 'cut', calories_target: 2121, protein_target: 193, fat_target: 69 } as never,
      ...feed({ cal: 2140, p: 152, f: 52 }),
    }))
    expect(d.bullets.join(' ')).not.toContain('🥑')
    expect(d.adjustments.join(' ')).not.toContain('脂肪')
  })

  it('沒記脂肪就不要講脂肪（不要拿 undefined 當 0）', () => {
    const d = computeWeeklyCoachingDraft(base({
      weights: days(14, '2026-09-05').map(date => ({ date, weight: 82.45 })),
      nutrition: days(14, '2026-09-05').map(date => ({ date, calories: 2075, protein_grams: 170 })),
    }))
    expect(d.bullets.join(' ')).not.toContain('🥑')
  })
})
