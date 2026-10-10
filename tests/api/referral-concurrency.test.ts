import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const state = vi.hoisted(() => ({ rows: [] as any[], errorTable: '', insertError: false, reads: 0, writes: 0 }))
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: () => ({ from(table: string) {
  let op = 'read'; let value: any; const filters: Record<string, any> = {}; const q: any = {}
  q.select = q.single = q.maybeSingle = () => q
  q.eq = (key: string, v: any) => { filters[key] = v; return q }
  q.insert = (v: any) => { op = 'insert'; value = v; return q }
  q.then = (resolve: any, reject: any) => {
    let data: any = null; let error: any = null
    if (state.errorTable === table) error = { message: 'lookup failed' }
    else if (table === 'clients') data = { id: 'verified-student-id', unique_code: filters.unique_code, is_active: true }
    else if (table === 'referral_codes' && op === 'insert') {
      state.writes++
      if (state.insertError || state.rows.some(row => row.code === value.code)) error = { code: '23505' }
      else { state.rows.push(value); data = value }
    } else if (table === 'referral_codes') {
      state.reads++
      data = state.rows.find(row => Object.entries(filters).every(([key, v]) => row[key] === v)) ?? null
    } else if (table === 'referrals') data = []
    return Promise.resolve({ data, error }).then(resolve, reject)
  }
  return q
} }) }))
import { GET, POST } from '@/app/api/referral/route'
const post = (clientId = 'sample-code') => POST(new NextRequest('http://local/api/referral', { method: 'POST', body: JSON.stringify({ action: 'create_code', clientId }), headers: { 'Content-Type': 'application/json' } }))
beforeEach(() => { state.rows = []; state.errorTable = ''; state.insertError = false; state.reads = state.writes = 0 })
it('same verified client concurrent requests share exactly one code under code UNIQUE, including rotated bearer codes', async () => {
  const responses = await Promise.all([post('old-code'), post('new-code')])
  expect(responses.map(r => r.status)).toEqual([200, 200])
  const bodies = await Promise.all(responses.map(r => r.json()))
  expect(bodies[0].code).toBe(bodies[1].code); expect(state.rows).toHaveLength(1)
  expect(bodies[0].code).toHaveLength(20)
})
it('existing random code remains unchanged', async () => {
  state.rows = [{ client_id: 'verified-student-id', code: 'REF-LEGACY' }]
  expect((await (await post()).json()).code).toBe('REF-LEGACY'); expect(state.writes).toBe(0)
})
it('unique collision owned by another client is 409, never exposes its code', async () => {
  const code = `REF-${crypto.createHash('sha256').update('verified-student-id').digest('hex').slice(0, 16).toUpperCase()}`
  state.rows = [{ client_id: 'other-client', code }]
  const res = await post(); expect(res.status).toBe(409); expect((await res.json()).code).toBeUndefined()
})
it.each(['clients', 'referral_codes', 'referrals'])('GET %s lookup failure fails closed without writes or fake zero totals', async table => {
  state.rows = [{ client_id: 'verified-student-id', code: 'REF-LEGACY' }]; state.errorTable = table
  const res = await GET(new NextRequest('http://local/api/referral?clientId=sample-code'))
  expect(res.status).toBe(500); expect((await res.json()).code).toBeUndefined(); expect(state.writes).toBe(0)
})
it('POST client lookup failure does not create', async () => {
  state.errorTable = 'clients'; expect((await post()).status).toBe(500); expect(state.writes).toBe(0)
})
