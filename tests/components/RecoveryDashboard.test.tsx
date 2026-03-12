import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import RecoveryDashboard from '@/components/client/RecoveryDashboard'

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeAssessmentData(overrides: Record<string, any> = {}) {
  return {
    score: 72,
    state: 'good' as const,
    readinessScore: 68,
    systems: {
      neural:        { score: 80, state: 'optimal' as const, signals: ['HRV stable'] },
      muscular:      { score: 65, state: 'good' as const, signals: ['CK normal'] },
      metabolic:     { score: 70, state: 'good' as const, signals: ['Glucose ok'] },
      hormonal:      { score: 55, state: 'struggling' as const, signals: ['Cortisol elevated'] },
      psychological: { score: 78, state: 'good' as const, signals: ['Mood positive'] },
    },
    overtrainingRisk: {
      acwr: 1.15,
      monotony: 1.8,
      strain: 120,
      riskLevel: 'low' as const,
      reasons: ['ACWR within safe zone'],
    },
    autonomicBalance: {
      status: 'balanced' as const,
      hrvTrend: 'stable' as const,
      rhrTrend: 'stable' as const,
      hrvZScore: 0.5,
      rhrZScore: -0.3,
      reasons: ['HRV within baseline'],
    },
    trajectory: 'improving' as const,
    recommendations: [
      { priority: 'high' as const, category: 'sleep' as const, message: 'Aim for 8 hours tonight' },
      { priority: 'medium' as const, category: 'nutrition' as const, message: 'Increase protein intake' },
      { priority: 'low' as const, category: 'training' as const, message: 'Light stretching optional' },
    ],
    reasons: ['Sleep trending down', 'HRV within normal range'],
    ...overrides,
  }
}

function mockFetchSuccess(data: ReturnType<typeof makeAssessmentData> = makeAssessmentData()) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => data,
  })
}

function mockFetchError() {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => ({}),
  })
}

function mockFetchNeverResolves() {
  mockFetch.mockReturnValue(new Promise(() => {}))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RecoveryDashboard', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Loading state ----
  it('shows loading skeleton initially while fetch is pending', () => {
    mockFetchNeverResolves()
    const { container } = render(<RecoveryDashboard clientId="client-1" />)

    // The loading skeleton has animate-pulse class
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  // ---- Fetch URL ----
  it('fetches from the correct API endpoint with the given clientId', () => {
    mockFetchNeverResolves()
    render(<RecoveryDashboard clientId="abc-123" />)

    expect(mockFetch).toHaveBeenCalledWith('/api/recovery-assessment?clientId=abc-123')
  })

  // ---- Error state returns null ----
  it('returns null (renders nothing) when fetch fails', async () => {
    mockFetchError()

    const { container } = render(<RecoveryDashboard clientId="client-err" />)

    await waitFor(() => {
      // After error, the component should render nothing (no skeleton, no content)
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
      expect(container.innerHTML).toBe('')
    })
  })

  // ---- Data renders score ----
  it('renders the recovery score when data loads', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('72')).toBeInTheDocument()
      expect(screen.getByText('/ 100')).toBeInTheDocument()
    })
  })

  // ---- State label ----
  it('displays the correct state label from the data', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      // state: 'good' maps to label "..."
      expect(screen.getByText(/狀態良好/)).toBeInTheDocument()
    })
  })

  // ---- Five system bars ----
  it('renders all five system bars with names and scores', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      // System names
      expect(screen.getByText('神經系統')).toBeInTheDocument()
      expect(screen.getByText('肌肉骨骼')).toBeInTheDocument()
      expect(screen.getByText('代謝狀態')).toBeInTheDocument()
      expect(screen.getByText('荷爾蒙')).toBeInTheDocument()
      expect(screen.getByText('心理狀態')).toBeInTheDocument()

      // System scores
      expect(screen.getByText('80')).toBeInTheDocument()
      expect(screen.getByText('65')).toBeInTheDocument()
      expect(screen.getByText('70')).toBeInTheDocument()
      expect(screen.getByText('55')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
    })
  })

  // ---- Recommendations (only high/medium, max 3) ----
  it('renders high and medium priority recommendations', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('Aim for 8 hours tonight')).toBeInTheDocument()
      expect(screen.getByText('Increase protein intake')).toBeInTheDocument()
      // Low priority should NOT be shown
      expect(screen.queryByText('Light stretching optional')).not.toBeInTheDocument()
    })
  })

  // ---- Quick indicators ----
  it('renders trajectory, autonomic balance, and overtraining risk indicators', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      // trajectory: 'improving' -> label "..."
      expect(screen.getByText('改善中')).toBeInTheDocument()
      // autonomic: 'balanced' -> label "..."
      expect(screen.getByText('平衡')).toBeInTheDocument()
      // overtraining: 'low' -> label "..."
      expect(screen.getByText('低風險')).toBeInTheDocument()
    })
  })

  // ---- Expand / collapse toggle ----
  it('toggles the detail section when the expand button is clicked', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('查看詳細數據')).toBeInTheDocument()
    })

    // ACWR detail should NOT be visible yet
    expect(screen.queryByText(/當前 ACWR/)).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByText('查看詳細數據'))

    await waitFor(() => {
      expect(screen.getByText('收合詳細數據')).toBeInTheDocument()
      // ACWR data should now be visible
      expect(screen.getByText(/當前 ACWR/)).toBeInTheDocument()
      expect(screen.getByText('1.15')).toBeInTheDocument()
    })

    // Click to collapse
    fireEvent.click(screen.getByText('收合詳細數據'))

    await waitFor(() => {
      expect(screen.getByText('查看詳細數據')).toBeInTheDocument()
      expect(screen.queryByText(/當前 ACWR/)).not.toBeInTheDocument()
    })
  })

  // ---- Expanded section shows HRV/RHR z-scores ----
  it('shows HRV and RHR z-score cards in the expanded section', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('查看詳細數據')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('查看詳細數據'))

    await waitFor(() => {
      expect(screen.getByText('HRV')).toBeInTheDocument()
      expect(screen.getByText('RHR')).toBeInTheDocument()
      expect(screen.getByText('+0.5')).toBeInTheDocument()
      expect(screen.getByText('-0.3')).toBeInTheDocument()
    })
  })

  // ---- Expanded section shows reasons ----
  it('shows judgment reasons in the expanded section', async () => {
    mockFetchSuccess()

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('查看詳細數據')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('查看詳細數據'))

    await waitFor(() => {
      expect(screen.getByText(/Sleep trending down/)).toBeInTheDocument()
      expect(screen.getByText(/HRV within normal range/)).toBeInTheDocument()
    })
  })

  // ---- No expand button when acwr and hrvZScore are null ----
  it('hides the expand button when there is no detail data', async () => {
    const data = makeAssessmentData({
      overtrainingRisk: {
        acwr: null,
        monotony: null,
        strain: null,
        riskLevel: 'low',
        reasons: [],
      },
      autonomicBalance: {
        status: 'unknown',
        hrvTrend: 'unknown',
        rhrTrend: 'unknown',
        hrvZScore: null,
        rhrZScore: null,
        reasons: [],
      },
    })
    mockFetchSuccess(data)

    render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('72')).toBeInTheDocument()
    })

    expect(screen.queryByText('查看詳細數據')).not.toBeInTheDocument()
  })

  // ---- Re-fetches when clientId changes ----
  it('re-fetches data when clientId prop changes', async () => {
    mockFetchSuccess()

    const { rerender } = render(<RecoveryDashboard clientId="client-1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/recovery-assessment?clientId=client-1')
    })

    mockFetch.mockClear()
    mockFetchSuccess()

    rerender(<RecoveryDashboard clientId="client-2" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/recovery-assessment?clientId=client-2')
    })
  })

  // ---- Empty clientId does not fetch ----
  it('does not fetch when clientId is empty', () => {
    mockFetchNeverResolves()
    render(<RecoveryDashboard clientId="" />)

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
