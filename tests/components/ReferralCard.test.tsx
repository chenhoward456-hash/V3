import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ReferralCard from '@/components/client/ReferralCard'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockSuccessResponse(data = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 'REF-ABC123',
      totalReferrals: 5,
      rewardDays: 35,
      ...data,
    }),
  })
}

function mockErrorResponse() {
  mockFetch.mockResolvedValueOnce({ ok: false })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ReferralCard', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.clearAllMocks()
  })

  it('shows loading skeleton while fetching', () => {
    // Never resolves during this test
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    const { container } = render(<ReferralCard clientId="c1" />)

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders referral code and stats after loading', async () => {
    mockSuccessResponse()
    render(<ReferralCard clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText('REF-ABC123')).toBeInTheDocument()
    })

    expect(screen.getByText('5')).toBeInTheDocument()  // totalReferrals
    expect(screen.getByText('35')).toBeInTheDocument() // rewardDays
    expect(screen.getByText('成功推薦')).toBeInTheDocument()
    expect(screen.getByText('獲得天數')).toBeInTheDocument()
  })

  it('copies referral code to clipboard when copy button clicked', async () => {
    mockSuccessResponse()
    render(<ReferralCard clientId="c1" />)

    await waitFor(() => {
      expect(screen.getByText('REF-ABC123')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('複製'))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('REF-ABC123')
    await waitFor(() => {
      expect(screen.getByText('已複製')).toBeInTheDocument()
    })
  })

  it('renders nothing on error response', async () => {
    mockErrorResponse()
    const { container } = render(<ReferralCard clientId="c1" />)

    await waitFor(() => {
      // Loading should be done
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })

    // Card renders null on error
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing on fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const { container } = render(<ReferralCard clientId="c1" />)

    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })

    expect(container.innerHTML).toBe('')
  })

  it('fetches with the correct clientId param', async () => {
    mockSuccessResponse()
    render(<ReferralCard clientId="my-unique-id" />)

    expect(mockFetch).toHaveBeenCalledWith('/api/referral?clientId=my-unique-id')

    // Wait for the fetch to settle to avoid act() warnings
    await waitFor(() => {
      expect(screen.getByText('REF-ABC123')).toBeInTheDocument()
    })
  })
})

it('does not generate on mount and creates only after the student clicks', async () => {
  mockFetch.mockReset()
  mockSuccessResponse({ code: null, totalReferrals: 0, rewardDays: 0 })
  render(<ReferralCard clientId="QAonly" />)
  await screen.findByRole('button', { name: '產生推薦碼' })
  expect(mockFetch).toHaveBeenCalledTimes(1)
  mockSuccessResponse({ code: 'REF-CREATED', totalReferrals: 0, rewardDays: 0 })
  fireEvent.click(screen.getByRole('button', { name: '產生推薦碼' }))
  await screen.findByText('REF-CREATED')
  expect(mockFetch).toHaveBeenLastCalledWith('/api/referral', expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'create_code', clientId: 'QAonly' }) }))
})

it('submits once for synchronous clicks and allows retry after failure', async () => {
  mockFetch.mockReset()
  mockSuccessResponse({ code: null, totalReferrals: 0, rewardDays: 0 })
  render(<ReferralCard clientId="QAonly" />)
  const button = await screen.findByRole('button', { name: '產生推薦碼' })
  let finish!: (response: unknown) => void
  mockFetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  mockFetch.mockReturnValue(new Promise(() => {}))
  act(() => { button.click(); button.click() })
  expect(mockFetch).toHaveBeenCalledTimes(2)
  await act(async () => { finish({ ok: false, json: async () => ({ error: 'fixture failure' }) }) })
  expect(await screen.findByRole('alert')).toHaveTextContent('產生失敗，請重試')
  expect(button).not.toBeDisabled()
  mockSuccessResponse({ code: 'REF-RETRIED', totalReferrals: 0, rewardDays: 0 })
  act(() => { button.click(); button.click() })
  await screen.findByText('REF-RETRIED')
  expect(mockFetch).toHaveBeenCalledTimes(3)
})
