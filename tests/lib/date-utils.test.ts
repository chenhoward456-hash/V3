import { getLocalDateStr } from '@/lib/date-utils'

describe('getLocalDateStr', () => {
  it('formats a date correctly as YYYY-MM-DD', () => {
    const date = new Date(2024, 5, 15) // June 15, 2024
    expect(getLocalDateStr(date)).toBe('2024-06-15')
  })

  it('pads single-digit month and day with leading zero', () => {
    const date = new Date(2024, 0, 5) // January 5, 2024
    expect(getLocalDateStr(date)).toBe('2024-01-05')
  })

  it('handles December (month 12) correctly', () => {
    const date = new Date(2024, 11, 25) // December 25, 2024
    expect(getLocalDateStr(date)).toBe('2024-12-25')
  })

  it('handles January 1st correctly', () => {
    const date = new Date(2024, 0, 1) // January 1, 2024
    expect(getLocalDateStr(date)).toBe('2024-01-01')
  })

  it('uses the current date when no argument is provided', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    expect(getLocalDateStr()).toBe(expected)
  })

  it('handles a leap year date (Feb 29)', () => {
    const date = new Date(2024, 1, 29) // February 29, 2024 (leap year)
    expect(getLocalDateStr(date)).toBe('2024-02-29')
  })

  it('handles double-digit months and days without extra padding', () => {
    const date = new Date(2024, 10, 28) // November 28, 2024
    expect(getLocalDateStr(date)).toBe('2024-11-28')
  })

  it('handles year boundaries (Dec 31 to Jan 1)', () => {
    const dec31 = new Date(2024, 11, 31)
    const jan1 = new Date(2025, 0, 1)
    expect(getLocalDateStr(dec31)).toBe('2024-12-31')
    expect(getLocalDateStr(jan1)).toBe('2025-01-01')
  })
})
