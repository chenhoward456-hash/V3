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
  const { allowed } = await rateLimit(`subscribe_checkout_${ip}`, 5, 60_000)
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
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
    const merchantTradeNo = generateMerchantTradeNo()

    // ECPay 定期定額付款參數（信用卡）
    const params: Record<string, string | number> = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(),
      PaymentType: 'aio',
      TotalAmount: plan.amount,
      TradeDesc: `Howard Protocol ${plan.name}`,
      ItemName: `${plan.name} - 月訂閱`,
      ReturnURL: `${origin}/api/subscribe/webhook`,
      OrderResultURL: `${origin}/api/subscribe/return`,
      ClientBackURL: `${origin}/join?cancelled=1`,
      ChoosePayment: 'Credit',          // 定期定額僅限信用卡
      EncryptType: 1,
      NeedExtraPaidInfo: 'Y',
      // 定期定額參數
      PeriodAmount: plan.amount,         // 每次扣款金額（與 TotalAmount 相同）
      PeriodType: plan.periodType,       // M = 月
      Frequency: plan.frequency,         // 每 1 個月
      ExecTimes: plan.execTimes,         // 最多 99 次
      PeriodReturnURL: `${origin}/api/subscribe/period-webhook`,
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
  } catch (err: unknown) {
    return createErrorResponse('建立結帳失敗，請稍後再試', 500)
  }
}
