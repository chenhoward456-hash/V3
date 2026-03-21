import { NextRequest, NextResponse } from 'next/server'
import {
  ECPAY_CONFIG,
  EBOOK_PRODUCTS,
  generateMerchantTradeNo,
  formatTradeDate,
  buildCheckoutFormHTML,
} from '@/lib/ecpay'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  // Rate limit: 5 次 / 分鐘 / IP
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`ebook_checkout_${ip}`, 5, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const { email, quizData } = await request.json()

    // 驗證 email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return createErrorResponse('請輸入有效的 Email', 400)
    }

    const product = EBOOK_PRODUCTS['system-reboot-v1']
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
    const merchantTradeNo = generateMerchantTradeNo()

    // ECPay 付款參數
    const params: Record<string, string | number> = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(),
      PaymentType: 'aio',
      TotalAmount: product.amount,
      TradeDesc: 'Howard Protocol Ebook',
      ItemName: 'System Reboot 睡眠與神經系統優化實戰手冊',
      ReturnURL: `${origin}/api/ebook/webhook`,
      OrderResultURL: `${origin}/api/ebook/return`,
      ClientBackURL: `${origin}/diagnosis?step=3&cancelled=1`,
      ChoosePayment: 'ALL',
      EncryptType: 1,
      NeedExtraPaidInfo: 'Y',
      CustomField1: email,
      CustomField2: 'system-reboot-v1',
    }

    // 生成含 CheckMacValue 的完整 HTML 表單
    const htmlForm = buildCheckoutFormHTML(params)

    // 寫入 DB（pending 狀態）
    await supabase.from('ebook_purchases').insert({
      email,
      merchant_trade_no: merchantTradeNo,
      product_key: 'system-reboot-v1',
      amount: product.amount,
      currency: product.currency,
      status: 'pending',
      quiz_data: quizData || null,
    })

    return NextResponse.json({ htmlForm })
  } catch (err: unknown) {
    return createErrorResponse('建立結帳失敗，請稍後再試', 500)
  }
}
