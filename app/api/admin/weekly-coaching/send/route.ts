import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendCoachMessage } from '@/lib/coaching-drafts'

// POST /api/admin/weekly-coaching/send  { clientId, message, mode }
// ⚠️ 合規掃描、先儲存再推播、回填送達管道，全在 lib/coaching-drafts.ts 的
//    sendCoachMessage —— 共用給 /admin 與 LINE，不要在這裡重寫。
export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  let body: { clientId?: string; message?: string; mode?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }

  const outcome = await sendCoachMessage(createServiceSupabase(), {
    clientId: body.clientId ?? '',
    message: body.message ?? '',
    mode: body.mode,
  })

  if (!outcome.ok) {
    return NextResponse.json(
      outcome.compliance ? { error: outcome.error, compliance: outcome.compliance } : { error: outcome.error },
      { status: outcome.status },
    )
  }
  return NextResponse.json({
    method: outcome.method,      // web_push / line_push / skipped
    success: outcome.delivered,  // 推播是否真的送出
    saved: true,                 // 訊息已存進儀表板（學員自己打開就看得到，不靠推播）
  })
}
