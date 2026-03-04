import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue, SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import crypto from 'crypto'

const supabase = createServiceSupabase()

// 生成 8 碼 unique_code（與 admin 建立學員一致）
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// getDefaultFeatures 已移至 @/lib/tier-defaults

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    console.log('[subscribe/webhook] ECPay callback:', {
      MerchantTradeNo: params.MerchantTradeNo,
      RtnCode: params.RtnCode,
      RtnMsg: params.RtnMsg,
      TradeNo: params.TradeNo,
      TradeAmt: params.TradeAmt,
    })

    if (!verifyCheckMacValue(params)) {
      console.error('[subscribe/webhook] CheckMacValue verification failed')
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
        console.error('[subscribe/webhook] Purchase not found:', merchantTradeNo)
        return new NextResponse('0|ErrorMessage', { status: 200 })
      }

      // 防止重複處理
      if (purchase.status === 'completed') {
        console.log('[subscribe/webhook] Already completed:', merchantTradeNo)
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
        console.error('[subscribe/webhook] Client creation error:', clientError)
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

      console.log(`[subscribe/webhook] Client created: ${uniqueCode} (${tier}) for ${purchase.email}`)

      // 非同步寄送歡迎信
      if (purchase.email) {
        sendWelcomeEmail({
          to: purchase.email,
          name: purchase.name,
          uniqueCode,
          tier,
        }).catch((err) => {
          console.error('[subscribe/webhook] Welcome email error (non-blocking):', err)
        })
      }
    } else {
      // 付款失敗
      console.log(`[subscribe/webhook] Payment failed: ${merchantTradeNo}, RtnMsg: ${params.RtnMsg}`)
      await supabase.from('subscription_purchases').update({
        status: 'failed',
      }).eq('merchant_trade_no', merchantTradeNo)
    }

    return new NextResponse('1|OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: any) {
    console.error('[subscribe/webhook] Error:', err?.message || err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
