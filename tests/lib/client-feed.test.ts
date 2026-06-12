import { describe, it, expect } from 'vitest'
import { buildClientFeed } from '@/lib/client-feed'
import type { LabResultRow } from '@/lib/lab-trend-analyzer'

function lab(test_name: string, value: number, date: string, unit = ''): LabResultRow {
  return { test_name, value, unit, date }
}

describe('buildClientFeed', () => {
  it('returns empty when no data', () => {
    expect(buildClientFeed({ labs: [] })).toEqual([])
  })

  it('surfaces a 報喜 (good) card for a markedly improved marker', () => {
    const labs = [
      lab('維生素D', 27, '2026-01-01', 'ng/mL'),
      lab('維生素D', 59, '2026-04-01', 'ng/mL'),
    ]
    const cards = buildClientFeed({ labs, gender: '男性', today: '2026-04-02' })
    const win = cards.find(c => c.tone === 'good')
    expect(win).toBeDefined()
    expect(win!.title).toContain('維生素D')
    expect(win!.body).toContain('27')
    expect(win!.body).toContain('59')
    // 事件穩定 id 內含最新日期與數值
    expect(win!.id).toBe('lab_win_維生素D_2026-04-01_59')
  })

  it('surfaces a 報憂 (alert) card for an out-of-range marker', () => {
    const labs = [lab('尿酸', 9.0, '2026-04-01', 'mg/dL')]
    const cards = buildClientFeed({ labs, gender: '男性', today: '2026-04-02' })
    const alert = cards.find(c => c.tone === 'alert')
    expect(alert).toBeDefined()
    expect(alert!.title).toContain('尿酸')
    expect(alert!.icon).toBe('🩸')
  })

  it('shows an upcoming checkup reminder within 21 days', () => {
    const cards = buildClientFeed({ labs: [], nextCheckupDate: '2026-06-20', today: '2026-06-12' })
    const checkup = cards.find(c => c.id === 'checkup_2026-06-20')
    expect(checkup).toBeDefined()
    expect(checkup!.tone).toBe('info')
    expect(checkup!.body).toContain('8 天')
  })

  it('does NOT show a checkup reminder that is far away (>21 days)', () => {
    const cards = buildClientFeed({ labs: [], nextCheckupDate: '2026-09-08', today: '2026-06-12' })
    expect(cards.find(c => c.id.startsWith('checkup_'))).toBeUndefined()
  })

  it('flags an overdue checkup', () => {
    const cards = buildClientFeed({ labs: [], nextCheckupDate: '2026-06-01', today: '2026-06-12' })
    const checkup = cards.find(c => c.id === 'checkup_2026-06-01')
    expect(checkup).toBeDefined()
    expect(checkup!.tone).toBe('warn')
    expect(checkup!.body).toContain('11 天')
  })

  it('explains a recent system macro adjustment', () => {
    const cards = buildClientFeed({
      labs: [],
      today: '2026-06-12',
      macroAdjustment: {
        applied_at: '2026-06-10T08:00:00Z',
        applied_by: 'system',
        trigger_source: 'trajectory',
        old_macros: { calories: 2400, carbs: 250 },
        new_macros: { calories: 2300, carbs: 230 },
        reason: '體重掉太快',
      },
    })
    const macro = cards.find(c => c.id.startsWith('macro_'))
    expect(macro).toBeDefined()
    expect(macro!.tone).toBe('info')
    expect(macro!.body).toContain('熱量 2400→2300')
    expect(macro!.body).toContain('碳水 250→230')
    expect(macro!.body).toContain('體重掉太快')
  })

  it('ignores an old macro adjustment (>7 days)', () => {
    const cards = buildClientFeed({
      labs: [],
      today: '2026-06-12',
      macroAdjustment: {
        applied_at: '2026-05-01T08:00:00Z',
        applied_by: 'system',
        trigger_source: 'trajectory',
        old_macros: { calories: 2400 },
        new_macros: { calories: 2300 },
        reason: 'x',
      },
    })
    expect(cards.find(c => c.id.startsWith('macro_'))).toBeUndefined()
  })

  it('caps the feed at 4 cards', () => {
    const labs: LabResultRow[] = [
      lab('維生素D', 27, '2026-01-01'), lab('維生素D', 59, '2026-04-01'),
      lab('同半胱胺酸', 15, '2026-01-01'), lab('同半胱胺酸', 9, '2026-04-01'),
      lab('尿酸', 9.5, '2026-04-01'),
      lab('肌酸酐', 1.6, '2026-04-01'),
    ]
    const cards = buildClientFeed({
      labs, gender: '男性', today: '2026-04-02',
      nextCheckupDate: '2026-04-10',
      macroAdjustment: {
        applied_at: '2026-04-01T08:00:00Z', applied_by: 'system', trigger_source: 'trajectory',
        old_macros: { calories: 2400 }, new_macros: { calories: 2300 }, reason: 'x',
      },
    })
    expect(cards.length).toBeLessThanOrEqual(4)
  })
})
