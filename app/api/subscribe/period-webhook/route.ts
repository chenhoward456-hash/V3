import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue, SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { createLogger } from '@/lib/logger'

const supabase = createServiceSupabase()
const log = createLogger('subscribe/period-webhook')

// ECPay PeriodReturnURL — 每月定期定額扣款結果回調
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    log.info('ECPay period callback', {
      MerchantTradeNo: params.MerchantTradeNo,
      RtnCode: params.RtnCode,
      TotalSuccessTimes: params.TotalSuccessTimes,
      PeriodAmount: params.PeriodAmount,
    })

    if (!verifyCheckMacValue(params)) {
      log.error('Period CheckMacValue verification failed')
      return new NextResponse('0|ErrorMessage', { status: 200 })
    }

    const merchantTradeNo = params.MerchantTradeNo
    const rtnCode = parseInt(params.RtnCode, 10)
    const totalSuccessTimes = parseInt(params.TotalSuccessTimes || '0', 10)

    // 第一次扣款由 webhook/route.ts 處理，這裡只處理第 2 次以後的續訂
    if (totalSuccessTimes <= 1) {
      log.info('First payment handled by main webhook, skipping', { merchantTradeNo })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    if (rtnCode !== 1) {
      log.info('Period payment failed', { merchantTradeNo, RtnMsg: params.RtnMsg, totalSuccessTimes })
      // 扣款失敗不需要做什麼，綠界會自動重試，連續 6 次失敗才會停止
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 扣款成功 → 延長到期日
    const { data: purchase } = await supabase
      .from('subscription_purchases')
      .select('client_id, subscription_tier, email, name')
      .eq('merchant_trade_no', merchantTradeNo)
      .eq('status', 'completed')
      .maybeSingle()

    if (!purchase?.client_id) {
      log.error('Purchase or client not found for period renewal', { merchantTradeNo })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    const tier = purchase.subscription_tier as SubscriptionTier
    const durationMonths = SUBSCRIPTION_PLANS[tier]?.duration_months || 1

    // 取得現有帳號
    const { data: client } = await supabase
      .from('clients')
      .select('id, expires_at, line_user_id, name')
      .eq('id', purchase.client_id)
      .single()

    if (!client) {
      log.error('Client not found for period renewal', { clientId: purchase.client_id })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 延長到期日：從現在或原到期日（取較晚者）再加一個月
    const now = new Date()
    const currentExpiry = client.expires_at ? new Date(client.expires_at) : now
    const baseDate = currentExpiry > now ? currentExpiry : now
    const newExpiry = new Date(baseDate)
    newExpiry.setMonth(newExpiry.getMonth() + durationMonths)

    await supabase.from('clients').update({
      expires_at: newExpiry.toISOString(),
      ...getDefaultFeatures(tier),
    }).eq('id', client.id)

    log.info('Subscription renewed via period payment', {
      clientId: client.id,
      tier,
      totalSuccessTimes,
      newExpiry: newExpiry.toISOString(),
      email: purchase.email,
    })

    // LINE 推播通知續訂成功
    if (client.line_user_id) {
      const expiryStr = newExpiry.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
      pushMessage(client.line_user_id, [{
        type: 'text',
        text: `${client.name || purchase.name}，本月訂閱已自動續訂成功！\n\n方案有效期延長至 ${expiryStr}。\n繼續加油 💪`,
      }]).catch((err) => {
        log.error('Period renewal LINE push error (non-blocking)', err)
      })
    }

    return new NextResponse('1|OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: any) {
    log.error('Period webhook error', err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
