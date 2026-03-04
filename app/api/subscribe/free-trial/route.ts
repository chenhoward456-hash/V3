import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const log = createLogger('free-trial')

const supabase = createServiceSupabase()

// 密碼學安全隨機 unique_code
function generateUniqueCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`free_trial_${ip}`, 3, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const { name, email, gender, age, goalType } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return createErrorResponse('請輸入姓名', 400)
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return createErrorResponse('請輸入有效的 Email', 400)
    }

    // 檢查 email 是否已有免費試用帳號（防止重複申請）
    const { data: existing } = await supabase
      .from('subscription_purchases')
      .select('id')
      .eq('email', email.trim())
      .eq('subscription_tier', 'free')
      .eq('status', 'completed')
      .limit(1)

    if (existing && existing.length > 0) {
      return createErrorResponse('此 Email 已申請過免費體驗，請直接登入你的儀表板', 400)
    }

    // 建立學員帳號
    const uniqueCode = generateUniqueCode()

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        unique_code: uniqueCode,
        name: name.trim(),
        age: age ? parseInt(age) : null,
        gender: gender || null,
        goal_type: goalType || 'cut',
        subscription_tier: 'free',
        ...getDefaultFeatures('free'),
      })
      .select('id')
      .single()

    if (clientError) {
      log.error('Client creation error', clientError)
      return createErrorResponse('建立帳號失敗，請稍後再試', 500)
    }

    // 記錄到 subscription_purchases（統一追蹤）
    await supabase.from('subscription_purchases').insert({
      email: email.trim(),
      name: name.trim(),
      merchant_trade_no: `FREE${Date.now().toString(36)}`,
      subscription_tier: 'free',
      amount: 0,
      status: 'completed',
      client_id: newClient.id,
      registration_data: { gender, age, goalType },
      completed_at: new Date().toISOString(),
    })

    log.info('Account created', { uniqueCode, email })

    // 寄歡迎信
    if (email) {
      sendWelcomeEmail({
        to: email.trim(),
        name: name.trim(),
        uniqueCode,
        tier: 'free',
      }).catch((err) => {
        log.error('Email error (non-blocking)', err)
      })
    }

    return NextResponse.json({
      success: true,
      uniqueCode,
      name: name.trim(),
      tier: 'free',
    })
  } catch (err: any) {
    log.error('Unexpected error', err)
    return createErrorResponse('建立帳號失敗，請稍後再試', 500)
  }
}
