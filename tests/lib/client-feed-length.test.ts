import { describe, it, expect } from 'vitest'
import { buildClientFeed, MAX_CARD_BODY } from '@/lib/client-feed'

/**
 * 首頁卡片不可以倒一面牆。
 *
 * 這條規則擋的是同一種事故的第三次（2026-09-19）：
 * cron 把引擎內部推理寫進 macro_adjustment_log.reason，client-feed 原樣轉述給學員。
 * Howard 收到的那張長這樣（節錄）：
 *   「你的目標自動調整了 / 原因：軌跡建議調整但被安全層 gate：Cutting gate blocked
 *    (score 31): 🟡 游離睪固酮次優（72.8 pg/mL，26歲建議 ≥80）；🚨 荷爾蒙軸多指標異常…
 *    （含嚴重異常地板 -9）（建議重新驗血）」
 * 他的原話：「字那麼多看得很躁，也沒有什麼分段，很靠北，我根本不想看。」
 *
 * 前兩次都是逐條修產生端，但產生端會一直長出來。這裡在出口把關。
 */

const REAL_GATE_REASON = '軌跡建議調整但被安全層 gate：Cutting gate blocked (score 31): '
  + '🟡 游離睪固酮次優（72.8 pg/mL，26歲建議 ≥80）；🚨 荷爾蒙軸多指標異常（T↓ + Free T↓ + E2↑）'
  + ' — 備賽後典型模式，須先恢復碳水和脂肪攝取再考慮減脂；🟢 胰島素敏感度頂尖（HOMA-IR 0.49）'
  + ' — 碳水利用率高，減脂效率好；⏰ 血檢已超過 12 週，血檢影響降低 50%（含嚴重異常地板 -9）'

const base = (adj: Record<string, unknown>) => buildClientFeed({
  today: '2026-09-19',
  clientCode: 'nfV43jIV',
  labs: [],
  macroAdjustment: {
    applied_at: '2026-09-19T01:00:00Z',
    applied_by: 'system',
    trigger_source: 'trajectory',
    old_macros: { calories_target: 3000 },
    reason: REAL_GATE_REASON,
    ...adj,
  } as never,
} as never)

describe('卡片長度是產品紀律，不是排版偏好', () => {
  it(`🚨 沒有任何一張卡的內文可以超過 ${MAX_CARD_BODY} 字`, () => {
    const cards = base({ new_macros: { _blocked: true } })
    expect(cards.length).toBeGreaterThan(0)
    for (const c of cards) expect(c.body.length, c.title).toBeLessThanOrEqual(MAX_CARD_BODY)
  })

  it('🚨 被安全層擋下時不可以說「自動調整了」—— 它正好沒有調整', () => {
    const cards = base({ new_macros: { _blocked: true } })
    const card = cards.find(c => c.id.startsWith('macro_'))!
    expect(card.title).not.toContain('調整了')
    expect(card.title).toBe('目標維持不變')
  })

  it('🚨 引擎內部詞彙不可以出現在學員眼前', () => {
    const card = base({ new_macros: { _blocked: true } }).find(c => c.id.startsWith('macro_'))!
    const text = card.title + card.body
    for (const junk of ['gate', 'Cutting', 'score', 'HOMA-IR', '軌跡', 'pg/mL', '地板']) {
      expect(text, junk).not.toContain(junk)
    }
  })

  it('細節不是刪掉，是移到點得進去的地方', () => {
    const card = base({ new_macros: { _blocked: true } }).find(c => c.id.startsWith('macro_'))!
    expect(card.cta?.href).toContain('/health/timeline')
  })

  it('真的有調整的情況照常講數字（不要因為防線把有用的也砍了）', () => {
    const cards = buildClientFeed({
      today: '2026-09-19', clientCode: 'nfV43jIV', labs: [],
      macroAdjustment: {
        applied_at: '2026-09-19T01:00:00Z', applied_by: 'system', trigger_source: 'trajectory',
        old_macros: { calories_target: 3000 }, new_macros: { calories_target: 2800 },
        reason: '進度落後，微調熱量',
      } as never,
    } as never)
    const card = cards.find(c => c.id.startsWith('macro_'))!
    expect(card.title).toContain('調整')
    expect(card.body).toContain('3000')
    expect(card.body).toContain('2800')
  })
})
