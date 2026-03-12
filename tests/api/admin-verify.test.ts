import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockVerifyAdminSession = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

import { GET } from '@/app/api/admin/verify/route'

// ── Helpers ──

function makeGetRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) {
    headers['cookie'] = `admin_session=${cookie}`
  }
  return new NextRequest('http://localhost:3000/api/admin/verify', {
    method: 'GET',
    headers,
  })
}

// ── Tests ──

describe('GET /api/admin/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns authenticated=true for valid session', async () => {
    mockVerifyAdminSession.mockReturnValue(true)

    const req = makeGetRequest('valid-session-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.authenticated).toBe(true)
  })

  it('returns 401 for invalid session', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeGetRequest('invalid-token')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.authenticated).toBe(false)
  })

  it('returns 401 when no session cookie', async () => {
    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.authenticated).toBe(false)
  })

  it('returns 401 for empty session token', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeGetRequest('')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.authenticated).toBe(false)
  })

  it('calls verifyAdminSession with the token value', async () => {
    mockVerifyAdminSession.mockReturnValue(true)

    const req = makeGetRequest('my-session-123')
    await GET(req)

    expect(mockVerifyAdminSession).toHaveBeenCalledWith('my-session-123')
  })
})
