import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuickActions from '@/components/client/QuickActions'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const sections = [
  { id: 'body', icon: '⚖️', label: 'Weight', completed: false },
  { id: 'nutrition', icon: '🍽️', label: 'Nutrition', completed: false },
  { id: 'training', icon: '🏋️', label: 'Training', completed: true },
  { id: 'wellness', icon: '💚', label: 'Wellness', completed: false },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('QuickActions', () => {
  it('renders all actions (completed and uncompleted)', () => {
    render(<QuickActions enabledSections={sections} onNavigate={vi.fn()} />)

    expect(screen.getByText('Weight')).toBeInTheDocument()
    expect(screen.getByText('Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Wellness')).toBeInTheDocument()
    // Training is completed but still shown (with ✅)
    expect(screen.getByText('Training')).toBeInTheDocument()
  })

  it('calls onNavigate with the correct section id when clicked', () => {
    const onNavigate = vi.fn()
    render(<QuickActions enabledSections={sections} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('Weight'))
    expect(onNavigate).toHaveBeenCalledWith('body')

    fireEvent.click(screen.getByText('Wellness'))
    expect(onNavigate).toHaveBeenCalledWith('wellness')

    expect(onNavigate).toHaveBeenCalledTimes(2)
  })

  it('shows "All done" message when every section is completed', () => {
    const allDone = sections.map(s => ({ ...s, completed: true }))
    render(<QuickActions enabledSections={allDone} onNavigate={vi.fn()} />)

    expect(screen.getByText('今天全部完成 💪')).toBeInTheDocument()
  })

  it('renders nothing when enabledSections is empty', () => {
    const { container } = render(
      <QuickActions enabledSections={[]} onNavigate={vi.fn()} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders icons alongside labels', () => {
    render(<QuickActions enabledSections={sections} onNavigate={vi.fn()} />)

    expect(screen.getByText('⚖️')).toBeInTheDocument()
    expect(screen.getByText('🍽️')).toBeInTheDocument()
    expect(screen.getByText('💚')).toBeInTheDocument()
  })
})
