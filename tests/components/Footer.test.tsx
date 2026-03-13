import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

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
describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />)

    expect(screen.getByText('Howard Protocol')).toBeInTheDocument()
  })

  it('renders all service links', () => {
    render(<Footer />)

    const serviceLinks = [
      { text: '遠端追蹤方案', href: '/remote' },
      { text: '實體訓練方案', href: '/action' },
      { text: '免費系統分析', href: '/diagnosis' },
      { text: '個案追蹤', href: '/case' },
    ]

    serviceLinks.forEach(({ text, href }) => {
      const link = screen.getByText(text)
      expect(link.closest('a')).toHaveAttribute('href', href)
    })
  })

  it('renders the copyright notice with year 2026', () => {
    render(<Footer />)

    expect(screen.getByText(/2026 The Howard Protocol/)).toBeInTheDocument()
  })

  it('renders the Instagram social link with target="_blank"', () => {
    render(<Footer />)

    const igLink = screen.getByText(/@chenhoward/)
    const anchor = igLink.closest('a')
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    expect(anchor).toHaveAttribute('href', 'https://instagram.com/chenhoward')
  })

  it('renders legal links (privacy, terms, medical disclaimer, refund)', () => {
    render(<Footer />)

    expect(screen.getByText('隱私政策').closest('a')).toHaveAttribute('href', '/privacy')
    expect(screen.getByText('服務條款').closest('a')).toHaveAttribute('href', '/terms')
    expect(screen.getByText('醫療免責聲明').closest('a')).toHaveAttribute('href', '/medical-disclaimer')
    expect(screen.getByText('退費政策').closest('a')).toHaveAttribute('href', '/refund-policy')
  })

  it('renders contact information', () => {
    render(<Footer />)

    expect(screen.getByText(/chenhoward456@gmail.com/)).toBeInTheDocument()
    expect(screen.getByText(/0978-185-268/)).toBeInTheDocument()
  })
})
