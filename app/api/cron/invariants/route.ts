/**
 * Daily invariant check — 跑跨表 invariant 檢查，有 violation 就推 LINE 給教練
 *
 * 檢查邏輯在 lib/invariant-checks.ts（與 npm run check:invariants 共用）。
 * 乾淨時不推播（每日靜默），只有 violation 才通知；warning 附在同一則訊息。
 *
 * 排程：vercel.json 設成每日台灣 07:00 (23:00 UTC)
 * Auth: CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { runInvariantChecks } from '@/lib/invariant-checks'

export const maxDuration = 60

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const findings = await runInvariantChecks(createServiceSupabase())
  const violations = findings.filter(f => f.severity === 'violation')
  const warnings = findings.filter(f => f.severity === 'warning')

  if (violations.length > 0) {
    const coachLineId = process.env.ADMIN_LINE_USER_ID
    if (coachLineId) {
      const lines = [
        `🚨 Invariant 檢查：${violations.length} violations`,
        ...violations.slice(0, 8).map(f => `❌ [${f.check}] ${f.detail}`),
        ...(violations.length > 8 ? [`…還有 ${violations.length - 8} 筆`] : []),
        ...(warnings.length > 0 ? [`另有 ${warnings.length} warnings（不擋，跑 npm run check:invariants 看明細）`] : []),
      ]
      await pushMessage(coachLineId, [{ type: 'text', text: lines.join('\n') }]).catch(() => {})
    }
  }

  return NextResponse.json({
    ok: violations.length === 0,
    violations: violations.length,
    warnings: warnings.length,
    findings,
  })
}
