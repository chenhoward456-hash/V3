import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

const { mockValidateSupplementName, mockValidateSupplementDosage, mockSanitizeInput } = vi.hoisted(() => {
  const mockValidateSupplementName = vi.fn()
  const mockValidateSupplementDosage = vi.fn()
  const mockSanitizeInput = vi.fn()
  return { mockValidateSupplementName, mockValidateSupplementDosage, mockSanitizeInput }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyCoachAuth: (...args: any[]) => mockVerifyCoachAuth(...args),
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status, timestamp: new Date().toISOString() }, { status })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: any) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  }),
}))

vi.mock('@/utils/validation', () => ({
  validateSupplementName: (...args: any[]) => mockValidateSupplementName(...args),
  validateSupplementDosage: (...args: any[]) => mockValidateSupplementDosage(...args),
  sanitizeInput: (...args: any[]) => mockSanitizeInput(...args),
}))

import { GET, POST, PUT, DELETE } from '@/app/api/supplements/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/supplements')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/supplements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-coach-pin': '1234',
    },
    body: JSON.stringify(body),
  })
}

function buildPutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/supplements', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-coach-pin': '1234',
    },
    body: JSON.stringify(body),
  })
}

function buildDeleteRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/supplements')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), {
    method: 'DELETE',
    headers: { 'x-coach-pin': '1234' },
  })
}

// ── Tests ──

describe('GET /api/supplements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // sanitizeInput returns the value passed to it by default
    mockSanitizeInput.mockImplementation((v: string) => v)
    mockValidateSupplementName.mockReturnValue({ isValid: true, error: '' })
    mockValidateSupplementDosage.mockReturnValue({ isValid: true, error: '' })
  })

  it('returns 400 when clientId is missing', async () => {
    const req = buildGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      // clients table lookup returns null
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns supplements list for valid client', async () => {
    const supplements = [
      { id: 's1', name: 'Fish Oil', dosage: '1000mg', timing: 'morning', sort_order: 0 },
      { id: 's2', name: 'Vitamin D', dosage: '2000IU', timing: 'morning', sort_order: 1 },
    ]

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table lookup
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'uuid-1' }, error: null }),
            }),
          }),
        }
      }
      // supplements table query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: supplements, error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('Fish Oil')
  })

  it('returns empty array when client has no supplements', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'uuid-1' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns 500 when supplements query fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'uuid-1' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/supplements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    mockSanitizeInput.mockImplementation((v: string) => v)
    mockValidateSupplementName.mockReturnValue({ isValid: true, error: '' })
    mockValidateSupplementDosage.mockReturnValue({ isValid: true, error: '' })
  })

  const validBody = {
    clientId: 'ABC123',
    name: 'Fish Oil',
    dosage: '1000mg',
    timing: 'morning',
    why: 'Omega-3 support',
  }

  it('returns 403 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: 'Permission denied' })

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when required fields are missing (no clientId)', async () => {
    const { clientId, ...body } = validBody
    const req = buildPostRequest(body)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when name is missing', async () => {
    const { name, ...body } = validBody
    const req = buildPostRequest(body)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when dosage is missing', async () => {
    const { dosage, ...body } = validBody
    const req = buildPostRequest(body)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when timing is missing', async () => {
    const { timing, ...body } = validBody
    const req = buildPostRequest(body)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when supplement name validation fails', async () => {
    mockValidateSupplementName.mockReturnValue({ isValid: false, error: 'Name too long' })

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when supplement dosage validation fails', async () => {
    mockValidateSupplementDosage.mockReturnValue({ isValid: false, error: 'Dosage invalid' })

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: null, error: null }),
        }),
      }),
    }))

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('creates supplement successfully', async () => {
    const createdSupplement = {
      id: 'supp-new',
      client_id: 'uuid-1',
      name: 'Fish Oil',
      dosage: '1000mg',
      timing: 'morning',
      why: 'Omega-3 support',
      sort_order: 0,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table lookup
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'uuid-1' }, error: null }),
            }),
          }),
        }
      }
      // supplements insert
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: createdSupplement, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('Fish Oil')
    expect(json.data.id).toBe('supp-new')
  })

  it('returns 500 when supplement insert fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'uuid-1' }, error: null }),
            }),
          }),
        }
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      }
    })

    const req = buildPostRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/supplements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coach-pin': '1234',
      },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('PUT /api/supplements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    mockSanitizeInput.mockImplementation((v: string) => v)
    mockValidateSupplementName.mockReturnValue({ isValid: true, error: '' })
    mockValidateSupplementDosage.mockReturnValue({ isValid: true, error: '' })
  })

  const validBody = {
    id: 'supp-1',
    name: 'Updated Fish Oil',
    dosage: '2000mg',
    timing: 'evening',
    why: 'Updated reason',
  }

  it('returns 403 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: 'Permission denied' })

    const req = buildPutRequest(validBody)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when id is missing', async () => {
    const { id, ...body } = validBody
    const req = buildPutRequest(body)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when name is missing', async () => {
    const { name, ...body } = validBody
    const req = buildPutRequest(body)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when dosage is missing', async () => {
    const { dosage, ...body } = validBody
    const req = buildPutRequest(body)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when timing is missing', async () => {
    const { timing, ...body } = validBody
    const req = buildPutRequest(body)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when name validation fails', async () => {
    mockValidateSupplementName.mockReturnValue({ isValid: false, error: 'Unsafe characters' })

    const req = buildPutRequest(validBody)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when dosage validation fails', async () => {
    mockValidateSupplementDosage.mockReturnValue({ isValid: false, error: 'Dosage too long' })

    const req = buildPutRequest(validBody)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('updates supplement successfully', async () => {
    const updatedSupplement = {
      id: 'supp-1',
      name: 'Updated Fish Oil',
      dosage: '2000mg',
      timing: 'evening',
      why: 'Updated reason',
      sort_order: 0,
    }

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: updatedSupplement, error: null }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest(validBody)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('Updated Fish Oil')
    expect(json.data.dosage).toBe('2000mg')
  })

  it('returns 500 when supplement update fails', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: { message: 'Update failed' } }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest(validBody)
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/supplements', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-coach-pin': '1234',
      },
      body: 'not-valid-json{{{',
    })

    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('DELETE /api/supplements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    mockSanitizeInput.mockImplementation((v: string) => v)
    mockValidateSupplementName.mockReturnValue({ isValid: true, error: '' })
    mockValidateSupplementDosage.mockReturnValue({ isValid: true, error: '' })
  })

  it('returns 403 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: 'Permission denied' })

    const req = buildDeleteRequest({ id: 'supp-1' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when id is missing', async () => {
    const req = buildDeleteRequest({})
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('deletes supplement successfully', async () => {
    mockFrom.mockImplementation(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: null }),
      }),
    }))

    const req = buildDeleteRequest({ id: 'supp-to-delete' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 when supplement delete fails', async () => {
    mockFrom.mockImplementation(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: { message: 'Delete failed' } }),
      }),
    }))

    const req = buildDeleteRequest({ id: 'supp-1' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
