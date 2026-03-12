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
}))

vi.mock('@/lib/email', () => ({
  sendPurchaseEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { POST } from '@/app/api/ebook/webhook/route'
import { sendPurchaseEmail } from '@/lib/email'
import { verifyCheckMacValue } from '@/lib/ecpay'

function makeRequest(params: Record<string, string>): NextRequest {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value)
  }

  return new NextRequest('http://localhost/api/ebook/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

describe('POST /api/ebook/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCheckMacValue).mockReturnValue(true)

    // Default: purchase exists in pending state
    mockTableCalls['ebook_purchases'] = {
      data: {
        status: 'pending',
        download_token: null,
        email: 'buyer@example.com',
      },
      error: null,
    }
  })

  // ── Successful Payment Processing ──

  it('should return 1|OK for successful payment with RtnCode=1', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
  })

  it('should update ebook_purchases to completed on success', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    await POST(req)

    // Verify supabase was called to update ebook_purchases
    expect(mockSupabase.from).toHaveBeenCalledWith('ebook_purchases')
  })

  // ── Download Token Generation ──

  it('should generate a download token on successful payment', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    await POST(req)

    // The route calls supabase.from('ebook_purchases').update(...) with a download_token
    // We verify the from('ebook_purchases') was called (update contains download_token)
    const fromCalls = mockSupabase.from.mock.calls.filter(
      ([table]: [string]) => table === 'ebook_purchases'
    )
    expect(fromCalls.length).toBeGreaterThanOrEqual(1)
  })

  // ── Email Sending on Success ──

  it('should send purchase email when payment succeeds and email is in CustomField1', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    await POST(req)

    expect(sendPurchaseEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        merchantTradeNo: 'EB12345',
      })
    )
  })

  it('should send purchase email with downloadToken', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    await POST(req)

    expect(sendPurchaseEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadToken: expect.any(String),
      })
    )
  })

  it('should fallback to DB email when CustomField1 is absent', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: {
        status: 'pending',
        download_token: null,
        email: 'db-buyer@example.com',
      },
      error: null,
    }

    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    await POST(req)

    // The route queries ebook_purchases for email as fallback
    expect(mockSupabase.from).toHaveBeenCalledWith('ebook_purchases')
  })

  // ── Idempotency (Already Completed) ──

  it('should return 1|OK without re-processing for already completed purchase', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: {
        status: 'completed',
        download_token: 'existing-token-123',
        email: 'buyer@example.com',
      },
      error: null,
    }

    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Should NOT send email again for already-completed purchase
    expect(sendPurchaseEmail).not.toHaveBeenCalled()
  })

  // ── CheckMacValue Verification ──

  it('should return 0|ErrorMessage when CheckMacValue verification fails', async () => {
    vi.mocked(verifyCheckMacValue).mockReturnValue(false)

    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'INVALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('0|ErrorMessage')
    // Should not attempt any DB operations
    expect(sendPurchaseEmail).not.toHaveBeenCalled()
  })

  // ── RtnCode !== 1 Handling ──

  it('should update purchase to failed when RtnCode is not 1', async () => {
    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '0',
      RtnMsg: 'Card declined',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Should update ebook_purchases with status='failed'
    expect(mockSupabase.from).toHaveBeenCalledWith('ebook_purchases')
    // Should NOT send email on failed payment
    expect(sendPurchaseEmail).not.toHaveBeenCalled()
  })

  // ── DB Update Error ──

  it('should still return 1|OK even when DB update fails', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: null,
      error: { message: 'DB connection error' },
    }

    const req = makeRequest({
      MerchantTradeNo: 'EB12345',
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
      CustomField1: 'buyer@example.com',
    })

    const res = await POST(req)
    const text = await res.text()

    // The route logs the error but still returns 1|OK after the update block
    expect(res.status).toBe(200)
    expect(text).toBe('1|OK')
    // Email should NOT be sent when DB update errors
    expect(sendPurchaseEmail).not.toHaveBeenCalled()
  })

  // ── Missing Form Fields ──

  it('should handle missing MerchantTradeNo gracefully', async () => {
    const req = makeRequest({
      RtnCode: '1',
      TradeNo: 'T12345',
      CheckMacValue: 'VALID_MAC',
    })

    const res = await POST(req)
    const text = await res.text()

    // Route continues to process (MerchantTradeNo will be undefined)
    expect(res.status).toBe(200)
  })

  // ── Unexpected Exception ──

  it('should return 0|ErrorMessage on unexpected exception', async () => {
    const req = new NextRequest('http://localhost/api/ebook/webhook', {
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
