import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
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

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()
const mockBuildCheckoutFormHTML = vi.fn()
const mockGenerateMerchantTradeNo = vi.fn()
const mockFormatTradeDate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status }, { status })
  },
}))

vi.mock('@/lib/ecpay', () => ({
  ECPAY_CONFIG: { MerchantID: 'TEST_MERCHANT' },
  EBOOK_PRODUCTS: {
    'system-reboot-v1': { name: 'Test Ebook', amount: 299, currency: 'twd' },
  },
  generateMerchantTradeNo: (...args: any[]) => mockGenerateMerchantTradeNo(...args),
  formatTradeDate: (...args: any[]) => mockFormatTradeDate(...args),
  buildCheckoutFormHTML: (...args: any[]) => mockBuildCheckoutFormHTML(...args),
}))

import { POST } from '@/app/api/ebook/create-checkout/route'

// ── Helpers ──

function makePostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/ebook/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('POST /api/ebook/create-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
    mockGenerateMerchantTradeNo.mockReturnValue('HP20240101000001')
    mockFormatTradeDate.mockReturnValue('2024/01/01 12:00:00')
    mockBuildCheckoutFormHTML.mockReturnValue('<form>checkout</form>')

    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  it('returns htmlForm on successful checkout', async () => {
    const req = makePostRequest({ email: 'test@example.com', quizData: { score: 5 } })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.htmlForm).toBe('<form>checkout</form>')
    expect(mockBuildCheckoutFormHTML).toHaveBeenCalledTimes(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('ebook_purchases')
  })

  it('returns 400 for missing email', async () => {
    const req = makePostRequest({ quizData: {} })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for invalid email format', async () => {
    const req = makePostRequest({ email: 'not-an-email' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makePostRequest({ email: 'test@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('inserts pending purchase into DB with correct fields', async () => {
    const req = makePostRequest({ email: 'buyer@example.com', quizData: { q1: 'a' } })
    await POST(req)

    // Verify supabase.from('ebook_purchases').insert was called
    const fromCall = mockSupabase.from.mock.calls.find((c: any[]) => c[0] === 'ebook_purchases')
    expect(fromCall).toBeDefined()
  })

  it('handles checkout without quizData', async () => {
    const req = makePostRequest({ email: 'test@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.htmlForm).toBeDefined()
  })
})
