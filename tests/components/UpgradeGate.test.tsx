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

  // ---- Link points to /upgrade (updated from /join) ----
  it('renders a link to /upgrade', () => {
    render(<UpgradeGate feature="Premium Feature" />)

    const links = screen.getAllByRole('link')
    const upgradeLink = links[0]
    expect(upgradeLink).toHaveAttribute('href', expect.stringContaining('/upgrade'))
  })

  // ---- Tracks analytics on click ----
  it('calls trackEvent with correct params when the upgrade link is clicked', () => {
    render(<UpgradeGate feature="AI Analysis" tier="coached" />)

    const links = screen.getAllByRole('link')
    fireEvent.click(links[0])

    expect(mockTrackEvent).toHaveBeenCalledWith('upgrade_cta_clicked', {
      feature: 'AI Analysis',
      tier: 'coached',
    })
  })

  it('passes default tier to trackEvent when not specified', () => {
    render(<UpgradeGate feature="Basic Feature" />)

    const links = screen.getAllByRole('link')
    fireEvent.click(links[0])

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

  // ---- New: Enhanced variant with currentTier ----
  it('shows upgrade path context when currentTier is provided', () => {
    render(
      <UpgradeGate
        feature="Training Log"
        tier="self_managed"
        currentTier="free"
      />
    )

    expect(screen.getByText(/免費版 → 自主管理版/)).toBeInTheDocument()
  })

  it('shows self_managed to coached upgrade path', () => {
    render(
      <UpgradeGate
        feature="Blood Analysis"
        tier="coached"
        currentTier="self_managed"
      />
    )

    expect(screen.getByText(/自主管理版 → 教練指導版/)).toBeInTheDocument()
  })

  // ---- New: Benefits list ----
  it('renders custom benefits list when provided with currentTier', () => {
    render(
      <UpgradeGate
        feature="Wellness Tracking"
        currentTier="free"
        benefits={['Mood tracking', 'Sleep analysis']}
      />
    )

    expect(screen.getByText('Mood tracking')).toBeInTheDocument()
    expect(screen.getByText('Sleep analysis')).toBeInTheDocument()
  })

  it('renders default benefits when currentTier provided but no custom benefits', () => {
    render(
      <UpgradeGate
        feature="Training"
        tier="self_managed"
        currentTier="free"
      />
    )

    // Default self_managed benefits include these
    expect(screen.getByText('身心狀態追蹤')).toBeInTheDocument()
    expect(screen.getByText('完整訓練記錄')).toBeInTheDocument()
  })

  // ---- New: Preview content ----
  it('renders blurred preview content when previewContent is provided', () => {
    render(
      <UpgradeGate
        feature="Charts"
        currentTier="free"
        previewContent={<div data-testid="preview">Chart Preview</div>}
      />
    )

    expect(screen.getByTestId('preview')).toBeInTheDocument()
    expect(screen.getByText('升級後解鎖')).toBeInTheDocument()
  })

  // ---- New: Link includes from and feature params ----
  it('includes from and feature params in upgrade link when currentTier is set', () => {
    render(
      <UpgradeGate
        feature="AI Chat"
        tier="self_managed"
        currentTier="free"
      />
    )

    const links = screen.getAllByRole('link')
    const ctaLink = links[0]
    expect(ctaLink).toHaveAttribute('href', expect.stringContaining('from=free'))
    expect(ctaLink).toHaveAttribute('href', expect.stringContaining('feature=AI'))
  })

  // ---- New: "View full comparison" link ----
  it('shows "view full comparison" link in enhanced variant', () => {
    render(
      <UpgradeGate
        feature="Feature"
        currentTier="free"
      />
    )

    expect(screen.getByText(/查看完整方案比較/)).toBeInTheDocument()
  })
})
