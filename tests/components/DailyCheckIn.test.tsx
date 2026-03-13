import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DailyCheckIn from '@/components/client/DailyCheckIn'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'chart' }, children),
  BarChart: ({ children }: any) => React.createElement('div', null, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Cell: () => null,
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateStr: (d: Date) => d.toISOString().slice(0, 10),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const supplements = [
  { id: 's1', name: 'Vitamin D', dosage: '2000IU', timing: '早餐後' },
  { id: 's2', name: 'Omega-3', dosage: '1g', timing: '晚餐後' },
]

const baseProps = {
  supplements,
  todayLogs: [] as any[],
  todayStats: { completed: 0, total: 2, rate: 0 },
  streakDays: 0,
  streakMessage: '',
  isCoachMode: false,
  togglingSupplements: new Set<string>(),
  recentLogs: [],
  onToggleSupplement: vi.fn(),
  onManageSupplements: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DailyCheckIn', () => {
  it('renders the supplement list', () => {
    render(<DailyCheckIn {...baseProps} />)

    expect(screen.getByText('Vitamin D')).toBeInTheDocument()
    expect(screen.getByText('Omega-3')).toBeInTheDocument()
  })

  it('supplement buttons have role="checkbox"', () => {
    render(<DailyCheckIn {...baseProps} />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
  })

  it('calls onToggleSupplement when a supplement is clicked', () => {
    const onToggle = vi.fn()
    render(<DailyCheckIn {...baseProps} onToggleSupplement={onToggle} />)

    fireEvent.click(screen.getByText('Vitamin D').closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('s1', false)
  })

  it('shows streak badge when streakDays > 0', () => {
    render(<DailyCheckIn {...baseProps} streakDays={5} />)

    expect(screen.getByText(/連續 5 天/)).toBeInTheDocument()
  })

  it('shows empty state when no supplements are configured', () => {
    render(<DailyCheckIn {...baseProps} supplements={[]} todayStats={{ completed: 0, total: 0, rate: 0 }} />)

    expect(screen.getByText('尚未設定補品清單')).toBeInTheDocument()
  })

  it('shows completion progress text', () => {
    render(
      <DailyCheckIn
        {...baseProps}
        todayStats={{ completed: 1, total: 2, rate: 50 }}
        todayLogs={[{ supplement_id: 's1', completed: true }]}
      />
    )

    expect(screen.getByText('1/2 已完成')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
