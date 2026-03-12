import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CollapsibleSection from '@/components/client/CollapsibleSection'

// ---------------------------------------------------------------------------
// Mock ResizeObserver (not available in jsdom)
// ---------------------------------------------------------------------------
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as any

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const baseProps = {
  id: 'section-body',
  icon: '🏋️',
  title: 'Training',
  isCompleted: false,
  isToday: true,
  children: <div>Section content here</div>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CollapsibleSection', () => {
  it('renders expanded by default when not completed', () => {
    render(<CollapsibleSection {...baseProps} />)

    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Section content here')).toBeInTheDocument()

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('auto-collapses when completed and isToday', () => {
    render(
      <CollapsibleSection {...baseProps} isCompleted={true} isToday={true} />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows summary line when collapsed, completed, and isToday', () => {
    render(
      <CollapsibleSection
        {...baseProps}
        isCompleted={true}
        isToday={true}
        summaryLine="Completed: 3 sets logged"
      />
    )

    expect(screen.getByText('Completed: 3 sets logged')).toBeInTheDocument()
  })

  it('toggles open/closed on click when isToday', () => {
    render(
      <CollapsibleSection {...baseProps} isCompleted={true} isToday={true} />
    )

    const headerButton = screen.getAllByRole('button')[0]
    expect(headerButton).toHaveAttribute('aria-expanded', 'false')

    // Click to expand
    fireEvent.click(headerButton)
    expect(headerButton).toHaveAttribute('aria-expanded', 'true')

    // Click to collapse again
    fireEvent.click(headerButton)
    expect(headerButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays expanded and has no toggle button when not today (past date)', () => {
    render(
      <CollapsibleSection
        {...baseProps}
        isCompleted={true}
        isToday={false}
      />
    )

    // No button rendered for past dates
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    // Content is always visible
    expect(screen.getByText('Section content here')).toBeInTheDocument()
  })

  it('respects defaultOpen=true even when completed and isToday', () => {
    render(
      <CollapsibleSection
        {...baseProps}
        isCompleted={true}
        isToday={true}
        defaultOpen={true}
      />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('sets correct aria-controls linking header to content', () => {
    render(<CollapsibleSection {...baseProps} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-controls', 'section-body-content')
  })
})
