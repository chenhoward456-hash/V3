import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

import { POST } from '@/app/api/subscribe/waitlist/route'

// ── Helpers ──

function makeWaitlistRequest(body: any) {
  return new Request('http://localhost:3000/api/subscribe/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

// ── Tests ──

describe('POST /api/subscribe/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success for valid email', async () => {
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockReturnValue({ error: null }),
    }))

    const req = makeWaitlistRequest({ email: 'test@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('defaults tier to self_managed when not provided', async () => {
    const mockUpsert = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockImplementation(() => ({
      upsert: mockUpsert,
    }))

    const req = makeWaitlistRequest({ email: 'test@example.com' })
    await POST(req)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'self_managed' }),
      expect.any(Object),
    )
  })

  it('uses provided tier value', async () => {
    const mockUpsert = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockImplementation(() => ({
      upsert: mockUpsert,
    }))

    const req = makeWaitlistRequest({ email: 'test@example.com', tier: 'premium' })
    await POST(req)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'premium' }),
      expect.any(Object),
    )
  })

  it('lowercases email before saving', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockImplementation(() => ({
      upsert: upsertFn,
    }))

    const req = makeWaitlistRequest({ email: 'Test@EXAMPLE.COM' })
    await POST(req)

    expect(upsertFn).toHaveBeenCalledTimes(1)
    const [insertedData] = upsertFn.mock.calls[0]
    expect(insertedData.email).toBe('test@example.com')
  })

  it('returns 400 when email is missing', async () => {
    const req = makeWaitlistRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when email is empty string', async () => {
    const req = makeWaitlistRequest({ email: '' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when email format is invalid', async () => {
    const req = makeWaitlistRequest({ email: 'not-an-email' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for email without domain', async () => {
    const req = makeWaitlistRequest({ email: 'user@' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for email without TLD', async () => {
    const req = makeWaitlistRequest({ email: 'user@domain' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 200 even when Supabase upsert fails (graceful degradation)', async () => {
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockReturnValue({ error: { message: 'Table does not exist' } }),
    }))

    const req = makeWaitlistRequest({ email: 'test@example.com' })
    const res = await POST(req)
    const json = await res.json()

    // Route intentionally returns success even on DB failure to not block UX
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('upserts with onConflict email', async () => {
    const mockUpsert = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockImplementation(() => ({
      upsert: mockUpsert,
    }))

    const req = makeWaitlistRequest({ email: 'duplicate@example.com' })
    await POST(req)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: 'email' },
    )
  })

  it('returns 500 for malformed JSON body', async () => {
    const req = new Request('http://localhost:3000/api/subscribe/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    }) as any

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('calls from with waitlist table', async () => {
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockReturnValue({ error: null }),
    }))

    const req = makeWaitlistRequest({ email: 'test@example.com' })
    await POST(req)

    expect(mockFrom).toHaveBeenCalledWith('waitlist')
  })
})
