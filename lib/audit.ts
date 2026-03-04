/**
 * 審計日誌模組
 * 記錄重要操作（學員建立/刪除、資料修改、付款等）到 audit_logs 表
 *
 * 需要先在 Supabase 執行以下 SQL：
 *
 * CREATE TABLE IF NOT EXISTS audit_logs (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   action TEXT NOT NULL,
 *   actor TEXT NOT NULL,
 *   target_type TEXT,
 *   target_id TEXT,
 *   details JSONB DEFAULT '{}',
 *   ip TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * CREATE INDEX idx_audit_logs_action ON audit_logs(action);
 * CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
 */

import { createServiceSupabase } from '@/lib/supabase'

export type AuditAction =
  | 'client.create'
  | 'client.update'
  | 'client.delete'
  | 'client.view'
  | 'payment.completed'
  | 'payment.failed'
  | 'admin.login'
  | 'admin.export'
  | 'ai.chat'
  | 'subscription.created'

interface AuditEntry {
  action: AuditAction
  actor: string          // 'admin', 'system', 'client:{id}', etc.
  targetType?: string    // 'client', 'payment', etc.
  targetId?: string
  details?: Record<string, unknown>
  ip?: string
}

/**
 * 寫入審計日誌（非阻塞，失敗不影響主流程）
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceSupabase()
    await supabase.from('audit_logs').insert({
      action: entry.action,
      actor: entry.actor,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      details: entry.details || {},
      ip: entry.ip || null,
    })
  } catch {
    // 審計日誌寫入失敗不應中斷主流程
    if (process.env.NODE_ENV === 'development') {
      console.warn('[audit] Failed to write audit log:', entry.action)
    }
  }
}
