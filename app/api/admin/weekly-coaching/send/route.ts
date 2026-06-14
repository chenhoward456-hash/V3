import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendRoutineReminder } from '@/lib/notify'

// POST /api/admin/weekly-coaching/send  { clientId, message, mode }
// 發送本週教練訊息給單一學員：Web Push 優先、沒推播才退 LINE（sendRoutineReminder）。
// 兩管道都接好 → 隨學員陸續開通推播，同一顆鈕自動走 web、不佔 LINE 額度。
export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  let body: { clientId?: string; message?: string; mode?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  const { clientId, message, mode } = body
  if (!clientId || !message || !message.trim()) {
    return NextResponse.json({ error: '缺少 clientId 或 message' }, { status: 400 })
  }

  const supabase = createServiceSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('name, line_user_id, unique_code')
    .eq('id', clientId)
    .maybeSingle<{ name: string; line_user_id: string | null; unique_code: string }>()
  if (!client) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  const title = mode === 'accountability' ? '👋 Howard 找你回來' : '💬 Howard 的本週調整'
  const firstLine = message.trim().split('\n').find(l => l.trim()) || '點開看本週調整'

  const result = await sendRoutineReminder(clientId, client.line_user_id ?? '', {
    title,
    body: firstLine.slice(0, 80),
    lineText: message,
    url: `/c/${client.unique_code}`, // 學員實際儀表板（/dashboard 不存在會 404）
  })

  return NextResponse.json({
    method: result.method,   // web_push / line_push / skipped
    success: result.success,
  })
}
