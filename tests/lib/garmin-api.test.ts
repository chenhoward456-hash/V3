import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Environment ──

const TEST_CONSUMER_KEY = 'test-garmin-consumer-key'
const TEST_CONSUMER_SECRET = 'test-garmin-consumer-secret'

// ── Global fetch mock ──

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

// ── Set env vars before import ──

beforeEach(() => {
  process.env.GARMIN_CONSUMER_KEY = TEST_CONSUMER_KEY
  process.env.GARMIN_CONSUMER_SECRET = TEST_CONSUMER_SECRET
})

afterEach(() => {
  vi.restoreAllMocks()
  mockFetch.mockReset()
})

// ── Import SUT ──

import {
  getRequestToken,
  getAccessToken,
  fetchGarminDailies,
} from '@/lib/garmin-api'

// ── Helpers ──

function textResponse(body: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  }
}

function jsonResponse(data: any, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  }
}

function errorResponse(status: number, body: string = 'Error') {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.reject(new Error('not json')),
  }
}

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('getRequestToken', () => {
  it('returns oauthToken, oauthTokenSecret, and authorizeUrl on success', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token=req_token_123&oauth_token_secret=req_secret_456')
    )

    const result = await getRequestToken('https://example.com/callback')

    expect(result.oauthToken).toBe('req_token_123')
    expect(result.oauthTokenSecret).toBe('req_secret_456')
    expect(result.authorizeUrl).toBe(
      'https://connect.garmin.com/oauthConfirm?oauth_token=req_token_123'
    )
  })

  it('sends POST to Garmin request_token endpoint with OAuth header', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token=tok&oauth_token_secret=sec')
    )

    await getRequestToken('https://example.com/cb')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://connectapi.garmin.com/oauth-service/oauth/request_token')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toMatch(/^OAuth /)
    expect(opts.headers['Authorization']).toContain('oauth_consumer_key')
    expect(opts.headers['Authorization']).toContain(TEST_CONSUMER_KEY)
    expect(opts.headers['Authorization']).toContain('oauth_callback')
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('includes HMAC-SHA1 signature in the OAuth header', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token=tok&oauth_token_secret=sec')
    )

    await getRequestToken('https://example.com/cb')

    const authHeader = mockFetch.mock.calls[0][1].headers['Authorization'] as string
    expect(authHeader).toContain('oauth_signature_method="HMAC-SHA1"')
    expect(authHeader).toContain('oauth_signature=')
    expect(authHeader).toContain('oauth_nonce=')
    expect(authHeader).toContain('oauth_timestamp=')
    expect(authHeader).toContain('oauth_version="1.0"')
  })

  it('throws when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))

    await expect(getRequestToken('https://example.com/cb'))
      .rejects.toThrow('Garmin request token')
  })

  it('throws when response is missing oauth_token', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token_secret=sec_only')
    )

    await expect(getRequestToken('https://example.com/cb'))
      .rejects.toThrow('格式錯誤')
  })

  it('throws when env vars are not set', async () => {
    delete process.env.GARMIN_CONSUMER_KEY
    delete process.env.GARMIN_CONSUMER_SECRET

    await expect(getRequestToken('https://example.com/cb'))
      .rejects.toThrow('GARMIN_CONSUMER_KEY')
  })
})

describe('getAccessToken', () => {
  it('returns accessToken and accessTokenSecret on success', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token=access_tok_789&oauth_token_secret=access_sec_012')
    )

    const result = await getAccessToken('req_tok', 'req_sec', 'verifier_abc')

    expect(result.accessToken).toBe('access_tok_789')
    expect(result.accessTokenSecret).toBe('access_sec_012')
  })

  it('sends POST to Garmin access_token endpoint with verifier', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('oauth_token=at&oauth_token_secret=ats')
    )

    await getAccessToken('req_tok', 'req_sec', 'verifier_123')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://connectapi.garmin.com/oauth-service/oauth/access_token')
    expect(opts.method).toBe('POST')
    const authHeader = opts.headers['Authorization'] as string
    expect(authHeader).toContain('oauth_verifier')
    expect(authHeader).toContain('oauth_token')
  })

  it('throws when API returns error', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'))

    await expect(getAccessToken('tok', 'sec', 'ver'))
      .rejects.toThrow('Garmin access token')
  })
})

describe('fetchGarminDailies', () => {
  const apiOpts = { accessToken: 'at_123', accessTokenSecret: 'ats_456' }

  it('returns parsed daily summaries with valid data', async () => {
    // First call: dailies endpoint
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        calendarDate: '2025-01-15',
        bodyBatteryChargedValue: 85,
        restingHeartRate: 55,
        respirationAvgBreathingRate: 16.3,
        hrvSummary: { lastNightAvg: 72 },
      },
    ]))
    // Second call: sleeps endpoint
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { calendarDate: '2025-01-15', overallSleepScore: 88 },
    ]))

    const result = await fetchGarminDailies(apiOpts, 7)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2025-01-15',
      device_recovery_score: 85,
      resting_hr: 55,
      hrv: 72,
      wearable_sleep_score: 88,
      respiratory_rate: 16.3,
    })
  })

  it('returns empty array when dailies response is not an array', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'no data' }))
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    const result = await fetchGarminDailies(apiOpts)
    expect(result).toEqual([])
  })

  it('filters out entries with no meaningful health data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { calendarDate: '2025-01-15' }, // No health fields at all
      {
        calendarDate: '2025-01-16',
        restingHeartRate: 60,
      },
    ]))
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    const result = await fetchGarminDailies(apiOpts, 7)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-16')
  })

  it('clamps resting heart rate outside valid range to null', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        calendarDate: '2025-01-15',
        restingHeartRate: 200, // Out of range (>150)
        bodyBatteryChargedValue: 50, // needs at least one valid field
      },
    ]))
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    const result = await fetchGarminDailies(apiOpts, 7)
    expect(result).toHaveLength(1)
    expect(result[0].resting_hr).toBeNull()
    expect(result[0].device_recovery_score).toBe(50)
  })

  it('gracefully handles sleep data fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        calendarDate: '2025-01-15',
        restingHeartRate: 60,
      },
    ]))
    // Sleep endpoint throws
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchGarminDailies(apiOpts, 7)
    expect(result).toHaveLength(1)
    expect(result[0].wearable_sleep_score).toBeNull()
  })

  it('falls back to averageHrv when hrvSummary is not available', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        calendarDate: '2025-01-15',
        averageHrv: 65,
        restingHeartRate: 58,
      },
    ]))
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    const result = await fetchGarminDailies(apiOpts, 7)
    expect(result[0].hrv).toBe(65)
  })

  it('falls back to bodyBatteryMostRecentValue when bodyBatteryChargedValue is null', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        calendarDate: '2025-01-15',
        bodyBatteryMostRecentValue: 70,
        restingHeartRate: 55,
      },
    ]))
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    const result = await fetchGarminDailies(apiOpts, 7)
    expect(result[0].device_recovery_score).toBe(70)
  })
})
