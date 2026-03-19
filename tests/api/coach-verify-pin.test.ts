import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()
const mockCreateErrorResponse = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
}))

// ── Helpers ──

function makeRequest(body: any, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/coach/verify-pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('POST /api/coach/verify-pin', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    mockRateLimit.mockReset()
    mockGetClientIP.mockReset()
    mockCreateErrorResponse.mockReset()

    // Default mock behaviour
    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    mockCreateErrorResponse.mockImplementation((message: string, status: number) => {
      const { NextResponse } = require('next/server')
      return NextResponse.json({ error: message }, { status })
    })

    // Set the coach PIN env var
    process.env.COACH_PIN = '123456'

    vi.doMock('@/lib/auth-middleware', () => ({
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
      createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
    }))

    const mod = await import('@/app/api/coach/verify-pin/route')
    POST = mod.POST
  })

  it('returns 200 with valid:true for correct PIN', async () => {
    const req = makeRequest({ pin: '123456' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
  })

  it('returns 401 with valid:false for wrong PIN', async () => {
    const req = makeRequest({ pin: '000000' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.valid).toBe(false)
  })

  it('returns 401 for PIN with different length', async () => {
    const req = makeRequest({ pin: '12345' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.valid).toBe(false)
  })

  it('returns 400 when pin is missing', async () => {
    const req = makeRequest({})
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 400 when pin is not a string', async () => {
    const req = makeRequest({ pin: 123456 })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 400 when pin is empty string', async () => {
    const req = makeRequest({ pin: '' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = makeRequest({ pin: '123456' })
    const res = await POST(req)

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('calls rateLimit with IP-based key', async () => {
    mockGetClientIP.mockReturnValue('192.168.1.50')

    const req = makeRequest({ pin: '123456' }, '192.168.1.50')
    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    const [key, maxRequests, windowMs] = mockRateLimit.mock.calls[0]
    expect(key).toContain('192.168.1.50')
    expect(key).toContain('verify-pin')
    expect(maxRequests).toBe(10)
    expect(windowMs).toBe(60_000)
  })

  it('returns 500 when COACH_PIN env var is not set', async () => {
    delete process.env.COACH_PIN

    vi.resetModules()
    vi.doMock('@/lib/auth-middleware', () => ({
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
      createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
    }))

    const mod = await import('@/app/api/coach/verify-pin/route')
    const freshPOST = mod.POST

    const req = makeRequest({ pin: 'anything' })
    const res = await freshPOST(req)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 500 on malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/coach/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })
})
