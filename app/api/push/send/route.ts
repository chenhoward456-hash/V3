import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { sendPushNotification } from '@/lib/web-push'

/**
 * POST /api/push/send
 * 發送推播通知（僅限 Admin）
 *
 * Body:
 * - clientId?: 指定學員（不傳則發送給所有訂閱者）
 * - title: 通知標題
 * - body: 通知內容
 * - url?: 點擊後導向的網址
 */
export async function POST(request: NextRequest) {
  // 驗證 Admin
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const { clientId, title, body, url } = await request.json()

    if (!title || !body) {
      return NextResponse.json({ error: '缺少 title 或 body' }, { status: 400 })
    }

    // 查詢訂閱者
    const supabase = createServiceSupabase()
    let query = supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data: subscriptions, error } = await query

    if (error || !subscriptions) {
      return NextResponse.json({ error: '查詢訂閱者失敗' }, { status: 500 })
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: '沒有訂閱者' })
    }

    // 發送通知
    const payload = { title, body, url }
    let sent = 0
    const expired: string[] = []

    await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        if (success) {
          sent++
        } else {
          expired.push(sub.endpoint)
        }
      })
    )

    // 清理過期的訂閱
    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired)
    }

    return NextResponse.json({
      sent,
      expired: expired.length,
      total: subscriptions.length,
    })
  } catch (err) {
    console.error('Push send error:', err)
    return NextResponse.json({ error: '發送失敗' }, { status: 500 })
  }
}
