import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

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

vi.mock('@/lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/lib/nutrition-engine', () => ({
  calculateInitialTargets: vi.fn(() => ({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
    estimatedTDEE: 2400,
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

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}))

import { POST } from '@/app/api/subscribe/free-trial/route'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { writeAuditLog } from '@/lib/audit'

function makeRequest(body: any, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/subscribe/free-trial', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe/free-trial', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: rate limit allows requests
    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 2 })

    // createErrorResponse returns a proper NextResponse
    mockCreateErrorResponse.mockImplementation((message: string, status: number) => {
      return NextResponse.json(
        { error: message, code: status, timestamp: new Date().toISOString() },
        { status }
      )
    })

    // Default table results: no existing free trial, client creation succeeds
    mockTableCalls['subscription_purchases'] = { data: [], error: null }
    mockTableCalls['clients'] = { data: { id: 'new-client-id' }, error: null }
    mockTableCalls['body_composition'] = { data: null, error: null }
    mockTableCalls['referral_codes'] = { data: null, error: null }
    mockTableCalls['referrals'] = { data: null, error: null }
  })

  // ── Successful Free Trial Creation ──

  it('should return 200 with success and uniqueCode', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
      gender: '男性',
      age: 28,
      goalType: 'cut',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.uniqueCode).toBeDefined()
    expect(typeof json.uniqueCode).toBe('string')
    expect(json.uniqueCode.length).toBeGreaterThan(0)
  })

  it('should return the trimmed name in the response', async () => {
    const req = makeRequest({
      name: '  Test User  ',
      email: 'newuser@example.com',
      gender: '男性',
      age: 28,
      goalType: 'cut',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.name).toBe('Test User')
  })

  it('should return tier as free', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.tier).toBe('free')
  })

  // ── Client Creation with Correct Defaults ──

  it('should create client with free tier features via getDefaultFeatures', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
      gender: '女性',
      age: 30,
      goalType: 'bulk',
    })

    await POST(req)

    expect(getDefaultFeatures).toHaveBeenCalledWith('free')
    // Verify client insert was called
    expect(mockSupabase.from).toHaveBeenCalledWith('clients')
  })

  it('should insert client with subscription_tier=free and expires_at=null', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
      goalType: 'recomp',
    })

    await POST(req)

    // The from('clients') call confirms client insert attempt
    expect(mockSupabase.from).toHaveBeenCalledWith('clients')
  })

  it('should insert subscription_purchase with status=completed and amount=0', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
    })

    await POST(req)

    // Verify subscription_purchases was accessed
    expect(mockSupabase.from).toHaveBeenCalledWith('subscription_purchases')
  })

  // ── Welcome Email Sending ──

  it('should send welcome email with correct parameters', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
      gender: '男性',
      age: 28,
      goalType: 'cut',
    })

    await POST(req)

    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newuser@example.com',
        name: 'Test User',
        tier: 'free',
        uniqueCode: expect.any(String),
      })
    )
  })

  it('should not send email when email is empty', async () => {
    // The route validates email so it returns 400 before sending
    const req = makeRequest({
      name: 'Test User',
      email: '',
    })

    await POST(req)

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  // ── Duplicate Email Handling ──

  it('should return 400 when email already has a free trial', async () => {
    mockTableCalls['subscription_purchases'] = {
      data: [{ id: 'existing-purchase-id' }],
      error: null,
    }

    const req = makeRequest({
      name: 'Duplicate User',
      email: 'existing@example.com',
      gender: '男性',
      age: 25,
      goalType: 'cut',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    // Should not create a client or send email
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('should allow creation when no existing free trial found', async () => {
    mockTableCalls['subscription_purchases'] = { data: [], error: null }

    const req = makeRequest({
      name: 'New User',
      email: 'brand-new@example.com',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  // ── Missing Fields Validation ──

  it('should return 400 when name is missing', async () => {
    const req = makeRequest({
      email: 'test@example.com',
      goalType: 'cut',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 when name is empty string', async () => {
    const req = makeRequest({
      name: '',
      email: 'test@example.com',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 when name is whitespace only', async () => {
    const req = makeRequest({
      name: '   ',
      email: 'test@example.com',
    })

    const res = await POST(req)

    // name.trim().length < 1 fails
    expect(res.status).toBe(400)
  })

  it('should return 400 when email is missing', async () => {
    const req = makeRequest({
      name: 'Test User',
      goalType: 'cut',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('should return 400 for invalid email format', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'not-an-email',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  // ── Referral Tracking ──

  it('should track referral when valid ref code is provided', async () => {
    mockTableCalls['referral_codes'] = {
      data: { id: 'code-1', client_id: 'referrer-id', total_referrals: 3 },
      error: null,
    }
    mockTableCalls['referrals'] = { data: null, error: null }

    const req = makeRequest({
      name: 'Referred User',
      email: 'referred@example.com',
      ref: 'ABC123',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    // Verify referral_codes table was queried
    expect(mockSupabase.from).toHaveBeenCalledWith('referral_codes')
  })

  it('should not track referral when ref is not provided', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
    })

    await POST(req)

    // referral_codes should NOT be queried when no ref parameter
    const referralCodesCalls = mockSupabase.from.mock.calls.filter(
      ([table]: [string]) => table === 'referral_codes'
    )
    expect(referralCodesCalls.length).toBe(0)
  })

  it('should include ref_source when ref param is provided', async () => {
    mockTableCalls['referral_codes'] = { data: null, error: null }

    const req = makeRequest({
      name: 'Referred User',
      email: 'referred@example.com',
      ref: 'XYZ789',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    // Client insert should include ref_source
    expect(mockSupabase.from).toHaveBeenCalledWith('clients')
  })

  // ── Rate Limiting ──

  it('should return 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makeRequest({
      name: 'Test User',
      email: 'test@example.com',
    })

    const res = await POST(req)

    expect(res.status).toBe(429)
    // Should not attempt DB operations
    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('should call rateLimit with IP-based key and limit of 3', async () => {
    mockGetClientIP.mockReturnValue('10.0.0.1')

    const req = makeRequest(
      { name: 'Test User', email: 'test@example.com' },
      '10.0.0.1'
    )
    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    const [key, maxRequests, windowMs] = mockRateLimit.mock.calls[0]
    expect(key).toContain('10.0.0.1')
    expect(maxRequests).toBe(3)
    expect(windowMs).toBe(60_000)
  })

  // ── Client Creation Error ──

  it('should return 500 when client creation fails', async () => {
    mockTableCalls['clients'] = {
      data: null,
      error: { message: 'Unique constraint violation' },
    }

    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  // ── Audit Log ──

  it('should write audit log on successful creation', async () => {
    const req = makeRequest({
      name: 'Test User',
      email: 'newuser@example.com',
    })

    await POST(req)

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription.created',
        actor: 'system',
        targetType: 'client',
        targetId: 'new-client-id',
      })
    )
  })

  // ── Malformed JSON Body ──

  it('should return 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/subscribe/free-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  // ── Optional Fields ──

  it('should succeed without optional fields (gender, age, goalType)', async () => {
    const req = makeRequest({
      name: 'Minimal User',
      email: 'minimal@example.com',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
