import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

const { mockParseMetricsFromCSV, mockParseSupplementsFromCSV, mockParseProgressFromCSV } =
  vi.hoisted(() => {
    const mockParseMetricsFromCSV = vi.fn()
    const mockParseSupplementsFromCSV = vi.fn()
    const mockParseProgressFromCSV = vi.fn()
    return { mockParseMetricsFromCSV, mockParseSupplementsFromCSV, mockParseProgressFromCSV }
  })

// ── Module mocks ──

vi.mock('@/lib/auth-middleware', () => ({
  verifyCoachAuth: mockVerifyCoachAuth,
}))

vi.mock('@/lib/csv-parser', () => ({
  parseMetricsFromCSV: mockParseMetricsFromCSV,
  parseSupplementsFromCSV: mockParseSupplementsFromCSV,
  parseProgressFromCSV: mockParseProgressFromCSV,
}))

import { POST } from '@/app/api/upload-csv/route'

// ── Helpers ──

/**
 * Create a fake File object for the mock FormData.
 * The route calls `file.size` and `file.name` and `file.text()`.
 */
function createFakeFile(name: string, content: string): File {
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], name, { type: 'text/csv' })
}

/**
 * Build a NextRequest whose formData() resolves to a controlled FormData.
 * This avoids jsdom's broken FormData streaming with NextRequest.
 */
function makePostRequest(files: Record<string, File | null>): NextRequest {
  const fakeFormData = new FormData()
  for (const [key, file] of Object.entries(files)) {
    if (file) fakeFormData.append(key, file)
  }

  const req = new NextRequest('http://localhost:3000/api/upload-csv', {
    method: 'POST',
  })

  // Override formData() to return our controlled FormData
  vi.spyOn(req, 'formData').mockResolvedValue(fakeFormData)
  return req
}

// ── Tests ──

describe('POST /api/upload-csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
  })

  it('returns 403 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: 'Not authorized' })

    const req = makePostRequest({
      metrics: createFakeFile('metrics.csv', 'name,current\nA,10'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('uploads and parses metrics CSV', async () => {
    const parsedMetrics = [{ id: 'm1', name: 'Weight', current: 75, target: 70, unit: 'kg', description: '' }]
    mockParseMetricsFromCSV.mockReturnValue(parsedMetrics)

    const req = makePostRequest({
      metrics: createFakeFile('metrics.csv', 'name,current,target,unit\nWeight,75,70,kg'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.metrics).toEqual(parsedMetrics)
    expect(mockParseMetricsFromCSV).toHaveBeenCalled()
  })

  it('uploads and parses supplements CSV', async () => {
    const parsedSupplements = [{ id: 's1', name: 'Creatine', dosage: '5g', timing: 'post', level: 1, purpose: 'strength' }]
    mockParseSupplementsFromCSV.mockReturnValue(parsedSupplements)

    const req = makePostRequest({
      supplements: createFakeFile('supplements.csv', 'name,dosage,timing\nCreatine,5g,post'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.supplements).toEqual(parsedSupplements)
    expect(mockParseSupplementsFromCSV).toHaveBeenCalled()
  })

  it('uploads and parses progress CSV', async () => {
    const parsedProgress = [{ week: '1', weight: 75 }]
    mockParseProgressFromCSV.mockReturnValue(parsedProgress)

    const req = makePostRequest({
      progress: createFakeFile('progress.csv', 'week,weight\n1,75'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.progress).toEqual(parsedProgress)
    expect(mockParseProgressFromCSV).toHaveBeenCalled()
  })

  it('uploads multiple CSV files at once', async () => {
    const parsedMetrics = [{ id: 'm1', name: 'Weight', current: 75, target: 70, unit: 'kg', description: '' }]
    const parsedSupplements = [{ id: 's1', name: 'Creatine', dosage: '5g', timing: 'post', level: 1, purpose: '' }]
    const parsedProgress = [{ week: '1', weight: 75 }]

    mockParseMetricsFromCSV.mockReturnValue(parsedMetrics)
    mockParseSupplementsFromCSV.mockReturnValue(parsedSupplements)
    mockParseProgressFromCSV.mockReturnValue(parsedProgress)

    const req = makePostRequest({
      metrics: createFakeFile('metrics.csv', 'name,current\nWeight,75'),
      supplements: createFakeFile('supplements.csv', 'name,dosage\nCreatine,5g'),
      progress: createFakeFile('progress.csv', 'week,weight\n1,75'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.metrics).toEqual(parsedMetrics)
    expect(json.supplements).toEqual(parsedSupplements)
    expect(json.progress).toEqual(parsedProgress)
  })

  it('returns 400 when file exceeds 5MB size limit', async () => {
    // Create a file larger than 5MB
    const largeContent = 'x'.repeat(6 * 1024 * 1024)

    const req = makePostRequest({
      metrics: createFakeFile('huge.csv', largeContent),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('5MB')
  })

  it('handles empty form data with no files (returns empty response)', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    // No files means no parsing, just returns empty data object
    expect(res.status).toBe(200)
    expect(json.metrics).toBeUndefined()
    expect(json.supplements).toBeUndefined()
    expect(json.progress).toBeUndefined()
  })

  it('returns 500 when CSV parser throws', async () => {
    mockParseMetricsFromCSV.mockImplementation(() => {
      throw new Error('Malformed CSV')
    })

    const req = makePostRequest({
      metrics: createFakeFile('broken.csv', 'bad csv content'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to parse CSV files')
  })

  it('handles only metrics file without supplements or progress', async () => {
    const parsedMetrics = [{ id: 'm1', name: 'BF', current: 15, target: 10, unit: '%', description: '' }]
    mockParseMetricsFromCSV.mockReturnValue(parsedMetrics)

    const req = makePostRequest({
      metrics: createFakeFile('metrics.csv', 'name,current\nBF,15'),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.metrics).toEqual(parsedMetrics)
    expect(json.supplements).toBeUndefined()
    expect(json.progress).toBeUndefined()
    expect(mockParseSupplementsFromCSV).not.toHaveBeenCalled()
    expect(mockParseProgressFromCSV).not.toHaveBeenCalled()
  })
})
