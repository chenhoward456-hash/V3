import { NextRequest, NextResponse } from 'next/server'

// ECPay OrderResultURL handler
// ECPay 付款完成後用 POST 把用戶導回這裡
// 我們提取 MerchantTradeNo 後 redirect 到 success page (GET)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const merchantTradeNo = formData.get('MerchantTradeNo')?.toString() || ''

    const origin = request.headers.get('origin')
      || request.nextUrl.origin
      || 'https://howard456.vercel.app'

    // 301 redirect 到 success page
    return NextResponse.redirect(
      `${origin}/diagnosis/success?order_id=${merchantTradeNo}`,
      { status: 303 } // 303 See Other: POST → GET redirect
    )
  } catch {
    // fallback: 導回 diagnosis
    return NextResponse.redirect(
      new URL('/diagnosis?step=3', request.url),
      { status: 303 }
    )
  }
}
