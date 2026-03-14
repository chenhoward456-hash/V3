import { NextRequest, NextResponse } from 'next/server'
import { ECPAY_CONFIG, generateCheckMacValue } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/email'
import { createLogger } from '@/lib/logger'

const supabase = createServiceSupabase()
const log = createLogger('subscribe/cancel')

export async function POST(request: NextRequest) {
  try {
    const { clientId, uniqueCode } = await request.json()

    if (!clientId || !uniqueCode) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 驗證 uniqueCode 對應 clientId（防止未授權取消）
    const { data: verifyClient } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('unique_code', uniqueCode)
      .single()

    if (!verifyClient) {
      log.warn('Cancel auth failed', { clientId })
      return NextResponse.json({ error: '驗證失敗' }, { status: 403 })
    }

    // 查找該用戶最近一筆已完成的訂閱購買（定期定額的原始訂單）
    const { data: purchase, error: fetchError } = await supabase
      .from('subscription_purchases')
      .select('merchant_trade_no, subscription_tier, email, name')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !purchase) {
      log.error('No active subscription found', null, { clientId })
      return NextResponse.json({ error: '找不到有效的訂閱紀錄' }, { status: 404 })
    }

    // 呼叫 ECPay CreditCardPeriodAction API 停止定期定額
    const actionParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: purchase.merchant_trade_no,
      Action: 'Cancel',
    }

    const checkMacValue = generateCheckMacValue(actionParams)
    actionParams.CheckMacValue = checkMacValue

    const formBody = Object.entries(actionParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')

    const ecpayResponse = await fetch(ECPAY_CONFIG.PeriodActionURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })

    const responseText = await ecpayResponse.text()
    log.info('ECPay CreditCardPeriodAction response', {
      merchantTradeNo: purchase.merchant_trade_no,
      response: responseText,
    })

    // 解析回傳（格式：RtnCode=1&RtnMsg=成功 或類似 query string）
    const responseParams = new URLSearchParams(responseText)
    const rtnCode = responseParams.get('RtnCode')

    if (rtnCode !== '1') {
      const rtnMsg = responseParams.get('RtnMsg') || responseText
      log.error('ECPay cancel failed', null, { rtnCode, rtnMsg, merchantTradeNo: purchase.merchant_trade_no })
      return NextResponse.json({ error: '取消失敗，請稍後再試或聯繫客服' }, { status: 400 })
    }

    // 更新購買紀錄狀態
    await supabase.from('subscription_purchases').update({
      status: 'cancelled',
    }).eq('merchant_trade_no', purchase.merchant_trade_no)

    // 注意：不立即停用帳號，讓用戶用到當期到期日
    log.info('Subscription cancelled', {
      clientId,
      merchantTradeNo: purchase.merchant_trade_no,
      email: purchase.email,
    })

    // 查詢到期日並寄送取消確認信
    if (purchase.email) {
      const { data: client } = await supabase
        .from('clients')
        .select('expires_at')
        .eq('id', clientId)
        .single()

      sendCancellationEmail({
        to: purchase.email,
        name: purchase.name,
        tier: purchase.subscription_tier,
        expiresAt: client?.expires_at || new Date().toISOString(),
      }).catch((err) => {
        log.error('Cancellation email error (non-blocking)', err)
      })
    }

    return NextResponse.json({ success: true, message: '已取消定期定額，你的帳號將持續使用至到期日。' })
  } catch (err: unknown) {
    log.error('Cancel subscription error', err)
    return NextResponse.json({ error: '取消訂閱時發生錯誤' }, { status: 500 })
  }
}
