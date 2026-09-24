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
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
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

  it('續約：訂單帶 renew_client_id → 直接續在該帳號、不新建、不標 upgraded_existing（稽核 P-01）', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: {
        id: 'purchase-1', merchant_trade_no: 'HP12345', name: '手動開的學員', email: 'x@example.com',
        subscription_tier: 'self_managed', status: 'pending',
        registration_data: { renew_client_id: 'renew-1' },
        // mock 同一張表所有查詢回同一個物件；升級路徑會 for-of 舊訂單清單 → 讓它可迭代（空）
        [Symbol.iterator]: function* () {},
      },
      error: null,
    }
    mockTableCalls['clients'] = {
      data: { id: 'renew-1', unique_code: 'CODE1', expires_at: null, subscription_tier: 'coached' },
      error: null,
    }
    const req = makeRequest({ MerchantTradeNo: 'HP12345', RtnCode: '1', TradeNo: 'T1', CheckMacValue: 'VALID_MAC' })
    const text = await (await POST(req)).text()
    expect(text).toBe('1|OK')

    const calls = mockSupabase.from.mock.calls.map((c: any[], i: number) => ({ table: c[0], b: mockSupabase.from.mock.results[i].value }))
    const clientInserts = calls.filter(c => c.table === 'clients' && c.b.insert.mock.calls.length > 0)
    expect(clientInserts).toHaveLength(0)
    const upgradeUpdate = calls.find(c => c.table === 'clients' && c.b.update.mock.calls.some((u: any[]) => u[0].subscription_tier === 'self_managed'))
    expect(upgradeUpdate).toBeTruthy()
    const purchaseLink = calls.flatMap(c => c.table === 'subscription_purchases' ? c.b.update.mock.calls.map((u: any[]) => u[0]) : [])
      .find((u: any) => u.client_id === 'renew-1')
    expect(purchaseLink).toBeTruthy()
    expect(purchaseLink.registration_data?.upgraded_existing).toBeUndefined()
  })

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

  it('should return 1|OK when purchase record not found (atomic update returns nothing)', async () => {
    // The route now does an atomic UPDATE...WHERE status='pending' instead of a SELECT.
    // When no matching row exists, the update returns null/error — the route
    // treats this the same as "already completed" and responds 1|OK.
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
    expect(text).toBe('1|OK')
  })

  // ── Already Completed (Idempotent) ──

  it('should return 1|OK without re-processing for already completed purchase', async () => {
    // The route now uses an atomic UPDATE...WHERE status='pending'.
    // For an already-completed purchase the WHERE clause won't match,
    // so Supabase returns null data with an error — simulate that here.
    mockTableCalls['subscription_purchases'] = {
      data: null,
      error: { message: 'No rows found' },
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

  it('alerts the coach with email + code when the welcome email fails (稽核 R8)', async () => {
    vi.mocked(sendWelcomeEmail).mockResolvedValueOnce({ success: false, error: 'resend down' } as any)
    const { pushMessage } = await import('@/lib/line')
    const req = makeRequest({
      MerchantTradeNo: 'HP12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    expect(await res.text()).toBe('1|OK')
    const alerted = vi.mocked(pushMessage).mock.calls.some(([, msgs]) =>
      JSON.stringify(msgs).includes('歡迎信寄送失敗') && JSON.stringify(msgs).includes('test@example.com'))
    expect(alerted).toBe(true)
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
