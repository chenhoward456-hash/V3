import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
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

const mockVerifyAdminSession = vi.hoisted(() => vi.fn())
const mockSendPushNotification = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: any[]) => mockSendPushNotification(...args),
}))

import { POST } from '@/app/api/push/send/route'

// ── Helpers ──

function makePostRequest(body: any, hasAdminCookie: boolean = true): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (hasAdminCookie) {
    headers['cookie'] = 'admin_session=valid-token-123'
  }
  return new NextRequest('http://localhost:3000/api/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('POST /api/push/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(true)
    mockSendPushNotification.mockResolvedValue(true)
  })

  it('sends push notification to all subscribers successfully', async () => {
    const subscriptions = [
      { endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/2', p256dh: 'key2', auth: 'auth2' },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(subscriptions, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      title: 'Test Notification',
      body: 'Hello World',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sent).toBe(2)
    expect(json.total).toBe(2)
    expect(json.expired).toBe(0)
    expect(mockSendPushNotification).toHaveBeenCalledTimes(2)
  })

  it('sends notification with correct payload including url', async () => {
    const subscriptions = [
      { endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(subscriptions, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
      url: '/dashboard',
    })
    await POST(req)

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/1', keys: { p256dh: 'key1', auth: 'auth1' } },
      { title: 'Test', body: 'Content', url: '/dashboard' }
    )
  })

  it('sends notification to specific client when clientId is provided', async () => {
    const subscriptions = [
      { endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(subscriptions, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      clientId: 'client-uuid-1',
      title: 'Personal Message',
      body: 'Just for you',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sent).toBe(1)
  })

  it('cleans up expired subscriptions when push fails', async () => {
    const subscriptions = [
      { endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/2', p256dh: 'key2', auth: 'auth2' },
      { endpoint: 'https://push.example.com/3', p256dh: 'key3', auth: 'auth3' },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(subscriptions, null)
      }
      return createMockQueryBuilder(null, null)
    })

    // First two succeed, third fails
    mockSendPushNotification
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false) // expired
      .mockResolvedValueOnce(true)

    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sent).toBe(2)
    expect(json.expired).toBe(1)
    expect(json.total).toBe(3)

    // Verify cleanup was attempted for the expired endpoint
    const deleteCalls = mockSupabase.from.mock.calls.filter(
      (c: any[], idx: number) => {
        // After the initial query, subsequent calls to push_subscriptions are for cleanup
        return c[0] === 'push_subscriptions' && idx > 0
      }
    )
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 0 sent when no subscribers exist', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder([], null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sent).toBe(0)
    expect(json.message).toBeDefined()
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })

  it('returns 401 when admin session is not present', async () => {
    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
    }, false) // no admin cookie

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })

  it('returns 401 when admin session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })

  it('returns 400 when title is missing', async () => {
    const req = makePostRequest({
      body: 'Content without title',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when body is missing', async () => {
    const req = makePostRequest({
      title: 'Title without body',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when both title and body are missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when subscription query fails', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return createMockQueryBuilder(null, { message: 'DB connection error' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({
      title: 'Test',
      body: 'Content',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
