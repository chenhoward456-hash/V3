import { describe, it, expect } from 'vitest'
import { isNewUser, NEW_USER_LOG_DAYS, NEW_USER_MAX_AGE_DAYS } from '@/lib/user-tenure'

/**
 * 誰還算新手。
 *
 * 判錯的兩個方向都很實際：
 *   - 判成新手 → 老用戶被「歡迎加入」蓋滿整個畫面。實測 林宥任（連續 33 天、
 *     四項全記、全系統最活躍）就是這樣，因為判斷只看 localStorage。
 *   - 判成老手 → 真的第一天來的人沒人帶，而啟動流失是這個產品最貴的問題。
 */
const NOW = new Date('2026-09-14T00:00:00Z')
const daysAgo = (n: number) => new Date(Date.parse('2026-09-14') - n * 86400000).toISOString().slice(0, 10)

describe('isNewUser', () => {
  it('剛加入、零紀錄 → 是新手', () => {
    expect(isNewUser({ createdAt: daysAgo(0), logDates: [], now: NOW })).toBe(true)
  })

  it(`🚨 記錄滿 ${NEW_USER_LOG_DAYS} 天就不是新手 —— 他早就會用了`, () => {
    const dates = Array.from({ length: NEW_USER_LOG_DAYS }, (_, i) => daysAgo(i))
    expect(isNewUser({ createdAt: daysAgo(5), logDates: dates, now: NOW })).toBe(false)
  })

  it('同一天多筆只算一天（去重）—— 一天記四項不等於用了四天', () => {
    const sameDay = Array(10).fill(daysAgo(1))
    expect(isNewUser({ createdAt: daysAgo(1), logDates: sameDay, now: NOW })).toBe(true)
  })

  it('日期帶時間戳也要能去重', () => {
    const withTime = ['2026-09-13T08:00:00Z', '2026-09-13T21:30:00Z', '2026-09-12T07:00:00Z']
    // 兩天 < 門檻 3 → 還是新手
    expect(isNewUser({ createdAt: daysAgo(2), logDates: withTime, now: NOW })).toBe(true)
  })

  it(`加入超過 ${NEW_USER_MAX_AGE_DAYS} 天就算沒記錄也不再是新手 —— 導覽已經證明沒用`, () => {
    expect(isNewUser({ createdAt: daysAgo(NEW_USER_MAX_AGE_DAYS + 1), logDates: [], now: NOW })).toBe(false)
    expect(isNewUser({ createdAt: daysAgo(NEW_USER_MAX_AGE_DAYS - 1), logDates: [], now: NOW })).toBe(true)
  })

  it('🚨 林宥任這種人絕對不可以被判成新手', () => {
    const dates = Array.from({ length: 33 }, (_, i) => daysAgo(i))
    expect(isNewUser({ createdAt: daysAgo(40), logDates: dates, now: NOW })).toBe(false)
  })

  it('沒有 createdAt 也不炸，只靠紀錄天數判', () => {
    expect(isNewUser({ logDates: [], now: NOW })).toBe(true)
    expect(isNewUser({ logDates: [daysAgo(1), daysAgo(2), daysAgo(3)], now: NOW })).toBe(false)
  })

  it('null / undefined 混在日期裡要被濾掉，不能算成一天', () => {
    expect(isNewUser({ createdAt: daysAgo(1), logDates: [null, undefined, daysAgo(1)], now: NOW })).toBe(true)
  })
})
