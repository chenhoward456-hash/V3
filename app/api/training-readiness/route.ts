/**
 * 訓練準備度 API
 * GET /api/training-readiness?clientId=xxx
 *
 * 用 getTrainingAdvice() 回傳今日建議訓練強度
 * 用 getTrainingModeRecommendation() 回傳訓練模式建議
 * 前端在訓練記錄頁面上方顯示
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { getTrainingAdvice } from '@/lib/ai-insights'
import type { GeneticProfile } from '@/lib/supplement-engine'
import {
  getTrainingModeRecommendation,
  analyzeTrainingPattern,
  extractHormoneLabs,
} from '@/lib/training-mode-engine'

const supabaseAdmin = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 查客戶資料（含基因、目標、備賽階段）
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, gene_mthfr, gene_apoe, gene_depression_risk, goal_type, prep_phase, competition_enabled')
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

    // 查最近 14 天 training（擴展為模式分析用）
    const { data: training } = await supabaseAdmin
      .from('training_logs')
      .select('date, training_type, rpe, sets, duration')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(14)

    // 查最近血檢結果（非 normal 的指標 — 用於 getTrainingAdvice）
    const { data: labResults } = await supabaseAdmin
      .from('lab_results')
      .select('test_name, value, unit, status')
      .eq('client_id', client.id)
      .in('status', ['attention', 'alert'])
      .order('date', { ascending: false })
      .limit(20)

    // 查所有血檢結果（用於荷爾蒙提取）
    const { data: allLabs } = await supabaseAdmin
      .from('lab_results')
      .select('test_name, value, unit, status')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(50)

    const wellnessLogs = (wellness || []).map(w => ({
      date: w.date,
      sleep_quality: w.sleep_quality,
      energy_level: w.energy_level,
      mood: w.mood,
      stress: w.stress_level,
    }))

    // 前 7 天給 getTrainingAdvice（維持原有行為）
    const trainingLogsFor7d = (training || []).slice(0, 7).map(t => ({
      date: t.date,
      training_type: t.training_type,
      rpe: t.rpe,
    }))

    // 全部 14 天給 analyzeTrainingPattern
    const trainingLogs14d = (training || []).map(t => ({
      date: t.date,
      training_type: t.training_type,
      rpe: t.rpe,
      sets: t.sets,
      duration: t.duration,
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

    // 原有的訓練建議（強度等級）
    const advice = getTrainingAdvice(wellnessLogs, trainingLogsFor7d, wearableData.length > 0 ? wearableData : undefined, labDataForTraining.length > 0 ? labDataForTraining : undefined)

    // ── 判斷是否啟用訓練模式建議 ──
    // 只對備賽模式或有明確目標的客戶顯示（一般客戶信號不足，容易只輸出 moderate）
    const shouldRecommendMode = !!(client.competition_enabled || client.goal_type)

    if (!shouldRecommendMode) {
      return NextResponse.json(advice)
    }

    // ── 建構基因檔案 ──
    const geneticProfile: GeneticProfile = {
      mthfr: client.gene_mthfr as GeneticProfile['mthfr'] ?? null,
      apoe: client.gene_apoe as GeneticProfile['apoe'] ?? null,
      serotonin: (['LL', 'SL', 'SS'].includes(client.gene_depression_risk)
        ? client.gene_depression_risk
        : null) as GeneticProfile['serotonin'],
      depressionRisk: (!['LL', 'SL', 'SS'].includes(client.gene_depression_risk) && client.gene_depression_risk
        ? client.gene_depression_risk
        : null) as GeneticProfile['depressionRisk'],
    }

    // ── 分析訓練模式 ──
    const trainingPattern = analyzeTrainingPattern(trainingLogs14d)

    // ── 提取荷爾蒙數據 ──
    const hormoneLabs = extractHormoneLabs(allLabs || [])

    // ── 呼叫訓練模式引擎 ──
    const modeRecommendation = getTrainingModeRecommendation({
      baseAdvice: advice,
      goalType: client.goal_type as 'cut' | 'bulk' | 'recomp' | null,
      prepPhase: client.prep_phase as TrainingModeInput['prepPhase'],
      geneticProfile,
      recentTrainingPattern: trainingPattern,
      hormoneLabs,
      labTrainingModifiers: [],
      metabolicStress: null,  // Phase 2 再整合
    })

    return NextResponse.json({ ...advice, modeRecommendation })
  } catch {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

// Type import for prepPhase union — used inline above
type TrainingModeInput = Parameters<typeof getTrainingModeRecommendation>[0]
