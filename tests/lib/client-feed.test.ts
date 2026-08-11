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

  it('echoes a fresh all-normal lab batch (lab_new) with report CTA', () => {
    const labs = [
      lab('總膽固醇', 159, '2026-06-26', 'mg/dL'),
      lab('三酸甘油酯', 63, '2026-06-26', 'mg/dL'),
      lab('ALT', 30, '2026-06-26', 'U/L'),
    ]
    const cards = buildClientFeed({ labs, gender: '男性', today: '2026-07-10', clientCode: 'abc123' })
    const echo = cards.find(c => c.id.startsWith('lab_new_'))
    expect(echo).toBeDefined()
    expect(echo!.tone).toBe('good')
    expect(echo!.body).toContain('2026-06-26')
    expect(echo!.body).toContain('3 項')
    expect(echo!.cta?.href).toBe('/c/abc123/report')
  })

  it('does NOT echo lab_new when the batch already produced another lab card', () => {
    const labs = [lab('尿酸', 9.0, '2026-06-26', 'mg/dL')] // alert 卡會提到這批
    const cards = buildClientFeed({ labs, gender: '男性', today: '2026-07-10' })
    expect(cards.find(c => c.id.startsWith('lab_alert_'))).toBeDefined()
    expect(cards.find(c => c.id.startsWith('lab_new_'))).toBeUndefined()
  })

  it('does NOT echo lab_new for a stale batch (>14 days)', () => {
    const labs = [lab('總膽固醇', 159, '2026-06-01', 'mg/dL')]
    const cards = buildClientFeed({ labs, gender: '男性', today: '2026-07-10' })
    expect(cards.find(c => c.id.startsWith('lab_new_'))).toBeUndefined()
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

// ── 今天記錄的回聲（2026-08-11）──
// 為什麼要有：記錄的回饋原本只有一個 toast，飛走就什麼都沒留 → 學員下次打開，
// 畫面上沒有任何「我上次來留下的東西」。這張卡把他的紀錄變成他的答案並留到明天。
describe('今天記錄的回聲卡', () => {
  const base = { labs: [], today: '2026-08-14' }

  it('今天有記 → 出現回聲卡，帶「比昨天」「7天平均」「距目標」', () => {
    const cards = buildClientFeed({
      ...base,
      targetWeight: 77,
      bodyData: [
        { date: '2026-08-10', weight: 86.5 },
        { date: '2026-08-11', weight: 87.1 },
        { date: '2026-08-12', weight: 86.3 },
        { date: '2026-08-13', weight: 86.8 },
        { date: '2026-08-14', weight: 86.2 },
      ],
    })
    const echo = cards.find(c => c.id.startsWith('logged_weight_'))
    expect(echo).toBeDefined()
    expect(echo!.title).toContain('86.2')
    expect(echo!.body).toContain('比昨天 -0.6')
    expect(echo!.body).toContain('7 天平均')
    expect(echo!.body).toContain('距目標 77')
  })

  it('今天沒記 → 不出現（不催、不佔版面）', () => {
    const cards = buildClientFeed({
      ...base,
      bodyData: [{ date: '2026-08-13', weight: 86.8 }],
    })
    expect(cards.find(c => c.id.startsWith('logged_weight_'))).toBeUndefined()
  })

  it('只有第一筆 → 不談平均也不談變化，講「這是你的起點」', () => {
    const cards = buildClientFeed({
      ...base,
      bodyData: [{ date: '2026-08-14', weight: 86.5 }],
    })
    const echo = cards.find(c => c.id.startsWith('logged_weight_'))
    expect(echo!.body).toContain('起點')
    expect(echo!.body).not.toContain('平均')
  })

  it('少於 3 筆不講 7 天平均（樣本不足不亂講）', () => {
    const cards = buildClientFeed({
      ...base,
      bodyData: [
        { date: '2026-08-13', weight: 86.8 },
        { date: '2026-08-14', weight: 86.2 },
      ],
    })
    const echo = cards.find(c => c.id.startsWith('logged_weight_'))
    expect(echo!.body).toContain('比昨天')
    expect(echo!.body).not.toContain('平均')
  })
})
