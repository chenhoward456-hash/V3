/**
 * 訓練準備度 API
 * GET /api/training-readiness?clientId=xxx
 *
 * 用 getTrainingAdvice() 回傳今日建議訓練強度
 * 前端在訓練記錄頁面上方顯示
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { getTrainingAdvice } from '@/lib/ai-insights'

const supabaseAdmin = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }

    // 查最近 7 天 wellness
    const { data: wellness } = await supabaseAdmin
      .from('daily_wellness')
      .select('date, sleep_quality, energy_level, mood, stress_level, device_recovery_score, hrv, resting_hr, wearable_sleep_score')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(7)

    // 查最近 7 天 training
    const { data: training } = await supabaseAdmin
      .from('training_logs')
      .select('date, training_type, rpe')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(7)

    // 查最近血檢結果（非 normal 的指標）
    const { data: labResults } = await supabaseAdmin
      .from('lab_results')
      .select('test_name, value, unit, status')
      .eq('client_id', client.id)
      .in('status', ['attention', 'alert'])
      .order('date', { ascending: false })
      .limit(20)

    const wellnessLogs = (wellness || []).map(w => ({
      date: w.date,
      sleep_quality: w.sleep_quality,
      energy_level: w.energy_level,
      mood: w.mood,
      stress: w.stress_level,
    }))

    const trainingLogs = (training || []).map(t => ({
      date: t.date,
      training_type: t.training_type,
      rpe: t.rpe,
    }))

    const wearableData = (wellness || [])
      .filter(w => w.device_recovery_score != null || w.hrv != null)
      .map(w => ({
        date: w.date,
        device_recovery_score: w.device_recovery_score,
        hrv: w.hrv,
        resting_hr: w.resting_hr,
        wearable_sleep_score: w.wearable_sleep_score,
      }))

    const labDataForTraining = (labResults || []).map(l => ({
      test_name: l.test_name,
      value: l.value as number | null,
      status: l.status as 'normal' | 'attention' | 'alert',
    }))

    const advice = getTrainingAdvice(wellnessLogs, trainingLogs, wearableData.length > 0 ? wearableData : undefined, labDataForTraining.length > 0 ? labDataForTraining : undefined)

    return NextResponse.json(advice)
  } catch {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}
