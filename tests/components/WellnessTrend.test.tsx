import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WellnessTrend from '@/components/client/WellnessTrend'

// ---------------------------------------------------------------------------
// Mock recharts
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  LineChart: ({ children, data }: any) =>
    React.createElement('div', { 'data-testid': 'line-chart', 'data-count': data?.length }, children),
  Line: ({ dataKey }: any) => React.createElement('span', { 'data-testid': `line-${dataKey}` }),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => React.createElement('div', null, children),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeWellness(overrides: Partial<{
  id: string; date: string; sleep_quality: number | null;
  energy_level: number | null; mood: number | null; note: string | null;
}> = {}) {
  return {
    id: '1',
    date: '2026-01-10',
    sleep_quality: 4,
    energy_level: 3,
    mood: 5,
    note: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WellnessTrend', () => {
  it('renders heading', () => {
    render(<WellnessTrend wellness={[]} />)
    expect(screen.getByText(/感受趨勢/)).toBeInTheDocument()
  })

  it('shows placeholder when data has fewer than 2 items', () => {
    render(<WellnessTrend wellness={[makeWellness()]} />)
    expect(screen.getByText(/資料累積中/)).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('renders chart when 2+ data points exist', () => {
    const data = [
      makeWellness({ id: '1', date: '2026-01-10' }),
      makeWellness({ id: '2', date: '2026-01-11' }),
    ]
    render(<WellnessTrend wellness={data} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.queryByText(/資料累積中/)).not.toBeInTheDocument()
  })

  it('renders three line series for sleep, energy, mood', () => {
    const data = [
      makeWellness({ id: '1', date: '2026-01-10' }),
      makeWellness({ id: '2', date: '2026-01-11' }),
    ]
    render(<WellnessTrend wellness={data} />)
    expect(screen.getByTestId('line-睡眠品質')).toBeInTheDocument()
    expect(screen.getByTestId('line-精力水平')).toBeInTheDocument()
    expect(screen.getByTestId('line-心情')).toBeInTheDocument()
  })

  it('filters out entries where all metrics are null', () => {
    const data = [
      makeWellness({ id: '1', date: '2026-01-10' }),
      makeWellness({ id: '2', date: '2026-01-11', sleep_quality: null, energy_level: null, mood: null }),
      makeWellness({ id: '3', date: '2026-01-12' }),
    ]
    render(<WellnessTrend wellness={data} />)
    const chart = screen.getByTestId('line-chart')
    // Only 2 valid data points
    expect(chart.getAttribute('data-count')).toBe('2')
  })

  it('handles empty array without crashing', () => {
    const { container } = render(<WellnessTrend wellness={[]} />)
    expect(container.querySelector('.bg-white')).toBeInTheDocument()
    expect(screen.getByText(/資料累積中/)).toBeInTheDocument()
  })
})
