import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks -- required because the route module calls
// createServiceSupabase() at module-level (top-level const).
// vi.hoisted() ensures variables exist before vi.mock() factories execute.
// ---------------------------------------------------------------------------
const {
  mockSingle,
  mockMaybeSingle,
  mockOrder,
  mockEq,
  mockSelect,
  mockUpsert,
  mockFrom,
  mockSupabase,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockUpsert = vi.fn()
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return {
    mockSingle,
    mockMaybeSingle,
    mockOrder,
    mockEq,
    mockSelect,
    mockUpsert,
    mockFrom,
    mockSupabase,
  }
})

function resetChainMocks() {
  mockSingle.mockReturnValue({ data: null, error: null })
  mockMaybeSingle.mockReturnValue({ data: null, error: null })
  mockOrder.mockReturnValue({ data: [], error: null })
  mockEq.mockImplementation(() => ({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    eq: mockEq,
  }))
  mockSelect.mockImplementation(() => ({
    eq: mockEq,
    single: mockSingle,
  }))
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    upsert: mockUpsert,
  }))
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  sanitizeTextField: vi.fn((input: string | null | undefined) => {
    if (!input || typeof input !== 'string') return null
    return input.trim().slice(0, 500)
  }),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29 }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

// Import route handlers AFTER mocks are set up
import { GET, POST } from '@/app/api/daily-wellness/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/daily-wellness'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// GET /api/daily-wellness
// ---------------------------------------------------------------------------
describe('GET /api/daily-wellness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  it('returns 400 if clientId is missing', async () => {
    const req = buildGetRequest('http://localhost/api/daily-wellness?date=2026-03-12')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/缺少/)
  })

  it('returns 400 if date is missing', async () => {
    const req = buildGetRequest('http://localhost/api/daily-wellness?clientId=abc123')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/缺少/)
  })

  it('returns 404 if client is not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } })

    const req = buildGetRequest('http://localhost/api/daily-wellness?clientId=abc123&date=2026-03-12')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toMatch(/找不到/)
  })

  it('returns empty wellness data when not recorded yet', async () => {
    // First call: client lookup
    mockSingle
      .mockReturnValueOnce({ data: { id: 'uuid-1' }, error: null })
    // Second call: wellness lookup (maybeSingle)
    mockMaybeSingle.mockReturnValue({ data: null, error: null })

    const req = buildGetRequest('http://localhost/api/daily-wellness?clientId=abc123&date=2026-03-12')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBeNull()
    expect(json.data.energy_level).toBeNull()
    expect(json.data.mood).toBeNull()
    expect(json.message).toMatch(/尚未記錄/)
  })

  it('returns existing wellness data', async () => {
    const wellnessData = {
      client_id: 'uuid-1',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      note: 'Feeling great',
    }

    mockSingle.mockReturnValueOnce({ data: { id: 'uuid-1' }, error: null })
    mockMaybeSingle.mockReturnValue({ data: wellnessData, error: null })

    const req = buildGetRequest('http://localhost/api/daily-wellness?clientId=abc123&date=2026-03-12')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBe(4)
    expect(json.data.energy_level).toBe(3)
    expect(json.data.mood).toBe(5)
  })

  it('returns 500 on wellness query error', async () => {
    mockSingle.mockReturnValueOnce({ data: { id: 'uuid-1' }, error: null })
    mockMaybeSingle.mockReturnValue({ data: null, error: { message: 'DB error' } })

    const req = buildGetRequest('http://localhost/api/daily-wellness?clientId=abc123&date=2026-03-12')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/查詢/)
  })
})

// ---------------------------------------------------------------------------
// POST /api/daily-wellness
// ---------------------------------------------------------------------------
describe('POST /api/daily-wellness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  it('returns 400 if clientId is missing', async () => {
    const req = buildPostRequest({ date: '2026-03-12', sleep_quality: 4 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/缺少/)
  })

  it('returns 400 if date is missing', async () => {
    const req = buildPostRequest({ clientId: 'abc123', sleep_quality: 4 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/缺少/)
  })

  // ---- Score validation ----
  it('returns 400 for invalid sleep_quality score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', sleep_quality: 6 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/睡眠品質/)
  })

  it('returns 400 for invalid energy_level score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', energy_level: 0 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/能量水平/)
  })

  it('returns 400 for invalid mood score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', mood: -1 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/心情/)
  })

  it('returns 400 for invalid training_drive score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', training_drive: 6 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/訓練慾望/)
  })

  it('returns 400 for invalid resting_hr', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', resting_hr: 200 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/靜息心率/)
  })

  it('returns 400 for invalid hrv', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', hrv: 400 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/HRV/)
  })

  it('returns 400 for invalid wearable_sleep_score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', wearable_sleep_score: 120 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/睡眠分數/)
  })

  it('returns 400 for invalid device_recovery_score', async () => {
    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', device_recovery_score: -5 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/裝置恢復分數/)
  })

  // ---- Client lookup ----
  it('returns 404 if client is not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } })

    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', sleep_quality: 4, energy_level: 3, mood: 4 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toMatch(/找不到/)
  })

  it('returns 403 if client is inactive', async () => {
    mockSingle.mockReturnValueOnce({
      data: { id: 'uuid-1', is_active: false, expires_at: null },
      error: null,
    })

    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', sleep_quality: 4, energy_level: 3, mood: 4 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/暫停/)
  })

  it('returns 403 if client account is expired', async () => {
    mockSingle.mockReturnValueOnce({
      data: { id: 'uuid-1', is_active: true, expires_at: '2020-01-01T00:00:00Z' },
      error: null,
    })

    const req = buildPostRequest({ clientId: 'abc123', date: '2026-03-12', sleep_quality: 4, energy_level: 3, mood: 4 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/過期/)
  })

  // ---- Successful upsert ----
  it('successfully creates a wellness record', async () => {
    const createdData = {
      client_id: 'uuid-1',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      note: null,
    }

    // Client lookup
    mockSingle
      .mockReturnValueOnce({
        data: { id: 'uuid-1', is_active: true, expires_at: null },
        error: null,
      })
      // Upsert returns created data
      .mockReturnValueOnce({ data: createdData, error: null })

    const req = buildPostRequest({
      clientId: 'abc123',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBe(4)
    expect(json.message).toMatch(/已記錄/)
  })

  // ---- Upsert failure ----
  it('returns 500 if upsert fails', async () => {
    mockSingle
      .mockReturnValueOnce({
        data: { id: 'uuid-1', is_active: true, expires_at: null },
        error: null,
      })
      .mockReturnValueOnce({ data: null, error: { message: 'upsert failed' } })

    const req = buildPostRequest({
      clientId: 'abc123',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/失敗/)
  })

  // ---- Rate limiting ----
  it('returns 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/auth-middleware')
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const req = buildPostRequest({
      clientId: 'abc123',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toMatch(/頻繁/)
  })

  // ---- Accepts valid wearable data ----
  it('accepts valid wearable device data', async () => {
    const createdData = {
      client_id: 'uuid-1',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 4,
      resting_hr: 55,
      hrv: 45,
      wearable_sleep_score: 85,
      device_recovery_score: 78,
    }

    mockSingle
      .mockReturnValueOnce({
        data: { id: 'uuid-1', is_active: true, expires_at: null },
        error: null,
      })
      .mockReturnValueOnce({ data: createdData, error: null })

    const req = buildPostRequest({
      clientId: 'abc123',
      date: '2026-03-12',
      sleep_quality: 4,
      energy_level: 3,
      mood: 4,
      resting_hr: 55,
      hrv: 45,
      wearable_sleep_score: 85,
      device_recovery_score: 78,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  // ---- Allows null optional fields ----
  it('allows submission with only required fields', async () => {
    mockSingle
      .mockReturnValueOnce({
        data: { id: 'uuid-1', is_active: true, expires_at: null },
        error: null,
      })
      .mockReturnValueOnce({
        data: { client_id: 'uuid-1', date: '2026-03-12', sleep_quality: null, energy_level: null, mood: null },
        error: null,
      })

    const req = buildPostRequest({
      clientId: 'abc123',
      date: '2026-03-12',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
