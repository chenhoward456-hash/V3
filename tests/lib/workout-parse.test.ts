import { describe, it, expect } from 'vitest'
import { parseWorkout, normalizeLine, splitLines, toSetRows, MAX_PLAUSIBLE_SETS } from '@/lib/workout-parse'
import { actualVolume } from '@/lib/volume-audit'

/**
 * ⭐ 這組測試的 fixture **全部是真的** —— 2026-09 五份外部教練手寫的課表原文，
 *    一個字都沒改（Temu、Oreo、AJ、Roy、以及一份 Hank 帶的）。
 *    理由：parser 的價值就在「吃得下真實世界的亂寫」，
 *    用我自己編的乾淨輸入去測等於沒測。
 */

describe('normalizeLine', () => {
  it('全形轉半形、各種乘號統一', () => {
    expect(normalizeLine('３組')).toBe('3組')
    expect(normalizeLine('12下 × 4')).toBe('12下 x 4')
    expect(normalizeLine('45×1×10')).toBe('45x1x10')
    expect(normalizeLine('8～10下')).toBe('8~10下')
  })
})

describe('真課表 ①：Temu（星號分隔、單邊次數）', () => {
  const TEXT = `背/二頭/腹
正握俯身划船*8*3
剪刀下拉*10*2
反手單邊划船*10/10*2
直臂下壓*12*2
繩索錘式二頭*12*2
W槓二頭彎舉*12*2
啞鈴側平舉*12*2`

  it('七個動作全部抓到，組數正確', () => {
    const r = parseWorkout(TEXT)
    expect(r.exercises).toHaveLength(7)
    expect(r.exercises.map((e) => e.sets)).toEqual([3, 2, 2, 2, 2, 2, 2])
  })

  it('⚠️ 單邊次數 10/10 不能被當成組數', () => {
    const e = parseWorkout(TEXT).exercises.find((x) => x.raw.includes('反手單邊'))!
    expect(e.sets).toBe(2)
    expect(e.name).toContain('反手單邊划船')
  })

  it('動作名剝乾淨，可以直接餵給 volume-audit', () => {
    const v = actualVolume(toSetRows(parseWorkout(TEXT).exercises))
    expect(v.unresolved).toEqual([])
    expect(v.total).toBe(15)
  })
})

describe('真課表 ②：Roy（N組 ＋ 次數區間 ＋ 括號註記）', () => {
  const TEXT = `推日：18組 肩6 胸9 手3

DB SP 寬 （主） 3組 8~10下

上斜啞鈴上胸（主）3組 6～10下

機械/啞鈴平胸推（主）  3組 8～10下

下胸推 3組 10下

前平舉 3組 12～15下

三頭伸展  3組 10～12下`

  it('六個動作各 3 組，摘要標題不算進來', () => {
    const r = parseWorkout(TEXT)
    expect(r.exercises).toHaveLength(6)
    expect(r.exercises.every((e) => e.sets === 3)).toBe(true)
    expect(r.exercises.every((e) => e.confidence === 'exact')).toBe(true)
  })

  it('⚠️「推日：18組 肩6 胸9 手3」是摘要不是動作', () => {
    expect(parseWorkout(TEXT).skipped.some((s) => s.includes('推日'))).toBe(true)
  })

  it('⚠️ 次數區間 8~10 不能被當成組數', () => {
    const e = parseWorkout(TEXT).exercises[0]
    expect(e.sets).toBe(3)
    expect(e.name).not.toMatch(/\d/)
  })

  it('括號註記（主）要剝掉', () => {
    expect(parseWorkout(TEXT).exercises[1].name).not.toContain('主')
  })
})

describe('真課表 ③：AJ（下x組）', () => {
  const TEXT = `平胸推6下x4
肩推6下x2
上胸6下x3
下胸8下x2
側平舉10下x3
三頭12下x3`

  it('「6下x4」的組數是 4 不是 6', () => {
    const r = parseWorkout(TEXT)
    expect(r.exercises.map((e) => e.sets)).toEqual([4, 2, 3, 2, 3, 3])
    expect(r.exercises.every((e) => e.rule === '下x組')).toBe(true)
  })
})

describe('真課表 ④：Oreo（頓號分隔一行多動作 ＋ 行尾孤立數）', () => {
  const TEXT = `D1:下肢/21組
腿推 3、前蹲 3、SA Lunge 3、SA DB RDL 3、羅馬椅 3、腿伸 3、提踵 3`

  it('頓號分隔要拆成七個動作', () => {
    const r = parseWorkout(TEXT)
    expect(r.exercises).toHaveLength(7)
    expect(r.exercises.every((e) => e.sets === 3)).toBe(true)
  })

  it('⚠️ 這種只有孤立數字的要標 guess，讓人看得到能改', () => {
    expect(parseWorkout(TEXT).exercises.every((e) => e.confidence === 'guess')).toBe(true)
  })

  it('⚠️ 純列舉（沒帶數字）不可以被拆開', () => {
    // 這是第五份課表的寫法：動作列舉在一行，組數寫在下一行
    expect(splitLines('深蹲、腿推機、腿屈伸')).toEqual(['深蹲、腿推機、腿屈伸'])
  })
})

describe('⛔ 踩過的坑：三個數字的寫法', () => {
  // ⛔ 健身圈兩種順序都有用，不能寫死取中間：
  //      45x1x10  （Howard 的課表）→ 45kg、1 組、10 次
  //      100x5x3  （LINE 既有教學）→ 100kg、5 次、3 組
  //    所以後兩個數取較小的當組數 —— 組數通常個位數、次數通常更大。
  it('三數字：重量 × (組/次)，取較小的當組數', () => {
    expect(parseWorkout('六角槓硬舉 45×1×10').exercises[0].sets).toBe(1)
    expect(parseWorkout('深蹲 100x5x3').exercises[0].sets).toBe(3)
    expect(parseWorkout('臥推 80x8x4').exercises[0].sets).toBe(4)
    expect(parseWorkout('六角槓硬舉 45×1×10').exercises[0].rule).toBe('重量x(組/次)')
  })
  it('⚠️ 後兩個一樣大就分不出來，標 guess', () => {
    const e = parseWorkout('深蹲 100x8x8').exercises[0]
    expect(e.sets).toBe(8)
    expect(e.confidence).toBe('guess')
  })
  it('重量尾巴不算組數', () => {
    const e = parseWorkout('Swing 20kg 15下x3').exercises[0]
    expect(e.sets).toBe(3)
    expect(e.name.toLowerCase()).toContain('swing')
  })
  it('行首器材編號要剝掉', () => {
    const e = parseWorkout('26機械肩膀 12下x3').exercises[0]
    expect(e.name).toBe('機械肩膀')
    expect(e.sets).toBe(3)
  })
})

describe('兩數歧義：組數小、次數大', () => {
  it('8x3 → 3 組（取小的）', () => {
    expect(parseWorkout('深蹲 8x3').exercises[0].sets).toBe(3)
  })
  it('3x8 → 3 組（順序反過來也一樣）', () => {
    expect(parseWorkout('深蹲 3x8').exercises[0].sets).toBe(3)
  })
  it('⚠️ 4x4 分不出來，要標 guess', () => {
    const e = parseWorkout('深蹲 4x4').exercises[0]
    expect(e.sets).toBe(4)
    expect(e.confidence).toBe('guess')
  })
  it(`⚠️ 兩個都大於 ${MAX_PLAUSIBLE_SETS} 時夾住上限並標 guess`, () => {
    const e = parseWorkout('深蹲 12x15').exercises[0]
    expect(e.confidence).toBe('guess')
    expect(e.sets).toBeLessThanOrEqual(MAX_PLAUSIBLE_SETS)
  })
})

describe('不是動作的行要跳過', () => {
  it.each([
    '共80組',
    '----------------------------------------',
    '# 這是註解',
    '> 引言',
    '目標：整體肩補強',
    '天數：4',
    '拉日：18組 背9 側6 後3',
  ])('%s', (line) => {
    const r = parseWorkout(line)
    expect(r.exercises).toHaveLength(0)
    expect(r.skipped).toContain(line)
  })

  it('沒有任何數字的行也跳過（可能是說明）', () => {
    const r = parseWorkout('主動作以三角肌佔比去調整，胸部維持訓練')
    expect(r.exercises).toHaveLength(0)
  })
})

describe('接到 volume-audit：端到端', () => {
  it('貼一份完整的推日，算得出部位組數', () => {
    const { exercises } = parseWorkout(`DB SP 寬 3組
上斜啞鈴臥推 3組
機械胸推 3組
側平舉 3組
反向飛鳥 3組
三頭下壓 3組`)
    const v = actualVolume(toSetRows(exercises))
    expect(v.unresolved).toEqual([])
    expect(v.byMuscle.delts_side).toBe(3)
    expect(v.byMuscle.delts_rear).toBe(3)   // ⚠️ 反向飛鳥是後束不是中束
    expect(v.byMuscle.chest).toBe(6)
    expect(v.total).toBe(18)
  })
})
