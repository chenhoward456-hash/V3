import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? '30'), 1), 180)

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const clientRes = UUID_RE.test(clientId)
    ? await supabase.from('clients').select('id, name').eq('id', clientId).maybeSingle()
    : await supabase.from('clients').select('id, name').eq('unique_code', clientId).maybeSingle()

  if (!clientRes.data) {
    return NextResponse.json({ error: '找不到學員' }, { status: 404 })
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)
  const sinceStr = sinceDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('training_logs')
    .select('id, date, training_type, duration, rpe, sets, compound_weight, compound_reps, note, created_at')
    .eq('client_id', clientRes.data.id)
    .gte('date', sinceStr)
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '讀取訓練紀錄失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data ?? [] })
}
