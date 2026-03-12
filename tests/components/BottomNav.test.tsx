import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BottomNav from '@/components/client/BottomNav'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const defaultTabs = [
  { id: 'home', icon: '🏠', label: '首頁' },
  { id: 'wellness', icon: '💚', label: '感受' },
  { id: 'food', icon: '🍽️', label: '飲食' },
  { id: 'training', icon: '🏋️', label: '訓練' },
]

const defaultProps = {
  tabs: defaultTabs,
  activeTab: 'home',
  completedMap: {} as Record<string, boolean>,
  isToday: true,
  onTabClick: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BottomNav', () => {
  beforeEach(() => {
    defaultProps.onTabClick = vi.fn()
  })

  // ---- Renders all nav items ----
  it('renders all tab labels and icons', () => {
    render(<BottomNav {...defaultProps} />)

    expect(screen.getByText('首頁')).toBeInTheDocument()
    expect(screen.getByText('感受')).toBeInTheDocument()
    expect(screen.getByText('飲食')).toBeInTheDocument()
    expect(screen.getByText('訓練')).toBeInTheDocument()
  })

  it('renders tab icons', () => {
    render(<BottomNav {...defaultProps} />)

    expect(screen.getByText('🏠')).toBeInTheDocument()
    expect(screen.getByText('💚')).toBeInTheDocument()
    expect(screen.getByText('🍽️')).toBeInTheDocument()
    expect(screen.getByText('🏋️')).toBeInTheDocument()
  })

  // ---- Active state ----
  it('applies active styling to the current tab', () => {
    render(<BottomNav {...defaultProps} activeTab="wellness" />)

    const wellnessButton = screen.getByText('感受').closest('button')
    const homeButton = screen.getByText('首頁').closest('button')

    // Active tab should have blue text class
    expect(wellnessButton?.className).toContain('text-blue-600')
    // Inactive tab should have gray text class
    expect(homeButton?.className).toContain('text-gray-400')
  })

  it('applies active styling to a different tab when activeTab changes', () => {
    const { rerender } = render(<BottomNav {...defaultProps} activeTab="home" />)

    const homeButton = screen.getByText('首頁').closest('button')
    expect(homeButton?.className).toContain('text-blue-600')

    rerender(<BottomNav {...defaultProps} activeTab="training" />)

    const trainingButton = screen.getByText('訓練').closest('button')
    expect(trainingButton?.className).toContain('text-blue-600')
    expect(homeButton?.className).toContain('text-gray-400')
  })

  // ---- Click triggers onTabClick ----
  it('calls onTabClick with the correct tab id when a tab is clicked', () => {
    const onTabClick = vi.fn()
    render(<BottomNav {...defaultProps} onTabClick={onTabClick} />)

    fireEvent.click(screen.getByText('感受').closest('button')!)
    expect(onTabClick).toHaveBeenCalledWith('wellness')

    fireEvent.click(screen.getByText('訓練').closest('button')!)
    expect(onTabClick).toHaveBeenCalledWith('training')

    expect(onTabClick).toHaveBeenCalledTimes(2)
  })

  // ---- Completed indicator ----
  it('shows a green dot for completed tabs when isToday is true', () => {
    const { container } = render(
      <BottomNav
        {...defaultProps}
        completedMap={{ home: true, wellness: true, food: false }}
        isToday={true}
      />
    )

    // Green dots should be present for completed items
    const greenDots = container.querySelectorAll('.bg-green-400')
    expect(greenDots.length).toBe(2) // home and wellness are completed
  })

  it('does not show green dots when isToday is false', () => {
    const { container } = render(
      <BottomNav
        {...defaultProps}
        completedMap={{ home: true, wellness: true }}
        isToday={false}
      />
    )

    const greenDots = container.querySelectorAll('.bg-green-400')
    expect(greenDots.length).toBe(0)
  })

  // ---- Returns null for single tab ----
  it('returns null when there is only one tab', () => {
    const { container } = render(
      <BottomNav
        {...defaultProps}
        tabs={[{ id: 'home', icon: '🏠', label: '首頁' }]}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  // ---- Returns null for empty tabs ----
  it('returns null when tabs array is empty', () => {
    const { container } = render(
      <BottomNav
        {...defaultProps}
        tabs={[]}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  // ---- Renders as a nav element ----
  it('renders a <nav> element', () => {
    const { container } = render(<BottomNav {...defaultProps} />)

    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })

  // ---- Fixed bottom positioning ----
  it('has fixed bottom positioning classes', () => {
    const { container } = render(<BottomNav {...defaultProps} />)

    const nav = container.querySelector('nav')
    expect(nav?.className).toContain('fixed')
    expect(nav?.className).toContain('bottom-0')
  })
})
