import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMacValue, SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/ecpay'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { pushMessage, switchRichMenuForUser } from '@/lib/line'
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
          log.error('Client creation error', clientError, { merchantTradeNo, tier })
          // 回傳 0|Error 讓 ECPay 重試（用戶已付款但帳號未建立）
          return new NextResponse('0|ErrorMessage', { status: 200 })
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

      // 推薦碼追蹤：如果 registration_data 中有 ref 且匹配 referral_codes，建立推薦關係
      if (regData.ref && !existingClient) {
        try {
          const { data: codeRecord } = await supabase
            .from('referral_codes')
            .select('id, client_id, total_referrals')
            .eq('code', regData.ref)
            .maybeSingle()

          if (codeRecord && codeRecord.client_id !== clientId) {
            const { data: existingReferral } = await supabase
              .from('referrals')
              .select('id')
              .eq('referee_id', clientId)
              .maybeSingle()

            if (!existingReferral) {
              await supabase.from('referrals').insert({
                referrer_id: codeRecord.client_id,
                referee_id: clientId,
                referral_code: regData.ref,
                status: 'pending',
              })

              await supabase
                .from('referral_codes')
                .update({ total_referrals: (codeRecord.total_referrals || 0) + 1 })
                .eq('id', codeRecord.id)

              log.info('Referral tracked (paid signup)', { referralCode: regData.ref, refereeId: clientId })
            }
          }
        } catch (refErr) {
          log.error('Referral tracking error (non-blocking)', refErr)
        }
      }

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

      // LINE 推播通知付款成功
      const { data: updatedClient } = await supabase
        .from('clients')
        .select('line_user_id')
        .eq('id', clientId)
        .single()

      if (updatedClient?.line_user_id) {
        const tierNames: Record<string, string> = {
          self_managed: '自主管理方案',
          coached: '教練指導方案',
        }
        const tierName = tierNames[tier] || tier
        const isUpgrade = !!existingClient
        const msg = isUpgrade
          ? `${purchase.name}，你的方案已升級為「${tierName}」！\n\n所有新功能已解鎖，直接使用下方按鈕開始 👇`
          : `${purchase.name}，付款成功！你的「${tierName}」已啟用 🎉\n\n你的學員代碼：${uniqueCode}\n\n直接使用下方按鈕開始記錄 👇`
        pushMessage(updatedClient.line_user_id, [{ type: 'text', text: msg }]).catch((err) => {
          log.error('Payment LINE push error (non-blocking)', err)
        })

        // 根據新方案切換 Rich Menu（non-blocking）
        switchRichMenuForUser(updatedClient.line_user_id, tier).catch((err) => {
          log.error('Payment Rich Menu switch error (non-blocking)', err)
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
  } catch (err: unknown) {
    log.error('Webhook error', err)
    return new NextResponse('0|ErrorMessage', { status: 200 })
  }
}
