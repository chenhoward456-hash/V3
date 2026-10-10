import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { verify, create, build } = vi.hoisted(() => ({ verify: vi.fn(), create: vi.fn(), build: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyAdminSession: verify }))
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: create }))
vi.mock('@/lib/coaching-drafts', () => ({ buildCoachingDrafts: build }))
import { GET } from '@/app/api/admin/weekly-coaching/route'
function request(query = '', cookie = true) { return new NextRequest(`http://localhost/api/admin/weekly-coaching${query}`, { headers: cookie ? { cookie: 'admin_session=fixture' } : {} }) }
describe('weekly draft read route', () => {
  beforeEach(() => { vi.clearAllMocks(); verify.mockReturnValue(true); create.mockReturnValue({}); build.mockResolvedValue([]) })
  it('authenticates before constructing DB client', async () => { expect((await GET(request('', false))).status).toBe(401); expect(create).not.toHaveBeenCalled() })
  it.each(['?clientId=wrong', '?clientId='])('rejects invalid UUID %s before DB', async q => { expect((await GET(request(q))).status).toBe(400); expect(create).not.toHaveBeenCalled() })
  it('returns timestamp and no-store with existing drafts', async () => { const res = await GET(request()); expect(res.status).toBe(200); expect(res.headers.get('Cache-Control')).toBe('no-store'); expect(await res.json()).toMatchObject({ drafts: [], generatedAt: expect.stringMatching(/^\d{4}-/) }) })
  it('reports read failure rather than successful empty draft list', async () => { build.mockRejectedValue(new Error('failed')); const res = await GET(request()); expect(res.status).toBe(500); expect(await res.json()).not.toHaveProperty('drafts') })
})
