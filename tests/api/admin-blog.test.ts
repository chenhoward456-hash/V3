import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }
    Object.defineProperty(builder, 'then', {
      value(onFulfilled: any) {
        return Promise.resolve({ data, error }).then(onFulfilled)
      },
    })
    return builder
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    }),
  }

  return { mockTableCalls, mockSupabase, createMockQueryBuilder }
})

const mockVerifyAdminSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

import { GET, POST, DELETE } from '@/app/api/admin/blog/route'

// ── Helpers ──

function makeRequest(
  method: string,
  body?: any,
  options: { withSession?: boolean } = {}
): NextRequest {
  const { withSession = true } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (withSession) {
    headers['Cookie'] = 'admin_session=valid-token-123'
  }
  const init: any = { method, headers }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest('http://localhost:3000/api/admin/blog', init)
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('GET /api/admin/blog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns 401 without admin session cookie', async () => {
    const req = makeRequest('GET', undefined, { withSession: false })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when session token is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('GET')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns list of blog posts on success', async () => {
    const posts = [
      { id: '1', title: 'Post 1', description: 'Desc 1', date: '2025-01-02', category: 'fitness', read_time: '5 min', slug: 'post-1' },
      { id: '2', title: 'Post 2', description: 'Desc 2', date: '2025-01-01', category: 'nutrition', read_time: '3 min', slug: 'post-2' },
    ]
    mockTableCalls['blog_posts'] = { data: posts, error: null }

    const req = makeRequest('GET')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual(posts)
    expect(json.data).toHaveLength(2)
  })

  it('returns empty array when no posts exist', async () => {
    mockTableCalls['blog_posts'] = { data: [], error: null }

    const req = makeRequest('GET')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
  })

  it('returns 500 when Supabase query fails', async () => {
    mockTableCalls['blog_posts'] = { data: null, error: { message: 'DB error' } }

    const req = makeRequest('GET')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/admin/blog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  const validPost = {
    title: 'New Post',
    description: 'A test description',
    content: '<p>Post content</p>',
    slug: 'new-post',
    category: 'fitness',
    readTime: '5 min',
    date: '2025-03-01',
  }

  it('returns 401 without admin session', async () => {
    const req = makeRequest('POST', validPost, { withSession: false })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('POST', validPost)
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    const { title, ...body } = validPost
    const req = makeRequest('POST', body)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when description is missing', async () => {
    const { description, ...body } = validPost
    const req = makeRequest('POST', body)
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when content is missing', async () => {
    const { content, ...body } = validPost
    const req = makeRequest('POST', body)
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when slug is missing', async () => {
    const { slug, ...body } = validPost
    const req = makeRequest('POST', body)
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when category is missing', async () => {
    const { category, ...body } = validPost
    const req = makeRequest('POST', body)
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 409 when slug already exists', async () => {
    // First from('blog_posts') call: slug check returns an existing post
    // Second from('blog_posts') call: insert (should not be reached)
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'blog_posts') {
        callCount++
        if (callCount === 1) {
          // Slug uniqueness check - returns existing record
          return createMockQueryBuilder({ id: 'existing-id' }, null)
        }
        // Insert call (should not be reached)
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('POST', validPost)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toContain('slug')
  })

  it('creates a new post when slug is unique', async () => {
    const createdPost = { id: 'new-id', ...validPost, read_time: '5 min' }
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'blog_posts') {
        callCount++
        if (callCount === 1) {
          // Slug check - no existing post
          return createMockQueryBuilder(null, null)
        }
        // Insert call - return created post
        return createMockQueryBuilder(createdPost, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('POST', validPost)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.id).toBe('new-id')
    expect(json.data.title).toBe('New Post')
  })

  it('returns 500 when insert fails', async () => {
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'blog_posts') {
        callCount++
        if (callCount === 1) {
          // Slug check - no existing post
          return createMockQueryBuilder(null, null)
        }
        // Insert call - return error
        return createMockQueryBuilder(null, { message: 'Insert failed' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeRequest('POST', validPost)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('DELETE /api/admin/blog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyAdminSession.mockReturnValue(true)
  })

  it('returns 401 without admin session', async () => {
    const req = makeRequest('DELETE', { id: 'post-1' }, { withSession: false })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeRequest('DELETE', { id: 'post-1' })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    const req = makeRequest('DELETE', {})
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('deletes a post successfully', async () => {
    mockTableCalls['blog_posts'] = { data: null, error: null }

    const req = makeRequest('DELETE', { id: 'post-to-delete' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 when delete fails', async () => {
    mockTableCalls['blog_posts'] = { data: null, error: { message: 'Delete failed' } }

    const req = makeRequest('DELETE', { id: 'post-to-delete' })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
