import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/manifest/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/manifest')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

// ── Tests ──

describe('GET /api/manifest', () => {
  it('returns valid PWA manifest JSON for a valid clientId', async () => {
    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/manifest+json')
    expect(json.name).toBe('Howard Protocol 健康管理')
    expect(json.short_name).toBe('Howard')
    expect(json.display).toBe('standalone')
    expect(json.start_url).toBe('/c/ABC123')
    expect(json.icons).toHaveLength(3)
  })

  it('includes correct icon entries', async () => {
    const req = makeGetRequest({ clientId: 'test-user' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
        expect.objectContaining({ sizes: 'any', type: 'image/svg+xml' }),
      ])
    )
  })

  it('sets Cache-Control header', async () => {
    const req = makeGetRequest({ clientId: 'user1' })
    const res = await GET(req)

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid clientId')
  })

  it('returns 400 for invalid clientId format', async () => {
    const req = makeGetRequest({ clientId: '<script>alert(1)</script>' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid clientId')
  })

  it('returns 400 for overly long clientId', async () => {
    const req = makeGetRequest({ clientId: 'a'.repeat(21) })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid clientId')
  })

  it('accepts clientId with hyphens and underscores', async () => {
    const req = makeGetRequest({ clientId: 'user-1_test' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.start_url).toBe('/c/user-1_test')
  })
})
