import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

// GET /api/coach-message?code=<unique_code>
// 輕量端點：只回「最近一則未讀教練訊息」。給 CoachMessageBanner 在儀表板還在載入(skeleton)時
// 就先把訊息秀出來——點推播進來不用等整包 /api/clients(~1.2s+) 跑完才看到內容。
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`coach-msg-get:${ip}`, 60, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁' }, { status: 429 })

  const code = new URL(request.url).searchParams.get('code')
  if (!code || !/^[a-zA-Z0-9_-]{8,20}$/.test(code)) {
    return NextResponse.json({ message: null })
  }

  const supabase = createServiceSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('unique_code', code)
    .maybeSingle<{ id: string }>()
  if (!client) return NextResponse.json({ message: null })

  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: msg } = await supabase
    .from('coach_messages')
    .select('id, title, body, mode, created_at')
    .eq('client_id', client.id)
    .is('read_at', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ message: msg ?? null })
}
