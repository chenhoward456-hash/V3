import { describe, it, expect } from 'vitest'
import { assessAttendance, assessBatch, needsAction } from '@/lib/attendance-risk'

const TODAY = new Date('2026-08-21T00:00:00Z')

/** 產生固定間隔的上課日期 */
function series(start: string, count: number, gapDays: number) {
  const t0 = new Date(start + 'T00:00:00').getTime()
  return Array.from({ length: count }, (_, i) =>
    new Date(t0 + i * gapDays * 86_400_000).toISOString().slice(0, 10),
  ).join('\n')
}

describe('實體課出席風險（Howard：「買五十堂上不到一半就消失」）', () => {
  it('節奏穩定 → ok', () => {
    // 一週兩次，最後一次是三天前
    const r = assessAttendance(series('2026-06-01', 24, 3.5) + '\n2026-08-18', TODAY)!
    expect(r.level).toBe('ok')
    expect(r.daysSinceLast).toBeLessThan(7)
  })

  it('⭐ 間隔開始拉長 → watch（「開始忙了」就是從這裡開始的）', () => {
    // 前面每 3 天一次，後面變成每 8 天
    const early = series('2026-05-01', 14, 3)
    const late = ['2026-06-20', '2026-06-28', '2026-07-06', '2026-07-15'].join('\n')
    const r = assessAttendance(early + '\n' + late, new Date('2026-07-18T00:00:00Z'))!
    expect(r.level).toBe('watch')
    expect(r.summary).toContain('節奏在變慢')
    expect(r.action).toContain('主動約下一堂')
  })

  it('⭐ 超過平常間隔 2.5 倍 → alert，而且要講「現在打給他」', () => {
    // 平常每 4 天一次，最後一堂 8/09 之後就沒來了（距今 12 天 = 3 倍）
    // ⚠️ series 產生的日期會排序，所以尾端日期要算過 —— 15 堂 ×4 天從 6/01 起 = 到 7/27
    const r = assessAttendance(series('2026-06-01', 15, 4) + '\n2026-08-09', TODAY)!
    expect(r.level).toBe('alert')
    expect(r.action).toContain('現在打給他')
    expect(r.action).toContain('分界點')
  })

  it('已經很久沒來 → gone，建議改用電話且先別提課', () => {
    const r = assessAttendance(series('2026-04-01', 20, 3.5) + '\n2026-06-20', TODAY)!
    expect(r.level).toBe('gone')
    expect(r.action).toContain('電話')
    expect(r.action).toContain('先別提課')
    expect(r.action).toContain('生活變忙')
  })

  it('用中位數不用平均 —— 一次出國造成的長間隔不該把基準線拉歪', () => {
    // 每 3 天一次，但中間有一次隔了 30 天（出國）
    const dates = ['2026-07-01', '2026-07-04', '2026-07-07', '2026-08-06', '2026-08-09', '2026-08-12', '2026-08-15', '2026-08-18']
    const r = assessAttendance(dates.join('\n'), TODAY)!
    expect(r.baselineGapDays!).toBeLessThan(10)   // 平均會被拉到 ~9，中位數是 3
  })

  it('接受多種日期格式（教練從行事曆複製貼上不會統一）', () => {
    const r = assessAttendance('2026-08-01, 2026/8/5\n8/9  2026-08-13', TODAY)!
    expect(r.sessions).toBe(4)
    expect(r.lastDate).toBe('2026-08-13')
  })

  it('重複的日期只算一次', () => {
    const r = assessAttendance('2026-08-01\n2026-08-01\n2026-08-05', TODAY)!
    expect(r.sessions).toBe(2)
  })

  it('空輸入或無效格式 → null，不硬猜', () => {
    expect(assessAttendance('', TODAY)).toBeNull()
    expect(assessAttendance('上週三 上上週', TODAY)).toBeNull()
  })

  it('只有一堂課也能給出「距今幾天」，不會爆', () => {
    const r = assessAttendance('2026-08-01', TODAY)!
    expect(r.sessions).toBe(1)
    expect(r.daysSinceLast).toBe(20)
    expect(r.baselineGapDays).toBeNull()
  })
})

describe('模擬時抓到的兩個判準問題（2026-08-21）', () => {
  it('⭐ 買 50 堂的人，早期訊號不能被稀釋', () => {
    // 前 16 堂一週兩次，接著 3 堂變成一週一次 —— 這時候就該提醒了。
    // 舊版用「後 1/3」當最近，堂數多的時候會被前面的密集紀錄稀釋而判 OK。
    const dense = Array.from({ length: 16 }, (_, i) =>
      new Date(new Date('2026-03-02').getTime() + i * 3.5 * 86_400_000).toISOString().slice(0, 10))
    const slower = ['2026-05-04', '2026-05-11', '2026-05-18']
    const r = assessAttendance([...dense, ...slower].join('\n'), new Date('2026-05-21T00:00:00Z'))!
    expect(r.level).toBe('watch')
    expect(r.summary).toContain('節奏在變慢')
  })

  it('⭐ 一週兩次的人斷 13 天不該判成「已經斷了」', () => {
    // 純看倍數的話 13/3 > 4 會判 gone，教練就放棄得太早。
    // gone 另外要求至少 21 天。
    const dates = Array.from({ length: 20 }, (_, i) =>
      new Date(new Date('2026-05-01').getTime() + i * 3.5 * 86_400_000).toISOString().slice(0, 10))
    const last = new Date(dates[dates.length - 1] + 'T00:00:00')
    const r = assessAttendance(dates.join('\n'), new Date(last.getTime() + 13 * 86_400_000))!
    expect(r.level).toBe('alert')     // 不是 gone
    expect(r.action).toContain('現在打給他')
  })

  it('同一個人斷超過三週才算 gone', () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      new Date(new Date('2026-05-01').getTime() + i * 3.5 * 86_400_000).toISOString().slice(0, 10))
    const last = new Date(dates[dates.length - 1] + 'T00:00:00')
    const r = assessAttendance(dates.join('\n'), new Date(last.getTime() + 25 * 86_400_000))!
    expect(r.level).toBe('gone')
  })
})

describe('批次分流（教練一天六堂課，沒空一個一個查）', () => {
  const INPUT = `王小明
2026-06-02, 2026-06-05, 2026-06-09, 2026-06-12, 2026-06-16, 2026-06-19
2026-06-23, 2026-06-26, 2026-07-01, 2026-07-08, 2026-07-22

李小華
2026-07-15, 2026-07-18, 2026-07-22, 2026-07-25, 2026-07-29
2026-08-01, 2026-08-05, 2026-08-08, 2026-08-12, 2026-08-15, 2026-08-19

陳大文
2026-05-06, 2026-05-13, 2026-05-20, 2026-05-27, 2026-06-03, 2026-06-10`

  it('⭐ 該顧的排最前面，正常的沉到後面', () => {
    const rows = assessBatch(INPUT, TODAY)
    expect(rows).toHaveLength(3)
    expect(rows[0].name).not.toBe('李小華')          // 李小華節奏正常
    expect(rows[rows.length - 1].name).toBe('李小華')
  })

  it('needsAction 只留下要處理的 —— 那才是教練要看的清單', () => {
    const todo = needsAction(assessBatch(INPUT, TODAY))
    expect(todo.length).toBeLessThan(3)
    expect(todo.every(r => r.risk.level !== 'ok')).toBe(true)
  })

  it('alert 排在 gone 前面（還救得回來的優先，不是最嚴重的優先）', () => {
    const rows = assessBatch(INPUT, TODAY)
    const iAlert = rows.findIndex(r => r.risk.level === 'alert')
    const iGone = rows.findIndex(r => r.risk.level === 'gone')
    if (iAlert >= 0 && iGone >= 0) expect(iAlert).toBeLessThan(iGone)
  })

  it('格式寬鬆：名字後面接逗號、日期跨多行都讀得懂', () => {
    const rows = assessBatch('張三：\n2026-08-01, 2026-08-05\n2026-08-09', TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('張三')
    expect(rows[0].risk.sessions).toBe(3)
  })

  it('沒有名字的資料不會炸，歸到「未命名」', () => {
    const rows = assessBatch('2026-08-01\n2026-08-05\n2026-08-09', TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('（未命名）')
  })

  it('只有名字沒日期的人會被略過，不佔清單', () => {
    const rows = assessBatch('王小明\n李小華\n2026-08-01, 2026-08-05, 2026-08-09', TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('李小華')
  })
})
