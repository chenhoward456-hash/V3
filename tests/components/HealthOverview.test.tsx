import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthOverview from '@/components/client/HealthOverview'

// ---------------------------------------------------------------------------
// Mock GaugeCard so we can verify it receives props without SVG rendering issues
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/GaugeCard', () => ({
  default: ({ label, value, unit, statusLabel }: any) => (
    React.createElement('div', { 'data-testid': `gauge-${label}` },
      React.createElement('span', null, label),
      value !== null && React.createElement('span', null, value),
      unit && React.createElement('span', null, unit),
      statusLabel && React.createElement('span', null, statusLabel),
    )
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseProps = {
  weekRate: 85,
  monthRate: 80,
  weekDelta: 5,
  labNormal: 18,
  labTotal: 20,
  bodyFat: 15.2,
  bodyFatTrend: { diff: '0.5', direction: 'down' },
  todayMood: 4,
  hasWellness: true,
}

function renderOverview(overrides: Record<string, any> = {}) {
  return render(<HealthOverview {...baseProps} {...overrides} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HealthOverview', () => {

  // ---- Renders supplement adherence card ----
  it('renders supplement adherence rate card', () => {
    renderOverview()

    expect(screen.getByText(/本週服從率/)).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText(/本月 80%/)).toBeInTheDocument()
  })

  it('shows week-over-week delta with arrow', () => {
    renderOverview()

    expect(screen.getByText(/↑5%/)).toBeInTheDocument()
  })

  it('shows down arrow for negative weekDelta', () => {
    renderOverview({ weekDelta: -3 })

    expect(screen.getByText(/↓3%/)).toBeInTheDocument()
  })

  it('hides supplement delta when weekDelta is null', () => {
    renderOverview({ weekDelta: null })

    // The supplement card should not show an up/down arrow with percentage for weekDelta.
    // Note: bodyFat trend may also contain ↓, so check specifically for the supplement delta pattern.
    expect(screen.queryByText(/↑\d+%/)).not.toBeInTheDocument()
    // ↓ can still exist from bodyFat trend; that is fine. Check there is no supplement delta.
    // The supplement section shows "↑5%" or "↓3%" format.
    // With weekDelta null, there should be no supplement delta arrow at all.
    // We just assert the supplement section does not have the delta span.
    // Since weekDelta is null, the entire delta span is not rendered in the supplement card.
    // The bodyFat trend "↓0.5%" still exists, which is expected.
    expect(screen.queryByText(/↑5%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/↓3%/)).not.toBeInTheDocument()
  })

  // ---- Renders lab results card ----
  it('renders lab results card with normal/total counts', () => {
    renderOverview()

    expect(screen.getByText(/血檢指標/)).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('/20')).toBeInTheDocument()
  })

  it('shows placeholder when no lab data', () => {
    renderOverview({ labTotal: 0, labNormal: 0 })

    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText('尚無血檢資料')).toBeInTheDocument()
  })

  // ---- Renders body fat card ----
  it('renders body fat card with value and trend', () => {
    renderOverview()

    expect(screen.getByText(/體脂率/)).toBeInTheDocument()
    expect(screen.getByText('15.2')).toBeInTheDocument()
    expect(screen.getByText(/↓0.5%/)).toBeInTheDocument()
  })

  it('shows placeholder when bodyFat is null', () => {
    renderOverview({ bodyFat: null, bodyFatTrend: null })

    expect(screen.getByText('尚無數據')).toBeInTheDocument()
  })

  // ---- Renders wellness/mood card ----
  it('renders today mood emoji when todayMood is provided', () => {
    renderOverview()

    expect(screen.getByText(/今日感受/)).toBeInTheDocument()
    // todayMood = 4 -> emoji 😊
    expect(screen.getByText('😊')).toBeInTheDocument()
  })

  it('shows "尚未記錄" when no mood and no wellness', () => {
    renderOverview({ todayMood: null, hasWellness: false })

    expect(screen.getByText('尚未記錄')).toBeInTheDocument()
  })

  it('shows "已記錄" when no mood but hasWellness is true', () => {
    renderOverview({ todayMood: null, hasWellness: true })

    expect(screen.getByText('已記錄')).toBeInTheDocument()
  })

  // ---- Supplement section can be disabled ----
  it('hides supplement card when supplementEnabled is false', () => {
    renderOverview({ supplementEnabled: false })

    expect(screen.queryByText(/本週服從率/)).not.toBeInTheDocument()
  })

  // ---- Lab section can be disabled ----
  it('hides lab card when labEnabled is false', () => {
    renderOverview({ labEnabled: false })

    expect(screen.queryByText(/血檢指標/)).not.toBeInTheDocument()
  })

  // ---- Body composition can be disabled ----
  it('hides body fat card when bodyCompositionEnabled is false', () => {
    renderOverview({ bodyCompositionEnabled: false })

    expect(screen.queryByText(/體脂率/)).not.toBeInTheDocument()
  })

  // ---- Wellness section can be disabled ----
  it('hides wellness card when wellnessEnabled is false', () => {
    renderOverview({ wellnessEnabled: false })

    expect(screen.queryByText(/今日感受/)).not.toBeInTheDocument()
  })

  // ---- Returns null when all cards disabled and no wearable ----
  it('returns null when all sections are disabled', () => {
    const { container } = renderOverview({
      supplementEnabled: false,
      labEnabled: false,
      bodyCompositionEnabled: false,
      wellnessEnabled: false,
      wearable: null,
      caloriesTarget: null,
    })

    expect(container.innerHTML).toBe('')
  })

  // ---- Calories card ----
  it('renders calories card when caloriesTarget is provided', () => {
    renderOverview({ caloriesTarget: 2200, todayCalories: 1800 })

    expect(screen.getByText('今日熱量')).toBeInTheDocument()
    expect(screen.getByText('1800')).toBeInTheDocument()
  })

  it('shows calorie compliance label', () => {
    renderOverview({ caloriesTarget: 2000, todayCalories: 1950 })

    // 1950/2000 = 97.5% -> label "熱量合規"
    expect(screen.getByText('熱量合規')).toBeInTheDocument()
  })

  it('shows "熱量偏低" when calories are below 80%', () => {
    renderOverview({ caloriesTarget: 2000, todayCalories: 1500 })

    // 1500/2000 = 75% < 80%
    expect(screen.getByText('熱量偏低')).toBeInTheDocument()
  })

  it('shows "--" when todayCalories is null with caloriesTarget', () => {
    renderOverview({ caloriesTarget: 2000, todayCalories: null })

    // Look for the "--" placeholder and target text
    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText(/目標 2000kcal/)).toBeInTheDocument()
  })

  // ---- Wearable data section ----
  it('renders wearable gauge cards when wearable data is provided', () => {
    renderOverview({
      wearable: {
        device_recovery_score: 75,
        resting_hr: 52,
        hrv: 85,
        wearable_sleep_score: 82,
        respiratory_rate: 14.5,
      },
    })

    expect(screen.getByText(/穿戴裝置數據/)).toBeInTheDocument()

    // GaugeCards should render with their labels (mocked)
    expect(screen.getByTestId('gauge-恢復分數')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-睡眠分數')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-靜息心率')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-HRV')).toBeInTheDocument()

    // Respiratory rate shown as text
    expect(screen.getByText(/14.5 次\/分/)).toBeInTheDocument()
  })

  it('does not render wearable section when wearable is null', () => {
    renderOverview({ wearable: null })

    expect(screen.queryByText(/穿戴裝置數據/)).not.toBeInTheDocument()
  })

  it('does not render wearable section when all wearable fields are null', () => {
    renderOverview({
      wearable: {
        device_recovery_score: null,
        resting_hr: null,
        hrv: null,
        wearable_sleep_score: null,
        respiratory_rate: null,
      },
    })

    expect(screen.queryByText(/穿戴裝置數據/)).not.toBeInTheDocument()
  })

  // ---- Wearable status labels ----
  it('shows correct recovery status for high score', () => {
    renderOverview({
      wearable: {
        device_recovery_score: 80,
        resting_hr: null,
        hrv: null,
        wearable_sleep_score: null,
      },
    })

    // score >= 67 -> "恢復良好"
    expect(screen.getByText('恢復良好')).toBeInTheDocument()
  })

  it('shows correct HR status label', () => {
    renderOverview({
      wearable: {
        device_recovery_score: null,
        resting_hr: 55,
        hrv: null,
        wearable_sleep_score: null,
      },
    })

    // hr <= 60 -> "優秀"
    expect(screen.getByText('優秀')).toBeInTheDocument()
  })

  // ---- Grid layout adapts to number of cards ----
  it('uses correct grid layout for varying card counts', () => {
    // 2 cards: supplement + wellness
    const { container } = renderOverview({
      labEnabled: false,
      bodyCompositionEnabled: false,
      caloriesTarget: null,
    })

    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-2')
  })
})
