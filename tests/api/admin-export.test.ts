import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
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
    from: vi.fn((_table: string) => {
      return createMockQueryBuilder(null, null)
    }),
  }

  return { mockSupabase, createMockQueryBuilder }
})

const mockVerifyAdminSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

import { GET } from '@/app/api/admin/export/route'

// ── Helpers ──

function makeExportRequest(
  params: Record<string, string> = {},
  options: { withSession?: boolean } = {}
): NextRequest {
  const { withSession = true } = options
  const url = new URL('http://localhost:3000/api/admin/export')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const headers: Record<string, string> = {}
  if (withSession) {
    headers['Cookie'] = 'admin_session=valid-token-123'
  }
  return new NextRequest(url.toString(), { method: 'GET', headers })
}

// ── Tests ──

describe('GET /api/admin/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  // ── Auth ──

  it('returns 401 without admin session cookie', async () => {
    const req = makeExportRequest(
      { clientId: 'client-1', type: 'body' },
      { withSession: false }
    )
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when session token is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeExportRequest({ clientId: 'client-1', type: 'body' })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  // ── Validation ──

  it('returns 400 when clientId is missing', async () => {
    const req = makeExportRequest({ type: 'body' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(null, { message: 'No rows' })
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeExportRequest({ clientId: 'nonexistent', type: 'body' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  // ── CSV export by type ──

  describe('body_composition export', () => {
    it('returns CSV with body composition data', async () => {
      const bodyData = [
        { date: '2025-01-01', weight: 70, height: 175, body_fat: 15, muscle_mass: 55, waist: 80, hip: 90, note: null },
        { date: '2025-01-02', weight: 69.8, height: 175, body_fat: 14.8, muscle_mass: 55.2, waist: 79, hip: 90, note: 'Good day' },
      ]

      let clientCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          clientCallCount++
          return createMockQueryBuilder({ name: 'John', gender: 'M', age: 30 }, null)
        }
        if (table === 'body_composition') {
          return createMockQueryBuilder(bodyData, null)
        }
        return createMockQueryBuilder([], null)
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'body', days: '30' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/csv')
      expect(res.headers.get('Content-Disposition')).toContain('attachment')
      expect(res.headers.get('Content-Disposition')).toContain('body')

      // Check raw bytes for BOM (EF BB BF) which gets stripped by .text()
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      expect(bytes[0]).toBe(0xEF)
      expect(bytes[1]).toBe(0xBB)
      expect(bytes[2]).toBe(0xBF)

      const text = new TextDecoder('utf-8').decode(bytes)
      // Contains header row
      expect(text).toContain('(kg)')
      // Contains data
      expect(text).toContain('2025-01-01')
      expect(text).toContain('70')
      expect(text).toContain('Good day')
    })
  })

  describe('nutrition export', () => {
    it('returns CSV with nutrition data', async () => {
      const nutritionData = [
        { date: '2025-01-01', calories: 2000, protein_grams: 150, carbs_grams: 200, fat_grams: 70, compliant: true, note: null },
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Alice', gender: 'F', age: 25 }, null)
        }
        if (table === 'nutrition_logs') {
          return createMockQueryBuilder(nutritionData, null)
        }
        return createMockQueryBuilder([], null)
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'nutrition' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('2000')
      expect(text).toContain('150')
      // Compliant = true should show as Chinese character for yes
      expect(text).toContain('\u662f')  // '是'
    })
  })

  describe('training export', () => {
    it('returns CSV with training data and maps training types', async () => {
      const trainingData = [
        { date: '2025-01-01', training_type: 'push', rpe: 8, note: 'Heavy session' },
        { date: '2025-01-02', training_type: 'legs', rpe: 9, note: null },
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Bob', gender: 'M', age: 28 }, null)
        }
        if (table === 'training_logs') {
          return createMockQueryBuilder(trainingData, null)
        }
        return createMockQueryBuilder([], null)
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'training' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      // Training types mapped to Chinese
      expect(text).toContain('\u63a8')  // '推' for push
      expect(text).toContain('\u817f')  // '腿' for legs
      expect(text).toContain('Heavy session')
    })
  })

  describe('wellness export', () => {
    it('returns CSV with wellness data', async () => {
      const wellnessData = [
        {
          date: '2025-01-01', sleep_quality: 4, energy_level: 3, mood: 4,
          training_drive: 3, stress_level: 2, cognitive_clarity: 4,
          period_start: false, note: 'Feeling good',
          device_recovery_score: 85, resting_hr: 60, hrv: 45,
          wearable_sleep_score: 80, respiratory_rate: 15,
        },
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Carol', gender: 'F', age: 30 }, null)
        }
        if (table === 'daily_wellness') {
          return createMockQueryBuilder(wellnessData, null)
        }
        return createMockQueryBuilder([], null)
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'wellness' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('Feeling good')
      expect(text).toContain('85')  // recovery score
      expect(text).toContain('60')  // resting hr
    })
  })

  // ── Days parameter handling ──

  describe('days parameter', () => {
    it('defaults to 90 days when days param is not provided', async () => {
      const gteSpy = vi.fn().mockReturnThis()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
        }
        const builder = createMockQueryBuilder([], null)
        builder.gte = gteSpy
        return builder
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'body' })
      await GET(req)

      // The gte call uses a date string; 90 days ago from today
      expect(gteSpy).toHaveBeenCalled()
      const dateArg = gteSpy.mock.calls[0][1]
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 90)
      const expectedStr = expectedDate.toISOString().split('T')[0]
      expect(dateArg).toBe(expectedStr)
    })

    it('falls back to 90 days when days param is NaN', async () => {
      const gteSpy = vi.fn().mockReturnThis()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
        }
        const builder = createMockQueryBuilder([], null)
        builder.gte = gteSpy
        return builder
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'body', days: 'abc' })
      await GET(req)

      expect(gteSpy).toHaveBeenCalled()
      const dateArg = gteSpy.mock.calls[0][1]
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 90)
      const expectedStr = expectedDate.toISOString().split('T')[0]
      expect(dateArg).toBe(expectedStr)
    })

    it('clamps days to minimum of 7', async () => {
      const gteSpy = vi.fn().mockReturnThis()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
        }
        const builder = createMockQueryBuilder([], null)
        builder.gte = gteSpy
        return builder
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'body', days: '1' })
      await GET(req)

      expect(gteSpy).toHaveBeenCalled()
      const dateArg = gteSpy.mock.calls[0][1]
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 7)
      const expectedStr = expectedDate.toISOString().split('T')[0]
      expect(dateArg).toBe(expectedStr)
    })

    it('clamps days to maximum of 365', async () => {
      const gteSpy = vi.fn().mockReturnThis()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
        }
        const builder = createMockQueryBuilder([], null)
        builder.gte = gteSpy
        return builder
      })

      const req = makeExportRequest({ clientId: 'client-1', type: 'body', days: '999' })
      await GET(req)

      expect(gteSpy).toHaveBeenCalled()
      const dateArg = gteSpy.mock.calls[0][1]
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 365)
      const expectedStr = expectedDate.toISOString().split('T')[0]
      expect(dateArg).toBe(expectedStr)
    })
  })

  // ── Filename sanitization ──

  it('sanitizes client name in filename', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        // Name with special characters that should be replaced with _
        return createMockQueryBuilder({ name: 'John/Doe@Test', gender: 'M', age: 25 }, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeExportRequest({ clientId: 'client-1', type: 'body' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') || ''
    // Special chars / and @ should be replaced with _
    expect(disposition).not.toContain('/')
    // The encoded filename should not have raw special chars
    const decodedDisposition = decodeURIComponent(disposition)
    expect(decodedDisposition).toContain('John_Doe_Test')
  })

  it('uses "client" as fallback name when client name is null', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder({ name: null, gender: 'M', age: 25 }, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeExportRequest({ clientId: 'client-1', type: 'body' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') || ''
    const decodedDisposition = decodeURIComponent(disposition)
    expect(decodedDisposition).toContain('client_body_')
  })

  // ── Type defaults to 'all' ──

  it('defaults type to all when not specified', async () => {
    const queriedTables: string[] = []
    mockSupabase.from.mockImplementation((table: string) => {
      queriedTables.push(table)
      if (table === 'clients') {
        return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeExportRequest({ clientId: 'client-1' })
    await GET(req)

    // When type is 'all', all four data tables should be queried
    expect(queriedTables).toContain('body_composition')
    expect(queriedTables).toContain('nutrition_logs')
    expect(queriedTables).toContain('training_logs')
    expect(queriedTables).toContain('daily_wellness')
  })

  // ── CSV content with BOM ──

  it('includes BOM at start of CSV for Excel compatibility', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder({ name: 'Test', gender: 'M', age: 25 }, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeExportRequest({ clientId: 'client-1', type: 'body' })
    const res = await GET(req)

    // Check raw bytes for BOM (EF BB BF) which gets stripped by .text()
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    expect(bytes[0]).toBe(0xEF)
    expect(bytes[1]).toBe(0xBB)
    expect(bytes[2]).toBe(0xBF)
  })
})
