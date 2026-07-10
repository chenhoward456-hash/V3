import { describe, it, expect } from 'vitest'
import { generateLabNutritionAdvice, generateLabOptimizationTips } from '@/lib/lab-nutrition-advisor'
import { scanMedicalCompliance, degradeToSafe } from '@/lib/compliance-scrub'
import { LAB_THRESHOLDS } from '@/utils/labStatus'

/**
 * 醫療合規回歸守門（2026-07-10）
 *
 * 背景：2026-06 合規清洗把疾病名（NAFLD / 甲狀腺功能低下 / 貧血 / PCOS / 痛風…）從引擎輸出移除，
 * 但當時沒有任何測試守住「病名不准回來」——只有一堆斷言「有某個新字串」的正向測試。
 * 有人把病名寫回去，測試不會叫。
 *
 * 這支的契約：**血檢建議引擎端給學員看的每一段文字，都不得命中 compliance-scrub 的紅線**
 * （疾病名／處方藥名／診斷語氣／處方語氣）。
 *
 * 遍歷每個系統支援的指標 × 極高/極低/正常 三檔值 × 男女，把所有輸出欄位掃一遍。
 */

const GENDERS: Array<'男性' | '女性'> = ['男性', '女性']

/** 從閾值表推出「會觸發警示」的極端值：範圍型取上下界外推，單向型取遠超上限與極低。 */
function extremeValuesFor(name: string): number[] {
  const t = (LAB_THRESHOLDS as Record<string, { normal: unknown; attention: unknown }>)[name]
  if (!t) return []
  const n = t.normal
  if (typeof n === 'object' && n !== null && 'min' in n) {
    const r = n as { min: number; max: number }
    const span = r.max - r.min || 1
    return [r.min - span, r.min, (r.min + r.max) / 2, r.max, r.max + span]
  }
  const v = n as number
  return [v * 0.1, v * 0.5, v, v * 2, v * 5]
}

/** 收集一則建議裡所有「學員看得到」的文字。 */
function studentFacingText(a: {
  title: string
  dietaryChanges: string[]
  foodsToIncrease: string[]
  foodsToReduce: string[]
  macroAdjustment?: { detail: string }
  targetRange: string
  caveat?: string
}): string[] {
  return [
    a.title,
    ...a.dietaryChanges,
    ...a.foodsToIncrease,
    ...a.foodsToReduce,
    a.macroAdjustment?.detail ?? '',
    a.targetRange,
    a.caveat ?? '',
  ].filter(Boolean)
}

// 只掃真正的指標鍵（排除 _female 變體，它們靠 gender 參數走同一條路）
const MARKERS = Object.keys(LAB_THRESHOLDS).filter(k => !k.endsWith('_female'))

describe('醫療合規回歸守門：血檢建議引擎輸出不得含病名/診斷/處方', () => {
  it('generateLabNutritionAdvice 對所有指標 × 極端值 × 性別都不命中合規紅線', () => {
    const violations: string[] = []

    for (const marker of MARKERS) {
      for (const value of extremeValuesFor(marker)) {
        for (const gender of GENDERS) {
          const labs = [{ test_name: marker, value, unit: '', status: 'alert' as const, date: '2026-07-01' }]
          const advices = generateLabNutritionAdvice(labs, { gender })
          for (const a of advices) {
            for (const text of studentFacingText(a)) {
              const hits = scanMedicalCompliance(text)
              if (hits.length > 0) {
                violations.push(
                  `[${marker}=${value} ${gender}] "${text}" → 命中 ${hits.map(h => h.term).join(', ')}`,
                )
              }
            }
          }
        }
      }
    }

    expect(violations, `合規紅線被踩到：\n${violations.slice(0, 20).join('\n')}`).toEqual([])
  })

  it('generateLabOptimizationTips 輸出也不得命中合規紅線', () => {
    const violations: string[] = []

    for (const marker of MARKERS) {
      for (const value of extremeValuesFor(marker)) {
        for (const gender of GENDERS) {
          const labs = [{ test_name: marker, value, unit: '', status: 'attention' as const, date: '2026-07-01' }]
          const tips = generateLabOptimizationTips(labs, { gender })
          for (const tip of tips) {
            // tip 的文字欄位全掃（不硬編欄位名，未來新增欄位也守得到）
            for (const v of Object.values(tip as unknown as Record<string, unknown>)) {
              const texts = typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
              for (const text of texts as string[]) {
                const hits = scanMedicalCompliance(text)
                if (hits.length > 0) {
                  violations.push(`[${marker}=${value} ${gender}] "${text}" → 命中 ${hits.map(h => h.term).join(', ')}`)
                }
              }
            }
          }
        }
      }
    }

    expect(violations, `合規紅線被踩到：\n${violations.slice(0, 20).join('\n')}`).toEqual([])
  })

  it('掃描器本身仍會抓到病名（守門測試不是因為掃描器失效才綠的）', () => {
    // 反向哨兵：若有人不小心把 deny-list 清空，上面兩個測試會假綠 → 這條會先紅。
    expect(scanMedicalCompliance('你有非酒精性脂肪肝').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('這是甲狀腺功能低下的表現').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('建議服用 metformin 藥').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('符合代謝症候群模式').length).toBeGreaterThan(0)
  })

  it('安全詞白名單：Cystatin C 不被誤判為 statin 類藥，但真的 statin 藥名仍要抓到', () => {
    // Cystatin C = 胱抑素 C，腎功能檢驗項目。字面含 "statin" → 舊版子字串比對會誤殺，
    // 讓一句正常衛教（「建議搭配 Cystatin C 計算更準確」）被 degradeToSafe 換掉。
    expect(scanMedicalCompliance('建議搭配 Cystatin C 計算更準確')).toEqual([])
    expect(scanMedicalCompliance('cystatin c 比肌酸酐更準')).toEqual([])

    // 但真正的處方藥名不能因為白名單而漏抓（白名單只中和 cystatin，不動 statin 本身）
    expect(scanMedicalCompliance('請服用 atorvastatin').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('他汀類藥物').length).toBeGreaterThan(0)
    // 同一句同時出現安全詞與藥名時，藥名仍要被抓到
    expect(scanMedicalCompliance('Cystatin C 正常，但仍需 rosuvastatin').length).toBeGreaterThan(0)
  })
})

describe('文獻引用不得被合規降級吃掉', () => {
  it('crossPatterns / optimizationTips 的 references 含英文病名（期刊名、指引標題）是正常的', () => {
    // 例：'Alberti et al. 2009 (Circulation): IDF/AHA Joint Interim Statement on metabolic syndrome'
    // 這是書目，不是對學員下診斷。LabInsightsCard 學員模式會把 references 抽離、不參與 deepDegrade，
    // 否則畫面上的參考文獻會整條變成罐頭句。這裡守住「引用本身確實會命中掃描器」這個前提——
    // 一旦不再命中，元件那段抽離邏輯就可以拿掉。
    const citation = 'Alberti et al. 2009 (Circulation): IDF/AHA Joint Interim Statement on metabolic syndrome'
    expect(scanMedicalCompliance(citation).length).toBeGreaterThan(0)
    expect(degradeToSafe(citation).degraded).toBe(true)
  })
})
