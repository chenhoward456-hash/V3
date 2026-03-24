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
  it('renders an anchor with /line route containing prefill message', () => {
    render(<LineButton source="nav_cta">Click me</LineButton>)

    const link = screen.getByText('Click me').closest('a')
    const href = link?.getAttribute('href') || ''
    expect(href).toMatch(/^\/line\?msg=/)
    expect(href).toContain('src=nav_cta')
  })

  it('generates context-aware default message based on intent', () => {
    render(<LineButton source="test" intent="fat_loss">LINE</LineButton>)

    const link = screen.getByText('LINE').closest('a')
    const href = link?.getAttribute('href') || ''
    // fat_loss intent should include 減脂 message
    expect(decodeURIComponent(href)).toContain('減脂')
  })

  it('generates message with article title when provided', () => {
    render(<LineButton source="blog_post" articleTitle="三層脂肪策略">LINE</LineButton>)

    const link = screen.getByText('LINE').closest('a')
    const href = link?.getAttribute('href') || ''
    expect(decodeURIComponent(href)).toContain('三層脂肪策略')
  })

  it('uses custom message prop when provided', () => {
    render(<LineButton source="test" message="自訂訊息內容">LINE</LineButton>)

    const link = screen.getByText('LINE').closest('a')
    const href = link?.getAttribute('href') || ''
    expect(decodeURIComponent(href)).toContain('自訂訊息內容')
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

  it('generates different messages for different sources', () => {
    const { unmount: u1 } = render(<LineButton source="homepage_hero">A</LineButton>)
    const href1 = screen.getByText('A').closest('a')?.getAttribute('href') || ''
    u1()

    const { unmount: u2 } = render(<LineButton source="remote_page">B</LineButton>)
    const href2 = screen.getByText('B').closest('a')?.getAttribute('href') || ''
    u2()

    expect(href1).not.toEqual(href2)
  })
})
