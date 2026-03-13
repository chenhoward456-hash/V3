import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock web-push library ──

const mockSendNotification = vi.fn()
const mockSetVapidDetails = vi.fn()

vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: any[]) => mockSendNotification(...args),
    setVapidDetails: (...args: any[]) => mockSetVapidDetails(...args),
  },
}))

// ── Mock logger ──

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ── Environment ──

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key-vapid'
  process.env.VAPID_PRIVATE_KEY = 'test-private-key-vapid'
  process.env.VAPID_EMAIL = 'mailto:test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
  mockSendNotification.mockReset()
  mockSetVapidDetails.mockReset()
})

// ── Import SUT ──

import { sendPushNotification, type PushSubscription, type PushPayload } from '@/lib/web-push'

// ── Helpers ──

const mockSubscription: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
  keys: {
    p256dh: 'test-p256dh-key',
    auth: 'test-auth-key',
  },
}

const mockPayload: PushPayload = {
  title: 'Test Notification',
  body: 'This is a test push notification',
  icon: '/icon-192.png',
  url: '/dashboard',
}

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('sendPushNotification', () => {
  it('returns true on successful push', async () => {
    mockSendNotification.mockResolvedValueOnce({ statusCode: 201 })

    const result = await sendPushNotification(mockSubscription, mockPayload)

    expect(result).toBe(true)
    expect(mockSendNotification).toHaveBeenCalledTimes(1)
    expect(mockSendNotification).toHaveBeenCalledWith(
      mockSubscription,
      JSON.stringify(mockPayload)
    )
  })

  it('passes correct payload as JSON string', async () => {
    mockSendNotification.mockResolvedValueOnce({ statusCode: 201 })

    const payload: PushPayload = { title: 'Hello', body: 'World' }
    await sendPushNotification(mockSubscription, payload)

    const passedPayload = mockSendNotification.mock.calls[0][1]
    expect(JSON.parse(passedPayload)).toEqual(payload)
  })

  it('returns false when subscription is expired (410)', async () => {
    const expiredError = new Error('Gone') as any
    expiredError.statusCode = 410
    mockSendNotification.mockRejectedValueOnce(expiredError)

    const result = await sendPushNotification(mockSubscription, mockPayload)

    expect(result).toBe(false)
  })

  it('returns false when subscription is not found (404)', async () => {
    const notFoundError = new Error('Not Found') as any
    notFoundError.statusCode = 404
    mockSendNotification.mockRejectedValueOnce(notFoundError)

    const result = await sendPushNotification(mockSubscription, mockPayload)

    expect(result).toBe(false)
  })

  it('returns false on general push error', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('Network failure'))

    const result = await sendPushNotification(mockSubscription, mockPayload)

    expect(result).toBe(false)
  })

  it('calls webPush.sendNotification with the subscription object', async () => {
    mockSendNotification.mockResolvedValueOnce({ statusCode: 201 })

    await sendPushNotification(mockSubscription, mockPayload)

    const passedSubscription = mockSendNotification.mock.calls[0][0]
    expect(passedSubscription).toEqual(mockSubscription)
    expect(passedSubscription.endpoint).toBe('https://fcm.googleapis.com/fcm/send/test-endpoint-123')
    expect(passedSubscription.keys.p256dh).toBe('test-p256dh-key')
    expect(passedSubscription.keys.auth).toBe('test-auth-key')
  })
})
