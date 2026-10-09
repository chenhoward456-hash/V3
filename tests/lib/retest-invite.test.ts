import { describe, it, expect } from 'vitest'
import { buildRetestInvite } from '@/lib/retest-invite'
import { parseCoachCommand, looksLikeCoachCommand } from '@/lib/line-coach-commands'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'
import { buildStudentLabVisit } from '@/lib/lab-order-student'

const visit = buildStudentLabVisit({
  must: [{ label: 'Homocysteine 同半胱胺酸', why: '上次 14.5' }],
  defer: [{ label: 'Estradiol E2 雌激素' }],
  basePackage: { skippable: false, why: '' },
  prepNotes: '抽血前 8 小時空腹（可喝水）',
}, { age: 28, gender: '男性' })

describe('回檢邀請', () => {
  const text = buildRetestInvite({ name: '謝佳峻', lastDrawDate: '2026-06-08', today: '2026-10-09', visit })
  it('講上次抽血日與隔多久、列項目、帶準備事項', () => {
    expect(text).toContain('上次抽血是 6/8，已經 4 個月了')
    expect(text).toContain('同半胱胺酸')
    expect(text).toContain('抽血前 8 小時空腹')
    expect(text).toContain('生物素')
  })
  it('不帶價格、過合規掃描', () => {
    expect(text).not.toMatch(/\d+\s*元|NT\$/)
    expect(scanMedicalCompliance(text)).toEqual([])
  })
  it('公版沒有準備事項時才用預設，不重複講', () => {
    const t = buildRetestInvite({ name: 'A', lastDrawDate: null, today: '2026-10-09', visit: { ...visit, prepNotes: [] } })
    expect(t).toContain('前 3 天別練大重量')
    expect(text).not.toContain('前 3 天別練大重量')
  })
})

describe('回檢指令', () => {
  const names = ['謝佳峻', '震宣']
  it('回檢＝預覽、發回檢＝送出，名字要完全相符', () => {
    expect(parseCoachCommand('回檢 謝佳峻', names)).toEqual({ kind: 'preview_retest', name: '謝佳峻' })
    expect(parseCoachCommand('發回檢 謝佳峻', names)).toEqual({ kind: 'send_retest', name: '謝佳峻' })
    expect(parseCoachCommand('發回檢 謝佳峻 記得空腹', names)).toBeNull()
    expect(parseCoachCommand('回檢 路人', names)).toBeNull()
    expect(looksLikeCoachCommand('回檢 謝佳峻')).toBe(true)
  })
  it('「發 震宣」仍是週訊息，不被回檢吃掉', () => {
    expect(parseCoachCommand('發 震宣', names)).toEqual({ kind: 'send_message', name: '震宣' })
  })
})
