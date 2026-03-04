import { NextRequest, NextResponse } from 'next/server'
import {
  ECPAY_CONFIG,
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
  generateMerchantTradeNo,
  formatTradeDate,
  buildCheckoutFormHTML,
} from '@/lib/ecpay'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`subscribe_checkout_${ip}`, 5, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const { name, email, phone, tier, registrationData } = await request.json()

    // 驗證必填欄位
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return createErrorResponse('請輸入姓名', 400)
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return createErrorResponse('請輸入有效的 Email', 400)
    }
    if (!tier || !SUBSCRIPTION_PLANS[tier as SubscriptionTier]) {
      return createErrorResponse('請選擇有效的方案', 400)
    }

    const plan = SUBSCRIPTION_PLANS[tier as SubscriptionTier]
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
    const merchantTradeNo = generateMerchantTradeNo()

    // ECPay 付款參數
    const params: Record<string, string | number> = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(),
      PaymentType: 'aio',
      TotalAmount: plan.amount,
      TradeDesc: `Howard Protocol ${plan.name}`,
      ItemName: `${plan.name} - 首月`,
      ReturnURL: `${origin}/api/subscribe/webhook`,
      OrderResultURL: `${origin}/api/subscribe/return`,
      ClientBackURL: `${origin}/join?cancelled=1`,
      ChoosePayment: 'ALL',
      EncryptType: 1,
      NeedExtraPaidInfo: 'Y',
      CustomField1: email,
      CustomField2: tier,
      CustomField3: name,
    }

    const htmlForm = buildCheckoutFormHTML(params)

    // 寫入 DB（pending 狀態）
    const { error: dbError } = await supabase.from('subscription_purchases').insert({
      email: email.trim(),
      name: name.trim(),
      phone: phone?.trim() || null,
      merchant_trade_no: merchantTradeNo,
      subscription_tier: tier,
      amount: plan.amount,
      status: 'pending',
      registration_data: registrationData || {},
    })

    if (dbError) {
      return createErrorResponse('建立訂單失敗，請稍後再試', 500)
    }

    return NextResponse.json({ htmlForm })
  } catch (err: any) {
    return createErrorResponse('建立結帳失敗，請稍後再試', 500)
  }
}
