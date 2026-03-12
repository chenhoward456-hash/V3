import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CookieConsent from '@/components/CookieConsent'

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}))

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CookieConsent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorageMock.clear()
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the banner after the initial delay', () => {
    render(<CookieConsent />)

    // Not visible yet
    expect(screen.queryByText('接受')).not.toBeInTheDocument()

    // Advance past the 1500ms delay
    act(() => { vi.advanceTimersByTime(1500) })

    expect(screen.getByText('接受')).toBeInTheDocument()
    expect(screen.getByText('拒絕')).toBeInTheDocument()
  })

  it('hides the banner after clicking accept', () => {
    render(<CookieConsent />)
    act(() => { vi.advanceTimersByTime(1500) })

    fireEvent.click(screen.getByText('接受'))

    expect(screen.queryByText('接受')).not.toBeInTheDocument()
  })

  it('stores "accepted" in localStorage when accept is clicked', () => {
    render(<CookieConsent />)
    act(() => { vi.advanceTimersByTime(1500) })

    fireEvent.click(screen.getByText('接受'))

    expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie_consent', 'accepted')
  })

  it('dispatches cookie-consent-changed event on accept', () => {
    render(<CookieConsent />)
    act(() => { vi.advanceTimersByTime(1500) })

    fireEvent.click(screen.getByText('接受'))

    expect(window.dispatchEvent).toHaveBeenCalled()
  })

  it('stores "declined" in localStorage when decline is clicked', () => {
    render(<CookieConsent />)
    act(() => { vi.advanceTimersByTime(1500) })

    fireEvent.click(screen.getByText('拒絕'))

    expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie_consent', 'declined')
  })

  it('does not show the banner if already accepted', () => {
    localStorageMock.setItem('cookie_consent', 'accepted')
    render(<CookieConsent />)

    act(() => { vi.advanceTimersByTime(2000) })

    expect(screen.queryByText('接受')).not.toBeInTheDocument()
  })

  it('includes a link to the privacy policy', () => {
    render(<CookieConsent />)
    act(() => { vi.advanceTimersByTime(1500) })

    const link = screen.getByText('隱私政策')
    expect(link).toHaveAttribute('href', '/privacy')
  })
})
