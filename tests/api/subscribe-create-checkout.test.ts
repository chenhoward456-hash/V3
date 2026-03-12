import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──
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

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()
const mockCreateErrorResponse = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
}))

vi.mock('@/lib/ecpay', () => ({
  ECPAY_CONFIG: {
    MerchantID: '3002607',
    HashKey: 'pwFHCqoQZGmho4w6',
    HashIV: 'EkRm7iFT261dpevs',
    PaymentURL: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  },
  SUBSCRIPTION_PLANS: {
    self_managed: {
      name: '自主管理方案',
      amount: 499,
      duration_months: 1,
      periodType: 'M',
      frequency: 1,
      execTimes: 99,
    },
    coached: {
      name: '教練指導方案',
      amount: 2999,
      duration_months: 1,
      periodType: 'M',
      frequency: 1,
      execTimes: 99,
    },
  },
  generateMerchantTradeNo: vi.fn(() => 'HP_TEST_TRADE_123'),
  formatTradeDate: vi.fn(() => '2026/03/13 10:00:00'),
  buildCheckoutFormHTML: vi.fn(
    () => '<html><form id="ecpay-form" method="POST" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"></form></html>'
  ),
}))

import { POST } from '@/app/api/subscribe/create-checkout/route'
import { buildCheckoutFormHTML } from '@/lib/ecpay'
import { NextResponse } from 'next/server'

function makeCheckoutRequest(body: any, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/subscribe/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe/create-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: rate limit allows requests
    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })

    // createErrorResponse returns a proper NextResponse
    mockCreateErrorResponse.mockImplementation((message: string, status: number) => {
      return NextResponse.json(
        { error: message, code: status, timestamp: new Date().toISOString() },
        { status }
      )
    })

    // Default: DB insert succeeds
    mockTableCalls['subscription_purchases'] = { data: null, error: null }
  })

  // ── Successful Checkout Creation ──

  it('should return 200 with htmlForm on valid request', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      phone: '0912345678',
      tier: 'self_managed',
      registrationData: { age: 30, gender: '男性' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.htmlForm).toBeDefined()
    expect(typeof json.htmlForm).toBe('string')
  })

  it('should call buildCheckoutFormHTML with correct ECPay params', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    await POST(req)

    expect(buildCheckoutFormHTML).toHaveBeenCalledTimes(1)
    const params = vi.mocked(buildCheckoutFormHTML).mock.calls[0][0]
    expect(params.MerchantTradeNo).toBe('HP_TEST_TRADE_123')
    expect(params.TotalAmount).toBe(499)
    expect(params.CustomField1).toBe('test@example.com')
    expect(params.CustomField2).toBe('self_managed')
    expect(params.CustomField3).toBe('Test User')
    expect(params.ChoosePayment).toBe('Credit')
  })

  it('should insert a pending subscription_purchase into DB', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      phone: '0912345678',
      tier: 'coached',
      registrationData: { age: 25 },
    })

    await POST(req)

    expect(mockSupabase.from).toHaveBeenCalledWith('subscription_purchases')
  })

  // ── ECPay Form HTML Generation ──

  it('should return HTML containing ECPay form', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.htmlForm).toContain('ecpay-form')
  })

  // ── Missing Required Fields ──

  it('should return 400 when name is missing', async () => {
    const req = makeCheckoutRequest({
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(buildCheckoutFormHTML).not.toHaveBeenCalled()
  })

  it('should return 400 when name is empty string', async () => {
    const req = makeCheckoutRequest({
      name: '',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 when email is missing', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 when tier/plan is missing', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 when tier is invalid', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'nonexistent_plan',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  // ── Invalid Email Format ──

  it('should return 400 for email without @ symbol', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'not-an-email',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 for email without domain', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'user@',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 for email with spaces', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'user @example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  // ── Rate Limiting ──

  it('should return 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(429)
    // Should not attempt any DB or ECPay operations
    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(buildCheckoutFormHTML).not.toHaveBeenCalled()
  })

  it('should call rateLimit with IP-based key', async () => {
    mockGetClientIP.mockReturnValue('192.168.1.100')

    const req = makeCheckoutRequest(
      { name: 'Test User', email: 'test@example.com', tier: 'self_managed' },
      '192.168.1.100'
    )
    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    const [key, maxRequests, windowMs] = mockRateLimit.mock.calls[0]
    expect(key).toContain('192.168.1.100')
    expect(maxRequests).toBe(5)
    expect(windowMs).toBe(60_000)
  })

  // ── DB Insert Failure ──

  it('should return 500 when DB insert fails', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: null,
      error: { message: 'DB insert failed' },
    }

    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  // ── Malformed JSON Body ──

  it('should return 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/subscribe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  // ── Phone is optional ──

  it('should succeed without phone field', async () => {
    const req = makeCheckoutRequest({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'self_managed',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
  })
})
