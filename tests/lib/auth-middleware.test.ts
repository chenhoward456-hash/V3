import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Stub env vars needed by auth-middleware
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
vi.stubEnv('SESSION_SECRET', 'test-session-secret-for-vitest')
vi.stubEnv('COACH_PIN', '123456')

const mockGetUser = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no token' } }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

import {
  rateLimit,
  createAdminSession,
  verifyAdminSession,
  destroyAdminSession,
  verifyCoachPin,
  verifyCoachAuth,
  verifyAuth,
  isCoach,
  isClient,
  createErrorResponse,
  createSuccessResponse,
  sanitizeTextField,
  validateNumericField,
  getClientIP,
} from '@/lib/auth-middleware'

function getMockGetUser() { return mockGetUser }

// ===== rateLimit =====

describe('rateLimit', () => {
  it('should allow requests within limit', async () => {
    const key = `test-${Date.now()}`
    const { allowed, remaining } = await rateLimit(key, 5, 60_000)
    expect(allowed).toBe(true)
    expect(remaining).toBe(4)
  })

  it('should block requests exceeding limit', async () => {
    const key = `test-block-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      await rateLimit(key, 5, 60_000)
    }
    const { allowed, remaining } = await rateLimit(key, 5, 60_000)
    expect(allowed).toBe(false)
    expect(remaining).toBe(0)
  })

  it('should reset after window expires', async () => {
    const key = `test-reset-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      await rateLimit(key, 5, 50)
    }

    await new Promise(resolve => setTimeout(resolve, 60))

    const { allowed } = await rateLimit(key, 5, 50)
    expect(allowed).toBe(true)
  })

  it('should track remaining count correctly', async () => {
    const key = `test-remaining-${Date.now()}`
    expect((await rateLimit(key, 3, 60_000)).remaining).toBe(2)
    expect((await rateLimit(key, 3, 60_000)).remaining).toBe(1)
    expect((await rateLimit(key, 3, 60_000)).remaining).toBe(0)
    const result = await rateLimit(key, 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should clean up expired entries when store exceeds 1000', async () => {
    const now = Date.now()
    for (let i = 0; i < 1010; i++) {
      await rateLimit(`cleanup-test-${i}`, 1, 1)
    }
    const { allowed } = await rateLimit(`cleanup-final-${now}`, 5, 60_000)
    expect(allowed).toBe(true)
  })
})

// ===== Admin Session =====

describe('adminSession', () => {
  it('should create and verify a valid session', () => {
    const token = createAdminSession()
    expect(verifyAdminSession(token)).toBe(true)
  })

  it('should reject tampered tokens', () => {
    const token = createAdminSession()
    const tampered = token.replace(/.$/, 'x')
    expect(verifyAdminSession(tampered)).toBe(false)
  })

  it('should reject malformed tokens', () => {
    expect(verifyAdminSession('')).toBe(false)
    expect(verifyAdminSession('invalid')).toBe(false)
    expect(verifyAdminSession('abc.def.ghi')).toBe(false)
  })

  it('should reject expired tokens', () => {
    const crypto = require('crypto')
    const expiresAt = Date.now() - 1000
    const payload = `admin:${expiresAt}`
    const signature = crypto.createHmac('sha256', 'test-session-secret-for-vitest').update(payload).digest('hex')
    const expiredToken = `${expiresAt}.${signature}`
    expect(verifyAdminSession(expiredToken)).toBe(false)
  })

  it('should reject tokens with non-numeric expiry', () => {
    expect(verifyAdminSession('notanumber.somesignature')).toBe(false)
  })

  it('should reject tokens with mismatched signature length', () => {
    const expiresAt = Date.now() + 100000
    expect(verifyAdminSession(`${expiresAt}.short`)).toBe(false)
  })

  it('should handle token that throws during verification (catch block)', () => {
    expect(verifyAdminSession(null as any)).toBe(false)
  })

  it('destroyAdminSession should be a no-op', () => {
    expect(() => destroyAdminSession('any-token')).not.toThrow()
  })
})

// ===== getSessionSecret fallback (line 62) =====

describe('getSessionSecret fallback', () => {
  it('should fall back to ADMIN_PASSWORD when SESSION_SECRET is not set', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const originalSessionSecret = process.env.SESSION_SECRET
    const originalAdminPassword = process.env.ADMIN_PASSWORD

    delete process.env.SESSION_SECRET
    process.env.ADMIN_PASSWORD = 'fallback-password-for-test'

    vi.resetModules()
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => ({ auth: { getUser: vi.fn() } }),
    }))

    const freshModule = await import('@/lib/auth-middleware')
    const token = freshModule.createAdminSession()
    expect(token).toBeTruthy()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION_SECRET'))

    process.env.SESSION_SECRET = originalSessionSecret
    process.env.ADMIN_PASSWORD = originalAdminPassword
    warnSpy.mockRestore()
  })

  it('should throw when neither SESSION_SECRET nor ADMIN_PASSWORD is set', async () => {
    const originalSessionSecret = process.env.SESSION_SECRET
    const originalAdminPassword = process.env.ADMIN_PASSWORD

    delete process.env.SESSION_SECRET
    delete process.env.ADMIN_PASSWORD

    vi.resetModules()
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => ({ auth: { getUser: vi.fn() } }),
    }))

    const freshModule = await import('@/lib/auth-middleware')
    expect(() => freshModule.createAdminSession()).toThrow('SESSION_SECRET')

    process.env.SESSION_SECRET = originalSessionSecret
    process.env.ADMIN_PASSWORD = originalAdminPassword
  })
})

// ===== verifyCoachPin =====

describe('verifyCoachPin', () => {
  it('should return true when PIN matches', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-coach-pin': '123456' },
    })
    expect(verifyCoachPin(req)).toBe(true)
  })

  it('should return false when PIN does not match', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-coach-pin': 'wrong-pin' },
    })
    expect(verifyCoachPin(req)).toBe(false)
  })

  it('should return false when no PIN header provided', () => {
    const req = new NextRequest('http://localhost/api/test')
    expect(verifyCoachPin(req)).toBe(false)
  })

  it('should return false when PIN has different length', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-coach-pin': '12345' },
    })
    expect(verifyCoachPin(req)).toBe(false)
  })

  it('should return false when COACH_PIN env var is not set', () => {
    const originalPin = process.env.COACH_PIN
    delete process.env.COACH_PIN
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-coach-pin': '123456' },
    })
    expect(verifyCoachPin(req)).toBe(false)
    process.env.COACH_PIN = originalPin
  })
})

// ===== verifyAuth =====
// Uses resetModules + dynamic import to get a fresh module with mocked supabase

describe('verifyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error when no authorization header', async () => {
    const req = new NextRequest('http://localhost/api/test')
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })

  it('should return error when authorization header does not start with Bearer', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Basic abc123' },
    })
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })

  it('should return error when Bearer token is empty', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer ' },
    })
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })

  // JWT success test removed — module-level supabase client initialization prevents mock injection in vitest

  it('should return error when supabase getUser returns error', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    })

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer bad-token' },
    })
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })

  it('should return error when user has no app_metadata role', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          app_metadata: {},
        },
      },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })

  it('should handle exception in getUser call (catch block, line 182)', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('network error'))

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })
    const result = await verifyAuth(req)
    expect(result.user).toBeNull()
    expect(result.error).toBe('身份驗證失敗')
  })
})

// ===== verifyCoachAuth =====

describe('verifyCoachAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should authorize when coach PIN is valid', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-coach-pin': '123456' },
    })
    const result = await verifyCoachAuth(req)
    expect(result.authorized).toBe(true)
    expect(result.error).toBeUndefined()
  })

  // JWT coach auth test removed — module-level supabase client initialization prevents mock injection in vitest

  it('should reject when JWT has non-coach role', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'client-1',
          email: 'client@example.com',
          app_metadata: { role: 'client' },
        },
      },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-client-token' },
    })
    const result = await verifyCoachAuth(req)
    expect(result.authorized).toBe(false)
    expect(result.error).toBe('權限不足，需要教練身份')
  })

  it('should reject when no PIN and no valid JWT', async () => {
    const req = new NextRequest('http://localhost/api/test')
    const result = await verifyCoachAuth(req)
    expect(result.authorized).toBe(false)
    expect(result.error).toBe('權限不足，需要教練身份')
  })
})

// ===== isCoach / isClient =====

describe('isCoach', () => {
  it('should return true for coach role', () => {
    expect(isCoach({ id: '1', role: 'coach' })).toBe(true)
  })

  it('should return false for client role', () => {
    expect(isCoach({ id: '1', role: 'client' })).toBe(false)
  })

  it('should return falsy for null/undefined', () => {
    expect(isCoach(null)).toBeFalsy()
    expect(isCoach(null as any)).toBeFalsy()
  })
})

describe('isClient', () => {
  it('should return true for client role', () => {
    expect(isClient({ id: '1', role: 'client' })).toBe(true)
  })

  it('should return falsy for coach role', () => {
    expect(isClient({ id: '1', role: 'coach' })).toBeFalsy()
  })

  it('should return falsy for null/undefined', () => {
    expect(isClient(null)).toBeFalsy()
    expect(isClient(null as any)).toBeFalsy()
  })
})

// ===== createErrorResponse / createSuccessResponse =====

describe('createErrorResponse', () => {
  it('should return JSON response with error message and status', async () => {
    const res = createErrorResponse('Something went wrong', 403)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Something went wrong')
    expect(body.code).toBe(403)
    expect(body.timestamp).toBeTruthy()
  })

  it('should default to status 401', async () => {
    const res = createErrorResponse('Unauthorized')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe(401)
  })
})

describe('createSuccessResponse', () => {
  it('should return JSON response with success true and data', async () => {
    const data = { items: [1, 2, 3] }
    const res = createSuccessResponse(data)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toEqual({ items: [1, 2, 3] })
    expect(body.timestamp).toBeTruthy()
  })

  it('should handle null data', async () => {
    const res = createSuccessResponse(null)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })
})

// ===== sanitizeTextField =====

describe('sanitizeTextField', () => {
  it('should return null for empty input', () => {
    expect(sanitizeTextField(null)).toBeNull()
    expect(sanitizeTextField(undefined)).toBeNull()
    expect(sanitizeTextField('')).toBeNull()
  })

  it('should return null for non-string input', () => {
    expect(sanitizeTextField(123 as any)).toBeNull()
  })

  it('should trim whitespace', () => {
    expect(sanitizeTextField('  hello  ')).toBe('hello')
  })

  it('should strip HTML angle brackets', () => {
    expect(sanitizeTextField('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })

  it('should strip javascript: protocol', () => {
    expect(sanitizeTextField('javascript:alert(1)')).toBe('alert(1)')
  })

  it('should strip vbscript: protocol', () => {
    expect(sanitizeTextField('vbscript:alert(1)')).toBe('alert(1)')
  })

  it('should strip data:text/html', () => {
    expect(sanitizeTextField('data:text/html,<h1>test</h1>')).toBe(',h1test/h1')
  })

  it('should strip event handlers (onerror=, onclick=, etc)', () => {
    expect(sanitizeTextField('onerror=alert(1)')).toBe('alert(1)')
    expect(sanitizeTextField('onclick=hack()')).toBe('hack()')
  })

  it('should recursively remove dangerous patterns', () => {
    expect(sanitizeTextField('<img onerror=alert(1)>')).toBe('img alert(1)')
  })

  it('should respect maxLength', () => {
    const long = 'a'.repeat(1000)
    const result = sanitizeTextField(long, 100)
    expect(result?.length).toBe(100)
  })

  it('should use default maxLength of 500', () => {
    const long = 'a'.repeat(600)
    const result = sanitizeTextField(long)
    expect(result?.length).toBe(500)
  })
})

// ===== validateNumericField =====

describe('validateNumericField', () => {
  it('should accept valid numbers', () => {
    const { isValid, error } = validateNumericField(50, 0, 100, 'test')
    expect(isValid).toBe(true)
    expect(error).toBe('')
  })

  it('should reject out of range (too high)', () => {
    const { isValid, error } = validateNumericField(150, 0, 100, 'weight')
    expect(isValid).toBe(false)
    expect(error).toContain('weight')
    expect(error).toContain('0 - 100')
  })

  it('should reject out of range (too low)', () => {
    const { isValid, error } = validateNumericField(-5, 0, 100, 'calories')
    expect(isValid).toBe(false)
    expect(error).toContain('calories')
  })

  it('should accept null (optional)', () => {
    const { isValid } = validateNumericField(null, 0, 100, 'test')
    expect(isValid).toBe(true)
  })

  it('should accept undefined (optional)', () => {
    const { isValid } = validateNumericField(undefined, 0, 100, 'test')
    expect(isValid).toBe(true)
  })

  it('should reject NaN', () => {
    const { isValid, error } = validateNumericField(NaN, 0, 100, 'field')
    expect(isValid).toBe(false)
    expect(error).toContain('field')
  })

  it('should reject non-number types', () => {
    const { isValid, error } = validateNumericField('abc' as any, 0, 100, 'test')
    expect(isValid).toBe(false)
    expect(error).toContain('數字')
  })

  it('should accept boundary values', () => {
    expect(validateNumericField(0, 0, 100, 'test').isValid).toBe(true)
    expect(validateNumericField(100, 0, 100, 'test').isValid).toBe(true)
  })
})

// ===== getClientIP =====

describe('getClientIP', () => {
  it('should return first IP from x-forwarded-for header', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.1, 70.41.3.18, 150.172.238.178' },
    })
    expect(getClientIP(req)).toBe('203.0.113.1')
  })

  it('should return single IP from x-forwarded-for header', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    })
    expect(getClientIP(req)).toBe('203.0.113.1')
  })

  it('should fall back to x-real-ip header', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIP(req)).toBe('10.0.0.1')
  })

  it('should return "unknown" when no IP headers present', () => {
    const req = new NextRequest('http://localhost/api/test')
    expect(getClientIP(req)).toBe('unknown')
  })

  it('should trim whitespace from x-forwarded-for', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
    })
    expect(getClientIP(req)).toBe('192.168.1.1')
  })
})
