import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Navigation from '@/components/Navigation'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/lib/analytics', () => ({
  trackLineClick: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Navigation', () => {
  it('renders all nav link labels', () => {
    render(<Navigation />)

    const expectedLabels = ['系統介紹', '免費體驗', 'AI 顧問', '知識分享', '成功案例', '方案說明']
    expectedLabels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders the brand name linking to home', () => {
    render(<Navigation />)

    const brandLinks = screen.getAllByText('Howard Protocol')
    expect(brandLinks[0].closest('a')).toHaveAttribute('href', '/')
  })

  it('hamburger button has aria-expanded=false by default', () => {
    render(<Navigation />)

    const hamburger = screen.getByLabelText('Toggle menu')
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles aria-expanded on hamburger click', () => {
    render(<Navigation />)

    const hamburger = screen.getByLabelText('Toggle menu')

    fireEvent.click(hamburger)
    expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(hamburger)
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders close button with correct aria-label when menu is open', () => {
    render(<Navigation />)

    const hamburger = screen.getByLabelText('Toggle menu')
    fireEvent.click(hamburger)

    expect(screen.getByLabelText('關閉選單')).toBeInTheDocument()
  })

  it('renders LINE CTA buttons', () => {
    render(<Navigation />)

    const lineButtons = screen.getAllByText('加 LINE 諮詢')
    expect(lineButtons.length).toBeGreaterThanOrEqual(1)
  })
})
