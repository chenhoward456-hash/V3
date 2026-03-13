import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StickyMobileCta from '@/components/StickyMobileCta'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StickyMobileCta', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is hidden initially (scrollY = 0)', () => {
    const { container } = render(<StickyMobileCta />)

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('translate-y-full')
  })

  it('becomes visible after scrolling past 600px', () => {
    const { container } = render(<StickyMobileCta />)

    Object.defineProperty(window, 'scrollY', { value: 700, writable: true })
    fireEvent.scroll(window)

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('translate-y-0')
  })

  it('hides again when scrolling back above 600px', () => {
    const { container } = render(<StickyMobileCta />)

    // Scroll down
    Object.defineProperty(window, 'scrollY', { value: 700, writable: true })
    fireEvent.scroll(window)

    // Scroll back up
    Object.defineProperty(window, 'scrollY', { value: 300, writable: true })
    fireEvent.scroll(window)

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('translate-y-full')
  })

  it('renders CTA links pointing to /join', () => {
    render(<StickyMobileCta />)

    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/join')
    })
  })

  it('renders both free and paid CTA labels', () => {
    render(<StickyMobileCta />)

    expect(screen.getByText('免費開始')).toBeInTheDocument()
    expect(screen.getByText(/NT\$499/)).toBeInTheDocument()
  })
})
