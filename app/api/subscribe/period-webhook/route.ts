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
      .select('client_id, subscription_tier, email, name, registration_data')
      .eq('merchant_trade_no', merchantTradeNo)
      .eq('status', 'completed')
      .maybeSingle()

    if (!purchase?.client_id) {
      log.error('Purchase or client not found for period renewal', { merchantTradeNo })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 稽核 S-11：續訂冪等。ECPay 對同一則通知可能重送，原本同一個 TotalSuccessTimes 送兩次
    // 到期日就延長兩個月。把「已處理到第幾期」記在 registration_data.period_success_times
    // （現有 jsonb 欄位，不需要 migration），處理過的期數直接跳過。
    const regData = (purchase.registration_data as Record<string, unknown> | null) ?? {}
    const prevTimesRaw = regData.period_success_times
    const prevTimes = typeof prevTimesRaw === 'number' ? prevTimesRaw : null
    if (prevTimes != null && prevTimes >= totalSuccessTimes) {
      log.info('Period renewal already applied, skipping duplicate', { merchantTradeNo, totalSuccessTimes, prevTimes })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 先搶「這一期」：條件式更新（只在期數還是剛剛讀到的舊值時才寫），兩則重送同時到也只有一則搶得到。
    let claimQuery = supabase
      .from('subscription_purchases')
      .update({ registration_data: { ...regData, period_success_times: totalSuccessTimes } })
      .eq('merchant_trade_no', merchantTradeNo)
      .eq('status', 'completed')
    claimQuery = prevTimes == null
      ? claimQuery.is('registration_data->period_success_times', null)
      : claimQuery.eq('registration_data->period_success_times', prevTimes)
    const { data: claimed, error: claimError } = await claimQuery.select('id').maybeSingle()
    if (claimError) {
      log.error('Period renewal claim failed', { merchantTradeNo, totalSuccessTimes, error: claimError })
      return new NextResponse('0|ErrorMessage', { status: 200 })
    }
    if (!claimed) {
      log.info('Period renewal claimed by a concurrent callback, skipping', { merchantTradeNo, totalSuccessTimes })
      return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    // 延長失敗時把期數還回去，回 0 讓 ECPay 重送（否則這期會被當成已處理、錢收了沒延長）
    const releaseClaim = async () => {
      await supabase
        .from('subscription_purchases')
        .update({ registration_data: regData })
        .eq('merchant_trade_no', merchantTradeNo)
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

    const { error: extendError } = await supabase.from('clients').update({
      expires_at: newExpiry.toISOString(),
      ...getDefaultFeatures(tier),
    }).eq('id', client.id)
    if (extendError) {
      log.error('Period renewal expiry update failed', { clientId: client.id, error: extendError })
      await releaseClaim()
      return new NextResponse('0|ErrorMessage', { status: 200 })
    }

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
  } catch (err: unknown) {
    log.error('Period webhook error', err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
