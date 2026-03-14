import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import crypto from 'crypto'

const supabase = createServiceSupabase()

// 驗證 order_id 簽名（與 return handler 的 signOrderId 一致）
function verifyOrderSignature(orderId: string, signature: string): boolean {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('Missing SESSION_SECRET or ADMIN_PASSWORD')
  const expected = crypto.createHmac('sha256', secret).update(orderId).digest('hex').slice(0, 32)
  if (expected.length !== signature.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

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

  // 驗證簽名 cookie（只有從 ECPay return 導回的用戶才有）
  const orderSig = request.cookies.get('order_sig')?.value
  const isVerifiedOwner = orderSig ? verifyOrderSignature(orderId, orderSig) : false

  try {
    const { data: purchase, error } = await supabase
      .from('subscription_purchases')
      .select('status, client_id, subscription_tier, name')
      .eq('merchant_trade_no', orderId)
      .maybeSingle()

    if (error || !purchase) {
      return NextResponse.json({ completed: false })
    }

    if (purchase.status === 'completed' && purchase.client_id) {
      if (!isVerifiedOwner) {
        // 沒有有效簽名 → 只回傳完成狀態，不回傳 uniqueCode
        return NextResponse.json({
          completed: true,
          tier: purchase.subscription_tier,
          name: purchase.name,
        })
      }

      // 有有效簽名 → 回傳 uniqueCode 讓前端跳轉
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
  } catch {
    return createErrorResponse('驗證失敗', 500)
  }
}
