import { describe, it, expect } from 'vitest'
import { auditSupplement, supplementEffect } from '@/lib/supplement-indication-audit'

const labs = [
  { test_name: '同半胱胺酸', value: 9, date: '2026-01-07' },
  { test_name: '鐵蛋白', value: 250, date: '2026-01-07' },
  { test_name: '維生素D', value: 34, date: '2026-01-07' },
  { test_name: '維生素D', value: 59, date: '2026-03-20' },
]

describe('補品指徵對帳 2026-10-03 修正', () => {
  it('全形名字也對得到規則（ＴＭＧ、Ｌcarnitine、活性Ｂ群）', () => {
    expect(auditSupplement('ＴＭＧ', labs).status).toBe('indicated')
    expect(auditSupplement('活性Ｂ群', labs).status).toBe('indicated')
    expect(auditSupplement('Ｌcarnitine', labs).basis).toMatch(/吃肉/)
  })
  it('同半胱胺酸 9 > 標準檔正常上限 8 → 有甲基化指徵', () => {
    expect(auditSupplement('TMG', labs).basis).toMatch(/同半胱胺酸 9 偏高/)
  })
  it('L-肉鹼：吃肉的健康成人沒有指徵（Howard 標準）', () => {
    expect(auditSupplement('L-carnitine', labs).status).toBe('no-indication')
  })
  it('維生素 C＋鐵蛋白高於理想 → 要注意；連寫的 Vitaminc 也認得', () => {
    const v = auditSupplement('Vitaminc', labs)
    expect(v.status).toBe('caution')
    expect(v.basis).toMatch(/鐵吸收/)
  })
  it('「南非」對到南非醉茄規則', () => {
    expect(auditSupplement('南非', labs).basis).not.toMatch(/無對應規則/)
  })
  it('吃了有沒有效：開始前最後一次 vs 之後最新一次；之後沒驗過回 after=null', () => {
    expect(supplementEffect('D3K2', labs, '2026-02-05')).toEqual({
      marker: '維生素D', before: { value: 34, date: '2026-01-07' }, after: { value: 59, date: '2026-03-20' },
    })
    expect(supplementEffect('TMG', labs, '2026-02-07')!.after).toBeNull()
    expect(supplementEffect('鎂', labs, '2026-02-07')).toBeNull()
    expect(supplementEffect('TMG', labs, null)).toBeNull()
  })
})
