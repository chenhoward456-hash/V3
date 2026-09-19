import { describe, it, expect } from 'vitest'
import {
  prescriptionVerdict, estimateActualIntake,
  lastCarbIncreaseDate, inCarbRepletionWindow, carbRepletionCutoff,
  CARB_REPLETION_DAYS, CARB_INCREASE_G,
} from '@/lib/implied-intake'

/**
 * 碳水回補期 ＋ 「不要講你不知道的事」。
 *
 * 這兩條都來自 2026-09-19 的一次實際冤枉：
 * 震宣飲食記 25/28 天、平均 2075（處方 2070）、在超商買東西還拍熱量給教練看，
 * 系統卻判他「實際吃 2612，多 542 —— 這是執行超出處方」，
 * 而那句話印在他自己的首頁上。Howard：「他有拍給我看耶，就是這麼的自律啊！」
 *
 * 兩個獨立的錯：
 *   1. impliedDaily 是「處方 + 沒掉到預期速度的差額」，跟他吃多少無關 → 不能拿來斷定執行
 *   2. 碳水 8/25 從 156 拉到 224，肝醣＋水回補把真實下降蓋掉 → 體重趨勢當時不可信
 */

describe('要斷定「執行超出處方」必須有獨立證據', () => {
  const r = { impliedDaily: 2612, targetCalories: 2070 }

  it('🚨 他記的跟處方對得上 → 不可以說他多吃', () => {
    const v = prescriptionVerdict(r, 2075)
    expect(v.cause).toBe('undetermined')
    expect(v.adjustPrescription).toBe(false)   // 仍然不自動砍（保留 2026-08-16 的教訓）
    expect(v.reason).not.toContain('執行超出')
    expect(v.reason).toContain('處方本身開在他的維持熱量上')
  })

  it('他自己記的就超過處方 → 才可以斷定（那是他自己寫的）', () => {
    const v = prescriptionVerdict(r, 2700)
    expect(v.cause).toBe('execution')
    expect(v.reason).toContain('執行超出處方')
  })

  it('沒有飲食紀錄 → 分不出來，不猜', () => {
    const v = prescriptionVerdict(r, null)
    expect(v.cause).toBe('undetermined')
    expect(v.reason).toContain('沒有飲食紀錄')
  })

  it('掉太快仍然要攔（沒吃到處方）', () => {
    expect(prescriptionVerdict({ impliedDaily: 1500, targetCalories: 2070 }, 1600).cause).toBe('under-eating')
  })

  it('速率正常 → 才輪到處方本身要調', () => {
    expect(prescriptionVerdict({ impliedDaily: 2100, targetCalories: 2070 }, 2080).cause).toBe('prescription')
  })
})

describe('碳水回補期', () => {
  const log = (date: string, oldC: number, newC: number) =>
    ({ applied_at: `${date}T01:00:00Z`, old_macros: { carbs_target: oldC }, new_macros: { carbs_target: newC } })

  it('抓得到最近一次碳水往上調', () => {
    // 震宣真實紀錄：8/25 從 156 → 224
    expect(lastCarbIncreaseDate([log('2026-08-25', 156, 224)])).toBe('2026-08-25')
  })

  it('往下調不算，小幅微調也不算', () => {
    expect(lastCarbIncreaseDate([log('2026-08-25', 224, 156)])).toBeNull()
    expect(lastCarbIncreaseDate([log('2026-08-25', 200, 200 + CARB_INCREASE_G - 1)])).toBeNull()
  })

  it('多次調整取最近那次', () => {
    expect(lastCarbIncreaseDate([log('2026-08-01', 150, 200), log('2026-09-01', 200, 250)])).toBe('2026-09-01')
  })

  it(`回補窗 ${CARB_REPLETION_DAYS} 天內不下任何判斷`, () => {
    const v = prescriptionVerdict({ impliedDaily: 2612, targetCalories: 2070 }, 2075, true)
    expect(v.cause).toBe('carb-repletion')
    expect(v.adjustPrescription).toBe(false)
    expect(v.reason).toContain('肝醣')
  })

  it('窗的邊界', () => {
    expect(inCarbRepletionWindow('2026-09-01', '2026-09-01')).toBe(true)
    expect(inCarbRepletionWindow('2026-09-01', `2026-09-${String(CARB_REPLETION_DAYS).padStart(2, '0')}`)).toBe(true)
    expect(inCarbRepletionWindow('2026-09-01', '2026-09-16')).toBe(false)
    expect(inCarbRepletionWindow(null, '2026-09-16')).toBe(false)
  })

  it('🚨 窗過了還要把那幾天從回歸裡丟掉 —— 否則它們會一路把斜率拉平', () => {
    // 震宣真實資料：碳水 8/25 調升，體重從 8/26 開始
    const raw = [
      ['2026-08-26',82.6],['2026-08-27',82.05],['2026-08-28',82.3],['2026-08-29',82.55],
      ['2026-08-30',82.8],['2026-08-31',82.7],['2026-09-01',82.65],['2026-09-02',81.75],
      ['2026-09-03',82.15],['2026-09-04',83.2],['2026-09-05',81.75],['2026-09-07',82.5],
      ['2026-09-08',82.6],['2026-09-10',83],['2026-09-11',82.8],['2026-09-12',82.8],
      ['2026-09-14',83],['2026-09-15',82.15],['2026-09-16',82.4],['2026-09-17',81.9],['2026-09-18',82.45],
    ].map(([date, weight]) => ({ date: date as string, weight: weight as number }))

    const withRepletion = estimateActualIntake(raw, 2070, 'cut', 28)!
    const cutoff = carbRepletionCutoff('2026-08-25')       // 2026-09-08
    const without = estimateActualIntake(raw, 2070, 'cut', 28, cutoff)!

    expect(cutoff).toBe('2026-09-08')
    // 含回補期：看起來完全沒掉
    expect(withRepletion.slopePerWeek).toBeGreaterThan(-0.2)
    // 扣掉之後：真實下降出現，接近目標 -0.5
    expect(without.slopePerWeek).toBeLessThan(-0.35)
  })

  it('沒有碳水調整就不排除任何東西', () => {
    expect(carbRepletionCutoff(null)).toBeNull()
  })
})
