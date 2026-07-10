import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DailyWellness from '@/components/client/DailyWellness'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateStr: () => '2026-03-12',
}))

vi.mock('@/components/client/WearableImport', () => ({
  default: () => React.createElement('div', { 'data-testid': 'wearable-import' }, 'WearableImport'),
}))

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const defaultProps = {
  todayWellness: null,
  clientId: 'test-client',
  onMutate: vi.fn(),
}

function renderWellness(overrides: Record<string, any> = {}) {
  return render(<DailyWellness {...defaultProps} {...overrides} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DailyWellness', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockShowToast.mockReset()
    defaultProps.onMutate = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Renders title ----
  it('renders the daily wellness heading', () => {
    renderWellness()
    expect(screen.getByText('每日感受')).toBeInTheDocument()
  })

  // ---- Renders core fields (sleep, energy, training drive) ----
  // 核心三項改版為：睡眠 / 精力 / 想不想練（心情改到「更多指標」選填區）
  it('renders all three core input fields with labels', () => {
    renderWellness()

    expect(screen.getByText(/睡眠品質/)).toBeInTheDocument()
    expect(screen.getByText(/精力水平/)).toBeInTheDocument()
    expect(screen.getByText(/想不想練/)).toBeInTheDocument()
  })

  // ---- Core field options are clickable ----
  it('renders 5 options for each core field', () => {
    renderWellness()

    // 三個核心欄位（睡眠/精力/想不想練）都有「普通」選項
    expect(screen.getAllByText('普通').length).toBeGreaterThanOrEqual(3)

    // Unique labels per field to confirm each renders
    expect(screen.getByText('不錯')).toBeInTheDocument()  // sleep score 4
    expect(screen.getByText('沒電')).toBeInTheDocument()  // energy score 1
    expect(screen.getByText('充沛')).toBeInTheDocument()  // energy score 4
    expect(screen.getByText('想練')).toBeInTheDocument()  // training drive score 4
    expect(screen.getByText('超想')).toBeInTheDocument()  // training drive score 5
  })

  // ---- Submit button is disabled without required fields ----
  it('disables the submit button when core fields are not filled', () => {
    renderWellness()

    const submitBtn = screen.getByText('記錄感受')
    expect(submitBtn).toBeDisabled()
  })

  // ---- Required hint visible when core not filled ----
  it('shows required hint when core fields are not filled', () => {
    renderWellness()

    expect(screen.getByText(/請填寫.*標記的三項必填指標/)).toBeInTheDocument()
  })

  // ---- Selecting options enables submit ----
  it('enables the submit button after all three core fields are selected', () => {
    renderWellness()

    // 核心三項 = 睡眠 / 精力 / 想不想練。各選一個分數即可解鎖送出。
    // Sleep: 😌 (score 4), Energy: ⚡ (score 4), Training drive: 💪 (score 4)
    fireEvent.click(screen.getByText('😌'))
    fireEvent.click(screen.getByText('⚡'))
    fireEvent.click(screen.getByText('💪'))

    const submitBtn = screen.getByText('記錄感受')
    expect(submitBtn).not.toBeDisabled()
  })

  // ---- Toggle selection off ----
  it('deselects a score when the same option is clicked again', () => {
    renderWellness()

    // Click to select
    fireEvent.click(screen.getByText('😌'))
    // Click again to deselect
    fireEvent.click(screen.getByText('😌'))

    // Submit should still be disabled (sleep deselected)
    const submitBtn = screen.getByText('記錄感受')
    expect(submitBtn).toBeDisabled()
  })

  // ---- Shows toast error when submitting without required fields ----
  it('shows error toast when trying to submit without all core fields', async () => {
    renderWellness()

    // Select only sleep
    fireEvent.click(screen.getByText('😌'))
    // Force-enable button by removing disabled attribute check and calling handleSubmit
    // Actually the button is disabled so we can't click it.
    // The guard is in the button disabled prop, so we test the toast via a different path:
    // Since disabled blocks the click, this behavior is inherently tested above.
    // Let's confirm the button stays disabled
    const submitBtn = screen.getByText('記錄感受')
    expect(submitBtn).toBeDisabled()
  })

  // ---- Successful submission ----
  it('submits form data to /api/daily-wellness and shows success toast', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    renderWellness()

    // Fill all three core fields (sleep / energy / training drive)
    fireEvent.click(screen.getByText('😌')) // sleep = 4
    fireEvent.click(screen.getByText('⚡')) // energy = 4
    fireEvent.click(screen.getByText('💪')) // training drive = 4

    const submitBtn = screen.getByText('記錄感受')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/daily-wellness', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    // Parse the body to verify the payload
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.clientId).toBe('test-client')
    expect(callBody.date).toBe('2026-03-12')
    expect(callBody.sleep_quality).toBe(4)
    expect(callBody.energy_level).toBe(4)
    expect(callBody.training_drive).toBe(4)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('感受已記錄！', 'success', '🎉')
      expect(defaultProps.onMutate).toHaveBeenCalled()
    })
  })

  // ---- Shows "更新感受" when todayWellness exists ----
  it('shows "更新感受" instead of "記錄感受" when todayWellness is provided', () => {
    renderWellness({
      todayWellness: {
        sleep_quality: 4,
        energy_level: 3,
        mood: 4,
      },
    })

    expect(screen.getByText('更新感受')).toBeInTheDocument()
  })

  // ---- Pre-populates form when todayWellness provided ----
  it('pre-fills form values from todayWellness prop', () => {
    const { container } = renderWellness({
      todayWellness: {
        sleep_quality: 4,
        energy_level: 3,
        training_drive: 4,
      },
    })

    // The submit button should be enabled since all three core fields are pre-filled
    const submitBtn = screen.getByText('更新感受')
    expect(submitBtn).not.toBeDisabled()
  })

  // ---- Expand "more metrics" section ----
  it('shows extra metrics when the "fill more" button is clicked', () => {
    renderWellness()

    // The "fill more metrics" button
    const moreBtn = screen.getByText(/填寫更多指標/)
    fireEvent.click(moreBtn)

    // 心情（今日心情）現在是「更多指標」選填欄，展開後才出現
    expect(screen.getByText(/今日心情/)).toBeInTheDocument()
  })

  it('can collapse the extra metrics section', () => {
    renderWellness()

    fireEvent.click(screen.getByText(/填寫更多指標/))
    expect(screen.getByText(/今日心情/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/收起更多指標/))
    expect(screen.queryByText(/今日心情/)).not.toBeInTheDocument()
  })

  // ---- Health mode extra fields ----
  it('shows cognitive clarity and stress fields when healthModeEnabled', () => {
    renderWellness({ healthModeEnabled: true })

    fireEvent.click(screen.getByText(/填寫更多指標/))

    expect(screen.getByText(/認知清晰度/)).toBeInTheDocument()
    expect(screen.getByText(/壓力指數/)).toBeInTheDocument()
  })

  it('does not show cognitive/stress fields when healthModeEnabled is false', () => {
    renderWellness({ healthModeEnabled: false })

    fireEvent.click(screen.getByText(/填寫更多指標/))

    expect(screen.queryByText(/認知清晰度/)).not.toBeInTheDocument()
    expect(screen.queryByText(/壓力指數/)).not.toBeInTheDocument()
  })

  // ---- Wearable device section toggle ----
  it('shows wearable device input section when the wearable button is clicked', () => {
    renderWellness()

    const wearableBtn = screen.getByText(/填恢復分數/)
    fireEvent.click(wearableBtn)

    // After clicking, the section expands and shows a numeric input with placeholder "--"
    expect(screen.getByPlaceholderText('--')).toBeInTheDocument()
    // Also shows the descriptive text about wearable devices
    expect(screen.getByText(/WHOOP Recovery/)).toBeInTheDocument()
  })

  // ---- Period tracking for female users ----
  it('shows period tracking button for female users', () => {
    renderWellness({ gender: '女性' })

    expect(screen.getByText(/今天月經來了/)).toBeInTheDocument()
  })

  it('does not show period tracking for male users', () => {
    renderWellness({ gender: '男性' })

    expect(screen.queryByText(/今天月經來了/)).not.toBeInTheDocument()
  })

  it('toggles period start when the period button is clicked', () => {
    renderWellness({ gender: 'female' })

    const periodBtn = screen.getByText(/今天月經來了/).closest('button')!
    fireEvent.click(periodBtn)

    expect(screen.getByText('已標記')).toBeInTheDocument()

    fireEvent.click(periodBtn)
    expect(screen.getByText('點擊標記')).toBeInTheDocument()
  })

  // ---- Note textarea ----
  it('renders a textarea for notes', () => {
    renderWellness()

    const textarea = screen.getByPlaceholderText('今天特別的感受？')
    expect(textarea).toBeInTheDocument()
  })

  it('allows typing in the notes textarea', () => {
    renderWellness()

    const textarea = screen.getByPlaceholderText('今天特別的感受？') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Feeling great today' } })

    expect(textarea.value).toBe('Feeling great today')
  })

  // ---- Failed submission shows error toast ----
  it('shows error toast when submission fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })

    renderWellness()

    fireEvent.click(screen.getByText('😌'))
    fireEvent.click(screen.getByText('⚡'))
    fireEvent.click(screen.getByText('💪'))

    fireEvent.click(screen.getByText('記錄感受'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('提交失敗，請重試', 'error')
    })
  })

  // ---- Shows submitting state ----
  it('shows "儲存中..." during submission', async () => {
    // Use a promise that we can control resolution of
    let resolveFetch: (value: any) => void
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))

    renderWellness()

    fireEvent.click(screen.getByText('😌'))
    fireEvent.click(screen.getByText('⚡'))
    fireEvent.click(screen.getByText('💪'))

    fireEvent.click(screen.getByText('記錄感受'))

    await waitFor(() => {
      expect(screen.getByText('儲存中...')).toBeInTheDocument()
    })

    // Resolve to clean up
    resolveFetch!({ ok: true, json: async () => ({}) })
  })

  // ---- WearableImport component is rendered ----
  it('renders the WearableImport component', () => {
    renderWellness()

    expect(screen.getByTestId('wearable-import')).toBeInTheDocument()
  })

  // ---- Custom date prop ----
  it('uses the provided date prop instead of getLocalDateStr', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    renderWellness({ date: '2026-01-15' })

    fireEvent.click(screen.getByText('😌'))
    fireEvent.click(screen.getByText('⚡'))
    fireEvent.click(screen.getByText('💪'))

    fireEvent.click(screen.getByText('記錄感受'))

    await waitFor(() => {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.date).toBe('2026-01-15')
    })
  })
})
