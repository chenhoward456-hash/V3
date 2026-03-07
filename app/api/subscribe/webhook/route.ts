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

      const durationMonths = SUBSCRIPTION_PLANS[tier]?.duration_months || 1

      // ===== 升級邏輯：先查 email 是否已有帳號 =====
      // 有 → 升級 tier + 延長到期日 + 更新功能權限（保留歷史數據）
      // 沒有 → 建新帳號
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, unique_code, expires_at, subscription_tier')
        .eq('name', purchase.name)
        .limit(10)

      // 用 subscription_purchases 的 email 比對已有帳號
      let existingClient: { id: string; unique_code: string; expires_at: string | null; subscription_tier: string } | null = null
      if (existingClients && existingClients.length > 0) {
        // 查找同 email 的 purchase 關聯的 client
        const { data: prevPurchases } = await supabase
          .from('subscription_purchases')
          .select('client_id')
          .eq('email', purchase.email)
          .eq('status', 'completed')
          .not('client_id', 'is', null)
          .limit(10)

        if (prevPurchases && prevPurchases.length > 0) {
          const prevClientIds = prevPurchases.map(p => p.client_id)
          existingClient = existingClients.find(c => prevClientIds.includes(c.id)) || null
        }
      }

      let clientId: string
      let uniqueCode: string

      if (existingClient) {
        // ===== 升級既有帳號 =====
        clientId = existingClient.id
        uniqueCode = existingClient.unique_code

        // 到期日：從現在或原到期日（取較晚者）再加一個月
        const now = new Date()
        const currentExpiry = existingClient.expires_at ? new Date(existingClient.expires_at) : now
        const baseDate = currentExpiry > now ? currentExpiry : now
        const newExpiry = new Date(baseDate)
        newExpiry.setMonth(newExpiry.getMonth() + durationMonths)

        await supabase.from('clients').update({
          subscription_tier: tier,
          expires_at: newExpiry.toISOString(),
          ...getDefaultFeatures(tier),
        }).eq('id', clientId)

        log.info('Client upgraded', { uniqueCode, tier, previousTier: existingClient.subscription_tier, email: purchase.email })
      } else {
        // ===== 建立新帳號 =====
        uniqueCode = generateUniqueCode()
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths)

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
          await supabase.from('subscription_purchases').update({
            status: 'completed',
            ecpay_trade_no: params.TradeNo || null,
            completed_at: new Date().toISOString(),
          }).eq('merchant_trade_no', merchantTradeNo)

          return new NextResponse('1|OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
        }

        clientId = newClient.id
        log.info('Client created', { uniqueCode, tier, email: purchase.email })
      }

      // 更新購買紀錄
      await supabase.from('subscription_purchases').update({
        status: 'completed',
        ecpay_trade_no: params.TradeNo || null,
        client_id: clientId,
        completed_at: new Date().toISOString(),
      }).eq('merchant_trade_no', merchantTradeNo)

      // 非同步寄送歡迎信（升級也寄，通知新代碼或確認升級）
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
