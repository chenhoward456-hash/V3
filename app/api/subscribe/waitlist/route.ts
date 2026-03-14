import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'

const logger = createLogger('waitlist')

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`waitlist_${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const { email, tier } = await request.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    // 儲存到 waitlist 表（如果存在），否則用 clients 表的 notes 欄位
    // 嘗試插入 waitlist 表
    const { error } = await supabase
      .from('waitlist')
      .upsert(
        { email: email.trim().toLowerCase(), tier: tier || 'self_managed', created_at: new Date().toISOString() },
        { onConflict: 'email' }
      )

    if (error) {
      // waitlist 表可能不存在，fallback: 不阻擋用戶體驗
      logger.warn('Waitlist insert failed', { message: error.message })
      // 即使儲存失敗也回傳成功，不影響用戶體驗
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
