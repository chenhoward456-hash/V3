import { describe, it, expect } from 'vitest'
import { LINE_OA_ID, LINE_ADD_FRIEND_URL, lineBindDeeplink } from '@/lib/line-links'

describe('LINE 連結', () => {
  it('OA ID 是已驗證存在的 basic ID，不是 404 的 @howardprotocol', () => {
    expect(LINE_OA_ID).toBe('@468dqekm')
  })

  it('綁定深連結帶得出代碼，且訊息前綴是 webhook 認得的「綁定 」', () => {
    const url = lineBindDeeplink('LinYR8k2')
    expect(url).toContain('%40468dqekm')
    expect(decodeURIComponent(url.split('/?')[1])).toBe('綁定 LinYR8k2')
  })

  it('加好友連結是 lin.ee 短網址', () => {
    expect(LINE_ADD_FRIEND_URL).toMatch(/^https:\/\/lin\.ee\//)
  })

  it('repo 裡不該再有 @howardprotocol 這個不存在的帳號', async () => {
    const { execSync } = await import('child_process')
    const hits = execSync(
      "grep -rn 'howardprotocol' app components lib --include='*.ts' --include='*.tsx' | grep -v 'howardprotocol.com' | grep -v line-links.ts || true",
      { encoding: 'utf-8' }
    ).trim()
    expect(hits).toBe('')
  })
})
