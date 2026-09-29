import { describe, it, expect } from 'vitest'
import { buildLabPrepMessage, hypothesesForCheckup } from '@/lib/lab-prep'

const base = { name: '陳胤豪', checkupDate: '2026-10-01', lastLabDate: '2026-03-20' }

describe('buildLabPrepMessage', () => {
  it('只在前 3 天、前 1 天、當天推', () => {
    expect(buildLabPrepMessage({ ...base, today: '2026-09-28' })?.daysUntil).toBe(3)
    expect(buildLabPrepMessage({ ...base, today: '2026-09-29' })).toBeNull()
    expect(buildLabPrepMessage({ ...base, today: '2026-09-30' })?.daysUntil).toBe(1)
    expect(buildLabPrepMessage({ ...base, today: '2026-10-01' })?.daysUntil).toBe(0)
    expect(buildLabPrepMessage({ ...base, today: '2026-10-02' })).toBeNull()
    expect(buildLabPrepMessage({ ...base, today: '2026-09-20' })).toBeNull()
  })

  it('日期帶星期、同一家寫出上次日期', () => {
    const m = buildLabPrepMessage({ ...base, today: '2026-09-30' })!
    expect(m.lineText).toContain('10/1（四）')
    expect(m.lineText).toContain('跟 3/20（五） 那次同一家')
    expect(m.lineText).toContain('10 點後只喝水')
  })

  it('沒有上次抽血 → 改講以後固定同一家', () => {
    const m = buildLabPrepMessage({ ...base, lastLabDate: null, today: '2026-10-01' })!
    expect(m.lineText).toContain('以後每次都在同一家抽')
  })

  it('有預測 → 列出這次要對答案的項目', () => {
    const m = buildLabPrepMessage({
      ...base, today: '2026-10-01',
      hypotheses: [
        { marker: '睪固酮', baseline_value: 403.92, expected_direction: 'up', expected_value: 550 },
        { marker: 'SHBG', baseline_value: 38.4, expected_direction: 'down', expected_value: 30 },
      ],
    })!
    expect(m.lineText).toContain('這次要對答案')
    expect(m.lineText).toContain('睪固酮（上次 403.9 → 預期 ≥550）')
    expect(m.lineText).toContain('SHBG（上次 38.4 → 預期 ≤30）')
  })
})

describe('同一家的基準', () => {
  it('有預測 → 對準預測基準日，不是最近一次抽血', () => {
    const m = buildLabPrepMessage({
      ...base, lastLabDate: '2026-06-26', today: '2026-10-01',
      hypotheses: [{ marker: '睪固酮', baseline_date: '2026-03-20', baseline_value: 404, expected_direction: 'up', expected_value: 550 }],
    })!
    expect(m.lineText).toContain('跟 3/20（五） 那次同一家')
    expect(m.lineText).not.toContain('6/26')
  })
})

describe('hypothesesForCheckup', () => {
  const h = (retest_by: string | null, notified_status: string | null = null) =>
    ({ marker: 'x', baseline_value: 1, expected_direction: 'up', expected_value: 2, retest_by, notified_status })

  it('回測日在抽血日 ±14 天內、還沒對過答案的才算', () => {
    const out = hypothesesForCheckup([
      h('2026-09-26'), h('2026-10-01'), h('2026-12-01'), h(null), h('2026-10-01', 'met'),
    ], '2026-10-01')
    expect(out.map(x => x.retest_by)).toEqual(['2026-09-26', '2026-10-01'])
  })
})
