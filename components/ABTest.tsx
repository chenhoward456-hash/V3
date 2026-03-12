'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'
import { getVariant, trackExposure, EXPERIMENTS } from '@/lib/ab-testing'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ABTestProps {
  /** The experiment ID — must match a key in EXPERIMENTS or supply custom variants. */
  experimentId: string
  /** A map of variant name -> React element to render. */
  variants: Record<string, ReactNode>
  /** Optional fallback rendered while the variant is being resolved on the client. */
  fallback?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Declarative A/B test wrapper.
 *
 * Usage:
 * ```tsx
 * <ABTest
 *   experimentId="pricing_cta"
 *   variants={{
 *     original:     <Button>Upgrade</Button>,
 *     urgency:      <Button>Limited time — upgrade now</Button>,
 *     social_proof: <Button>200+ users love this</Button>,
 *   }}
 * />
 * ```
 *
 * The component resolves the variant on mount (client-side only) and fires a
 * single `ab_exposure` analytics event per page load.
 */
export default function ABTest({ experimentId, variants, fallback }: ABTestProps) {
  const [activeVariant, setActiveVariant] = useState<string | null>(null)
  const exposureTracked = useRef(false)

  useEffect(() => {
    // Look up the experiment definition for weights; fall back to equal weights
    // if the experiment is not in the registry.
    const experiment = EXPERIMENTS[experimentId]
    const variantNames = experiment?.variants ?? Object.keys(variants)
    const weights = experiment?.weights

    const variant = getVariant(experimentId, variantNames, weights)
    setActiveVariant(variant)

    // Fire exposure exactly once per mount
    if (!exposureTracked.current) {
      trackExposure(experimentId, variant)
      exposureTracked.current = true
    }
  }, [experimentId, variants])

  // SSR / first render: show fallback (or nothing) to avoid hydration mismatch
  if (activeVariant === null) {
    return <>{fallback ?? null}</>
  }

  // Render the matching variant; fall back to first available if the stored
  // variant somehow doesn't exist in the provided map.
  const content = variants[activeVariant] ?? Object.values(variants)[0] ?? null

  return <>{content}</>
}
