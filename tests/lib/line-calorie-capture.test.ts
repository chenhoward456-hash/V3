import { describe, it, expect } from 'vitest'
import {
  parseCalorieNumber,
  CALORIES_MIN,
  CALORIES_MAX,
  BARE_CALORIES_MIN,
  validateNL,
  classifyCalorieInput,
  bareNumberIsCalories,
} from '@/lib/line-nl-log'
import { calorieQuickReplies } from '@/lib/line-handlers'

/**
 * 熱量回報接口。
 *
 * 起因是真實事故：Sean 2026-08-31 在 LINE 上按完「未達標」之後自己打了
 * 「大概多1.200大卡」「200大卡 多吃」，系統一句都沒接住，只存了 compliant=false，
 * 然後他回了「多吃啦幹你娘」。從此再也沒記過飲食數字。
 *
 * 所以這組測試守的是兩件事：
 *   1. 學員**主動給**的數字要進得來（含他實際打過的怪寫法）
 *   2. 拿不準的數字**寧可不寫** —— 這個值會餵進 TDEE 引擎去改他的熱量處方
 */

describe('parseCalorieNumber：真實輸入不是理想輸入', () => {
  it('一般寫法', () => {
    expect(parseCalorieNumber('2200')).toBe(2200)
    expect(parseCalorieNumber('2,200')).toBe(2200)
    expect(parseCalorieNumber('2200.5')).toBe(2200.5)
  })

  it('「1.200」是千分位打成點，不是 1.2 大卡 —— Sean 實際打過', () => {
    expect(parseCalorieNumber('1.200')).toBe(1200)
    expect(parseCalorieNumber('2.500')).toBe(2500)
  })

  it('但真正的小數不要被誤判成千分位', () => {
    // 兩位以內 + 點 + 剛好三位 才算千分位；其餘照常
    expect(parseCalorieNumber('1.2')).toBe(1.2)
    expect(parseCalorieNumber('1.25')).toBe(1.25)
    expect(parseCalorieNumber('1.2005')).toBe(1.2005)
  })

  it('全形逗號、空白都要清掉', () => {
    expect(parseCalorieNumber('2，200')).toBe(2200)
    expect(parseCalorieNumber(' 2200 ')).toBe(2200)
  })

  it('解不出來回 null，不要回 NaN 讓它一路流進 DB', () => {
    expect(parseCalorieNumber('abc')).toBeNull()
    expect(parseCalorieNumber('')).toBeNull()
    expect(parseCalorieNumber('..')).toBeNull()
  })
})

describe('裸數字的下界：猜錯比沒記到貴', () => {
  it('BARE_CALORIES_MIN 明顯高於 CALORIES_MIN', () => {
    // 200–800 之間的裸數字可能是水量 ml / 蛋白 g / 單餐熱量。
    // 這段刻意不猜，交給自然語言那層去問。
    expect(BARE_CALORIES_MIN).toBeGreaterThan(CALORIES_MIN)
    expect(BARE_CALORIES_MIN).toBe(800)
  })

  it('體重區間(30–200)完全不重疊 —— webhook 靠這個先後順序分流', () => {
    expect(BARE_CALORIES_MIN).toBeGreaterThan(200)
  })
})

describe('calorieQuickReplies：選項要長得像他自己的目標', () => {
  it('用學員的 calories_target 生 ±400 三檔 + 跳過', () => {
    const items = calorieQuickReplies(2250)
    expect(items).toHaveLength(4)
    expect(items.map(i => i.action.text)).toEqual([
      '熱量 1900', '熱量 2300', '熱量 2700', '跳過熱量',
    ])
  })

  it('沒設目標 → 通用級距，不要噴錯也不要給 NaN', () => {
    const texts = calorieQuickReplies(null).map(i => i.action.text)
    expect(texts).toEqual(['熱量 1600', '熱量 2000', '熱量 2400', '跳過熱量'])
    expect(texts.join()).not.toContain('NaN')
  })

  it('荒謬的 target 不要照抄（退回通用級距）', () => {
    expect(calorieQuickReplies(99).map(i => i.action.text)[1]).toBe('熱量 2000')
    expect(calorieQuickReplies(99999).map(i => i.action.text)[1]).toBe('熱量 2000')
  })

  it('每個選項都在可寫入範圍內', () => {
    for (const target of [1200, 2000, 3500, 5000, null]) {
      for (const i of calorieQuickReplies(target)) {
        const m = i.action.text.match(/^熱量 (\d+)$/)
        if (!m) continue
        const n = Number(m[1])
        expect(n).toBeGreaterThanOrEqual(CALORIES_MIN)
        expect(n).toBeLessThanOrEqual(CALORIES_MAX)
      }
    }
  })

  it('一定有跳過 —— 逼他填會讓他乾脆整個不記', () => {
    expect(calorieQuickReplies(2250).at(-1)!.action.text).toBe('跳過熱量')
  })
})

describe('validateNL 跟著用同一組常數（紅線 6：一處真相）', () => {
  it('範圍內收', () => {
    expect(validateNL({ nutrition: { calories: CALORIES_MIN } }).nutrition?.calories).toBe(CALORIES_MIN)
    expect(validateNL({ nutrition: { calories: CALORIES_MAX } }).nutrition?.calories).toBe(CALORIES_MAX)
  })

  it('範圍外整個丟掉，不夾到邊界', () => {
    expect(validateNL({ nutrition: { calories: CALORIES_MIN - 1 } }).nutrition).toBeUndefined()
    expect(validateNL({ nutrition: { calories: CALORIES_MAX + 1 } }).nutrition).toBeUndefined()
  })
})

describe('classifyCalorieInput：分流決定要不要寫 DB', () => {
  it('絕對值 → 寫得進去', () => {
    const cases: Array<[string, number]> = [
      ['熱量 2200', 2200],
      ['熱量2200', 2200],
      ['卡路里 1800', 1800],
      ['2200大卡', 2200],
      ['2200 kcal', 2200],
      ['2,200大卡', 2200],
    ]
    for (const [text, cal] of cases) {
      expect(classifyCalorieInput(text), text).toEqual({ kind: 'absolute', calories: cal })
    }
  })

  it('🚨 差值一律反問，絕對不能當總量寫 —— Sean 8/31 實際打的兩句', () => {
    expect(classifyCalorieInput('大概多1.200大卡')).toEqual({ kind: 'delta' })
    expect(classifyCalorieInput('200大卡 多吃')).toEqual({ kind: 'delta' })
    expect(classifyCalorieInput('少吃了300卡')).toEqual({ kind: 'delta' })
    expect(classifyCalorieInput('超過500大卡')).toEqual({ kind: 'delta' })
  })

  it('差值判斷要排在絕對值前面 —— 順序反了「多1.200大卡」會被寫成當日 1200', () => {
    const r = classifyCalorieInput('大概多1.200大卡')
    expect(r?.kind).not.toBe('absolute')
  })

  it('跳過', () => {
    expect(classifyCalorieInput('跳過熱量')).toEqual({ kind: 'skip' })
  })

  it('跟熱量無關 → null，交還給後面的分支（不能吃掉既有指令）', () => {
    for (const t of [
      '達標', '未達標', '記飲食', '記訓練', '狀態', '趨勢',
      '82.8', '體重 82.8', '水 500', '蛋白 180',
      '訓練 推', '訓練完成 push 45', '睡眠 3', '身心 3 3 3',
      '教練我下週可以改課表嗎', '午餐 雞腿便當',
    ]) {
      expect(classifyCalorieInput(t), t).toBeNull()
    }
  })
})

describe('bareNumberIsCalories：裸數字分流', () => {
  it('明顯是一天總熱量的量級 → 收', () => {
    expect(bareNumberIsCalories('2200')).toBe(2200)
    expect(bareNumberIsCalories('800')).toBe(800)
    expect(bareNumberIsCalories('10000')).toBe(10000)
  })

  it('🚨 不能跟體重打架 —— 30~200 全部不收（webhook 更早的分支要拿去記體重）', () => {
    for (const w of ['82', '85.7', '90', '150', '200']) {
      expect(bareNumberIsCalories(w), w).toBeNull()
    }
  })

  it('200~800 的模糊地帶不猜（可能是水量 ml / 蛋白 g / 單餐）', () => {
    for (const n of ['201', '300', '500', '799']) {
      expect(bareNumberIsCalories(n), n).toBeNull()
    }
  })

  it('超出可寫入上限不收', () => {
    expect(bareNumberIsCalories('10001')).toBeNull()
    expect(bareNumberIsCalories('99999')).toBeNull()
  })

  it('不是純數字不收', () => {
    for (const t of ['2200大卡', '熱量 2200', 'abc', '22.00']) {
      expect(bareNumberIsCalories(t), t).toBeNull()
    }
  })
})
