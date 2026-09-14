import { describe, it, expect } from 'vitest'
import { TOTAL_TESTOSTERONE_KEYWORDS, TOTAL_TESTOSTERONE_EXCLUDE } from '@/utils/labMatch'

/**
 * 「總睪固酮」的抓法。
 *
 * ⚠️ 這條規則擋的是一個有實際後果的 bug（2026-09-14）：
 * nutrition-engine 的排除清單有英文 `bioavailable`、**沒有中文「生物可利用」**，
 * 於是「生物可利用睪固酮 182」被當成總睪固酮讀進減脂安全閘門，
 * 判陳胤豪「🔴 睪固酮極低（182 ng/dL，安全值 ≥400）— 不適合減脂」天天擋掉調整。
 * 他的總睪固酮其實是 403.92。182 的總睪固酮是臨床性腺功能低下，
 * 182 的生物可利用是完全不同的尺標 —— 讀錯一個字，判斷整個翻掉。
 */

// 兩支引擎共用的比對方式：小寫子字串
const matches = (testName: string) => {
  const n = testName.toLowerCase()
  if (!TOTAL_TESTOSTERONE_KEYWORDS.some(k => n.includes(k))) return false
  return !TOTAL_TESTOSTERONE_EXCLUDE.some(ex => n.includes(ex))
}

describe('總睪固酮關鍵字', () => {
  it('抓得到總睪固酮', () => {
    for (const n of ['睪固酮', '總睪固酮', 'Testosterone', 'Total Testosterone', '睪酮']) {
      expect(matches(n), n).toBe(true)
    }
  })

  it('🚨 生物可利用睪固酮絕對不可以被當成總睪固酮', () => {
    // 這就是實際踩到的那一筆（陳胤豪 2026-03-20，值 182）
    expect(matches('生物可利用睪固酮')).toBe(false)
    expect(matches('Bioavailable Testosterone')).toBe(false)
    expect(matches('bioavailable testosterone')).toBe(false)
  })

  it('游離睪固酮也不可以', () => {
    expect(matches('游離睪固酮')).toBe(false)
    expect(matches('Free Testosterone')).toBe(false)
  })

  it('排除清單中英文都要有 —— 缺哪一邊都會漏', () => {
    expect(TOTAL_TESTOSTERONE_EXCLUDE).toContain('生物可利用')
    expect(TOTAL_TESTOSTERONE_EXCLUDE).toContain('bioavailable')
    expect(TOTAL_TESTOSTERONE_EXCLUDE).toContain('游離')
    expect(TOTAL_TESTOSTERONE_EXCLUDE).toContain('free')
  })

  it('不相關的指標不要誤抓', () => {
    for (const n of ['SHBG', '雌二醇', '白蛋白', 'DHEA-S']) expect(matches(n), n).toBe(false)
  })
})
