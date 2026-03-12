/**
 * Tests for @/lib/notify
 *
 * Covers:
 *   - sendRoutineReminder: web push success, LINE fallback, both fail, expired sub cleanup
 */

import { sendRoutineReminder, type NotifyResult } from '@/lib/notify'

// ── Mock setup ──

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()
const mockDelete = vi.fn()
const mockIn = vi.fn()

const mockSupabase = {
  from: mockFrom,
}

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

const mockSendPushNotification = vi.fn()
vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: any[]) => mockSendPushNotification(...args),
}))

const mockPushMessage = vi.fn()
vi.mock('@/lib/line', () => ({
  pushMessage: (...args: any[]) => mockPushMessage(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ── Helpers ──

const clientId = 'client-123'
const lineUserId = 'U1234567890'
const message = {
  title: 'Morning Reminder',
  body: 'Time to log your meals!',
  lineText: 'Good morning! Time to log.',
  url: '/dashboard',
}

function setupSupabaseSelect(subscriptions: any[] | null) {
  // chain: supabase.from('push_subscriptions').select(...).eq(...)
  const eqFn = vi.fn().mockResolvedValue({ data: subscriptions })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'push_subscriptions') {
      return {
        select: selectFn,
        delete: () => ({ in: mockIn }),
      }
    }
    return { select: selectFn }
  })
  return { selectFn, eqFn }
}

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks()
  mockIn.mockResolvedValue({ error: null })
})

describe('sendRoutineReminder', () => {
  it('should return web_push success when at least one push succeeds', async () => {
    setupSupabaseSelect([
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ])
    mockSendPushNotification.mockResolvedValue(true)

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'web_push', success: true })
    expect(mockSendPushNotification).toHaveBeenCalledTimes(1)
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/sub1', keys: { p256dh: 'key1', auth: 'auth1' } },
      { title: message.title, body: message.body, url: message.url }
    )
    // LINE should NOT be called since web push succeeded
    expect(mockPushMessage).not.toHaveBeenCalled()
  })

  it('should fall back to LINE when no push subscriptions exist', async () => {
    setupSupabaseSelect(null)
    mockPushMessage.mockResolvedValue(undefined)

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'line_push', success: true })
    expect(mockPushMessage).toHaveBeenCalledWith(lineUserId, [{ type: 'text', text: message.lineText }])
  })

  it('should fall back to LINE when all push subscriptions fail (expired)', async () => {
    setupSupabaseSelect([
      { endpoint: 'https://push.example.com/expired1', p256dh: 'k1', auth: 'a1' },
      { endpoint: 'https://push.example.com/expired2', p256dh: 'k2', auth: 'a2' },
    ])
    mockSendPushNotification.mockResolvedValue(false)
    mockPushMessage.mockResolvedValue(undefined)

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'line_push', success: true })
    // Should have cleaned up expired subscriptions
    expect(mockIn).toHaveBeenCalledWith('endpoint', [
      'https://push.example.com/expired1',
      'https://push.example.com/expired2',
    ])
    expect(mockPushMessage).toHaveBeenCalled()
  })

  it('should return line_push failed when both web push and LINE fail', async () => {
    setupSupabaseSelect([])
    mockPushMessage.mockRejectedValue(new Error('LINE API error'))

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'line_push', success: false })
  })

  it('should clean up only expired subscriptions and still succeed if one works', async () => {
    setupSupabaseSelect([
      { endpoint: 'https://push.example.com/good', p256dh: 'kg', auth: 'ag' },
      { endpoint: 'https://push.example.com/expired', p256dh: 'ke', auth: 'ae' },
    ])
    mockSendPushNotification
      .mockResolvedValueOnce(true)   // first sub succeeds
      .mockResolvedValueOnce(false)  // second sub fails

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'web_push', success: true })
    // Should clean up the expired one
    expect(mockIn).toHaveBeenCalledWith('endpoint', ['https://push.example.com/expired'])
    expect(mockPushMessage).not.toHaveBeenCalled()
  })

  it('should fall back to LINE when subscriptions array is empty', async () => {
    setupSupabaseSelect([])
    mockPushMessage.mockResolvedValue(undefined)

    const result = await sendRoutineReminder(clientId, lineUserId, message)

    expect(result).toEqual({ method: 'line_push', success: true })
  })
})
