import { describe, it, expect } from 'vitest'
import { minguoToAD, adToMinguo, ageFromBirthYear } from '@/utils/age'

describe('age utils', () => {
  it('民國 → 西元（+1911）', () => {
    expect(minguoToAD(78)).toBe(1989)
    expect(minguoToAD(1)).toBe(1912)
    expect(minguoToAD(114)).toBe(2025)
  })

  it('西元 → 民國（-1911）', () => {
    expect(adToMinguo(1989)).toBe(78)
    expect(adToMinguo(2025)).toBe(114)
  })

  it('無效民國年回 null', () => {
    expect(minguoToAD(0)).toBeNull()
    expect(minguoToAD(-5)).toBeNull()
    expect(minguoToAD(null)).toBeNull()
    expect(minguoToAD(undefined)).toBeNull()
  })

  it('由出生年算年齡（會隨年份自動增加）', () => {
    expect(ageFromBirthYear(1989, new Date('2026-06-13'))).toBe(37)
    expect(ageFromBirthYear(1989, new Date('2027-01-01'))).toBe(38) // 隔年自動 +1
    expect(ageFromBirthYear(2000, new Date('2026-06-13'))).toBe(26)
  })

  it('年齡超出合理範圍 / 無效 → null', () => {
    expect(ageFromBirthYear(null)).toBeNull()
    expect(ageFromBirthYear(3000, new Date('2026-06-13'))).toBeNull() // 負數
    expect(ageFromBirthYear(1800, new Date('2026-06-13'))).toBeNull() // >150
  })
})
