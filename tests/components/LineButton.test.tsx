import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LineButton from '@/components/LineButton'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockTrackLineClick = vi.fn()
vi.mock('@/lib/analytics', () => ({
  trackLineClick: (...args: any[]) => mockTrackLineClick(...args),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LineButton', () => {
  it('renders an anchor element with the LINE URL', () => {
    render(<LineButton source="test">Click me</LineButton>)

    const link = screen.getByText('Click me')
    expect(link.closest('a')).toHaveAttribute('href', 'https://lin.ee/LP65rCc')
  })

  it('has target="_blank" for external link', () => {
    render(<LineButton source="test">LINE</LineButton>)

    const link = screen.getByText('LINE').closest('a')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('has rel="noopener noreferrer" for security', () => {
    render(<LineButton source="test">LINE</LineButton>)

    const link = screen.getByText('LINE').closest('a')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('calls trackLineClick with source and options on click', () => {
    mockTrackLineClick.mockReset()
    render(
      <LineButton source="nav_cta" intent="general" slug="test-slug" articleTitle="Test Article">
        CTA
      </LineButton>
    )

    fireEvent.click(screen.getByText('CTA'))

    expect(mockTrackLineClick).toHaveBeenCalledWith('nav_cta', {
      intent: 'general',
      slug: 'test-slug',
      articleTitle: 'Test Article',
      variant: undefined,
    })
  })

  it('applies custom className', () => {
    render(<LineButton source="test" className="bg-green-500 text-white">Styled</LineButton>)

    const link = screen.getByText('Styled').closest('a')
    expect(link).toHaveClass('bg-green-500')
    expect(link).toHaveClass('text-white')
  })

  it('renders children content', () => {
    render(
      <LineButton source="footer">
        <span data-testid="child">Custom Child</span>
      </LineButton>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
