import { describe, it, expect } from 'vitest'
import { alreadyAlerted, reasonKey } from '@/lib/alert-throttle'

const r = (score: number) => `軌跡建議調整但被安全層 gate：Cutting gate blocked (score ${score}): 恢復偏低`

describe('alreadyAlerted（同一狀態不天天推）', () => {
  it('7 天內推過同一原因（只差分數）→ 不再推', () => {
    expect(alreadyAlerted([r(31)], r(21))).toBe(true)
  })
  it('第一次卡住 → 要推', () => {
    expect(alreadyAlerted([], r(31))).toBe(false)
  })
  it('原因變了（多一個擋下理由）→ 要推', () => {
    expect(alreadyAlerted([r(31)], r(31) + '｜血檢異常')).toBe(false)
  })
  it('null 紀錄不影響', () => {
    expect(alreadyAlerted([null, undefined], r(31))).toBe(false)
  })
  it('reasonKey 只抹數字', () => {
    expect(reasonKey('score 31, 0.43 kg')).toBe('score #, # kg')
  })
})
