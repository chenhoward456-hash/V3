import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GoalSettings from '@/components/client/GoalSettings'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  Target: () => React.createElement('span', null, 'TargetIcon'),
  ChevronDown: () => React.createElement('span', null, 'v'),
  ChevronUp: () => React.createElement('span', null, '^'),
  Check: () => React.createElement('span', null, 'ok'),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const baseProps = {
  clientId: 'c1',
  uniqueCode: 'CODE1',
  currentGoalType: 'cut' as string | null,
  currentTargetWeight: 70 as number | null,
  currentTargetBodyFat: 15 as number | null,
  currentTargetDate: '2026-06-01' as string | null,
  latestWeight: 75 as number | null,
  latestBodyFat: 20 as number | null,
  onMutate: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GoalSettings', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.clearAllMocks()
  })

  it('renders collapsed header showing current goal info', () => {
    render(<GoalSettings {...baseProps} />)
    expect(screen.getByText('目標設定')).toBeInTheDocument()
    expect(screen.getByText(/減脂/)).toBeInTheDocument()
    expect(screen.getByText(/70kg/)).toBeInTheDocument()
  })

  it('expands form on header click', () => {
    render(<GoalSettings {...baseProps} />)
    fireEvent.click(screen.getByText('目標設定'))
    expect(screen.getByText('目標類型')).toBeInTheDocument()
    expect(screen.getByText('減脂')).toBeInTheDocument()
    expect(screen.getByText('體態重組')).toBeInTheDocument()
    expect(screen.getByText('增肌')).toBeInTheDocument()
  })

  it('save button is disabled when there are no changes', () => {
    render(<GoalSettings {...baseProps} />)
    fireEvent.click(screen.getByText('目標設定'))
    expect(screen.getByText('儲存目標')).toBeDisabled()
  })

  it('save button becomes enabled after changing goal type', () => {
    render(<GoalSettings {...baseProps} />)
    fireEvent.click(screen.getByText('目標設定'))
    fireEvent.click(screen.getByText('增肌'))
    expect(screen.getByText('儲存目標')).not.toBeDisabled()
  })

  it('calls fetch on save and shows success state', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    render(<GoalSettings {...baseProps} />)
    fireEvent.click(screen.getByText('目標設定'))
    fireEvent.click(screen.getByText('增肌'))
    fireEvent.click(screen.getByText('儲存目標'))

    await waitFor(() => {
      expect(screen.getByText('已儲存')).toBeInTheDocument()
    })
    expect(baseProps.onMutate).toHaveBeenCalled()
  })

  it('shows error message when save fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: '伺服器錯誤' }),
    })
    render(<GoalSettings {...baseProps} />)
    fireEvent.click(screen.getByText('目標設定'))
    fireEvent.click(screen.getByText('增肌'))
    fireEvent.click(screen.getByText('儲存目標'))

    await waitFor(() => {
      expect(screen.getByText('伺服器錯誤')).toBeInTheDocument()
    })
  })
})
