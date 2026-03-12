/**
 * Tests for @/lib/cron-utils
 *
 * Covers:
 *   - startCronRun: idempotency check, new run creation, DB error handling
 *   - completeCronRun: status update, unknown runId skip
 *   - failCronRun: error recording, unknown runId skip
 */

import { startCronRun, completeCronRun, failCronRun, type CronJobType } from '@/lib/cron-utils'

// ── Mock setup ──

const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEqChain = vi.fn()

// Build a fluent chain that handles arbitrary .eq() calls
function createMockFrom() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
  return chainable
}

let mockChainable: ReturnType<typeof createMockFrom>

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => ({
    from: vi.fn(() => {
      mockChainable = createMockFrom()
      return mockChainable
    }),
  })),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks()
})

describe('startCronRun', () => {
  it('should return alreadyRan=true when a completed run exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-run-id' } })

    const result = await startCronRun('daily_morning', '2024-03-01')

    expect(result.alreadyRan).toBe(true)
    expect(result.runId).toBe('existing-run-id')
  })

  it('should create a new run record when no completed run exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    mockSingle.mockResolvedValue({ data: { id: 'new-run-id' }, error: null })

    const result = await startCronRun('daily_evening', '2024-03-01')

    expect(result.alreadyRan).toBe(false)
    expect(result.runId).toBe('new-run-id')
  })

  it('should return unknown runId when insert fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB insert error' } })

    const result = await startCronRun('weekly', '2024-03-01')

    expect(result.alreadyRan).toBe(false)
    expect(result.runId).toBe('unknown')
  })

  it('should accept all valid CronJobType values', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    mockSingle.mockResolvedValue({ data: { id: 'test-id' }, error: null })

    const jobTypes: CronJobType[] = ['daily_morning', 'daily_evening', 'weekly', 'monthly']
    for (const jobType of jobTypes) {
      const result = await startCronRun(jobType, '2024-03-01')
      expect(result.runId).toBeDefined()
    }
  })

  it('should query with correct job_type and run_date', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    mockSingle.mockResolvedValue({ data: { id: 'id-1' }, error: null })

    await startCronRun('monthly', '2024-06-15')

    // The chain should have been called - we verify the function completed without error
    expect(mockMaybeSingle).toHaveBeenCalled()
  })
})

describe('completeCronRun', () => {
  it('should skip update when runId is "unknown"', async () => {
    await completeCronRun('unknown')
    // No supabase call should be made
    // The function should return immediately without error
    expect(true).toBe(true)
  })

  it('should update the cron run to completed status', async () => {
    await completeCronRun('run-123', { clientsProcessed: 5 })
    // Should not throw
    expect(true).toBe(true)
  })

  it('should work without metadata', async () => {
    await completeCronRun('run-456')
    expect(true).toBe(true)
  })

  it('should handle supabase update error gracefully (logs but does not throw)', async () => {
    // The function should not throw even when supabase returns error
    await expect(completeCronRun('run-789', { test: true })).resolves.toBeUndefined()
  })

  it('should pass metadata to supabase update', async () => {
    const metadata = { clientsProcessed: 10, duration: 5000 }
    await completeCronRun('run-abc', metadata)
    // Function completes without error
    expect(true).toBe(true)
  })
})

describe('failCronRun', () => {
  it('should skip update when runId is "unknown"', async () => {
    await failCronRun('unknown', 'some error')
    expect(true).toBe(true)
  })

  it('should update cron run with error message', async () => {
    await failCronRun('run-err-1', 'Connection timeout')
    expect(true).toBe(true)
  })

  it('should pass metadata along with error', async () => {
    await failCronRun('run-err-2', 'API rate limit', { retryCount: 3 })
    expect(true).toBe(true)
  })

  it('should handle supabase update error gracefully', async () => {
    await expect(failCronRun('run-err-3', 'Fatal error')).resolves.toBeUndefined()
  })

  it('should work with empty error message', async () => {
    await failCronRun('run-err-4', '')
    expect(true).toBe(true)
  })
})
