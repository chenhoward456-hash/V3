import { describe, it, expect } from 'vitest'

// Mock labMatch before importing supplement-engine
import { vi } from 'vitest'
vi.mock('@/utils/labMatch', () => ({
  matchLabName: (testName: string, keywords: string[]) => {
    const n = testName.toLowerCase()
    return keywords.some(k => n.includes(k.toLowerCase()))
  },
}))

import {
  generateSupplementSuggestions,
  getSerotoninRiskLevel,
  type LabResult,
  type GeneticProfile,
} from '@/lib/supplement-engine'

function makeLab(name: string, value: number | null, unit = '', status: 'normal' | 'attention' | 'alert' = 'normal'): LabResult {
  return { test_name: name, value, unit, status }
}

describe('getSerotoninRiskLevel', () => {
  it('should return null for no profile', () => {
    expect(getSerotoninRiskLevel(null)).toBeNull()
    expect(getSerotoninRiskLevel(undefined)).toBeNull()
  })

  it('should map serotonin genotypes correctly', () => {
    expect(getSerotoninRiskLevel({ serotonin: 'SS' })).toBe('high')
    expect(getSerotoninRiskLevel({ serotonin: 'SL' })).toBe('moderate')
    expect(getSerotoninRiskLevel({ serotonin: 'LL' })).toBe('low')
  })

  it('should fallback to deprecated depressionRisk', () => {
    expect(getSerotoninRiskLevel({ depressionRisk: 'high' })).toBe('high')
    expect(getSerotoninRiskLevel({ depressionRisk: 'moderate' })).toBe('moderate')
  })

  it('should prefer serotonin over depressionRisk', () => {
    expect(getSerotoninRiskLevel({ serotonin: 'LL', depressionRisk: 'high' })).toBe('low')
  })
})

describe('generateSupplementSuggestions', () => {
  it('should return empty array with no lab data', () => {
    const result = generateSupplementSuggestions([])
    expect(result).toEqual([])
  })

  it('should suggest iron for low ferritin', () => {
    const labs = [makeLab('ferritin', 20, 'ng/mL', 'attention')]
    const result = generateSupplementSuggestions(labs)
    const iron = result.find(s => s.name.includes('鐵劑'))
    expect(iron).toBeDefined()
    expect(iron!.category).toBe('deficiency')
  })

  it('should set high priority for very low ferritin', () => {
    const labs = [makeLab('ferritin', 10, 'ng/mL', 'alert')]
    const result = generateSupplementSuggestions(labs)
    const iron = result.find(s => s.name.includes('鐵劑'))
    expect(iron!.priority).toBe('high')
  })

  it('should suggest vitamin D for deficiency', () => {
    const labs = [makeLab('vitamin d', 15, 'ng/mL', 'alert')]
    const result = generateSupplementSuggestions(labs)
    const vitD = result.find(s => s.name.includes('D3'))
    expect(vitD).toBeDefined()
    expect(vitD!.dosage).toContain('4000 IU') // severe deficiency dose
  })

  it('should suggest lower dose D3 for insufficiency', () => {
    const labs = [makeLab('vitamin d', 30, 'ng/mL', 'attention')]
    const result = generateSupplementSuggestions(labs)
    const vitD = result.find(s => s.name.includes('D3'))
    expect(vitD).toBeDefined()
    expect(vitD!.dosage).toContain('2000 IU')
  })

  it('should not suggest vitamin D if levels are adequate', () => {
    const labs = [makeLab('vitamin d', 50, 'ng/mL')]
    const result = generateSupplementSuggestions(labs)
    const vitD = result.find(s => s.name.includes('D3'))
    expect(vitD).toBeUndefined()
  })

  it('should suggest B12 for low levels', () => {
    const labs = [makeLab('vitamin b12', 300, 'pg/mL', 'attention')]
    const result = generateSupplementSuggestions(labs)
    const b12 = result.find(s => s.name.includes('B12'))
    expect(b12).toBeDefined()
  })

  it('should suggest ZMA for low testosterone in males', () => {
    const labs = [makeLab('testosterone', 350, 'ng/dL', 'attention')]
    const result = generateSupplementSuggestions(labs, { gender: '男性' })
    const zma = result.find(s => s.name.includes('ZMA'))
    expect(zma).toBeDefined()
    expect(zma!.category).toBe('hormonal')
  })

  it('should not suggest ZMA for females', () => {
    const labs = [makeLab('testosterone', 350, 'ng/dL')]
    const result = generateSupplementSuggestions(labs, { gender: '女性' })
    const zma = result.find(s => s.name.includes('ZMA'))
    expect(zma).toBeUndefined()
  })

  it('should suggest creatine for competition prep', () => {
    const result = generateSupplementSuggestions([], { isCompetitionPrep: true })
    const creatine = result.find(s => s.name.includes('肌酸'))
    expect(creatine).toBeDefined()
    expect(creatine!.priority).toBe('high')
  })

  it('should suggest creatine for bulk goal', () => {
    const result = generateSupplementSuggestions([], { goalType: 'bulk' })
    const creatine = result.find(s => s.name.includes('肌酸'))
    expect(creatine).toBeDefined()
  })

  it('should suggest magnesium for high RPE', () => {
    const result = generateSupplementSuggestions([], { hasHighRPE: true })
    const mag = result.find(s => s.name.includes('鎂'))
    expect(mag).toBeDefined()
    expect(mag!.category).toBe('recovery')
  })

  it('should not duplicate magnesium if blood level is also low', () => {
    const labs = [makeLab('magnesium', 1.5, 'mg/dL', 'attention')]
    const result = generateSupplementSuggestions(labs, { hasHighRPE: true })
    const magResults = result.filter(s => s.name.includes('鎂'))
    expect(magResults.length).toBe(1)
  })

  it('should suggest omega-3 for high CRP', () => {
    const labs = [makeLab('crp', 8, 'mg/L', 'attention')]
    const result = generateSupplementSuggestions(labs)
    const omega = result.find(s => s.name.includes('Omega-3'))
    expect(omega).toBeDefined()
  })

  it('should merge iron and hemoglobin suggestions', () => {
    const labs = [
      makeLab('ferritin', 20, 'ng/mL', 'attention'),
      makeLab('hemoglobin', 12, 'g/dL', 'attention'),
    ]
    const result = generateSupplementSuggestions(labs, { gender: '男性' })
    const ironResults = result.filter(s => s.name.includes('鐵劑'))
    expect(ironResults.length).toBe(1)
    // Should include both trigger tests
    expect(ironResults[0].triggerTests.length).toBe(2)
  })

  it('should sort by priority (high first) then category', () => {
    const labs = [
      makeLab('ferritin', 10, 'ng/mL', 'alert'),        // high priority
      makeLab('vitamin d', 30, 'ng/mL', 'attention'),    // medium priority
      makeLab('vitamin b12', 300, 'pg/mL', 'attention'), // medium priority
    ]
    const result = generateSupplementSuggestions(labs)
    if (result.length >= 2) {
      const priorities = result.map(s => s.priority)
      const highIdx = priorities.indexOf('high')
      const mediumIdx = priorities.indexOf('medium')
      if (highIdx !== -1 && mediumIdx !== -1) {
        expect(highIdx).toBeLessThan(mediumIdx)
      }
    }
  })

  describe('health mode', () => {
    it('should add longevity supplements', () => {
      const result = generateSupplementSuggestions([], { isHealthMode: true })
      const names = result.map(s => s.name)
      expect(names.some(n => n.includes('Omega-3'))).toBe(true)
      expect(names.some(n => n.includes('鎂'))).toBe(true)
      expect(names.some(n => n.includes('D3'))).toBe(true)
      expect(names.some(n => n.includes('白藜蘆醇'))).toBe(true)
      expect(names.some(n => n.includes('CoQ10') || n.includes('Q10'))).toBe(true)
      expect(names.some(n => n.includes('南非醉茄'))).toBe(true)
    })

    it('should not duplicate omega-3 if already triggered by CRP', () => {
      const labs = [makeLab('crp', 8, 'mg/L', 'attention')]
      const result = generateSupplementSuggestions(labs, { isHealthMode: true })
      const omega3s = result.filter(s => s.name.includes('Omega'))
      expect(omega3s.length).toBe(1)
    })
  })

  describe('genetics', () => {
    it('should suggest active folate for MTHFR mutation', () => {
      const result = generateSupplementSuggestions([], {
        genetics: { mthfr: 'heterozygous' },
      })
      const folate = result.find(s => s.name.includes('MTHF') || s.name.includes('葉酸'))
      expect(folate).toBeDefined()
      expect(folate!.name).toContain('活性')
    })

    it('should suggest higher dose folate for homozygous MTHFR', () => {
      const result = generateSupplementSuggestions([], {
        genetics: { mthfr: 'homozygous' },
      })
      const folate = result.find(s => s.name.includes('MTHF'))
      expect(folate!.dosage).toContain('1000mcg')
      expect(folate!.priority).toBe('high')
    })

    it('should suggest DHA-focused omega-3 for APOE4', () => {
      const result = generateSupplementSuggestions([], {
        genetics: { apoe: 'e3/e4' },
      })
      const omega = result.find(s => s.name.includes('Omega') || s.name.includes('魚油'))
      expect(omega).toBeDefined()
      expect(omega!.name).toContain('DHA')
    })

    it('should add PS for double APOE4', () => {
      const result = generateSupplementSuggestions([], {
        genetics: { apoe: 'e4/e4' },
      })
      const ps = result.find(s => s.name.includes('磷脂醯絲胺酸'))
      expect(ps).toBeDefined()
    })

    it('should add mood support for serotonin risk', () => {
      const result = generateSupplementSuggestions([], {
        genetics: { serotonin: 'SS' },
      })
      const names = result.map(s => s.name)
      expect(names.some(n => n.includes('D3'))).toBe(true)
      expect(names.some(n => n.includes('Omega'))).toBe(true)
      expect(names.some(n => n.includes('鎂'))).toBe(true)
    })
  })

  describe('competition prep × genetics', () => {
    it('should suggest 5-HTP for cutting with serotonin risk', () => {
      const result = generateSupplementSuggestions([], {
        isCompetitionPrep: true,
        goalType: 'cut',
        genetics: { serotonin: 'SS' },
      })
      const htp = result.find(s => s.name.includes('5-HTP'))
      expect(htp).toBeDefined()
      expect(htp!.priority).toBe('high')
    })

    it('should suggest MCT oil for APOE4 peak week', () => {
      const result = generateSupplementSuggestions([], {
        isCompetitionPrep: true,
        prepPhase: 'peak_week',
        genetics: { apoe: 'e3/e4' },
      })
      const mct = result.find(s => s.name.includes('MCT'))
      expect(mct).toBeDefined()
    })

    it('should suggest electrolytes for peak week', () => {
      const result = generateSupplementSuggestions([], {
        isCompetitionPrep: true,
        prepPhase: 'peak_week',
        genetics: { apoe: 'e3/e3' },
      })
      const elec = result.find(s => s.name.includes('電解質'))
      expect(elec).toBeDefined()
    })
  })
})
