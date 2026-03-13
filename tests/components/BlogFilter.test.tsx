import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BlogFilter from '@/components/BlogFilter'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const samplePosts = [
  { id: '1', title: '血檢文章', description: 'desc1', date: '2026-01-01', category: '血檢優化', readTime: '5 min', slug: 'blood-test' },
  { id: '2', title: '營養文章', description: 'desc2', date: '2026-01-02', category: '營養科學', readTime: '8 min', slug: 'nutrition' },
  { id: '3', title: '訓練文章', description: 'desc3', date: '2026-01-03', category: '訓練方法', readTime: '6 min', slug: 'training' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BlogFilter', () => {
  it('renders all category buttons', () => {
    render(<BlogFilter posts={samplePosts} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)

    const buttonLabels = buttons.map((btn) => btn.textContent)
    expect(buttonLabels).toEqual(['全部', '血檢優化', '營養科學', '訓練方法', '恢復優化', '個案追蹤'])
  })

  it('shows all posts by default (全部 selected)', () => {
    render(<BlogFilter posts={samplePosts} />)

    expect(screen.getByText('血檢文章')).toBeInTheDocument()
    expect(screen.getByText('營養文章')).toBeInTheDocument()
    expect(screen.getByText('訓練文章')).toBeInTheDocument()
  })

  it('filters posts when a category is clicked', () => {
    render(<BlogFilter posts={samplePosts} />)

    fireEvent.click(screen.getByRole('button', { name: '篩選血檢優化分類' }))

    expect(screen.getByText('血檢文章')).toBeInTheDocument()
    expect(screen.queryByText('營養文章')).not.toBeInTheDocument()
    expect(screen.queryByText('訓練文章')).not.toBeInTheDocument()
  })

  it('shows empty state when no posts match the selected category', () => {
    render(<BlogFilter posts={samplePosts} />)

    fireEvent.click(screen.getByText('恢復優化'))

    expect(screen.getByText('此分類暫無文章')).toBeInTheDocument()
  })

  it('all category buttons have aria-label attributes', () => {
    render(<BlogFilter posts={samplePosts} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-label')
    })
  })

  it('renders post links with correct href', () => {
    render(<BlogFilter posts={samplePosts} />)

    const link = screen.getByText('血檢文章').closest('a')
    expect(link).toHaveAttribute('href', '/blog/blood-test')
  })
})
