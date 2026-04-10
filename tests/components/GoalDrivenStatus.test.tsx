import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import GoalDrivenStatus from '@/components/client/GoalDrivenStatus'

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const defaultProps = {
  clientId: 'test-client-123',
  code: undefined as string | undefined,
  isTrainingDay: false,
  onMutate: vi.fn(),
}

function renderComponent(overrides: Record<string, any> = {}) {
  return render(<GoalDrivenStatus {...defaultProps} {...overrides} />)
}

/** Build a full goal-driven suggestion payload. */
function buildGoalDrivenResponse(overrides: Record<string, any> = {}) {
  return {
    suggestion: {
      status: 'on_track',
      statusEmoji: '🟢',
      statusLabel: '進度正常',
      message: 'Keep it up!',
      suggestedCalories: 1800,
      suggestedProtein: 150,
      suggestedCarbs: 200,
      suggestedFat: 60,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      autoApply: true,
      wearableInsight: null,
      readinessScore: null,
      currentState: null,
      refeedSuggested: false,
      refeedDays: null,
      refeedReason: null,
      metabolicStress: null,
      perMealProteinGuide: null,
      energyAvailability: null,
      labMacroModifiers: null,
      menstrualCycleNote: null,
      warnings: null,
      estimatedTDEE: 2200,
      deadlineInfo: {
        isGoalDriven: true,
        daysLeft: 45,
        weightToLose: 3.5,
        requiredDailyDeficit: 450,
        safetyLevel: 'normal',
        suggestedCardioMinutes: 0,
        suggestedDailySteps: 0,
        predictedCompWeight: null,
        prePeakEntryWeight: null,
        peakWeekExpectedLoss: null,
        extraCardioNeeded: false,
        extraBurnPerDay: 0,
        cardioNote: null,
      },
      ...overrides,
    },
    applied: true,
    coachLocked: false,
    meta: {
      weeklyWeights: [70, 69.8, 69.5],
      targetWeight: 65,
      targetDate: '2026-06-01',
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GoalDrivenStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    defaultProps.onMutate = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Loading state: renders nothing while loading ----
  it('renders nothing while loading', () => {
    // Never resolve fetch
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { container } = renderComponent()
    expect(container.innerHTML).toBe('')
  })

  // ---- Renders nothing when API returns no suggestion ----
  it('renders nothing when API returns empty suggestion', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: null }),
    })
    const { container } = renderComponent()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    // After loading completes with no data, renders null
    expect(container.innerHTML).toBe('')
  })

  // ---- Renders nothing on API failure ----
  it('renders nothing on API failure and does not crash', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })
    const { container } = renderComponent()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.innerHTML).toBe('')
  })

  // ---- Renders nothing on fetch exception ----
  it('renders nothing on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    const { container } = renderComponent()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.innerHTML).toBe('')
  })

  // ---- Uses code param when provided ----
  it('calls API with code param when code prop is provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: null }),
    })

    renderComponent({ code: 'ABC123' })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('clientId=ABC123'),
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('code=ABC123'),
      )
    })
  })

  // ---- Falls back to clientId when no code ----
  it('calls API with clientId when no code prop', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: null }),
    })

    renderComponent({ code: undefined })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('clientId=test-client-123'),
      )
    })
  })

  // ---- Insufficient data status ----
  it('shows insufficient data message when status is insufficient_data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: {
          status: 'insufficient_data',
          deadlineInfo: null,
        },
        applied: false,
        meta: {},
      }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/需要至少 2 週的體重數據/)).toBeInTheDocument()
    })
  })

  // ---- Non-goal-driven on_track status renders status info ----
  it('renders on_track status card when not goal-driven', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: {
          status: 'on_track',
          statusEmoji: '🟢',
          statusLabel: '進度正常',
          message: 'Everything looks good',
          estimatedTDEE: 2200,
          deadlineInfo: {
            isGoalDriven: false,
            weightToLose: 3,
            daysLeft: 30,
          },
          refeedSuggested: false,
          wearableInsight: null,
          menstrualCycleNote: null,
        },
        applied: false,
        meta: { targetWeight: 65 },
      }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/進度正常/)).toBeInTheDocument()
      expect(screen.getByText(/Everything looks good/)).toBeInTheDocument()
    })
    // Core stats grid
    expect(screen.getByText('30')).toBeInTheDocument() // daysLeft
    expect(screen.getByText('2200')).toBeInTheDocument() // TDEE
  })

  // ---- Goal-driven mode renders full card ----
  it('renders goal-driven card with deadline info', async () => {
    const response = buildGoalDrivenResponse()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument() // daysLeft
      expect(screen.getByText('450')).toBeInTheDocument() // requiredDailyDeficit
      expect(screen.getByText('3.5')).toBeInTheDocument() // weightToLose
    })
  })

  // ---- Goal-driven renders diet targets ----
  it('renders daily diet targets in goal-driven mode', async () => {
    const response = buildGoalDrivenResponse()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      // GoalDrivenStatus recalculates: protein*4 + carbs*4 + fat*9 = 150*4+200*4+60*9 = 1940
      expect(screen.getByText('1940')).toBeInTheDocument() // todayCalories (recalculated)
      expect(screen.getByText('150')).toBeInTheDocument() // suggestedProtein
      expect(screen.getByText('200')).toBeInTheDocument() // suggestedCarbs
      expect(screen.getByText('60')).toBeInTheDocument() // suggestedFat
    })
  })

  // ---- Carb cycling: training day vs rest day ----
  it('displays training day carbs when isTrainingDay and carb cycling enabled', async () => {
    const response = buildGoalDrivenResponse({
      suggestedCarbsTrainingDay: 250,
      suggestedCarbsRestDay: 150,
      suggestedCarbs: 200,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent({ isTrainingDay: true })

    await waitFor(() => {
      expect(screen.getByText('250')).toBeInTheDocument() // training day carbs
    })
  })

  it('displays rest day carbs when not isTrainingDay and carb cycling enabled', async () => {
    const response = buildGoalDrivenResponse({
      suggestedCarbsTrainingDay: 250,
      suggestedCarbsRestDay: 160,
      suggestedCarbs: 200,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent({ isTrainingDay: false })

    await waitFor(() => {
      expect(screen.getByText('160')).toBeInTheDocument() // rest day carbs
    })
  })

  // ---- onMutate called with applied targets ----
  it('calls onMutate with applied targets when API response has applied=true', async () => {
    const response = buildGoalDrivenResponse()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    const onMutate = vi.fn()
    renderComponent({ onMutate })

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalledWith({
        calories_target: 1800,
        protein_target: 150,
        carbs_target: 200,
        fat_target: 60,
        carbs_training_day: null,
        carbs_rest_day: null,
      })
    })
  })

  // ---- onMutate called without args when not applied ----
  it('calls onMutate without args when API response has applied=false', async () => {
    const response = buildGoalDrivenResponse()
    response.applied = false
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    const onMutate = vi.fn()
    renderComponent({ onMutate })

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalledWith()
    })
  })

  // ---- Safety level badge rendering ----
  it('renders safety level badge for aggressive mode', async () => {
    const response = buildGoalDrivenResponse()
    response.suggestion.deadlineInfo.safetyLevel = 'aggressive'
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/積極模式/)).toBeInTheDocument()
    })
  })

  // ---- Refeed suggestion display ----
  it('renders refeed suggestion when refeedSuggested is true', async () => {
    const response = buildGoalDrivenResponse({
      refeedSuggested: true,
      refeedDays: 2,
      refeedReason: 'Metabolic adaptation detected',
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/可考慮安排 2 天 Refeed/)).toBeInTheDocument()
      expect(screen.getByText(/Metabolic adaptation detected/)).toBeInTheDocument()
    })
  })

  // ---- Wearable insight card ----
  it('renders wearable insight card when wearableInsight is present', async () => {
    const response = buildGoalDrivenResponse({
      wearableInsight: 'Recovery is lower than usual',
      currentState: 'struggling',
      readinessScore: 42,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Recovery is lower than usual/)).toBeInTheDocument()
      expect(screen.getByText('42/100')).toBeInTheDocument()
    })
  })

  // ---- Menstrual cycle note ----
  it('renders menstrual cycle note when present', async () => {
    const response = buildGoalDrivenResponse({
      menstrualCycleNote: 'Luteal phase - expect slight water retention',
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Luteal phase/)).toBeInTheDocument()
    })
  })

  // ---- Warnings list ----
  it('renders warnings when present', async () => {
    const response = buildGoalDrivenResponse({
      warnings: ['Warning 1', 'Warning 2'],
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Warning 1')).toBeInTheDocument()
      expect(screen.getByText('Warning 2')).toBeInTheDocument()
    })
  })

  // ---- Non-goal-driven refeed display ----
  it('renders refeed suggestion in non-goal-driven mode', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: {
          status: 'on_track',
          statusEmoji: '🟢',
          statusLabel: '進度正常',
          message: 'OK',
          estimatedTDEE: 2000,
          deadlineInfo: { isGoalDriven: false, weightToLose: 2, daysLeft: 20 },
          refeedSuggested: true,
          refeedDays: 1,
          refeedReason: 'Plateau detected',
          wearableInsight: null,
          menstrualCycleNote: null,
        },
        applied: false,
        meta: {},
      }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/可考慮安排 1 天 Refeed/)).toBeInTheDocument()
    })
  })

  // ---- Metabolic stress card ----
  it('renders metabolic stress card when score >= 30', async () => {
    const response = buildGoalDrivenResponse({
      metabolicStress: {
        score: 55,
        level: 'elevated',
        recommendation: 'refeed_1day',
        refeedCarbGPerKg: 5,
        breakdown: {
          dietDuration: 12,
          recovery: 15,
          plateau: 10,
          lowCarb: 10,
          wellnessTrend: 8,
        },
      },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/代謝壓力：55\/100/)).toBeInTheDocument()
      expect(screen.getByText(/建議安排 1 天 strategic refeed/)).toBeInTheDocument()
    })
  })

  // ---- Energy availability warning ----
  it('renders energy availability warning when level is not adequate', async () => {
    const response = buildGoalDrivenResponse({
      energyAvailability: {
        level: 'critical',
        eaKcalPerKgFFM: 18.5,
        warning: 'Energy availability critically low',
      },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/18.5 kcal\/kg FFM\/day/)).toBeInTheDocument()
      expect(screen.getByText(/Energy availability critically low/)).toBeInTheDocument()
    })
  })

  // ---- Lab macro modifiers ----
  it('renders lab macro modifiers when present', async () => {
    const response = buildGoalDrivenResponse({
      labMacroModifiers: [
        { reason: 'Low ferritin - increase iron intake' },
        { reason: 'High CRP - add omega-3' },
      ],
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Low ferritin/)).toBeInTheDocument()
      expect(screen.getByText(/High CRP/)).toBeInTheDocument()
    })
  })
})
