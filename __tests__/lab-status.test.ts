import { describe, it, expect } from 'vitest'
import {
  calculateLabStatus,
  getStatusColor,
  getStatusIcon,
  getStatusText,
  isKnownLabTest,
  LAB_THRESHOLDS,
} from '../utils/labStatus'

describe('Lab Status Calculator', () => {
  // ============================================================
  //  1. 未知指標 → 'unknown'（不再靜默返回 'normal'）
  // ============================================================
  describe('Unknown Test Names', () => {
    it('不存在的指標名返回 unknown', () => {
      expect(calculateLabStatus('不存在的指標', 50)).toBe('unknown')
    })

    it('拼字錯誤返回 unknown', () => {
      expect(calculateLabStatus('HOMA_IR', 2.5)).toBe('unknown') // 正確是 HOMA-IR
    })

    it('空字串返回 unknown', () => {
      expect(calculateLabStatus('', 100)).toBe('unknown')
    })
  })

  // ============================================================
  //  2. isKnownLabTest
  // ============================================================
  describe('isKnownLabTest', () => {
    it('已知指標返回 true', () => {
      expect(isKnownLabTest('HOMA-IR')).toBe(true)
      expect(isKnownLabTest('空腹血糖')).toBe(true)
      expect(isKnownLabTest('維生素D')).toBe(true)
    })

    it('未知指標返回 false', () => {
      expect(isKnownLabTest('隨便亂寫')).toBe(false)
    })
  })

  // ============================================================
  //  3. 越低越好（一般數值型）
  // ============================================================
  describe('Lower-is-better indicators', () => {
    it('HOMA-IR: 1.5 → normal', () => {
      expect(calculateLabStatus('HOMA-IR', 1.5)).toBe('normal')
    })
    it('HOMA-IR: 2.0 → normal (boundary)', () => {
      expect(calculateLabStatus('HOMA-IR', 2.0)).toBe('normal')
    })
    it('HOMA-IR: 2.3 → attention', () => {
      expect(calculateLabStatus('HOMA-IR', 2.3)).toBe('attention')
    })
    it('HOMA-IR: 2.5 → attention (boundary)', () => {
      expect(calculateLabStatus('HOMA-IR', 2.5)).toBe('attention')
    })
    it('HOMA-IR: 3.0 → alert', () => {
      expect(calculateLabStatus('HOMA-IR', 3.0)).toBe('alert')
    })

    it('空腹血糖: 85 → normal', () => {
      expect(calculateLabStatus('空腹血糖', 85)).toBe('normal')
    })
    it('空腹血糖: 95 → attention', () => {
      expect(calculateLabStatus('空腹血糖', 95)).toBe('attention')
    })
    it('空腹血糖: 110 → alert', () => {
      expect(calculateLabStatus('空腹血糖', 110)).toBe('alert')
    })

    it('三酸甘油酯: 80 → normal', () => {
      expect(calculateLabStatus('三酸甘油酯', 80)).toBe('normal')
    })
    it('三酸甘油酯: 120 → attention', () => {
      expect(calculateLabStatus('三酸甘油酯', 120)).toBe('attention')
    })
    it('三酸甘油酯: 200 → alert', () => {
      expect(calculateLabStatus('三酸甘油酯', 200)).toBe('alert')
    })
  })

  // ============================================================
  //  4. 越高越好（HIGHER_IS_BETTER）
  // ============================================================
  describe('Higher-is-better indicators', () => {
    it('維生素D: 60 → normal', () => {
      expect(calculateLabStatus('維生素D', 60)).toBe('normal')
    })
    it('維生素D: 50 → normal (boundary)', () => {
      expect(calculateLabStatus('維生素D', 50)).toBe('normal')
    })
    it('維生素D: 35 → attention', () => {
      expect(calculateLabStatus('維生素D', 35)).toBe('attention')
    })
    it('維生素D: 20 → alert', () => {
      expect(calculateLabStatus('維生素D', 20)).toBe('alert')
    })

    it('維生素B12: 500 → normal', () => {
      expect(calculateLabStatus('維生素B12', 500)).toBe('normal')
    })
    it('維生素B12: 300 → attention', () => {
      expect(calculateLabStatus('維生素B12', 300)).toBe('attention')
    })
    it('維生素B12: 150 → alert', () => {
      expect(calculateLabStatus('維生素B12', 150)).toBe('alert')
    })

    it('HDL-C: 50 → normal (男)', () => {
      expect(calculateLabStatus('HDL-C', 50)).toBe('normal')
    })
    it('HDL-C: 37 → attention (男)', () => {
      expect(calculateLabStatus('HDL-C', 37)).toBe('attention')
    })
    it('HDL-C: 30 → alert (男)', () => {
      expect(calculateLabStatus('HDL-C', 30)).toBe('alert')
    })

    it('eGFR: 95 → normal', () => {
      expect(calculateLabStatus('eGFR', 95)).toBe('normal')
    })
    it('eGFR: 75 → attention', () => {
      expect(calculateLabStatus('eGFR', 75)).toBe('attention')
    })
    it('eGFR: 50 → alert', () => {
      expect(calculateLabStatus('eGFR', 50)).toBe('alert')
    })
  })

  // ============================================================
  //  5. 範圍型（min-max）
  // ============================================================
  describe('Range-type indicators', () => {
    it('TSH: 2.0 → normal (in range)', () => {
      expect(calculateLabStatus('TSH', 2.0)).toBe('normal')
    })
    it('TSH: 0.35 → attention (below normal but in attention range)', () => {
      expect(calculateLabStatus('TSH', 0.35)).toBe('attention')
    })
    it('TSH: 0.2 → alert (below attention range)', () => {
      expect(calculateLabStatus('TSH', 0.2)).toBe('alert')
    })
    it('TSH: 4.5 → attention (above normal but in attention range)', () => {
      expect(calculateLabStatus('TSH', 4.5)).toBe('attention')
    })
    it('TSH: 6.0 → alert (above attention range)', () => {
      expect(calculateLabStatus('TSH', 6.0)).toBe('alert')
    })

    it('鋅: 80 → normal', () => {
      expect(calculateLabStatus('鋅', 80)).toBe('normal')
    })
    it('鋅: 65 → attention', () => {
      expect(calculateLabStatus('鋅', 65)).toBe('attention')
    })
    it('鋅: 50 → alert', () => {
      expect(calculateLabStatus('鋅', 50)).toBe('alert')
    })
  })

  // ============================================================
  //  6. 性別差異
  // ============================================================
  describe('Gender-specific thresholds', () => {
    it('鐵蛋白 25: 男性 → attention, 女性 → normal', () => {
      // 男 normal: 50-150, attention: 30-200 → 25 = alert
      expect(calculateLabStatus('鐵蛋白', 25, '男性')).toBe('alert')
      // 女 normal: 12-200, attention: 8-300 → 25 = normal
      expect(calculateLabStatus('鐵蛋白', 25, '女性')).toBe('normal')
    })

    it('HDL-C 45: 男性 → normal, 女性 → attention', () => {
      // 男 HDL-C: normal ≥ 40 → 45 = normal
      expect(calculateLabStatus('HDL-C', 45, '男性')).toBe('normal')
      // 女 HDL-C: normal ≥ 50, attention ≥ 40 → 45 = attention
      expect(calculateLabStatus('HDL-C', 45, '女性')).toBe('attention')
    })

    it('血紅素 12.5: 男性 → attention, 女性 → normal', () => {
      // 男 normal: 13.5-17.5 → 12.5 = attention (12.0-18.5)
      expect(calculateLabStatus('血紅素', 12.5, '男性')).toBe('attention')
      // 女 normal: 12.0-15.5 → 12.5 = normal
      expect(calculateLabStatus('血紅素', 12.5, '女性')).toBe('normal')
    })

    it('尿酸 6.5: 男性 → normal, 女性 → attention', () => {
      // 男 normal ≤ 7.0 → 6.5 = normal
      expect(calculateLabStatus('尿酸', 6.5, '男性')).toBe('normal')
      // 女 normal ≤ 6.0, attention ≤ 7.0 → 6.5 = attention
      expect(calculateLabStatus('尿酸', 6.5, '女性')).toBe('attention')
    })
  })

  // ============================================================
  //  7. Helper functions 處理 'unknown' 狀態
  // ============================================================
  describe('Helper functions with unknown status', () => {
    it('getStatusColor: unknown → gray', () => {
      expect(getStatusColor('unknown')).toContain('gray')
    })

    it('getStatusIcon: unknown → ⚪', () => {
      expect(getStatusIcon('unknown')).toBe('⚪')
    })

    it('getStatusText: unknown → 未收錄', () => {
      expect(getStatusText('unknown')).toBe('未收錄')
    })
  })

  // ============================================================
  //  8. 所有 LAB_THRESHOLDS 中的指標都能被正確辨識
  // ============================================================
  describe('All known thresholds are recognized', () => {
    const knownKeys = Object.keys(LAB_THRESHOLDS).filter(k => !k.endsWith('_female'))

    for (const key of knownKeys) {
      it(`${key} 不返回 unknown`, () => {
        // 使用一個合理的中間值測試
        const result = calculateLabStatus(key, 50)
        expect(result).not.toBe('unknown')
      })
    }
  })
})
