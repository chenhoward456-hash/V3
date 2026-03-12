import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
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

const { mockRateLimit, mockParseGarminCSV, mockParseAppleHealthCSV, mockParseWearableJSON } =
  vi.hoisted(() => {
    const mockRateLimit = vi.fn()
    const mockParseGarminCSV = vi.fn()
    const mockParseAppleHealthCSV = vi.fn()
    const mockParseWearableJSON = vi.fn()
    return { mockRateLimit, mockParseGarminCSV, mockParseAppleHealthCSV, mockParseWearableJSON }
  })

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/wearable-parser', () => ({
  parseGarminCSV: mockParseGarminCSV,
  parseAppleHealthCSV: mockParseAppleHealthCSV,
  parseWearableJSON: mockParseWearableJSON,
}))

import { POST } from '@/app/api/wearable-import/route'

// ── Helpers ──

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/wearable-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const sampleRows = [
  {
    date: '2024-03-01',
    device_recovery_score: 75,
    resting_hr: 58,
    hrv: 45,
    wearable_sleep_score: 82,
    respiratory_rate: 15,
  },
  {
    date: '2024-03-02',
    device_recovery_score: 80,
    resting_hr: 56,
    hrv: 50,
    wearable_sleep_score: 88,
    respiratory_rate: 14,
  },
]

// ── Tests ──

describe('POST /api/wearable-import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePostRequest({ format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when format is missing', async () => {
    const req = makePostRequest({ clientId: 'ABC123', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when data is missing', async () => {
    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for unsupported format', async () => {
    const req = makePostRequest({ clientId: 'ABC123', format: 'fitbit', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('不支援的格式')
  })

  it('returns 404 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'Not found' } }

    const req = makePostRequest({ clientId: 'NONEXISTENT', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is inactive', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'uuid-1', is_active: false, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is expired', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'uuid-1', is_active: true, expires_at: '2020-01-01T00:00:00Z' },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('parses Garmin CSV and imports successfully', async () => {
    mockParseGarminCSV.mockReturnValue(sampleRows)

    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        // First call: select existing records; Second call: upsert
        return createMockQueryBuilder([], null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'Date,Body Battery\n2024-03-01,75' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(2)
    expect(json.skipped).toBe(0)
    expect(json.total).toBe(2)
    expect(mockParseGarminCSV).toHaveBeenCalled()
  })

  it('parses Apple Health CSV and imports successfully', async () => {
    mockParseAppleHealthCSV.mockReturnValue([sampleRows[0]])

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        return createMockQueryBuilder([], null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'apple', data: 'Date,Resting Heart Rate\n2024-03-01,58' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(1)
    expect(mockParseAppleHealthCSV).toHaveBeenCalled()
  })

  it('parses JSON format and imports successfully', async () => {
    mockParseWearableJSON.mockReturnValue([sampleRows[0]])

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        return createMockQueryBuilder([], null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'json', data: '[{"date":"2024-03-01","resting_hr":58}]' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(1)
    expect(mockParseWearableJSON).toHaveBeenCalled()
  })

  it('returns 400 when parser throws an error (malformed CSV)', async () => {
    mockParseGarminCSV.mockImplementation(() => {
      throw new Error('Invalid CSV format - no date column')
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'bad,csv,data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('解析失敗')
    expect(json.detail).toBe('Invalid CSV format - no date column')
  })

  it('returns 400 when parser returns empty rows', async () => {
    mockParseGarminCSV.mockReturnValue([])

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'Date\n' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('沒有找到有效的穿戴裝置數據')
  })

  it('truncates data to 365 rows for large imports', async () => {
    // Generate 400 rows
    const largeData = Array.from({ length: 400 }, (_, i) => ({
      date: `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      device_recovery_score: 70 + (i % 30),
      resting_hr: 55 + (i % 10),
      hrv: 40 + (i % 20),
      wearable_sleep_score: 75 + (i % 25),
      respiratory_rate: 14 + (i % 4),
    }))
    mockParseGarminCSV.mockReturnValue(largeData)

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        return createMockQueryBuilder([], null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'large-csv' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // Should be truncated to 365
    expect(json.total).toBe(365)
    expect(json.imported).toBe(365)
  })

  it('preserves existing manual wellness data during upsert', async () => {
    mockParseGarminCSV.mockReturnValue([sampleRows[0]])

    const existingRecord = {
      date: '2024-03-01',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      training_drive: 4,
      cognitive_clarity: 3,
      stress_level: 2,
      period_start: false,
      note: 'Felt good',
    }

    let dailyWellnessCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        dailyWellnessCallCount++
        if (dailyWellnessCallCount === 1) {
          // Select existing records
          return createMockQueryBuilder([existingRecord], null)
        }
        // Upsert
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(1)
  })

  it('reports errors when upsert batch fails', async () => {
    mockParseGarminCSV.mockReturnValue(sampleRows)

    let dailyWellnessCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'daily_wellness') {
        dailyWellnessCallCount++
        if (dailyWellnessCallCount === 1) {
          // Select existing
          return createMockQueryBuilder([], null)
        }
        // Upsert fails
        return createMockQueryBuilder(null, { message: 'Constraint violation' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123', format: 'garmin', data: 'csv-data' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(0)
    expect(json.skipped).toBe(2)
    expect(json.errors).toBeDefined()
    expect(json.errors.length).toBeGreaterThan(0)
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/wearable-import', {
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
