import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SelfManagedNutrition from '@/components/client/SelfManagedNutrition'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/date-utils', () => ({
  getLocalDateStr: (d?: Date) => {
    const date = d || new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

// Prevent location.reload from actually reloading
const reloadMock = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadMock },
  writable: true,
})

const baseProps = {
  clientId: 'uuid-1',
  uniqueCode: 'CODE1',
  goalType: null as string | null,
  activityProfile: null as string | null,
  gender: '男性' as string | null,
  caloriesTarget: null as number | null,
  proteinTarget: null as number | null,
  carbsTarget: null as number | null,
  fatTarget: null as number | null,
  targetWeight: null as number | null,
  targetDate: null as string | null,
  onMutate: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SelfManagedNutrition', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.clearAllMocks()
  })

  it('shows onboarding form when goalType is null', () => {
    render(<SelfManagedNutrition {...baseProps} />)
    expect(screen.getByText('設定你的營養目標')).toBeInTheDocument()
    expect(screen.getByText('減脂')).toBeInTheDocument()
    expect(screen.getByText('體態重組')).toBeInTheDocument()
    expect(screen.getByText('增肌')).toBeInTheDocument()
  })

  it('shows body data inputs after selecting a goal', () => {
    render(<SelfManagedNutrition {...baseProps} />)
    fireEvent.click(screen.getByText('減脂'))
    expect(screen.getByPlaceholderText('70')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('20')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('170')).toBeInTheDocument()
  })

  it('submit button is disabled when required fields are missing', () => {
    render(<SelfManagedNutrition {...baseProps} />)
    fireEvent.click(screen.getByText('減脂'))
    const submitBtn = screen.getByText('計算我的營養目標')
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is enabled when goal and valid weight are provided', () => {
    render(<SelfManagedNutrition {...baseProps} />)
    fireEvent.click(screen.getByText('減脂'))
    fireEvent.change(screen.getByPlaceholderText('70'), { target: { value: '75' } })
    const submitBtn = screen.getByText('計算我的營養目標')
    expect(submitBtn).not.toBeDisabled()
  })

  it('renders null when loading with goalType set and no data returned', async () => {
    // Never-resolving fetch to simulate loading state for the branch
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const { container } = render(
      <SelfManagedNutrition
        {...baseProps}
        goalType="cut"
        caloriesTarget={1800}
      />
    )
    await waitFor(() => {
      // After loading, data is null so renders null
      expect(container.innerHTML).toBe('')
    })
  })

  it('fetches suggestion on mount when goalType and caloriesTarget are set', () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    render(
      <SelfManagedNutrition
        {...baseProps}
        goalType="cut"
        caloriesTarget={1800}
      />
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/nutrition-suggestions?clientId=uuid-1')
    )
  })
})
