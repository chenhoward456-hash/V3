import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockAskClaude = vi.fn()
vi.mock('@/lib/claude', () => ({
  askClaude: (...args: any[]) => mockAskClaude(...args),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Supabase mock: supports per-table and per-query resolution
// The route creates supabase at module scope, so we need a stable reference.
let clientQueryResult: any = { data: null, error: null }
let usageCountResult: any = { count: 0 }

function createSupabaseMock() {
  const builder: any = {}
  const methods = ['select', 'insert', 'update', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit']
  for (const m of methods) {
    builder[m] = vi.fn((..._args: any[]) => builder)
  }

  // Track current table for correct resolution
  let currentTable = ''

  builder.single = vi.fn(() => {
    if (currentTable === 'clients') {
      return Promise.resolve(clientQueryResult)
    }
    return Promise.resolve({ data: null, error: null })
  })

  // For count queries: select('*', { count: 'exact', head: true })
  const origSelect = builder.select
  builder.select = vi.fn((...args: any[]) => {
    // If selecting with count option (for ai_chat_usage count query)
    if (args[1]?.count === 'exact') {
      // Return a thenable that resolves to the count
      const countChain: any = {}
      for (const m of methods) {
        countChain[m] = vi.fn(() => countChain)
      }
      countChain.then = (resolve: any) => Promise.resolve(usageCountResult).then(resolve)
      return countChain
    }
    return origSelect(...args)
  })

  // For insert (ai_chat_usage)
  builder.insert = vi.fn(() => ({
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  }))

  builder.then = (resolve: any) => {
    return Promise.resolve({ data: null, error: null }).then(resolve)
  }

  return {
    from: vi.fn((table: string) => {
      currentTable = table
      return builder
    }),
  }
}

let mockSupabase: any

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Helpers ──

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('POST /api/ai/chat', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    mockAskClaude.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'

    // Default: active client with ai_chat_enabled
    clientQueryResult = {
      data: { id: 'uuid-1', is_active: true, expires_at: null, ai_chat_enabled: true },
      error: null,
    }
    usageCountResult = { count: 0 }

    mockSupabase = createSupabaseMock()

    const mod = await import('@/app/api/ai/chat/route')
    POST = mod.POST
  })

  it('returns 400 when messages is missing', async () => {
    const req = makeRequest({ clientId: 'abc123' })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('messages')
  })

  it('returns 400 when messages is empty array', async () => {
    const req = makeRequest({ messages: [], clientId: 'abc123' })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('messages')
  })

  it('returns 400 when message has invalid role', async () => {
    const req = makeRequest({
      messages: [{ role: 'system', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('role')
  })

  it('returns 400 when message content exceeds 10000 chars', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'a'.repeat(10001) }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('10000')
  })

  it('returns 400 when image is too large (>2MB)', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'analyze this' }],
      clientId: 'abc123',
      image: 'x'.repeat(2_670_001),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('2MB')
  })

  it('returns 401 when clientId is missing', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when client is not found in DB', async () => {
    clientQueryResult = { data: null, error: { message: 'not found' } }
    mockSupabase = createSupabaseMock()
    vi.resetModules()
    const mod = await import('@/app/api/ai/chat/route')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'invalid-code',
    })
    const res = await mod.POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when client is inactive', async () => {
    clientQueryResult = {
      data: { id: 'uuid-1', is_active: false, expires_at: null, ai_chat_enabled: true },
      error: null,
    }
    mockSupabase = createSupabaseMock()
    vi.resetModules()
    const mod = await import('@/app/api/ai/chat/route')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await mod.POST(req)
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.error).toContain('暫停')
  })

  it('returns 403 when client account is expired', async () => {
    clientQueryResult = {
      data: { id: 'uuid-1', is_active: true, expires_at: '2020-01-01T00:00:00Z', ai_chat_enabled: true },
      error: null,
    }
    mockSupabase = createSupabaseMock()
    vi.resetModules()
    const mod = await import('@/app/api/ai/chat/route')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await mod.POST(req)
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.error).toContain('過期')
  })

  it('returns AI reply for valid request', async () => {
    mockAskClaude.mockResolvedValue('This is the AI reply.')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'How much protein should I eat?' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.reply).toBe('This is the AI reply.')
  })

  it('passes systemPrompt as clientContext to askClaude', async () => {
    mockAskClaude.mockResolvedValue('response')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
      systemPrompt: 'Client weighs 75kg, goal: cut',
    })
    await POST(req)

    expect(mockAskClaude).toHaveBeenCalledTimes(1)
    const [, context] = mockAskClaude.mock.calls[0]
    expect(context).toBe('Client weighs 75kg, goal: cut')
  })

  it('trims messages to last 20', async () => {
    mockAskClaude.mockResolvedValue('ok')

    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }))

    const req = makeRequest({ messages, clientId: 'abc123' })
    await POST(req)

    expect(mockAskClaude).toHaveBeenCalledTimes(1)
    const [trimmed] = mockAskClaude.mock.calls[0]
    expect(trimmed.length).toBe(20)
  })

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.resetModules()
    mockSupabase = createSupabaseMock()
    const mod = await import('@/app/api/ai/chat/route')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await mod.POST(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toContain('AI')
  })

  it('handles Claude API error with non-retryable status', async () => {
    // Use status 401 which is not retried (only 429, 500, 529 are retried)
    const err: any = new Error('invalid api key')
    err.status = 401
    mockAskClaude.mockRejectedValue(err)

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toContain('API Key')
  })

  it('handles credit balance too low error (Anthropic 400)', async () => {
    // status 400 is not retried, so no timeout
    const err: any = new Error('bad request')
    err.status = 400
    err.error = { error: { message: 'Your credit balance is too low' } }
    mockAskClaude.mockRejectedValue(err)

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.error).toContain('餘額')
  })

  it('handles Anthropic 403 forbidden error', async () => {
    const err: any = new Error('forbidden')
    err.status = 403
    mockAskClaude.mockRejectedValue(err)

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toContain('權限')
  })

  it('handles Anthropic 404 model not found error', async () => {
    const err: any = new Error('not found')
    err.status = 404
    mockAskClaude.mockRejectedValue(err)

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toContain('模型')
  })

  it('returns generic 500 for unknown errors', async () => {
    mockAskClaude.mockRejectedValue(new Error('unknown failure'))

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('attaches image to last user message', async () => {
    mockAskClaude.mockResolvedValue('food analysis')

    const req = makeRequest({
      messages: [
        { role: 'user', content: 'what is this food?' },
      ],
      clientId: 'abc123',
      image: 'base64imagedata',
    })
    await POST(req)

    const [msgs] = mockAskClaude.mock.calls[0]
    expect(msgs[msgs.length - 1].image).toBe('base64imagedata')
  })

  it('returns 403 quota exceeded for non-ai-chat user who used free trial', async () => {
    clientQueryResult = {
      data: { id: 'uuid-1', is_active: true, expires_at: null, ai_chat_enabled: false },
      error: null,
    }
    usageCountResult = { count: 1 }
    mockSupabase = createSupabaseMock()
    vi.resetModules()
    const mod = await import('@/app/api/ai/chat/route')

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      clientId: 'abc123',
    })
    const res = await mod.POST(req)
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.quota_exceeded).toBe(true)
  })
})
