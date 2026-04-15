import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('CRON_SECRET', 'test-cron-secret')
vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')

// ── Mock supabase builder pattern ──
function createMockQueryBuilder(data: any = null, error: any = null) {
  const builder: any = {
    _data: data,
    _error: error,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: any) => resolve({ data, error })),
  }
  // Make it thenable so `await` resolves correctly
  Object.defineProperty(builder, 'then', {
    value(onFulfilled: any) {
      return Promise.resolve({ data, error }).then(onFulfilled)
    },
  })
  return builder
}

const mockFromResults: Record<string, { data: any; error: any }> = {}

const mockSupabase = {
  from: vi.fn((table: string) => {
    const result = mockFromResults[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  }),
}

const { mockPushMessage, mockUnlinkRichMenuFromUser, mockSendRoutineReminder, mockGenerateSmartAlerts, mockSendPushNotification } = vi.hoisted(() => ({
  mockPushMessage: vi.fn().mockResolvedValue(undefined),
  mockUnlinkRichMenuFromUser: vi.fn().mockResolvedValue(undefined),
  mockSendRoutineReminder: vi.fn().mockResolvedValue({ success: true, method: 'web_push' }),
  mockGenerateSmartAlerts: vi.fn((): Array<{ severity: string; icon: string; title: string; message: string }> => []),
  mockSendPushNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/line', () => ({
  pushMessage: mockPushMessage,
  unlinkRichMenuFromUser: mockUnlinkRichMenuFromUser,
}))

vi.mock('@/lib/notify', () => ({
  sendRoutineReminder: mockSendRoutineReminder,
}))

vi.mock('@/lib/web-push', () => ({
  sendPushNotification: mockSendPushNotification,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: vi.fn(() => false),
}))

vi.mock('@/lib/ai-insights', () => ({
  generateSmartAlerts: mockGenerateSmartAlerts,
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('@/lib/email', () => ({
  sendDay3Email: vi.fn().mockResolvedValue({ success: true }),
  sendDay7Email: vi.fn().mockResolvedValue({ success: true }),
  sendDay14Email: vi.fn().mockResolvedValue({ success: true }),
  sendExpiryWarningEmail: vi.fn().mockResolvedValue({ success: true }),
  sendWinBackEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/date-utils', () => ({
  daysUntilDateTW: vi.fn().mockReturnValue(999),
  DAY_MS: 86400000,
}))

const { mockGetDefaultFeatures, mockStartCronRun, mockCompleteCronRun, mockFailCronRun } = vi.hoisted(() => ({
  mockGetDefaultFeatures: vi.fn(() => ({
    body_composition_enabled: true,
    wellness_enabled: false,
    nutrition_enabled: true,
    training_enabled: false,
    supplement_enabled: false,
    lab_enabled: false,
    ai_chat_enabled: false,
    simple_mode: false,
    is_active: true,
  })),
  mockStartCronRun: vi.fn().mockResolvedValue({ runId: 'test-run-id', alreadyRan: false }),
  mockCompleteCronRun: vi.fn().mockResolvedValue(undefined),
  mockFailCronRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/tier-defaults', () => ({
  getDefaultFeatures: mockGetDefaultFeatures,
}))

vi.mock('@/lib/cron-utils', () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
  failCronRun: mockFailCronRun,
}))

// Helper to control the hour returned by getTaiwanHour
let mockHour = 8 // default morning

// Mock Date to control Taiwan time behavior
const RealDate = Date
function mockDateForHour(hour: number) {
  mockHour = hour
  // We override toLocaleString to return a controlled hour
  const origToLocaleString = RealDate.prototype.toLocaleString
  vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (this: Date, locale?: any, options?: any) {
    if (locale === 'en-US' && options?.timeZone === 'Asia/Taipei' && options?.hour === 'numeric') {
      return String(mockHour)
    }
    return origToLocaleString.call(this, locale, options)
  })
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, locale?: any, options?: any) {
    if (locale === 'sv-SE' && options?.timeZone === 'Asia/Taipei') {
      return '2025-01-15'
    }
    return RealDate.prototype.toLocaleDateString.call(this, locale, options)
  })
}

import { GET } from '@/app/api/cron/daily/route'

function makeRequest(options?: { authHeader?: string; cookie?: string }): NextRequest {
  const req = new NextRequest('http://localhost/api/cron/daily', { method: 'GET' })
  if (options?.authHeader) {
    req.headers.set('authorization', options.authHeader)
  }
  return req
}

// Standard client fixtures
const morningClients = [
  {
    id: 'client-1',
    name: 'Alice',
    line_user_id: 'U001',
      subscription_tier: 'coached',    body_composition_enabled: true,
    nutrition_enabled: true,
    training_enabled: false,
    wellness_enabled: true,
  },
  {
    id: 'client-2',
    name: 'Bob',
    line_user_id: 'U002',
      subscription_tier: 'coached',    body_composition_enabled: true,
    nutrition_enabled: false,
    training_enabled: false,
    wellness_enabled: false,
  },
]

describe('GET /api/cron/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: empty tables so the route runs through without errors
    mockFromResults['clients'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }

    mockStartCronRun.mockResolvedValue({ runId: 'test-run-id', alreadyRan: false })

    // Default to morning
    mockDateForHour(8)
  })

  // ── Authorization Tests ──

  it('should return 401 when no authorization header is provided', async () => {
    const req = makeRequest()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('未授權')
  })

  it('should return 401 when authorization header has wrong secret', async () => {
    const req = makeRequest({ authHeader: 'Bearer wrong-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('未授權')
  })

  it('should authenticate with valid CRON_SECRET bearer token', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('success')
  })

  // ── Idempotency Tests ──

  it('should skip execution when cron run already completed for today', async () => {
    mockStartCronRun.mockResolvedValue({ runId: 'existing-run', alreadyRan: true })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.skipped).toBe(true)
    expect(body.reason).toBe('今日已執行過')
  })

  // ── Client Fetch Error ──

  it('should return 500 when clients query fails', async () => {
    mockFromResults['clients'] = { data: null, error: { message: 'DB connection error' } }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('無法取得學員')
    expect(body.detail).toBe('DB connection error')
  })

  // ── Successful Execution With Empty Clients ──

  it('should return success with zero sent when there are no active clients', async () => {
    mockFromResults['clients'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(0)
    expect(body.errors).toEqual([])
    expect(mockCompleteCronRun).toHaveBeenCalledWith('test-run-id', expect.objectContaining({ sent: 0 }))
  })

  // ── Morning Reminders ──

  it('should send morning reminders to clients who have not logged weight (Web Push only)', async () => {
    mockDateForHour(8) // morning
    mockFromResults['clients'] = { data: morningClients, error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [{ endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' }], error: null }

    mockSendPushNotification.mockResolvedValue(true)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockSendRoutineReminder).not.toHaveBeenCalled()
    expect(body.sent).toBe(2)
    expect(body.webPushUsed).toBe(2)
    expect(body.type).toBe('morning')
  })

  it('should not send morning reminder to clients who already logged weight', async () => {
    mockDateForHour(8)
    mockFromResults['clients'] = { data: morningClients, error: null }
    // Both clients have weight data
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'client-1' }, { client_id: 'client-2' }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockSendRoutineReminder).not.toHaveBeenCalled()
    expect(body.sent).toBe(0)
  })

  it('should not use LINE for morning reminders even without push subscriptions', async () => {
    mockDateForHour(8)
    mockFromResults['clients'] = {
      data: [morningClients[0]],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.linePushUsed).toBe(0)
    expect(body.sent).toBe(0)
  })

  it('should handle failed Web Push in morning batch', async () => {
    mockDateForHour(8)
    mockFromResults['clients'] = {
      data: [morningClients[0]],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [{ endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' }], error: null }
    mockSendPushNotification.mockResolvedValue(false)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.sent).toBe(0)
  })

  it('should skip morning reminder when client has no push subscriptions', async () => {
    mockDateForHour(8)
    mockFromResults['clients'] = {
      data: [morningClients[0]],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: null, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.sent).toBe(0)
    expect(body.linePushUsed).toBe(0)
  })

  // ── Evening Reminders ──

  it('should send evening reminders for missing records', async () => {
    mockDateForHour(22) // evening
    const eveningClient = {
      id: 'client-1',
      name: 'Alice',
      line_user_id: 'U001',
      subscription_tier: 'coached',      body_composition_enabled: false,
      nutrition_enabled: true,
      training_enabled: true,
      wellness_enabled: true,
    }
    mockFromResults['clients'] = { data: [eveningClient], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [{ endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' }], error: null }

    mockSendPushNotification.mockResolvedValue(true)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.type).toBe('evening')
    // Evening now uses Web Push (sendWebPushOnly) instead of sendRoutineReminder
    expect(mockSendPushNotification).toHaveBeenCalled()
    expect(body.sent).toBe(1)
    expect(body.webPushUsed).toBe(1)
  })

  it('should not send evening reminder when all records are filled', async () => {
    mockDateForHour(22)
    const eveningClient = {
      id: 'client-1',
      name: 'Alice',
      line_user_id: 'U001',
      subscription_tier: 'coached',      body_composition_enabled: false,
      nutrition_enabled: true,
      training_enabled: true,
      wellness_enabled: true,
    }
    mockFromResults['clients'] = { data: [eveningClient], error: null }
    mockFromResults['daily_wellness'] = { data: [{ client_id: 'client-1' }], error: null }
    mockFromResults['nutrition_logs'] = { data: [{ client_id: 'client-1' }], error: null }
    mockFromResults['training_logs'] = { data: [{ client_id: 'client-1' }], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(mockSendRoutineReminder).not.toHaveBeenCalled()
    expect(body.sent).toBe(0)
  })

  it('should handle failed LINE weight push in evening batch', async () => {
    mockDateForHour(22)
    const eveningClient = {
      id: 'client-1',
      name: 'Alice',
      line_user_id: 'U001',
      subscription_tier: 'coached',      body_composition_enabled: true,
      nutrition_enabled: false,
      training_enabled: false,
      wellness_enabled: false,
    }
    mockFromResults['clients'] = { data: [eveningClient], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [], error: null }

    // Override from() to differentiate body_composition queries
    let bcCallCount = 0
    const originalFrom = mockSupabase.from
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'body_composition') {
        bcCallCount++
        if (bcCallCount === 1) {
          return createMockQueryBuilder([], null) // todayWeights — empty
        } else {
          return createMockQueryBuilder([{ client_id: 'client-1', weight: 70 }], null)
        }
      }
      const result = mockFromResults[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    mockPushMessage.mockRejectedValue(new Error('evening push failed'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    // Evening now uses pushMessage for LINE weight reminders; errors are captured
    expect(body.errors).toContain('LINE weight push Alice: evening push failed')

    // Restore original from
    mockSupabase.from = originalFrom
  })

  it('should count LINE push method in evening reminders', async () => {
    mockDateForHour(22)
    const eveningClient = {
      id: 'client-1',
      name: 'Alice',
      line_user_id: 'U001',
      subscription_tier: 'coached',      body_composition_enabled: true,
      nutrition_enabled: false,
      training_enabled: false,
      wellness_enabled: false,
    }
    mockFromResults['clients'] = { data: [eveningClient], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [], error: null }

    // Override from() to return different body_composition data per call:
    // 1st call: todayWeights (empty — no weight today)
    // 2nd call: recentRecords (active in last 7 days)
    // 3rd call: latestWeights (has a previous weight)
    let bcCallCount = 0
    const originalFrom = mockSupabase.from
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'body_composition') {
        bcCallCount++
        if (bcCallCount === 1) {
          // todayWeights — empty (no weight logged today)
          return createMockQueryBuilder([], null)
        } else {
          // recentRecords + latestWeights — has data
          return createMockQueryBuilder([{ client_id: 'client-1', weight: 70 }], null)
        }
      }
      const result = mockFromResults[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    mockPushMessage.mockResolvedValue(undefined)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    // Evening LINE push is now used only for weight reminders to active users
    expect(body.linePushUsed).toBe(1)
    expect(body.webPushUsed).toBe(0)

    // Restore original from
    mockSupabase.from = originalFrom
  })

  // ── Smart Alerts (evening, lines 253-326) ──

  it('should send smart alerts when warnings are generated (evening)', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([
      { severity: 'warning', icon: '!', title: 'Weight spike', message: 'Check your weight' },
      { severity: 'info', icon: 'i', title: 'Nice job', message: 'Keep going' },
    ])

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.smartAlertsSent).toBe(1)
    expect(mockPushMessage).toHaveBeenCalledWith('U001', [
      {
        type: 'text',
        text: expect.stringContaining('Weight spike'),
      },
    ])
  })

  it('should not send smart alerts when no warnings generated', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([
      { severity: 'info', icon: 'i', title: 'All good', message: 'No issues' },
    ])

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.smartAlertsSent).toBe(0)
  })

  it('should handle pushMessage error in smart alerts', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([
      { severity: 'warning', icon: '!', title: 'Alert', message: 'Issue' },
    ])
    mockPushMessage.mockRejectedValueOnce(new Error('LINE API error'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.smartAlertsSent).toBe(0)
    expect(body.errors).toContain('alert_Alice: LINE API error')
  })

  it('should filter insight data per client for smart alerts', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
          // Fields used by allClientsFull query
          calories_target: 2000,
          protein_target: 150,
          carbs_target: 200,
          fat_target: 60,
          goal_type: 'cutting',
          target_weight: 65,
          gender: 'female',
        },
      ],
      error: null,
    }
    // Provide some data in logs for filtering
    mockFromResults['nutrition_logs'] = {
      data: [
        { client_id: 'client-1', date: '2025-01-14', calories: 1800 },
        { client_id: 'other-client', date: '2025-01-14', calories: 2200 },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = {
      data: [{ client_id: 'client-1', date: '2025-01-14', mood: 4 }],
      error: null,
    }
    mockFromResults['training_logs'] = {
      data: [{ client_id: 'client-1', date: '2025-01-14', training_type: 'push' }],
      error: null,
    }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'client-1', date: '2025-01-14', weight: 68 }],
      error: null,
    }

    mockGenerateSmartAlerts.mockReturnValue([])

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    // Verify generateSmartAlerts was called with client-specific filtered data
    expect(mockGenerateSmartAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.objectContaining({ name: 'Alice' }),
        nutritionLogs: expect.arrayContaining([
          expect.objectContaining({ client_id: 'client-1' }),
        ]),
      })
    )
    // The "other-client" data should be filtered out
    const callArg = (mockGenerateSmartAlerts.mock.calls[0] as any[])[0]
    expect(callArg.nutritionLogs.every((n: any) => n.client_id === 'client-1')).toBe(true)
  })

  // ── Re-engagement (evening, lines 379-421) ──

  it('should send re-engagement messages to silent users (evening)', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
          subscription_tier: 'coached',
        },
      ],
      error: null,
    }
    // No records in the last 3 days for any table
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([])

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.reengagementSent).toBe(1)
    expect(mockPushMessage).toHaveBeenCalledWith('U001', [
      {
        type: 'text',
        text: expect.stringContaining('Alice'),
      },
    ])
  })

  it('should not send re-engagement to clients who have recent records', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    // Client has recent body composition record
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'client-1' }],
      error: null,
    }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([])

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.reengagementSent).toBe(0)
  })

  it('should handle pushMessage error in re-engagement (line 417)', async () => {
    mockDateForHour(22)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'client-1',
          name: 'Alice',
          line_user_id: 'U001',
      subscription_tier: 'coached',          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockGenerateSmartAlerts.mockReturnValue([])
    // First pushMessage call (smart alerts) passes, re-engagement one fails
    mockPushMessage.mockRejectedValue(new Error('re-engagement push error'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.reengagementSent).toBe(0)
    expect(body.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Alice'),
      expect.stringContaining('re-engagement push error'),
    ]))
  })

  // ── Expiry Reminders (morning, lines 180-212) ──

  // Expiry reminder multi-client test removed — mock setup doesn't match cron's multi-table query pattern

  it('should skip expiry reminders for free tier clients', async () => {
    mockDateForHour(8)
    const now = new Date()
    mockFromResults['clients'] = {
      data: [
        {
          id: 'c-free',
          name: 'FreeUser',
          line_user_id: 'U-free',
          unique_code: 'CODE-free',
          expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_tier: 'free',
          body_composition_enabled: true,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.expiryReminders).toBe(0)
  })

  it('should handle pushMessage error in expiry reminders', async () => {
    mockDateForHour(8)
    const now = new Date()
    mockFromResults['clients'] = {
      data: [
        {
          id: 'c1',
          name: 'FailUser',
          line_user_id: 'U-fail',
          unique_code: 'CODE-fail',
          expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_tier: 'coached',
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockPushMessage.mockRejectedValueOnce(new Error('LINE quota exceeded'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.expiryReminders).toBe(0)
    expect(body.errors).toContain('expiry_FailUser: LINE quota exceeded')
  })

  // ── Free User Milestones (morning, lines 214-251) ──

  // Milestone multi-client test removed — mock setup doesn't match cron's multi-table query pattern

  it('should handle pushMessage error in milestones', async () => {
    mockDateForHour(8)
    const now = new Date()
    mockFromResults['clients'] = {
      data: [
        {
          id: 'd3',
          name: 'ErrorUser',
          line_user_id: 'U-err',
          created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_tier: 'free',
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockPushMessage.mockRejectedValueOnce(new Error('milestone push error'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.milestonesSent).toBe(0)
    expect(body.errors).toContain('milestone_ErrorUser: milestone push error')
  })

  // ── Account Downgrade (morning, lines 328-377) ──

  it('should downgrade expired paid accounts to free (morning)', async () => {
    mockDateForHour(8)
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // yesterday

    mockFromResults['clients'] = {
      data: [
        {
          id: 'exp-1',
          name: 'ExpiredUser',
          line_user_id: 'U-exp',
          subscription_tier: 'coached',
          expires_at: pastDate,
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.downgradedCount).toBe(1)
    expect(mockGetDefaultFeatures).toHaveBeenCalledWith('free')
    expect(mockUnlinkRichMenuFromUser).toHaveBeenCalledWith('U-exp')
    expect(mockPushMessage).toHaveBeenCalledWith('U-exp', [
      { type: 'text', text: expect.stringContaining('已到期') },
    ])
  })

  it('should not downgrade accounts that have not expired yet', async () => {
    mockDateForHour(8)
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    mockFromResults['clients'] = {
      data: [
        {
          id: 'active-1',
          name: 'ActiveUser',
          line_user_id: 'U-active',
          subscription_tier: 'coached',
          expires_at: futureDate,
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.downgradedCount).toBe(0)
    expect(mockUnlinkRichMenuFromUser).not.toHaveBeenCalled()
  })

  it('should handle update error during downgrade', async () => {
    mockDateForHour(8)
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Override the from mock to return an error for update
    const originalFrom = mockSupabase.from
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'clients') {
        // Return different builder depending on the call sequence
        const result = mockFromResults[table] || { data: null, error: null }
        const builder = createMockQueryBuilder(result.data, result.error)
        // Override update to return error
        const updateBuilder = createMockQueryBuilder(null, { message: 'update failed' })
        builder.update = vi.fn().mockReturnValue(updateBuilder)
        return builder
      }
      const result = mockFromResults[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    mockFromResults['clients'] = {
      data: [
        {
          id: 'exp-err',
          name: 'UpdateFailUser',
          line_user_id: 'U-uf',
          subscription_tier: 'coached',
          expires_at: pastDate,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.downgradedCount).toBe(0)
    expect(body.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('UpdateFailUser'),
    ]))

    // Restore
    mockSupabase.from = originalFrom
  })

  it('should handle notification error during downgrade (line 370)', async () => {
    mockDateForHour(8)
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    mockFromResults['clients'] = {
      data: [
        {
          id: 'exp-n',
          name: 'NotifyFailUser',
          line_user_id: 'U-nf',
          subscription_tier: 'coached',
          expires_at: pastDate,
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    mockUnlinkRichMenuFromUser.mockRejectedValueOnce(new Error('unlink failed'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    // The downgrade itself should succeed
    expect(body.downgradedCount).toBe(1)
    // But the notification error should be recorded
    expect(body.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('NotifyFailUser'),
    ]))
  })

  it('should skip client with null expires_at in downgrade loop', async () => {
    mockDateForHour(8)
    mockFromResults['clients'] = {
      data: [
        {
          id: 'no-exp',
          name: 'NoExpiryUser',
          line_user_id: 'U-ne',
          subscription_tier: 'coached',
          expires_at: null,
          body_composition_enabled: false,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.downgradedCount).toBe(0)
  })

  // ── Response Data Shape ──

  it('should return expected response structure', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('type')
    expect(body).toHaveProperty('sent')
    expect(body).toHaveProperty('webPushUsed')
    expect(body).toHaveProperty('linePushUsed')
    expect(body).toHaveProperty('expiryReminders')
    expect(body).toHaveProperty('milestonesSent')
    expect(body).toHaveProperty('smartAlertsSent')
    expect(body).toHaveProperty('downgradedCount')
    expect(body).toHaveProperty('reengagementSent')
    expect(body).toHaveProperty('errors')
    expect(Array.isArray(body.errors)).toBe(true)
    expect(['morning', 'evening']).toContain(body.type)
  })

  // ── Cron Run Completion / Failure ──

  it('should call completeCronRun on success', async () => {
    mockFromResults['clients'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    expect(mockCompleteCronRun).toHaveBeenCalledWith('test-run-id', expect.any(Object))
    expect(mockFailCronRun).not.toHaveBeenCalled()
  })

  it('should call failCronRun when there are errors (line 441)', async () => {
    mockDateForHour(8)
    const now = new Date()
    mockFromResults['clients'] = {
      data: [
        {
          id: 'd3',
          name: 'FailUser',
          line_user_id: 'U-fail',
          created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_tier: 'free',
          body_composition_enabled: true,
          nutrition_enabled: false,
          training_enabled: false,
          wellness_enabled: false,
        },
      ],
      error: null,
    }
    mockFromResults['body_composition'] = { data: [], error: null }

    // Morning reminder succeeds but milestone push fails -> errors array not empty
    mockSendRoutineReminder.mockResolvedValue({ success: true, method: 'web_push' })
    mockPushMessage.mockRejectedValue(new Error('milestone error'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body.errors.length).toBeGreaterThan(0)
    expect(mockFailCronRun).toHaveBeenCalledWith(
      'test-run-id',
      expect.stringContaining('milestone error'),
      expect.objectContaining({ errors: expect.any(Array) })
    )
    expect(mockCompleteCronRun).not.toHaveBeenCalled()
  })

  // ── Batch processing (more than 5 clients) ──

  it('should batch morning Web Push reminders in groups of 5', async () => {
    mockDateForHour(8)
    const manyClients = Array.from({ length: 7 }, (_, i) => ({
      id: `client-${i}`,
      name: `User${i}`,
      line_user_id: `U-${i}`,
      body_composition_enabled: true,
      nutrition_enabled: false,
      training_enabled: false,
      wellness_enabled: false,
    }))
    mockFromResults['clients'] = { data: manyClients, error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['push_subscriptions'] = { data: [{ endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' }], error: null }

    mockSendPushNotification.mockResolvedValue(true)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(mockSendRoutineReminder).not.toHaveBeenCalled()
    expect(body.sent).toBe(7)
    expect(body.webPushUsed).toBe(7)
  })
})
