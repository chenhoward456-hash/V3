import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ──

const mockSend = vi.fn()

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: (...args: any[]) => mockSend(...args) }
    },
  }
})

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Must set env before importing the module (lazy init of Resend)
process.env.RESEND_API_KEY = 'test-resend-api-key'
process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com'
process.env.RESEND_FROM_EMAIL = 'Test <test@example.com>'

import {
  sendPurchaseEmail,
  sendWelcomeEmail,
  sendDay3Email,
  sendDay7Email,
  sendDay14Email,
  sendExpiryWarningEmail,
  sendCancellationEmail,
  sendWinBackEmail,
} from '@/lib/email'

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

beforeEach(() => {
  mockSend.mockReset()
})

describe('sendPurchaseEmail', () => {
  it('sends email with correct parameters on success', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendPurchaseEmail({
      to: 'buyer@test.com',
      downloadToken: 'token-123',
      merchantTradeNo: 'TN-456',
    })

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledTimes(1)

    const call = mockSend.mock.calls[0][0]
    expect(call.from).toBe('Test <test@example.com>')
    expect(call.to).toBe('buyer@test.com')
    expect(call.subject).toContain('System Reboot')
    expect(call.html).toContain('token-123')
    expect(call.html).toContain('TN-456')
  })

  it('returns error when Resend API returns error', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'Invalid email' } })

    const result = await sendPurchaseEmail({
      to: 'bad@test.com',
      downloadToken: 'token-bad',
      merchantTradeNo: 'TN-bad',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid email')
  })

  it('returns error when Resend throws exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await sendPurchaseEmail({
      to: 'timeout@test.com',
      downloadToken: 'token-x',
      merchantTradeNo: 'TN-x',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network timeout')
  })
})

describe('sendWelcomeEmail', () => {
  it('sends email with correct parameters on success', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendWelcomeEmail({
      to: 'new@test.com',
      name: 'Alice',
      uniqueCode: 'ABC123',
      tier: 'self_managed',
    })

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledTimes(1)

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('new@test.com')
    expect(call.subject).toContain('Howard Protocol')
    expect(call.html).toContain('Alice')
    expect(call.html).toContain('ABC123')
    expect(call.html).toContain('https://test.example.com/c/ABC123')
    expect(call.html).toContain('自主管理方案')
  })

  it('maps tier names correctly', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    await sendWelcomeEmail({
      to: 'coach@test.com',
      name: 'Bob',
      uniqueCode: 'XYZ',
      tier: 'coached',
    })

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('教練指導方案')
  })

  it('handles free tier label', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    await sendWelcomeEmail({
      to: 'free@test.com',
      name: 'Free',
      uniqueCode: 'FREE1',
      tier: 'free',
    })

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('免費體驗')
  })

  it('handles unknown tier gracefully', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    await sendWelcomeEmail({
      to: 'unknown@test.com',
      name: 'Unknown',
      uniqueCode: 'UNK1',
      tier: 'premium',
    })

    const call = mockSend.mock.calls[0][0]
    // Falls back to the raw tier string
    expect(call.html).toContain('premium')
  })

  it('returns error on Resend failure', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'Rate limited' } })

    const result = await sendWelcomeEmail({
      to: 'fail@test.com',
      name: 'Fail',
      uniqueCode: 'FAIL1',
      tier: 'free',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Rate limited')
  })
})

describe('sendDay3Email', () => {
  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendDay3Email({
      to: 'day3@test.com',
      name: 'Charlie',
      uniqueCode: 'D3CODE',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('day3@test.com')
    expect(call.subject).toContain('Charlie')
    expect(call.subject).toContain('3')
    expect(call.html).toContain('Charlie')
    expect(call.html).toContain('https://test.example.com/c/D3CODE')
  })

  it('returns error on exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('API down'))

    const result = await sendDay3Email({
      to: 'fail@test.com',
      name: 'Fail',
      uniqueCode: 'FAIL',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('API down')
  })
})

describe('sendDay7Email', () => {
  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendDay7Email({
      to: 'day7@test.com',
      name: 'Dave',
      uniqueCode: 'D7CODE',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('day7@test.com')
    expect(call.subject).toContain('Dave')
    expect(call.subject).toContain('一週')
    expect(call.html).toContain('Dave')
    expect(call.html).toContain('https://test.example.com/c/D7CODE')
  })

  it('returns error on Resend API error', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'Bounce' } })

    const result = await sendDay7Email({
      to: 'bounce@test.com',
      name: 'Bounce',
      uniqueCode: 'BOUNCE',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Bounce')
  })
})

describe('sendDay14Email', () => {
  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendDay14Email({
      to: 'day14@test.com',
      name: 'Eve',
      uniqueCode: 'D14CODE',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('day14@test.com')
    expect(call.subject).toContain('Eve')
    expect(call.subject).toContain('兩週')
    expect(call.html).toContain('Eve')
    expect(call.html).toContain('https://test.example.com/c/D14CODE')
    expect(call.html).toContain('https://test.example.com/pricing')
  })

  it('returns error on exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('Timeout'))

    const result = await sendDay14Email({
      to: 'fail@test.com',
      name: 'Fail',
      uniqueCode: 'FAIL',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Timeout')
  })
})

describe('sendExpiryWarningEmail', () => {
  it('sends email with correct parameters for 7 days left', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendExpiryWarningEmail({
      to: 'expiry@test.com',
      name: 'Frank',
      daysLeft: 7,
      tier: 'self_managed',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('expiry@test.com')
    expect(call.subject).toContain('Frank')
    expect(call.subject).toContain('7 天後')
    expect(call.html).toContain('自主管理方案')
    expect(call.html).toContain('7 天後')
  })

  it('uses "明天" for 1 day left', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    await sendExpiryWarningEmail({
      to: 'expiry1@test.com',
      name: 'Grace',
      daysLeft: 1,
      tier: 'coached',
    })

    const call = mockSend.mock.calls[0][0]
    expect(call.subject).toContain('明天')
    expect(call.html).toContain('教練指導方案')
  })

  it('returns error on failure', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'Send failed' } })

    const result = await sendExpiryWarningEmail({
      to: 'fail@test.com',
      name: 'Fail',
      daysLeft: 3,
      tier: 'free',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Send failed')
  })
})

describe('sendCancellationEmail', () => {
  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendCancellationEmail({
      to: 'cancel@test.com',
      name: 'Hank',
      tier: 'coached',
      expiresAt: '2025-06-15T00:00:00Z',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('cancel@test.com')
    expect(call.subject).toContain('取消')
    expect(call.html).toContain('Hank')
    expect(call.html).toContain('教練指導方案')
  })

  it('returns error on exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await sendCancellationEmail({
      to: 'fail@test.com',
      name: 'Fail',
      tier: 'self_managed',
      expiresAt: '2025-01-01',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})

describe('sendWinBackEmail', () => {
  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    const result = await sendWinBackEmail({
      to: 'winback@test.com',
      name: 'Ivy',
    })

    expect(result).toEqual({ success: true })

    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('winback@test.com')
    expect(call.subject).toContain('Ivy')
    expect(call.subject).toContain('數據')
    expect(call.html).toContain('Ivy')
    expect(call.html).toContain('https://test.example.com/pricing')
  })

  it('returns error on Resend API error', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'Spam detected' } })

    const result = await sendWinBackEmail({
      to: 'spam@test.com',
      name: 'Spam',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Spam detected')
  })

  it('returns error on unexpected exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('DNS failure'))

    const result = await sendWinBackEmail({
      to: 'dns@test.com',
      name: 'DNS',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('DNS failure')
  })
})

describe('HTML content safety', () => {
  it('escapes HTML entities in user-provided content', async () => {
    mockSend.mockResolvedValueOnce({ error: null })

    await sendWelcomeEmail({
      to: 'xss@test.com',
      name: '<script>alert("xss")</script>',
      uniqueCode: 'XSS&CODE',
      tier: 'free',
    })

    const call = mockSend.mock.calls[0][0]
    // Should not contain raw <script> tag
    expect(call.html).not.toContain('<script>')
    // Should contain escaped version
    expect(call.html).toContain('&lt;script&gt;')
  })
})
