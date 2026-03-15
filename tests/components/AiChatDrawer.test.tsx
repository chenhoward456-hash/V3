import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AiChatDrawer from '@/components/client/AiChatDrawer'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  X: () => React.createElement('span', { 'data-testid': 'x-icon' }, 'x'),
  Send: () => React.createElement('span', null, 'send'),
  Camera: () => React.createElement('span', null, 'camera'),
}))

// Mock scrollIntoView and focus (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn()
HTMLElement.prototype.focus = vi.fn()

const mockFetch = vi.fn()
global.fetch = mockFetch

const baseProps = {
  open: true,
  onClose: vi.fn(),
  clientId: 'c1',
  clientName: 'Alice',
  gender: '女性' as string | null,
  goalType: 'cut' as string | null,
  todayNutrition: null,
  caloriesTarget: 1800,
  proteinTarget: 140,
  carbsTarget: 180,
  fatTarget: 50,
  waterTarget: 2500,
  isTrainingDay: true,
  competitionEnabled: false,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AiChatDrawer', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.clearAllMocks()
    // Default mock for training-readiness fetch
    mockFetch.mockResolvedValue({ ok: false })
  })

  it('renders nothing when open is false', () => {
    const { container } = render(<AiChatDrawer {...baseProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders drawer header and quick questions when open', () => {
    render(<AiChatDrawer {...baseProps} />)
    expect(screen.getByText('AI 私人顧問')).toBeInTheDocument()
    expect(screen.getByText(/什麼都可以問我/)).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    render(<AiChatDrawer {...baseProps} />)
    // Click the backdrop (first fixed element with bg-black)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('populates input when quick question is clicked', () => {
    render(<AiChatDrawer {...baseProps} />)
    const quickQ = screen.getByText('我今天剩餘的量，去 711 要怎麼買？')
    fireEvent.click(quickQ)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('我今天剩餘的量，去 711 要怎麼買？')
  })

  it('shows remaining macros in header when targets exist', () => {
    render(<AiChatDrawer {...baseProps} />)
    // With no todayNutrition and targets set, remaining should show full targets
    expect(screen.getByText(/蛋白質 140g/)).toBeInTheDocument()
  })

  it('shows loading indicator after sending a message', async () => {
    // Make the chat API hang
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // training-readiness
      .mockReturnValueOnce(new Promise(() => {})) // chat hangs

    render(<AiChatDrawer {...baseProps} />)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '今天吃什麼' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    // Should show the user message and loading dots
    await waitFor(() => {
      expect(screen.getByText('今天吃什麼')).toBeInTheDocument()
    })
    // Loading animation dots should be present
    expect(document.querySelectorAll('.animate-bounce').length).toBeGreaterThan(0)
  })
})
