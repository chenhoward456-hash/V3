/**
 * Tests for @/utils/validation
 *
 * Covers:
 *   - validateLabValue: type checking, range checking, specific test ranges
 *   - validateSupplementName: empty check, length limits, XSS prevention
 *   - validateSupplementDosage: empty check, length limits, XSS prevention
 *   - validateBodyComposition: range checks for height, weight, body_fat, etc.
 *   - validateDate: format, future date, year range
 *   - sanitizeInput: XSS removal, trimming, recursive cleaning
 */

import {
  validateLabValue,
  validateSupplementName,
  validateSupplementDosage,
  validateBodyComposition,
  validateDate,
  sanitizeInput,
} from '@/utils/validation'

// ════════════════════════════════════════════
// validateLabValue
// ════════════════════════════════════════════

describe('validateLabValue', () => {
  it('should accept valid lab values', () => {
    expect(validateLabValue('CRP', 1.5)).toEqual({ isValid: true, error: '' })
  })

  it('should reject NaN values', () => {
    const result = validateLabValue('CRP', NaN)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('有效的數字')
  })

  it('should reject zero or negative values', () => {
    expect(validateLabValue('CRP', 0).isValid).toBe(false)
    expect(validateLabValue('CRP', -5).isValid).toBe(false)
  })

  it('should validate specific test ranges', () => {
    // HOMA-IR: 0-10
    expect(validateLabValue('HOMA-IR', 1.5).isValid).toBe(true)
    expect(validateLabValue('HOMA-IR', 11).isValid).toBe(false)

    // Vitamin D: 0-200
    expect(validateLabValue('維生素D', 50).isValid).toBe(true)
    expect(validateLabValue('維生素D', 250).isValid).toBe(false)
  })

  it('should allow values for unknown test names (no specific range)', () => {
    expect(validateLabValue('UnknownTest', 999).isValid).toBe(true)
  })

  it('should validate fasting blood sugar range', () => {
    expect(validateLabValue('空腹血糖', 90).isValid).toBe(true)
    expect(validateLabValue('空腹血糖', 501).isValid).toBe(false)
  })

  it('should validate zinc range', () => {
    expect(validateLabValue('鋅', 100).isValid).toBe(true)
    expect(validateLabValue('鋅', 5001).isValid).toBe(false)
  })
})

// ════════════════════════════════════════════
// validateSupplementName
// ════════════════════════════════════════════

describe('validateSupplementName', () => {
  it('should accept valid supplement names', () => {
    expect(validateSupplementName('Omega-3').isValid).toBe(true)
    expect(validateSupplementName('D3').isValid).toBe(true)
    expect(validateSupplementName('維生素B12').isValid).toBe(true)
  })

  it('should reject empty or null-ish names', () => {
    expect(validateSupplementName('').isValid).toBe(false)
    expect(validateSupplementName(null as any).isValid).toBe(false)
    expect(validateSupplementName(undefined as any).isValid).toBe(false)
  })

  it('should reject names over 100 characters', () => {
    const longName = 'A'.repeat(101)
    expect(validateSupplementName(longName).isValid).toBe(false)
  })

  it('should reject script tags (XSS)', () => {
    expect(validateSupplementName('<script>alert(1)</script>').isValid).toBe(false)
    expect(validateSupplementName('test<script>').isValid).toBe(false)
  })

  it('should reject javascript: protocol', () => {
    expect(validateSupplementName('javascript:alert(1)').isValid).toBe(false)
  })

  it('should reject event handler patterns', () => {
    expect(validateSupplementName('test onerror=alert(1)').isValid).toBe(false)
    expect(validateSupplementName('onmouseover=hack').isValid).toBe(false)
  })

  it('should reject iframe, object, embed, svg, img tags', () => {
    expect(validateSupplementName('<iframe src="evil">').isValid).toBe(false)
    expect(validateSupplementName('<svg onload=alert(1)>').isValid).toBe(false)
    expect(validateSupplementName('<img src=x>').isValid).toBe(false)
  })

  it('should accept 100-char name (boundary)', () => {
    const name = 'A'.repeat(100)
    expect(validateSupplementName(name).isValid).toBe(true)
  })
})

// ════════════════════════════════════════════
// validateSupplementDosage
// ════════════════════════════════════════════

describe('validateSupplementDosage', () => {
  it('should accept valid dosages', () => {
    expect(validateSupplementDosage('500mg').isValid).toBe(true)
    expect(validateSupplementDosage('2000 IU').isValid).toBe(true)
    expect(validateSupplementDosage('1 capsule').isValid).toBe(true)
  })

  it('should reject empty or null dosages', () => {
    expect(validateSupplementDosage('').isValid).toBe(false)
    expect(validateSupplementDosage(null as any).isValid).toBe(false)
  })

  it('should reject dosages over 50 characters', () => {
    const longDosage = 'A'.repeat(51)
    expect(validateSupplementDosage(longDosage).isValid).toBe(false)
  })

  it('should reject XSS in dosage', () => {
    expect(validateSupplementDosage('<script>alert(1)</script>').isValid).toBe(false)
    expect(validateSupplementDosage('javascript:void(0)').isValid).toBe(false)
    expect(validateSupplementDosage('onclick=hack').isValid).toBe(false)
  })

  it('should accept 50-char dosage (boundary)', () => {
    const dosage = 'A'.repeat(50)
    expect(validateSupplementDosage(dosage).isValid).toBe(true)
  })
})

// ════════════════════════════════════════════
// validateBodyComposition
// ════════════════════════════════════════════

describe('validateBodyComposition', () => {
  it('should accept valid body composition values', () => {
    expect(validateBodyComposition('weight', 80).isValid).toBe(true)
    expect(validateBodyComposition('height', 175).isValid).toBe(true)
    expect(validateBodyComposition('body_fat', 20).isValid).toBe(true)
    expect(validateBodyComposition('bmi', 25).isValid).toBe(true)
  })

  it('should reject NaN values', () => {
    const result = validateBodyComposition('weight', NaN)
    expect(result.isValid).toBe(false)
  })

  it('should reject negative values', () => {
    expect(validateBodyComposition('weight', -1).isValid).toBe(false)
  })

  it('should validate weight range (20-300)', () => {
    expect(validateBodyComposition('weight', 19).isValid).toBe(false)
    expect(validateBodyComposition('weight', 20).isValid).toBe(true)
    expect(validateBodyComposition('weight', 300).isValid).toBe(true)
    expect(validateBodyComposition('weight', 301).isValid).toBe(false)
  })

  it('should validate height range (100-250)', () => {
    expect(validateBodyComposition('height', 99).isValid).toBe(false)
    expect(validateBodyComposition('height', 100).isValid).toBe(true)
    expect(validateBodyComposition('height', 250).isValid).toBe(true)
    expect(validateBodyComposition('height', 251).isValid).toBe(false)
  })

  it('should validate body_fat range (0-100)', () => {
    expect(validateBodyComposition('body_fat', 0).isValid).toBe(true)
    expect(validateBodyComposition('body_fat', 50).isValid).toBe(true)
    expect(validateBodyComposition('body_fat', 101).isValid).toBe(false)
  })

  it('should validate visceral_fat range (1-30)', () => {
    expect(validateBodyComposition('visceral_fat', 0).isValid).toBe(false) // also caught by < 0 check
    expect(validateBodyComposition('visceral_fat', 1).isValid).toBe(true)
    expect(validateBodyComposition('visceral_fat', 31).isValid).toBe(false)
  })

  it('should accept unknown fields without specific range', () => {
    expect(validateBodyComposition('unknown_field', 999).isValid).toBe(true)
  })
})

// ════════════════════════════════════════════
// validateDate
// ════════════════════════════════════════════

describe('validateDate', () => {
  it('should accept valid YYYY-MM-DD dates', () => {
    expect(validateDate('2024-01-15').isValid).toBe(true)
    expect(validateDate('2000-12-31').isValid).toBe(true)
  })

  it('should reject empty or null dates', () => {
    expect(validateDate('').isValid).toBe(false)
    expect(validateDate(null as any).isValid).toBe(false)
  })

  it('should reject non-YYYY-MM-DD formats', () => {
    expect(validateDate('01/15/2024').isValid).toBe(false)
    expect(validateDate('2024/01/15').isValid).toBe(false)
    expect(validateDate('Jan 15, 2024').isValid).toBe(false)
    expect(validateDate('20240115').isValid).toBe(false)
  })

  it('should reject future dates', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    expect(validateDate(futureDateStr).isValid).toBe(false)
  })

  it('should reject dates outside 1900-2100 range', () => {
    expect(validateDate('1899-12-31').isValid).toBe(false)
    expect(validateDate('2101-01-01').isValid).toBe(false)
  })

  it('should accept boundary year dates', () => {
    expect(validateDate('1900-01-01').isValid).toBe(true)
    // 2100-01-01 would be in the future relative to 2026, so it may fail the future check
    // Instead test a date within range
    expect(validateDate('2025-06-15').isValid).toBe(true)
  })
})

// ════════════════════════════════════════════
// sanitizeInput
// ════════════════════════════════════════════

describe('sanitizeInput', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('should remove angle brackets', () => {
    expect(sanitizeInput('hello <world>')).toBe('hello world')
  })

  it('should remove javascript: protocol', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)')
  })

  it('should remove vbscript: protocol', () => {
    expect(sanitizeInput('vbscript:msgbox')).toBe('msgbox')
  })

  it('should remove event handlers (onXxx=)', () => {
    expect(sanitizeInput('test onerror=alert(1)')).toBe('test alert(1)')
    expect(sanitizeInput('onmouseover=hack')).toBe('hack')
  })

  it('should remove data:text/html', () => {
    expect(sanitizeInput('data:text/html,<h1>test</h1>')).toBe(',h1test/h1')
  })

  it('should return empty string for null/undefined/non-string', () => {
    expect(sanitizeInput(null as any)).toBe('')
    expect(sanitizeInput(undefined as any)).toBe('')
    expect(sanitizeInput(123 as any)).toBe('')
  })

  it('should handle recursive nested dangerous patterns', () => {
    // e.g., "javasjavascript:cript:" should be cleaned recursively
    const result = sanitizeInput('javasjavascript:cript:alert(1)')
    expect(result).not.toContain('javascript:')
  })

  it('should preserve safe content', () => {
    expect(sanitizeInput('D3 2000IU')).toBe('D3 2000IU')
    expect(sanitizeInput('Omega-3 Fish Oil')).toBe('Omega-3 Fish Oil')
  })
})
