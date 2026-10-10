import { describe, it, expect } from 'vitest'
import { coachingEvidence } from '@/lib/coaching-evidence'
describe('coaching evidence facts', () => {
  it('counts rows and distinct dates separately; excludes future and out-of-window rows', () => {
    const e = coachingEvidence('2026-10-10', { weight: [{ date: '2026-09-26' }, { date: '2026-10-10' }, { date: '2026-10-10' }, { date: '2026-10-11' }, { date: '2026-09-25' }, { date: null }] })
    expect(e.sources[0]).toEqual({ key: 'weight', label: '體重', from: '2026-09-26', to: '2026-10-10', records: 3, days: 2, latestDate: '2026-10-10' })
    expect(e.sources[1].latestDate).toBeNull()
  })
  it('shows different wellness/macro windows and Taiwan dates for timestamp changes', () => {
    const e = coachingEvidence('2026-10-10', { wellness: [{ date: '2026-10-02' }, { date: '2026-10-03' }], macroChanges: [{ applied_at: '2026-08-11T16:00:00Z' }, { applied_at: '2026-10-10T16:00:00Z' }] })
    expect(e.sources.find(s => s.key === 'wellness')).toMatchObject({ from: '2026-10-03', records: 1 })
    expect(e.sources.find(s => s.key === 'wellnessPrevious')).toMatchObject({ from: '2026-09-26', to: '2026-10-02', records: 1 })
    expect(e.sources.find(s => s.key === 'macroChanges')).toMatchObject({ from: '2026-08-11', latestDate: '2026-08-12', records: 1 })
  })
})
