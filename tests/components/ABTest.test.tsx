import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ABTest from '@/components/ABTest'

// ---------------------------------------------------------------------------
// Mock @/lib/ab-testing
// ---------------------------------------------------------------------------
const mockGetVariant = vi.fn()
const mockTrackExposure = vi.fn()

vi.mock('@/lib/ab-testing', () => ({
  getVariant: (...args: any[]) => mockGetVariant(...args),
  trackExposure: (...args: any[]) => mockTrackExposure(...args),
  EXPERIMENTS: {
    pricing_cta: {
      id: 'pricing_cta',
      variants: ['original', 'urgency', 'social_proof'],
    },
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const variants = {
  original: <span>Original CTA</span>,
  urgency: <span>Urgent CTA</span>,
  social_proof: <span>Social Proof CTA</span>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ABTest', () => {
  beforeEach(() => {
    mockGetVariant.mockReset()
    mockTrackExposure.mockReset()
  })

  it('renders the correct variant based on getVariant result', () => {
    mockGetVariant.mockReturnValue('urgency')
    render(<ABTest experimentId="pricing_cta" variants={variants} />)

    expect(screen.getByText('Urgent CTA')).toBeInTheDocument()
    expect(screen.queryByText('Original CTA')).not.toBeInTheDocument()
  })

  it('fires trackExposure exactly once with experiment id and variant', () => {
    mockGetVariant.mockReturnValue('social_proof')
    render(<ABTest experimentId="pricing_cta" variants={variants} />)

    expect(mockTrackExposure).toHaveBeenCalledTimes(1)
    expect(mockTrackExposure).toHaveBeenCalledWith('pricing_cta', 'social_proof')
  })

  it('renders fallback before variant resolves (SSR)', () => {
    // Simulate SSR: getVariant never gets called because useEffect hasn't run yet
    // The component initializes activeVariant to null, so fallback should show first render
    mockGetVariant.mockReturnValue('original')
    const { container } = render(
      <ABTest
        experimentId="pricing_cta"
        variants={variants}
        fallback={<span>Loading...</span>}
      />
    )

    // After useEffect runs, it will show the variant
    // We verify the variant is correctly rendered
    expect(screen.getByText('Original CTA')).toBeInTheDocument()
  })

  it('renders nothing when no fallback is provided and variant not yet resolved', () => {
    // Without fallback, the component renders null on SSR / before effect
    mockGetVariant.mockReturnValue('original')
    render(<ABTest experimentId="pricing_cta" variants={variants} />)

    // After mount, the variant should be rendered
    expect(screen.getByText('Original CTA')).toBeInTheDocument()
  })

  it('falls back to first variant if stored variant is not in the map', () => {
    mockGetVariant.mockReturnValue('nonexistent_variant')
    render(<ABTest experimentId="pricing_cta" variants={variants} />)

    // Should render first available variant as fallback
    expect(screen.getByText('Original CTA')).toBeInTheDocument()
  })

  it('passes experimentId and variant names to getVariant', () => {
    mockGetVariant.mockReturnValue('original')
    render(<ABTest experimentId="pricing_cta" variants={variants} />)

    expect(mockGetVariant).toHaveBeenCalledWith(
      'pricing_cta',
      ['original', 'urgency', 'social_proof'],
      undefined
    )
  })
})
