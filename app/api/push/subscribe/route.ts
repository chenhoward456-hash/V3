/**
 * Push Subscription API — 儲存學員推播訂閱
 *
 * POST /api/push/subscribe
 * Body: { clientId: string, subscription: PushSubscription }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`push-subscribe:${ip}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁' }, { status: 429 })
  }

  try {
    const { clientId, subscription } = await request.json()
    if (!clientId || !subscription?.endpoint) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // upsert: 同一個 endpoint 只存一筆
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          client_id: clientId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('[push/subscribe] DB error:', error)
      return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '請求錯誤' }, { status: 400 })
  }
}
