import { describe, it, expect } from 'vitest'
import { formatStackAlert } from '@/lib/supplement-alerts'

describe('formatStackAlert', () => {
  it('沒有要注意／沒依據 → null（不洗版）', () => {
    expect(formatStackAlert('A', [{ name: '鎂', dose: '', status: 'lifestyle', basis: 'x', effect: null }], 't')).toBeNull()
  })
  it('有 → 分兩段列出', () => {
    const t = formatStackAlert('陳胤豪', [
      { name: '維生素C', dose: '', status: 'caution', basis: '鐵蛋白高', effect: null },
      { name: '鋅', dose: '', status: 'no-indication', basis: '沒依據', effect: null },
    ], '新血檢上傳後')!
    expect(t).toMatch(/要注意：\n・維生素C：鐵蛋白高/)
    expect(t).toMatch(/血檢看不出需要：\n・鋅：沒依據/)
  })
})
