import { describe, it, expect } from 'vitest'
import { readSignals, dropWaterSpikeDays, findWaterSpikes } from '@/lib/coach-signals'

// 震宣 2026-09-22 → 10-06 真實資料（處方 2070 / P170）
const zxW: [string, number][] = [
  ['2026-09-22', 82.25], ['2026-09-23', 82.45], ['2026-09-24', 82.05], ['2026-09-25', 82.15], ['2026-09-26', 81.7],
  ['2026-09-27', 82.65], ['2026-09-28', 81.7], ['2026-09-29', 81.9], ['2026-09-30', 82.05], ['2026-10-01', 81.2],
  ['2026-10-03', 84.0], ['2026-10-05', 83.6], ['2026-10-06', 82.2],
]
const zxN: [string, number, number, number][] = [
  ['2026-09-23', 2177, 187, 229], ['2026-09-24', 2528, 182, 252], ['2026-09-25', 2043, 156, 222], ['2026-09-26', 2935, 165, 211],
  ['2026-09-27', 1413, 99, 176], ['2026-09-28', 2302, 179, 194], ['2026-09-29', 2073, 165, 234], ['2026-09-30', 1938, 155, 199],
  ['2026-10-01', 2328, 145, 230], ['2026-10-02', 3352, 191, 377], ['2026-10-03', 1460, 103, 136], ['2026-10-04', 2170, 99, 268],
  ['2026-10-05', 1865, 125, 195], ['2026-10-06', 1832, 151, 217],
]
const zx = {
  caloriesTarget: 2070, proteinTarget: 170, today: '2026-10-07',
  weights: zxW.map(([date, weight]) => ({ date, weight })),
  nutrition: zxN.map(([date, calories, protein_grams, carbs_grams]) => ({ date, calories, protein_grams, carbs_grams })),
  training: [],
}

describe('震宣：84.0 是水', () => {
  const sig = readSignals(zx)

  it('把 10/3 的 84.0 認成 10/2 大餐的水，並講出已回到 82.2', () => {
    const w = sig.find(s => s.kind === 'water_spike')!
    expect(w.sev).toBe(3)
    expect(w.text).toContain('10/3 的 84.0')
    expect(w.text).toContain('10/2 吃 3352')
    expect(w.text).toContain('10/6 已回到 82.2')
  })

  it('趨勢計算時拿掉水腫那幾天（10/3、10/5），保留 10/6', () => {
    const kept = dropWaterSpikeDays(zx.weights, zx.nutrition, 2070).map(w => w.date)
    expect(kept).not.toContain('2026-10-03')
    expect(kept).not.toContain('2026-10-05')
    expect(kept).toContain('2026-10-06')
  })

  it('抓到兩次爆吃→隔天補償', () => {
    const b = sig.find(s => s.kind === 'binge_compensate')!
    expect(b.text).toContain('2 次')
    expect(b.text).toContain('9/26 2935→1413')
    expect(b.text).toContain('10/2 3352→1460')
    expect(b.text).toContain('~101g')
  })

  it('蛋白不足天數', () => {
    expect(sig.find(s => s.kind === 'protein_low')?.text).toMatch(/不到 136g（目標 170）/)
  })
})

describe('林宥任：空窗＋訓練筆記的問題', () => {
  const sig = readSignals({
    caloriesTarget: 2121, proteinTarget: 175, today: '2026-10-07',
    weights: [['2026-09-23', 88.6], ['2026-09-28', 88.2], ['2026-10-05', 88.2], ['2026-10-06', 87.6]].map(([date, weight]) => ({ date: date as string, weight: weight as number })),
    nutrition: [['2026-09-24', 2145, 115], ['2026-09-25', 2040, 100], ['2026-09-28', 2140, 140], ['2026-09-29', 2105, 180], ['2026-10-04', 2440, 175], ['2026-10-05', 2055, 155], ['2026-10-06', 2385, 125]]
      .map(([date, calories, protein_grams]) => ({ date: date as string, calories: calories as number, protein_grams: protein_grams as number })),
    training: [
      { date: '2026-09-23', note: '臀推 格數調錯 要在做慢一點\n坐姿划船 不確定背是不是要延展出去' },
      { date: '2026-09-25', note: null },
      { date: '2026-09-28', note: '划船輕重量比較有感覺\n分腿蹲 距離抓不太好' },
      { date: '2026-09-29', note: null },
      { date: '2026-10-05', note: null },
      { date: '2026-10-06', note: null },
    ],
  })

  it('抓到 9/30–10/3 四天空窗', () => {
    expect(sig.find(s => s.kind === 'log_gap')?.text).toContain('9/30–10/3 連續 4 天')
  })

  it('把「背是不是要延展出去」當成問題列出來', () => {
    expect(sig.some(s => s.text.includes('他問：「坐姿划船 不確定背是不是要延展出去」'))).toBe(true)
  })

  it('動作感受問題也列出', () => {
    expect(sig.some(s => s.text.includes('分腿蹲 距離抓不太好'))).toBe(true)
  })

  it('沒有大餐就不會亂報水腫', () => {
    expect(sig.some(s => s.kind === 'water_spike')).toBe(false)
  })
})

describe('不誤報', () => {
  it('體重跳但前一天沒大餐 → 不當成水', () => {
    expect(findWaterSpikes(
      [{ date: '2026-10-01', weight: 80 }, { date: '2026-10-02', weight: 81.5 }],
      [{ date: '2026-10-01', calories: 2000 }],
      2000,
    )).toHaveLength(0)
  })
  it('沒有處方就不判', () => {
    expect(readSignals({ ...zx, caloriesTarget: null }).some(s => s.kind === 'water_spike' || s.kind === 'binge_compensate')).toBe(false)
  })
})
