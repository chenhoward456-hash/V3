import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { loadCoachDigest, COACH_LINE_USER_ID } from '@/lib/coach-digest'
import { pushMessage } from '@/lib/line'
import { getLocalDateStr } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

/**
 * 教練晨報：預覽 / 立刻補發一封。
 *
 * ⚠️ 為什麼需要這支（2026-08-23）：Howard 說「你直接發一封我看」，
 * 但原本唯一能觸發晨報的方法是跑整支 `/api/cron/daily` ——
 * 那會**把提醒推播給所有學員**。不能為了看一封信做這種事。
 *
 * GET  → 只回內容，不發（預覽）
 * POST → 真的推到教練 LINE
 *
 * 兩者都走 `loadCoachDigest`，跟排程同一條路徑，所以預覽 = 排程實際會送的那封。
 */

function auth(request: NextRequest): boolean {
  const s = request.cookies.get('admin_session')?.value
  return !!s && verifyAdminSession(s)
}

async function build() {
  const supabase = createServiceSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
  return loadCoachDigest(supabase, { today: getLocalDateStr(new Date()), adminUrl: siteUrl })
}

export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  const digest = await build()
  return NextResponse.json({
    success: true,
    sent: false,
    text: digest.text,
    offline: digest.offline,
    empty: digest.text == null,
  })
}

export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  const digest = await build()
  if (!digest.text) {
    return NextResponse.json({ success: true, sent: false, empty: true, text: null })
  }
  try {
    await pushMessage(COACH_LINE_USER_ID, [{ type: 'text', text: digest.text }])
  } catch (e) {
    return NextResponse.json(
      { error: `LINE 推送失敗：${e instanceof Error ? e.message : String(e)}`, text: digest.text },
      { status: 502 },
    )
  }
  return NextResponse.json({ success: true, sent: true, text: digest.text, offline: digest.offline })
}
