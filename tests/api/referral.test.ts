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

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { GET, POST } from '@/app/api/referral/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/referral')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function makePostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

// Restore the default from() implementation after clearAllMocks wipes it
function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

describe('GET /api/referral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset table calls
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
  })

  it('returns existing referral code for client', async () => {
    // The route calls from('clients') first, then from('referral_codes'), then from('referrals').
    // Because our mock returns the same result for each table name, we set them up per table.
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', created_at: '2024-01-01' },
      error: null,
    }
    mockTableCalls['referral_codes'] = {
      data: { code: 'ABC123-R4K2', client_id: 'client-uuid-1', total_referrals: 3, reward_value: 7 },
      error: null,
    }
    mockTableCalls['referrals'] = {
      data: [{ id: 'ref-1' }, { id: 'ref-2' }],
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.code).toBe('ABC123-R4K2')
    expect(json.totalReferrals).toBe(3)
    // 2 completed referrals * 7 reward_value = 14
    expect(json.rewardDays).toBe(14)
  })

  it('creates new referral code if none exists', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-2', unique_code: 'XYZ789', created_at: '2024-01-01' },
      error: null,
    }
    // First call to referral_codes returns null (no existing code)
    // Then the insert call also goes to referral_codes, so we need to handle this.
    // Since our mock always returns the same result per table, after the first .single() returns null,
    // the insert will also use the same mockTableCalls['referral_codes'].
    // We set it to return null initially. The route checks `if (existingCode)` which is falsy.
    // Then it inserts, and we need the insert to return the new code.
    // Since both read and write go to the same mock, we rely on the fact that
    // the first call (select + single) checks the result, and for the insert path
    // we need to set up the data that the insert returns.
    // The simplest approach: set referral_codes to null initially so existingCode is null,
    // then set it to the new code data. But since all calls are sequential and share the same
    // mock table data, we use a trick: set data to the new code.
    // Actually, re-reading the route: `if (existingCode)` checks the data from the first query.
    // When data is null, it goes to the insert path. The insert also reads from mockTableCalls['referral_codes'].
    // So we need the first call to return null and the second to return the new code.
    // We can achieve this by making mockSupabase.from return different results per call.
    // Instead of that complexity, let's just set data to null - the route will try to insert
    // and the insert will also resolve with {data: null, error: null}.
    // But then `newCode` will be null and it will return 500.
    // We need to handle sequential calls. Let's override from for this test.

    let referralCodeCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'referral_codes') {
        referralCodeCallCount++
        if (referralCodeCallCount === 1) {
          // First call: select existing - return null (no existing code)
          return createMockQueryBuilder(null, null)
        } else {
          // Second call: insert - return new code
          return createMockQueryBuilder(
            { code: 'XYZ789-A1B2', client_id: 'client-uuid-2', total_referrals: 0 },
            null
          )
        }
      }
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    const req = makeGetRequest({ clientId: 'XYZ789' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.code).toBe('XYZ789-A1B2')
    expect(json.totalReferrals).toBe(0)
    expect(json.rewardDays).toBe(0)
  })

  it('returns 400 if missing clientId', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Missing clientId parameter')
  })

  it('returns 404 if client not found', async () => {
    mockTableCalls['clients'] = {
      data: null,
      error: { message: 'No rows found' },
    }

    const req = makeGetRequest({ clientId: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Client not found')
  })
})

describe('POST /api/referral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
  })

  it('applies referral code successfully', async () => {
    let referralCodesCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'referral_codes') {
        referralCodesCallCount++
        if (referralCodesCallCount === 1) {
          // First call: validate the referral code
          return createMockQueryBuilder(
            { id: 'code-1', code: 'ABC123-R4K2', client_id: 'referrer-uuid', total_referrals: 2 },
            null
          )
        } else {
          // Second call: update total_referrals
          return createMockQueryBuilder(null, null)
        }
      }
      if (table === 'referrals') {
        // First call: check existing referral (should be null)
        // Second call: insert new referral
        return createMockQueryBuilder(null, null)
      }
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    const req = makePostRequest({
      referralCode: 'ABC123-R4K2',
      refereeClientId: 'referee-uuid',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns error for invalid referral code', async () => {
    mockTableCalls['referral_codes'] = {
      data: null,
      error: { message: 'No rows found' },
    }

    const req = makePostRequest({
      referralCode: 'INVALID-CODE',
      refereeClientId: 'referee-uuid',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Invalid referral code')
  })

  it('returns error if referee already referred', async () => {
    let referralsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'referral_codes') {
        return createMockQueryBuilder(
          { id: 'code-1', code: 'ABC123-R4K2', client_id: 'referrer-uuid', total_referrals: 1 },
          null
        )
      }
      if (table === 'referrals') {
        referralsCallCount++
        if (referralsCallCount === 1) {
          // Check existing referral - return existing (already referred)
          return createMockQueryBuilder({ id: 'existing-referral' }, null)
        }
        return createMockQueryBuilder(null, null)
      }
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    const req = makePostRequest({
      referralCode: 'ABC123-R4K2',
      refereeClientId: 'referee-uuid',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('This user has already been referred')
  })

  it('returns error for self-referral', async () => {
    mockTableCalls['referral_codes'] = {
      data: { id: 'code-1', code: 'ABC123-R4K2', client_id: 'same-uuid', total_referrals: 0 },
      error: null,
    }

    const req = makePostRequest({
      referralCode: 'ABC123-R4K2',
      refereeClientId: 'same-uuid',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Cannot refer yourself')
  })

  it('returns 400 if missing required fields', async () => {
    const req1 = makePostRequest({ referralCode: 'ABC123-R4K2' })
    const res1 = await POST(req1)
    const json1 = await res1.json()

    expect(res1.status).toBe(400)
    expect(json1.error).toBe('Missing referralCode or refereeClientId')

    const req2 = makePostRequest({ refereeClientId: 'referee-uuid' })
    const res2 = await POST(req2)
    const json2 = await res2.json()

    expect(res2.status).toBe(400)
    expect(json2.error).toBe('Missing referralCode or refereeClientId')
  })

  it('returns 400 if body is empty', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Missing referralCode or refereeClientId')
  })
})
