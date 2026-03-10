import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock env vars before importing
vi.stubEnv('ECPAY_MERCHANT_ID', '3002607')
vi.stubEnv('ECPAY_HASH_KEY', 'pwFHCqoQZGmho4w6')
vi.stubEnv('ECPAY_HASH_IV', 'EkRm7iFT261dpevs')

import { generateCheckMacValue, verifyCheckMacValue, generateMerchantTradeNo, formatTradeDate } from '@/lib/ecpay'

describe('generateMerchantTradeNo', () => {
  it('should generate a string of max 20 characters', () => {
    const tradeNo = generateMerchantTradeNo()
    expect(tradeNo.length).toBeLessThanOrEqual(20)
  })

  it('should start with HP prefix', () => {
    const tradeNo = generateMerchantTradeNo()
    expect(tradeNo).toMatch(/^HP/)
  })

  it('should generate unique values', () => {
    const a = generateMerchantTradeNo()
    const b = generateMerchantTradeNo()
    expect(a).not.toBe(b)
  })

  it('should only contain alphanumeric characters', () => {
    const tradeNo = generateMerchantTradeNo()
    expect(tradeNo).toMatch(/^[a-zA-Z0-9]+$/)
  })
})

describe('formatTradeDate', () => {
  it('should format date as yyyy/MM/dd HH:mm:ss', () => {
    const date = new Date(2025, 0, 15, 9, 5, 3) // 2025/01/15 09:05:03
    expect(formatTradeDate(date)).toBe('2025/01/15 09:05:03')
  })

  it('should pad single digit months and days', () => {
    const date = new Date(2025, 2, 3, 14, 30, 45)
    expect(formatTradeDate(date)).toBe('2025/03/03 14:30:45')
  })

  it('should use current date when no argument', () => {
    const result = formatTradeDate()
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('generateCheckMacValue', () => {
  it('should generate a SHA256 hash in uppercase', () => {
    const mac = generateCheckMacValue({
      MerchantID: '3002607',
      MerchantTradeNo: 'HP12345',
      TotalAmount: '499',
    })
    // SHA256 hex = 64 characters
    expect(mac).toMatch(/^[A-F0-9]{64}$/)
  })

  it('should produce deterministic output for same input', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'HP12345',
      TotalAmount: '499',
    }
    const mac1 = generateCheckMacValue(params)
    const mac2 = generateCheckMacValue(params)
    expect(mac1).toBe(mac2)
  })

  it('should produce different output for different input', () => {
    const mac1 = generateCheckMacValue({ MerchantTradeNo: 'HP111' })
    const mac2 = generateCheckMacValue({ MerchantTradeNo: 'HP222' })
    expect(mac1).not.toBe(mac2)
  })
})

describe('verifyCheckMacValue', () => {
  it('should verify a valid CheckMacValue', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'HP12345',
      TotalAmount: '499',
    }
    const mac = generateCheckMacValue(params)
    const paramsWithMac = { ...params, CheckMacValue: mac }
    expect(verifyCheckMacValue(paramsWithMac)).toBe(true)
  })

  it('should reject tampered CheckMacValue', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'HP12345',
      TotalAmount: '499',
    }
    const mac = generateCheckMacValue(params)
    const tampered = mac.replace(/.$/, mac.endsWith('0') ? '1' : '0')
    const paramsWithMac = { ...params, CheckMacValue: tampered }
    expect(verifyCheckMacValue(paramsWithMac)).toBe(false)
  })

  it('should reject missing CheckMacValue', () => {
    expect(verifyCheckMacValue({ MerchantID: '3002607' })).toBe(false)
  })
})
