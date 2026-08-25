import { describe, it, expect } from 'vitest'
import { auditClient, auditAll, type AuditInput } from '@/lib/macro-audit'

/**
 * 這支存在的原因是我 8/23 幫震宣設碳循環時只驗了訓練日、沒驗休息日。
 * 所以每條規則都要有測試釘住，尤其是**真實踩過的那幾個**。
 */

const base = (o: Partial<AuditInput['client']> = {}, rest: Partial<AuditInput> = {}): AuditInput => ({
  client: {
    id: 'c1', name: '測試', goal_type: 'cut', prep_phase: 'cut',
    calories_target: 2070, protein_target: 170, carbs_target: 224, fat_target: 55,
    carbs_training_day: 247, carbs_rest_day: 193,
    ...o,
  },
  weight: 81, bodyFat: 24, today: '2026-08-26',
  ...rest,
})

const rules = (i: AuditInput) => auditClient(i).map(f => f.rule)

describe('震宣真實案例：修好之後不該再報', () => {
  it('現在的設定（訓練日 247 / 休息日 193）乾淨', () => {
    expect(auditClient(base())).toEqual([])
  })

  it('舊設定（訓練日 271 / 休息日 108）由「擺幅」規則抓到，不是「低碳日」', () => {
    // 舊值：脂肪 65、碳水均 201、訓 271 / 休 108
    // 訓練日 2349、休息日 1697，差 652 kcal → cycle_swing
    //
    // ⚠️ 刻意記錄一件我對 Howard 更正過的事：
    // 休息日 1697 / 淨體重 61.6 = 27.6 kcal/kg 淨體重，**高於 26 的門檻**，
    // 所以 low_day 不該觸發 —— 這組設定的問題是「整週赤字全壓在低碳日」，
    // 不是「低碳日絕對值危險」。我第一版用「24 kcal/kg 總體重」當紅線，
    // 那條線太粗糙，還對 26% 體脂的林宥任誤報過。
    const r = rules(base({ carbs_target: 201, fat_target: 65, carbs_training_day: 271, carbs_rest_day: 108 }))
    expect(r).toContain('cycle_swing')
    expect(r).not.toContain('low_day')
  })
})

describe('低碳日：分母一定要用淨體重', () => {
  it('林宥任案例（26.2% 體脂）不該誤報 — 每公斤總體重看起來低，淨體重其實正常', () => {
    // 90.3kg / 26.2% → 淨體重 66.6；低碳日 1957 kcal = 29.4 kcal/kg 淨體重
    const r = rules(base(
      { calories_target: 2121, protein_target: 193, carbs_target: 182, fat_target: 69, carbs_training_day: 212, carbs_rest_day: 141 },
      { weight: 90.3, bodyFat: 26.2 },
    ))
    expect(r).not.toContain('low_day')
  })

  it('沒有體脂資料時退回總體重門檻，並在訊息裡講明是估的', () => {
    const f = auditClient(base(
      { carbs_training_day: 120, carbs_rest_day: 40, carbs_target: 86, protein_target: 215, fat_target: 75, calories_target: 1800 },
      { weight: 87, bodyFat: null },
    )).find(x => x.rule === 'low_day')
    expect(f?.message).toContain('沒體脂資料')
    expect(f?.severity).toBe('medium')
  })
})

describe('碳循環內部一致性', () => {
  it('週均對不上設定熱量 → 抓（萬哲鴻舊值：設 1900、實際週均 2029）', () => {
    const r = rules(base({
      calories_target: 1900, protein_target: 220, carbs_target: 107, fat_target: 80,
      carbs_training_day: 150, carbs_rest_day: 50,
    }, ))
    expect(r).toContain('cycle_avg')
  })

  it('設定熱量對不上三大巨量加總 → 抓', () => {
    expect(rules(base({ calories_target: 3000 }))).toContain('sum_mismatch')
  })
})

describe('實證邊界', () => {
  it('脂肪低於總熱量 20% → 抓', () => {
    // 脂肪 30g = 270 kcal，佔比明顯低於 20%
    expect(rules(base({ fat_target: 30, carbs_target: 280, carbs_training_day: 280, carbs_rest_day: 280, calories_target: 2390 })))
      .toContain('fat_low')
  })

  it('減脂蛋白低於 2.3 g/kg 淨體重 → 抓', () => {
    // 淨體重 61.6 → 門檻 142g
    expect(rules(base({ protein_target: 120 }))).toContain('protein_low')
  })

  it('減脂速率超過 1.0% 體重/週 → 抓', () => {
    // 81 → 70 剩 28 天 = 2.75 kg/週
    expect(rules(base({ target_weight: 70, target_date: '2026-09-23' }))).toContain('rate')
  })

  it('速率在安全區內不報（81→77 到 10/25 = 0.57%/週）', () => {
    expect(rules(base({ target_weight: 77, target_date: '2026-10-25' }))).not.toContain('rate')
  })
})

describe('過期的備賽設定', () => {
  it('比賽日過了但備賽還開著 → high（萬哲鴻／謝佳峻案例）', () => {
    const f = auditClient(base({ competition_date: '2026-07-26', competition_enabled: true }))
      .find(x => x.rule === 'expired_comp')
    expect(f?.severity).toBe('high')
    expect(f?.message).toContain('已過 31 天')
  })

  it('備賽已關掉就不該再唸', () => {
    expect(rules(base({ competition_date: '2026-07-26', competition_enabled: false }))).not.toContain('expired_comp')
  })
})

describe('資料不足時據實說，不硬算', () => {
  it('沒體重 → 說無法驗證，不硬報巨量問題', () => {
    const r = rules(base({}, { weight: null }))
    expect(r).toEqual(['no_weight'])
  })
  it('巨量沒設齊 → 只報這件事就停', () => {
    expect(rules(base({ fat_target: null }))).toEqual(['missing'])
  })
})

describe('auditAll 排序', () => {
  it('high 排前面', () => {
    const out = auditAll([
      base({ id: 'a', name: 'A', target_date: '2026-01-01' }),                 // medium
      base({ id: 'b', name: 'B', protein_target: 120 }),                        // high
    ])
    expect(out[0].severity).toBe('high')
  })
})
