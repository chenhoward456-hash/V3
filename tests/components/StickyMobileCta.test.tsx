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
// Helpers
// ---------------------------------------------------------------------------
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StickyMobileCta', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true })
    mockLocalStorage.clear()
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

  it('shows diagnosis CTA when user has NOT completed diagnosis', () => {
    render(<StickyMobileCta />)

    expect(screen.getByText('60 秒免費體態分析')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    const primaryLink = links.find(l => l.textContent === '60 秒免費體態分析')
    expect(primaryLink).toHaveAttribute('href', '/diagnosis')
  })

  it('shows plan CTA when user HAS completed diagnosis (demo_step = 3)', () => {
    mockLocalStorage.setItem('demo_step', '3')

    render(<StickyMobileCta />)

    expect(screen.getByText('查看完整方案')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    const primaryLink = links.find(l => l.textContent === '查看完整方案')
    expect(primaryLink).toHaveAttribute('href', '/remote')
  })

  it('always renders the paid upgrade CTA', () => {
    render(<StickyMobileCta />)

    expect(screen.getByText(/NT\$499/)).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    const paidLink = links.find(l => l.textContent?.includes('NT$499'))
    expect(paidLink).toHaveAttribute('href', '/join')
  })
})
