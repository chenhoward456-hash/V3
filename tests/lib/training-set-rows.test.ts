import { describe, it, expect } from 'vitest'
import { groupSetRows, expandSetRows } from '@/lib/training-set-rows'

// 稽核 D5：金字塔／遞減組回表單再存，不可被壓成第一組的重量次數
describe('groupSetRows / expandSetRows', () => {
  const pyramid = [
    { exercise_name: '史密斯胸推', set_number: 1, weight: 20, reps: 10, rpe: 7 },
    { exercise_name: '史密斯胸推', set_number: 2, weight: 25, reps: 8, rpe: 8 },
    { exercise_name: '史密斯胸推', set_number: 3, weight: 30, reps: 6, rpe: 9 },
  ]

  it('keeps each distinct weight/reps as its own form row', () => {
    const rows = groupSetRows(pyramid)
    expect(rows.map(r => [r.weight, r.reps, r.num_sets])).toEqual([[20, 10, 1], [25, 8, 1], [30, 6, 1]])
  })

  it('round-trips a pyramid without losing data', () => {
    const out = expandSetRows(groupSetRows(pyramid))
    expect(out.map(r => [r.set_number, r.weight, r.reps, r.rpe])).toEqual([
      [1, 20, 10, 7], [2, 25, 8, 8], [3, 30, 6, 9],
    ])
  })

  it('merges consecutive identical sets into one row with num_sets', () => {
    const rows = groupSetRows([
      { exercise_name: '深蹲', set_number: 1, weight: 100, reps: 5, rpe: null },
      { exercise_name: '深蹲', set_number: 2, weight: 100, reps: 5, rpe: null },
      { exercise_name: '深蹲', set_number: 3, weight: 100, reps: 5, rpe: null },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].num_sets).toBe(3)
  })

  it('numbers set_number continuously per exercise across multiple form rows (no duplicate set 1)', () => {
    const out = expandSetRows([
      { exercise_name: '臥推', muscle_group: '', set_number: 1, num_sets: 2, weight: 60, reps: 8, rpe: null, is_main_lift: true },
      { exercise_name: '划船', muscle_group: '', set_number: 2, num_sets: 1, weight: 40, reps: 10, rpe: null, is_main_lift: false },
      { exercise_name: '臥推', muscle_group: '', set_number: 3, num_sets: 2, weight: 70, reps: 5, rpe: null, is_main_lift: true },
    ])
    const bench = out.filter(r => r.exercise_name === '臥推').map(r => r.set_number)
    expect(bench).toEqual([1, 2, 3, 4])
    expect(out.find(r => r.exercise_name === '划船')?.set_number).toBe(1)
  })

  it('handles unordered DB rows (sorted by set_number across exercises)', () => {
    const rows = groupSetRows([
      { exercise_name: 'A', set_number: 1, weight: 10, reps: 10 },
      { exercise_name: 'B', set_number: 1, weight: 5, reps: 12 },
      { exercise_name: 'A', set_number: 2, weight: 12, reps: 8 },
    ])
    expect(rows.map(r => [r.exercise_name, r.weight])).toEqual([['A', 10], ['A', 12], ['B', 5]])
  })
})
