import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
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
    from: vi.fn((_table: string) => createMockQueryBuilder(null, null)),
  }

  return { mockSupabase, createMockQueryBuilder }
})

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

import { POST, DELETE } from '@/app/api/push/subscribe/route'

// ── Helpers ──

function makePostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REqnos',
    auth: 'tBHItJI5svbpC7htgMb2AA',
  },
}

// ── Tests ──

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves push subscription successfully', async () => {
    let clientsCallCount = 0
    let pushSubCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        return createMockQueryBuilder({ id: 'client-uuid-1' }, null)
      }
      if (table === 'push_subscriptions') {
        pushSubCallCount++
        // upsert returns no error
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      subscription: validSubscription,
      clientId: 'ABC123',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)

    // Verify from('push_subscriptions') was called for upsert
    const pushCalls = mockSupabase.from.mock.calls.filter(
      (c: any[]) => c[0] === 'push_subscriptions'
    )
    expect(pushCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 400 when subscription endpoint is missing', async () => {
    const req = makePostRequest({
      subscription: { keys: { p256dh: 'aaa', auth: 'bbb' } },
      clientId: 'ABC123',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when subscription keys are missing', async () => {
    const req = makePostRequest({
      subscription: { endpoint: 'https://example.com/push' },
      clientId: 'ABC123',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when subscription p256dh key is missing', async () => {
    const req = makePostRequest({
      subscription: {
        endpoint: 'https://example.com/push',
        keys: { auth: 'bbb' },
      },
      clientId: 'ABC123',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePostRequest({
      subscription: validSubscription,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is not a string', async () => {
    const req = makePostRequest({
      subscription: validSubscription,
      clientId: 12345,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId exceeds max length', async () => {
    const req = makePostRequest({
      subscription: validSubscription,
      clientId: 'a'.repeat(37), // > 36 characters
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(null, null) // maybeSingle returns null
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      subscription: validSubscription,
      clientId: 'NONEXISTENT',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when upsert fails (DB error)', async () => {
    let pushSubCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder({ id: 'client-uuid-1' }, null)
      }
      if (table === 'push_subscriptions') {
        pushSubCallCount++
        // Simulate DB error on upsert
        return createMockQueryBuilder(null, { message: 'duplicate key violation' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      subscription: validSubscription,
      clientId: 'ABC123',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when request body is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('DELETE /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes subscription successfully', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeDeleteRequest({ endpoint: 'https://example.com/push/abc' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 400 when endpoint is missing', async () => {
    const req = makeDeleteRequest({})
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when request body is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad-json!!!',
    })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
