import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/line', async (orig) => {
  const actual = await orig<Record<string, unknown>>()
  return { ...actual, replyMessage: vi.fn().mockResolvedValue(undefined), switchRichMenuForUser: vi.fn().mockResolvedValue(undefined) }
})

import { looksLikeStudentCode, flipFirstLetterCase, handleBind } from '@/lib/line-handlers'
import { replyMessage } from '@/lib/line'

// 稽核 P-05
describe('looksLikeStudentCode', () => {
  it('rejects ordinary words people type to the bot', () => {
    for (const t of ['hello', 'thanks', 'ok123', 'Thankyou', 'goodnight']) {
      expect(looksLikeStudentCode(t)).toBe(false)
    }
  })
  it('accepts real-looking codes', () => {
    for (const t of ['Sean9Fq2', 'k8f3m2n5', 'aB-dE_fGhIjK', 'xYzqwert']) {
      expect(looksLikeStudentCode(t)).toBe(true)
    }
  })
})

describe('flipFirstLetterCase', () => {
  it('flips only the first letter', () => {
    expect(flipFirstLetterCase('sean9Fq2')).toBe('Sean9Fq2')
    expect(flipFirstLetterCase('Sean9Fq2')).toBe('sean9Fq2')
    expect(flipFirstLetterCase('9abc')).toBe('9abc')
  })
})

function makeSupabase(opts: { byCode: Record<string, any>; bindResult: { data: any; error: any } }) {
  return {
    from: vi.fn(() => {
      const calls: Array<[string, unknown[]]> = []
      const chain: any = {}
      for (const m of ['select', 'eq', 'is', 'update', 'upsert', 'insert', 'order', 'limit']) {
        chain[m] = vi.fn((...args: unknown[]) => { calls.push([m, args]); return chain })
      }
      chain.maybeSingle = vi.fn(async () => {
        if (calls.some(([m]) => m === 'update')) return opts.bindResult
        const codeEq = calls.find(([m, a]) => m === 'eq' && a[0] === 'unique_code')
        if (codeEq) return { data: opts.byCode[codeEq[1][1] as string] ?? null, error: null }
        return { data: null, error: null } // line_user_id 查詢：尚未綁定
      })
      chain.single = chain.maybeSingle
      chain.then = (r: any) => Promise.resolve({ data: null, error: null }).then(r)
      return chain
    }),
  } as any
}

describe('handleBind', () => {
  it('binds when the keyboard auto-capitalised the first letter (P-05)', async () => {
    vi.mocked(replyMessage).mockClear()
    const sb = makeSupabase({
      byCode: { sean9Fq2: { id: 'c1', name: 'Sean', line_user_id: null, subscription_tier: 'free', unique_code: 'sean9Fq2' } },
      bindResult: { data: { id: 'c1' }, error: null },
    })
    await handleBind('rt', 'U1', 'Sean9Fq2', sb)
    const texts = JSON.stringify(vi.mocked(replyMessage).mock.calls)
    expect(texts).toContain('綁定成功')
    expect(texts).toContain('/c/sean9Fq2')
  })

  it('does not claim success when the bind write fails (P-06)', async () => {
    vi.mocked(replyMessage).mockClear()
    const sb = makeSupabase({
      byCode: { k8f3m2n5: { id: 'c1', name: 'A', line_user_id: null, subscription_tier: 'free', unique_code: 'k8f3m2n5' } },
      bindResult: { data: null, error: { message: 'db down' } },
    })
    await handleBind('rt', 'U1', 'k8f3m2n5', sb)
    const texts = JSON.stringify(vi.mocked(replyMessage).mock.calls)
    expect(texts).not.toContain('綁定成功')
    expect(texts).toContain('綁定沒有成功')
  })
})
