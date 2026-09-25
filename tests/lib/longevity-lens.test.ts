import { describe, it, expect } from 'vitest'
import {
  referenceChangePct, readChange, summarizePeriod, buildMarkerStory, buildHorsemen,
  estimateOneRepMax, strengthByMonth, MARKERS, type DailyRows,
} from '@/lib/longevity-lens'

const empty: DailyRows = { weights: [], nutrition: [], training: [], wellness: [] }

describe('referenceChangePct / readChange', () => {
  it('RCV 公式：CVi 9.3、CVa 3 → 約 27%（純公式檢查）', () => {
    expect(referenceChangePct(9.3)).toBeCloseTo(27.1, 0)
  })
  it('陳胤豪睪固酮 625→404（−35%）超過 RCV → 真的在變，不是誤差', () => {
    const r = readChange({ date: '2025-08-13', value: 625 }, { date: '2026-03-20', value: 404 }, MARKERS['睪固酮'].cvi)
    expect(r.pctChange).toBeCloseTo(-35.4, 0)
    expect(r.verdict).toBe('real_down')
  })
  it('HbA1c 5.2→5.3 在正常波動內 → noise', () => {
    const r = readChange({ date: '2025-01-01', value: 5.2 }, { date: '2025-07-01', value: 5.3 }, MARKERS.HbA1c.cvi)
    expect(r.verdict).toBe('noise')
  })
})

describe('summarizePeriod：兩次抽血之間發生了什麼', () => {
  it('算出平均熱量、體重速率、訓練頻率；不含起點當天', () => {
    const rows: DailyRows = {
      weights: [{ date: '2026-01-01', weight: 80 }, { date: '2026-01-29', weight: 78 }],
      nutrition: Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(i + 2).padStart(2, '0')}`, calories: 2000 })),
      training: [{ date: '2026-01-01', training_type: 'push' }, ...Array.from({ length: 12 }, (_, i) => ({ date: `2026-01-${String(i + 2).padStart(2, '0')}`, training_type: 'push' }))],
      wellness: [],
    }
    const c = summarizePeriod('2026-01-01', '2026-01-29', rows)
    expect(c.avgCalories).toBe(2000)
    expect(c.weightRatePerWeek).toBeCloseTo(-0.5, 2)
    expect(c.trainingPerWeek).toBe(3)
    expect(c.avgSleepQuality).toBeNull()
  })
  it('熱量紀錄少於 7 天 → 不給平均（避免少數幾天代表整段）', () => {
    const rows: DailyRows = { ...empty, nutrition: [{ date: '2026-01-05', calories: 3000 }] }
    expect(summarizePeriod('2026-01-01', '2026-02-01', rows).avgCalories).toBeNull()
  })
})

describe('buildMarkerStory：回檢要看上次好不好，不是照日曆（Howard：好的數字不必重買）', () => {
  it('ApoB 42 很好、體重沒變 → good_hold，不列盲點、不給回檢日', () => {
    const rows: DailyRows = { ...empty, weights: [{ date: '2025-08-10', weight: 80 }, { date: '2026-09-20', weight: 81 }] }
    const s = buildMarkerStory('ApoB', [{ date: '2025-08-12', value: 42 }], rows, '2026-09-23')
    expect(s.freshness).toBe('good_hold')
    expect(s.retestBy).toBeNull()
  })
  it('ApoB 42 很好、但之後體重 +8% → changed（情況變了才建議補點）', () => {
    const rows: DailyRows = { ...empty, weights: [{ date: '2025-08-10', weight: 80 }, { date: '2026-09-20', weight: 86.4 }] }
    const s = buildMarkerStory('ApoB', [{ date: '2025-08-12', value: 42 }], rows, '2026-09-23')
    expect(s.freshness).toBe('changed')
  })
  it('ApoB 95 不在最佳區、一年沒測 → stale', () => {
    const s = buildMarkerStory('ApoB', [{ date: '2025-08-12', value: 95 }], empty, '2026-09-23')
    expect(s.freshness).toBe('stale')
    expect(s.retestBy).toBe('2026-02-08')
  })
  it('Lp(a) 測過一次就夠 → once_ok', () => {
    const s = buildMarkerStory('Lp(a)', [{ date: '2025-08-12', value: 5 }], empty, '2026-09-23')
    expect(s.freshness).toBe('once_ok')
  })
})

describe('buildHorsemen', () => {
  it('核心指標從沒測過 → 列為該區盲點；好的舊數字不列', () => {
    const rows: DailyRows = { ...empty, weights: [{ date: '2025-08-01', weight: 80 }, { date: '2026-09-01', weight: 80.5 }] }
    const hs = buildHorsemen({ ApoB: [{ date: '2025-08-12', value: 42 }], 'Lp(a)': [{ date: '2025-08-12', value: 5 }] }, rows, '2026-09-23')
    const cardio = hs.find(h => h.key === 'cardio')!
    expect(cardio.blindSpots).toEqual([])
    const metabolic = hs.find(h => h.key === 'metabolic')!
    expect(metabolic.blindSpots).toContain('HbA1c 從沒測過')
  })
})

describe('力量指標', () => {
  it('Epley 估 1RM：100kg×5 → 117', () => {
    expect(estimateOneRepMax(100, 5)).toBe(117)
  })
  it('每月取主項最好成績，忽略非主項與 >12 下', () => {
    const pts = strengthByMonth([
      { date: '2026-01-03', exercise_name: '深蹲', weight: 150, reps: 5, is_main_lift: true },
      { date: '2026-01-10', exercise_name: '深蹲', weight: 160, reps: 3, is_main_lift: true },
      { date: '2026-01-10', exercise_name: '深蹲', weight: 60, reps: 20, is_main_lift: true },
      { date: '2026-01-10', exercise_name: '腿推', weight: 300, reps: 10, is_main_lift: false },
    ])
    expect(pts).toEqual([{ month: '2026-01', exercise: '深蹲', e1rm: 176 }])
  })
})

describe('同一天多筆合併', () => {
  it('HbA1c 同日兩筆 → 一個點，不產生「變了 0%」', () => {
    const s = buildMarkerStory('HbA1c', [{ date: '2025-04-14', value: 5.1 }, { date: '2025-04-14', value: 5.1 }], empty, '2026-09-23')
    expect(s.points).toHaveLength(1)
    expect(s.change).toBeNull()
  })
})

describe('跟至少 7 天前的點比', () => {
  it('同半胱胺酸 15→15→9→9（同週重抽）→ 讀成 15→9 −40%、真的在變', () => {
    const s = buildMarkerStory('同半胱胺酸', [
      { date: '2025-08-08', value: 15 }, { date: '2025-08-13', value: 15 },
      { date: '2026-01-02', value: 9 }, { date: '2026-01-07', value: 9 },
    ], empty, '2026-09-23')
    expect(s.change?.from.date).toBe('2025-08-13')
    expect(s.change?.pctChange).toBeCloseTo(-40, 0)
    expect(s.change?.verdict).toBe('real_down')
  })
  it('體重每週 −0.27kg → 反推每天約 −300 大卡', () => {
    const rows: DailyRows = { ...empty, weights: [{ date: '2026-01-01', weight: 84 }, { date: '2026-03-19', weight: 81.03 }] }
    expect(summarizePeriod('2026-01-01', '2026-03-20', rows).impliedDailyBalance).toBe(-300)
  })
})

import { gradeHypothesis, type LabHypothesis } from '@/lib/longevity-lens'

describe('gradeHypothesis：下次抽血自動對答案', () => {
  const h: LabHypothesis = {
    id: 'h1', marker: '睪固酮', baseline_date: '2026-03-20', baseline_value: 404,
    cause: '減脂期熱量缺口', action: '賽後吃回維持熱量', expected_direction: 'up', expected_value: 550,
    retest_by: '2026-09-26', note: null, created_at: '2026-09-23',
  }
  const base = { date: '2026-03-20', value: 404 }
  it('還沒重測 → pending；過了重測日 → overdue', () => {
    expect(gradeHypothesis(h, [base], '2026-09-23').status).toBe('pending')
    expect(gradeHypothesis(h, [base], '2026-10-01').status).toBe('overdue')
  })
  it('回到 600（+49%、超過波動、達標）→ confirmed', () => {
    expect(gradeHypothesis(h, [base, { date: '2026-09-26', value: 600 }], '2026-09-27').status).toBe('confirmed')
  })
  it('回到 530（+31%，超過 ±29% 波動但沒到 550）→ partial', () => {
    expect(gradeHypothesis(h, [base, { date: '2026-09-26', value: 530 }], '2026-09-27').status).toBe('partial')
  })
  it('420（在波動內）→ no_change；330（反方向）→ refuted', () => {
    expect(gradeHypothesis(h, [base, { date: '2026-09-26', value: 420 }], '2026-09-27').status).toBe('no_change')
    expect(gradeHypothesis(h, [base, { date: '2026-09-26', value: 280 }], '2026-09-27').status).toBe('refuted')
  })
  it('基準日後 7 天內的重抽不當答案', () => {
    expect(gradeHypothesis(h, [base, { date: '2026-03-24', value: 700 }], '2026-04-01').status).toBe('pending')
  })
})

import { buildFitness } from '@/lib/longevity-lens'

describe('buildFitness：只跟同一種量法比', () => {
  it('Garmin 48 → 實驗室 44 → Garmin 51：最新 Garmin 跟上一筆 Garmin 比（+6%），不跟實驗室比', () => {
    const v = buildFitness([
      { id: '1', kind: 'vo2max', date: '2026-01-01', value: 48, method: 'Garmin 估算', note: null },
      { id: '2', kind: 'vo2max', date: '2026-03-01', value: 44, method: '實驗室氣體分析', note: null },
      { id: '3', kind: 'vo2max', date: '2026-06-01', value: 51, method: 'Garmin 估算', note: null },
    ]).find(f => f.kind === 'vo2max')!
    expect(v.previousSameMethod?.id).toBe('1')
    expect(v.pctChange).toBeCloseTo(6.25, 1)
  })
  it('沒資料 → latest null', () => {
    expect(buildFitness([]).find(f => f.kind === 'grip')!.latest).toBeNull()
  })
})

describe('肝腎與血液', () => {
  it('肌酸酐 1.33→1.53（+15%）超過 ±13% 波動 → 真的在變；歸在 organ', () => {
    const hs = buildHorsemen({ 肌酸酐: [{ date: '2026-01-01', value: 1.33 }, { date: '2026-06-01', value: 1.53 }] }, empty, '2026-09-24')
    const organ = hs.find(h => h.key === 'organ')!
    expect(organ.stories[0].change?.verdict).toBe('real_up')
  })
})

describe('Lp(a) 偏高提示', () => {
  it('76.84 → once_ok 但 optimalNow=false；5 → optimalNow=true', () => {
    expect(buildMarkerStory('Lp(a)', [{ date: '2025-01-01', value: 76.84 }], empty, '2026-09-24').optimalNow).toBe(false)
    expect(buildMarkerStory('Lp(a)', [{ date: '2025-01-01', value: 5 }], empty, '2026-09-24').optimalNow).toBe(true)
  })
})

import { currentForCapacity } from '@/lib/longevity-lens'

describe('百歲十項全能：目標接上現在的數字', () => {
  it('肌力 → 各主項最新月份的估計 1RM（取最重兩項）＋握力', () => {
    const t = currentForCapacity('strength', [
      { month: '2026-01', exercise: '深蹲', e1rm: 150 }, { month: '2026-06', exercise: '深蹲', e1rm: 160 },
      { month: '2026-06', exercise: '臥推', e1rm: 110 }, { month: '2026-06', exercise: '划船', e1rm: 90 },
    ], buildFitness([{ id: 'g', kind: 'grip', date: '2026-09-01', value: 52, method: '握力計', note: null }]))
    expect(t).toBe('深蹲 估計 1RM 160 kg（2026-06）、臥推 估計 1RM 110 kg（2026-06）、握力 52 kg（2026-09-01）')
  })
  it('心肺沒資料、活動度 → null', () => {
    expect(currentForCapacity('cardio', [], [])).toBeNull()
    expect(currentForCapacity('mobility', [], [])).toBeNull()
  })
})

import { judgeDirection } from '@/lib/longevity-lens'

describe('judgeDirection：直接講變好還是變差', () => {
  const ch = (a: number, b: number, cvi: number) => readChange({ date: '2026-01-01', value: a }, { date: '2026-06-01', value: b }, cvi)
  it('男性睪固酮 625→404 → 變差；女性 → 不判', () => {
    expect(judgeDirection(MARKERS['睪固酮'], ch(625, 404, 10), '男性')).toBe('worse')
    expect(judgeDirection(MARKERS['睪固酮'], ch(625, 404, 10), '女性')).toBeNull()
  })
  it('男性 SHBG：24.4→38.4 上升 → 變差（綁走游離睪固酮）；38→25 → 變好；30→15 掉到 20 以下 → 變差；女性不判', () => {
    expect(judgeDirection(MARKERS.SHBG, ch(24.4, 38.4, 9.7), '男性')).toBe('worse')
    expect(judgeDirection(MARKERS.SHBG, ch(38, 25, 9.7), '男性')).toBe('better')
    expect(judgeDirection(MARKERS.SHBG, ch(30, 15, 9.7), '男性')).toBe('worse')
    expect(judgeDirection(MARKERS.SHBG, ch(24.4, 38.4, 9.7), '女性')).toBeNull()
  })
  it('越低越好：同半胱胺酸 15→9 → 變好；三酸甘油酯 34→63 都在很好範圍 → 不判；80→150 → 變差', () => {
    expect(judgeDirection(MARKERS['同半胱胺酸'], ch(15, 9, 8.3))).toBe('better')
    expect(judgeDirection(MARKERS['三酸甘油酯'], ch(34, 63, 19.9))).toBeNull()
    expect(judgeDirection(MARKERS['三酸甘油酯'], ch(80, 150, 19.9))).toBe('worse')
  })
  it('維生素D 34→59 往最佳範圍走 → 變好；在波動內 → null', () => {
    expect(judgeDirection(MARKERS['維生素D'], ch(34, 59, 7.1))).toBe('better')
    expect(judgeDirection(MARKERS['維生素D'], ch(50, 52, 7.1))).toBeNull()
  })
})

import { cviFor } from '@/lib/longevity-lens'
describe('依性別取正常波動（PubMed 查證，2026-09-25）', () => {
  it('SHBG 男性 6.6、女性沒分開存 → 用整體 7.4；尿酸男 7.7／女 9.2', () => {
    expect(cviFor(MARKERS.SHBG, '男性')).toBe(6.6)
    expect(cviFor(MARKERS.SHBG, '女性')).toBe(7.4)
    expect(cviFor(MARKERS['尿酸'], '女性')).toBe(9.2)
  })
  it('男性 SHBG 38.4→30（−22%）超過男性的 ±20% 波動 → 算真的在變', () => {
    const s = buildMarkerStory('SHBG', [{ date: '2026-03-20', value: 38.4 }, { date: '2026-09-26', value: 30 }], empty, '2026-09-27', '男性')
    expect(s.change?.verdict).toBe('real_down')
  })
})
