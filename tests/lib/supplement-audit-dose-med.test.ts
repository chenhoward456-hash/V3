import { describe, it, expect } from 'vitest'
import { auditSupplement } from '@/lib/supplement-indication-audit'

const labs = [{ test_name: '維生素D', value: 59, status: 'normal', date: '2026-03-20' }]
const isotretinoin = [{ key: 'isotretinoin', name: '口服 A 酸', since: '2026-08-01', until: null }]

describe('補品對帳：劑量與用藥（2026-10-03）', () => {
  it('維生素 D 59＋每天 5000 IU → 提醒劑量偏高', () => {
    const v = auditSupplement('D3K2', labs, {}, { dosage: '5000' })
    expect(v.status).toBe('caution')
    expect(v.basis).toContain('5000')
  })
  it('維生素 D 59＋每天 2000 IU → 維持', () => {
    expect(auditSupplement('D3K2', labs, {}, { dosage: '2000 IU' }).status).toBe('lifestyle')
  })
  it('劑量抓不到（兩顆）→ 照原本只看血檢', () => {
    expect(auditSupplement('D3K2', labs, {}, { dosage: '兩顆' }).status).toBe('lifestyle')
  })
  it('吃 A 酸期間的南非醉茄 → 先停', () => {
    const v = auditSupplement('南非', [], {}, { medications: isotretinoin, today: '2026-10-03' })
    expect(v.status).toBe('caution')
    expect(v.basis).toContain('A 酸')
  })
  it('沒吃 A 酸的南非醉茄 → 不受影響', () => {
    expect(auditSupplement('南非', [], {}, { medications: [], today: '2026-10-03' }).status).not.toBe('caution')
  })
})
