import { describe, it, expect } from 'vitest'
import {
  generateLabNutritionAdvice,
  generateLabOptimizationTips,
  getLabMacroModifiers,
  detectLabCrossPatterns,
  generateRetestReminders,
  generateLabChangeReport,
  type LabNutritionAdvice,
  type LabOptimizationTip,
} from '@/lib/lab-nutrition-advisor'

// ──────────────────────────────────────────────────────────
// Helper: build a LabInput quickly
// ──────────────────────────────────────────────────────────
function lab(
  test_name: string,
  value: number | null,
  unit: string,
  status: 'normal' | 'attention' | 'alert' = 'attention',
  date?: string,
) {
  return { test_name, value, unit, status, date }
}

// ══════════════════════════════════════════════════════════
// generateLabNutritionAdvice
// ══════════════════════════════════════════════════════════
describe('generateLabNutritionAdvice', () => {
  // ── Empty / null input ──
  it('returns empty array for empty labs', () => {
    expect(generateLabNutritionAdvice([])).toEqual([])
  })

  it('returns empty array when all values are null', () => {
    const result = generateLabNutritionAdvice([
      lab('空腹血糖', null, 'mg/dL', 'attention'),
    ])
    expect(result).toEqual([])
  })

  it('skips labs with status normal (except positive advice)', () => {
    const result = generateLabNutritionAdvice([
      lab('空腹血糖', 95, 'mg/dL', 'normal'),
    ])
    // status=normal is skipped for abnormal markers before reaching fasting glucose check
    expect(result).toEqual([])
  })

  // ── Positive advice cards (triggered regardless of status) ──
  describe('positive advice cards', () => {
    it('generates positive card for excellent HOMA-IR (<1.0)', () => {
      const result = generateLabNutritionAdvice([
        lab('HOMA-IR', 0.8, '', 'normal'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('positive')
      expect(result[0].category).toBe('glucose')
      expect(result[0].title).toContain('胰島素敏感度頂尖')
      expect(result[0].foodsToReduce).toHaveLength(0)
    })

    it('generates positive card for excellent ApoB (<60)', () => {
      const result = generateLabNutritionAdvice([
        lab('ApoB', 50, 'mg/dL', 'normal'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('positive')
      expect(result[0].category).toBe('lipid')
      expect(result[0].currentValue).toBe(50)
    })

    it('generates positive card for excellent triglycerides (<70)', () => {
      const result = generateLabNutritionAdvice([
        lab('三酸甘油酯', 60, 'mg/dL', 'normal'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('positive')
      expect(result[0].category).toBe('lipid')
      expect(result[0].title).toContain('三酸甘油酯極低')
    })
  })

  // ── Glucose / Metabolism ──
  describe('glucose markers', () => {
    it('flags fasting glucose > 90 with medium severity', () => {
      const result = generateLabNutritionAdvice([
        lab('空腹血糖', 95, 'mg/dL', 'attention'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('glucose')
      expect(result[0].severity).toBe('medium')
      expect(result[0].title).toContain('空腹血糖偏高')
    })

    it('flags fasting glucose > 100 with high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('空腹血糖', 110, 'mg/dL', 'alert'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('high')
    })

    it('does not flag fasting glucose <= 90', () => {
      const result = generateLabNutritionAdvice([
        lab('空腹血糖', 88, 'mg/dL', 'attention'),
      ])
      expect(result).toHaveLength(0)
    })

    it('flags fasting insulin > 5 as medium, > 8 as high', () => {
      const medium = generateLabNutritionAdvice([
        lab('空腹胰島素', 6, 'µIU/mL', 'attention'),
      ])
      expect(medium[0].severity).toBe('medium')
      expect(medium[0].macroAdjustment?.direction).toBe('decrease')

      const high = generateLabNutritionAdvice([
        lab('空腹胰島素', 10, 'µIU/mL', 'alert'),
      ])
      expect(high[0].severity).toBe('high')
    })

    it('flags HOMA-IR abnormal with correct severity', () => {
      const medium = generateLabNutritionAdvice([
        lab('HOMA-IR', 2.0, '', 'attention'),
      ])
      expect(medium[0].category).toBe('glucose')
      expect(medium[0].severity).toBe('medium')

      const high = generateLabNutritionAdvice([
        lab('HOMA-IR', 3.0, '', 'alert'),
      ])
      expect(high[0].severity).toBe('high')
    })

    it('flags HbA1c with correct severity thresholds', () => {
      const medium = generateLabNutritionAdvice([
        lab('HbA1c', 5.5, '%', 'attention'),
      ])
      expect(medium[0].severity).toBe('medium')

      const high = generateLabNutritionAdvice([
        lab('HbA1c', 6.2, '%', 'alert'),
      ])
      expect(high[0].severity).toBe('high')
    })
  })

  // ── Uric acid (gender-specific) ──
  describe('uric acid - gender specific', () => {
    it('uses male threshold (>7.0) for uric acid when gender is male', () => {
      // 6.5 is below male threshold (7.0) so no advice
      const noAdvice = generateLabNutritionAdvice(
        [lab('尿酸', 6.5, 'mg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(noAdvice).toHaveLength(0)

      // 7.5 is above male threshold
      const hasAdvice = generateLabNutritionAdvice(
        [lab('尿酸', 7.5, 'mg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(hasAdvice).toHaveLength(1)
      expect(hasAdvice[0].targetRange).toContain('7.0')
    })

    it('uses female threshold (>6.0) for uric acid when gender is female', () => {
      // 6.5 is above female threshold (6.0) so advice generated
      const result = generateLabNutritionAdvice(
        [lab('尿酸', 6.5, 'mg/dL', 'attention')],
        { gender: '女性' },
      )
      expect(result).toHaveLength(1)
      expect(result[0].targetRange).toContain('6.0')
    })

    it('attaches caveat to uric acid advice', () => {
      const result = generateLabNutritionAdvice(
        [lab('尿酸', 8.0, 'mg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(result[0].caveat).toBeDefined()
      expect(result[0].caveat).toContain('尿酸偏高不一定會痛風')
    })
  })

  // ── Lipids ──
  describe('lipid markers', () => {
    it('generates advice for high triglycerides (attention status)', () => {
      const result = generateLabNutritionAdvice([
        lab('三酸甘油酯', 180, 'mg/dL', 'alert'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('lipid')
      expect(result[0].severity).toBe('high')
      expect(result[0].macroAdjustment?.nutrient).toBe('碳水化合物')
    })

    it('generates advice for high ApoB (attention status)', () => {
      const result = generateLabNutritionAdvice([
        lab('ApoB', 95, 'mg/dL', 'attention'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('lipid')
      expect(result[0].severity).toBe('medium')
    })

    it('flags ApoB > 100 as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('ApoB', 120, 'mg/dL', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('generates advice for high Lp(a)', () => {
      const result = generateLabNutritionAdvice([
        lab('Lp(a)', 60, 'nmol/L', 'attention'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('high')
      expect(result[0].caveat).toContain('基因決定')
    })

    it('generates advice for high LDL-C', () => {
      const result = generateLabNutritionAdvice([
        lab('LDL-C', 140, 'mg/dL', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
      expect(result[0].category).toBe('lipid')
    })

    it('generates advice for low HDL-C - male', () => {
      const result = generateLabNutritionAdvice(
        [lab('HDL-C', 35, 'mg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('lipid')
      expect(result[0].targetRange).toContain('>40')
    })

    it('generates advice for low HDL-C - female uses higher threshold', () => {
      // 45 is normal for male but low for female
      const result = generateLabNutritionAdvice(
        [lab('HDL-C', 45, 'mg/dL', 'attention')],
        { gender: '女性' },
      )
      expect(result).toHaveLength(1)
      expect(result[0].targetRange).toContain('>50')
    })

    it('generates advice for high total cholesterol', () => {
      const result = generateLabNutritionAdvice([
        lab('總膽固醇', 250, 'mg/dL', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
      expect(result[0].caveat).toContain('總膽固醇單獨意義不大')
    })
  })

  // ── Liver ──
  describe('liver markers', () => {
    it('flags AST with correct severity and caveat about exercise', () => {
      const result = generateLabNutritionAdvice([
        lab('AST', 55, 'U/L', 'attention'),
      ])
      expect(result[0].category).toBe('liver')
      expect(result[0].severity).toBe('medium')
      expect(result[0].caveat).toContain('肌肉')
    })

    it('flags AST > 80 as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('AST', 90, 'U/L', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('flags ALT with NAFLD caveat', () => {
      const result = generateLabNutritionAdvice([
        lab('ALT', 60, 'U/L', 'attention'),
      ])
      expect(result[0].category).toBe('liver')
      expect(result[0].caveat).toContain('NAFLD')
    })

    it('flags GGT with gender-specific target range', () => {
      const male = generateLabNutritionAdvice(
        [lab('GGT', 70, 'U/L', 'attention')],
        { gender: '男性' },
      )
      expect(male[0].targetRange).toContain('<60')

      const female = generateLabNutritionAdvice(
        [lab('GGT', 45, 'U/L', 'attention')],
        { gender: '女性' },
      )
      expect(female[0].targetRange).toContain('<40')
    })

    it('flags low albumin (< 3.5) with macroAdjustment', () => {
      const result = generateLabNutritionAdvice([
        lab('白蛋白', 3.2, 'g/dL', 'attention'),
      ])
      expect(result[0].macroAdjustment?.nutrient).toBe('蛋白質')
      expect(result[0].macroAdjustment?.direction).toBe('increase')
    })

    it('does not flag albumin >= 3.5', () => {
      const result = generateLabNutritionAdvice([
        lab('白蛋白', 4.0, 'g/dL', 'attention'),
      ])
      expect(result).toHaveLength(0)
    })
  })

  // ── Kidney ──
  describe('kidney markers', () => {
    it('flags creatinine with gender-specific threshold', () => {
      // Male threshold is 1.3
      const maleOk = generateLabNutritionAdvice(
        [lab('肌酸酐', 1.2, 'mg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(maleOk).toHaveLength(0)

      // Female threshold is 1.1
      const femaleHigh = generateLabNutritionAdvice(
        [lab('肌酸酐', 1.2, 'mg/dL', 'attention')],
        { gender: '女性' },
      )
      expect(femaleHigh).toHaveLength(1)
      expect(femaleHigh[0].targetRange).toContain('0.6-1.1')
    })

    it('flags BUN > 20', () => {
      const result = generateLabNutritionAdvice([
        lab('BUN', 22, 'mg/dL', 'attention'),
      ])
      expect(result[0].category).toBe('kidney')
      expect(result[0].caveat).toContain('高蛋白飲食')
    })

    it('flags eGFR < 90 with severity based on value', () => {
      const medium = generateLabNutritionAdvice([
        lab('eGFR', 75, 'mL/min/1.73m²', 'attention'),
      ])
      expect(medium[0].severity).toBe('medium')

      const high = generateLabNutritionAdvice([
        lab('eGFR', 50, 'mL/min/1.73m²', 'alert'),
      ])
      expect(high[0].severity).toBe('high')
    })
  })

  // ── Thyroid ──
  describe('thyroid markers', () => {
    it('flags high TSH (>4.0) as hypothyroid tendency', () => {
      const result = generateLabNutritionAdvice([
        lab('TSH', 4.5, 'mIU/L', 'attention'),
      ])
      expect(result[0].category).toBe('thyroid')
      expect(result[0].title).toContain('甲狀腺低下')
      expect(result[0].severity).toBe('medium')
    })

    it('flags TSH > 5.0 as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('TSH', 6.0, 'mIU/L', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('flags low TSH (<0.4) as hyperthyroid tendency', () => {
      const result = generateLabNutritionAdvice([
        lab('TSH', 0.2, 'mIU/L', 'attention'),
      ])
      expect(result[0].title).toContain('甲狀腺亢進')
      expect(result[0].severity).toBe('high')
    })

    it('flags low Free T4 (<0.8)', () => {
      const result = generateLabNutritionAdvice([
        lab('Free T4', 0.7, 'ng/dL', 'attention'),
      ])
      expect(result[0].category).toBe('thyroid')
      expect(result[0].severity).toBe('medium')
    })
  })

  // ── Iron / Blood ──
  describe('iron and blood markers', () => {
    it('flags high ferritin with gender-specific threshold', () => {
      const male = generateLabNutritionAdvice(
        [lab('鐵蛋白', 350, 'ng/mL', 'alert')],
        { gender: '男性' },
      )
      expect(male[0].title).toContain('鐵蛋白偏高')
      expect(male[0].macroAdjustment?.direction).toBe('decrease')

      // Female threshold is 150
      const female = generateLabNutritionAdvice(
        [lab('鐵蛋白', 180, 'ng/mL', 'attention')],
        { gender: '女性' },
      )
      expect(female[0].title).toContain('鐵蛋白偏高')
    })

    it('flags low ferritin with goalType-specific macroAdjustment', () => {
      const cutResult = generateLabNutritionAdvice(
        [lab('鐵蛋白', 10, 'ng/mL', 'alert')],
        { gender: '女性', goalType: 'cut' },
      )
      expect(cutResult[0].title).toContain('鐵質攝取不足')
      expect(cutResult[0].macroAdjustment).toBeDefined()
      expect(cutResult[0].macroAdjustment?.direction).toBe('increase')

      const bulkResult = generateLabNutritionAdvice(
        [lab('鐵蛋白', 10, 'ng/mL', 'alert')],
        { gender: '女性', goalType: 'bulk' },
      )
      // bulk does not get the macroAdjustment
      expect(bulkResult[0].macroAdjustment).toBeUndefined()
    })

    it('flags low hemoglobin with gender-specific threshold', () => {
      const male = generateLabNutritionAdvice(
        [lab('血紅素', 12.0, 'g/dL', 'alert')],
        { gender: '男性' },
      )
      expect(male[0].severity).toBe('high')
      expect(male[0].targetRange).toContain('>13.5')

      const female = generateLabNutritionAdvice(
        [lab('血紅素', 11.0, 'g/dL', 'alert')],
        { gender: '女性' },
      )
      expect(female[0].targetRange).toContain('>12')
    })

    it('flags low MCV (microcytic anemia)', () => {
      const result = generateLabNutritionAdvice([
        lab('MCV', 72, 'fL', 'attention'),
      ])
      expect(result[0].category).toBe('blood')
      expect(result[0].title).toContain('小球性')
      expect(result[0].severity).toBe('high')
    })

    it('flags high MCV (macrocytic anemia)', () => {
      const result = generateLabNutritionAdvice([
        lab('MCV', 108, 'fL', 'attention'),
      ])
      expect(result[0].title).toContain('大球性')
      expect(result[0].severity).toBe('high')
    })
  })

  // ── Inflammation ──
  describe('inflammation markers', () => {
    it('flags high CRP', () => {
      const result = generateLabNutritionAdvice([
        lab('CRP', 5.0, 'mg/L', 'attention'),
      ])
      expect(result[0].category).toBe('inflammation')
      expect(result[0].severity).toBe('medium')
      expect(result[0].macroAdjustment?.nutrient).toBe('脂肪來源')
    })

    it('flags CRP > 10 as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('hs-CRP', 15, 'mg/L', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('flags high homocysteine', () => {
      const result = generateLabNutritionAdvice([
        lab('同半胱胺酸', 14, 'µmol/L', 'attention'),
      ])
      expect(result[0].category).toBe('inflammation')
      expect(result[0].severity).toBe('high')
      expect(result[0].caveat).toContain('MTHFR')
    })
  })

  // ── Vitamins ──
  describe('vitamin markers', () => {
    it('flags low vitamin D with severity based on value', () => {
      const severe = generateLabNutritionAdvice([
        lab('維生素D', 15, 'ng/mL', 'alert'),
      ])
      expect(severe[0].category).toBe('vitamin')
      expect(severe[0].severity).toBe('high')

      const moderate = generateLabNutritionAdvice([
        lab('維生素D', 25, 'ng/mL', 'attention'),
      ])
      expect(moderate[0].severity).toBe('medium')
    })

    it('flags low B12 (<400)', () => {
      const result = generateLabNutritionAdvice([
        lab('維生素B12', 300, 'pg/mL', 'attention'),
      ])
      expect(result[0].category).toBe('vitamin')
      expect(result[0].severity).toBe('medium')
    })

    it('flags very low B12 (<200) as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('B12', 150, 'pg/mL', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('flags low folate (<5.4)', () => {
      const result = generateLabNutritionAdvice([
        lab('葉酸', 4.0, 'ng/mL', 'attention'),
      ])
      expect(result[0].category).toBe('vitamin')
      expect(result[0].severity).toBe('medium')
    })
  })

  // ── Minerals ──
  describe('mineral markers', () => {
    it('flags low magnesium', () => {
      const result = generateLabNutritionAdvice([
        lab('鎂', 1.8, 'mg/dL', 'attention'),
      ])
      expect(result[0].category).toBe('mineral')
      expect(result[0].title).toContain('鎂偏低')
    })

    it('flags high magnesium', () => {
      const result = generateLabNutritionAdvice([
        lab('鎂', 2.8, 'mg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('鎂偏高')
    })

    it('flags low zinc', () => {
      const result = generateLabNutritionAdvice([
        lab('鋅', 55, 'µg/dL', 'attention'),
      ])
      expect(result[0].category).toBe('mineral')
      expect(result[0].title).toContain('鋅偏低')
    })

    it('flags high zinc (>120)', () => {
      const result = generateLabNutritionAdvice([
        lab('鋅', 130, 'µg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('鋅偏高')
    })

    it('flags low calcium (<8.5)', () => {
      const result = generateLabNutritionAdvice([
        lab('鈣', 8.0, 'mg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('鈣偏低')
    })

    it('flags high calcium (>10.5)', () => {
      const result = generateLabNutritionAdvice([
        lab('鈣', 11.2, 'mg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('鈣偏高')
      expect(result[0].severity).toBe('high')
    })
  })

  // ── Hormones ──
  describe('hormone markers', () => {
    it('flags low testosterone in males (<300)', () => {
      const result = generateLabNutritionAdvice(
        [lab('睪固酮', 250, 'ng/dL', 'attention')],
        { gender: '男性' },
      )
      expect(result[0].category).toBe('hormone')
      expect(result[0].macroAdjustment?.nutrient).toBe('脂肪')
      expect(result[0].macroAdjustment?.direction).toBe('increase')
    })

    it('does not flag testosterone in females as low testosterone', () => {
      const result = generateLabNutritionAdvice(
        [lab('睪固酮', 30, 'ng/dL', 'attention')],
        { gender: '女性' },
      )
      // Female testosterone 30 is normal; no low T advice
      expect(result.some((a) => a.title.includes('睪固酮偏低'))).toBe(false)
    })

    it('flags high testosterone in females (>70)', () => {
      const result = generateLabNutritionAdvice(
        [lab('睪固酮', 85, 'ng/dL', 'attention')],
        { gender: '女性' },
      )
      expect(result[0].title).toContain('睪固酮偏高')
      expect(result[0].caveat).toContain('PCOS')
    })

    it('flags low free testosterone in males', () => {
      // value 30 is < 47 so triggers advice; severity: < 30 = high, else medium
      const medium = generateLabNutritionAdvice(
        [lab('游離睪固酮', 30, 'pg/mL', 'attention')],
        { gender: '男性' },
      )
      expect(medium[0].severity).toBe('medium')
      expect(medium[0].macroAdjustment?.nutrient).toBe('脂肪')

      const high = generateLabNutritionAdvice(
        [lab('游離睪固酮', 25, 'pg/mL', 'attention')],
        { gender: '男性' },
      )
      expect(high[0].severity).toBe('high')
    })

    it('flags high cortisol (>18)', () => {
      const result = generateLabNutritionAdvice([
        lab('皮質醇', 20, 'µg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('皮質醇偏高')
      expect(result[0].severity).toBe('medium')
    })

    it('flags very high cortisol (>22) as high severity', () => {
      const result = generateLabNutritionAdvice([
        lab('皮質醇', 25, 'µg/dL', 'alert'),
      ])
      expect(result[0].severity).toBe('high')
    })

    it('flags low cortisol (<6)', () => {
      const result = generateLabNutritionAdvice([
        lab('皮質醇', 4, 'µg/dL', 'attention'),
      ])
      expect(result[0].title).toContain('皮質醇偏低')
      expect(result[0].severity).toBe('medium')
    })

    it('flags low DHEA-S with gender-specific thresholds', () => {
      const male = generateLabNutritionAdvice(
        [lab('DHEA-S', 80, 'µg/dL', 'attention')],
        { gender: '男性' },
      )
      expect(male[0].title).toContain('DHEA-S 偏低')

      const female = generateLabNutritionAdvice(
        [lab('DHEA-S', 50, 'µg/dL', 'attention')],
        { gender: '女性' },
      )
      expect(female[0].title).toContain('DHEA-S 偏低')
      expect(female[0].targetRange).toContain('65-380')
    })

    it('flags high estradiol in males (>40)', () => {
      const result = generateLabNutritionAdvice(
        [lab('雌二醇', 50, 'pg/mL', 'attention')],
        { gender: '男性' },
      )
      expect(result[0].category).toBe('hormone')
      expect(result[0].title).toContain('雌二醇偏高')
    })

    it('does not flag estradiol for females', () => {
      const result = generateLabNutritionAdvice(
        [lab('雌二醇', 50, 'pg/mL', 'attention')],
        { gender: '女性' },
      )
      expect(result.some((a) => a.title.includes('雌二醇偏高'))).toBe(false)
    })

    it('flags high SHBG in males (>57)', () => {
      const result = generateLabNutritionAdvice(
        [lab('SHBG', 65, 'nmol/L', 'attention')],
        { gender: '男性' },
      )
      expect(result[0].title).toContain('SHBG 偏高')
    })

    it('flags low SHBG in males (<10)', () => {
      const result = generateLabNutritionAdvice(
        [lab('SHBG', 8, 'nmol/L', 'attention')],
        { gender: '男性' },
      )
      expect(result[0].title).toContain('SHBG 偏低')
    })
  })

  // ── Sorting ──
  describe('sorting by severity', () => {
    it('sorts high severity items before medium severity', () => {
      const result = generateLabNutritionAdvice([
        lab('CRP', 5, 'mg/L', 'attention'),        // medium
        lab('血紅素', 10, 'g/dL', 'alert'),          // high
        lab('維生素D', 25, 'ng/mL', 'attention'),    // medium
      ])
      expect(result.length).toBeGreaterThanOrEqual(3)
      // First item should be 'high' (hemoglobin)
      const highItems = result.filter((a) => a.severity === 'high')
      const medItems = result.filter((a) => a.severity === 'medium')
      expect(highItems.length).toBeGreaterThan(0)
      // All high items should appear before all medium items
      const lastHighIdx = result.lastIndexOf(highItems[highItems.length - 1])
      const firstMedIdx = result.indexOf(medItems[0])
      expect(lastHighIdx).toBeLessThan(firstMedIdx)
    })
  })

  // ── Multiple abnormalities at once ──
  describe('multiple abnormalities', () => {
    it('generates advice for multiple lab issues simultaneously', () => {
      const result = generateLabNutritionAdvice(
        [
          lab('空腹血糖', 105, 'mg/dL', 'alert'),
          lab('CRP', 8, 'mg/L', 'attention'),
          lab('維生素D', 18, 'ng/mL', 'attention'),
          lab('鐵蛋白', 10, 'ng/mL', 'alert'),
          lab('LDL-C', 150, 'mg/dL', 'alert'),
          lab('TSH', 5.5, 'mIU/L', 'alert'),
        ],
        { gender: '女性', goalType: 'cut' },
      )
      // Should have at least 6 advice items
      expect(result.length).toBeGreaterThanOrEqual(6)

      const categories = result.map((a) => a.category)
      expect(categories).toContain('glucose')
      expect(categories).toContain('inflammation')
      expect(categories).toContain('vitamin')
      expect(categories).toContain('iron')
      expect(categories).toContain('lipid')
      expect(categories).toContain('thyroid')
    })

    it('each advice has required fields', () => {
      const result = generateLabNutritionAdvice([
        lab('CRP', 5, 'mg/L', 'attention'),
      ])
      const advice = result[0]
      expect(advice.category).toBeDefined()
      expect(advice.title).toBeDefined()
      expect(advice.icon).toBeDefined()
      expect(advice.severity).toBeDefined()
      expect(advice.dietaryChanges.length).toBeGreaterThan(0)
      expect(advice.foodsToIncrease.length).toBeGreaterThan(0)
      expect(Array.isArray(advice.foodsToReduce)).toBe(true)
      expect(advice.labMarker).toBeDefined()
      expect(typeof advice.currentValue).toBe('number')
      expect(advice.unit).toBeDefined()
      expect(advice.targetRange).toBeDefined()
      expect(advice.references.length).toBeGreaterThan(0)
    })
  })

  // ── English lab names via matchLabName ──
  describe('lab name matching', () => {
    it('matches English lab names correctly', () => {
      const result = generateLabNutritionAdvice([
        lab('Fasting Glucose', 105, 'mg/dL', 'alert'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('glucose')
    })

    it('matches Chinese lab names correctly', () => {
      const result = generateLabNutritionAdvice([
        lab('空腹血糖', 105, 'mg/dL', 'alert'),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('glucose')
    })
  })
})

// ══════════════════════════════════════════════════════════
// generateLabOptimizationTips
// ══════════════════════════════════════════════════════════
describe('generateLabOptimizationTips', () => {
  it('returns empty array for empty labs', () => {
    expect(generateLabOptimizationTips([])).toEqual([])
  })

  it('only processes normal status labs', () => {
    // attention status should be skipped
    const result = generateLabOptimizationTips([
      lab('空腹血糖', 85, 'mg/dL', 'attention'),
    ])
    expect(result).toHaveLength(0)
  })

  it('generates tip for fasting glucose 80-90 (normal but suboptimal)', () => {
    const result = generateLabOptimizationTips([
      lab('空腹血糖', 85, 'mg/dL', 'normal'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('glucose')
    expect(result[0].optimalRange).toContain('<80')
    expect(result[0].supplements).toBeDefined()
    expect(result[0].supplements!.length).toBeGreaterThan(0)
  })

  it('generates tip for vitamin D below 60 (normal but suboptimal)', () => {
    const result = generateLabOptimizationTips([
      lab('維生素D', 45, 'ng/mL', 'normal'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('vitamin')
    expect(result[0].optimalRange).toContain('60-80')
  })

  it('generates tip for HDL below optimal (male < 60)', () => {
    const result = generateLabOptimizationTips(
      [lab('HDL', 50, 'mg/dL', 'normal')],
      { gender: '男性' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('lipid')
  })

  it('generates tip for HDL below optimal (female < 70)', () => {
    const result = generateLabOptimizationTips(
      [lab('HDL', 60, 'mg/dL', 'normal')],
      { gender: '女性' },
    )
    expect(result).toHaveLength(1)
  })

  it('generates tip for testosterone below optimal (male)', () => {
    const result = generateLabOptimizationTips(
      [lab('睪固酮', 500, 'ng/dL', 'normal')],
      { gender: '男性' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('hormone')
    expect(result[0].supplements!.length).toBeGreaterThan(0)
  })

  it('deduplicates labs by test_name, keeping latest by date', () => {
    const result = generateLabOptimizationTips([
      lab('空腹血糖', 85, 'mg/dL', 'normal', '2024-01-01'),
      lab('空腹血糖', 78, 'mg/dL', 'normal', '2024-06-01'),
    ])
    // Latest value 78 is below 80, so no tip for 80-90 range
    expect(result).toHaveLength(0)
  })

  it('generates tip for cortisol at high end (>12, normal)', () => {
    const result = generateLabOptimizationTips([
      lab('皮質醇', 15, 'µg/dL', 'normal'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('偏高端')
  })

  it('generates tip for cortisol at low end (<8, normal)', () => {
    const result = generateLabOptimizationTips([
      lab('皮質醇', 7, 'µg/dL', 'normal'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('偏低端')
  })

  it('generates tip for TSH > 2.5 but <= 4.0 (normal high)', () => {
    const result = generateLabOptimizationTips([
      lab('TSH', 3.5, 'mIU/L', 'normal'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('thyroid')
    expect(result[0].supplements!.length).toBeGreaterThan(0)
  })

  it('generates tip for ferritin below optimal but normal', () => {
    const result = generateLabOptimizationTips(
      [lab('鐵蛋白', 55, 'ng/mL', 'normal')],
      { gender: '男性' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('iron')
  })

  it('each optimization tip has required fields', () => {
    const result = generateLabOptimizationTips([
      lab('空腹血糖', 85, 'mg/dL', 'normal'),
    ])
    const tip = result[0]
    expect(tip.category).toBeDefined()
    expect(tip.title).toBeDefined()
    expect(tip.icon).toBeDefined()
    expect(tip.labMarker).toBeDefined()
    expect(typeof tip.currentValue).toBe('number')
    expect(tip.unit).toBeDefined()
    expect(tip.optimalRange).toBeDefined()
    expect(tip.currentRange).toBeDefined()
    expect(tip.tips.length).toBeGreaterThan(0)
    expect(tip.references.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════
// getLabMacroModifiers
// ══════════════════════════════════════════════════════════
describe('getLabMacroModifiers', () => {
  it('returns empty modifiers for empty labs', () => {
    const result = getLabMacroModifiers([])
    expect(result.macroModifiers).toEqual([])
    expect(result.trainingModifiers).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.carbCycleMultiplier).toBe(1.5)
  })

  it('returns default carbCycleMultiplier of 1.5', () => {
    const result = getLabMacroModifiers([
      lab('空腹血糖', 85, 'mg/dL', 'normal'),
    ])
    expect(result.carbCycleMultiplier).toBe(1.5)
  })

  // ── Positive modifiers ──
  it('increases carbs for excellent HOMA-IR (<1.0)', () => {
    const result = getLabMacroModifiers(
      [lab('HOMA-IR', 0.7, '', 'normal')],
      { bodyWeight: 70 },
    )
    const carbMod = result.macroModifiers.find((m) => m.nutrient === 'carbs')
    expect(carbMod).toBeDefined()
    expect(carbMod!.direction).toBe('increase')
    expect(carbMod!.delta).toBe(21) // 70 * 0.3
    expect(result.carbCycleMultiplier).toBe(1.8)
  })

  it('increases fat for excellent ApoB (<60)', () => {
    const result = getLabMacroModifiers(
      [lab('ApoB', 45, 'mg/dL', 'normal')],
      { bodyWeight: 80 },
    )
    const fatMod = result.macroModifiers.find((m) => m.nutrient === 'fat')
    expect(fatMod).toBeDefined()
    expect(fatMod!.direction).toBe('increase')
    expect(fatMod!.delta).toBe(8) // 80 * 0.1
  })

  it('increases carbs for low fasting insulin (<5) when no HOMA-IR boost', () => {
    const result = getLabMacroModifiers([
      lab('空腹胰島素', 3, 'µIU/mL', 'normal'),
    ])
    const carbMod = result.macroModifiers.find((m) => m.nutrient === 'carbs')
    expect(carbMod).toBeDefined()
    expect(carbMod!.direction).toBe('increase')
    expect(result.carbCycleMultiplier).toBe(1.8)
  })

  it('avoids double carb boost from both HOMA-IR and fasting insulin', () => {
    const result = getLabMacroModifiers([
      lab('HOMA-IR', 0.7, '', 'normal'),
      lab('空腹胰島素', 3, 'µIU/mL', 'normal'),
    ])
    const carbMods = result.macroModifiers.filter(
      (m) => m.nutrient === 'carbs' && m.direction === 'increase',
    )
    // Should only have one carb increase (from HOMA-IR, not from insulin)
    expect(carbMods).toHaveLength(1)
    expect(carbMods[0].labMarker).toMatch(/homa/i)
  })

  // ── Abnormal modifiers ──
  it('increases protein for low ferritin + decreases cardio', () => {
    const result = getLabMacroModifiers(
      [lab('鐵蛋白', 20, 'ng/mL', 'attention')],
      { gender: '女性', bodyWeight: 60 },
    )
    const protMod = result.macroModifiers.find((m) => m.nutrient === 'protein')
    expect(protMod).toBeDefined()
    expect(protMod!.direction).toBe('increase')
    expect(protMod!.delta).toBe(12) // 60 * 0.2

    const cardioMod = result.trainingModifiers.find((t) => t.area === 'cardio')
    expect(cardioMod).toBeDefined()
    expect(cardioMod!.direction).toBe('decrease')
  })

  it('decreases fat for high ApoB (>90)', () => {
    const result = getLabMacroModifiers([
      lab('ApoB', 100, 'mg/dL', 'alert'),
    ])
    const fatMod = result.macroModifiers.find(
      (m) => m.nutrient === 'fat' && m.direction === 'decrease',
    )
    expect(fatMod).toBeDefined()
  })

  it('decreases carbs for high HOMA-IR (>2.0) and sets low carbCycleMultiplier', () => {
    const result = getLabMacroModifiers([
      lab('HOMA-IR', 3.0, '', 'alert'),
    ])
    const carbMod = result.macroModifiers.find(
      (m) => m.nutrient === 'carbs' && m.direction === 'decrease',
    )
    expect(carbMod).toBeDefined()
    expect(result.carbCycleMultiplier).toBe(1.3)
  })

  it('decreases carbs for high fasting insulin (>8)', () => {
    const result = getLabMacroModifiers([
      lab('空腹胰島素', 12, 'µIU/mL', 'alert'),
    ])
    const carbMod = result.macroModifiers.find((m) => m.nutrient === 'carbs')
    expect(carbMod).toBeDefined()
    expect(carbMod!.direction).toBe('decrease')
  })

  it('increases calories for high TSH (>4.0) and decreases training intensity', () => {
    const result = getLabMacroModifiers([
      lab('TSH', 5.0, 'mIU/L', 'alert'),
    ])
    const calMod = result.macroModifiers.find((m) => m.nutrient === 'calories')
    expect(calMod).toBeDefined()
    expect(calMod!.direction).toBe('increase')
    expect(calMod!.delta).toBe(100)

    const intensityMod = result.trainingModifiers.find(
      (t) => t.area === 'intensity',
    )
    expect(intensityMod).toBeDefined()
    expect(intensityMod!.direction).toBe('decrease')
  })

  it('increases fat for low testosterone in males', () => {
    const result = getLabMacroModifiers(
      [lab('睪固酮', 250, 'ng/dL', 'attention')],
      { gender: '男性', bodyWeight: 80 },
    )
    const fatMod = result.macroModifiers.find((m) => m.nutrient === 'fat')
    expect(fatMod).toBeDefined()
    expect(fatMod!.direction).toBe('increase')
    expect(fatMod!.delta).toBe(8) // 80 * 0.1
  })

  it('avoids duplicate fat modifier from both total T and free T', () => {
    const result = getLabMacroModifiers(
      [
        lab('睪固酮', 250, 'ng/dL', 'attention'),
        lab('游離睪固酮', 3, 'pg/mL', 'attention'),
      ],
      { gender: '男性' },
    )
    const fatMods = result.macroModifiers.filter(
      (m) => m.nutrient === 'fat' && m.direction === 'increase',
    )
    expect(fatMods).toHaveLength(1) // only one fat increase
  })

  it('decreases cardio for low hemoglobin', () => {
    const result = getLabMacroModifiers(
      [lab('血紅素', 11, 'g/dL', 'alert')],
      { gender: '女性' },
    )
    const cardioMod = result.trainingModifiers.find((t) => t.area === 'cardio')
    expect(cardioMod).toBeDefined()
    expect(cardioMod!.direction).toBe('decrease')
  })

  it('uses default body weight of 70 when not provided', () => {
    const result = getLabMacroModifiers([
      lab('HOMA-IR', 0.7, '', 'normal'),
    ])
    const carbMod = result.macroModifiers.find((m) => m.nutrient === 'carbs')
    expect(carbMod!.delta).toBe(21) // 70 * 0.3
  })

  it('generates warnings with emojis', () => {
    const result = getLabMacroModifiers([
      lab('HOMA-IR', 0.7, '', 'normal'),
    ])
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('HOMA-IR')
  })

  it('avoids duplicate LDL fat modifier when ApoB modifier exists', () => {
    const result = getLabMacroModifiers([
      lab('ApoB', 100, 'mg/dL', 'alert'),
      lab('LDL-C', 150, 'mg/dL', 'alert'),
    ])
    const fatMods = result.macroModifiers.filter(
      (m) => m.nutrient === 'fat' && m.direction === 'decrease',
    )
    // Should only have one fat decrease (from ApoB, not LDL)
    expect(fatMods).toHaveLength(1)
    expect(fatMods[0].labMarker).toMatch(/apob/i)
  })

  it('adds LDL fat modifier when ApoB is not present', () => {
    const result = getLabMacroModifiers([
      lab('LDL-C', 150, 'mg/dL', 'alert'),
    ])
    const fatMod = result.macroModifiers.find(
      (m) => m.nutrient === 'fat' && m.direction === 'decrease',
    )
    expect(fatMod).toBeDefined()
    expect(fatMod!.labMarker).toMatch(/ldl/i)
  })
})

// ══════════════════════════════════════════════════════════
// detectLabCrossPatterns
// ══════════════════════════════════════════════════════════
describe('detectLabCrossPatterns', () => {
  it('returns empty array for empty labs', () => {
    expect(detectLabCrossPatterns([])).toEqual([])
  })

  it('does not detect patterns when only 1-2 markers are abnormal', () => {
    const result = detectLabCrossPatterns([
      lab('鐵蛋白', 20, 'ng/mL', 'attention'),
      lab('維生素D', 25, 'ng/mL', 'attention'),
    ])
    // 2 markers is not enough for any cross pattern
    expect(result).toHaveLength(0)
  })

  // ── RED-S pattern ──
  it('detects RED-S risk when multiple markers align', () => {
    const result = detectLabCrossPatterns(
      [
        lab('鐵蛋白', 20, 'ng/mL', 'attention'),
        lab('維生素D', 25, 'ng/mL', 'attention'),
        lab('TSH', 5.0, 'mIU/L', 'alert'),
      ],
      { gender: '女性', bodyFatPct: 13, hasAmenorrhea: false },
    )
    const redS = result.find((p) => p.pattern === 'red_s_risk')
    expect(redS).toBeDefined()
    expect(redS!.severity).toBe('critical') // score >= 4
  })

  it('detects RED-S in males with low testosterone', () => {
    const result = detectLabCrossPatterns(
      [
        lab('鐵蛋白', 20, 'ng/mL', 'attention'),
        lab('維生素D', 25, 'ng/mL', 'attention'),
        lab('TSH', 5.0, 'mIU/L', 'alert'),
        lab('睪固酮', 200, 'ng/dL', 'attention'),
      ],
      { gender: '男性', bodyFatPct: 5 },
    )
    const redS = result.find((p) => p.pattern === 'red_s_risk')
    expect(redS).toBeDefined()
  })

  // ── Metabolic syndrome ──
  it('detects metabolic syndrome when >= 3 metabolic markers are abnormal', () => {
    const result = detectLabCrossPatterns([
      lab('空腹血糖', 110, 'mg/dL', 'alert'),
      lab('三酸甘油酯', 200, 'mg/dL', 'alert'),
      lab('HDL', 35, 'mg/dL', 'attention'),
    ])
    const metSyn = result.find((p) => p.pattern === 'metabolic_syndrome')
    expect(metSyn).toBeDefined()
    expect(metSyn!.triggeredMarkers).toHaveLength(3)
  })

  it('includes uric acid action item when uric acid > 7.0 in metabolic syndrome', () => {
    const result = detectLabCrossPatterns(
      [
        lab('空腹血糖', 110, 'mg/dL', 'alert'),
        lab('三酸甘油酯', 200, 'mg/dL', 'alert'),
        lab('HDL', 35, 'mg/dL', 'attention'),
        lab('尿酸', 8.0, 'mg/dL', 'attention'),
      ],
      { gender: '男性' },
    )
    const metSyn = result.find((p) => p.pattern === 'metabolic_syndrome')
    expect(metSyn).toBeDefined()
    const uaAction = metSyn!.actionItems.find((a) => a.includes('尿酸'))
    expect(uaAction).toBeDefined()
  })

  // ── Overtraining ──
  it('detects overtraining when cortisol high + testosterone low + CRP high', () => {
    const result = detectLabCrossPatterns(
      [
        lab('皮質醇', 28, 'µg/dL', 'alert'),
        lab('睪固酮', 350, 'ng/dL', 'attention'),
        lab('CRP', 5, 'mg/L', 'attention'),
      ],
      { gender: '男性' },
    )
    const ot = result.find((p) => p.pattern === 'overtraining_risk')
    expect(ot).toBeDefined()
  })

  // ── Thyroid metabolic ──
  it('detects thyroid metabolic pattern (TSH high + FT4 low)', () => {
    const result = detectLabCrossPatterns([
      lab('TSH', 5.0, 'mIU/L', 'alert'),
      lab('Free T4', 0.8, 'ng/dL', 'attention'),
    ])
    const thyroid = result.find((p) => p.pattern === 'thyroid_metabolic')
    expect(thyroid).toBeDefined()
    expect(thyroid!.description).toContain('TSH')
    expect(thyroid!.description).toContain('Free T4')
  })

  // ── Chronic inflammation ──
  it('detects chronic inflammation when >= 2 inflammatory markers are high', () => {
    const result = detectLabCrossPatterns(
      [
        lab('CRP', 5, 'mg/L', 'attention'),
        lab('同半胱胺酸', 15, 'µmol/L', 'attention'),
      ],
      { gender: '男性' },
    )
    const inf = result.find((p) => p.pattern === 'chronic_inflammation')
    expect(inf).toBeDefined()
    expect(inf!.triggeredMarkers).toHaveLength(2)
  })

  it('includes homocysteine B-vitamin action item', () => {
    const result = detectLabCrossPatterns([
      lab('CRP', 5, 'mg/L', 'attention'),
      lab('同半胱胺酸', 15, 'µmol/L', 'attention'),
    ])
    const inf = result.find((p) => p.pattern === 'chronic_inflammation')
    const bAction = inf!.actionItems.find((a) => a.includes('B6'))
    expect(bAction).toBeDefined()
  })

  // ── Sorting ──
  it('sorts patterns by severity (critical > high > medium)', () => {
    const result = detectLabCrossPatterns(
      [
        // RED-S: critical
        lab('鐵蛋白', 20, 'ng/mL', 'attention'),
        lab('維生素D', 25, 'ng/mL', 'attention'),
        lab('TSH', 5.0, 'mIU/L', 'alert'),
        // Metabolic: medium
        lab('空腹血糖', 110, 'mg/dL', 'alert'),
        lab('三酸甘油酯', 200, 'mg/dL', 'alert'),
        lab('HDL', 35, 'mg/dL', 'attention'),
        // Inflammation
        lab('CRP', 5, 'mg/L', 'attention'),
        lab('同半胱胺酸', 15, 'µmol/L', 'attention'),
      ],
      { gender: '女性', bodyFatPct: 13 },
    )
    expect(result.length).toBeGreaterThanOrEqual(2)
    // First item should be critical or high
    const severityOrder = { critical: 0, high: 1, medium: 2 } as const
    for (let i = 0; i < result.length - 1; i++) {
      expect(severityOrder[result[i].severity]).toBeLessThanOrEqual(
        severityOrder[result[i + 1].severity],
      )
    }
  })
})

// ══════════════════════════════════════════════════════════
// generateRetestReminders
// ══════════════════════════════════════════════════════════
describe('generateRetestReminders', () => {
  // Labs for retest need date field
  function datedLab(
    test_name: string,
    value: number,
    unit: string,
    status: 'normal' | 'attention' | 'alert',
    date: string,
  ) {
    return { test_name, value, unit, status, date }
  }

  it('returns empty array for empty labs', () => {
    expect(generateRetestReminders([])).toEqual([])
  })

  it('skips normal status labs', () => {
    const result = generateRetestReminders([
      datedLab('CRP', 0.5, 'mg/L', 'normal', '2024-01-01'),
    ])
    expect(result).toHaveLength(0)
  })

  it('generates retest reminder for abnormal ferritin', () => {
    const result = generateRetestReminders([
      datedLab('鐵蛋白', 10, 'ng/mL', 'attention', '2025-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].testName).toBe('鐵蛋白')
    expect(result[0].suggestedRetestWeeks).toBe(12)
    expect(result[0].lastValue).toBe(10)
  })

  it('calculates correct retest date', () => {
    const result = generateRetestReminders([
      datedLab('CRP', 5, 'mg/L', 'attention', '2025-01-01'),
    ])
    expect(result).toHaveLength(1)
    // CRP retest weeks = 8
    expect(result[0].suggestedRetestWeeks).toBe(8)
    // 2025-01-01 + 8 weeks = 2025-02-26
    expect(result[0].suggestedRetestDate).toBe('2025-02-26')
  })

  it('marks overdue reminders', () => {
    const result = generateRetestReminders([
      datedLab('鐵蛋白', 10, 'ng/mL', 'attention', '2024-01-01'),
    ])
    // 2024-01-01 + 12 weeks = 2024-03-25, which is in the past
    expect(result[0].isOverdue).toBe(true)
  })

  it('keeps only latest value per test_name', () => {
    const result = generateRetestReminders([
      datedLab('鐵蛋白', 10, 'ng/mL', 'attention', '2024-01-01'),
      datedLab('鐵蛋白', 25, 'ng/mL', 'attention', '2025-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].lastValue).toBe(25)
    expect(result[0].lastDate).toBe('2025-06-01')
  })

  it('uses reasonHigh for alert status', () => {
    const result = generateRetestReminders([
      datedLab('鐵蛋白', 500, 'ng/mL', 'alert', '2025-06-01'),
    ])
    expect(result[0].reason).toContain('偏高')
  })

  it('sorts overdue reminders first', () => {
    const result = generateRetestReminders([
      datedLab('CRP', 5, 'mg/L', 'attention', '2026-03-01'),      // not overdue (8 weeks = 2026-04-26)
      datedLab('鐵蛋白', 10, 'ng/mL', 'attention', '2024-01-01'), // overdue (12 weeks = 2024-03-25)
    ])
    expect(result).toHaveLength(2)
    expect(result[0].isOverdue).toBe(true)
    expect(result[1].isOverdue).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════
// generateLabChangeReport
// ══════════════════════════════════════════════════════════
describe('generateLabChangeReport', () => {
  function datedLab(
    test_name: string,
    value: number,
    unit: string,
    status: 'normal' | 'attention' | 'alert',
    date: string,
  ) {
    return { test_name, value, unit, status, date }
  }

  it('returns empty array for empty labs', () => {
    expect(generateLabChangeReport([])).toEqual([])
  })

  it('returns empty array when only one measurement per test', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 5, 'mg/L', 'attention', '2024-01-01'),
    ])
    expect(result).toEqual([])
  })

  it('detects improvement when higher-is-bad marker decreases', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 5, 'mg/L', 'attention', '2024-01-01'),
      datedLab('CRP', 2, 'mg/L', 'normal', '2024-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe('improved')
    expect(result[0].isNowNormal).toBe(true)
    expect(result[0].interpretation).toContain('飲食調整有效')
  })

  it('detects worsening when higher-is-bad marker increases', () => {
    const result = generateLabChangeReport([
      datedLab('空腹血糖', 95, 'mg/dL', 'attention', '2024-01-01'),
      datedLab('空腹血糖', 110, 'mg/dL', 'alert', '2024-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe('worsened')
    expect(result[0].interpretation).toContain('惡化')
  })

  it('detects improvement when higher-is-good marker increases', () => {
    const result = generateLabChangeReport([
      datedLab('維生素D', 20, 'ng/mL', 'attention', '2024-01-01'),
      datedLab('維生素D', 50, 'ng/mL', 'normal', '2024-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe('improved')
    expect(result[0].isNowNormal).toBe(true)
  })

  it('detects stable when change < 3%', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 5.0, 'mg/L', 'attention', '2024-01-01'),
      datedLab('CRP', 5.1, 'mg/L', 'attention', '2024-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe('stable')
  })

  it('handles bidirectional markers using status', () => {
    const result = generateLabChangeReport([
      datedLab('鐵蛋白', 500, 'ng/mL', 'alert', '2024-01-01'),
      datedLab('鐵蛋白', 200, 'ng/mL', 'normal', '2024-06-01'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe('improved')
    expect(result[0].isNowNormal).toBe(true)
  })

  it('calculates change absolute and percentage correctly', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 10, 'mg/L', 'alert', '2024-01-01'),
      datedLab('CRP', 5, 'mg/L', 'attention', '2024-06-01'),
    ])
    expect(result[0].changeAbsolute).toBe(-5)
    expect(result[0].changePct).toBe(-50)
    expect(result[0].previousValue).toBe(10)
    expect(result[0].currentValue).toBe(5)
  })

  it('skips measurements less than 14 days apart', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 10, 'mg/L', 'alert', '2024-01-01'),
      datedLab('CRP', 5, 'mg/L', 'attention', '2024-01-10'), // only 9 days
    ])
    // No pair with >= 14 day gap exists, so no report is generated
    expect(result).toHaveLength(0)
  })

  it('sorts improved items first, then stable, then worsened', () => {
    const result = generateLabChangeReport([
      datedLab('CRP', 10, 'mg/L', 'alert', '2024-01-01'),
      datedLab('CRP', 3, 'mg/L', 'attention', '2024-06-01'),         // improved
      datedLab('空腹血糖', 90, 'mg/dL', 'attention', '2024-01-01'),
      datedLab('空腹血糖', 110, 'mg/dL', 'alert', '2024-06-01'),     // worsened
      datedLab('維生素D', 50, 'ng/mL', 'normal', '2024-01-01'),
      datedLab('維生素D', 51, 'ng/mL', 'normal', '2024-06-01'),      // stable
    ])
    expect(result.length).toBe(3)
    expect(result[0].direction).toBe('improved')
    expect(result[1].direction).toBe('stable')
    expect(result[2].direction).toBe('worsened')
  })
})
