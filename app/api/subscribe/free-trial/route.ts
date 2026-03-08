import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { calculateInitialTargets } from '@/lib/nutrition-engine'
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
        ...(ref ? { ref_source: ref } : {}),
        ...getDefaultFeatures('free'),
      })
      .select('id')
      .single()

    if (clientError) {
      log.error('Client creation error', clientError)
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
      const bodyRecord: Record<string, any> = {
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

      await supabase.from('body_composition').insert(bodyRecord)

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
          goalType: (goalType || 'cut') as 'cut' | 'bulk',
          activityProfile,
          trainingDaysPerWeek: trainingDays,
        })

        // 計算目標時程（如果有目標體重）
        const tgtWeight = diagnosisData?.targetWeight
        let estimatedWeeks: number | null = null
        if (tgtWeight && typeof tgtWeight === 'number' && tgtWeight >= 30 && tgtWeight <= 300) {
          const weightDiff = Math.abs(effectiveWeight - tgtWeight)
          // 減脂約 0.5-0.7 kg/週，增肌約 0.2-0.3 kg/週
          const weeklyRate = goalType === 'cut' ? 0.5 : 0.25
          estimatedWeeks = Math.ceil(weightDiff / weeklyRate)
        }

        await supabase.from('clients').update({
          calories_target: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          diet_start_date: today,
          ...(tgtWeight ? { target_weight: tgtWeight } : {}),
        }).eq('id', newClient.id)

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
  } catch (err: any) {
    log.error('Unexpected error', err)
    return createErrorResponse('建立帳號失敗，請稍後再試', 500)
  }
}
