import { describe, it, expect } from 'vitest'
import { analyzeLabs } from '@/lib/lab-trend-analyzer'

describe('正常範圍內不會被標嚴重（2026-09-30 陳胤豪血檢旅程一片紅）', () => {
  const f = (rows: { test_name: string; value: number; date: string }[]) => analyzeLabs(rows, { gender: '男性' })

  it('LDL 69→85（+23%，仍 <130）→ watch，不是 critical', () => {
    const out = f([{ test_name: 'LDL-C', value: 69, date: '2025-04-14' }, { test_name: 'LDL-C', value: 85, date: '2026-09-30' }])
    expect(out[0].latestStatus).toBe('normal')
    expect(out[0].severity).toBe('watch')
  })

  it('系統沒有標準的指標（CPK、總蛋白）不進清單', () => {
    const out = f([{ test_name: 'CPK', value: 397, date: '2026-09-30' }, { test_name: '總蛋白', value: 7.2, date: '2026-09-30' }])
    expect(out).toEqual([])
  })

  it('本來就在 alert 的照樣 critical', () => {
    const out = f([{ test_name: '尿酸', value: 10.5, date: '2026-02-25' }])
    expect(['critical', 'attention']).toContain(out[0].severity)
  })
})
