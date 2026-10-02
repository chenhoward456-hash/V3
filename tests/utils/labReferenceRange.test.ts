import { describe, it, expect } from 'vitest'
import { parseReferenceRange, statusFromReferenceRange, sideFromReferenceRange } from '@/utils/labReferenceRange'

/** 檢驗所範圍退路：只給「V3 沒設判讀標準」的指標用，不發明門檻 */
describe('parseReferenceRange', () => {
  it.each([
    ['46-171', 46, 171],
    ['0.70-1.30', 0.7, 1.3],
    ['150000-400000', 150000, 400000],
    ['150,000～400,000', 150000, 400000],
    ['≤0.3', null, 0.3],
    ['<73', null, 73],
    ['≥90 為第1期標準', 90, null],
  ])('%s', (raw, min, max) => {
    expect(parseReferenceRange(raw)).toMatchObject({ min, max })
  })
  it('解析不出就回 null（呼叫端維持原本行為）', () => {
    expect(parseReferenceRange('')).toBeNull()
    expect(parseReferenceRange('陰性')).toBeNull()
    expect(parseReferenceRange(null)).toBeNull()
    expect(parseReferenceRange('171-46')).toBeNull()
  })
})

describe('statusFromReferenceRange', () => {
  it('Howard 9/30 的 CPK 397（範圍 46–171）＝範圍外 attention，不是 normal', () => {
    expect(statusFromReferenceRange(397, '46-171')).toBe('attention')
    expect(sideFromReferenceRange(397, '46-171')).toBe('high')
  })
  it('範圍內＝normal；邊界值算範圍內', () => {
    expect(statusFromReferenceRange(194, '120-246')).toBe('normal')
    expect(statusFromReferenceRange(0.3, '≤0.3')).toBe('normal')
    expect(statusFromReferenceRange(11.5, '11.5-15.0')).toBe('normal')
  })
  it('範圍外最多給 attention，永遠不給 alert', () => {
    expect(statusFromReferenceRange(9999, '46-171')).toBe('attention')
    expect(sideFromReferenceRange(10, '46-171')).toBe('low')
  })
  it('解析不出 → null', () => {
    expect(statusFromReferenceRange(5, '陰性')).toBeNull()
  })
})
