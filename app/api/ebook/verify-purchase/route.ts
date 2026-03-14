import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ebook_verify_${ip}`, 30, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁', 429)
  }

  const orderId = request.nextUrl.searchParams.get('order_id')
  if (!orderId) {
    return createErrorResponse('缺少 order_id', 400)
  }

  try {
    // 查 DB by merchant_trade_no
    const { data: purchase } = await supabase
      .from('ebook_purchases')
      .select('status, download_token, email')
      .eq('merchant_trade_no', orderId)
      .maybeSingle()

    if (!purchase) {
      return NextResponse.json({ purchased: false })
    }

    if (purchase.status === 'completed' && purchase.download_token) {
      // 遮罩 email，避免洩漏完整信箱
      const maskedEmail = purchase.email
        ? purchase.email.replace(/^(.{1,2})(.*)(@.*)$/, (_m: string, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 5)) + c)
        : null
      return NextResponse.json({
        purchased: true,
        downloadToken: purchase.download_token,
        email: maskedEmail,
      })
    }

    // status 還是 pending → ECPay webhook 可能還沒到
    // ECPay 不像 Stripe 有 API 可以直接查，只能等 webhook
    // 前端會持續輪詢
    return NextResponse.json({ purchased: false, status: purchase.status })
  } catch (err: unknown) {
    return createErrorResponse('驗證失敗', 500)
  }
}
