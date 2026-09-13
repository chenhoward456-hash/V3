import { describe, it, expect } from 'vitest'
import { isProposalExpired, describeProposal, DEFAULT_TTL_DAYS, type ProposalRow } from '@/lib/proposal-actions'
import { parseCoachCommand, looksLikeCoachCommand } from '@/lib/line-coach-commands'

/**
 * 提案佇列的契約。
 *
 * 這些函式決定的是「一句 LINE 訊息會不會改掉學員的熱量處方」。
 * 誤判的代價是實際寫入 production 的 `clients` + `macro_adjustment_log`。
 * 所以每條規則都要有測試釘住，尤其是「什麼時候拒絕動手」。
 */

const NOW = new Date('2026-09-14T00:00:00Z')
const p = (o: Partial<ProposalRow> = {}): ProposalRow => ({
  id: 'p1', client_id: 'c1', proposed_by: 'system_trajectory',
  proposed_at: '2026-09-13T00:00:00Z', expires_at: '2026-09-15T00:00:00Z',
  status: 'pending', proposal_type: 'macro_adjustment',
  current_state: { calories_target: 2250, carbs_target: 230 },
  proposed_changes: { calories_target: 1830, carbs_target: 125 },
  reasoning: '週速率不足', ...o,
})

describe('過期判定', () => {
  it('過了 expires_at 就是過期', () => {
    expect(isProposalExpired(p({ expires_at: '2026-09-13T00:00:00Z' }), NOW)).toBe(true)
    expect(isProposalExpired(p({ expires_at: '2026-09-15T00:00:00Z' }), NOW)).toBe(false)
  })

  it(`沒有 expires_at 就用 ${DEFAULT_TTL_DAYS} 天兜底`, () => {
    expect(isProposalExpired(p({ expires_at: null, proposed_at: '2026-09-13T00:00:00Z' }), NOW)).toBe(false)
    expect(isProposalExpired(p({ expires_at: null, proposed_at: '2026-09-01T00:00:00Z' }), NOW)).toBe(true)
  })

  it('🚨 Sean 2026-09 那 10 筆全部都該判成過期', () => {
    // 它們 status 還掛 pending，但每一筆的 expires_at 都是隔天。
    // 沒有 sweeper 之前，/admin 的「10 筆待審」其實是 10 具屍體。
    for (const [proposed, expires] of [
      ['2026-09-05', '2026-09-06'], ['2026-09-04', '2026-09-05'],
      ['2026-09-02', '2026-09-03'], ['2026-08-24', '2026-08-25'],
    ]) {
      expect(isProposalExpired(p({ proposed_at: proposed, expires_at: expires }), NOW), proposed).toBe(true)
    }
  })
})

describe('describeProposal：一行講清楚要改什麼', () => {
  it('只列真的有變的欄位', () => {
    const t = describeProposal(p())
    expect(t).toContain('熱量 2250→1830')
    expect(t).toContain('碳水 230→125')
    expect(t).not.toContain('蛋白')
  })

  it('值沒變的不列', () => {
    const t = describeProposal(p({
      current_state: { calories_target: 2250, protein_target: 185 },
      proposed_changes: { calories_target: 2250, protein_target: 170 },
    }))
    expect(t).not.toContain('熱量')
    expect(t).toContain('蛋白 185→170')
  })

  it('personal_note 不要拿 macro 的講法硬套', () => {
    expect(describeProposal(p({ proposal_type: 'personal_note', proposed_changes: { note: '他說出差兩週' } })))
      .toContain('出差兩週')
  })
})

describe('parseCoachCommand：一句話會不會動到學員處方', () => {
  const NAMES = ['Sean', '震宣', '林宥任']

  it('嚴格格式才算指令', () => {
    expect(parseCoachCommand('套用 Sean', NAMES)).toEqual({ kind: 'approve', name: 'Sean' })
    expect(parseCoachCommand('不要 震宣', NAMES)).toEqual({ kind: 'reject', name: '震宣' })
    expect(parseCoachCommand('提案', NAMES)).toEqual({ kind: 'list_proposals' })
  })

  it('🚨 動詞後面必須「剛好」是名字 —— 這是最重要的一道防線', () => {
    // 沒有這條，下面這句會退掉一筆他其實想留的提案
    expect(parseCoachCommand('不要再幫他加碳水了', NAMES)).toBeNull()
    expect(parseCoachCommand('不要 Sean 的碳水改太多', NAMES)).toBeNull()
    expect(parseCoachCommand('套用 Sean 之前先看一下他的體重', NAMES)).toBeNull()
  })

  it('名字不在學員名單上就不算指令，交還給 agent', () => {
    expect(parseCoachCommand('套用 某某某', NAMES)).toBeNull()
    // ⚠️ 名字對得上就算指令，即使他現在沒有提案 ——
    // 「Sean 沒有等你處理的提案」是個明確答案，比丟給 agent 講 20 秒廢話好。
    expect(parseCoachCommand('套用 Sean', NAMES)).toEqual({ kind: 'approve', name: 'Sean' })
  })

  it('教練的正常問句一律不吃（交還給 agent，行為跟以前一樣）', () => {
    for (const q of [
      '震宣體重都沒動是怎樣',
      '幫我看一下 Sean 這週',
      '林宥任的蛋白質夠嗎',
      '把震宣的碳水改成 250',
      '我九月要血檢要驗什麼',
      '不要忘記提醒他抽血',
    ]) {
      expect(parseCoachCommand(q, NAMES), q).toBeNull()
    }
  })

  it('looksLikeCoachCommand 是便宜的前置過濾，不像就不要打 DB', () => {
    expect(looksLikeCoachCommand('震宣體重都沒動是怎樣')).toBe(false)
    expect(looksLikeCoachCommand('幫我看一下 Sean')).toBe(false)
    expect(looksLikeCoachCommand('套用 Sean')).toBe(true)
    expect(looksLikeCoachCommand('提案')).toBe(true)
    // 形狀像就放行，真正的把關在 parseCoachCommand（要對得上名字）
    expect(looksLikeCoachCommand('不要再幫他加碳水了')).toBe(true)
    expect(parseCoachCommand('不要再幫他加碳水了', NAMES)).toBeNull()
  })
})
