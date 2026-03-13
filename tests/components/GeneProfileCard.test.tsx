import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GeneProfileCard from '@/components/client/GeneProfileCard'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  ChevronDown: () => React.createElement('span', null, 'v'),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const baseProps = {
  mthfr: null as string | null,
  apoe: null as string | null,
  serotonin: null as string | null,
  notes: null as string | null,
  clientId: 'c1',
  onMutate: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GeneProfileCard', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.clearAllMocks()
  })

  it('renders header with "not filled" badge when no gene data', () => {
    render(<GeneProfileCard {...baseProps} />)
    expect(screen.getByText('基因檔案')).toBeInTheDocument()
    expect(screen.getByText('未填寫')).toBeInTheDocument()
  })

  it('shows "configured" badge when gene data exists', () => {
    render(<GeneProfileCard {...baseProps} mthfr="heterozygous" />)
    expect(screen.getByText('已設定')).toBeInTheDocument()
  })

  it('expands to show gene rows on header click', () => {
    render(<GeneProfileCard {...baseProps} mthfr="heterozygous" apoe="e3/e4" />)
    // Click the header button to expand
    fireEvent.click(screen.getByText('基因檔案'))
    expect(screen.getByText('MTHFR')).toBeInTheDocument()
    expect(screen.getByText('APOE')).toBeInTheDocument()
    expect(screen.getByText('5-HTTLPR')).toBeInTheDocument()
  })

  it('shows risk hint for high-risk gene variants', () => {
    render(<GeneProfileCard {...baseProps} apoe="e4/e4" />)
    fireEvent.click(screen.getByText('基因檔案'))
    expect(screen.getByText(/心血管高風險/)).toBeInTheDocument()
  })

  it('enters edit mode and shows form fields', () => {
    render(<GeneProfileCard {...baseProps} />)
    fireEvent.click(screen.getByText('基因檔案'))
    fireEvent.click(screen.getByText('填寫基因檢測結果'))
    expect(screen.getByText('MTHFR 葉酸代謝基因')).toBeInTheDocument()
    expect(screen.getByText('APOE 脂質代謝基因')).toBeInTheDocument()
    expect(screen.getByText('儲存')).toBeInTheDocument()
    expect(screen.getByText('取消')).toBeInTheDocument()
  })

  it('shows genetic corrections when provided', () => {
    const corrections = [
      { gene: 'mthfr', rule: 'MTHFR rule', adjustment: '活性葉酸 +400mcg' },
    ]
    render(<GeneProfileCard {...baseProps} mthfr="homozygous" geneticCorrections={corrections} />)
    // Corrections summary visible even when collapsed
    expect(screen.getByText(/MTHFR rule/)).toBeInTheDocument()
  })
})
