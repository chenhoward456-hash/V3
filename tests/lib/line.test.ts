import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// ── Environment ──

const TEST_CHANNEL_SECRET = 'test-channel-secret-12345'
const TEST_CHANNEL_TOKEN = 'test-channel-access-token-67890'

// ── Global fetch mock ──

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

// ── Set env vars before import ──

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = TEST_CHANNEL_SECRET
  process.env.LINE_CHANNEL_ACCESS_TOKEN = TEST_CHANNEL_TOKEN
  // Clear rich menu env vars by default
  delete process.env.RICH_MENU_MEMBER_ID
  delete process.env.RICH_MENU_COACHED_ID
})

afterEach(() => {
  vi.restoreAllMocks()
  mockFetch.mockReset()
})

// ── Import SUT ──

import {
  verifyLineSignature,
  replyMessage,
  pushMessage,
  getUserProfile,
  qr,
  linkRichMenuToUser,
  unlinkRichMenuFromUser,
  listRichMenus,
  switchRichMenuForUser,
  getMarketingRichMenuObject,
  getMemberRichMenuObject,
  getCoachedRichMenuObject,
  type QuickReplyItem,
  type LineMessage,
} from '@/lib/line'

// ── Helpers ──

function computeSignature(body: string, secret: string = TEST_CHANNEL_SECRET): string {
  return crypto.createHmac('SHA256', secret).update(body).digest('base64')
}

function okResponse(data: any = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function errorResponse(status: number, body: any = {}) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }
}

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('verifyLineSignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"events":[]}'
    const signature = computeSignature(body)
    expect(verifyLineSignature(body, signature)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const body = '{"events":[]}'
    expect(verifyLineSignature(body, 'totally-wrong-signature')).toBe(false)
  })

  it('returns false when signature length differs from hash', () => {
    const body = '{"events":[]}'
    // A short string that definitely won't match length
    expect(verifyLineSignature(body, 'short')).toBe(false)
  })

  it('returns false for a valid-looking but wrong signature', () => {
    const body = '{"events":[]}'
    // Compute with different secret
    const wrongSig = crypto.createHmac('SHA256', 'wrong-secret').update(body).digest('base64')
    // Lengths might differ, but test the path regardless
    expect(verifyLineSignature(body, wrongSig)).toBe(false)
  })

  it('returns false for different body content', () => {
    const originalBody = '{"events":[]}'
    const tamperedBody = '{"events":[{"type":"message"}]}'
    const signature = computeSignature(originalBody)
    expect(verifyLineSignature(tamperedBody, signature)).toBe(false)
  })

  it('handles empty body', () => {
    const body = ''
    const signature = computeSignature(body)
    expect(verifyLineSignature(body, signature)).toBe(true)
  })
})

describe('replyMessage', () => {
  it('calls LINE API with correct endpoint and body', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())

    const messages: LineMessage[] = [{ type: 'text', text: 'Hello' }]
    await replyMessage('reply-token-123', messages)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.line.me/v2/bot/message/reply')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({
      replyToken: 'reply-token-123',
      messages,
    })
    expect(opts.headers['Authorization']).toBe(`Bearer ${TEST_CHANNEL_TOKEN}`)
    expect(opts.headers['Content-Type']).toBe('application/json')
  })
})

describe('pushMessage', () => {
  it('calls LINE API with correct endpoint and body', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())

    const messages: LineMessage[] = [{ type: 'text', text: 'Push!' }]
    await pushMessage('U_user_123', messages)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.line.me/v2/bot/message/push')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({
      to: 'U_user_123',
      messages,
    })
  })
})

describe('getUserProfile', () => {
  it('returns profile on success', async () => {
    const profile = { displayName: 'Test User', pictureUrl: 'https://example.com/pic.jpg' }
    mockFetch.mockResolvedValueOnce(okResponse(profile))

    const result = await getUserProfile('U_user_123')
    expect(result).toEqual(profile)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.line.me/v2/bot/profile/U_user_123')
    expect(opts.method).toBe('GET')
  })

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))

    const result = await getUserProfile('U_unknown')
    expect(result).toBeNull()
  })
})

describe('lineAPI retry logic', () => {
  it('retries on 500 errors and eventually succeeds', async () => {
    // First two calls fail with 500, third succeeds
    mockFetch
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okResponse({ displayName: 'Recovered' }))

    const result = await getUserProfile('U_retry')
    expect(result).toEqual({ displayName: 'Recovered' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 15000)

  it('retries on 429 rate limit errors', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse({ displayName: 'After Rate Limit' }))

    const result = await getUserProfile('U_rate_limited')
    expect(result).toEqual({ displayName: 'After Rate Limit' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 15000)

  it('does not retry 4xx errors (except 429)', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400))

    const result = await getUserProfile('U_bad_request')
    expect(result).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry 401 errors', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401))

    const result = await getUserProfile('U_unauthorized')
    expect(result).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry 403 errors', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403))

    const result = await getUserProfile('U_forbidden')
    expect(result).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns last failed response after exhausting retries', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500))

    const result = await getUserProfile('U_always_fail')
    // getUserProfile returns null for non-ok responses
    expect(result).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 15000)
})

describe('qr() helper', () => {
  it('returns correct QuickReplyItem structure', () => {
    const item = qr('Click me', 'action_text')
    expect(item).toEqual({
      type: 'action',
      action: {
        type: 'message',
        label: 'Click me',
        text: 'action_text',
      },
    })
  })

  it('handles unicode label and text', () => {
    const item = qr('記體重', '記體重')
    expect(item.action.label).toBe('記體重')
    expect(item.action.text).toBe('記體重')
  })
})

describe('Rich Menu objects', () => {
  it('getMarketingRichMenuObject returns valid structure', () => {
    const menu = getMarketingRichMenuObject()
    expect(menu.size).toEqual({ width: 2500, height: 1686 })
    expect(menu.areas).toHaveLength(6)
    expect(menu.name).toContain('行銷版')
  })

  it('getMemberRichMenuObject returns valid structure', () => {
    const menu = getMemberRichMenuObject()
    expect(menu.size).toEqual({ width: 2500, height: 1686 })
    expect(menu.areas).toHaveLength(6)
    expect(menu.name).toContain('學員版')
  })

  it('getCoachedRichMenuObject returns valid structure', () => {
    const menu = getCoachedRichMenuObject()
    expect(menu.size).toEqual({ width: 2500, height: 1686 })
    expect(menu.areas).toHaveLength(6)
    expect(menu.name).toContain('教練版')
  })
})

describe('switchRichMenuForUser', () => {
  it('unlinks rich menu for free tier', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_free_user', 'free')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/user/U_free_user/richmenu')
    expect(opts.method).toBe('DELETE')
  })

  it('unlinks rich menu for empty tier', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_empty', '')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('DELETE')
  })

  it('uses RICH_MENU_MEMBER_ID env var for self_managed tier', async () => {
    process.env.RICH_MENU_MEMBER_ID = 'richmenu-member-123'
    // linkRichMenuToUser calls fetch with POST
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_self', 'self_managed')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/user/U_self/richmenu/richmenu-member-123')
    expect(opts.method).toBe('POST')
  })

  it('uses RICH_MENU_COACHED_ID env var for coached tier', async () => {
    process.env.RICH_MENU_COACHED_ID = 'richmenu-coached-456'
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_coached', 'coached')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('richmenu-coached-456')
  })

  it('falls back to RICH_MENU_MEMBER_ID when RICH_MENU_COACHED_ID not set for coached tier', async () => {
    process.env.RICH_MENU_MEMBER_ID = 'richmenu-member-fallback'
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_coached_fallback', 'coached')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('richmenu-member-fallback')
  })

  it('falls back to name search when env vars not set', async () => {
    // First call: listRichMenus (GET /richmenu/list)
    mockFetch.mockResolvedValueOnce(okResponse({
      richmenus: [
        { richMenuId: 'rm-marketing', name: 'Howard Protocol \u2014 行銷版' },
        { richMenuId: 'rm-member', name: 'Howard Protocol \u2014 學員版' },
        { richMenuId: 'rm-coached', name: 'Howard Protocol \u2014 教練版' },
      ],
    }))
    // Second call: linkRichMenuToUser
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_search', 'self_managed')

    // Should have found the member menu by name and linked it
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [linkUrl] = mockFetch.mock.calls[1]
    expect(linkUrl).toContain('rm-member')
  })

  it('falls back to name search for coached tier, preferring coached menu', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({
      richmenus: [
        { richMenuId: 'rm-member', name: 'Howard Protocol \u2014 學員版' },
        { richMenuId: 'rm-coached', name: 'Howard Protocol \u2014 教練版' },
      ],
    }))
    mockFetch.mockResolvedValueOnce(okResponse())

    await switchRichMenuForUser('U_coached_search', 'coached')

    const [linkUrl] = mockFetch.mock.calls[1]
    expect(linkUrl).toContain('rm-coached')
  })

  it('does not throw on error (non-blocking)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    // Should not throw
    await expect(switchRichMenuForUser('U_error', 'self_managed')).resolves.toBeUndefined()
  })
})

describe('linkRichMenuToUser', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const result = await linkRichMenuToUser('U_user', 'rm-123')
    expect(result).toBe(true)
  })

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400))
    const result = await linkRichMenuToUser('U_user', 'rm-bad')
    expect(result).toBe(false)
  })
})

describe('unlinkRichMenuFromUser', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const result = await unlinkRichMenuFromUser('U_user')
    expect(result).toBe(true)
  })

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400))
    const result = await unlinkRichMenuFromUser('U_user')
    expect(result).toBe(false)
  })
})

describe('listRichMenus', () => {
  it('returns menus on success', async () => {
    const menus = [{ richMenuId: 'rm-1', name: 'Menu 1' }]
    mockFetch.mockResolvedValueOnce(okResponse({ richmenus: menus }))
    const result = await listRichMenus()
    expect(result).toEqual(menus)
  })

  it('returns empty array on failure (4xx)', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400))
    const result = await listRichMenus()
    expect(result).toEqual([])
  })
})
