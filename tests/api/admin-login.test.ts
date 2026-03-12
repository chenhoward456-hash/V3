import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockCreateAdminSession = vi.fn()
const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  createAdminSession: (...args: any[]) => mockCreateAdminSession(...args),
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
}))

// ── Helpers ──

function makeLoginRequest(body: any, ip: string = '127.0.0.1'): NextRequest {
  const bodyStr = JSON.stringify(body)
  return new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: bodyStr,
  })
}

// ── Tests ──

describe('POST /api/admin/login', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    mockCreateAdminSession.mockReset()
    mockRateLimit.mockReset()
    mockGetClientIP.mockReset()

    // Default mock behaviour
    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
    mockCreateAdminSession.mockReturnValue('1234567890.abcdef123456')

    // Set the admin password env var
    process.env.ADMIN_PASSWORD = 'correct-password-123'

    // Re-mock the module references AFTER resetModules to pick up fresh env
    vi.doMock('@/lib/auth-middleware', () => ({
      createAdminSession: (...args: any[]) => mockCreateAdminSession(...args),
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
    }))

    const mod = await import('@/app/api/admin/login/route')
    POST = mod.POST
  })

  it('returns 200 with success on correct password', async () => {
    const req = makeLoginRequest({ password: 'correct-password-123' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('sets admin_session cookie with correct properties', async () => {
    const req = makeLoginRequest({ password: 'correct-password-123' })
    const res = await POST(req)

    expect(res.status).toBe(200)

    // Check Set-Cookie header
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('admin_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie?.toLowerCase()).toContain('samesite=strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=86400')
  })

  it('calls createAdminSession on correct password', async () => {
    const req = makeLoginRequest({ password: 'correct-password-123' })
    await POST(req)

    expect(mockCreateAdminSession).toHaveBeenCalledTimes(1)
  })

  it('returns 401 with wrong password', async () => {
    const req = makeLoginRequest({ password: 'wrong-password' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
    expect(mockCreateAdminSession).not.toHaveBeenCalled()
  })

  it('returns 401 with empty password', async () => {
    const req = makeLoginRequest({ password: '' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when password is missing from body', async () => {
    const req = makeLoginRequest({})
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when password is not a string', async () => {
    const req = makeLoginRequest({ password: 12345 })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when password is null', async () => {
    const req = makeLoginRequest({ password: null })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makeLoginRequest({ password: 'correct-password-123' })
    const res = await POST(req)

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBeDefined()
    // Should not even attempt to verify password
    expect(mockCreateAdminSession).not.toHaveBeenCalled()
  })

  it('calls rateLimit with IP-based key', async () => {
    mockGetClientIP.mockReturnValue('192.168.1.1')

    const req = makeLoginRequest({ password: 'correct-password-123' }, '192.168.1.1')
    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    const [key, maxRequests, windowMs] = mockRateLimit.mock.calls[0]
    expect(key).toContain('192.168.1.1')
    expect(key).toContain('admin-login')
    expect(maxRequests).toBe(5)
    expect(windowMs).toBe(60_000)
  })

  it('returns 500 when ADMIN_PASSWORD env var is not set', async () => {
    delete process.env.ADMIN_PASSWORD

    // Re-import the module to pick up the unset env var
    vi.resetModules()
    vi.doMock('@/lib/auth-middleware', () => ({
      createAdminSession: (...args: any[]) => mockCreateAdminSession(...args),
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
    }))

    const mod = await import('@/app/api/admin/login/route')
    const freshPOST = mod.POST

    const req = makeLoginRequest({ password: 'anything' })
    const res = await freshPOST(req)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('does not leak whether the password is close to correct', async () => {
    // Both wrong passwords should get the same error message
    const req1 = makeLoginRequest({ password: 'wrong1' })
    const res1 = await POST(req1)
    const json1 = await res1.json()

    const req2 = makeLoginRequest({ password: 'completely-different' })
    const res2 = await POST(req2)
    const json2 = await res2.json()

    // Same status and same error message
    expect(res1.status).toBe(res2.status)
    expect(json1.error).toBe(json2.error)
  })
})
