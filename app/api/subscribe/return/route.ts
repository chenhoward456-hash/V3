import { NextRequest, NextResponse } from 'next/server'

// ECPay OrderResultURL — 付款完成後導回
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const merchantTradeNo = formData.get('MerchantTradeNo')?.toString() || ''

    const origin = request.headers.get('origin')
      || request.nextUrl.origin
      || 'https://howard456.vercel.app'

    return NextResponse.redirect(
      `${origin}/join/success?order_id=${merchantTradeNo}`,
      { status: 303 }
    )
  } catch {
    return NextResponse.redirect(
      new URL('/join?error=1', request.url),
      { status: 303 }
    )
  }
}
