/**
 * Nurture Sequence Cron — 12 天 LINE 養客序列每日 dispatcher
 *
 * 功能：
 *   找出所有 active 訂閱者，根據 followed_at 計算今天該發 Day 2/4/6/8/10/12 哪一封。
 *
 * 排程：Vercel Cron
 *   - 每日 11:00 UTC（台灣 19:00）— 涵蓋 Day 2/6/8 的晚間發送
 *   - 每日 12:00 UTC（台灣 20:00）— 涵蓋 Day 10/12 的晚間發送
 *   - 每日 02:00 UTC（台灣 10:00）— 涵蓋 Day 4 的上午發送（週六）
 *
 *   實際上由於 dispatcher 會自動找「最近一筆該發但還沒發的 Day」，多次執行幂等。
 *
 * 驗證：CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { dispatchNurtureSequence } from '@/lib/nurture-sequence'
import { createLogger } from '@/lib/logger'

export const maxDuration = 300

const logger = createLogger('cron-nurture-sequence')

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  logger.info('Nurture sequence dispatch started')

  try {
    const supabase = createServiceSupabase()
    const result = await dispatchNurtureSequence(supabase)

    const durationMs = Date.now() - startedAt
    logger.info('Nurture sequence dispatch completed', { ...result, durationMs })

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      sent: result.sent,
      errors: result.errors,
      durationMs,
      details: result.details,
    })
  } catch (err) {
    logger.error('Nurture sequence dispatch failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// 同時支援 POST（手動觸發測試用）
export const POST = GET
