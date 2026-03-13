import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockDestroyAdminSession = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  destroyAdminSession: (...args: any[]) => mockDestroyAdminSession(...args),
}))

import { POST } from '@/app/api/admin/logout/route'

// ── Helpers ──

function makeLogoutRequest(options: { withSession?: boolean; sessionValue?: string } = {}): NextRequest {
  const { withSession = true, sessionValue = 'valid-token-123' } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (withSession) {
    headers['Cookie'] = `admin_session=${sessionValue}`
  }
  return new NextRequest('http://localhost:3000/api/admin/logout', {
    method: 'POST',
    headers,
  })
}

// ── Tests ──

describe('POST /api/admin/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success on logout with valid session', async () => {
    const req = makeLogoutRequest()
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('calls destroyAdminSession with the session token', async () => {
    const req = makeLogoutRequest({ sessionValue: 'my-session-token-456' })
    await POST(req)

    expect(mockDestroyAdminSession).toHaveBeenCalledTimes(1)
    expect(mockDestroyAdminSession).toHaveBeenCalledWith('my-session-token-456')
  })

  it('clears admin_session cookie with maxAge 0', async () => {
    const req = makeLogoutRequest()
    const res = await POST(req)

    expect(res.status).toBe(200)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('admin_session=')
    expect(setCookie).toContain('Max-Age=0')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie?.toLowerCase()).toContain('samesite=strict')
  })

  it('returns 200 even without a session cookie (graceful handling)', async () => {
    const req = makeLogoutRequest({ withSession: false })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('does not call destroyAdminSession when no session cookie is present', async () => {
    const req = makeLogoutRequest({ withSession: false })
    await POST(req)

    expect(mockDestroyAdminSession).not.toHaveBeenCalled()
  })

  it('still clears the cookie even when no session cookie was present', async () => {
    const req = makeLogoutRequest({ withSession: false })
    const res = await POST(req)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('admin_session=')
    expect(setCookie).toContain('Max-Age=0')
  })
})
