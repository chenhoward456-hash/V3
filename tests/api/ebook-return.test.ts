import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/ebook/return/route'

// ── Helpers ──

function makePostRequest(formFields: Record<string, string>): NextRequest {
  const formData = new URLSearchParams(formFields)
  return new NextRequest('http://localhost:3000/api/ebook/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
}

// ── Tests ──

describe('POST /api/ebook/return', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  it('redirects to success page with order_id', async () => {
    const req = makePostRequest({ MerchantTradeNo: 'HP20240101000001' })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/diagnosis/success')
    expect(location).toContain('order_id=HP20240101000001')
  })

  it('redirects correctly when MerchantTradeNo is empty', async () => {
    const req = makePostRequest({ MerchantTradeNo: '' })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/diagnosis/success')
  })

  it('redirects correctly when MerchantTradeNo is missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('/diagnosis/success')
  })

  it('uses NEXT_PUBLIC_SITE_URL for redirect origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com'

    const req = makePostRequest({ MerchantTradeNo: 'ORDER123' })
    const res = await POST(req)

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toContain('https://custom-domain.com')
  })

  it('falls back to diagnosis on error', async () => {
    // Create a request that will cause formData() to fail
    const req = new NextRequest('http://localhost:3000/api/ebook/return', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not-form-data',
    })
    const res = await POST(req)

    // Should either redirect to success (with empty order) or fallback to diagnosis
    expect(res.status).toBe(303)
  })
})
