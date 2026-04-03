import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockVerifyLineSignature = vi.fn()
const mockReplyMessage = vi.fn()
const mockPushMessage = vi.fn()
const mockLinkRichMenuToUser = vi.fn()
const mockUnlinkRichMenuFromUser = vi.fn()
const mockListRichMenus = vi.fn()
const mockSwitchRichMenuForUser = vi.fn()

vi.mock('@/lib/line', () => ({
  verifyLineSignature: (...args: any[]) => mockVerifyLineSignature(...args),
  replyMessage: (...args: any[]) => mockReplyMessage(...args),
  pushMessage: (...args: any[]) => mockPushMessage(...args),
  qr: (label: string, text: string) => ({
    type: 'action',
    action: { type: 'message', label, text },
  }),
  linkRichMenuToUser: (...args: any[]) => mockLinkRichMenuToUser(...args),
  unlinkRichMenuFromUser: (...args: any[]) => mockUnlinkRichMenuFromUser(...args),
  listRichMenus: (...args: any[]) => mockListRichMenus(...args),
  switchRichMenuForUser: (...args: any[]) => mockSwitchRichMenuForUser(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ── Supabase mock with per-table, per-chain tracking ──

/**
 * Creates a Supabase mock that can return different data per table.
 * tableResults is a map from table name to { data, error } or a function that
 * receives the chain call history and returns { data, error }.
 *
 * For simple cases, pass a default clientData that will be returned by .single().
 */
function createSupabaseMock(
  defaultSingleData: any = null,
  tableOverrides: Record<string, any> = {},
) {
  return {
    from: vi.fn((table: string) => {
      const override = tableOverrides[table]
      const chain: any = { _table: table, _calls: [] }
      const chainMethods = [
        'select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit',
        'update', 'upsert', 'insert',
      ]
      for (const m of chainMethods) {
        chain[m] = vi.fn((...args: any[]) => {
          chain._calls.push({ method: m, args })
          return chain
        })
      }
      chain.single = vi.fn(() => {
        if (override !== undefined) {
          if (typeof override === 'function') {
            return Promise.resolve(override(chain._calls))
          }
          return Promise.resolve(override)
        }
        return Promise.resolve({
          data: defaultSingleData,
          error: defaultSingleData ? null : { message: 'not found' },
        })
      })
      chain.maybeSingle = vi.fn(() => {
        if (override !== undefined) {
          if (typeof override === 'function') {
            return Promise.resolve(override(chain._calls))
          }
          return Promise.resolve(override)
        }
        return Promise.resolve({
          data: defaultSingleData,
          error: null,
        })
      })
      // For queries that don't call .single() (like Promise.all trend queries)
      chain.maybeSingle = chain.single
      chain.then = (resolve: any) => {
        if (override !== undefined) {
          if (typeof override === 'function') {
            return Promise.resolve(override(chain._calls)).then(resolve)
          }
          return Promise.resolve(override).then(resolve)
        }
        return Promise.resolve({
          data: defaultSingleData ? [defaultSingleData] : [],
          error: null,
        }).then(resolve)
      }
      return chain
    }),
  }
}

/**
 * Creates a Supabase mock with fine-grained per-table control.
 * Each table maps to a response: { data, error }.
 * Supports .single() and thenable resolution.
 */
function createDetailedSupabaseMock(tableMap: Record<string, { data: any; error: any }>) {
  return {
    from: vi.fn((table: string) => {
      const result = tableMap[table] || { data: null, error: { message: 'not found' } }
      const chain: any = { _table: table }
      const chainMethods = [
        'select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit',
        'update', 'upsert', 'insert',
      ]
      for (const m of chainMethods) {
        chain[m] = vi.fn(() => chain)
      }
      chain.single = vi.fn(() => Promise.resolve(result))
      chain.maybeSingle = vi.fn(() => Promise.resolve(result))
      chain.then = (resolve: any) => {
        // For array-style results (non-single), wrap single data in array
        const arrayResult = {
          data: result.data !== null ? (Array.isArray(result.data) ? result.data : [result.data]) : [],
          error: result.error,
        }
        return Promise.resolve(arrayResult).then(resolve)
      }
      return chain
    }),
  }
}

let mockSupabase: any

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Helpers ──

function makeWebhookRequest(body: any, signature = 'valid-sig'): NextRequest {
  const bodyStr = JSON.stringify(body)
  return new NextRequest('http://localhost:3000/api/line/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': signature,
    },
    body: bodyStr,
  })
}

function textEvent(text: string, userId = 'U_test', replyToken = 'reply-token') {
  return {
    type: 'message',
    source: { userId },
    replyToken,
    message: { type: 'text', text },
  }
}

const BOUND_CLIENT = {
  id: 'client-uuid-1',
  name: 'Test User',
  protein_target: 150,
  water_target: 3000,
  calories_target: 2000,
  subscription_tier: 'self_managed',
  training_enabled: true,
  wellness_enabled: true,
}

const FREE_CLIENT = {
  id: 'client-uuid-2',
  name: 'Free User',
  protein_target: null,
  water_target: null,
  calories_target: null,
  subscription_tier: 'free',
  training_enabled: false,
  wellness_enabled: false,
}

// ── Tests ──

describe('POST /api/line/webhook', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    mockVerifyLineSignature.mockReset()
    mockReplyMessage.mockReset()
    mockPushMessage.mockReset()
    mockLinkRichMenuToUser.mockReset()
    mockUnlinkRichMenuFromUser.mockReset()
    mockListRichMenus.mockReset()
    mockSwitchRichMenuForUser.mockReset()

    mockReplyMessage.mockResolvedValue({ ok: true })
    mockPushMessage.mockResolvedValue({ ok: true })
    mockLinkRichMenuToUser.mockResolvedValue(undefined)
    mockUnlinkRichMenuFromUser.mockResolvedValue(undefined)
    mockListRichMenus.mockResolvedValue([])
    mockSwitchRichMenuForUser.mockResolvedValue(undefined)

    // Default: valid signature
    mockVerifyLineSignature.mockReturnValue(true)

    // Default supabase: no client bound
    mockSupabase = createSupabaseMock(null)

    const mod = await import('@/app/api/line/webhook/route')
    POST = mod.POST
  })

  // ═══════════════════════════════════════
  // Signature Validation
  // ═══════════════════════════════════════

  describe('Signature validation', () => {
    it('returns 403 when signature is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/line/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [] }),
      })
      mockVerifyLineSignature.mockReturnValue(false)

      const res = await POST(req)
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toContain('signature')
    })

    it('returns 403 when signature is invalid', async () => {
      mockVerifyLineSignature.mockReturnValue(false)

      const req = makeWebhookRequest({ events: [] }, 'bad-signature')
      const res = await POST(req)
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toContain('signature')
    })

    it('returns 200 for valid webhook with no events', async () => {
      const req = makeWebhookRequest({ events: [] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
    })

    it('returns 500 when webhook processing throws', async () => {
      mockVerifyLineSignature.mockImplementation(() => {
        throw new Error('crypto failure')
      })

      const req = makeWebhookRequest({ events: [] })
      const res = await POST(req)
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toContain('Internal')
    })
  })

  // ═══════════════════════════════════════
  // Event routing
  // ═══════════════════════════════════════

  describe('Event routing', () => {
    it('skips events without userId', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'message',
          source: {},
          replyToken: 'reply-no-user',
          message: { type: 'text', text: 'hello' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })

    it('handles multiple events in one webhook', async () => {
      const req = makeWebhookRequest({
        events: [
          textEvent('FAQ', 'U_multi', 'reply-1'),
          textEvent('免費評估', 'U_multi', 'reply-2'),
        ],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledTimes(2)
    })

    it('updates last_line_activity for every event', async () => {
      const req = makeWebhookRequest({
        events: [textEvent('FAQ')],
      })
      await POST(req)

      // from('clients').update(...).eq(...)
      expect(mockSupabase.from).toHaveBeenCalledWith('clients')
    })
  })

  // ═══════════════════════════════════════
  // Follow event
  // ═══════════════════════════════════════

  describe('Follow event', () => {
    it('sends welcome message for new user', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'follow',
          source: { userId: 'U_new' },
          replyToken: 'reply-follow',
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-follow',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Howard Protocol'),
          }),
        ]),
      )
    })

    it('welcomes back bound returning user and switches to member rich menu', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      mockListRichMenus.mockResolvedValue([{ name: '學員版 Menu', richMenuId: 'rm-member' }])
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [{
          type: 'follow',
          source: { userId: 'U_returning' },
          replyToken: 'reply-return',
        }],
      })

      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-return',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('歡迎回來'),
          }),
        ]),
      )
      await new Promise((r) => setTimeout(r, 10))
      expect(mockSwitchRichMenuForUser).toHaveBeenCalledWith('U_returning', BOUND_CLIENT.subscription_tier || 'free')
    })
  })

  // ═══════════════════════════════════════
  // Unfollow event
  // ═══════════════════════════════════════

  describe('Unfollow event', () => {
    it('unlinks rich menu and clears last_line_activity', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'unfollow',
          source: { userId: 'U_unfollower' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockUnlinkRichMenuFromUser).toHaveBeenCalledWith('U_unfollower')
    })
  })

  // ═══════════════════════════════════════
  // Image message
  // ═══════════════════════════════════════

  describe('Image message', () => {
    it('replies with unsupported image message', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'message',
          source: { userId: 'U_img' },
          replyToken: 'reply-img',
          message: { type: 'image', id: '12345' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-img',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('不支援圖片'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Postback event
  // ═══════════════════════════════════════

  describe('Postback event', () => {
    it('handles contact_support action', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'postback',
          source: { userId: 'U_pb' },
          replyToken: 'reply-pb',
          postback: { data: 'action=contact_support' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-pb',
        expect.arrayContaining([
          expect.objectContaining({ type: 'flex' }),
        ]),
      )
    })

    it('handles unknown postback action gracefully', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'postback',
          source: { userId: 'U_pb_unknown' },
          replyToken: 'reply-pb-unknown',
          postback: { data: 'action=nonexistent' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      // Should not crash; replyMessage not called for unknown actions
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })

    it('handles postback with empty data', async () => {
      const req = makeWebhookRequest({
        events: [{
          type: 'postback',
          source: { userId: 'U_pb_empty' },
          replyToken: 'reply-pb-empty',
          postback: { data: '' },
        }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  // ═══════════════════════════════════════
  // Menu / Help commands
  // ═══════════════════════════════════════

  describe('Menu/Help commands', () => {
    it.each(['選單', '功能', '指令', 'help', '?'])('responds to "%s" with quick reply menu', async (cmd) => {
      const req = makeWebhookRequest({ events: [textEvent(cmd)] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('請點選下方按鈕'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // FAQ commands
  // ═══════════════════════════════════════

  describe('FAQ commands', () => {
    it.each(['FAQ', 'faq', '常見問題'])('responds to "%s" with FAQ content', async (cmd) => {
      const req = makeWebhookRequest({ events: [textEvent(cmd)] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('常見問題'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Inquiry command
  // ═══════════════════════════════════════

  describe('Inquiry command', () => {
    it('handles "我想詢問問題"', async () => {
      const req = makeWebhookRequest({ events: [textEvent('我想詢問問題')] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('教練會親自回覆'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // New user lead capture commands
  // ═══════════════════════════════════════

  describe('New user lead capture', () => {
    it('handles "免費評估"', async () => {
      const req = makeWebhookRequest({ events: [textEvent('免費評估')] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('免費體態評估'),
          }),
        ]),
      )
    })

    it('handles "免費教學"', async () => {
      const req = makeWebhookRequest({ events: [textEvent('免費教學')] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('免費健身知識'),
          }),
        ]),
      )
    })

    it('handles "查看方案"', async () => {
      const req = makeWebhookRequest({ events: [textEvent('查看方案')] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      // Now sends a flex message (bubble card) with a Notion link
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'flex',
            altText: expect.stringContaining('方案介紹'),
          }),
        ]),
      )
    })

    it('handles "我要綁定"', async () => {
      const req = makeWebhookRequest({ events: [textEvent('我要綁定')] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('學員代碼'),
          }),
        ]),
      )
    })

    it.each(['評估結果', '評估報告'])('handles "%s" follow-up', async (cmd) => {
      const req = makeWebhookRequest({ events: [textEvent(cmd)] })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('評估結果'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Bind command
  // ═══════════════════════════════════════

  describe('Bind command', () => {
    it('binds successfully with valid code', async () => {
      // .single() call order for 'clients' table:
      // 1. getClientByLineId -> null (user not bound yet)
      // 2. handleBind: check existing by line_user_id -> null
      // 3. handleBind: find by unique_code -> client found
      let singleCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              singleCount++
              // 1st & 2nd single: return null
              if (singleCount <= 2) {
                return Promise.resolve({ data: null, error: { message: 'not found' } })
              }
              // 3rd single: found by unique_code
              return Promise.resolve({
                data: { id: 'c-1', name: 'New Binder', line_user_id: null, subscription_tier: 'free' },
                error: null,
              })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [textEvent('綁定 abc12345')],
      })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('綁定成功'),
          }),
        ]),
      )
    })

    it('tells already-bound user they are already bound', async () => {
      // .single() call order for 'clients' table:
      // 1. getClientByLineId -> null (not bound via text handler)
      // 2. handleBind: check existing by line_user_id -> found! (already bound)
      let singleCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              singleCount++
              // 1st single: getClientByLineId -> null
              if (singleCount === 1) {
                return Promise.resolve({ data: null, error: { message: 'not found' } })
              }
              // 2nd single: handleBind existing check -> already bound!
              return Promise.resolve({ data: { id: 'c-1', name: 'Already Bound' }, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [textEvent('綁定 abcd1234')],
      })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已經綁定'),
          }),
        ]),
      )
    })

    it('reports error when code not found', async () => {
      // All client lookups return null
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [textEvent('綁定 notfound')],
      })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('找不到學員代碼'),
          }),
        ]),
      )
    })

    it('reports error when code already linked to another LINE user', async () => {
      let callCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            callCount++
            if (table === 'clients') {
              // 1st: getClientByLineId -> null
              // 2nd: handleBind existing -> null (not already bound)
              // 3rd: find by code -> found but already has line_user_id
              if (callCount <= 2) return Promise.resolve({ data: null, error: { message: 'not found' } })
              return Promise.resolve({
                data: { id: 'c-2', name: 'Other', line_user_id: 'U_other', subscription_tier: 'free' },
                error: null,
              })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [textEvent('綁定 taken123')],
      })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已經綁定了其他 LINE'),
          }),
        ]),
      )
    })

    it('auto-binds 8-char bare code for unbound user', async () => {
      // Unbound user sends bare 8-char code -> should trigger handleBind
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({
        events: [textEvent('k8f3m2n5')],
      })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      // Since code not found, it should reply with "找不到學員代碼"
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('找不到學員代碼'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Member commands (unbound user)
  // ═══════════════════════════════════════

  describe('Member commands for unbound user', () => {
    it.each(['狀態', '今天狀態', '趨勢', '週報', '記體重', '記水量', '記飲食', '記訓練', '記身心'])(
      'shows bind prompt for "%s" when user is unbound',
      async (cmd) => {
        mockSupabase = createSupabaseMock(null)
        vi.resetModules()
        const mod = await import('@/app/api/line/webhook/route')

        const req = makeWebhookRequest({
          events: [textEvent(cmd)],
        })
        const res = await mod.POST(req)
        expect(res.status).toBe(200)
        expect(mockReplyMessage).toHaveBeenCalledWith(
          'reply-token',
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('綁定帳號'),
            }),
          ]),
        )
      },
    )
  })

  // ═══════════════════════════════════════
  // Interactive entry points (bound user)
  // ═══════════════════════════════════════

  describe('Interactive entry: 記體重', () => {
    it('shows last weight quick reply buttons when previous weight exists', async () => {
      let callCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            callCount++
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            if (table === 'body_composition') {
              return Promise.resolve({ data: { weight: 72.5 }, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記體重')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('上次體重 72.5 kg'),
          }),
        ]),
      )
    })

    it('prompts manual input when no previous weight exists', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: { message: 'not found' } })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記體重')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('請輸入體重'),
          }),
        ]),
      )
    })
  })

  describe('Interactive entry: 輸入體重', () => {
    it('prompts for weight input', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('輸入體重')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('請輸入體重'),
          }),
        ]),
      )
    })
  })

  describe('Interactive entry: 記水量', () => {
    it('prompts for water input', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記水量')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('請輸入水量'),
          }),
        ]),
      )
    })
  })

  describe('Interactive entry: 記飲食', () => {
    it('prompts for compliance', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記飲食')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('飲食達標'),
          }),
        ]),
      )
    })
  })

  describe('Interactive entry: 記訓練', () => {
    it('shows training type options when training_enabled', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記訓練')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('練什麼部位'),
          }),
        ]),
      )
    })

    it('shows upgrade prompt when training_enabled is false', async () => {
      mockSupabase = createSupabaseMock(FREE_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記訓練')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('自主管理方案'),
          }),
        ]),
      )
    })
  })

  describe('Interactive entry: 記身心', () => {
    it('shows sleep quality options when wellness_enabled', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記身心')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('昨晚睡得如何'),
          }),
        ]),
      )
    })

    it('shows upgrade prompt when wellness_enabled is false', async () => {
      mockSupabase = createSupabaseMock(FREE_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('記身心')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('身心狀態記錄是自主管理方案'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Quick record: Weight
  // ═══════════════════════════════════════

  describe('Quick record: Weight (體重 XX)', () => {
    it('records weight successfully with previous comparison', async () => {
      let singleCallCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            singleCallCount++
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            if (table === 'body_composition') {
              // upsert returns success, then previous weight query
              if (singleCallCount <= 3) {
                return Promise.resolve({ data: null, error: null })
              }
              return Promise.resolve({ data: { weight: 72.0, date: '2025-01-01' }, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('體重 73.5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄體重'),
          }),
        ]),
      )
    })

    it('rejects unreasonable weight values', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('體重 5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('體重數值不合理'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user using 體重 command', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('體重 72.5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles weight upsert error', async () => {
      let singleCallCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          // Make upsert return an error
          chain.upsert = vi.fn(() => {
            return Promise.resolve({ data: null, error: { message: 'db error' } })
          })
          chain.single = vi.fn(() => {
            singleCallCount++
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('體重 72.5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })

    it('records weight without previous weight (no comparison)', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            // body_composition: upsert ok, previous weight = null
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('體重 72.5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄體重：72.5 kg'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Quick record: Water
  // ═══════════════════════════════════════

  describe('Quick record: Water (水 XXX)', () => {
    it('records water with accumulation', async () => {
      let singleCallCount = 0
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            singleCallCount++
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            if (table === 'nutrition_logs') {
              // Existing water record
              if (singleCallCount <= 3) {
                return Promise.resolve({ data: { water_ml: 1000 }, error: null })
              }
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('水 500')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('1500ml'),
          }),
        ]),
      )
    })

    it('records first water entry of the day', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('水 500')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('500ml'),
          }),
        ]),
      )
    })

    it('rejects invalid water amount', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('水 99999')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('水量數值不合理'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('水 500')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles water upsert error', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            // existing nutrition_logs
            return Promise.resolve({ data: { water_ml: 500 }, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('水 500')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Quick record: Protein
  // ═══════════════════════════════════════

  describe('Quick record: Protein (蛋白質 XX)', () => {
    it('records protein with target percentage', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('蛋白質 120')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄蛋白質：120g'),
          }),
        ]),
      )
    })

    it('records protein without target (no percentage shown)', async () => {
      const clientNoTarget = { ...BOUND_CLIENT, protein_target: null }
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: clientNoTarget, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('蛋白 80')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄蛋白質：80g'),
          }),
        ]),
      )
    })

    it('rejects invalid protein amount', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('蛋白質 999')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('蛋白質數值不合理'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('蛋白質 100')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles protein upsert error', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('蛋白質 100')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Quick record: Compliance
  // ═══════════════════════════════════════

  describe('Quick record: Compliance (達標/未達標)', () => {
    it('records compliant', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('達標')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('達標'),
          }),
        ]),
      )
    })

    it('records non-compliant', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') {
              return Promise.resolve({ data: BOUND_CLIENT, error: null })
            }
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('未達標')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('未達標'),
          }),
        ]),
      )
    })

    it('records "飲食達標" alias', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('飲食達標')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('達標'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user on 達標', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('達標')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles compliance upsert error', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('達標')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Training flow (multi-step)
  // ═══════════════════════════════════════

  describe('Training flow', () => {
    it('step 1: shows duration options for "訓練 推"', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練 推')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('練了多久'),
          }),
        ]),
      )
    })

    it('step 1: handles English training type "push"', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練 push')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('練了多久'),
          }),
        ]),
      )
    })

    it.each(['拉', '腿', '胸', '有氧', '休息'])('step 1: handles training type "%s"', async (type) => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent(`訓練 ${type}`)] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('練了多久'),
          }),
        ]),
      )
    })

    it('step 2: shows RPE options for "訓練完成 push 60"', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練完成 push 60')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('強度感受'),
          }),
        ]),
      )
    })

    it('step 3: saves training for "訓練儲存 push 60 8"', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練儲存 push 60 8')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄訓練'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user on training save', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練儲存 push 60 8')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles training upsert error', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練儲存 push 60 8')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })

    it('rejects invalid RPE in training save', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練儲存 push 60 15')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('RPE 需在 1-10'),
          }),
        ]),
      )
    })

    it('handles legacy format "訓練 推 60 RPE 8"', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('訓練 推 60 RPE 8')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄訓練'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Wellness flow (multi-step)
  // ═══════════════════════════════════════

  describe('Wellness flow', () => {
    it('step 1: shows energy options for "睡眠 3"', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('睡眠 3')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('精力如何'),
          }),
        ]),
      )
    })

    it('step 2: shows mood options for "精力 3 4"', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('精力 3 4')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('心情怎麼樣'),
          }),
        ]),
      )
    })

    it('step 3: saves wellness for "心情 3 4 4"', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('心情 3 4 4')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄身心狀態'),
          }),
        ]),
      )
    })

    it('handles legacy format "身心 4 4 4"', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('身心 4 4 4')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄身心狀態'),
          }),
        ]),
      )
    })

    it('rejects invalid wellness scores (out of 1-5)', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('身心 6 4 4')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('數值必須在 1-5'),
          }),
        ]),
      )
    })

    it('prompts bind for unbound user on wellness save', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('身心 3 3 3')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('此功能需綁定帳號'),
          }),
        ]),
      )
    })

    it('handles wellness upsert error', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('身心 3 3 3')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('記錄失敗'),
          }),
        ]),
      )
    })
  })

  // ═══════════════════════════════════════
  // Bare number as weight (bound user)
  // ═══════════════════════════════════════

  describe('Bare number as weight', () => {
    it('records bare number as weight for bound user (e.g. "72.5")', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('72.5')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('已記錄體重'),
          }),
        ]),
      )
    })

    it('does not record bare number outside 30-200 range', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      // 25 is below 30 range
      const req = makeWebhookRequest({ events: [textEvent('25')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      // Should NOT trigger weight recording; falls through to end (no reply)
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })

    it('ignores bare number for unbound user (does not try handleQuickWeight)', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('72')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      // Unbound user sending 72 (not 8 chars) -> falls through to no reply
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════
  // Status query
  // ═══════════════════════════════════════

  describe('Status query', () => {
    it('shows full status with all data recorded', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            if (table === 'body_composition') return Promise.resolve({ data: { weight: 72.5 }, error: null })
            if (table === 'daily_wellness') return Promise.resolve({ data: { sleep_quality: 4, energy_level: 3, mood: 4, hrv: 55 }, error: null })
            if (table === 'nutrition_logs') return Promise.resolve({ data: { compliant: true, protein_grams: 130, water_ml: 2500 }, error: null })
            if (table === 'training_logs') return Promise.resolve({ data: { training_type: 'push', rpe: 7 }, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('狀態')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'reply-token',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('今日狀態'),
          }),
        ]),
      )

      // Verify it includes all sections
      const replyText = mockReplyMessage.mock.calls[0][1][0].text
      expect(replyText).toContain('72.5 kg')
      expect(replyText).toContain('睡眠')
      expect(replyText).toContain('飲食')
      expect(replyText).toContain('訓練')
      expect(replyText).toContain('HRV')
    })

    it('shows missing items with quick reply buttons', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            // All other tables return no data
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('今天狀態')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)

      const replyText = mockReplyMessage.mock.calls[0][1][0].text
      expect(replyText).toContain('體重未記錄')
      expect(replyText).toContain('身心狀態未記錄')
      expect(replyText).toContain('飲食未記錄')
      expect(replyText).toContain('訓練未記錄')
    })
  })

  // ═══════════════════════════════════════
  // Trend query
  // ═══════════════════════════════════════

  describe('Trend query', () => {
    it('shows 7-day trend with all data', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            if (table === 'weekly_summaries') {
              return Promise.resolve({
                data: {
                  summary: 'Good week',
                  status: 'on_track',
                  suggested_calories: 2200,
                  weekly_weight_change_rate: -0.5,
                  warnings: ['Protein too low'],
                },
                error: null,
              })
            }
            return Promise.resolve({ data: null, error: null })
          })
          // For non-single queries (body, nutrition, training, wellness arrays)
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => {
            if (table === 'body_composition') {
              return Promise.resolve({
                data: [
                  { date: '2025-01-01', weight: 73.0 },
                  { date: '2025-01-02', weight: 72.8 },
                  { date: '2025-01-03', weight: 72.5 },
                ],
                error: null,
              }).then(resolve)
            }
            if (table === 'nutrition_logs') {
              return Promise.resolve({
                data: [
                  { date: '2025-01-01', compliant: true, protein_grams: 130, water_ml: 2500 },
                  { date: '2025-01-02', compliant: true, protein_grams: 140, water_ml: 3000 },
                  { date: '2025-01-03', compliant: false, protein_grams: 90, water_ml: 2000 },
                ],
                error: null,
              }).then(resolve)
            }
            if (table === 'training_logs') {
              return Promise.resolve({
                data: [
                  { date: '2025-01-01', training_type: 'push', rpe: 7 },
                  { date: '2025-01-02', training_type: 'pull', rpe: 8 },
                ],
                error: null,
              }).then(resolve)
            }
            if (table === 'daily_wellness') {
              return Promise.resolve({
                data: [
                  { date: '2025-01-01', sleep_quality: 4, energy_level: 3, mood: 4 },
                  { date: '2025-01-02', sleep_quality: 3, energy_level: 4, mood: 3 },
                ],
                error: null,
              }).then(resolve)
            }
            return Promise.resolve({ data: [], error: null }).then(resolve)
          }
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('趨勢')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)

      const replyText = mockReplyMessage.mock.calls[0][1][0].text
      expect(replyText).toContain('近 7 天趨勢')
      expect(replyText).toContain('體重')
      expect(replyText).toContain('飲食合規')
      expect(replyText).toContain('平均蛋白質')
      expect(replyText).toContain('平均水量')
      expect(replyText).toContain('訓練')
      expect(replyText).toContain('平均睡眠')
      expect(replyText).toContain('最新週報')
      expect(replyText).toContain('Protein too low')
    })

    it('shows empty state when no data recorded', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('週報')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)

      const replyText = mockReplyMessage.mock.calls[0][1][0].text
      expect(replyText).toContain('近 7 天趨勢')
      expect(replyText).toContain('體重：無紀錄')
      expect(replyText).toContain('飲食：無紀錄')
      expect(replyText).toContain('訓練：無紀錄')
    })

    it('shows single weight record', async () => {
      mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {}
          const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']
          for (const m of chainMethods) {
            chain[m] = vi.fn(() => chain)
          }
          chain.single = vi.fn(() => {
            if (table === 'clients') return Promise.resolve({ data: BOUND_CLIENT, error: null })
            return Promise.resolve({ data: null, error: null })
          })
          chain.maybeSingle = chain.single
          chain.then = (resolve: any) => {
            if (table === 'body_composition') {
              return Promise.resolve({
                data: [{ date: '2025-01-01', weight: 73.0 }],
                error: null,
              }).then(resolve)
            }
            return Promise.resolve({ data: [], error: null }).then(resolve)
          }
          return chain
        }),
      }

      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('趨勢')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)

      const replyText = mockReplyMessage.mock.calls[0][1][0].text
      expect(replyText).toContain('僅 1 筆紀錄')
    })
  })

  // ═══════════════════════════════════════
  // Non-command message (falls through)
  // ═══════════════════════════════════════

  describe('Non-command message', () => {
    it('does not reply to unrecognized text for bound user', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('今天天氣好好')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })

    it('does not reply to unrecognized text for unbound user', async () => {
      mockSupabase = createSupabaseMock(null)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('hello world how are you')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
      expect(mockReplyMessage).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════
  // Rich menu switching
  // ═══════════════════════════════════════

  describe('Rich menu switching', () => {
    it('calls switchRichMenuForUser when bound user sends any text', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('FAQ')] })
      await mod.POST(req)

      // Should attempt to switch rich menu (background call)
      await new Promise((r) => setTimeout(r, 10))
      expect(mockSwitchRichMenuForUser).toHaveBeenCalledWith('U_test', BOUND_CLIENT.subscription_tier || 'free')
    })

    it('does not crash when switchRichMenuForUser throws', async () => {
      mockSupabase = createSupabaseMock(BOUND_CLIENT)
      mockSwitchRichMenuForUser.mockRejectedValue(new Error('API down'))
      vi.resetModules()
      const mod = await import('@/app/api/line/webhook/route')

      const req = makeWebhookRequest({ events: [textEvent('FAQ')] })
      const res = await mod.POST(req)
      expect(res.status).toBe(200)
    })
  })
})
