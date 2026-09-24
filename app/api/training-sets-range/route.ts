import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { denyInactiveClient } from '@/lib/active-client'

const supabase = createServiceSupabase()

/**
 * GET /api/training-sets-range?clientId=<unique_code>&days=90
 *
 * 為客戶端 overview 頁面提供範圍 training_sets 資料（E1RM / 訓練量 / 肌群分佈）。
 * 認證模型同 /c/[clientId]：知道 unique_code = 該客戶本人。
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`training-sets-range:${ip}`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const days = Math.min(parseInt(searchParams.get('days') || '90'), 180)

  if (!clientId || !/^[a-zA-Z0-9_-]{1,20}$/.test(clientId)) {
    return NextResponse.json({ error: '缺少或無效的 clientId' }, { status: 400 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, is_active, expires_at')
    .eq('unique_code', clientId)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
  }
  // 稽核 S-13：停用／過期帳號的碼不可再讀
  const denied = await denyInactiveClient(client, request)
  if (denied) return denied

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: sets, error } = await supabase
    .from('training_sets')
    .select('id, date, exercise_name, muscle_group, set_number, weight, reps, rpe, is_main_lift')
    .eq('client_id', client.id)
    .gte('date', sinceStr)
    .order('date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: sets || [] })
}
