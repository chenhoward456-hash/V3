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

const base = (adj: Record<string, unknown>, appliedAt = '2026-09-19T01:00:00Z') => buildClientFeed({
  today: '2026-09-19',
  clientCode: 'nfV43jIV',
  labs: [],
  macroAdjustment: {
    applied_at: appliedAt,
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

describe('沒有新資訊就不要每天講', () => {
  /**
   * cron 每天寫一筆 log，所以「沒事發生」的卡在 7 天窗裡會連續出現七天。
   * Howard：「每天做的事情基本上都一樣，我到底要這系統幹嘛」——
   * 一個每天重複「沒事發生」的介面，正是他說他不想打開的那個。
   */
  it('🚨 「目標維持不變」只在當天出現，隔天起不再講', () => {
    const today = base({ new_macros: { _blocked: true } })
    expect(today.some(c => c.id.startsWith('macro_'))).toBe(true)

    const yesterday = base({ new_macros: { _blocked: true } }, '2026-09-17T01:00:00Z')
    expect(yesterday.some(c => c.id.startsWith('macro_'))).toBe(false)
  })

  it('🚨 「目標沒有動」（執行落差）同樣不重複', () => {
    const old = base({ new_macros: { _skipped: true }, reason: '體重顯示實際攝取偏高' }, '2026-09-16T01:00:00Z')
    expect(old.some(c => c.id.startsWith('macro_'))).toBe(false)
  })

  it('真的改了數字的調整保留 7 天 —— 那是他會想回頭看的事實', () => {
    const cards = buildClientFeed({
      today: '2026-09-19', clientCode: 'nfV43jIV', labs: [],
      macroAdjustment: {
        applied_at: '2026-09-15T01:00:00Z', applied_by: 'system', trigger_source: 'trajectory',
        old_macros: { calories_target: 3000 }, new_macros: { calories_target: 2800 },
        reason: '進度落後，微調熱量',
      } as never,
    } as never)
    expect(cards.some(c => c.id.startsWith('macro_'))).toBe(true)
  })
})
