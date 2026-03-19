import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PeakWeekPlan from '@/components/client/PeakWeekPlan'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/date-utils', () => ({
  getLocalDateStr: () => '2026-03-15',
  daysUntilDateTW: () => 5,
  DAY_MS: 86400000,
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function makePeakWeekDay(overrides: Partial<any> = {}) {
  return {
    daysOut: 7,
    date: '2026-03-15',
    label: 'Day 1',
    phase: 'depletion' as const,
    carbs: 50,
    protein: 180,
    fat: 40,
    calories: 1500,
    water: 6000,
    sodiumNote: '正常鈉',
    fiberNote: '低纖維',
    trainingNote: '輕度訓練',
    ...overrides,
  }
}

function mockPlanResponse(plan: any[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ suggestion: { peakWeekPlan: plan } }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PeakWeekPlan', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('shows loading skeleton while fetching', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    const { container } = render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders nothing when plan is empty', async () => {
    mockPlanResponse([])
    const { container } = render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Peak Week')).not.toBeInTheDocument()
  })

  it('renders plan title and countdown when plan exists', async () => {
    const plan = [
      makePeakWeekDay({ date: '2026-03-15', phase: 'depletion' }),
      makePeakWeekDay({ date: '2026-03-16', phase: 'carb_load' }),
    ]
    mockPlanResponse(plan)
    render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    await waitFor(() => {
      expect(screen.getByText('Peak Week 計畫')).toBeInTheDocument()
    })
    expect(screen.getByText(/倒數/)).toBeInTheDocument()
  })

  it('shows today plan card with macros when today matches a plan day', async () => {
    const plan = [
      makePeakWeekDay({ date: '2026-03-15', phase: 'depletion', carbs: 50, protein: 180 }),
    ]
    mockPlanResponse(plan)
    render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    await waitFor(() => {
      expect(screen.getByText('今日計畫')).toBeInTheDocument()
    })
    // "碳水耗竭" appears in both today card and timeline
    const badges = screen.getAllByText('碳水耗竭')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('toggles expanded day detail on click', async () => {
    const plan = [
      makePeakWeekDay({ date: '2026-03-16', phase: 'carb_load', sodiumNote: '低鈉特殊指引' }),
    ]
    mockPlanResponse(plan)
    render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    await waitFor(() => {
      expect(screen.getAllByText('碳水超補').length).toBeGreaterThanOrEqual(1)
    })
    // Click the day row button to expand
    const dayButton = screen.getAllByRole('button').find(b => b.textContent?.includes('碳水超補'))
    expect(dayButton).toBeTruthy()
    fireEvent.click(dayButton!)
    // Expanded detail should show sodium note
    expect(screen.getByText(/低鈉特殊指引/)).toBeInTheDocument()
  })

  it('renders nothing when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const { container } = render(
      <PeakWeekPlan clientId="c1" competitionDate="2026-03-20" bodyWeight={75} />
    )
    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })
    expect(container.querySelector('.bg-white.rounded-3xl.shadow-sm.p-6.mb-6')).not.toBeInTheDocument()
  })
})
