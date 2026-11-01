import { describe, it, expect } from 'vitest'
import { buildTrialLoad, peakFromTrial, buildTrialReminder, TRIAL_DEFAULT_DAYS_OUT } from '@/lib/peak-week-trial'
import { buildPrepChecklist, selectVisibleItems } from '@/lib/peak-week-checklist'

describe('試灌 buildTrialLoad / peakFromTrial', () => {
  it('預設放在賽前 11 天（Temu：11/1 比賽 → 10/21 試灌）', () => {
    const t = buildTrialLoad({ competitionDate: '2026-11-01', peakCarbs: 410 })
    expect(TRIAL_DEFAULT_DAYS_OUT).toBe(11)
    expect(t.date).toBe('2026-10-21')
    expect(t.carbs).toBe(410)
  })

  it('跨月、跨年日期正確', () => {
    expect(buildTrialLoad({ competitionDate: '2027-01-05', peakCarbs: 400 }).date).toBe('2026-12-25')
  })

  it('判讀分支對齊 Howard 帶 Temu 的 355 / 410 / 460', () => {
    expect(peakFromTrial(410, 'spilled')).toBe(355)
    expect(peakFromTrial(410, 'full_hard')).toBe(410)
    expect(peakFromTrial(410, 'flat')).toBe(460)
  })

  it('方向不變式：扁 > 飽而硬 > 溢，任何量都成立', () => {
    for (const c of [150, 236, 300, 355, 440, 600]) {
      expect(peakFromTrial(c, 'flat')).toBeGreaterThan(peakFromTrial(c, 'full_hard'))
      expect(peakFromTrial(c, 'full_hard')).toBeGreaterThan(peakFromTrial(c, 'spilled'))
    }
  })

  it('推播：試灌日早晚、隔天早上各一則，其他時間沒有', () => {
    const t = buildTrialLoad({ competitionDate: '2026-11-01', peakCarbs: 410 })
    expect(buildTrialReminder(t, '2026-10-21', 'morning')?.title).toContain('410')
    expect(buildTrialReminder(t, '2026-10-21', 'evening')).not.toBeNull()
    expect(buildTrialReminder(t, '2026-10-22', 'morning')?.title).toContain('試灌結果')
    expect(buildTrialReminder(t, '2026-10-22', 'evening')).toBeNull()
    expect(buildTrialReminder(t, '2026-10-20', 'morning')).toBeNull()
  })
})

describe('賽前清單 buildPrepChecklist', () => {
  const comp = '2026-11-01'

  it('沒排試灌就沒有試灌項', () => {
    const items = buildPrepChecklist(comp)
    expect(items.some(i => i.key.startsWith('trial'))).toBe(false)
  })

  it('有排試灌 → 試灌當天＋隔天早上回報結果', () => {
    const items = buildPrepChecklist(comp, { trial: { date: '2026-10-21', carbs: 410 } })
    const load = items.find(i => i.key === 'trial_load')!
    const result = items.find(i => i.key === 'trial_result')!
    expect(load.date).toBe('2026-10-21')
    expect(load.title).toContain('410')
    expect(result.date).toBe('2026-10-22')
    expect(result.kind).toBe('trial_result')
  })

  it('除毛在上色前至少 3 天', () => {
    const items = buildPrepChecklist(comp)
    const shave = items.find(i => i.key === 'shave')!
    const tan = items.find(i => i.key === 'tan')!
    const gap = (new Date(tan.date).getTime() - new Date(shave.date).getTime()) / 86400000
    expect(gap).toBeGreaterThanOrEqual(3)
  })

  it('依日期排序、key 不重複', () => {
    const items = buildPrepChecklist(comp, { trial: { date: '2026-10-21', carbs: 410 } })
    const dates = items.map(i => i.date)
    expect([...dates].sort()).toEqual(dates)
    expect(new Set(items.map(i => i.key)).size).toBe(items.length)
  })

  it('試灌排在比賽日當天或之後 → 忽略', () => {
    const items = buildPrepChecklist(comp, { trial: { date: '2026-11-01', carbs: 410 } })
    expect(items.some(i => i.key === 'trial_load')).toBe(false)
  })

  it('首頁顯示：過期未勾＋今天＋下一天預告', () => {
    const items = buildPrepChecklist(comp)
    const v = selectVisibleItems(items, '2026-10-27', new Set(['logistics']))
    // 10/18 的三項：logistics 已勾 → 不算過期
    expect(v.overdue.map(i => i.key).sort()).toEqual(['tan_prep', 'trunks'])
    expect(v.today.map(i => i.key)).toEqual(['shave'])
    expect(v.upcoming.every(i => i.date === '2026-10-29')).toBe(true)
  })

  it('比賽日：沒有預告，今天三項', () => {
    const items = buildPrepChecklist(comp)
    const all = new Set(items.map(i => i.key))
    const v = selectVisibleItems(items, comp, all)
    expect(v.overdue).toEqual([])
    expect(v.today.map(i => i.key)).toEqual(['checkin', 'pump_sodium', 'record'])
    expect(v.upcoming).toEqual([])
  })
})
