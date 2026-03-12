import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockVerifyCheckMacValue } = vi.hoisted(() => ({
  mockVerifyCheckMacValue: vi.fn(),
}))

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

// ── Module mocks ──

vi.mock('@/lib/ecpay', () => ({
  verifyCheckMacValue: (...args: any[]) => mockVerifyCheckMacValue(...args),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Helpers ──

function makeFormRequest(params: Record<string, string>): NextRequest {
  const formData = new URLSearchParams(params)
  return new NextRequest('http://localhost:3000/api/subscribe/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
}

// ── Tests ──

describe('POST /api/subscribe/return', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    mockVerifyCheckMacValue.mockReset()
    mockFrom.mockReset()

    mockVerifyCheckMacValue.mockReturnValue(true)
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    process.env.SESSION_SECRET = 'test-secret'

    vi.doMock('@/lib/ecpay', () => ({
      verifyCheckMacValue: (...args: any[]) => mockVerifyCheckMacValue(...args),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createServiceSupabase: () => mockSupabase,
    }))

    const mod = await import('@/app/api/subscribe/return/route')
    POST = mod.POST
  })

  it('redirects to success page with order_id on valid payment', async () => {
    // No previous purchases for upgrade detection
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const req = makeFormRequest({
      MerchantTradeNo: 'TEST_ORDER_001',
      CheckMacValue: 'VALID_MAC',
      RtnCode: '1',
    })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('https://example.com/join/success')
    expect(location).toContain('order_id=TEST_ORDER_001')
    expect(location).not.toContain('upgrade=1')
  })

  it('sets order_sig cookie with correct properties', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const req = makeFormRequest({
      MerchantTradeNo: 'TEST_ORDER_002',
      CheckMacValue: 'VALID_MAC',
    })
    const res = await POST(req)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('order_sig=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=600')
  })

  it('redirects with upgrade=1 when user has previous completed purchase', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // Current purchase query (email lookup)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { email: 'user@example.com' },
                error: null,
              }),
            }),
          }),
        }
      }
      // Previous purchases query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ client_id: 'prev-client' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = makeFormRequest({
      MerchantTradeNo: 'UPGRADE_ORDER',
      CheckMacValue: 'VALID_MAC',
    })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('upgrade=1')
  })

  it('redirects to error page when CheckMacValue verification fails', async () => {
    mockVerifyCheckMacValue.mockReturnValue(false)

    const req = makeFormRequest({
      MerchantTradeNo: 'FAKE_ORDER',
      CheckMacValue: 'INVALID_MAC',
    })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/join?error=invalid_signature')
  })

  it('handles empty MerchantTradeNo gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const req = makeFormRequest({
      CheckMacValue: 'VALID_MAC',
    })
    const res = await POST(req)

    // Should still redirect (empty MerchantTradeNo defaults to '')
    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/join/success')
  })

  it('still redirects successfully when upgrade detection DB query fails', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB error')
    })

    const req = makeFormRequest({
      MerchantTradeNo: 'ORDER_DB_FAIL',
      CheckMacValue: 'VALID_MAC',
    })
    const res = await POST(req)

    // upgrade detection failure is non-blocking, should still redirect
    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/join/success')
    expect(location).not.toContain('upgrade=1')
  })

  it('redirects to error page on unexpected exception in form parsing', async () => {
    // Send a request that will cause formData() to fail
    const req = new NextRequest('http://localhost:3000/api/subscribe/return', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=INVALID' },
      body: 'corrupt-body-data',
    })

    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/join?error=1')
  })

  it('uses NEXT_PUBLIC_SITE_URL for redirect origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com'

    vi.resetModules()
    vi.doMock('@/lib/ecpay', () => ({
      verifyCheckMacValue: (...args: any[]) => mockVerifyCheckMacValue(...args),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createServiceSupabase: () => mockSupabase,
    }))

    const mod = await import('@/app/api/subscribe/return/route')
    const freshPOST = mod.POST

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const req = makeFormRequest({
      MerchantTradeNo: 'URL_TEST',
      CheckMacValue: 'VALID_MAC',
    })
    const res = await freshPOST(req)

    const location = res.headers.get('location')
    expect(location).toContain('https://custom-domain.com/join/success')
  })
})
