import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '@/lib/health-score-engine'

const base = { wellnessLast7: [], nutritionLast7: [], trainingLast7: [], supplementComplianceRate: 0 }

describe('健康分數血檢扣分（稽核 E24）', () => {
  it('同一季抽兩次血、同一項異常 → 只扣一次（取最新一筆）', () => {
    const once = calculateHealthScore({ ...base, gender: '男性', labResults: [{ status: 'normal', test_name: '同半胱胺酸', value: 18, date: '2026-07-01' }] } as never)
    const twice = calculateHealthScore({ ...base, gender: '男性', labResults: [
      { status: 'normal', test_name: '同半胱胺酸', value: 18, date: '2026-07-01' },
      { status: 'normal', test_name: '同半胱胺酸', value: 17, date: '2026-05-01' },
    ] } as never)
    expect(twice.total).toBe(once.total)
  })
  it('DB 寫 normal 但數值超標 → 會被重算成異常並扣分', () => {
    const recalculated = calculateHealthScore({ ...base, gender: '男性', labResults: [{ status: 'normal', test_name: '同半胱胺酸', value: 18, date: '2026-07-01' }] } as never)
    const statusOnly = calculateHealthScore({ ...base, labResults: [{ status: 'normal' }] } as never)
    expect(recalculated.total).toBeLessThan(statusOnly.total)
  })
})
