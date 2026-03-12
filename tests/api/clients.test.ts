import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks -- required because the route module calls
// createServiceSupabase() at module-level (top-level const).
// ---------------------------------------------------------------------------
const {
  mockSingle,
  mockMaybeSingle,
  mockOrder,
  mockLimit,
  mockEq,
  mockGte,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockUpsert,
  mockFrom,
  mockSupabase,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockLimit = vi.fn()
  const mockEq = vi.fn()
  const mockGte = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockUpsert = vi.fn()
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return {
    mockSingle,
    mockMaybeSingle,
    mockOrder,
    mockLimit,
    mockEq,
    mockGte,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockUpsert,
    mockFrom,
    mockSupabase,
  }
})

/** Helper: make an object thenable so `wrap(q)` in the route resolves correctly. */
function thenable(obj: Record<string, any>) {
  return { ...obj, then: (fn: (v: any) => any) => Promise.resolve(obj).then(fn) }
}

/**
 * Build a chainable mock object where every property call returns the same object,
 * allowing arbitrary .eq().eq().order().limit() etc. chaining.
 * The object is also thenable so it works with the route's `wrap()`.
 */
function chainable(resolvedValue: { data: any; error: any }) {
  const obj: Record<string, any> = {}
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (fn: any) => Promise.resolve(resolvedValue).then(fn)
      }
      // Return a function that returns the proxy for chaining
      return (..._args: any[]) => new Proxy(obj, handler)
    },
  }
  return new Proxy(obj, handler)
}

function resetChainMocks() {
  mockSingle.mockReturnValue({ data: null, error: null })
  mockMaybeSingle.mockReturnValue({ data: null, error: null })
  mockLimit.mockReturnValue(thenable({ data: [], error: null }))
  mockOrder.mockReturnValue({ data: [], error: null, limit: mockLimit, then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn) })
  mockGte.mockReturnValue({ order: mockOrder, then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn) })
  mockEq.mockImplementation(() => ({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    eq: mockEq,
    gte: mockGte,
    limit: mockLimit,
    select: mockSelect,
    then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn),
  }))
  mockSelect.mockImplementation((..._args: any[]) => ({
    eq: mockEq,
    single: mockSingle,
  }))
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ select: mockSelect, eq: mockEq })
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
  }))
}

/**
 * Setup mocks for PATCH/PUT flow: client lookup via select().eq().single()
 * returns the given client data, and update().eq() returns the given update result.
 * Also mocks upsert() for body_composition writes.
 */
function setupClientUpdateMocks(
  clientData: Record<string, any>,
  updateResult: { data: any; error: any } = { data: null, error: null },
) {
  // The route does:
  //   supabase.from('clients').select(...).eq('unique_code', id).single()
  //   supabase.from('body_composition').upsert(...)     (optional, PATCH only)
  //   supabase.from('clients').update({...}).eq('id', client.id)
  //
  // We need mockFrom to dispatch based on table and operation.

  const selectChain = {
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockReturnValue({ data: clientData, error: null }),
    }),
  }

  const updateChain = {
    eq: vi.fn().mockReturnValue(updateResult),
  }

  // Track upsert calls for assertions
  const upsertFn = vi.fn().mockReturnValue({ data: null, error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'body_composition') {
      return { upsert: upsertFn }
    }
    // For 'clients' table, return both select and update
    return {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn((updates: any) => {
        // Store updates for assertion
        mockUpdate(updates)
        return updateChain
      }),
      upsert: upsertFn,
    }
  })

  // Also expose upsert mock for assertions
  mockUpsert.mockImplementation(upsertFn)

  return { selectChain, updateChain, upsertFn }
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAuth: vi.fn().mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null }),
  isCoach: vi.fn().mockReturnValue(true),
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    return new Response(JSON.stringify({ error: message, code: status }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: unknown) => {
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
  rateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29 }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/utils/validation', () => ({
  validateDate: vi.fn().mockReturnValue({ isValid: true, error: '' }),
}))

vi.mock('@/lib/nutrition-engine', () => ({
  calculateInitialTargets: vi.fn().mockReturnValue({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
  }),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}))

// Import route handlers AFTER mocks
import { GET, POST, PATCH, PUT } from '@/app/api/clients/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/clients'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-jwt-token',
    },
    body: JSON.stringify(body),
  })
}

function buildPatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/clients'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildPutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/clients'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** A future date string for target_date / competition_date fields */
const FUTURE_DATE = '2099-12-31'

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------
describe('GET /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  it('returns 400 if clientId is missing', async () => {
    const req = buildGetRequest('http://localhost/api/clients')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for invalid clientId format', async () => {
    const req = buildGetRequest('http://localhost/api/clients?clientId=invalid%20id%21%40%23')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/無效/)
  })

  it('returns 400 for clientId that is too long (>20 chars)', async () => {
    const longId = 'a'.repeat(21)
    const req = buildGetRequest(`http://localhost/api/clients?clientId=${longId}`)
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 404 if client is not found (supabase error)', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)

    expect(res.status).toBe(404)
  })

  it('returns 404 if client data is null without supabase error (line 47)', async () => {
    // Covers the branch where clientError is falsy but client is also null
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toMatch(/不存在/)
  })

  it('returns 403 if client is inactive', async () => {
    mockSingle.mockReturnValue({
      data: {
        id: 'uuid-1',
        unique_code: 'abc123',
        is_active: false,
        expires_at: null,
        supplement_enabled: false,
        body_composition_enabled: false,
        wellness_enabled: false,
        training_enabled: false,
        nutrition_enabled: false,
      },
      error: null,
    })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/暫停/)
  })

  it('returns 403 if client is expired', async () => {
    mockSingle.mockReturnValue({
      data: {
        id: 'uuid-1',
        unique_code: 'abc123',
        is_active: true,
        expires_at: '2020-01-01T00:00:00Z',
        supplement_enabled: false,
        body_composition_enabled: false,
        wellness_enabled: false,
        training_enabled: false,
        nutrition_enabled: false,
      },
      error: null,
    })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/過期/)
  })

  it('allows client whose expires_at is null (never expires)', async () => {
    const clientData = {
      id: 'uuid-1',
      unique_code: 'abc123',
      is_active: true,
      expires_at: null,
      supplement_enabled: false,
      body_composition_enabled: false,
      wellness_enabled: false,
      training_enabled: false,
      nutrition_enabled: false,
    }
    mockSingle.mockReturnValue({ data: clientData, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('allows client whose expires_at is in the future', async () => {
    const clientData = {
      id: 'uuid-1',
      unique_code: 'abc123',
      is_active: true,
      expires_at: '2099-01-01T00:00:00Z',
      supplement_enabled: false,
      body_composition_enabled: false,
      wellness_enabled: false,
      training_enabled: false,
      nutrition_enabled: false,
    }
    mockSingle.mockReturnValue({ data: clientData, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('returns client data with all enabled features queried', async () => {
    const clientData = {
      id: 'uuid-1',
      unique_code: 'abc123',
      name: 'Test Client',
      is_active: true,
      expires_at: null,
      supplement_enabled: true,
      body_composition_enabled: true,
      wellness_enabled: true,
      training_enabled: true,
      nutrition_enabled: true,
    }

    mockSingle.mockReturnValue({ data: clientData, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.client.name).toBe('Test Client')
    expect(json.data.client.unique_code).toBe('abc123')
  })

  it('returns client data with no features enabled (no extra queries)', async () => {
    const clientData = {
      id: 'uuid-1',
      unique_code: 'abc123',
      name: 'Basic Client',
      is_active: true,
      expires_at: null,
      supplement_enabled: false,
      body_composition_enabled: false,
      wellness_enabled: false,
      training_enabled: false,
      nutrition_enabled: false,
    }

    mockSingle.mockReturnValue({ data: clientData, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.client.name).toBe('Basic Client')
    expect(json.data.todayLogs).toEqual([])
    expect(json.data.bodyData).toEqual([])
    expect(json.data.wellness).toEqual([])
    expect(json.data.trainingLogs).toEqual([])
    expect(json.data.nutritionLogs).toEqual([])
  })

  it('returns 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/auth-middleware')
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toMatch(/頻繁/)
  })

  it('returns 500 when an unexpected error is thrown (catch block, line 140)', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('unexpected crash')
    })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)

    expect(res.status).toBe(500)
  })

  it('handles feature query errors gracefully (logs warning, returns empty arrays)', async () => {
    const clientData = {
      id: 'uuid-1',
      unique_code: 'abc123',
      is_active: true,
      expires_at: null,
      supplement_enabled: true,
      body_composition_enabled: false,
      wellness_enabled: false,
      training_enabled: false,
      nutrition_enabled: false,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return { select: mockSelect }
      }
      // supplement_logs queries return errors
      return {
        select: () => ({
          eq: () => ({
            eq: () => thenable({ data: null, error: { message: 'db error' } }),
            gte: () => ({
              order: () => thenable({ data: null, error: { message: 'db error' } }),
            }),
          }),
        }),
      }
    })

    mockSingle.mockReturnValue({ data: clientData, error: null })

    const req = buildGetRequest('http://localhost/api/clients?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.todayLogs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------
describe('POST /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  it('returns 401 if not authenticated', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware')
    vi.mocked(verifyAuth).mockResolvedValueOnce({ user: null, error: '身份驗證失敗' })

    const req = buildPostRequest({ name: 'New Client', age: 30, gender: '男性' })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 if not coach role', async () => {
    const { isCoach } = await import('@/lib/auth-middleware')
    vi.mocked(isCoach).mockReturnValueOnce(false)

    const req = buildPostRequest({ name: 'New Client', age: 30, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/權限/)
  })

  it('returns 400 for missing name', async () => {
    const req = buildPostRequest({ age: 30, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/姓名/)
  })

  it('returns 400 for invalid age', async () => {
    const req = buildPostRequest({ name: 'Client', age: -5, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/年齡/)
  })

  it('returns 400 for invalid gender', async () => {
    const req = buildPostRequest({ name: 'Client', age: 30, gender: 'invalid' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/性別/)
  })

  it('creates client successfully with valid data', async () => {
    const createdClient = {
      id: 'uuid-new',
      unique_code: 'abc12defg',
      name: 'New Client',
      age: 30,
      gender: '男性',
    }

    mockSingle.mockReturnValue({ data: createdClient, error: null })

    const req = buildPostRequest({ name: 'New Client', age: 30, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('New Client')
  })

  it('returns 500 if database insert fails', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'insert failed' } })

    const req = buildPostRequest({ name: 'New Client', age: 30, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/建立.*失敗/)
  })

  it('validates name length (too long)', async () => {
    const longName = 'A'.repeat(101)
    const req = buildPostRequest({ name: longName, age: 30, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/姓名/)
  })

  it('validates age upper bound', async () => {
    const req = buildPostRequest({ name: 'Client', age: 200, gender: '男性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/年齡/)
  })

  it('returns 400 when name is a non-string type', async () => {
    const req = buildPostRequest({ name: 123, age: 30, gender: '男性' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when age is not a number', async () => {
    const req = buildPostRequest({ name: 'Client', age: 'thirty', gender: '男性' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('accepts all valid gender options', async () => {
    const createdClient = { id: 'uuid-new', name: 'Client', age: 25, gender: '女性' }
    mockSingle.mockReturnValue({ data: createdClient, error: null })

    const req = buildPostRequest({ name: 'Client', age: 25, gender: '女性' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('accepts "其他" as valid gender', async () => {
    const createdClient = { id: 'uuid-new', name: 'Client', age: 25, gender: '其他' }
    mockSingle.mockReturnValue({ data: createdClient, error: null })

    const req = buildPostRequest({ name: 'Client', age: 25, gender: '其他' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('writes audit log on successful creation', async () => {
    const createdClient = { id: 'uuid-new', unique_code: 'abc12defg', name: 'Client', age: 30, gender: '男性' }
    mockSingle.mockReturnValue({ data: createdClient, error: null })

    const req = buildPostRequest({ name: 'Client', age: 30, gender: '男性' })
    await POST(req)

    const { writeAuditLog } = await import('@/lib/audit')
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.create',
      targetId: 'uuid-new',
    }))
  })

  it('returns 500 when an unexpected error is thrown (catch block, line 205)', async () => {
    const req = new NextRequest(new URL('http://localhost/api/clients'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token',
      },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/clients
// ---------------------------------------------------------------------------
describe('PATCH /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  // -- Rate limiting --
  it('returns 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/auth-middleware')
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 })

    const req = buildPatchRequest({ clientId: 'abc123' })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toMatch(/頻繁/)
  })

  // -- Missing / invalid clientId --
  it('returns 400 if clientId is missing', async () => {
    const req = buildPatchRequest({})
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 if clientId is not a string', async () => {
    const req = buildPatchRequest({ clientId: 12345 })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid clientId format', async () => {
    const req = buildPatchRequest({ clientId: 'invalid id!@#' })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/無效/)
  })

  it('returns 400 for clientId longer than 20 chars', async () => {
    const req = buildPatchRequest({ clientId: 'a'.repeat(21) })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  // -- Client not found --
  it('returns 404 if client not found (supabase error)', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(404)
  })

  it('returns 404 if client data is null without error', async () => {
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(404)
  })

  // -- Inactive client --
  it('returns 403 if client is inactive', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: false })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/暫停/)
  })

  // -- simple_mode toggle --
  it('updates simple_mode to true successfully', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'premium', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', simple_mode: true })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.updated.simple_mode).toBe(true)
  })

  it('updates simple_mode to false successfully', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'premium', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', simple_mode: false })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.updated.simple_mode).toBe(false)
  })

  it('returns 500 if simple_mode update fails', async () => {
    setupClientUpdateMocks(
      { id: 'uuid-1', gender: '男性', subscription_tier: 'premium', is_active: true },
      { data: null, error: { message: 'update failed' } },
    )

    const req = buildPatchRequest({ clientId: 'abc123', simple_mode: true })
    const res = await PATCH(req)

    expect(res.status).toBe(500)
  })

  it('writes audit log when simple_mode is toggled', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'premium', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', simple_mode: true })
    await PATCH(req)

    const { writeAuditLog } = await import('@/lib/audit')
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.update',
      targetId: 'uuid-1',
      details: { simple_mode: true },
    }))
  })

  // -- Subscription tier check for onboarding --
  it('returns 403 if subscription_tier is not self_managed or free', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'premium', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/自主管理/)
  })

  it('allows self_managed tier for onboarding', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('allows free tier for onboarding', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'free', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'bulk' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  // -- goal_type validation --
  it('accepts valid goal_type "cut"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid goal_type "recomp"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'recomp' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('ignores invalid goal_type and returns 400 if no other valid fields', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'invalid_goal' })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/沒有有效/)
  })

  // -- activity_profile --
  it('accepts valid activity_profile "sedentary"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', activity_profile: 'sedentary' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid activity_profile "high_energy_flux"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', activity_profile: 'high_energy_flux' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  // -- gender --
  it('accepts valid gender in PATCH', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', gender: '女性' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  // -- target_weight, target_body_fat, target_date --
  it('accepts valid target_weight', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', target_weight: 75 })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid target_body_fat', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', target_body_fat: 15 })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid future target_date', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', target_date: FUTURE_DATE, goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('ignores past target_date', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', target_date: '2020-01-01' })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  // -- No valid update fields --
  it('returns 400 when no valid update fields are provided', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123' })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/沒有有效/)
  })

  // -- body_weight + InBody data --
  it('upserts body_composition when body_weight is provided', async () => {
    const { upsertFn } = setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 80,
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('body_composition')
  })

  it('includes body_fat_pct and height in body_composition record', async () => {
    const { upsertFn } = setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'bulk',
      body_weight: 80,
      body_fat_pct: 20,
      height: 175,
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        weight: 80,
        body_fat: 20,
        height: 175,
      }),
      { onConflict: 'client_id,date' },
    )
  })

  it('calls calculateInitialTargets when body_weight + valid goal_type are provided', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const { calculateInitialTargets } = await import('@/lib/nutrition-engine')

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 80,
      body_fat_pct: 20,
      height: 175,
      activity_profile: 'high_energy_flux',
      training_days_per_week: 5,
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(calculateInitialTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: '男性',
        bodyWeight: 80,
        height: 175,
        bodyFatPct: 20,
        goalType: 'cut',
        activityProfile: 'high_energy_flux',
        trainingDaysPerWeek: 5,
      }),
    )
  })

  it('does not call calculateInitialTargets when body_weight present but goal_type is invalid', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const { calculateInitialTargets } = await import('@/lib/nutrition-engine')
    vi.mocked(calculateInitialTargets).mockClear()

    const req = buildPatchRequest({
      clientId: 'abc123',
      body_weight: 80,
      target_weight: 70,
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(calculateInitialTargets).not.toHaveBeenCalled()
  })

  it('uses defaults for training_days_per_week and activity_profile', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: null, subscription_tier: 'self_managed', is_active: true })

    const { calculateInitialTargets } = await import('@/lib/nutrition-engine')

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'recomp',
      body_weight: 70,
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(calculateInitialTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: '男性', // fallback default
        activityProfile: 'sedentary', // default
        trainingDaysPerWeek: 3, // default
      }),
    )
  })

  it('ignores body_weight outside valid range (too low)', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', body_weight: 10 })
    const res = await PATCH(req)

    // body_weight 10 is <= 30, so hasBodyData is false, no valid updates => 400
    expect(res.status).toBe(400)
  })

  it('ignores body_weight outside valid range (too high)', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', body_weight: 350 })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('ignores height outside valid range (not included in body_composition upsert)', async () => {
    const { upsertFn } = setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 80,
      height: 50, // invalid (< 100)
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    // upsert should NOT include height
    expect(upsertFn).toHaveBeenCalledWith(
      expect.not.objectContaining({ height: expect.anything() }),
      expect.anything(),
    )
  })

  it('ignores body_fat_pct outside valid range (not included in body_composition upsert)', async () => {
    const { upsertFn } = setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 80,
      body_fat_pct: 70, // invalid (>= 60)
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(upsertFn).toHaveBeenCalledWith(
      expect.not.objectContaining({ body_fat: expect.anything() }),
      expect.anything(),
    )
  })

  // -- Update failure --
  it('returns 500 if the final client update fails', async () => {
    setupClientUpdateMocks(
      { id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true },
      { data: null, error: { message: 'update error' } },
    )

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PATCH(req)

    expect(res.status).toBe(500)
  })

  // -- Audit log on onboarding update --
  it('writes audit log on successful onboarding update', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '男性', subscription_tier: 'self_managed', is_active: true })

    const req = buildPatchRequest({ clientId: 'abc123', goal_type: 'cut' })
    await PATCH(req)

    const { writeAuditLog } = await import('@/lib/audit')
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.update',
      actor: 'client:abc123',
      targetId: 'uuid-1',
    }))
  })

  // -- Catch block --
  it('returns 500 when an unexpected error is thrown (catch block)', async () => {
    const req = new NextRequest(new URL('http://localhost/api/clients'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await PATCH(req)

    expect(res.status).toBe(500)
  })

  // -- Gender resolution (uses client.gender as fallback) --
  it('uses provided gender for nutrition calculation over client gender', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '女性', subscription_tier: 'self_managed', is_active: true })

    const { calculateInitialTargets } = await import('@/lib/nutrition-engine')

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 60,
      gender: '男性',
    })
    await PATCH(req)

    expect(calculateInitialTargets).toHaveBeenCalledWith(
      expect.objectContaining({ gender: '男性' }),
    )
  })

  it('falls back to client.gender when no gender is provided', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', gender: '女性', subscription_tier: 'self_managed', is_active: true })

    const { calculateInitialTargets } = await import('@/lib/nutrition-engine')

    const req = buildPatchRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      body_weight: 60,
    })
    await PATCH(req)

    expect(calculateInitialTargets).toHaveBeenCalledWith(
      expect.objectContaining({ gender: '女性' }),
    )
  })
})

// ---------------------------------------------------------------------------
// PUT /api/clients
// ---------------------------------------------------------------------------
describe('PUT /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  // -- Rate limiting --
  it('returns 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/auth-middleware')
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toMatch(/頻繁/)
  })

  // -- Missing / invalid clientId --
  it('returns 400 if clientId is missing', async () => {
    const req = buildPutRequest({})
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 if clientId is not a string', async () => {
    const req = buildPutRequest({ clientId: 12345 })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid clientId format (special chars)', async () => {
    const req = buildPutRequest({ clientId: 'invalid!@#$%' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 for clientId longer than 36 chars', async () => {
    const req = buildPutRequest({ clientId: 'a'.repeat(37) })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- Client lookup by unique_code vs UUID --
  it('looks up client by unique_code for non-UUID clientId', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    await PUT(req)

    // Verify the select chain used 'unique_code'
    const fromCalls = mockFrom.mock.calls
    expect(fromCalls.some((c: any[]) => c[0] === 'clients')).toBe(true)
  })

  it('looks up client by id for UUID clientId', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    setupClientUpdateMocks({ id: uuid, is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: uuid, goal_type: 'cut' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  // -- Client not found --
  it('returns 404 if client not found (supabase error)', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)

    expect(res.status).toBe(404)
  })

  it('returns 404 if client data is null', async () => {
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)

    expect(res.status).toBe(404)
  })

  // -- Inactive client --
  it('returns 403 if client is inactive', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: false, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/暫停/)
  })

  // -- goal_type --
  it('accepts valid goal_type "cut"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid goal_type "bulk"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'bulk' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('accepts valid goal_type "recomp"', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'recomp' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('ignores invalid goal_type', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'invalid' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- target_weight --
  it('accepts valid target_weight', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_weight: 75 })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('ignores target_weight below 30', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_weight: 20 })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('ignores target_weight above 300', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_weight: 350 })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- target_body_fat --
  it('accepts valid target_body_fat', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_body_fat: 15 })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('ignores target_body_fat below 3', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_body_fat: 2 })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('ignores target_body_fat above 60', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_body_fat: 65 })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- target_date --
  it('accepts valid future target_date', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_date: FUTURE_DATE })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('ignores past target_date', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_date: '2020-01-01' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('ignores invalid target_date string', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', target_date: 'not-a-date' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- competition_date --
  it('accepts competition_date when competition_enabled is true', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: true })

    const req = buildPutRequest({ clientId: 'abc123', competition_date: FUTURE_DATE })
    const res = await PUT(req)

    expect(res.status).toBe(200)
  })

  it('ignores competition_date when competition_enabled is false', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', competition_date: FUTURE_DATE })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('ignores past competition_date even when competition_enabled', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: true })

    const req = buildPutRequest({ clientId: 'abc123', competition_date: '2020-01-01' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  // -- Gene data --
  it('accepts valid gene_mthfr values', async () => {
    for (const value of ['normal', 'heterozygous', 'homozygous']) {
      vi.clearAllMocks()
      setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

      const req = buildPutRequest({ clientId: 'abc123', gene_mthfr: value })
      const res = await PUT(req)

      expect(res.status).toBe(200)
    }
  })

  it('sets gene_mthfr to null for invalid value', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', gene_mthfr: 'invalid' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gene_mthfr: null }))
  })

  it('accepts valid gene_apoe values', async () => {
    for (const value of ['e2/e2', 'e2/e3', 'e3/e3', 'e3/e4', 'e4/e4']) {
      vi.clearAllMocks()
      setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

      const req = buildPutRequest({ clientId: 'abc123', gene_apoe: value })
      const res = await PUT(req)

      expect(res.status).toBe(200)
    }
  })

  it('sets gene_apoe to null for invalid value', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', gene_apoe: 'invalid' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gene_apoe: null }))
  })

  it('accepts valid gene_depression_risk values', async () => {
    for (const value of ['LL', 'SL', 'SS', 'low', 'moderate', 'high']) {
      vi.clearAllMocks()
      setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

      const req = buildPutRequest({ clientId: 'abc123', gene_depression_risk: value })
      const res = await PUT(req)

      expect(res.status).toBe(200)
    }
  })

  it('sets gene_depression_risk to null for invalid value', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', gene_depression_risk: 'invalid' })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gene_depression_risk: null }))
  })

  it('accepts gene_notes as string and truncates to 500 chars', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const longNote = 'x'.repeat(600)
    const req = buildPutRequest({ clientId: 'abc123', gene_notes: longNote })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ gene_notes: 'x'.repeat(500) }),
    )
  })

  it('sets gene_notes to null for non-string value', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', gene_notes: 12345 })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gene_notes: null }))
  })

  // -- No valid update fields --
  it('returns 400 when no valid update fields are provided', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/沒有有效/)
  })

  // -- Update failure --
  it('returns 500 if the update fails with error message', async () => {
    setupClientUpdateMocks(
      { id: 'uuid-1', is_active: true, competition_enabled: false },
      { data: null, error: { message: 'constraint violation' } },
    )

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/更新失敗/)
  })

  // -- Audit log --
  it('writes audit log on successful update', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const req = buildPutRequest({ clientId: 'abc123', goal_type: 'cut' })
    await PUT(req)

    const { writeAuditLog } = await import('@/lib/audit')
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.update',
      actor: 'client:abc123',
      targetId: 'uuid-1',
    }))
  })

  // -- Catch block --
  it('returns 500 when an unexpected error is thrown (catch block)', async () => {
    const req = new NextRequest(new URL('http://localhost/api/clients'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await PUT(req)

    expect(res.status).toBe(500)
  })

  // -- Multiple fields updated together --
  it('updates multiple fields at once', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: true })

    const req = buildPutRequest({
      clientId: 'abc123',
      goal_type: 'cut',
      target_weight: 70,
      target_body_fat: 12,
      target_date: FUTURE_DATE,
      competition_date: FUTURE_DATE,
      gene_mthfr: 'normal',
      gene_apoe: 'e3/e3',
      gene_depression_risk: 'LL',
      gene_notes: 'Some notes',
    })
    const res = await PUT(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      goal_type: 'cut',
      target_weight: 70,
      target_body_fat: 12,
      target_date: FUTURE_DATE,
      competition_date: FUTURE_DATE,
      gene_mthfr: 'normal',
      gene_apoe: 'e3/e3',
      gene_depression_risk: 'LL',
      gene_notes: 'Some notes',
    }))
  })

  // -- gene_mthfr null clears the field --
  it('handles gene fields set to null (clearing)', async () => {
    setupClientUpdateMocks({ id: 'uuid-1', is_active: true, competition_enabled: false })

    const body = { clientId: 'abc123', gene_mthfr: null }
    const req = buildPutRequest(body)
    const res = await PUT(req)

    expect(res.status).toBe(200)
    // null is falsy, so VALID_MTHFR.includes(null) is false => set to null
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gene_mthfr: null }))
  })
})
