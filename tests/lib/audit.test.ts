import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock Supabase ──

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Setup ──

beforeEach(() => {
  mockInsert.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
  mockFrom.mockClear()
  mockInsert.mockReset()
})

// ── Import SUT ──

import { writeAuditLog, type AuditAction } from '@/lib/audit'

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('writeAuditLog', () => {
  it('writes a complete audit entry to the audit_logs table', async () => {
    await writeAuditLog({
      action: 'client.create',
      actor: 'admin',
      targetType: 'client',
      targetId: 'client_123',
      details: { name: 'Test User' },
      ip: '192.168.1.1',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      action: 'client.create',
      actor: 'admin',
      target_type: 'client',
      target_id: 'client_123',
      details: { name: 'Test User' },
      ip: '192.168.1.1',
    })
  })

  it('defaults optional fields to null or empty object', async () => {
    await writeAuditLog({
      action: 'admin.login',
      actor: 'system',
    })

    expect(mockInsert).toHaveBeenCalledWith({
      action: 'admin.login',
      actor: 'system',
      target_type: null,
      target_id: null,
      details: {},
      ip: null,
    })
  })

  it('does not throw when Supabase insert returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInsert.mockResolvedValue({ error: { message: 'insert failed' } })

    // Should not throw
    await expect(writeAuditLog({
      action: 'payment.completed',
      actor: 'system',
    })).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[audit]'),
      'payment.completed',
      'insert failed'
    )
    consoleSpy.mockRestore()
  })

  it('does not throw when Supabase client throws an exception', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInsert.mockRejectedValue(new Error('Connection refused'))

    await expect(writeAuditLog({
      action: 'client.delete',
      actor: 'admin',
      targetType: 'client',
      targetId: 'client_456',
    })).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[audit]'),
      'client.delete',
      'Connection refused'
    )
    consoleSpy.mockRestore()
  })

  it('maps all AuditAction types correctly', async () => {
    const actions: AuditAction[] = [
      'client.create', 'client.update', 'client.delete', 'client.view',
      'payment.completed', 'payment.failed',
      'admin.login', 'admin.export',
      'ai.chat', 'subscription.created',
    ]

    for (const action of actions) {
      mockInsert.mockResolvedValue({ error: null })
      await writeAuditLog({ action, actor: 'test' })
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ action })
      )
    }

    expect(mockInsert).toHaveBeenCalledTimes(actions.length)
  })
})
