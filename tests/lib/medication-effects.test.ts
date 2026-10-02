import { describe, it, expect } from 'vitest'
import { applyMedicationChange, resolveMedicationKey, medicationNoteFor } from '@/lib/medication-effects'

describe('medication-effects', () => {
  it('口語藥名對到已知 key', () => {
    expect(resolveMedicationKey('A酸')).toBe('isotretinoin')
    expect(resolveMedicationKey('口服 A 酸')).toBe('isotretinoin')
    expect(resolveMedicationKey('羅可坦')).toBe('isotretinoin')
    expect(resolveMedicationKey('魚油')).toBeNull()
  })
  it('start 新增、再 start 只改開始日、stop 補結束日', () => {
    let r = applyMedicationChange([], { action: 'start', key: 'isotretinoin', date: '2026-05-01' })
    expect(r.medications).toEqual([{ key: 'isotretinoin', name: '口服 A 酸', since: '2026-05-01', until: null }])
    r = applyMedicationChange(r.medications, { action: 'start', key: 'isotretinoin', date: '2026-05-02' })
    expect(r.medications).toHaveLength(1)
    r = applyMedicationChange(r.medications, { action: 'stop', key: 'isotretinoin', date: '2026-11-01' })
    expect(r.medications[0].until).toBe('2026-11-01')
    expect(applyMedicationChange(r.medications, { action: 'stop', key: 'isotretinoin', date: '2026-12-01' }).changed).toBe(false)
  })
  it('停藥後抽的血不標「藥造成的」', () => {
    const meds = [{ key: 'isotretinoin', since: '2026-05-01', until: '2026-11-01' }]
    expect(medicationNoteFor('CPK', meds, '2026-09-30')).toMatch(/A 酸/)
    expect(medicationNoteFor('CPK', meds, '2027-01-16')).toBeNull()
    expect(medicationNoteFor('血紅素', meds, '2026-09-30')).toBeNull()
  })
})
