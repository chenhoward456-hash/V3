/**
 * Cron Job 工具函數
 * - 冪等性檢查（防止重複執行）
 * - 執行紀錄寫入 cron_runs 表
 */

import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('cron-utils')

export type CronJobType = 'daily_morning' | 'daily_evening' | 'weekly' | 'monthly'

interface CronRunResult {
  runId: string
  alreadyRan: boolean
}

/**
 * 開始 cron run：檢查是否已執行，若否則建立紀錄
 */
export async function startCronRun(jobType: CronJobType, runDate: string): Promise<CronRunResult> {
  const supabase = createServiceSupabase()

  // 檢查是否已有成功紀錄
  const { data: existing } = await supabase
    .from('cron_runs')
    .select('id')
    .eq('job_type', jobType)
    .eq('run_date', runDate)
    .eq('status', 'completed')
    .maybeSingle()

  if (existing) {
    return { runId: existing.id, alreadyRan: true }
  }

  // 建立新的執行紀錄
  const { data, error } = await supabase
    .from('cron_runs')
    .insert({
      job_type: jobType,
      run_date: runDate,
      status: 'running',
    })
    .select('id')
    .single()

  if (error) {
    logger.error('Failed to create cron_run record', error)
    // 不阻擋執行，回傳假 ID
    return { runId: 'unknown', alreadyRan: false }
  }

  return { runId: data.id, alreadyRan: false }
}

/**
 * 完成 cron run：更新狀態為 completed
 */
export async function completeCronRun(
  runId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (runId === 'unknown') return

  const supabase = createServiceSupabase()
  const { error } = await supabase
    .from('cron_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: metadata || {},
    })
    .eq('id', runId)

  if (error) {
    logger.error('Failed to update cron_run to completed', error)
  }
}

/**
 * 標記 cron run 失敗
 */
export async function failCronRun(
  runId: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (runId === 'unknown') return

  const supabase = createServiceSupabase()
  const { error } = await supabase
    .from('cron_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      metadata: metadata || {},
    })
    .eq('id', runId)

  if (error) {
    logger.error('Failed to update cron_run to failed', error)
  }
}
