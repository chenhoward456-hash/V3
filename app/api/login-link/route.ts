import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { sendLoginLinkEmail } from '@/lib/email'
import { createLogger } from '@/lib/logger'

const logger = createLogger('login-link')

// POST /api/login-link  { email }
// 用 Email 把「回到儀表板的連結」寄給學員——忘記網址/換裝置就靠這個回來（解決「關掉分頁就回不來」的結構性流失）。
// 防列舉：無論 email 存不存在，一律回 { ok: true }，不洩漏哪些 email 是會員。
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`login-link:${ip}`, 5, 60_000) // 每分鐘 5 次，擋濫發
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })

  let body: { email?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  const email = (body.email || '').trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })
  }

  const supabase = createServiceSupabase()
  // email → 最近一筆購買紀錄 → client_id（subscription_purchases 存了 email+client_id）
  const { data: purchase } = await supabase
    .from('subscription_purchases')
    .select('client_id')
    .ilike('email', email)
    .not('client_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ client_id: string }>()

  if (purchase?.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('unique_code, name, is_active')
      .eq('id', purchase.client_id)
      .maybeSingle<{ unique_code: string; name: string; is_active: boolean | null }>()
    if (client && client.is_active !== false) {
      const res = await sendLoginLinkEmail({ to: email, name: client.name || '你', uniqueCode: client.unique_code })
      if (!res.success) logger.error('login link email failed', { email, error: res.error })
    } else {
      logger.info('login-link: email matched but client inactive/missing', {})
    }
  } else {
    logger.info('login-link: no client for email (silent)', {})
  }

  // 一律回成功（防列舉）
  return NextResponse.json({ ok: true })
}
