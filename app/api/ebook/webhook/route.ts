import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ECPay ReturnURL — 付款結果通知
// ECPay 以 POST application/x-www-form-urlencoded 回傳付款結果
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // 轉換為 Record<string, string>
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    console.log('[webhook] ECPay callback received:', {
      MerchantTradeNo: params.MerchantTradeNo,
      RtnCode: params.RtnCode,
      RtnMsg: params.RtnMsg,
      TradeNo: params.TradeNo,
      TradeAmt: params.TradeAmt,
      SimulatePaid: params.SimulatePaid,
    })

    // 驗證 CheckMacValue
    if (!verifyCheckMacValue(params)) {
      console.error('[webhook] CheckMacValue verification failed')
      return new NextResponse('0|ErrorMessage', { status: 200 })
    }

    const merchantTradeNo = params.MerchantTradeNo
    const rtnCode = parseInt(params.RtnCode, 10)

    if (rtnCode === 1) {
      // 付款成功
      const downloadToken = crypto.randomUUID()

      const { error } = await supabase
        .from('ebook_purchases')
        .update({
          status: 'completed',
          ecpay_trade_no: params.TradeNo || null,
          download_token: downloadToken,
          completed_at: new Date().toISOString(),
        })
        .eq('merchant_trade_no', merchantTradeNo)

      if (error) {
        console.error('[webhook] DB update error:', error)
      } else {
        console.log(`[webhook] Purchase completed: ${merchantTradeNo} → token: ${downloadToken}`)
      }
    } else {
      // 付款失敗
      console.log(`[webhook] Payment failed: ${merchantTradeNo}, RtnMsg: ${params.RtnMsg}`)
      await supabase
        .from('ebook_purchases')
        .update({ status: 'failed' })
        .eq('merchant_trade_no', merchantTradeNo)
    }

    // ECPay 要求回傳 "1|OK" 表示收到通知
    return new NextResponse('1|OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: any) {
    console.error('[webhook] Error:', err?.message || err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
