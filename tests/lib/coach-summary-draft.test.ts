import { describe, it, expect } from 'vitest'
import { buildCoachSummaryDraft, needsDraft, writtenDate } from '@/lib/coach-summary-draft'
import { describeProposal } from '@/lib/proposal-actions'
import type { LabConsult } from '@/lib/lab-consult'

const consult = (over: Partial<LabConsult> = {}): LabConsult => ({
  drawDate: '2026-09-30', daysSinceDraw: 9, fresh: true, drawCount: 30,
  better: [{ name: '睪固酮', from: 403.9, to: 626.7, pct: 55, unit: 'ng/dL' } as never],
  worse: [{ name: 'AST', from: 30, to: 39, pct: 30, unit: 'U/L', hint: '抽血前練大重量會暫時升高', medNote: '你在吃口服 A 酸：服藥期間常偏高' } as never],
  shiftedInRange: [], noiseCount: 8,
  watch: [{ name: 'CPK', value: 397, unit: 'U/L', note: '系統沒有這項的判讀標準；你在吃口服 A 酸：服藥期間常偏高' } as never],
  good: { count: 12, names: [] }, answered: [], actions: [],
  stack: [{ name: 'zinc', status: 'no-indication', basis: '指徵不足' } as never],
  next: { date: '2027-01-16', months: 3, reason: '已排定', items: [{ label: '雌二醇', why: '' }, { label: '胱抑素 C（Cystatin C）', why: '' }] },
  ...over,
})

describe('教練補充草稿', () => {
  it('第一行標抽血日，健康報告與起草判斷都靠它', () => {
    const d = buildCoachSummaryDraft(consult())
    expect(writtenDate(d.summary)).toBe('2026-09-30')
    expect(needsDraft(d.summary, '2026-09-30')).toBe(false)
  })
  it('同一句提醒只講一次、系統自述不進草稿', () => {
    const { summary } = buildCoachSummaryDraft(consult())
    expect(summary.match(/口服 A 酸/g)).toHaveLength(1)
    expect(summary).not.toContain('系統沒有這項')
    expect(summary).toContain('zinc（沒有血檢依據）')
  })
  it('下次抽血日與項目同時寫進健康目標', () => {
    const { healthGoals } = buildCoachSummaryDraft(consult())
    expect(healthGoals).toBe('2027/01/16 回檢：驗 雌二醇、胱抑素 C')
  })
  it('教練補充停在舊抽血、或沒寫日期 → 要起草', () => {
    expect(needsDraft('🏆 備賽血檢追蹤（更新至 2026/06/26）', '2026-09-30')).toBe(true)
    expect(needsDraft('手寫沒日期', '2026-09-30')).toBe(true)
    expect(needsDraft(null, '2026-09-30')).toBe(true)
  })
  it('晨報一行描述', () => {
    expect(describeProposal({ proposal_type: 'coach_summary_draft', proposed_changes: { drawDate: '2026-09-30' } } as never)).toBe('教練補充草稿（2026-09-30 血檢）')
  })
})

import { actOnProposal } from '@/lib/proposal-actions'
describe('套用教練補充草稿', () => {
  it('覆寫 coach_summary＋health_goals、提案標 approved、不碰 macros', async () => {
    const writes: { table: string; patch: Record<string, unknown> }[] = []
    const proposal = { id: 'p1', client_id: 'c1', status: 'pending', proposal_type: 'coach_summary_draft',
      expires_at: new Date(Date.now() + 86400000).toISOString(), proposed_at: new Date().toISOString(),
      proposed_changes: { drawDate: '2026-09-30', coach_summary: '🏆 血檢追蹤（更新至 2026/09/30）', health_goals: '2027/01/16 回檢' } }
    const supabase = { from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q,
        single: async () => ({ data: proposal, error: null }),
        update: (patch: Record<string, unknown>) => { writes.push({ table, patch }); return { eq: async () => ({ error: null }) } },
      }
      return q
    } }
    const r = await actOnProposal(supabase as never, { proposalId: 'p1', action: 'approve' })
    expect(r).toEqual({ ok: true, status: 'approved' })
    expect(writes[0]).toEqual({ table: 'clients', patch: { coach_summary: '🏆 血檢追蹤（更新至 2026/09/30）', health_goals: '2027/01/16 回檢' } })
    expect(writes[1].table).toBe('pending_proposals')
    expect(writes.some(w => 'calories_target' in w.patch)).toBe(false)
  })
})
