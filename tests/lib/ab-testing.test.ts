import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock analytics before importing the module ──

const mockTrackEvent = vi.fn()

vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}))

import {
  getVariant,
  forceVariant,
  clearVariant,
  peekVariant,
  trackExposure,
  trackConversion,
  EXPERIMENTS,
} from '@/lib/ab-testing'

// ── localStorage mock ──

function createLocalStorageMock() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store,
  }
}

describe('ab-testing', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    localStorageMock = createLocalStorageMock()
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock },
      writable: true,
      configurable: true,
    })
    mockTrackEvent.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── EXPERIMENTS registry ──

  describe('EXPERIMENTS registry', () => {
    it('contains expected experiment definitions', () => {
      expect(EXPERIMENTS.pricing_cta).toBeDefined()
      expect(EXPERIMENTS.pricing_cta.variants).toEqual(['original', 'urgency', 'social_proof'])
      expect(EXPERIMENTS.onboarding_flow).toBeDefined()
      expect(EXPERIMENTS.onboarding_flow.variants).toEqual(['modal', 'checklist'])
      expect(EXPERIMENTS.landing_hero).toBeDefined()
    })
  })

  // ── getVariant ──

  describe('getVariant', () => {
    it('returns a variant from the provided list', () => {
      const variant = getVariant('test_exp', ['a', 'b', 'c'])
      expect(['a', 'b', 'c']).toContain(variant)
    })

    it('returns consistent sticky variant on repeated calls', () => {
      const first = getVariant('sticky_test', ['x', 'y'])
      const second = getVariant('sticky_test', ['x', 'y'])
      const third = getVariant('sticky_test', ['x', 'y'])
      expect(second).toBe(first)
      expect(third).toBe(first)
    })

    it('stores the variant in localStorage under ab_ prefix', () => {
      const variant = getVariant('store_test', ['alpha', 'beta'])
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_store_test', variant)
    })

    it('reads existing variant from localStorage without re-rolling', () => {
      localStorageMock._store['ab_preexisting'] = 'beta'
      const variant = getVariant('preexisting', ['alpha', 'beta', 'gamma'])
      expect(variant).toBe('beta')
      // Should not have written a new value
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('re-rolls if stored variant is not in current variants list', () => {
      localStorageMock._store['ab_changed'] = 'removed_variant'
      const variant = getVariant('changed', ['alpha', 'beta'])
      expect(['alpha', 'beta']).toContain(variant)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('respects weighted selection', () => {
      // Force Math.random to always return 0.99 so the last variant is picked
      // with weights [0.01, 0.01, 0.98]
      vi.spyOn(Math, 'random').mockReturnValue(0.99)
      const variant = getVariant('weighted_test', ['a', 'b', 'c'], [0.01, 0.01, 0.98])
      expect(variant).toBe('c')
    })

    it('respects weighted selection - picks first with low random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.001)
      const variant = getVariant('weighted_low', ['a', 'b', 'c'], [0.5, 0.3, 0.2])
      expect(variant).toBe('a')
    })

    it('handles equal weights correctly', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const variant = getVariant('equal_w', ['a', 'b'], [0.5, 0.5])
      // random=0.5 => 0.5*1.0=0.5, 0.5-0.5=0 => <=0, so 'a'
      expect(variant).toBe('a')
    })

    it('falls back to equal weight when weights length mismatches', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0)
      const variant = getVariant('mismatch_w', ['a', 'b', 'c'], [0.5, 0.5])
      // weights length !== variants length => equal weight fallback
      // Math.floor(0.0 * 3) = 0 => 'a'
      expect(variant).toBe('a')
    })

    it('handles SSR (no window) by returning first variant', () => {
      // Remove window to simulate SSR
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      const variant = getVariant('ssr_test', ['first', 'second', 'third'])
      expect(variant).toBe('first')
    })

    it('handles localStorage getItem throwing by re-rolling', () => {
      localStorageMock.getItem.mockImplementation(() => { throw new Error('Quota exceeded') })
      const variant = getVariant('error_read', ['a', 'b'])
      expect(['a', 'b']).toContain(variant)
    })

    it('handles localStorage setItem throwing gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => { throw new Error('Quota exceeded') })
      // Should not throw
      const variant = getVariant('error_write', ['a', 'b'])
      expect(['a', 'b']).toContain(variant)
    })
  })

  // ── forceVariant ──

  describe('forceVariant', () => {
    it('overrides stored variant', () => {
      getVariant('force_test', ['a', 'b'])
      forceVariant('force_test', 'b')
      expect(localStorageMock._store['ab_force_test']).toBe('b')
    })

    it('sets variant that getVariant will read back', () => {
      forceVariant('force_read', 'custom')
      // Now getVariant should return the forced value (if in list)
      const variant = getVariant('force_read', ['custom', 'other'])
      expect(variant).toBe('custom')
    })

    it('does nothing during SSR', () => {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      // Should not throw
      forceVariant('ssr_force', 'something')
    })
  })

  // ── clearVariant ──

  describe('clearVariant', () => {
    it('removes stored variant', () => {
      getVariant('clear_test', ['a', 'b'])
      clearVariant('clear_test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ab_clear_test')
    })

    it('causes getVariant to re-roll on next call', () => {
      forceVariant('clear_reroll', 'forced')
      clearVariant('clear_reroll')
      // After clearing, a new variant should be assigned
      const variant = getVariant('clear_reroll', ['x', 'y'])
      expect(['x', 'y']).toContain(variant)
    })

    it('does nothing during SSR', () => {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      clearVariant('ssr_clear')
    })
  })

  // ── peekVariant ──

  describe('peekVariant', () => {
    it('reads variant without writing', () => {
      forceVariant('peek_test', 'alpha')
      localStorageMock.setItem.mockClear()

      const result = peekVariant('peek_test')
      expect(result).toBe('alpha')
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('returns null when no variant assigned', () => {
      const result = peekVariant('nonexistent')
      expect(result).toBeNull()
    })

    it('returns null during SSR', () => {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      const result = peekVariant('ssr_peek')
      expect(result).toBeNull()
    })

    it('returns null when localStorage throws', () => {
      localStorageMock.getItem.mockImplementation(() => { throw new Error('fail') })
      const result = peekVariant('error_peek')
      expect(result).toBeNull()
    })
  })

  // ── trackExposure / trackConversion ──

  describe('trackExposure', () => {
    it('calls trackEvent with ab_exposure', () => {
      trackExposure('pricing_cta', 'urgency')
      expect(mockTrackEvent).toHaveBeenCalledWith('ab_exposure', {
        experiment: 'pricing_cta',
        variant: 'urgency',
      })
    })
  })

  describe('trackConversion', () => {
    it('calls trackEvent with ab_conversion and action', () => {
      trackConversion('pricing_cta', 'social_proof', 'click_upgrade')
      expect(mockTrackEvent).toHaveBeenCalledWith('ab_conversion', {
        experiment: 'pricing_cta',
        variant: 'social_proof',
        action: 'click_upgrade',
      })
    })
  })
})
