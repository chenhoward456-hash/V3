import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
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

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()
const mockReadFile = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status }, { status })
  },
}))

vi.mock('fs/promises', () => ({
  default: { readFile: (...args: any[]) => mockReadFile(...args) },
  readFile: (...args: any[]) => mockReadFile(...args),
}))

import { GET } from '@/app/api/ebook/download/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/ebook/download')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('GET /api/ebook/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content'))
  })

  it('returns PDF for valid download token', async () => {
    // First call: select purchase (maybeSingle) - return valid purchase
    // Second call: update download_count then select
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'ebook_purchases') {
        callCount++
        if (callCount === 1) {
          return createMockQueryBuilder(
            { id: 'purchase-1', product_key: 'system-reboot-v1', download_count: 0, status: 'completed' },
            null
          )
        } else {
          // update call returns updated rows
          return createMockQueryBuilder([{ id: 'purchase-1' }], null)
        }
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeGetRequest({ token: 'valid-token-123' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('returns 400 when token is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 for invalid/expired token', async () => {
    mockTableCalls['ebook_purchases'] = { data: null, error: null }

    const req = makeGetRequest({ token: 'invalid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when download limit exceeded', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: { id: 'purchase-1', product_key: 'system-reboot-v1', download_count: 20, status: 'completed' },
      error: null,
    }

    const req = makeGetRequest({ token: 'valid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = makeGetRequest({ token: 'some-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when DB query returns error', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: null,
      error: { message: 'DB error' },
    }

    const req = makeGetRequest({ token: 'some-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })
})
