import { describe, it, expect } from 'vitest'
import { isInAutoAdjustCooldown } from '@/lib/auto-adjust-cooldown'

const NOW = Date.parse('2026-09-23T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe('isInAutoAdjustCooldown', () => {
  it('從沒自動調過 → 不在冷卻', () => {
    expect(isInAutoAdjustCooldown(null, 'on_track', NOW)).toBe(false)
  })
  it('3 天前調過、被動式狀態 → 冷卻中（不能再疊 delta）', () => {
    expect(isInAutoAdjustCooldown(daysAgo(3), 'wrong_direction', NOW)).toBe(true)
  })
  it('8 天前調過 → 可以再調', () => {
    expect(isInAutoAdjustCooldown(daysAgo(8), 'wrong_direction', NOW)).toBe(false)
  })
  it('goal_driven / peak_week 是絕對值或逐日協議 → 不受冷卻', () => {
    expect(isInAutoAdjustCooldown(daysAgo(1), 'goal_driven', NOW)).toBe(false)
    expect(isInAutoAdjustCooldown(daysAgo(1), 'peak_week', NOW)).toBe(false)
  })
  it('壞日期字串 → 不擋', () => {
    expect(isInAutoAdjustCooldown('not-a-date', 'on_track', NOW)).toBe(false)
  })
})
