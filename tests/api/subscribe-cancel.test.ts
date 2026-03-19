import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('ECPAY_MERCHANT_ID', '3002607')
vi.stubEnv('ECPAY_HASH_KEY', 'pwFHCqoQZGmho4w6')
vi.stubEnv('ECPAY_HASH_IV', 'EkRm7iFT261dpevs')

// ── Use vi.hoisted so mock state is available when vi.mock factories run ──
const { mockTableCalls, mockSupabase } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

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
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    }),
  }

  return { mockTableCalls, mockSupabase }
})

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/ecpay', () => ({
  ECPAY_CONFIG: {
    MerchantID: '3002607',
    HashKey: 'pwFHCqoQZGmho4w6',
    HashIV: 'EkRm7iFT261dpevs',
    PeriodActionURL: 'https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction',
  },
  generateCheckMacValue: vi.fn(() => 'MOCK_CHECK_MAC'),
}))

vi.mock('@/lib/email', () => ({
  sendCancellationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock global fetch for ECPay API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '@/app/api/subscribe/cancel/route'
import { sendCancellationEmail } from '@/lib/email'

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/subscribe/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: purchase found
    mockTableCalls['subscription_purchases'] = {
      data: {
        merchant_trade_no: 'HP12345',
        subscription_tier: 'self_managed',
        email: 'user@example.com',
        name: 'Test User',
      },
      error: null,
    }

    // Default: client found with expires_at
    mockTableCalls['clients'] = {
      data: { expires_at: '2025-06-01T00:00:00.000Z' },
      error: null,
    }

    // Default: ECPay returns success
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('RtnCode=1&RtnMsg=成功'),
    })
  })

  // ── Missing required parameters ──

  it('should return 400 when clientId is missing', async () => {
    const req = makeRequest({ uniqueCode: 'abc' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('缺少必要參數')
  })

  it('should return 400 when uniqueCode is missing', async () => {
    const req = makeRequest({ clientId: 'client-1' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('缺少必要參數')
  })

  // ── No Active Subscription Found ──

  it('should return 404 when no active subscription purchase is found', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: null,
      error: { message: 'No rows found' },
    }

    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('找不到有效的訂閱紀錄')
  })

  // ── ECPay Cancel API Failure ──

  it('should return 400 when ECPay cancel API returns error', async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('RtnCode=0&RtnMsg=交易失敗'),
    })

    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('取消失敗，請稍後再試或聯繫客服')
  })

  // ── Successful Cancellation ──

  it('should return success when ECPay cancel succeeds', async () => {
    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain('已取消定期定額')
    expect(body.message).toContain('到期日')
  })

  // ── Calls ECPay PeriodAction API ──

  it('should call ECPay PeriodAction API with correct parameters', async () => {
    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    await POST(req)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(options.body).toContain('MerchantID=3002607')
    expect(options.body).toContain('MerchantTradeNo=HP12345')
    expect(options.body).toContain('Action=Cancel')
    expect(options.body).toContain('CheckMacValue=MOCK_CHECK_MAC')
  })

  // ── Sends Cancellation Email ──

  it('should send cancellation email when purchase has email', async () => {
    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    await POST(req)

    expect(sendCancellationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      name: 'Test User',
      tier: 'self_managed',
      expiresAt: '2025-06-01T00:00:00.000Z',
    }))
  })

  // ── Updates Subscription Purchase Status ──

  it('should update purchase status to cancelled after successful ECPay call', async () => {
    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    await POST(req)

    // Verify supabase was called with the subscription_purchases table
    expect(mockSupabase.from).toHaveBeenCalledWith('subscription_purchases')
  })

  // ── Handles Unexpected Exception ──

  it('should return 500 on unexpected error', async () => {
    const req = new NextRequest('http://localhost/api/subscribe/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json {{',
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('取消訂閱時發生錯誤')
  })

  // ── Fetch Throws Network Error ──

  it('should return 500 when ECPay fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network timeout'))

    const req = makeRequest({ clientId: 'client-1', uniqueCode: 'abc' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('取消訂閱時發生錯誤')
  })
})
