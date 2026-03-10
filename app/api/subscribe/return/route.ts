import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue } from '@/lib/ecpay'
import crypto from 'crypto'

// 為 order_id 生成 HMAC 簽名，用於驗證 verify endpoint 的請求者身份
function signOrderId(orderId: string): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'fallback'
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

    // 設定簽名 cookie，讓 verify endpoint 能驗證請求者是付款本人
    const signature = signOrderId(merchantTradeNo)
    const response = NextResponse.redirect(
      `${origin}/join/success?order_id=${encodeURIComponent(merchantTradeNo)}`,
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
  } catch {
    return NextResponse.redirect(
      new URL('/join?error=1', request.url),
      { status: 303 }
    )
  }
}
