import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shouldShowLineGate } from '@/components/client/LineBindGate'

const SKIP_KEY = 'line_bind_gate_skipped_at'

describe('新學員綁定關卡的顯示條件', () => {
  beforeEach(() => { localStorage.clear() })

  it('已綁定 → 永遠不擋', () => {
    expect(shouldShowLineGate(true)).toBe(false)
    localStorage.setItem(SKIP_KEY, String(Date.now() - 10 * 86400000))
    expect(shouldShowLineGate(true)).toBe(false)
  })

  it('沒綁定且沒跳過過 → 擋', () => {
    expect(shouldShowLineGate(false)).toBe(true)
  })

  it('剛按過「先跳過」→ 24 小時內不再擋', () => {
    localStorage.setItem(SKIP_KEY, String(Date.now() - 3600_000))
    expect(shouldShowLineGate(false)).toBe(false)
  })

  it('跳過超過 24 小時 → 再問一次（綁定是留存前提，不能永久放行）', () => {
    localStorage.setItem(SKIP_KEY, String(Date.now() - 25 * 3600_000))
    expect(shouldShowLineGate(false)).toBe(true)
  })

  it('localStorage 壞值不會讓關卡卡死', () => {
    localStorage.setItem(SKIP_KEY, 'not-a-number')
    expect(shouldShowLineGate(false)).toBe(true)
  })

  it('localStorage 整個不可用（無痕模式）→ 照常顯示，不丟例外', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => shouldShowLineGate(false)).not.toThrow()
    expect(shouldShowLineGate(false)).toBe(true)
    spy.mockRestore()
  })
})
