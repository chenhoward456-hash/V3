import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('ECPAY_MERCHANT_ID', '3002607')
vi.stubEnv('ECPAY_HASH_KEY', 'pwFHCqoQZGmho4w6')
vi.stubEnv('ECPAY_HASH_IV', 'EkRm7iFT261dpevs')

// ── Use vi.hoisted so mock state is available when vi.mock factories run ──
const { mockTableResults, mockTableCallCounts, mockSupabase } = vi.hoisted(() => {
  const mockTableResults: Record<string, Array<{ data: any; error: any }>> = {}
  const mockTableCallCounts: Record<string, number> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    }
    Object.defineProperty(builder, 'then', {
      value(onFulfilled: any) {
        return Promise.resolve({ data, error }).then(onFulfilled)
      },
    })
    return builder
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      const results = mockTableResults[table] || [{ data: null, error: null }]
      const callIdx = mockTableCallCounts[table] || 0
      mockTableCallCounts[table] = callIdx + 1
      const result = results[Math.min(callIdx, results.length - 1)]
      return createMockQueryBuilder(result.data, result.error)
    }),
  }

  return { mockTableResults, mockTableCallCounts, mockSupabase }
})

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/ecpay', () => ({
  verifyCheckMacValue: vi.fn(() => true),
  SUBSCRIPTION_PLANS: {
    self_managed: { name: '自主管理', amount: 499, duration_months: 1 },
    coached: { name: '教練指導', amount: 2999, duration_months: 1 },
  },
}))

vi.mock('@/lib/line', () => ({
  pushMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/tier-defaults', () => ({
  getDefaultFeatures: vi.fn((tier: string) => ({
    body_composition_enabled: true,
    wellness_enabled: tier !== 'free',
    nutrition_enabled: true,
    training_enabled: tier !== 'free',
    supplement_enabled: tier === 'coached',
    lab_enabled: tier === 'coached',
    ai_chat_enabled: tier !== 'free',
    simple_mode: false,
    is_active: true,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { POST } from '@/app/api/subscribe/period-webhook/route'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { pushMessage } from '@/lib/line'

function makeRequest(params: Record<string, string>): NextRequest {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value)
  }

  return new NextRequest('http://localhost/api/subscribe/period-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

describe('POST /api/subscribe/period-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCheckMacValue).mockReturnValue(true)

    // Reset call counts
    for (const key of Object.keys(mockTableCallCounts)) {
      delete mockTableCallCounts[key]
    }

    // Default table results
    mockTableResults['subscription_purchases'] = [{
      data: {
        client_id: 'client-1',
        subscription_tier: 'self_managed',
        email: 'user@example.com',
        name: 'Test User',
      },
      error: null,
    }]

    mockTableResults['clients'] = [{
      data: {
        id: 'client-1',
        expires_at: new Date().toISOString(),
        line_user_id: 'U123',
        name: 'Test User',
      },
      error: null,
    }]
  })

  // ── CheckMacValue Verification ──

  it('should return 0|ErrorMessage when CheckMacValue verification fails', async () => {
    vi.mocked(verifyCheckMacValue).mockReturnValue(false)

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '2',
      CheckMacValue: 'INVALID',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
  })

  // ── First Payment Skipped ──

  it('should skip processing and return 1|OK for first payment (TotalSuccessTimes <= 1)', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '1',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  it('should also skip for TotalSuccessTimes = 0', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '0',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  // ── Failed Payment Returns 1|OK Without Processing ──

  it('should return 1|OK without processing when payment fails (RtnCode != 1)', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '0',
      RtnMsg: 'Card declined',
      TotalSuccessTimes: '2',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  // ── Successful Renewal ──

  it('should extend expiry date and return 1|OK for successful renewal', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '2',
      PeriodAmount: '499',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Should have queried subscription_purchases and clients
    expect(mockSupabase.from).toHaveBeenCalledWith('subscription_purchases')
    expect(mockSupabase.from).toHaveBeenCalledWith('clients')
  })

  // ── Purchase Not Found ──

  it('should return 1|OK when purchase record is not found', async () => {
    mockTableResults['subscription_purchases'] = [{
      data: null,
      error: null,
    }]

    const req = makeRequest({
      MerchantTradeNo: 'HP_UNKNOWN',
      RtnCode: '1',
      TotalSuccessTimes: '2',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  // ── Client Not Found ──

  it('should return 1|OK when client not found for renewal', async () => {
    mockTableResults['clients'] = [{
      data: null,
      error: null,
    }]

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '3',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  // ── LINE Push Notification ──

  it('should send LINE push notification for renewal when client has line_user_id', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '2',
      CheckMacValue: 'VALID_MAC',
    })

    await POST(req)

    expect(pushMessage).toHaveBeenCalledWith(
      'U123',
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('自動續訂成功'),
        }),
      ])
    )
  })

  // ── No LINE Push When Client Has No line_user_id ──

  it('should not send LINE push when client has no line_user_id', async () => {
    mockTableResults['clients'] = [{
      data: {
        id: 'client-1',
        expires_at: new Date().toISOString(),
        line_user_id: null,
        name: 'No LINE User',
      },
      error: null,
    }]

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TotalSuccessTimes: '2',
      CheckMacValue: 'VALID_MAC',
    })

    await POST(req)

    expect(pushMessage).not.toHaveBeenCalled()
  })

  // ── Handles Unexpected Exception ──

  it('should return 0|ErrorMessage on unexpected exception', async () => {
    const req = new NextRequest('http://localhost/api/subscribe/period-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=---invalid' },
      body: 'not valid multipart',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
  })
})
