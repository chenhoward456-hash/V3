import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'

// POST /api/coach-message-read  { code, messageId }
// 學員關閉教練訊息卡片時呼叫：把 coach_messages.read_at 設為現在。
// 這樣換裝置/清快取也不會再跳出來（localStorage 只負責即時隱藏），教練端也知道已讀。
// 鑑權：messageId 必須屬於 code 對應的學員，避免拿別人 id 亂標。
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`coach-msg-read:${ip}`, 60, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁' }, { status: 429 })

  let body: { code?: string; messageId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  const { code, messageId } = body
  if (!code || !/^[a-zA-Z0-9_-]{8,20}$/.test(code)) {
    return NextResponse.json({ error: '無效的 code' }, { status: 400 })
  }
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: '無效的 messageId' }, { status: 400 })
  }

  const supabase = createServiceSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('unique_code', code)
    .maybeSingle<{ id: string }>()
  if (!client) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  // 只更新「屬於這個學員」且尚未讀的那筆 → 別人的 id 改不到
  const { error } = await supabase
    .from('coach_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('client_id', client.id)
    .is('read_at', null)
  if (error) {
    console.error('[coach-message-read] update 失敗', error)
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
