/**
 * Tests for @/utils/labStatus
 *
 * Covers:
 *   - calculateLabStatus: lower-is-better, higher-is-better, range-type, gender variants, unknown tests
 *   - isInOptimalRange: optimal ranges for various test types
 *   - getOptimalRangeText: text formatting for optimal ranges
 *   - getStatusColor: CSS class mapping
 *   - getStatusIcon: emoji mapping
 *   - getStatusText: Chinese text mapping
 */

import {
  calculateLabStatus,
  isInOptimalRange,
  getOptimalRangeText,
  getStatusColor,
  getStatusIcon,
  getStatusText,
  LAB_THRESHOLDS,
  LAB_OPTIMAL_RANGES,
} from '@/utils/labStatus'

// ════════════════════════════════════════════
// calculateLabStatus
// ════════════════════════════════════════════

describe('calculateLabStatus', () => {
  describe('lower-is-better indicators', () => {
    it('should return normal for HOMA-IR <= 2.0', () => {
      expect(calculateLabStatus('HOMA-IR', 1.5)).toBe('normal')
      expect(calculateLabStatus('HOMA-IR', 2.0)).toBe('normal')
    })

    it('should return attention for HOMA-IR between 2.0 and 2.5', () => {
      expect(calculateLabStatus('HOMA-IR', 2.3)).toBe('attention')
      expect(calculateLabStatus('HOMA-IR', 2.5)).toBe('attention')
    })

    it('should return alert for HOMA-IR > 2.5', () => {
      expect(calculateLabStatus('HOMA-IR', 3.0)).toBe('alert')
    })

    it('should return normal for CRP <= 1.0', () => {
      expect(calculateLabStatus('CRP', 0.5)).toBe('normal')
    })

    it('should return attention for CRP between 1.0 and 3.0', () => {
      expect(calculateLabStatus('CRP', 2.0)).toBe('attention')
    })

    it('should return alert for CRP > 3.0', () => {
      expect(calculateLabStatus('CRP', 5.0)).toBe('alert')
    })
  })

  describe('higher-is-better indicators', () => {
    it('should return normal for HDL-C >= 40 (male)', () => {
      expect(calculateLabStatus('HDL-C', 55)).toBe('normal')
      expect(calculateLabStatus('HDL-C', 40)).toBe('normal')
    })

    it('should return attention for HDL-C between 35 and 40 (male)', () => {
      expect(calculateLabStatus('HDL-C', 37)).toBe('attention')
    })

    it('should return alert for HDL-C < 35 (male)', () => {
      expect(calculateLabStatus('HDL-C', 30)).toBe('alert')
    })

    it('should use female thresholds for HDL-C when gender is female', () => {
      expect(calculateLabStatus('HDL-C', 50, '女性')).toBe('normal')
      expect(calculateLabStatus('HDL-C', 42, '女性')).toBe('attention')
      expect(calculateLabStatus('HDL-C', 35, '女性')).toBe('alert')
    })

    it('should return normal for eGFR >= 90', () => {
      expect(calculateLabStatus('eGFR', 100)).toBe('normal')
    })

    it('should return alert for eGFR < 60', () => {
      expect(calculateLabStatus('eGFR', 50)).toBe('alert')
    })
  })

  describe('range-type indicators', () => {
    it('should return normal for TSH within 0.4-4.0', () => {
      expect(calculateLabStatus('TSH', 2.0)).toBe('normal')
      expect(calculateLabStatus('TSH', 0.4)).toBe('normal')
      expect(calculateLabStatus('TSH', 4.0)).toBe('normal')
    })

    it('should return attention for TSH within 0.3-5.0 but outside normal', () => {
      expect(calculateLabStatus('TSH', 0.35)).toBe('attention')
      expect(calculateLabStatus('TSH', 4.5)).toBe('attention')
    })

    it('should return alert for TSH outside attention range', () => {
      expect(calculateLabStatus('TSH', 0.2)).toBe('alert')
      expect(calculateLabStatus('TSH', 6.0)).toBe('alert')
    })

    it('should handle vitamin D range correctly', () => {
      expect(calculateLabStatus('維生素D', 60)).toBe('normal')   // within 50-100
      expect(calculateLabStatus('維生素D', 35)).toBe('attention') // within 30-150
      expect(calculateLabStatus('維生素D', 20)).toBe('alert')    // outside 30-150
    })

    it('should handle mineral ranges (magnesium)', () => {
      expect(calculateLabStatus('鎂', 2.2)).toBe('normal')   // within 2.0-2.4
      expect(calculateLabStatus('鎂', 1.9)).toBe('attention') // within 1.8-2.6
      expect(calculateLabStatus('鎂', 1.5)).toBe('alert')    // outside 1.8-2.6
    })
  })

  describe('gender-specific indicators', () => {
    it('should use female ferritin thresholds for female gender', () => {
      // Female ferritin: normal 12-200, attention 8-300
      expect(calculateLabStatus('鐵蛋白', 100, '女性')).toBe('normal')
      expect(calculateLabStatus('鐵蛋白', 10, '女性')).toBe('attention')
      expect(calculateLabStatus('鐵蛋白', 5, '女性')).toBe('alert')
    })

    it('should use male ferritin thresholds by default', () => {
      // Male ferritin: normal 50-150, attention 30-200
      expect(calculateLabStatus('鐵蛋白', 100)).toBe('normal')
      expect(calculateLabStatus('鐵蛋白', 35)).toBe('attention')
      expect(calculateLabStatus('鐵蛋白', 20)).toBe('alert')
    })

    it('should use female testosterone thresholds', () => {
      expect(calculateLabStatus('睪固酮', 50, '女性')).toBe('normal')  // 15-70
      expect(calculateLabStatus('睪固酮', 12, '女性')).toBe('attention') // 10-90
      expect(calculateLabStatus('睪固酮', 5, '女性')).toBe('alert')
    })
  })

  describe('edge cases', () => {
    it('should return attention for unknown test names', () => {
      expect(calculateLabStatus('UnknownTest', 50)).toBe('attention')
    })

    it('should return alert for NaN value', () => {
      expect(calculateLabStatus('CRP', NaN)).toBe('alert')
    })

    it('should return alert for Infinity', () => {
      expect(calculateLabStatus('CRP', Infinity)).toBe('alert')
    })

    it('should return alert for negative Infinity', () => {
      expect(calculateLabStatus('CRP', -Infinity)).toBe('alert')
    })
  })
})

// ════════════════════════════════════════════
// isInOptimalRange
// ════════════════════════════════════════════

describe('isInOptimalRange', () => {
  it('should return true for lower-is-better when value <= optimal', () => {
    // HOMA-IR optimal: < 0.8
    expect(isInOptimalRange('HOMA-IR', 0.5)).toBe(true)
    expect(isInOptimalRange('HOMA-IR', 0.8)).toBe(true)
  })

  it('should return false for lower-is-better when value > optimal', () => {
    expect(isInOptimalRange('HOMA-IR', 1.5)).toBe(false)
  })

  it('should return true for higher-is-better when value >= optimal', () => {
    // HDL-C optimal: > 65
    expect(isInOptimalRange('HDL-C', 70)).toBe(true)
    expect(isInOptimalRange('HDL-C', 65)).toBe(true)
  })

  it('should return false for higher-is-better when value < optimal', () => {
    expect(isInOptimalRange('HDL-C', 50)).toBe(false)
  })

  it('should check range-type optimal (TSH 1.0-2.5)', () => {
    expect(isInOptimalRange('TSH', 1.5)).toBe(true)
    expect(isInOptimalRange('TSH', 3.5)).toBe(false)
    expect(isInOptimalRange('TSH', 0.5)).toBe(false)
  })

  it('should use female variant for female gender', () => {
    // HDL-C_female optimal: > 75
    expect(isInOptimalRange('HDL-C', 80, '女性')).toBe(true)
    expect(isInOptimalRange('HDL-C', 60, '女性')).toBe(false)
  })

  it('should return true for tests without defined optimal range', () => {
    expect(isInOptimalRange('Lp(a)', 20)).toBe(true) // Lp(a) not in optimal ranges
  })

  it('should handle vitamin D optimal range (60-80)', () => {
    expect(isInOptimalRange('維生素D', 70)).toBe(true)
    expect(isInOptimalRange('維生素D', 40)).toBe(false)
    expect(isInOptimalRange('維生素D', 90)).toBe(false)
  })
})

// ════════════════════════════════════════════
// getOptimalRangeText
// ════════════════════════════════════════════

describe('getOptimalRangeText', () => {
  it('should return range text for range-type optimal (TSH)', () => {
    expect(getOptimalRangeText('TSH')).toBe('1-2.5')
  })

  it('should return >value for higher-is-better (HDL-C)', () => {
    expect(getOptimalRangeText('HDL-C')).toBe('>65')
  })

  it('should return <value for lower-is-better (HOMA-IR)', () => {
    expect(getOptimalRangeText('HOMA-IR')).toBe('<0.8')
  })

  it('should return null for tests without optimal range', () => {
    expect(getOptimalRangeText('Lp(a)')).toBeNull()
  })

  it('should use female variant when specified', () => {
    expect(getOptimalRangeText('HDL-C', '女性')).toBe('>75')
    expect(getOptimalRangeText('鐵蛋白', '女性')).toBe('40-120')
  })

  it('should return range text for vitamin D (60-80)', () => {
    expect(getOptimalRangeText('維生素D')).toBe('60-80')
  })
})

// ════════════════════════════════════════════
// getStatusColor
// ════════════════════════════════════════════

describe('getStatusColor', () => {
  it('should return green classes for normal', () => {
    expect(getStatusColor('normal')).toContain('green')
  })

  it('should return yellow classes for attention', () => {
    expect(getStatusColor('attention')).toContain('yellow')
  })

  it('should return red classes for alert', () => {
    expect(getStatusColor('alert')).toContain('red')
  })

  it('should return gray classes for unknown status', () => {
    expect(getStatusColor('unknown' as any)).toContain('gray')
  })

  it('should return both bg and text classes', () => {
    const color = getStatusColor('normal')
    expect(color).toContain('bg-')
    expect(color).toContain('text-')
  })
})

// ════════════════════════════════════════════
// getStatusIcon
// ════════════════════════════════════════════

describe('getStatusIcon', () => {
  it('should return correct icons for each status', () => {
    expect(getStatusIcon('normal')).toBe('\uD83D\uDFE2')     // green circle
    expect(getStatusIcon('attention')).toBe('\uD83D\uDFE1')   // yellow circle
    expect(getStatusIcon('alert')).toBe('\uD83D\uDD34')       // red circle
  })

  it('should return white circle for unknown status', () => {
    expect(getStatusIcon('unknown' as any)).toBe('\u26AA')
  })
})

// ════════════════════════════════════════════
// getStatusText
// ════════════════════════════════════════════

describe('getStatusText', () => {
  it('should return correct Chinese text for each status', () => {
    expect(getStatusText('normal')).toBe('正常')
    expect(getStatusText('attention')).toBe('注意')
    expect(getStatusText('alert')).toBe('警示')
  })

  it('should return unknown text for unrecognized status', () => {
    expect(getStatusText('invalid' as any)).toBe('未知')
  })
})

// ════════════════════════════════════════════
// LAB_THRESHOLDS / LAB_OPTIMAL_RANGES exports
// ════════════════════════════════════════════

describe('LAB_THRESHOLDS', () => {
  it('should export LAB_THRESHOLDS as a non-empty object', () => {
    expect(typeof LAB_THRESHOLDS).toBe('object')
    expect(Object.keys(LAB_THRESHOLDS).length).toBeGreaterThan(20)
  })

  it('should contain common lab test names', () => {
    expect(LAB_THRESHOLDS).toHaveProperty('HOMA-IR')
    expect(LAB_THRESHOLDS).toHaveProperty('CRP')
    expect(LAB_THRESHOLDS).toHaveProperty('TSH')
    expect(LAB_THRESHOLDS).toHaveProperty('維生素D')
  })
})

describe('LAB_OPTIMAL_RANGES', () => {
  it('should export LAB_OPTIMAL_RANGES as a non-empty object', () => {
    expect(typeof LAB_OPTIMAL_RANGES).toBe('object')
    expect(Object.keys(LAB_OPTIMAL_RANGES).length).toBeGreaterThan(10)
  })
})
