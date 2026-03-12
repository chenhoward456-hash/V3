/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockVerifyAdminSession } = vi.hoisted(() => {
  const mockVerifyAdminSession = vi.fn()
  return { mockVerifyAdminSession }
})

const {
  mockGetMarketingRichMenuObject,
  mockGetMemberRichMenuObject,
  mockCreateRichMenu,
  mockUploadRichMenuImage,
  mockSetDefaultRichMenu,
  mockListRichMenus,
  mockDeleteRichMenu,
} = vi.hoisted(() => ({
  mockGetMarketingRichMenuObject: vi.fn(),
  mockGetMemberRichMenuObject: vi.fn(),
  mockCreateRichMenu: vi.fn(),
  mockUploadRichMenuImage: vi.fn(),
  mockSetDefaultRichMenu: vi.fn(),
  mockListRichMenus: vi.fn(),
  mockDeleteRichMenu: vi.fn(),
}))

const { mockSharpInstance } = vi.hoisted(() => {
  const mockToBuffer = vi.fn().mockResolvedValue(Buffer.alloc(100))
  const mockJpeg = vi.fn().mockReturnValue({ toBuffer: mockToBuffer })
  const mockResize = vi.fn().mockReturnValue({ jpeg: mockJpeg })
  return { mockSharpInstance: { resize: mockResize, jpeg: mockJpeg, toBuffer: mockToBuffer } }
})

// ── Module mocks ──

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: mockVerifyAdminSession,
}))

vi.mock('@/lib/line', () => ({
  getMarketingRichMenuObject: mockGetMarketingRichMenuObject,
  getMemberRichMenuObject: mockGetMemberRichMenuObject,
  createRichMenu: mockCreateRichMenu,
  uploadRichMenuImage: mockUploadRichMenuImage,
  setDefaultRichMenu: mockSetDefaultRichMenu,
  listRichMenus: mockListRichMenus,
  deleteRichMenu: mockDeleteRichMenu,
}))

vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue(mockSharpInstance),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

import { GET, POST } from '@/app/api/line/richmenu/route'

// ── Helpers ──

function makeGetRequest(cookies?: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/line/richmenu'
  if (cookies) {
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    return new NextRequest(url, { method: 'GET', headers: { Cookie: cookieHeader } })
  }
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequestWithImage(
  fields: Record<string, string>,
  imageField: string = 'image',
  cookies?: Record<string, string>,
): NextRequest {
  const url = 'http://localhost:3000/api/line/richmenu'
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }

  const fakeImage = new File([new Uint8Array(100)], 'menu.png', { type: 'image/png' })
  formData.append(imageField, fakeImage)

  const headers: Record<string, string> = {}
  if (cookies) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }

  return new NextRequest(url, {
    method: 'POST',
    body: formData,
    headers,
  })
}

function makePostRequestNoImage(cookies?: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/line/richmenu'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cookies) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: '{}',
  })
}

// ── Tests ──

describe('GET /api/line/richmenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(false)
    mockListRichMenus.mockResolvedValue([])
  })

  it('returns 401 when not admin', async () => {
    const req = makeGetRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when admin_session cookie is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)
    const req = makeGetRequest({ admin_session: 'bad-token' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns menus list for admin', async () => {
    mockVerifyAdminSession.mockReturnValue(true)
    const mockMenus = [
      { richMenuId: 'rm-1', name: '行銷版 Menu' },
      { richMenuId: 'rm-2', name: '學員版 Menu' },
    ]
    mockListRichMenus.mockResolvedValue(mockMenus)

    const req = makeGetRequest({ admin_session: 'valid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.menus).toEqual(mockMenus)
    expect(json.count).toBe(2)
  })

  it('returns empty list when no menus exist', async () => {
    mockVerifyAdminSession.mockReturnValue(true)
    mockListRichMenus.mockResolvedValue([])

    const req = makeGetRequest({ admin_session: 'valid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.menus).toEqual([])
    expect(json.count).toBe(0)
  })
})

describe('POST /api/line/richmenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(true)
    mockListRichMenus.mockResolvedValue([])
    mockCreateRichMenu.mockResolvedValue('richmenu-abc123')
    mockUploadRichMenuImage.mockResolvedValue(true)
    mockSetDefaultRichMenu.mockResolvedValue(true)
    mockDeleteRichMenu.mockResolvedValue(true)
    mockGetMarketingRichMenuObject.mockReturnValue({ size: { width: 2500, height: 1686 } })
    mockGetMemberRichMenuObject.mockReturnValue({ size: { width: 2500, height: 1686 } })
  })

  it('returns 401 when not admin', async () => {
    mockVerifyAdminSession.mockReturnValue(false)
    const req = makePostRequestNoImage()
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates rich menu structure without images', async () => {
    const req = makePostRequestNoImage({ admin_session: 'valid-token' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.marketingMenuId).toBe('richmenu-abc123')
    expect(json.memberMenuId).toBe('richmenu-abc123')
    expect(json.message).toContain('結構已建立')
  })

  it('creates marketing rich menu with image and sets as default', async () => {
    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.marketingMenuId).toBe('richmenu-abc123')
    expect(json.marketingStatus).toBe('ok')
    expect(mockSetDefaultRichMenu).toHaveBeenCalledWith('richmenu-abc123')
  })

  it('creates member rich menu with image (not set as default)', async () => {
    const req = makePostRequestWithImage(
      { menuType: 'member' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.memberMenuId).toBe('richmenu-abc123')
    expect(json.memberStatus).toBe('ok')
    expect(mockSetDefaultRichMenu).not.toHaveBeenCalled()
  })

  it('deletes old marketing menus before creating new marketing menu', async () => {
    mockListRichMenus.mockResolvedValue([
      { richMenuId: 'old-rm-1', name: '行銷版 Old' },
    ])

    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    await POST(req)

    expect(mockDeleteRichMenu).toHaveBeenCalledWith('old-rm-1')
  })

  it('skips deleting old menus when deleteOld is false', async () => {
    mockListRichMenus.mockResolvedValue([
      { richMenuId: 'old-rm-1', name: '行銷版 Old' },
    ])

    const req = makePostRequestWithImage(
      { menuType: 'marketing', deleteOld: 'false' },
      'image',
      { admin_session: 'valid-token' },
    )
    await POST(req)

    expect(mockDeleteRichMenu).not.toHaveBeenCalled()
  })

  it('handles LINE API error when createRichMenu fails', async () => {
    mockCreateRichMenu.mockResolvedValue(null)

    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.marketingStatus).toContain('error')
  })

  it('handles LINE API error when uploadRichMenuImage fails', async () => {
    mockUploadRichMenuImage.mockResolvedValue('Upload error: 413')

    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.marketingStatus).toContain('error')
  })

  it('handles LINE API error when setDefaultRichMenu fails', async () => {
    mockSetDefaultRichMenu.mockResolvedValue(false)

    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.marketingStatus).toContain('error')
  })

  it('returns 500 on unexpected exception in deleteOld phase', async () => {
    mockListRichMenus.mockRejectedValue(new Error('Network error'))

    const req = makePostRequestWithImage(
      { menuType: 'marketing' },
      'image',
      { admin_session: 'valid-token' },
    )
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
