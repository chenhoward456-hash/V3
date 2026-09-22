import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { buildCoachingDrafts } from '@/lib/coaching-drafts'
import { getTaiwanDate } from '@/lib/date-utils'

// GET /api/admin/weekly-coaching?clientId=...
// 本週教練佇列：每位啟用學員一份草稿。
// ⚠️ 產草稿的邏輯在 lib/coaching-drafts.ts —— 共用給 /admin 與 LINE 指令，
//    不要在這裡另寫一份（教練實際上是在 LINE 處理這些的）。
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const onlyClientId = new URL(request.url).searchParams.get('clientId')

  try {
    const drafts = await buildCoachingDrafts(supabase, { onlyClientId })
    return NextResponse.json({ drafts, generatedAt: getTaiwanDate() })
  } catch (e) {
    console.error('[weekly-coaching] 產草稿失敗', e)
    return NextResponse.json({ error: '查詢學員失敗' }, { status: 500 })
  }
}
