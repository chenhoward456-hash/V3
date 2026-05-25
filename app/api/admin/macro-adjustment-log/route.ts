import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const body = await request.json()
  const { clientId, applied_by, trigger_source, old_macros, new_macros, reason } = body

  if (!clientId || !applied_by || !trigger_source || !new_macros) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const { error } = await supabase.from('macro_adjustment_log').insert({
    client_id: clientId,
    applied_by,
    trigger_source,
    old_macros: old_macros ?? {},
    new_macros,
    reason: reason ?? null,
  })

  if (error) {
    return NextResponse.json({ error: '寫入失敗', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('macro_adjustment_log')
    .select('*')
    .eq('client_id', clientId)
    .order('applied_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}
