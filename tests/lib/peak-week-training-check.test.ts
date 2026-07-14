import { describe, it, expect } from 'vitest'
import {
  checkPeakWeekTrainingConflicts,
  formatPeakTrainingConflict,
  PEAK_WEEK_DAMAGING_PATTERNS,
} from '@/lib/peak-week-training-check'

/**
 * 真實案例（2026-07 Howard 備賽）：
 * 學員的週四是 Legs Day（槓鈴硬舉 + 哈克深蹲），而 7/23(週四) 剛好是賽前 3 天。
 * 系統原本抓不到這個衝突——training_plan 和 peak week 計畫是兩套資料，沒人在比對。
 * 結果：肌肉損傷會損害之後 3 天的儲糖（充碳白做一半），賽日還要站著 posing 一整天。
 */

// 週一 Push / 週二 Pull / 週四 Legs（硬舉+哈克深蹲）/ 週五 Upper
const HOWARD_PLAN = {
  name: '訓練計畫',
  days: [
    { dayOfWeek: 1, label: 'Push Day', exercises: [{ name: '槓鈴臥推' }, { name: '坐姿啞鈴肩推' }] },
    { dayOfWeek: 2, label: 'Pull Day', exercises: [{ name: 'hammer划船' }, { name: '引體向上' }] },
    { dayOfWeek: 4, label: 'Legs Day', exercises: [{ name: '槓鈴硬舉' }, { name: '哈克深蹲' }, { name: '腿推機' }] },
    { dayOfWeek: 5, label: 'Upper Day', exercises: [{ name: '上斜Hammer臥推' }, { name: '側平舉' }] },
  ],
}

// 2026-07-26(日) 比賽 → 7/23 是週四（賽前 3 天）
const PEAK_DAYS = [
  { date: '2026-07-20', daysOut: 6 },  // 一
  { date: '2026-07-21', daysOut: 5 },  // 二
  { date: '2026-07-22', daysOut: 4 },  // 三
  { date: '2026-07-23', daysOut: 3 },  // 四 ← Legs Day
  { date: '2026-07-24', daysOut: 2 },  // 五
  { date: '2026-07-25', daysOut: 1 },  // 六
  { date: '2026-07-26', daysOut: 0 },  // 日（比賽）
]

describe('Peak Week 訓練衝突檢查', () => {
  it('抓到「賽前 3 天排了硬舉 + 深蹲」（真實案例）', () => {
    const conflicts = checkPeakWeekTrainingConflicts(HOWARD_PLAN, PEAK_DAYS)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].date).toBe('2026-07-23')
    expect(conflicts[0].daysOut).toBe(3)
    expect(conflicts[0].dayLabel).toBe('Legs Day')
    expect(conflicts[0].exercises).toEqual(['槓鈴硬舉', '哈克深蹲'])
    expect(conflicts[0].reasons).toContain('硬舉')
    expect(conflicts[0].reasons).toContain('深蹲')
  })

  it('警告句要講清楚「為什麼」和「改成什麼」', () => {
    const [c] = checkPeakWeekTrainingConflicts(HOWARD_PLAN, PEAK_DAYS)
    const msg = formatPeakTrainingConflict(c)

    expect(msg).toContain('賽前 3 天')
    expect(msg).toContain('Legs Day')
    expect(msg).toContain('槓鈴硬舉')
    expect(msg).toContain('肝醣儲存')   // 為什麼有害
    expect(msg).toContain('腿推')       // 改成什麼
  })

  it('不含損傷動作的課表 → 零誤報', () => {
    const safePlan = {
      days: [
        { dayOfWeek: 4, label: 'Legs (machine)', exercises: [{ name: '腿推機' }, { name: '腿彎舉（坐姿）' }, { name: '提踵' }] },
      ],
    }
    expect(checkPeakWeekTrainingConflicts(safePlan, PEAK_DAYS)).toHaveLength(0)
  })

  it('Helms 明確點名的三個動作都要抓到（RDL / 早安 / 深飛鳥）', () => {
    const plan = {
      days: [{ dayOfWeek: 4, exercises: [{ name: '羅馬尼亞硬舉' }, { name: '早安式' }, { name: '啞鈴飛鳥' }] }],
    }
    const [c] = checkPeakWeekTrainingConflicts(plan, PEAK_DAYS)
    expect(c.exercises).toHaveLength(3)
    expect(c.reasons).toEqual(expect.arrayContaining(['羅馬尼亞硬舉', '早安', '飛鳥']))
  })

  it('英文動作名也要抓（RDL / deadlift / squat）', () => {
    const plan = {
      days: [{ dayOfWeek: 4, exercises: [{ name: 'Barbell Deadlift' }, { name: 'Back Squat' }, { name: 'RDL' }] }],
    }
    const [c] = checkPeakWeekTrainingConflicts(plan, PEAK_DAYS)
    expect(c.exercises).toHaveLength(3)
  })

  it('越接近比賽的衝突排越前面（嚴重度）', () => {
    const plan = {
      days: [
        { dayOfWeek: 1, label: '週一', exercises: [{ name: '深蹲' }] },   // 7/20, daysOut 6
        { dayOfWeek: 4, label: '週四', exercises: [{ name: '硬舉' }] },   // 7/23, daysOut 3
      ],
    }
    const conflicts = checkPeakWeekTrainingConflicts(plan, PEAK_DAYS)
    expect(conflicts.map(c => c.daysOut)).toEqual([3, 6])
  })

  it('沒有課表 / 沒有 peak 日 → 回空陣列，不炸', () => {
    expect(checkPeakWeekTrainingConflicts(null, PEAK_DAYS)).toEqual([])
    expect(checkPeakWeekTrainingConflicts(undefined, PEAK_DAYS)).toEqual([])
    expect(checkPeakWeekTrainingConflicts(HOWARD_PLAN, [])).toEqual([])
    expect(checkPeakWeekTrainingConflicts({ days: [] }, PEAK_DAYS)).toEqual([])
  })

  it('週日的 dayOfWeek 對應正確（課表用 7=週日，JS 用 0=週日）', () => {
    const plan = { days: [{ dayOfWeek: 7, label: '週日', exercises: [{ name: '深蹲' }] }] }
    const conflicts = checkPeakWeekTrainingConflicts(plan, PEAK_DAYS)
    // 2026-07-26 是週日（比賽日）
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].date).toBe('2026-07-26')
    expect(conflicts[0].daysOut).toBe(0)
  })

  it('損傷動作清單本身要有內容（防止有人手滑清空）', () => {
    expect(PEAK_WEEK_DAMAGING_PATTERNS.length).toBeGreaterThanOrEqual(5)
    expect(PEAK_WEEK_DAMAGING_PATTERNS.every(p => p.pattern instanceof RegExp && p.label && p.why)).toBe(true)
  })
})
