import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

const mockVerifyAdminSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

import { GET, POST, PUT, DELETE } from '@/app/api/admin/clients/route'

// ── Helpers ──

function makeRequest(
  method: string,
  options: {
    body?: any
    withSession?: boolean
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { body, withSession = true, searchParams } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (withSession) {
    headers['Cookie'] = 'admin_session=valid-token-123'
  }
  const url = new URL('http://localhost:3000/api/admin/clients')
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }
  const init: any = { method, headers }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url.toString(), init)
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('GET /api/admin/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns 401 without admin session cookie', async () => {
    const req = makeRequest('GET', { withSession: false, searchParams: { id: 'client-1' } })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when session token is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('GET', { searchParams: { id: 'client-1' } })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 400 when id is missing', async () => {
    const req = makeRequest('GET')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns client data with lab_results and supplements on success', async () => {
    const clientData = {
      id: 'client-1',
      name: 'Test Client',
      lab_results: [{ id: 'lr-1', test_name: 'Vitamin D', value: 45 }],
      supplements: [{ id: 's-1', name: 'Fish Oil', dosage: '1000mg' }],
    }
    mockTableCalls['clients'] = { data: clientData, error: null }

    const req = makeRequest('GET', { searchParams: { id: 'client-1' } })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.name).toBe('Test Client')
    expect(json.lab_results).toHaveLength(1)
    expect(json.supplements).toHaveLength(1)
  })

  it('returns 500 when Supabase query fails', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'DB error' } }

    const req = makeRequest('GET', { searchParams: { id: 'client-1' } })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/admin/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  const validBody = {
    clientData: {
      unique_code: 'ABC123',
      name: 'New Client',
      age: 30,
      gender: 'male',
    },
  }

  it('returns 401 without admin session', async () => {
    const req = makeRequest('POST', { body: validBody, withSession: false })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('POST', { body: validBody })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('creates a new client successfully', async () => {
    const newClient = { id: 'new-uuid', unique_code: 'ABC123', name: 'New Client' }

    // First from('clients') call: insert client
    // Potentially from('lab_results') and from('supplements') for sub-records
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++
      if (table === 'clients') {
        return createMockQueryBuilder(newClient, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('POST', { body: validBody })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBe('new-uuid')
  })

  it('creates client with lab results and supplements', async () => {
    const newClient = { id: 'new-uuid', unique_code: 'ABC123', name: 'New Client' }
    const bodyWithRelated = {
      clientData: { unique_code: 'ABC123', name: 'New Client' },
      labResults: [{ test_name: 'Vitamin D', value: 50, unit: 'ng/mL' }],
      supplements: [{ name: 'Fish Oil', dosage: '1000mg', timing: 'morning' }],
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(newClient, null)
      }
      // lab_results and supplements insert calls
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('POST', { body: bodyWithRelated })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBe('new-uuid')
  })

  it('returns 500 when client insert fails', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'Insert failed' } }

    const req = makeRequest('POST', { body: validBody })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'admin_session=valid-token-123',
      },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it('filters out disallowed fields from clientData (e.g. id)', async () => {
    const newClient = { id: 'server-generated-uuid', name: 'Client' }
    mockSupabase.from.mockImplementation((table: string) => {
      return createMockQueryBuilder(newClient, null)
    })

    const bodyWithInjectedId = {
      clientData: {
        id: 'injected-id',
        name: 'Client',
        unique_code: 'CODE1',
      },
    }

    const req = makeRequest('POST', { body: bodyWithInjectedId })
    const res = await POST(req)
    const json = await res.json()

    // Should succeed - the 'id' field should be stripped by the whitelist
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })
})

describe('PUT /api/admin/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns 401 without admin session', async () => {
    const req = makeRequest('PUT', { body: { clientId: 'c1' }, withSession: false })
    const res = await PUT(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('PUT', { body: { clientId: 'c1' } })
    const res = await PUT(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeRequest('PUT', { body: { clientData: { name: 'Updated' } } })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('updates client successfully', async () => {
    // Multiple from() calls: lab_results updates, supplements updates, client update
    mockSupabase.from.mockImplementation(() => {
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('PUT', {
      body: {
        clientId: 'client-1',
        clientData: { name: 'Updated Name' },
      },
    })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 when client update fails', async () => {
    // All from() calls fail
    mockSupabase.from.mockImplementation(() => {
      return createMockQueryBuilder(null, { message: 'Update failed' })
    })

    const req = makeRequest('PUT', {
      body: {
        clientId: 'client-1',
        clientData: { name: 'Updated Name' },
      },
    })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'admin_session=valid-token-123',
      },
      body: 'not-valid-json{{{',
    })

    const res = await PUT(req)

    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/admin/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns 401 without admin session', async () => {
    const req = makeRequest('DELETE', { withSession: false, searchParams: { id: 'c1' } })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('DELETE', { searchParams: { id: 'c1' } })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    const req = makeRequest('DELETE')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('deletes client and related subscription_purchases successfully', async () => {
    // Both subscription_purchases and clients delete succeed
    mockSupabase.from.mockImplementation(() => {
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('DELETE', { searchParams: { id: 'client-to-delete' } })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 when subscription_purchases delete fails', async () => {
    // First call (subscription_purchases) fails
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++
      if (table === 'subscription_purchases') {
        return createMockQueryBuilder(null, { message: 'Delete failed' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('DELETE', { searchParams: { id: 'client-1' } })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when clients delete fails', async () => {
    // subscription_purchases succeeds but clients delete fails
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++
      if (table === 'subscription_purchases') {
        return createMockQueryBuilder(null, null)
      }
      if (table === 'clients') {
        return createMockQueryBuilder(null, { message: 'Delete client failed' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('DELETE', { searchParams: { id: 'client-1' } })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
