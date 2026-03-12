import { trackEvent } from './analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Experiment {
  id: string           // e.g. 'pricing_cta'
  variants: string[]   // e.g. ['control', 'urgency', 'social_proof']
  weights?: number[]   // e.g. [0.34, 0.33, 0.33] — optional, defaults to equal
}

// ---------------------------------------------------------------------------
// Active experiments registry
// ---------------------------------------------------------------------------

export const EXPERIMENTS: Record<string, Experiment> = {
  pricing_cta: {
    id: 'pricing_cta',
    variants: ['original', 'urgency', 'social_proof'],
    // Equal split by default (~33% each)
  },
  onboarding_flow: {
    id: 'onboarding_flow',
    variants: ['modal', 'checklist'],
  },
  landing_hero: {
    id: 'landing_hero',
    variants: ['data_focus', 'coach_focus'],
  },
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Build a localStorage key for a given experiment.
 */
function storageKey(experimentId: string): string {
  return `ab_${experimentId}`
}

/**
 * Pick a variant using weighted random selection.
 * If no weights are provided, all variants are equally likely.
 */
function pickWeightedVariant(variants: string[], weights?: number[]): string {
  if (!weights || weights.length !== variants.length) {
    // Equal weight fallback
    return variants[Math.floor(Math.random() * variants.length)]
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight
  for (let i = 0; i < variants.length; i++) {
    random -= weights[i]
    if (random <= 0) return variants[i]
  }
  // Fallback (should never reach here, but just in case of float issues)
  return variants[variants.length - 1]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or assign a variant for a user. The assignment is sticky — once a
 * variant is stored in localStorage it will always be returned for the same
 * experiment, ensuring a consistent experience across sessions.
 *
 * Safe to call on the server — returns the first variant when `window` is
 * not available (SSR fallback).
 */
export function getVariant(
  experimentId: string,
  variants: string[],
  weights?: number[],
): string {
  if (typeof window === 'undefined') {
    // SSR: return first variant as a stable fallback; the client will
    // hydrate with the real assignment.
    return variants[0]
  }

  const key = storageKey(experimentId)

  try {
    const stored = window.localStorage.getItem(key)
    if (stored && variants.includes(stored)) {
      return stored
    }
  } catch {
    // localStorage may be unavailable (private browsing, quota, etc.)
  }

  const variant = pickWeightedVariant(variants, weights)

  try {
    window.localStorage.setItem(key, variant)
  } catch {
    // Silently ignore write failures
  }

  return variant
}

/**
 * Track that a user has been *exposed* to an experiment variant (impression).
 */
export function trackExposure(experimentId: string, variant: string): void {
  trackEvent('ab_exposure', {
    experiment: experimentId,
    variant,
  })
}

/**
 * Track a conversion event tied to an experiment variant.
 *
 * @param action  A short label describing the conversion, e.g. 'click_upgrade'
 */
export function trackConversion(
  experimentId: string,
  variant: string,
  action: string,
): void {
  trackEvent('ab_conversion', {
    experiment: experimentId,
    variant,
    action,
  })
}

// ---------------------------------------------------------------------------
// Debug / admin helpers
// ---------------------------------------------------------------------------

/**
 * Force a specific variant for an experiment (useful for QA / testing).
 */
export function forceVariant(experimentId: string, variant: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(experimentId), variant)
  } catch {
    // ignore
  }
}

/**
 * Clear a stored variant so the next call to `getVariant` re-rolls.
 */
export function clearVariant(experimentId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(experimentId))
  } catch {
    // ignore
  }
}

/**
 * Read the currently assigned variant without creating a new assignment.
 * Returns `null` if no variant has been assigned yet.
 */
export function peekVariant(experimentId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey(experimentId))
  } catch {
    return null
  }
}
