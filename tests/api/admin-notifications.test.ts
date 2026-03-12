import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
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

const mockVerifyAdminSession = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

import { GET, POST } from '@/app/api/admin/notifications/route'

// ── Helpers ──

function makeGetRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  const init: any = { method: 'GET', headers }

  const req = new NextRequest('http://localhost:3000/api/admin/notifications', init)
  if (cookie) {
    // NextRequest doesn't allow setting cookies directly in constructor,
    // so we create a request with cookie header
    return new NextRequest('http://localhost:3000/api/admin/notifications', {
      method: 'GET',
      headers: { cookie: `admin_session=${cookie}` },
    })
  }
  return req
}

function makePostRequest(body: any, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) {
    headers['cookie'] = `admin_session=${cookie}`
  }
  return new NextRequest('http://localhost:3000/api/admin/notifications', {
    method: 'POST',
    headers,
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

describe('GET /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns notifications list when authenticated', async () => {
    mockTableCalls['coach_notifications'] = {
      data: [
        { id: '1', message: 'New client', date: '2024-06-15', read: false },
        { id: '2', message: 'Client update', date: '2024-06-14', read: true },
      ],
      error: null,
    }

    const req = makeGetRequest('valid-session-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.notifications).toHaveLength(2)
  })

  it('returns empty array when no notifications exist', async () => {
    mockTableCalls['coach_notifications'] = { data: [], error: null }

    const req = makeGetRequest('valid-session-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.notifications).toEqual([])
  })

  it('returns empty array on DB error (graceful degradation)', async () => {
    mockTableCalls['coach_notifications'] = {
      data: null,
      error: { message: 'table not found' },
    }

    const req = makeGetRequest('valid-session-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.notifications).toEqual([])
  })

  it('returns 401 when not authenticated', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeGetRequest('invalid-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when no session cookie', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('marks single notification as read', async () => {
    const req = makePostRequest({ notificationId: 'notif-1' }, 'valid-session')
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('coach_notifications')
  })

  it('marks all notifications as read', async () => {
    const req = makePostRequest({ notificationId: 'all' }, 'valid-session')
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makePostRequest({ notificationId: 'notif-1' }, 'invalid-token')
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('succeeds even with empty body (no notificationId)', async () => {
    const req = makePostRequest({}, 'valid-session')
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
