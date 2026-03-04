import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

// 驗證訂閱付款狀態（前端 polling 用）
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`subscribe_verify_${ip}`, 30, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁', 429)
  }

  const orderId = request.nextUrl.searchParams.get('order_id')
  if (!orderId) {
    return createErrorResponse('缺少 order_id', 400)
  }

  try {
    const { data: purchase, error } = await supabase
      .from('subscription_purchases')
      .select('status, client_id, subscription_tier, name')
      .eq('merchant_trade_no', orderId)
      .single()

    if (error || !purchase) {
      return NextResponse.json({ completed: false })
    }

    if (purchase.status === 'completed' && purchase.client_id) {
      // 取得 unique_code
      const { data: client } = await supabase
        .from('clients')
        .select('unique_code')
        .eq('id', purchase.client_id)
        .single()

      return NextResponse.json({
        completed: true,
        uniqueCode: client?.unique_code || null,
        tier: purchase.subscription_tier,
        name: purchase.name,
      })
    }

    if (purchase.status === 'failed') {
      return NextResponse.json({ completed: false, failed: true })
    }

    // still pending
    return NextResponse.json({ completed: false, status: 'pending' })
  } catch (err: any) {
    return createErrorResponse('驗證失敗', 500)
  }
}
