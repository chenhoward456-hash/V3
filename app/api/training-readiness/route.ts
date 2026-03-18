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
import { calculateMetabolicStressScore } from '@/lib/nutrition-engine'
import { isCompetitionMode } from '@/lib/client-mode'

const supabaseAdmin = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 查客戶資料（含基因、目標、備賽階段、減脂起始日）
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, gene_mthfr, gene_apoe, gene_depression_risk, goal_type, prep_phase, client_mode, competition_enabled, diet_start_date, gender, competition_date')
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

    // 查最近 56 天 training（8 週週期化分析用）
    const { data: training } = await supabaseAdmin
      .from('training_logs')
      .select('date, training_type, rpe, sets, duration')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(56)

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

    // 全部 56 天給 analyzeTrainingPattern（週期化分析需要 8 週數據）
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
    const shouldRecommendMode = !!(isCompetitionMode(client.client_mode) || client.goal_type)

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

    // ── 查詢體重歷史（用於代謝壓力 + 體重變化率偵測）──
    const { data: weightHistory } = await supabaseAdmin
      .from('body_composition')
      .select('date, weight')
      .eq('client_id', client.id)
      .not('weight', 'is', null)
      .order('date', { ascending: false })
      .limit(28)

    // 計算每週體重變化率（所有目標都適用）
    let weeklyWeightChangePercent: number | null = null
    let consecutivePlateauWeeks = 0
    if (weightHistory && weightHistory.length >= 7) {
      const recentWeek = weightHistory.slice(0, 7)
      const prevWeek = weightHistory.slice(7, 14)
      const recentAvg = recentWeek.reduce((s, w) => s + (w.weight || 0), 0) / recentWeek.length
      if (prevWeek.length >= 3) {
        const prevAvg = prevWeek.reduce((s, w) => s + (w.weight || 0), 0) / prevWeek.length
        weeklyWeightChangePercent = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0
        // 停滯 = 變化率 < 0.3%
        if (Math.abs(weeklyWeightChangePercent) < 0.3) {
          consecutivePlateauWeeks = 1
          const olderWeek = weightHistory.slice(14, 21)
          if (olderWeek.length >= 3) {
            const olderAvg = olderWeek.reduce((s, w) => s + (w.weight || 0), 0) / olderWeek.length
            const olderRate = olderAvg > 0 ? ((prevAvg - olderAvg) / olderAvg) * 100 : 0
            if (Math.abs(olderRate) < 0.3) consecutivePlateauWeeks = 2
            const oldestWeek = weightHistory.slice(21, 28)
            if (oldestWeek.length >= 3 && consecutivePlateauWeeks === 2) {
              const oldestAvg = oldestWeek.reduce((s, w) => s + (w.weight || 0), 0) / oldestWeek.length
              const oldestRate = oldestAvg > 0 ? ((olderAvg - oldestAvg) / olderAvg) * 100 : 0
              if (Math.abs(oldestRate) < 0.3) consecutivePlateauWeeks = 3
            }
          }
        }
      }
    }

    // ── 計算代謝壓力分數（如果在減脂期）──
    let metabolicStress: { score: number; level: string } | null = null
    if (client.goal_type === 'cut') {
      let dietDurationWeeks: number | null = null
      if (client.diet_start_date) {
        const cutStart = new Date(client.diet_start_date)
        const now = new Date()
        dietDurationWeeks = Math.floor((now.getTime() - cutStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
      }

      // 查詢低碳天數
      const { data: nutritionLogs } = await supabaseAdmin
        .from('nutrition_logs')
        .select('date, carbs_grams')
        .eq('client_id', client.id)
        .order('date', { ascending: false })
        .limit(14)

      let lowCarbDays = 0
      if (nutritionLogs) {
        for (const log of nutritionLogs) {
          if (log.carbs_grams != null && log.carbs_grams < 150) lowCarbDays++
          else break
        }
      }

      const recoveryState: 'optimal' | 'good' | 'struggling' | 'critical' | 'unknown' =
        advice.recoveryScore >= 75 ? 'optimal' :
        advice.recoveryScore >= 50 ? 'good' :
        advice.recoveryScore >= 30 ? 'struggling' : 'critical'

      const recentWellness = (wellness || []).map(w => ({
        energy_level: w.energy_level,
        training_drive: null as number | null,
      }))

      const stressResult = calculateMetabolicStressScore({
        dietDurationWeeks,
        recoveryState,
        readinessScore: advice.recoveryScore,
        weeklyChangeRate: weeklyWeightChangePercent ?? 0,
        consecutivePlateauWeeks,
        lowCarbDays,
        recentWellness,
        bodyWeight: (weightHistory && weightHistory.length > 0 ? weightHistory[0].weight : undefined) ?? undefined,
      })

      metabolicStress = { score: stressResult.score, level: stressResult.level }
    }

    // ── 計算 Peak Week 距比賽日天數 ──
    // Fix #1: 不再要求 prepPhase === 'peak_week'，只要 competition_date 在 0-7 天內 + 非 athletic 模式即觸發
    // 與營養引擎 daysLeft <= 7 自動偵測對齊
    let peakWeekDaysOut: number | null = null
    if (client.competition_date && isCompetitionMode(client.client_mode) && client.client_mode !== 'athletic') {
      const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000)  // UTC+8
      const nowTWMidnight = new Date(nowTW.toISOString().split('T')[0])  // 截到午夜，與 daysUntilDateTW 一致
      const comp = new Date(client.competition_date)
      peakWeekDaysOut = Math.round((comp.getTime() - nowTWMidnight.getTime()) / (24 * 60 * 60 * 1000))
      if (peakWeekDaysOut < 0 || peakWeekDaysOut > 7) peakWeekDaysOut = null
    }

    // Fix #4: 比賽已結束 → 自動視為 recovery（與營養引擎 rawDaysLeft<0 對齊）
    let effectivePrepPhase = client.prep_phase
    if (client.competition_date && isCompetitionMode(client.client_mode)) {
      const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000)  // UTC+8
      const nowTWMidnight = new Date(nowTW.toISOString().split('T')[0])  // 截到午夜
      const comp = new Date(client.competition_date)
      const daysSinceComp = Math.round((nowTWMidnight.getTime() - comp.getTime()) / (24 * 60 * 60 * 1000))
      if (daysSinceComp > 0 && daysSinceComp <= 14 && !['recovery', 'rebound', 'competition', 'weigh_in'].includes(effectivePrepPhase)) {
        effectivePrepPhase = 'recovery'
      }
    }

    // ── 呼叫訓練模式引擎 ──
    const modeRecommendation = getTrainingModeRecommendation({
      baseAdvice: advice,
      goalType: client.goal_type as 'cut' | 'bulk' | 'recomp' | null,
      prepPhase: effectivePrepPhase as TrainingModeInput['prepPhase'],
      geneticProfile,
      recentTrainingPattern: trainingPattern,
      hormoneLabs,
      metabolicStress,
      recoveryAssessment: advice.recoveryAssessment,
      weeklyWeightChangePercent,
      peakWeekDaysOut,
    })

    return NextResponse.json({ ...advice, modeRecommendation })
  } catch {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

// Type import for prepPhase union — used inline above
type TrainingModeInput = Parameters<typeof getTrainingModeRecommendation>[0]
