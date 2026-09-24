import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'

// 稽核 S-07：PIN 可以一直猜 → 每 IP 15 分鐘 120 次，對錯都算、在比對之前檢查
describe('教練 PIN 限流', () => {
  beforeAll(() => { process.env.COACH_PIN = '12345678' })
  const req = (pin: string, ip = '203.0.113.7') =>
    new NextRequest('http://localhost/api/x', { headers: { 'x-coach-pin': pin, 'x-forwarded-for': ip } })

  it('正確 PIN 可以過', async () => {
    expect((await verifyCoachAuth(req('12345678', '203.0.113.1'))).authorized).toBe(true)
  })
  it('同一個 IP 猜 120 次之後，連正確 PIN 也擋', async () => {
    for (let i = 0; i < 120; i++) await verifyCoachAuth(req(String(10000000 + i)))
    const r = await verifyCoachAuth(req('12345678'))
    expect(r.authorized).toBe(false)
    expect(r.error).toContain('嘗試次數過多')
  })
})
