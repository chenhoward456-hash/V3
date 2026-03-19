import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import crypto from 'crypto'

const logger = createLogger('api-subscribe-return')

// 為 order_id 生成 HMAC 簽名，用於驗證 verify endpoint 的請求者身份
function signOrderId(orderId: string): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('Missing SESSION_SECRET or ADMIN_PASSWORD')
  return crypto.createHmac('sha256', secret).update(orderId).digest('hex').slice(0, 32)
}

// ECPay OrderResultURL — 付款完成後導回
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // 驗證 CheckMacValue 防止偽造回傳
    if (!verifyCheckMacValue(params)) {
      console.error('[subscribe/return] CheckMacValue 驗證失敗')
      return NextResponse.redirect(
        new URL('/join?error=invalid_signature', request.url),
        { status: 303 }
      )
    }

    const merchantTradeNo = params.MerchantTradeNo || ''

    // 使用固定的 SITE_URL，不依賴可偽造的 Host header
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

    // 檢查是否為升級：查詢此筆 purchase 的 email 是否已有其他 completed purchase（有 client_id）
    let isUpgrade = false
    try {
      const supabase = createServiceSupabase()
      const { data: currentPurchase } = await supabase
        .from('subscription_purchases')
        .select('email')
        .eq('merchant_trade_no', merchantTradeNo)
        .maybeSingle()

      if (currentPurchase?.email) {
        const { data: prevPurchases } = await supabase
          .from('subscription_purchases')
          .select('client_id')
          .eq('email', currentPurchase.email)
          .eq('status', 'completed')
          .not('client_id', 'is', null)
          .neq('merchant_trade_no', merchantTradeNo)
          .limit(1)

        if (prevPurchases && prevPurchases.length > 0) {
          isUpgrade = true
        }
      }
    } catch (error) {
      logger.error('POST /api/subscribe/return upgrade detection failed', error)
    }

    // 設定簽名 cookie，讓 verify endpoint 能驗證請求者是付款本人
    const signature = signOrderId(merchantTradeNo)
    const upgradeParam = isUpgrade ? '&upgrade=1' : ''
    const response = NextResponse.redirect(
      `${origin}/join/success?order_id=${encodeURIComponent(merchantTradeNo)}${upgradeParam}`,
      { status: 303 }
    )
    response.cookies.set('order_sig', signature, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 分鐘有效
      path: '/',
    })

    return response
  } catch (error) {
    logger.error('POST /api/subscribe/return unexpected error', error)
    return NextResponse.redirect(
      new URL('/join?error=1', request.url),
      { status: 303 }
    )
  }
}
