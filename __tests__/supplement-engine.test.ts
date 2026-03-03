import { describe, it, expect } from 'vitest'
import { generateSupplementSuggestions, type LabResult } from '../lib/supplement-engine'

// ── Helper ──
function makeLab(name: string, value: number, status: 'normal' | 'attention' | 'alert' = 'attention'): LabResult {
  return { test_name: name, value, unit: '', status }
}

describe('Supplement Suggestion Engine', () => {
  // ============================================================
  //  1. 空輸入 → 無建議
  // ============================================================
  describe('Empty input', () => {
    it('無血檢結果 → 空建議列表', () => {
      const result = generateSupplementSuggestions([])
      expect(result).toHaveLength(0)
    })

    it('所有指標正常 → 空建議列表', () => {
      const result = generateSupplementSuggestions([
        makeLab('Ferritin', 80, 'normal'),
        makeLab('Vitamin D', 60, 'normal'),
      ])
      expect(result).toHaveLength(0)
    })
  })

  // ============================================================
  //  2. 鐵蛋白觸發
  // ============================================================
  describe('Ferritin triggers', () => {
    it('鐵蛋白 < 15 → high priority', () => {
      const result = generateSupplementSuggestions([makeLab('Ferritin', 10)])
      const iron = result.find(s => s.name.includes('鐵劑'))
      expect(iron).toBeDefined()
      expect(iron!.priority).toBe('high')
    })

    it('鐵蛋白 15-30 → medium priority', () => {
      const result = generateSupplementSuggestions([makeLab('Ferritin', 25)])
      const iron = result.find(s => s.name.includes('鐵劑'))
      expect(iron).toBeDefined()
      expect(iron!.priority).toBe('medium')
    })

    it('鐵蛋白 > 30 → 不觸發', () => {
      const result = generateSupplementSuggestions([makeLab('Ferritin', 50)])
      const iron = result.find(s => s.name.includes('鐵劑'))
      expect(iron).toBeUndefined()
    })
  })

  // ============================================================
  //  3. 維生素 D 觸發
  // ============================================================
  describe('Vitamin D triggers', () => {
    it('Vit D < 20 → D3+K2 high 4000IU', () => {
      const result = generateSupplementSuggestions([makeLab('Vitamin D', 15)])
      const vd = result.find(s => s.name.includes('D3'))
      expect(vd).toBeDefined()
      expect(vd!.priority).toBe('high')
      expect(vd!.dosage).toContain('4000')
    })

    it('Vit D 20-40 → D3+K2 medium 2000IU', () => {
      const result = generateSupplementSuggestions([makeLab('Vitamin D', 30)])
      const vd = result.find(s => s.name.includes('D3'))
      expect(vd).toBeDefined()
      expect(vd!.priority).toBe('medium')
      expect(vd!.dosage).toContain('2000')
    })

    it('Vit D > 40 → 不觸發', () => {
      const result = generateSupplementSuggestions([makeLab('Vitamin D', 55)])
      const vd = result.find(s => s.name.includes('D3'))
      expect(vd).toBeUndefined()
    })
  })

  // ============================================================
  //  4. B12 觸發
  // ============================================================
  describe('Vitamin B12 triggers', () => {
    it('B12 < 200 → high priority', () => {
      const result = generateSupplementSuggestions([makeLab('Vitamin B12', 150)])
      const b12 = result.find(s => s.name.includes('B12'))
      expect(b12).toBeDefined()
      expect(b12!.priority).toBe('high')
    })

    it('B12 200-300 → medium priority', () => {
      const result = generateSupplementSuggestions([makeLab('Vitamin B12', 250)])
      const b12 = result.find(s => s.name.includes('B12'))
      expect(b12).toBeDefined()
      expect(b12!.priority).toBe('medium')
    })
  })

  // ============================================================
  //  5. 性別特定觸發
  // ============================================================
  describe('Gender-specific triggers', () => {
    it('男性睪固酮 < 400 → ZMA', () => {
      const result = generateSupplementSuggestions(
        [makeLab('Testosterone', 350)],
        { gender: '男性' }
      )
      const zma = result.find(s => s.name.includes('ZMA'))
      expect(zma).toBeDefined()
    })

    it('女性不觸發 ZMA', () => {
      const result = generateSupplementSuggestions(
        [makeLab('Testosterone', 40)],
        { gender: '女性' }
      )
      const zma = result.find(s => s.name.includes('ZMA'))
      expect(zma).toBeUndefined()
    })

    it('女性血紅素 < 12.0 → 鐵劑 + 葉酸', () => {
      const result = generateSupplementSuggestions(
        [makeLab('Hemoglobin', 11.5)],
        { gender: '女性' }
      )
      const iron = result.find(s => s.name.includes('葉酸'))
      expect(iron).toBeDefined()
      expect(iron!.priority).toBe('high')
    })

    it('男性血紅素 < 13.5 → 鐵劑 + 葉酸', () => {
      const result = generateSupplementSuggestions(
        [makeLab('Hemoglobin', 13.0)],
        { gender: '男性' }
      )
      const iron = result.find(s => s.name.includes('葉酸'))
      expect(iron).toBeDefined()
    })

    it('男性血紅素 13.8 → 不觸發', () => {
      const result = generateSupplementSuggestions(
        [makeLab('Hemoglobin', 13.8)],
        { gender: '男性' }
      )
      const iron = result.find(s => s.name.includes('葉酸'))
      expect(iron).toBeUndefined()
    })
  })

  // ============================================================
  //  6. CRP 觸發
  // ============================================================
  describe('CRP triggers', () => {
    it('CRP > 10 → Omega-3 high priority', () => {
      const result = generateSupplementSuggestions([makeLab('CRP', 12)])
      const omega = result.find(s => s.name.includes('Omega'))
      expect(omega).toBeDefined()
      expect(omega!.priority).toBe('high')
    })

    it('CRP 5-10 → Omega-3 medium priority', () => {
      const result = generateSupplementSuggestions([makeLab('CRP', 7)])
      const omega = result.find(s => s.name.includes('Omega'))
      expect(omega).toBeDefined()
      expect(omega!.priority).toBe('medium')
    })

    it('CRP < 5 → 不觸發', () => {
      const result = generateSupplementSuggestions([makeLab('CRP', 3)])
      const omega = result.find(s => s.name.includes('Omega'))
      expect(omega).toBeUndefined()
    })
  })

  // ============================================================
  //  7. 備賽/增肌 → 肌酸
  // ============================================================
  describe('Creatine triggers', () => {
    it('備賽 → 肌酸', () => {
      const result = generateSupplementSuggestions([], { isCompetitionPrep: true })
      const creatine = result.find(s => s.name.includes('肌酸'))
      expect(creatine).toBeDefined()
      expect(creatine!.priority).toBe('high')
    })

    it('增肌目標 → 肌酸', () => {
      const result = generateSupplementSuggestions([], { goalType: 'bulk' })
      const creatine = result.find(s => s.name.includes('肌酸'))
      expect(creatine).toBeDefined()
    })

    it('減脂且非備賽 → 不自動推肌酸', () => {
      const result = generateSupplementSuggestions([], { goalType: 'cut' })
      const creatine = result.find(s => s.name.includes('肌酸'))
      expect(creatine).toBeUndefined()
    })
  })

  // ============================================================
  //  8. 高 RPE 觸發鎂
  // ============================================================
  describe('High RPE triggers', () => {
    it('hasHighRPE → 甘胺酸鎂', () => {
      const result = generateSupplementSuggestions([], { hasHighRPE: true })
      const mag = result.find(s => s.name.includes('Magnesium Glycinate'))
      expect(mag).toBeDefined()
      expect(mag!.category).toBe('recovery')
    })
  })

  // ============================================================
  //  9. 健康模式 → 長壽補品
  // ============================================================
  describe('Health Mode supplements', () => {
    it('健康模式 → 加入白藜蘆醇、CoQ10、Ashwagandha', () => {
      const result = generateSupplementSuggestions([], { isHealthMode: true })
      expect(result.some(s => s.name.includes('白藜蘆醇'))).toBe(true)
      expect(result.some(s => s.name.includes('CoQ10') || s.name.includes('輔酶'))).toBe(true)
      expect(result.some(s => s.name.includes('Ashwagandha') || s.name.includes('南非醉茄'))).toBe(true)
    })

    it('健康模式 → 補上基礎 Omega-3（若血檢未觸發）', () => {
      const result = generateSupplementSuggestions([], { isHealthMode: true })
      expect(result.some(s => s.name.includes('Omega') || s.name.includes('魚油'))).toBe(true)
    })

    it('健康模式 + 血檢已觸發 Omega-3 → 不重複推', () => {
      const result = generateSupplementSuggestions(
        [makeLab('CRP', 8)],
        { isHealthMode: true }
      )
      const omegas = result.filter(s => s.name.includes('Omega') || s.name.includes('魚油'))
      expect(omegas).toHaveLength(1) // 只有血檢觸發的那一筆
    })
  })

  // ============================================================
  //  10. 排序正確性
  // ============================================================
  describe('Sorting', () => {
    it('high priority 排在 medium 前面', () => {
      const result = generateSupplementSuggestions([
        makeLab('Vitamin D', 15),    // high
        makeLab('Zinc', 70),         // medium
        makeLab('CRP', 12),          // high
      ])
      const highItems = result.filter(s => s.priority === 'high')
      const medItems = result.filter(s => s.priority === 'medium')
      if (highItems.length > 0 && medItems.length > 0) {
        const lastHighIdx = result.lastIndexOf(highItems[highItems.length - 1])
        const firstMedIdx = result.indexOf(medItems[0])
        expect(lastHighIdx).toBeLessThan(firstMedIdx)
      }
    })
  })

  // ============================================================
  //  11. 別名系統（中英文相容）
  // ============================================================
  describe('Name aliases', () => {
    it('鐵蛋白 → 同 Ferritin', () => {
      const zh = generateSupplementSuggestions([makeLab('鐵蛋白', 20)])
      const en = generateSupplementSuggestions([makeLab('Ferritin', 20)])
      expect(zh.length).toBe(en.length)
    })

    it('維生素D → 同 Vit.D', () => {
      const zh = generateSupplementSuggestions([makeLab('維生素D', 15)])
      const en = generateSupplementSuggestions([makeLab('Vit.D', 15)])
      expect(zh.length).toBe(en.length)
    })
  })
})
