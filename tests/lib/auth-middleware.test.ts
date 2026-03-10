import { describe, it, expect, beforeEach, vi } from 'vitest'

// Stub env vars needed by auth-middleware
vi.stubEnv('SESSION_SECRET', 'test-session-secret-for-vitest')

// Mock Supabase before importing auth-middleware (it creates client at module level)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
  }),
}))

import { rateLimit, createAdminSession, verifyAdminSession, sanitizeTextField, validateNumericField } from '@/lib/auth-middleware'

describe('rateLimit', () => {
  it('should allow requests within limit', () => {
    const key = `test-${Date.now()}`
    const { allowed, remaining } = rateLimit(key, 5, 60_000)
    expect(allowed).toBe(true)
    expect(remaining).toBe(4)
  })

  it('should block requests exceeding limit', () => {
    const key = `test-block-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60_000)
    }
    const { allowed } = rateLimit(key, 5, 60_000)
    expect(allowed).toBe(false)
  })

  it('should reset after window expires', async () => {
    const key = `test-reset-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 50) // 50ms window
    }

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 60))

    const { allowed } = rateLimit(key, 5, 50)
    expect(allowed).toBe(true)
  })
})

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
})

describe('sanitizeTextField', () => {
  it('should return null for empty input', () => {
    expect(sanitizeTextField(null)).toBeNull()
    expect(sanitizeTextField(undefined)).toBeNull()
    expect(sanitizeTextField('')).toBeNull()
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

  it('should respect maxLength', () => {
    const long = 'a'.repeat(1000)
    const result = sanitizeTextField(long, 100)
    expect(result?.length).toBe(100)
  })
})

describe('validateNumericField', () => {
  it('should accept valid numbers', () => {
    const { isValid } = validateNumericField(50, 0, 100, 'test')
    expect(isValid).toBe(true)
  })

  it('should reject out of range', () => {
    const { isValid, error } = validateNumericField(150, 0, 100, 'test')
    expect(isValid).toBe(false)
    expect(error).toContain('test')
  })

  it('should accept null (optional)', () => {
    const { isValid } = validateNumericField(null, 0, 100, 'test')
    expect(isValid).toBe(true)
  })

  it('should reject NaN', () => {
    const { isValid } = validateNumericField(NaN, 0, 100, 'test')
    expect(isValid).toBe(false)
  })
})
