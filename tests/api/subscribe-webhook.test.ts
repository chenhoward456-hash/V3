import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('ECPAY_MERCHANT_ID', '3002607')
vi.stubEnv('ECPAY_HASH_KEY', 'pwFHCqoQZGmho4w6')
vi.stubEnv('ECPAY_HASH_IV', 'EkRm7iFT261dpevs')

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──
const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
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

  return { mockTableCalls, mockSupabase, createMockQueryBuilder }
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

vi.mock('@/lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
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

import { POST } from '@/app/api/subscribe/webhook/route'
import { sendWelcomeEmail } from '@/lib/email'
import { verifyCheckMacValue } from '@/lib/ecpay'

function makeRequest(params: Record<string, string>): NextRequest {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value)
  }

  return new NextRequest('http://localhost/api/subscribe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

describe('POST /api/subscribe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCheckMacValue).mockReturnValue(true)

    // Default table results
    mockTableCalls['subscription_purchases'] = {
      data: {
        id: 'purchase-1',
        merchant_trade_no: 'HP12345',
        name: 'Test User',
        email: 'test@example.com',
        subscription_tier: 'self_managed',
        status: 'pending',
        registration_data: { age: 30, gender: '男性', goalType: 'cut' },
      },
      error: null,
    }
    mockTableCalls['clients'] = {
      data: { id: 'new-client-id' },
      error: null,
    }
  })

  // ── CheckMacValue Verification ──

  it('should return error when CheckMacValue verification fails', async () => {
    vi.mocked(verifyCheckMacValue).mockReturnValue(false)

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'INVALID',
    })
    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
  })

  // ── Successful Payment Creates Account ──

  it('should return 1|OK for successful payment with valid CheckMacValue', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  // ── Handles Failed Payment ──

  it('should update purchase status to failed when RtnCode is not 1', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '0',
      RtnMsg: 'Card declined',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Supabase should be called to update purchase status to 'failed'
    expect(mockSupabase.from).toHaveBeenCalledWith('subscription_purchases')
  })

  // ── Purchase Not Found ──

  it('should return error when purchase record not found', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: null,
      error: { message: 'No rows found' },
    }

    const req = makeRequest({
      MerchantTradeNo: 'HP_NONEXISTENT',
      RtnCode: '1',
      TradeNo: 'T99999',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
  })

  // ── Already Completed (Idempotent) ──

  it('should return 1|OK without re-processing for already completed purchase', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: {
        id: 'purchase-1',
        merchant_trade_no: 'HP12345',
        name: 'Test User',
        email: 'test@example.com',
        subscription_tier: 'self_managed',
        status: 'completed',
        registration_data: {},
      },
      error: null,
    }

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Should not attempt to send welcome email for already-completed
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  // ── Sends Welcome Email ──

  it('should send welcome email when payment succeeds and email exists', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    await POST(req)

    // sendWelcomeEmail is called fire-and-forget, just verify it was invoked
    expect(sendWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      name: 'Test User',
      tier: 'self_managed',
    }))
  })

  // ── Client Creation Error ──

  it('should return error when client creation in DB fails', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: {
        id: 'purchase-1',
        merchant_trade_no: 'HP12345',
        name: 'Test User',
        email: 'test@example.com',
        subscription_tier: 'self_managed',
        status: 'pending',
        registration_data: {},
      },
      error: null,
    }
    // Simulate client insert failure
    mockTableCalls['clients'] = { data: null, error: { message: 'Duplicate key' } }

    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    // Should return 0|ErrorMessage so ECPay retries
    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
  })

  // ── Handles Unexpected Exception ──

  it('should return 0|ErrorMessage on unexpected exception', async () => {
    const req = new NextRequest('http://localhost/api/subscribe/webhook', {
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
