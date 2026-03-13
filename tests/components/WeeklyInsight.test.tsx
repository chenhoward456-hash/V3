import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import WeeklyInsight from '@/components/client/WeeklyInsight'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetchResponse(data: any) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WeeklyInsight', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders the insight status label and message when data is available', async () => {
    mockFetchResponse({
      suggestion: {
        status: 'on_track',
        statusEmoji: '🟢',
        statusLabel: '進度正常',
        message: '你的體重趨勢符合預期',
        estimatedTDEE: 2200,
        weeklyWeightChangeRate: -0.5,
        suggestedCalories: 1800,
      },
    })

    render(<WeeklyInsight clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText(/進度正常/)).toBeInTheDocument()
    })

    expect(screen.getByText(/你的體重趨勢符合預期/)).toBeInTheDocument()
  })

  it('renders nothing when API returns no suggestion', async () => {
    mockFetchResponse({})

    const { container } = render(<WeeklyInsight clientId="c1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Component returns null for no data
    expect(container.firstChild).toBeNull()
  })

  it('shows insufficient data message when status is insufficient_data', async () => {
    mockFetchResponse({
      suggestion: {
        status: 'insufficient_data',
      },
    })

    render(<WeeklyInsight clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText(/需要至少 2 週的體重數據/)).toBeInTheDocument()
    })
  })

  it('shows low compliance message when status is low_compliance', async () => {
    mockFetchResponse({
      suggestion: {
        status: 'low_compliance',
      },
    })

    render(<WeeklyInsight clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText(/飲食紀錄率偏低/)).toBeInTheDocument()
    })
  })

  it('displays TDEE and weight change rate for full data', async () => {
    mockFetchResponse({
      suggestion: {
        status: 'on_track',
        statusEmoji: '🟢',
        statusLabel: '進度正常',
        message: 'Good progress',
        estimatedTDEE: 2200,
        weeklyWeightChangeRate: -0.35,
        suggestedCalories: 1800,
      },
      meta: { goalType: 'cut' },
    })

    render(<WeeklyInsight clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText('2200')).toBeInTheDocument()
    })

    expect(screen.getByText('-0.35%')).toBeInTheDocument()
  })

  it('renders nothing while loading', () => {
    // Never resolve the fetch
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    const { container } = render(<WeeklyInsight clientId="c1" />)

    // loading state returns null
    expect(container.firstChild).toBeNull()
  })
})
