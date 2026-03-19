import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { validateBody } from '@/lib/schemas/validate'
import { pushSubscribeSchema } from '@/lib/schemas/api'

const logger = createLogger('api-push-subscribe')

/**
 * POST /api/push/subscribe
 * 儲存用戶的推播訂閱資訊
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = validateBody(pushSubscribeSchema, await request.json())
    if (!parsed.success) return parsed.response
    const { subscription, clientId } = parsed.data

    const supabase = createServiceSupabase()

    // 驗證 clientId 對應的學員存在
    const { data: clientExists } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .maybeSingle()

    if (!clientExists) {
      return NextResponse.json({ error: '找不到對應的學員' }, { status: 404 })
    }

    // upsert：同一個 endpoint 只保留一筆
    // onConflict: 'endpoint' 確保同一瀏覽器不會重複註冊
    // 同時綁定 client_id，防止 A 的 endpoint 被改綁到 B
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          client_id: clientExists.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      return NextResponse.json({ error: '訂閱儲存失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/push/subscribe unexpected error', error)
    return NextResponse.json({ error: '訂閱失敗' }, { status: 500 })
  }
}

/**
 * DELETE /api/push/subscribe
 * 取消推播訂閱（需提供 clientId 驗證所有權）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint, clientId } = await request.json()

    if (!endpoint) {
      return NextResponse.json({ error: '缺少 endpoint' }, { status: 400 })
    }
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    // 驗證 clientId 存在
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .maybeSingle()

    if (!client) {
      return NextResponse.json({ error: '驗證失敗' }, { status: 403 })
    }

    // 只刪除屬於該 client 的 endpoint（防止刪除別人的訂閱）
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('client_id', client.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/push/subscribe unexpected error', error)
    return NextResponse.json({ error: '取消訂閱失敗' }, { status: 500 })
  }
}
