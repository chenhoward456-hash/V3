import { describe, it, expect } from 'vitest'
import { computeWeeklyCoachingDraft, SET_LOG_MIN_DAYS, PATTERN_COVERAGE_ALERT } from '@/lib/weekly-coaching'

/**
 * 週訊的訓練段 —— 分寸比內容重要。
 *
 * ⚠️ 2026-09-23 查 production：四個活躍學員裡**三個的組數覆蓋率是 0%**
 *    （林宥任 60%）。在那個覆蓋率下講「你少做了 X 組」會冤枉人，
 *    而冤枉一次就再也拿不回來（Sean 2026-08-31 之後一個月沒記飲食）。
 *
 * 所以這組測試守的是「什麼時候**不能**講」，不是「講得多好」。
 */
const DAYS = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse('2026-09-23T00:00:00Z') - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10))

const base = (o: Partial<Parameters<typeof computeWeeklyCoachingDraft>[0]> = {}) => {
  const d = DAYS(14)
  return {
    client: {
      name: 'Test', goal_type: 'cut', prep_phase: 'off_season',
      competition_date: null, competition_enabled: false,
      target_weight: 75, calories_target: 2200, protein_target: 170,
    },
    weights: d.map((date, i) => ({ date, weight: 80 - i * 0.05 })),
    nutrition: d.map((date) => ({ date, compliant: true, calories: 2200, protein_grams: 170 })),
    training: d.slice(0, 6).map((date) => ({ date, training_type: 'push' })),
    wellness: d.map((date) => ({ date, energy_level: 4 })),
    labs: [],
    now: '2026-09-23',
    ...o,
  }
}

/** 產 n 天、每天同樣動作的組數紀錄 */
const setsFor = (nDays: number, names: string[]) =>
  DAYS(14).slice(-nDays).flatMap((date) => names.flatMap((n) => [{ date, exercise_name: n }]))

describe('⛔ 覆蓋率不夠時不能講掛零', () => {
  it(`只有 ${SET_LOG_MIN_DAYS - 1} 天有記動作 → 說「看不到你練了什麼」，不說某部位 0 組`, () => {
    const d = computeWeeklyCoachingDraft(base({
      trainingSets: setsFor(SET_LOG_MIN_DAYS - 1, ['平板臥推', '引體向上']),
    }))
    expect(d.studentMessage).toContain('沒記下做了哪些動作')
    expect(d.studentMessage).not.toContain('一組都沒有')
    expect(d.bullets.some((b) => b.includes('看不到訓練內容'))).toBe(true)
  })

  it('完全沒有組數紀錄也一樣 —— 不能因為「沒資料」就說他沒練', () => {
    const d = computeWeeklyCoachingDraft(base({ trainingSets: [] }))
    expect(d.studentMessage).not.toContain('一組都沒有')
  })

  it('⚠️ 打卡也很少（<2 天）就什麼都不講 —— 那是流失問題，不是訓練內容問題', () => {
    const d = computeWeeklyCoachingDraft(base({
      training: DAYS(14).slice(0, 1).map((date) => ({ date, training_type: 'push' })),
      trainingSets: [],
    }))
    expect(d.studentMessage).not.toContain('沒記下做了哪些動作')
  })
})

describe(`✅ 覆蓋率夠（≥${SET_LOG_MIN_DAYS} 天）才講掛零`, () => {
  const draft = () => computeWeeklyCoachingDraft(base({
    trainingSets: setsFor(SET_LOG_MIN_DAYS + 1, ['平板臥推', '引體向上', '深蹲']),
  }))

  it('講得出哪個部位掛零', () => {
    const d = draft()
    expect(d.studentMessage).toContain('一組都沒有')
    expect(d.studentMessage).toMatch(/小腿|核心|肩/)
  })

  it('⚠️ 措辭要把前提講出來：是「記錄到的」不是「你沒練」', () => {
    expect(draft().studentMessage).toContain('記錄到的')
  })

  it('⛔ 學員訊息不講失衡 —— 那要知道目標才判得準，是教練的判斷不是他的', () => {
    const d = computeWeeklyCoachingDraft(base({
      trainingSets: setsFor(6, ['側平舉', '側平舉', '側平舉', '反向飛鳥', '深蹲']),
    }))
    expect(d.studentMessage).not.toContain(':')
    expect(d.studentMessage).not.toMatch(/失衡|\d+\.\d+:1/)
  })
})

describe('⭐ 課表健檢不依賴學員記錄', () => {
  const planNoCalves = {
    days: [{ dayOfWeek: 1, label: '全身', exercises: [
      { name: '平板臥推', sets: 4 }, { name: '引體向上', sets: 4 },
      { name: '深蹲', sets: 4 }, { name: '側平舉', sets: 4 },
    ] }],
  }

  it('組數覆蓋率 0 也照樣講得出課表的缺口', () => {
    const d = computeWeeklyCoachingDraft(base({ trainingSets: [], trainingPlan: planNoCalves }))
    expect(d.flags.some((f) => f.startsWith('課表：'))).toBe(true)
    expect(d.flags.join(' ')).toContain('小腿')
  })

  it('沒給課表就不講', () => {
    const d = computeWeeklyCoachingDraft(base({ trainingSets: [] }))
    expect(d.flags.some((f) => f.startsWith('課表：'))).toBe(false)
  })
})

describe(`⚠️ 動作模式只在 ≤${PATTERN_COVERAGE_ALERT}/8 才提`, () => {
  /** 典型健美分化：缺單腳與負重行走 = 6/8，那是常態不是缺陷 */
  const bodybuildingSplit = {
    days: [
      { dayOfWeek: 1, exercises: [{ name: '平板臥推', sets: 4 }, { name: '啞鈴肩推', sets: 4 }, { name: '側平舉', sets: 4 }] },
      { dayOfWeek: 3, exercises: [{ name: '引體向上', sets: 4 }, { name: '坐姿划船', sets: 4 }, { name: '反向飛鳥', sets: 4 }] },
      // ⚠️ 腿日一定要有 hinge（RDL／臀推），不然是 5/8 不是 6/8 ——
      //    第一版 fixture 只放「深蹲＋腿彎舉」，腿彎舉是單關節不算髖鉸鏈。
      { dayOfWeek: 5, exercises: [
        { name: '深蹲', sets: 4 }, { name: '羅馬尼亞硬舉', sets: 4 },
        { name: '腿彎舉', sets: 4 }, { name: '提踵', sets: 4 },
      ] },
    ],
  }

  it('健美分化 6/8 不報 —— 不然每個健美學員每週都收到假警報', () => {
    const d = computeWeeklyCoachingDraft(base({ trainingPlan: bodybuildingSplit }))
    expect(d.bullets.some((b) => b.includes('動作模式'))).toBe(false)
  })

  it('真的缺一半以上才報', () => {
    const thin = { days: [{ dayOfWeek: 1, exercises: [{ name: '平板臥推', sets: 4 }, { name: '側平舉', sets: 4 }] }] }
    const d = computeWeeklyCoachingDraft(base({ trainingPlan: thin }))
    expect(d.bullets.some((b) => b.includes('動作模式'))).toBe(true)
  })
})
