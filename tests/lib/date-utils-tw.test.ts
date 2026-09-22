import { describe, it, expect } from 'vitest'
import { getTaiwanDate, getTaiwanHour, taiwanDateAgo, taiwanDateAhead } from '@/lib/date-utils'

/**
 * ⚠️ 這組測試守的是一個實際在 production 跑的 bug（2026-09-21 發現）：
 *    vercel.json 排了 cron "0 22 * * *"，Vercel 的 schedule 是 UTC
 *    → 實際觸發時間是**台灣早上 6 點**，而那一刻 UTC 還停在前一天。
 */
const CRON_MORNING = new Date('2026-09-21T22:00:00Z')  // 台灣 2026-09-22 06:00
const CRON_NIGHT = new Date('2026-09-21T14:00:00Z')    // 台灣 2026-09-21 22:00

describe('台北時區的日期：cron 在 UTC 22:00 觸發時', () => {
  it('今天是台灣的 9/22，不是 UTC 的 9/21', () => {
    expect(CRON_MORNING.toISOString().split('T')[0]).toBe('2026-09-21')  // 壞掉的寫法
    expect(getTaiwanDate(CRON_MORNING)).toBe('2026-09-22')               // 正確的
  })

  it('⛔ 舊寫法的「14 天前」會多算一天（區間變 15 天）', () => {
    const broken = new Date(CRON_MORNING)
    broken.setDate(broken.getDate() - 14)
    expect(broken.toISOString().split('T')[0]).toBe('2026-09-07')
    expect(taiwanDateAgo(14, CRON_MORNING)).toBe('2026-09-08')
  })

  it('⛔ 舊寫法的「昨天」會變成前天', () => {
    const broken = new Date(CRON_MORNING)
    broken.setDate(broken.getDate() - 1)
    expect(broken.toISOString().split('T')[0]).toBe('2026-09-20')
    expect(taiwanDateAgo(1, CRON_MORNING)).toBe('2026-09-21')
  })

  it('晚上那支 cron 本來就是對的——所以症狀是「早晚跑結果不一樣」', () => {
    const broken = new Date(CRON_NIGHT)
    broken.setDate(broken.getDate() - 14)
    expect(broken.toISOString().split('T')[0]).toBe('2026-09-07')
    expect(taiwanDateAgo(14, CRON_NIGHT)).toBe('2026-09-07')  // 這裡兩者相同
  })

  it('台北的小時數', () => {
    expect(getTaiwanHour(CRON_MORNING)).toBe(6)
    expect(getTaiwanHour(CRON_NIGHT)).toBe(22)
  })

  it('跨月跨年', () => {
    // UTC 2/28 22:00 → 台灣已經是 3/1 早上 6 點，所以「昨天」是 2/28
    expect(getTaiwanDate(new Date('2026-02-28T22:00:00Z'))).toBe('2026-03-01')
    expect(taiwanDateAgo(1, new Date('2026-02-28T22:00:00Z'))).toBe('2026-02-28')
    // 跨年：UTC 12/31 22:00 → 台灣 2027-01-01
    expect(getTaiwanDate(new Date('2026-12-31T22:00:00Z'))).toBe('2027-01-01')
    expect(taiwanDateAgo(1, new Date('2026-12-31T22:00:00Z'))).toBe('2026-12-31')
    expect(taiwanDateAgo(7, new Date('2026-12-31T22:00:00Z'))).toBe('2026-12-25')
  })

  it('往後數', () => {
    expect(taiwanDateAhead(7, CRON_MORNING)).toBe('2026-09-29')
  })
})

/**
 * ⭐ monthly cron 的加重版：差的不是一天，是**一整個月**。
 *    它折在 daily 的 morning run 裡、每月 1 號台灣早上 6 點跑，
 *    那一刻 UTC 還停在上個月最後一天 → now.getMonth() 少一個月。
 */
describe('monthly cron：每月 1 號早上 6 點的月份邊界', () => {
  const lastMonthRange = (from: Date) => {
    const [y, m] = getTaiwanDate(from).split('-').map(Number)
    const ly = m === 1 ? y - 1 : y
    const lm = m === 1 ? 12 : m - 1
    return {
      start: `${ly}-${String(lm).padStart(2, '0')}-01`,
      end: new Date(Date.UTC(ly, lm, 0)).toISOString().split('T')[0],
    }
  }

  it('⛔ 舊寫法在台灣 10/1 早上會統計成「八月」，該是九月', () => {
    const at = new Date('2026-09-30T22:00:00Z')   // 台灣 2026-10-01 06:00
    expect(getTaiwanDate(at)).toBe('2026-10-01')
    // 舊寫法：now 的 UTC 月份還是 9 月（getMonth()=8）→ 上個月算成八月
    expect(new Date(at.getUTCFullYear(), at.getUTCMonth() - 1, 1).getMonth()).toBe(7)  // 八月
    // 正確：上個月是九月
    expect(lastMonthRange(at)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('跨年：台灣 1/1 早上的「上個月」是去年 12 月', () => {
    const at = new Date('2026-12-31T22:00:00Z')   // 台灣 2027-01-01 06:00
    expect(lastMonthRange(at)).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('二月天數（含閏年）', () => {
    expect(lastMonthRange(new Date('2026-02-28T22:00:00Z')).end).toBe('2026-02-28')  // 台灣 3/1 → 上個月 2 月
    expect(lastMonthRange(new Date('2028-02-29T22:00:00Z')).end).toBe('2028-02-29')  // 2028 閏年
  })
})
