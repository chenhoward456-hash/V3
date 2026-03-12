import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

// ── Module mocks ──

vi.mock('@/lib/auth-middleware', () => ({
  verifyCoachAuth: mockVerifyCoachAuth,
}))

import { POST } from '@/app/api/sync-data/route'

// ── Helpers ──

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/sync-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('POST /api/sync-data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
  })

  it('returns 403 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: 'Not a coach' })

    const req = makePostRequest({
      source: 'google-sheets',
      data: [['id1', 'Metric A', '10', '20', 'kg', 'description']],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 for invalid source', async () => {
    const req = makePostRequest({
      source: 'unknown-source',
      data: [['id1', 'Metric A', '10', '20', 'kg', 'desc']],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Invalid source')
  })

  it('syncs data successfully with google-sheets source', async () => {
    const req = makePostRequest({
      source: 'google-sheets',
      data: [
        ['id1', 'Body Weight', '75.5', '70', 'kg', 'Current weight'],
        ['id2', 'Body Fat', '15', '10', '%', 'Body fat percentage'],
      ],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.metrics).toHaveLength(2)
    expect(json.metrics[0]).toEqual({
      id: 'id1',
      name: 'Body Weight',
      current: 75.5,
      target: 70,
      unit: 'kg',
      description: 'Current weight',
    })
    expect(json.metrics[1]).toEqual({
      id: 'id2',
      name: 'Body Fat',
      current: 15,
      target: 10,
      unit: '%',
      description: 'Body fat percentage',
    })
    expect(json.timestamp).toBeDefined()
  })

  it('syncs data successfully with manual source', async () => {
    const req = makePostRequest({
      source: 'manual',
      data: [['id1', 'Metric', '5', '10', 'unit', 'desc']],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.metrics).toHaveLength(1)
  })

  it('handles rows with missing fields gracefully', async () => {
    const req = makePostRequest({
      source: 'google-sheets',
      data: [
        ['id1'],
        [],
      ],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.metrics).toHaveLength(2)
    // Missing fields default to empty string or 0
    expect(json.metrics[0].id).toBe('id1')
    expect(json.metrics[0].name).toBe('')
    expect(json.metrics[0].current).toBe(0)
    expect(json.metrics[1].id).toBe('')
  })

  it('parses numeric strings to numbers, defaults NaN to 0', async () => {
    const req = makePostRequest({
      source: 'google-sheets',
      data: [
        ['id1', 'Metric', 'not-a-number', 'also-nan', 'kg', 'desc'],
      ],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.metrics[0].current).toBe(0)
    expect(json.metrics[0].target).toBe(0)
  })

  it('returns 500 on unexpected exception (malformed JSON body)', async () => {
    const req = new NextRequest('http://localhost:3000/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to sync data')
  })

  it('handles empty data array', async () => {
    const req = makePostRequest({
      source: 'google-sheets',
      data: [],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.metrics).toHaveLength(0)
  })
})
