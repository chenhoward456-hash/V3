/**
 * Recovery Assessment API
 * GET /api/recovery-assessment?clientId={unique_code}
 *
 * 呼叫 recovery-engine 回傳完整恢復評估（多系統、ACWR、自律神經、軌跡）
 * 前端 RecoveryDashboard 元件消費此 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { generateRecoveryAssessment, type RecoveryInput } from '@/lib/recovery-engine'

const logger = createLogger('api-recovery-assessment')

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    const { data: client } = await supabase
      .from('clients')
      .select('id, gender, diet_start_date, prep_phase, client_mode, competition_enabled')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }

    // 查最近 30 天 wellness（recovery engine 用前 3 天 vs 4-30 天計算基線）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

    const [wellnessRes, trainingRes, labRes] = await Promise.all([
      supabase
        .from('daily_wellness')
        .select('date, sleep_quality, energy_level, mood, stress_level, training_drive, device_recovery_score, hrv, resting_hr, wearable_sleep_score, respiratory_rate')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date'),
      supabase
        .from('training_logs')
        .select('date, training_type, rpe, duration, sets')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date'),
      supabase
        .from('lab_results')
        .select('test_name, value, unit, status')
        .eq('client_id', client.id)
        .order('date', { ascending: false })
        .limit(30),
    ])

    // 計算減脂週數
    let dietDurationWeeks: number | null = null
    if (client.diet_start_date) {
      const cutStart = new Date(client.diet_start_date)
      dietDurationWeeks = Math.floor((Date.now() - cutStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    }

    // 判斷經期/黃體期（簡易：從 wellness 的 period_start 推導）
    // 目前 wellness 表沒有完整經期追蹤，先設為 undefined
    const input: RecoveryInput = {
      wellness: (wellnessRes.data || []).map(w => ({
        date: w.date,
        sleep_quality: w.sleep_quality,
        energy_level: w.energy_level,
        mood: w.mood,
        stress: w.stress_level,
        training_drive: w.training_drive,
        device_recovery_score: w.device_recovery_score,
        hrv: w.hrv,
        resting_hr: w.resting_hr,
        wearable_sleep_score: w.wearable_sleep_score,
        respiratory_rate: w.respiratory_rate,
      })),
      trainingLogs: (trainingRes.data || []).map(t => ({
        date: t.date,
        training_type: t.training_type,
        rpe: t.rpe,
        duration: t.duration,
        sets: t.sets,
      })),
      labResults: (labRes.data || []).map(l => ({
        test_name: l.test_name,
        value: l.value as number | null,
        unit: l.unit,
        status: l.status as 'normal' | 'attention' | 'alert',
      })),
      dietDurationWeeks,
      prepPhase: client.prep_phase,
    }

    const assessment = generateRecoveryAssessment(input)

    return NextResponse.json(assessment)
  } catch (error) {
    logger.error('GET /api/recovery-assessment unexpected error', error)
    return NextResponse.json({ error: '恢復評估失敗' }, { status: 500 })
  }
}
