/**
 * AI Coach API — 將引擎分析結果轉為自然語言教練建議
 *
 * POST /api/ai-coach
 * Body: { clientId: string }
 *
 * 流程：
 *   1. 取得學員資料 + 引擎分析結果（nutrition suggestion, health score, lab advice）
 *   2. 組成 context prompt 餵給 Claude API
 *   3. 回傳自然語言教練建議
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { calculateHealthScore, HealthScoreInput } from '@/lib/health-score-engine'
import { generateLabNutritionAdvice } from '@/lib/lab-nutrition-advisor'

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ai-coach:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI 服務未設定' }, { status: 503 })
  }

  try {
    const { clientId } = await request.json()
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 1. 平行取得學員資料
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sinceDate = sevenDaysAgo.toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since30 = thirtyDaysAgo.toISOString().split('T')[0]

    const [clientRes, wellnessRes, nutritionRes, trainingRes, supplementLogsRes, supplementsRes, labRes, bodyRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('daily_wellness').select('*').eq('client_id', clientId).gte('date', sinceDate).order('date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('client_id', clientId).gte('date', sinceDate).order('date', { ascending: false }),
      supabase.from('training_logs').select('*').eq('client_id', clientId).gte('date', sinceDate).order('date', { ascending: false }),
      supabase.from('supplement_logs').select('*').eq('client_id', clientId).gte('date', sinceDate),
      supabase.from('supplements').select('*').eq('client_id', clientId),
      supabase.from('lab_results').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(30),
      supabase.from('body_composition').select('*').eq('client_id', clientId).gte('date', since30).order('date', { ascending: false }),
    ])

    const client = clientRes.data
    if (!client) {
      return NextResponse.json({ error: '找不到學員' }, { status: 404 })
    }

    // 2. 計算 Health Score
    const wellnessData = wellnessRes.data || []
    const nutritionData = nutritionRes.data || []
    const trainingData = trainingRes.data || []
    const supplementLogs = supplementLogsRes.data || []
    const supplements = supplementsRes.data || []
    const labData = labRes.data || []
    const bodyData = bodyRes.data || []

    const suppTotal = supplements.length * 7
    const suppDone = supplementLogs.filter((l: any) => l.completed).length
    const suppRate = suppTotal > 0 ? suppDone / suppTotal : 0

    const healthScore = calculateHealthScore({
      wellnessLast7: wellnessData.slice(0, 7),
      nutritionLast7: nutritionData.slice(0, 7).map((n: any) => ({ compliant: n.compliant })),
      trainingLast7: trainingData.slice(0, 7).map((t: any) => ({ training_type: t.training_type })),
      supplementComplianceRate: suppRate,
      labResults: labData.map((l: any) => ({ status: l.status })),
      quarterlyStart: null,
    })

    // 3. Lab advice
    const labAdvice = generateLabNutritionAdvice(
      labData.map((l: any) => ({ test_name: l.test_name, value: l.value, unit: l.unit, status: l.status })),
      { gender: client.gender, goalType: client.goal_type }
    )

    // 4. 組成 context
    const context = {
      name: client.name,
      gender: client.gender,
      age: client.age,
      goalType: client.goal_type || 'cut',
      healthScore: { total: healthScore.total, grade: healthScore.grade, pillars: healthScore.pillars.map(p => `${p.label}: ${p.score}/100`) },
      recentWeight: bodyData.slice(0, 7).map((b: any) => `${b.date}: ${b.weight}kg`),
      recentWellness: wellnessData.slice(0, 3).map((w: any) => `${w.date}: 睡眠${w.sleep_quality}/5 精力${w.energy_level}/5 情緒${w.mood}/5`),
      trainingThisWeek: trainingData.slice(0, 7).map((t: any) => `${t.date}: ${t.training_type} RPE${t.rpe || '?'}`),
      nutritionCompliance: nutritionData.length > 0 ? `${nutritionData.filter((n: any) => n.compliant).length}/${nutritionData.length} 天合規` : '無記錄',
      labAlerts: labAdvice.slice(0, 3).map(a => `${a.title}（${a.currentValue} ${a.unit}）`),
      coachNote: client.coach_weekly_note || '無',
    }

    // 5. 呼叫 Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `你是一位專業健身教練 Howard，說話風格直接、溫暖、不廢話。根據以下學員數據，用繁體中文寫一段 150-250 字的本週建議。

學員資料：
${JSON.stringify(context, null, 2)}

要求：
1. 先肯定做得好的地方（具體指出數據）
2. 再指出 1-2 個需要改善的重點
3. 最後給出本週 1 個具體行動建議
4. 語氣像真人教練私訊，不要用列表格式
5. 如果有血檢異常，簡單提醒一下
6. 不要提到「根據數據」「系統分析」等詞，像你本人在看資料後直接講話`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[ai-coach] Claude API error:', err)
      return NextResponse.json({ error: 'AI 服務暫時無法使用' }, { status: 502 })
    }

    const result = await response.json()
    const advice = result.content?.[0]?.text || ''

    return NextResponse.json({ advice, healthScore: { total: healthScore.total, grade: healthScore.grade } })
  } catch (error) {
    console.error('[ai-coach] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
