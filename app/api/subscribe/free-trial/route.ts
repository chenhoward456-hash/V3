import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { calculateInitialTargets } from '@/lib/nutrition-engine'
import { createLogger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import crypto from 'crypto'
import { pushMessage } from '@/lib/line'

const COACH_LINE_ID = process.env.COACH_LINE_USER_ID || 'U3b425b2d1572d197d0992945323881e5'

const log = createLogger('free-trial')

const supabase = createServiceSupabase()

// 密碼學安全隨機 unique_code（12 碼，~72 bits 熵值）
function generateUniqueCode(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`free_trial_${ip}`, 3, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const { name, email, gender, age, goalType, diagnosisData, ref, weight: formWeight } = await request.json()

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
        expires_at: null, // 免費用戶不過期，靠功能限制引導升級
        ...(ref ? { ref_source: ref } : {}),
        ...getDefaultFeatures('free'),
      })
      .select('id')
      .single()

    if (clientError) {
      log.error('Client creation error', clientError)
      pushMessage(COACH_LINE_ID, [{
        type: 'text',
        text: `❌ 註冊失敗！\n\n姓名：${name.trim()}\nEmail：${email}\n錯誤：${clientError.message || '未知'}`,
      }]).catch(() => {})
      return createErrorResponse('建立帳號失敗，請稍後再試', 500)
    }

    // 確保有體重數據：優先用 diagnosis，否則用表單填的體重
    const effectiveWeight = (diagnosisData?.weight && typeof diagnosisData.weight === 'number' && diagnosisData.weight >= 30 && diagnosisData.weight <= 300)
      ? diagnosisData.weight
      : (formWeight && typeof formWeight === 'number' && formWeight >= 30 && formWeight <= 300)
        ? formWeight
        : null

    // 有體重 → 建立初始體重紀錄 + 計算營養目標
    if (effectiveWeight) {
      const today = new Date().toISOString().split('T')[0]
      const bodyRecord: Record<string, string | number> = {
        client_id: newClient.id,
        date: today,
        weight: effectiveWeight,
      }
      if (diagnosisData?.height && diagnosisData.height > 100 && diagnosisData.height < 250) {
        bodyRecord.height = diagnosisData.height
      }
      if (diagnosisData?.bodyFatPct && diagnosisData.bodyFatPct > 3 && diagnosisData.bodyFatPct < 60) {
        bodyRecord.body_fat = diagnosisData.bodyFatPct
      }

      const { error: bodyError } = await supabase.from('body_composition').insert(bodyRecord)
      if (bodyError) log.error('Body composition insert failed (non-blocking)', bodyError)

      // 計算初始營養目標
      try {
        // 活動量：表單有填就用表單的，否則 moderate（預設）
        const activityProfile = diagnosisData?.activityProfile || undefined
        const trainingDays = diagnosisData?.trainingDaysPerWeek ?? 3

        const targets = calculateInitialTargets({
          gender: gender || '男性',
          bodyWeight: effectiveWeight,
          height: diagnosisData?.height || null,
          bodyFatPct: diagnosisData?.bodyFatPct || null,
          goalType: (goalType || 'cut') as 'cut' | 'bulk' | 'recomp',
          activityProfile,
          trainingDaysPerWeek: trainingDays,
        })

        // 計算目標時程
        const tgtWeight = diagnosisData?.targetWeight
        const tgtBodyFat = diagnosisData?.targetBodyFatPct
        const currentBodyFat = diagnosisData?.bodyFatPct
        let estimatedWeeks: number | null = null

        if (goalType === 'recomp' && currentBodyFat && tgtBodyFat && typeof currentBodyFat === 'number' && typeof tgtBodyFat === 'number') {
          // 體態重組：用體脂率變化估算時程
          // 體脂每降 1% 大約需要減 ~0.5-0.8kg 脂肪（依體重），同時增肌
          // 保守估算：每週體脂降 0.3-0.5%
          const bfDiff = Math.abs(currentBodyFat - tgtBodyFat)
          const weeklyBfRate = 0.3 // % per week (conservative for recomp)
          estimatedWeeks = Math.ceil(bfDiff / weeklyBfRate)
        } else if (tgtWeight && typeof tgtWeight === 'number' && tgtWeight >= 30 && tgtWeight <= 300) {
          const weightDiff = Math.abs(effectiveWeight - tgtWeight)
          // 減脂約 0.5-0.7 kg/週，增肌約 0.2-0.3 kg/週
          const weeklyRate = goalType === 'cut' ? 0.5 : 0.25
          estimatedWeeks = Math.ceil(weightDiff / weeklyRate)
        } else if (currentBodyFat && tgtBodyFat && typeof currentBodyFat === 'number' && typeof tgtBodyFat === 'number') {
          // 有體脂目標但沒有體重目標 → 也用體脂率估算
          const bfDiff = Math.abs(currentBodyFat - tgtBodyFat)
          const weeklyBfRate = goalType === 'cut' ? 0.5 : 0.3
          estimatedWeeks = Math.ceil(bfDiff / weeklyBfRate)
        }

        const { error: targetError } = await supabase.from('clients').update({
          calories_target: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          diet_start_date: today,
          ...(tgtWeight ? { target_weight: tgtWeight } : {}),
          ...(tgtBodyFat ? { target_body_fat: tgtBodyFat } : {}),
        }).eq('id', newClient.id)
        if (targetError) log.error('Nutrition target update failed', targetError)

        // 把時程預估也回傳給前端（用 registration_data 存）
        if (estimatedWeeks) {
          await supabase.from('subscription_purchases').update({
            registration_data: {
              gender, age, goalType,
              targetWeight: tgtWeight,
              estimatedWeeks,
              estimatedTDEE: targets.estimatedTDEE,
              calories: targets.calories,
              protein: targets.protein,
              carbs: targets.carbs,
              fat: targets.fat,
            },
          }).eq('client_id', newClient.id)
        }
      } catch (err) {
        log.error('Nutrition target calculation failed (non-blocking)', err)
      }
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

    // 推薦碼追蹤：如果 ref 參數匹配 referral_codes 表中的記錄，建立推薦關係
    if (ref) {
      try {
        const { data: codeRecord } = await supabase
          .from('referral_codes')
          .select('id, client_id, total_referrals')
          .eq('code', ref)
          .single()

        if (codeRecord && codeRecord.client_id !== newClient.id) {
          // Check referee hasn't been referred before
          const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id')
            .eq('referee_id', newClient.id)
            .single()

          if (!existingReferral) {
            await supabase.from('referrals').insert({
              referrer_id: codeRecord.client_id,
              referee_id: newClient.id,
              referral_code: ref,
              status: 'pending',
            })

            await supabase
              .from('referral_codes')
              .update({ total_referrals: (codeRecord.total_referrals || 0) + 1 })
              .eq('id', codeRecord.id)

            log.info('Referral tracked (free trial)', { referralCode: ref, refereeId: newClient.id })
          }
        }
      } catch (refErr) {
        log.error('Referral tracking error (non-blocking)', refErr)
      }
    }

    // 審計日誌（非阻塞）
    writeAuditLog({
      action: 'subscription.created',
      actor: 'system',
      targetType: 'client',
      targetId: newClient.id,
      details: { tier: 'free', email: email.trim(), uniqueCode },
      ip,
    })

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

    // 通知教練：新用戶註冊
    pushMessage(COACH_LINE_ID, [{
      type: 'text',
      text: `🆕 新用戶註冊！\n\n` +
        `姓名：${name.trim()}\n` +
        `目標：${goalType === 'cut' ? '減脂' : goalType === 'bulk' ? '增肌' : '體態重組'}\n` +
        `體重：${effectiveWeight ? effectiveWeight + 'kg' : '未填'}\n` +
        `${ref ? `來源：${ref}\n` : ''}` +
        `代碼：${uniqueCode}`,
    }]).catch(() => {})

    // 讀取已計算的營養目標回傳給前端
    const { data: clientData } = await supabase
      .from('clients')
      .select('calories_target, protein_target, carbs_target, fat_target, target_weight')
      .eq('id', newClient.id)
      .single()

    return NextResponse.json({
      success: true,
      uniqueCode,
      name: name.trim(),
      tier: 'free',
      targets: clientData ? {
        calories: clientData.calories_target,
        protein: clientData.protein_target,
        carbs: clientData.carbs_target,
        fat: clientData.fat_target,
        targetWeight: clientData.target_weight,
      } : null,
    })
  } catch (err: unknown) {
    log.error('Unexpected error', err)
    return createErrorResponse('建立帳號失敗，請稍後再試', 500)
  }
}
