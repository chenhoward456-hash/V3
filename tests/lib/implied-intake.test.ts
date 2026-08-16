import { describe, it, expect } from 'vitest'
import { reconcileIntake, isGapSignificant, reconciliationMessage, prescriptionVerdict } from '@/lib/implied-intake'

const DAY = 86400000

function weightSeries(start: string, days: number, from: number, slopePerDay: number) {
  const t0 = new Date(start + 'T00:00:00').getTime()
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(t0 + i * DAY).toISOString().slice(0, 10),
    weight: +(from + slopePerDay * i).toFixed(2),
  }))
}

function nutritionSeries(start: string, days: number, kcal: number) {
  const t0 = new Date(start + 'T00:00:00').getTime()
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(t0 + i * DAY).toISOString().slice(0, 10),
    calories: kcal,
  }))
}

describe('從體重反推實際攝取', () => {
  it('Howard 2026-08 的真實情境：記 3145、體重每週漲 1.1kg → 推算約 4000', () => {
    // 維持熱量 2780、13 天漲 2.5kg（約 +1.35kg/週）
    const w = weightSeries('2026-08-03', 14, 80.5, 0.18)
    const n = nutritionSeries('2026-08-03', 12, 3145)
    const r = reconcileIntake(w, n, 3000, 'bulk')
    expect(r).not.toBeNull()
    expect(r!.impliedDaily).toBeGreaterThan(3900)
    expect(r!.gap).toBeGreaterThan(700)
    expect(isGapSignificant(r)).toBe(true)
  })

  it('紀錄與體重一致時 gap 很小，不該開口', () => {
    // 維持 2780、每天 +0.03kg（≈0.2kg/週）→ 實際約 2780+231 = 3011，紀錄 3000
    const w = weightSeries('2026-08-01', 21, 80, 0.03)
    const n = nutritionSeries('2026-08-01', 20, 3000)
    const r = reconcileIntake(w, n, 3000, 'bulk')
    expect(r).not.toBeNull()
    expect(Math.abs(r!.gap)).toBeLessThan(300)
    expect(isGapSignificant(r)).toBe(false)
  })

  it('William 的真實情境：目標 3150、記 2230、體重 19 天不動 → 實際約 2930，他連紀錄都低報', () => {
    // ⚠️ 這支測試改過一次：原本我假設他「記 3150」，但他實際記的是 1815/2320/2555。
    // 用真實數字跑出來的結論跟我原本的診斷不同 —— 體重不動代表他其實吃在維持附近(≈2930)，
    // 而他記的只有 2230。所以他不只「相對目標少吃」，連紀錄本身都比實際少 700。
    const w = weightSeries('2026-07-02', 19, 71.8, 0)
    const n = nutritionSeries('2026-07-02', 10, 2230)
    const r = reconcileIntake(w, n, 3150, 'bulk')
    expect(r).not.toBeNull()
    expect(r!.impliedDaily).toBeGreaterThan(2800)   // 體重不動 ⇒ 吃在維持附近
    expect(r!.gap).toBeGreaterThan(600)             // 實際比紀錄多 ⇒ 紀錄低報
    expect(isGapSignificant(r)).toBe(true)
  })

  it('紀錄真的高於實際時給另一句話（別再往下減）', () => {
    // cut 目標，但掉得比計畫慢很多 → implied 低於紀錄
    const w = weightSeries('2026-08-01', 21, 60, -0.14)  // ≈ -1.0kg/週，比 cut 預設 -0.5 快
    const n = nutritionSeries('2026-08-01', 20, 1800)
    const r = reconcileIntake(w, n, 1800, 'cut')
    expect(r).not.toBeNull()
    expect(r!.gap).toBeLessThan(-300)
    expect(reconciliationMessage(r!)).toContain('少')
  })

  it('體重筆數不足 → null（寧可不說話）', () => {
    const w = weightSeries('2026-08-01', 5, 80, 0.1)
    const n = nutritionSeries('2026-08-01', 10, 3000)
    expect(reconcileIntake(w, n, 3000, 'bulk')).toBeNull()
  })

  it('跨度太短 → null（同一天量八次不算）', () => {
    const w = Array.from({ length: 9 }, () => ({ date: '2026-08-01', weight: 80 }))
    const n = nutritionSeries('2026-08-01', 10, 3000)
    expect(reconcileIntake(w, n, 3000, 'bulk')).toBeNull()
  })

  it('飲食紀錄太少 → null（那是「沒在記」，另一種問題）', () => {
    const w = weightSeries('2026-08-01', 21, 80, 0.1)
    const n = nutritionSeries('2026-08-01', 3, 3000)
    expect(reconcileIntake(w, n, 3000, 'bulk')).toBeNull()
  })

  it('維持熱量無效 → null', () => {
    const w = weightSeries('2026-08-01', 21, 80, 0.1)
    const n = nutritionSeries('2026-08-01', 20, 3000)
    expect(reconcileIntake(w, n, 0, 'bulk')).toBeNull()
    expect(reconcileIntake(w, n, NaN, 'bulk')).toBeNull()
  })

  it('訊息不指控，兩種可能都留著', () => {
    const w = weightSeries('2026-08-03', 14, 80.5, 0.18)
    const n = nutritionSeries('2026-08-03', 12, 3145)
    const msg = reconciliationMessage(reconcileIntake(w, n, 3000, 'bulk')!)
    expect(msg).toContain('要嘛')       // 紀錄漏了 / 目標要調，兩個都講
    expect(msg).not.toContain('說謊')
    expect(msg).not.toContain('低報')
  })
})

describe('該動處方還是該修執行（2026-08-16 我砍錯邊的教訓）', () => {
  it('Howard：處方 3000、實際約 3456 → 不該砍處方', () => {
    const w = weightSeries('2026-08-03', 14, 80.5, 0.18)
    const n = nutritionSeries('2026-08-03', 12, 3145)
    const v = prescriptionVerdict(reconcileIntake(w, n, 3000, 'bulk'))
    expect(v.adjustPrescription).toBe(false)
    expect(v.reason).toContain('執行超出處方')
  })

  it('照處方吃但體重還是偏離 → 處方真的要調', () => {
    // 目標 3000、bulk 該有 +0.2kg/週，實際 +0.25 → implied 幾乎等於處方
    const w = weightSeries('2026-08-01', 21, 80, 0.036)
    const n = nutritionSeries('2026-08-01', 20, 3000)
    const v = prescriptionVerdict(reconcileIntake(w, n, 3000, 'bulk'))
    expect(v.adjustPrescription).toBe(true)
  })

  it('吃不到處方（William 型）→ 也不該動處方數字', () => {
    const w = weightSeries('2026-07-02', 19, 71.8, 0)
    const n = nutritionSeries('2026-07-02', 10, 2230)
    const v = prescriptionVerdict(reconcileIntake(w, n, 3150, 'bulk'))
    expect(v.adjustPrescription).toBe(false)
    expect(v.reason).toContain('沒吃到處方')
  })

  it('資料不足 → 不改變原有行為', () => {
    expect(prescriptionVerdict(null).adjustPrescription).toBe(true)
  })
})
