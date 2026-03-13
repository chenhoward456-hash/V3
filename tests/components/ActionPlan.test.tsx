import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActionPlan from '@/components/client/ActionPlan'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ActionPlan', () => {
  it('shows fallback message when no data is provided', () => {
    render(<ActionPlan />)
    expect(screen.getByText(/持續追蹤中/)).toBeInTheDocument()
    expect(screen.queryByText(/行動計畫/)).not.toBeInTheDocument()
  })

  it('renders health goals when provided', () => {
    render(<ActionPlan healthGoals="每週減 0.5kg" />)
    expect(screen.getByText(/行動計畫/)).toBeInTheDocument()
    expect(screen.getByText(/每週減 0.5kg/)).toBeInTheDocument()
  })

  it('renders checkup date when provided', () => {
    render(<ActionPlan nextCheckupDate="2026-06-15" />)
    expect(screen.getByText(/下次回檢/)).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('shows overdue indicator for past checkup dates', () => {
    render(<ActionPlan nextCheckupDate="2020-01-01" />)
    expect(screen.getByText(/已逾期/)).toBeInTheDocument()
  })

  it('renders supplements when provided', () => {
    render(
      <ActionPlan
        healthGoals="目標"
        topSupplements={[{ name: '魚油' }, { name: '維生素D' }]}
      />
    )
    expect(screen.getByText(/今日重點/)).toBeInTheDocument()
    expect(screen.getByText(/魚油、維生素D/)).toBeInTheDocument()
  })

  it('does not render supplements section when array is empty', () => {
    render(<ActionPlan healthGoals="目標" topSupplements={[]} />)
    expect(screen.queryByText(/今日重點/)).not.toBeInTheDocument()
  })
})
