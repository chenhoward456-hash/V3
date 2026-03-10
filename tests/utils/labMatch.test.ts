import { describe, it, expect } from 'vitest'
import { matchLabName, getLabCanonicalId } from '@/utils/labMatch'

describe('matchLabName', () => {
  it('should match Chinese ferritin name', () => {
    expect(matchLabName('鐵蛋白', ['鐵蛋白', 'ferritin'])).toBe(true)
  })

  it('should match English ferritin name', () => {
    expect(matchLabName('Ferritin', ['鐵蛋白', 'ferritin'])).toBe(true)
  })

  it('should match vitamin D variants', () => {
    expect(matchLabName('維生素D', ['維生素d', 'vitamin d'])).toBe(true)
    expect(matchLabName('Vitamin D', ['維生素d', 'vitamin d'])).toBe(true)
    expect(matchLabName('25-OHD', ['維生素d', 'vitamin d'])).toBe(true)
  })

  it('should not match unrelated tests', () => {
    expect(matchLabName('鐵蛋白', ['鋅', 'zinc'])).toBe(false)
    expect(matchLabName('ALT', ['鐵蛋白', 'ferritin'])).toBe(false)
  })

  it('should handle case insensitivity', () => {
    expect(matchLabName('FERRITIN', ['ferritin'])).toBe(true)
    expect(matchLabName('hba1c', ['HbA1c'])).toBe(true)
  })

  it('should handle names with special characters', () => {
    expect(matchLabName('AST(GOT)', ['ast', 'got'])).toBe(true)
    expect(matchLabName('ALT/GPT', ['alt', 'gpt'])).toBe(true)
    expect(matchLabName('hs-CRP', ['crp', 'hs-crp'])).toBe(true)
  })

  it('should return false for unknown test names', () => {
    expect(matchLabName('unknown test', ['ferritin'])).toBe(false)
    expect(matchLabName('', ['ferritin'])).toBe(false)
  })

  it('should distinguish between similar tests', () => {
    // AST and ALT should not cross-match
    expect(matchLabName('AST', ['alt', 'gpt'])).toBe(false)
    expect(matchLabName('ALT', ['ast', 'got'])).toBe(false)
  })
})

describe('getLabCanonicalId', () => {
  it('should return canonical ID for known tests', () => {
    expect(getLabCanonicalId('鐵蛋白')).toBe('ferritin')
    expect(getLabCanonicalId('Ferritin')).toBe('ferritin')
    expect(getLabCanonicalId('HbA1c')).toBe('hba1c')
    expect(getLabCanonicalId('空腹血糖')).toBe('fasting_glucose')
  })

  it('should return null for unknown tests', () => {
    expect(getLabCanonicalId('unknown')).toBeNull()
    expect(getLabCanonicalId('')).toBeNull()
  })

  it('should handle hormone tests', () => {
    expect(getLabCanonicalId('睪固酮')).toBe('testosterone')
    expect(getLabCanonicalId('游離睪固酮')).toBe('free_testosterone')
    expect(getLabCanonicalId('皮質醇')).toBe('cortisol')
  })

  it('should handle liver function tests', () => {
    expect(getLabCanonicalId('AST')).toBe('ast')
    expect(getLabCanonicalId('GOT')).toBe('ast')
    expect(getLabCanonicalId('ALT')).toBe('alt')
    expect(getLabCanonicalId('GPT')).toBe('alt')
  })
})
