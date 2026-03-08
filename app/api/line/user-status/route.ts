import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

/**
 * GET /api/line/user-status?clientId=xxx
 * 查詢客戶的 LINE 連結狀態和最後活動時間
 * 用於教練後台顯示「用戶是否在線」
 */
export async function GET(request: NextRequest) {
  const { authorized } = await verifyCoachAuth(request)
  if (!authorized) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, line_user_id, last_line_activity')
    .eq('id', clientId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const isLinked = !!data.line_user_id
  const lastActivity = data.last_line_activity
  const isOnline = isLinked && lastActivity
    ? (Date.now() - new Date(lastActivity).getTime()) < 5 * 60 * 1000 // 5 分鐘內算在線
    : false

  return NextResponse.json({
    clientId: data.id,
    name: data.name,
    lineLinked: isLinked,
    lastLineActivity: lastActivity,
    isOnline,
  })
}
