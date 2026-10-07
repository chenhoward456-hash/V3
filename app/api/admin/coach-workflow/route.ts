import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { getLocalDateStr } from '@/lib/date-utils'
import { loadCoachDigest } from '@/lib/coach-digest'

export const dynamic = 'force-dynamic'

/** Read-only view of the same work queue used by the morning digest. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  const clientId = request.nextUrl.searchParams.get('clientId')
  if (clientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return NextResponse.json({ error: '學員編號格式錯誤' }, { status: 400 })
  }
  try {
    const supabase = createServiceSupabase()
    const today = getLocalDateStr(new Date())
    const digest = await loadCoachDigest(supabase, {
      today, adminUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app',
    })
    const items = clientId ? digest.workflow.filter(item => item.clientId === clientId) : digest.workflow
    if (!clientId) return NextResponse.json({ today, items }, { headers: { 'Cache-Control': 'no-store' } })

    const [messages, adjustments] = await Promise.all([
      supabase.from('coach_messages').select('id,title,body,created_at,read_at,sent_via')
        .eq('client_id', clientId).order('created_at', { ascending: false }).limit(3),
      supabase.from('macro_adjustment_log').select('id,applied_at,reason,applied_by,old_macros,new_macros')
        .eq('client_id', clientId).order('applied_at', { ascending: false }).limit(3),
    ])
    return NextResponse.json({
      today, items,
      history: {
        messages: messages.data ?? [], adjustments: adjustments.data ?? [],
        unavailable: !!messages.error || !!adjustments.error,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '處理清單載入失敗，請重試' }, { status: 500 })
  }
}
