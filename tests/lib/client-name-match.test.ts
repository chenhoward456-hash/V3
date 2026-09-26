import { describe, it, expect } from 'vitest'
import { findClientByName } from '@/lib/client-name-match'

const CLIENTS = [
  { id: '1', name: '震宣' }, { id: '2', name: '林宥任' }, { id: '3', name: '謝佳峻' },
  { id: '4', name: '張承鈞' }, { id: '5', name: '張成君' }, { id: '6', name: 'Eddie' }, { id: '7', name: '萬哲鴻' },
]

// 最小 supabase 替身：ilike 包含、eq id、無條件 select 全部
function fakeSupabase() {
  return {
    from: () => {
      let rows = CLIENTS
      const q: any = {
        select: () => q,
        ilike: (_c: string, pat: string) => { const s = pat.replace(/%/g, '').toLowerCase(); rows = rows.filter(r => r.name.toLowerCase().includes(s)); return q },
        eq: (_c: string, v: string) => { rows = rows.filter(r => r.id === v); return q },
        limit: () => q,
        maybeSingle: async () => ({ data: rows[0] ?? null }),
        then: (res: any) => res({ data: rows }),
      }
      return q
    },
  } as any
}

describe('findClientByName', () => {
  it('字面對得到就用字面，不標同音', async () => {
    const m = await findClientByName(fakeSupabase(), '宥任', 'id, name')
    expect(m).toEqual({ kind: 'one', client: { id: '2', name: '林宥任' }, bySound: false })
  })
  it('同音字找得到（震軒 → 震宣），並標 bySound', async () => {
    const m = await findClientByName(fakeSupabase(), '震軒', 'id, name')
    expect(m).toEqual({ kind: 'one', client: { id: '1', name: '震宣' }, bySound: true })
  })
  it('語音常見錯字：謝家俊 → 謝佳峻', async () => {
    const m = await findClientByName(fakeSupabase(), '謝家俊', 'id, name')
    expect(m.kind === 'one' && m.client.name).toBe('謝佳峻')
  })
  it('同音對到兩個人 → 不猜，回候選', async () => {
    const m = await findClientByName(fakeSupabase(), '張成鈞', 'id, name')
    expect(m).toEqual({ kind: 'many', candidates: ['張承鈞', '張成君'] })
  })
  it('完全沒有 → none', async () => {
    expect((await findClientByName(fakeSupabase(), '王小明', 'id, name')).kind).toBe('none')
  })
  it('英文名大小寫', async () => {
    const m = await findClientByName(fakeSupabase(), 'eddie', 'id, name')
    expect(m.kind === 'one' && m.client.name).toBe('Eddie')
  })
  it('暱稱：哲哥 → 萬哲鴻、小宣 → 震宣', async () => {
    const a = await findClientByName(fakeSupabase(), '哲哥', 'id, name')
    expect(a.kind === 'one' && a.client.name).toBe('萬哲鴻')
    const b = await findClientByName(fakeSupabase(), '小宣', 'id, name')
    expect(b.kind === 'one' && b.client.name).toBe('震宣')
  })
})
