import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { sendPurchaseEmail } from '@/lib/email'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const supabase = createServiceSupabase()
const log = createLogger('ebook/webhook')

// ECPay ReturnURL — 付款結果通知
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    log.info('ECPay callback received', {
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
      // 冪等性檢查：先查詢是否已處理
      const { data: existing } = await supabase
        .from('ebook_purchases')
        .select('status, download_token')
        .eq('merchant_trade_no', merchantTradeNo)
        .single()

      if (existing?.status === 'completed') {
        log.info('Already completed, skipping', { merchantTradeNo })
        return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

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
        log.error('DB update error', error)
      } else {
        log.info('Purchase completed', { merchantTradeNo })

        let email = params.CustomField1
        if (!email) {
          const { data: purchase } = await supabase
            .from('ebook_purchases')
            .select('email')
            .eq('merchant_trade_no', merchantTradeNo)
            .single()
          email = purchase?.email || ''
        }

        if (email) {
          sendPurchaseEmail({
            to: email,
            downloadToken,
            merchantTradeNo,
          }).catch((emailErr) => {
            log.error('Email send error (non-blocking)', emailErr)
          })
        }
      }
    } else {
      log.info('Payment failed', { merchantTradeNo, RtnMsg: params.RtnMsg })
      await supabase
        .from('ebook_purchases')
        .update({ status: 'failed' })
        .eq('merchant_trade_no', merchantTradeNo)
    }

    return new NextResponse('1|OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: unknown) {
    log.error('Webhook error', err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
