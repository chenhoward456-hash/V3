import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeGate from '@/components/client/UpgradeGate'

// ---------------------------------------------------------------------------
// Mock next/link -- render as a plain <a> tag
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    React.createElement('a', { href, ...props }, children)
  ),
}))

// ---------------------------------------------------------------------------
// Mock analytics
// ---------------------------------------------------------------------------
const mockTrackEvent = vi.fn()
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UpgradeGate', () => {
  beforeEach(() => {
    mockTrackEvent.mockReset()
  })

  // ---- Renders feature name ----
  it('displays the feature name prominently', () => {
    render(<UpgradeGate feature="AI Recovery Analysis" />)

    expect(screen.getByText('AI Recovery Analysis')).toBeInTheDocument()
  })

  // ---- Renders lock icon ----
  it('shows a lock icon', () => {
    render(<UpgradeGate feature="Premium Feature" />)

    expect(screen.getByText('🔒')).toBeInTheDocument()
  })

  // ---- Renders optional description ----
  it('renders the description when provided', () => {
    render(
      <UpgradeGate
        feature="Advanced Charts"
        description="Unlock detailed analytics and trend visualization"
      />
    )

    expect(screen.getByText('Unlock detailed analytics and trend visualization')).toBeInTheDocument()
  })

  it('does not render description text when not provided', () => {
    const { container } = render(<UpgradeGate feature="Basic Feature" />)

    // Only two text elements: the feature name and the button
    const paragraphs = container.querySelectorAll('p')
    // There should be exactly 1 paragraph (the feature name), no description
    expect(paragraphs.length).toBe(1)
  })

  // ---- Default tier: self_managed ----
  it('defaults to self_managed tier with NT$499 price', () => {
    render(<UpgradeGate feature="Some Feature" />)

    expect(screen.getByText(/自主管理方案/)).toBeInTheDocument()
    expect(screen.getByText(/NT\$499/)).toBeInTheDocument()
  })

  // ---- Coached tier ----
  it('shows coached tier label and NT$2,999 price when tier is coached', () => {
    render(<UpgradeGate feature="Coaching Feature" tier="coached" />)

    expect(screen.getByText(/教練指導方案/)).toBeInTheDocument()
    expect(screen.getByText(/NT\$2,999/)).toBeInTheDocument()
  })

  // ---- Link points to /join ----
  it('renders a link to /join', () => {
    render(<UpgradeGate feature="Premium Feature" />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/join')
  })

  // ---- Tracks analytics on click ----
  it('calls trackEvent with correct params when the upgrade link is clicked', () => {
    render(<UpgradeGate feature="AI Analysis" tier="coached" />)

    const link = screen.getByRole('link')
    fireEvent.click(link)

    expect(mockTrackEvent).toHaveBeenCalledWith('upgrade_cta_clicked', {
      feature: 'AI Analysis',
      tier: 'coached',
    })
  })

  it('passes default tier to trackEvent when not specified', () => {
    render(<UpgradeGate feature="Basic Feature" />)

    const link = screen.getByRole('link')
    fireEvent.click(link)

    expect(mockTrackEvent).toHaveBeenCalledWith('upgrade_cta_clicked', {
      feature: 'Basic Feature',
      tier: 'self_managed',
    })
  })

  // ---- Visual styling: gradient background ----
  it('has a gradient background container', () => {
    const { container } = render(<UpgradeGate feature="Feature" />)

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('bg-gradient-to-br')
    expect(wrapper.className).toContain('from-blue-50')
  })
})
