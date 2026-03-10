import { describe, it, expect } from 'vitest'
import { getDefaultFeatures, type SubscriptionTier } from '@/lib/tier-defaults'

describe('getDefaultFeatures', () => {
  it('should return free tier features', () => {
    const features = getDefaultFeatures('free')
    expect(features.body_composition_enabled).toBe(true)
    expect(features.nutrition_enabled).toBe(true)
    expect(features.wellness_enabled).toBe(false)
    expect(features.training_enabled).toBe(false)
    expect(features.supplement_enabled).toBe(false)
    expect(features.lab_enabled).toBe(false)
    expect(features.ai_chat_enabled).toBe(false)
    expect(features.is_active).toBe(true)
  })

  it('should return self_managed tier features', () => {
    const features = getDefaultFeatures('self_managed')
    expect(features.body_composition_enabled).toBe(true)
    expect(features.nutrition_enabled).toBe(true)
    expect(features.wellness_enabled).toBe(true)
    expect(features.training_enabled).toBe(true)
    expect(features.supplement_enabled).toBe(false)
    expect(features.lab_enabled).toBe(false)
    expect(features.ai_chat_enabled).toBe(true)
    expect(features.is_active).toBe(true)
  })

  it('should return coached tier features with all enabled', () => {
    const features = getDefaultFeatures('coached')
    expect(features.body_composition_enabled).toBe(true)
    expect(features.nutrition_enabled).toBe(true)
    expect(features.wellness_enabled).toBe(true)
    expect(features.training_enabled).toBe(true)
    expect(features.supplement_enabled).toBe(true)
    expect(features.lab_enabled).toBe(true)
    expect(features.ai_chat_enabled).toBe(true)
    expect(features.is_active).toBe(true)
  })

  it('should always include is_active: true', () => {
    const tiers: SubscriptionTier[] = ['free', 'self_managed', 'coached']
    for (const tier of tiers) {
      expect(getDefaultFeatures(tier).is_active).toBe(true)
    }
  })

  it('should have progressive feature unlocking', () => {
    const free = getDefaultFeatures('free')
    const selfManaged = getDefaultFeatures('self_managed')
    const coached = getDefaultFeatures('coached')

    // Count enabled features (excluding is_active and simple_mode)
    const countEnabled = (f: Record<string, boolean>) =>
      Object.entries(f).filter(([k, v]) => v === true && k !== 'is_active' && k !== 'simple_mode').length

    expect(countEnabled(free)).toBeLessThan(countEnabled(selfManaged))
    expect(countEnabled(selfManaged)).toBeLessThan(countEnabled(coached))
  })
})
