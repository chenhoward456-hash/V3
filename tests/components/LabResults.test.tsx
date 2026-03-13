import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LabResults from '@/components/client/LabResults'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateStr: () => '2026-03-12',
}))

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  XAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('lucide-react', () => ({
  Plus: () => React.createElement('span', null, '+'),
  Pencil: () => React.createElement('span', null, 'edit'),
  Trash2: () => React.createElement('span', null, 'del'),
  X: () => React.createElement('span', null, 'x'),
}))

// Mock types / lab utilities
vi.mock('@/components/client/types', () => ({
  getLabAdvice: () => 'mock advice',
}))

vi.mock('@/utils/labStatus', () => ({
  isInOptimalRange: () => false,
  getOptimalRangeText: () => '50-100',
}))

const baseProps = {
  labResults: [] as any[],
  isCoachMode: false,
  clientId: 'c1',
  coachHeaders: { 'Content-Type': 'application/json' },
  onMutate: vi.fn(),
}

function makeLabResult(overrides: Partial<any> = {}) {
  return {
    id: '1',
    test_name: 'HOMA-IR',
    value: 1.2,
    unit: '',
    reference_range: '<2.0',
    status: 'normal',
    date: '2026-03-01',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LabResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no lab results exist', () => {
    render(<LabResults {...baseProps} />)
    expect(screen.getByText('尚無血檢資料')).toBeInTheDocument()
  })

  it('renders lab result cards when data exists', () => {
    const results = [makeLabResult()]
    render(<LabResults {...baseProps} labResults={results} />)
    expect(screen.getByText('HOMA-IR')).toBeInTheDocument()
    expect(screen.getByText('1.2')).toBeInTheDocument()
  })

  it('renders heading and add button', () => {
    render(<LabResults {...baseProps} />)
    expect(screen.getByText('血檢數據紀錄')).toBeInTheDocument()
    const addBtn = screen.getByRole('button', { name: /新增血檢/ })
    expect(addBtn).toBeInTheDocument()
  })

  it('opens modal when add button clicked', () => {
    render(<LabResults {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /新增血檢/ }))
    expect(screen.getByText('指標名稱 *')).toBeInTheDocument()
    expect(screen.getByText('儲存')).toBeInTheDocument()
  })

  it('groups multiple results by test name', () => {
    const results = [
      makeLabResult({ id: '1', test_name: 'HOMA-IR', date: '2026-02-01', value: 1.5 }),
      makeLabResult({ id: '2', test_name: 'HOMA-IR', date: '2026-03-01', value: 1.2 }),
      makeLabResult({ id: '3', test_name: 'LDL-C', date: '2026-03-01', value: 90 }),
    ]
    render(<LabResults {...baseProps} labResults={results} />)
    // Should see both test names (one card each)
    expect(screen.getByText('HOMA-IR')).toBeInTheDocument()
    expect(screen.getByText('LDL-C')).toBeInTheDocument()
  })

  it('shows disclaimer about non-medical purpose', () => {
    render(<LabResults {...baseProps} />)
    expect(screen.getByText(/不構成醫療診斷/)).toBeInTheDocument()
  })
})
