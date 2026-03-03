/**
 * Push Send API — 發送推播通知給學員
 *
 * POST /api/push/send
 * Body: { clientId?: string, title: string, body: string, url?: string }
 *
 * - 指定 clientId → 發給該學員的所有裝置
 * - 不指定 clientId → 發給所有訂閱者（廣播）
 *
 * 需要 admin session 或 CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

// Web Push 需要 VAPID keys
// 用 `npx web-push generate-vapid-keys` 產生
function getVapidKeys() {
  return {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com',
  }
}

export async function POST(request: NextRequest) {
  // 驗證權限
  const token = request.cookies.get('admin_session')?.value
  const cronSecret = request.headers.get('authorization')
  const isAdmin = token && verifyAdminSession(token)
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const vapid = getVapidKeys()
  if (!vapid.publicKey || !vapid.privateKey) {
    return NextResponse.json({ error: '推播服務未設定（缺少 VAPID keys）' }, { status: 503 })
  }

  try {
    const { clientId, title, body, url } = await request.json()
    if (!title || !body) {
      return NextResponse.json({ error: '缺少 title 或 body' }, { status: 400 })
    }

    // 取得訂閱
    let query = supabase.from('push_subscriptions').select('*')
    if (clientId) query = query.eq('client_id', clientId)

    const { data: subscriptions, error } = await query
    if (error) {
      console.error('[push/send] DB error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: '沒有訂閱者' })
    }

    // 動態 import web-push（避免安裝時就報錯）
    let webpush: any
    try {
      webpush = await import('web-push')
    } catch {
      return NextResponse.json({ error: '推播套件未安裝，請執行 npm install web-push' }, { status: 503 })
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

    const payload = JSON.stringify({ title, body, url: url || '/', tag: 'coach-push' })
    let sent = 0
    const failed: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
        sent++
      } catch (err: any) {
        // 410 Gone = subscription expired → 刪除
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        failed.push(sub.endpoint.slice(-20))
      }
    }

    return NextResponse.json({ sent, failed: failed.length, total: subscriptions.length })
  } catch {
    return NextResponse.json({ error: '請求錯誤' }, { status: 400 })
  }
}
