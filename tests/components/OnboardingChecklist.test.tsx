import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import OnboardingChecklist from '@/components/client/OnboardingChecklist'

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const baseProps = {
  clientId: 'test-123',
  clientName: 'Alice',
  tier: 'self_managed',
  hasWeight: false,
  hasNutrition: false,
  hasTraining: false,
  hasWellness: false,
  hasLineBinding: false,
  trainingEnabled: true,
  wellnessEnabled: true,
  onDismiss: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('OnboardingChecklist', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorageMock.clear()
    baseProps.onDismiss = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders all checklist items when all features enabled', () => {
    render(<OnboardingChecklist {...baseProps} />)

    expect(screen.getByText('記錄第一筆體重')).toBeInTheDocument()
    expect(screen.getByText('記錄第一筆飲食')).toBeInTheDocument()
    expect(screen.getByText('記錄第一筆訓練')).toBeInTheDocument()
    expect(screen.getByText('記錄身心狀態')).toBeInTheDocument()
    expect(screen.getByText('綁定 LINE')).toBeInTheDocument()
  })

  it('omits training/wellness items when those features are disabled', () => {
    render(
      <OnboardingChecklist
        {...baseProps}
        trainingEnabled={false}
        wellnessEnabled={false}
      />
    )

    expect(screen.getByText('記錄第一筆體重')).toBeInTheDocument()
    expect(screen.getByText('記錄第一筆飲食')).toBeInTheDocument()
    expect(screen.queryByText('記錄第一筆訓練')).not.toBeInTheDocument()
    expect(screen.queryByText('記錄身心狀態')).not.toBeInTheDocument()
  })

  it('shows progress count matching completed items', () => {
    render(
      <OnboardingChecklist
        {...baseProps}
        hasWeight={true}
        hasNutrition={true}
      />
    )

    // 2 of 5 completed
    expect(screen.getByText('2/5 完成')).toBeInTheDocument()
  })

  it('shows progress bar with correct width', () => {
    const { container } = render(
      <OnboardingChecklist
        {...baseProps}
        trainingEnabled={false}
        wellnessEnabled={false}
        hasWeight={true}
      />
    )

    // 1 of 3 items complete (weight, nutrition, line) -> ~33.33%
    const progressBar = container.querySelector('[style*="width"]') as HTMLElement
    expect(progressBar).toBeTruthy()
    const width = parseFloat(progressBar.style.width)
    expect(width).toBeCloseTo(33.33, 0)
  })

  it('dismiss button stores to localStorage and calls onDismiss', () => {
    render(<OnboardingChecklist {...baseProps} />)

    const dismissBtn = screen.getByText('稍後再說')
    fireEvent.click(dismissBtn)

    expect(localStorageMock.setItem).toHaveBeenCalled()
    expect(baseProps.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when dismissed', () => {
    render(<OnboardingChecklist {...baseProps} />)

    // Dismiss
    fireEvent.click(screen.getByText('稍後再說'))

    expect(screen.queryByText('新手任務')).not.toBeInTheDocument()
  })

  it('shows celebration state when all items are complete', () => {
    render(
      <OnboardingChecklist
        {...baseProps}
        hasWeight={true}
        hasNutrition={true}
        hasTraining={true}
        hasWellness={true}
        hasLineBinding={true}
      />
    )

    expect(screen.getByText('太棒了！全部完成')).toBeInTheDocument()
    expect(screen.getByText('所有新手任務已完成！')).toBeInTheDocument()
  })

  it('auto-dismisses after celebration timeout when all complete', () => {
    render(
      <OnboardingChecklist
        {...baseProps}
        hasWeight={true}
        hasNutrition={true}
        hasTraining={true}
        hasWellness={true}
        hasLineBinding={true}
      />
    )

    // Before timeout: celebration visible
    expect(screen.getByText('太棒了！全部完成')).toBeInTheDocument()

    // After 3s timeout
    act(() => { vi.advanceTimersByTime(3000) })

    expect(baseProps.onDismiss).toHaveBeenCalled()
  })
})
