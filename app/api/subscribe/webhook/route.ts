import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue, SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const supabase = createServiceSupabase()
const log = createLogger('subscribe/webhook')

// 生成 8 碼 unique_code（密碼學安全隨機）
function generateUniqueCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

// getDefaultFeatures 已移至 @/lib/tier-defaults

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    log.info('ECPay callback', {
      MerchantTradeNo: params.MerchantTradeNo,
      RtnCode: params.RtnCode,
      TradeNo: params.TradeNo,
    })

    if (!verifyCheckMacValue(params)) {
      log.error('CheckMacValue verification failed')
      return new NextResponse('0|ErrorMessage', { status: 200 })
    }

    const merchantTradeNo = params.MerchantTradeNo
    const rtnCode = parseInt(params.RtnCode, 10)

    if (rtnCode === 1) {
      // 付款成功 → 自動建立學員帳號
      const { data: purchase, error: fetchError } = await supabase
        .from('subscription_purchases')
        .select('*')
        .eq('merchant_trade_no', merchantTradeNo)
        .single()

      if (fetchError || !purchase) {
        log.error('Purchase not found', null, { merchantTradeNo })
        return new NextResponse('0|ErrorMessage', { status: 200 })
      }

      // 防止重複處理
      if (purchase.status === 'completed') {
        log.info('Already completed', { merchantTradeNo })
        return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      const tier = purchase.subscription_tier as SubscriptionTier
      const regData = purchase.registration_data || {}

      // 建立學員
      const uniqueCode = generateUniqueCode()
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + (SUBSCRIPTION_PLANS[tier]?.duration_months || 1))

      const clientData = {
        unique_code: uniqueCode,
        name: purchase.name,
        age: regData.age || null,
        gender: regData.gender || null,
        goal_type: regData.goalType || 'cut',
        subscription_tier: tier,
        expires_at: expiresAt.toISOString(),
        ...getDefaultFeatures(tier),
      }

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientData)
        .select('id')
        .single()

      if (clientError) {
        log.error('Client creation error', clientError)
        // 仍然標記付款成功，後台手動補建
        await supabase.from('subscription_purchases').update({
          status: 'completed',
          ecpay_trade_no: params.TradeNo || null,
          completed_at: new Date().toISOString(),
        }).eq('merchant_trade_no', merchantTradeNo)

        return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // 更新購買紀錄
      await supabase.from('subscription_purchases').update({
        status: 'completed',
        ecpay_trade_no: params.TradeNo || null,
        client_id: newClient.id,
        completed_at: new Date().toISOString(),
      }).eq('merchant_trade_no', merchantTradeNo)

      log.info('Client created', { uniqueCode, tier, email: purchase.email })

      // 非同步寄送歡迎信
      if (purchase.email) {
        sendWelcomeEmail({
          to: purchase.email,
          name: purchase.name,
          uniqueCode,
          tier,
        }).catch((err) => {
          log.error('Welcome email error (non-blocking)', err)
        })
      }
    } else {
      // 付款失敗
      log.info('Payment failed', { merchantTradeNo, RtnMsg: params.RtnMsg })
      await supabase.from('subscription_purchases').update({
        status: 'failed',
      }).eq('merchant_trade_no', merchantTradeNo)
    }

    return new NextResponse('1|OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: any) {
    log.error('Webhook error', err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
