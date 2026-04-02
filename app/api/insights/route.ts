import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { generateBehaviorInsights, type InsightInput } from '@/lib/insight-engine'

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  // Rate limiting：防止暴力枚舉 unique_code
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`insights:${ip}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  try {
    // 1. 取得學員基本資料
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, unique_code, gender, goal_type, subscription_tier')
      .eq('unique_code', clientId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: '找不到學員' }, { status: 404 })
    }

    // 2. 拉 14 天數據
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const sinceDate = fourteenDaysAgo.toISOString().split('T')[0]

    const [bodyRes, wellnessRes, nutritionRes, trainingRes, suppLogsRes, suppCountRes] = await Promise.all([
      supabase
        .from('body_composition')
        .select('date, weight')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .not('weight', 'is', null)
        .order('date', { ascending: false })
        .limit(14),
      supabase
        .from('daily_wellness')
        .select('date, sleep_quality, energy_level, mood, stress_level, cognitive_clarity, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: false }),
      supabase
        .from('nutrition_logs')
        .select('date, calories, carbs_grams, protein_grams, compliant')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: false }),
      supabase
        .from('training_logs')
        .select('date, training_type, rpe, duration')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: false }),
      supabase
        .from('supplement_logs')
        .select('date, completed')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: false }),
      supabase
        .from('supplements')
        .select('id')
        .eq('client_id', client.id),
    ])

    const bodyData = bodyRes.data || []
    const latestWeight = bodyData.length > 0 ? bodyData[0].weight : null

    if (!latestWeight) {
      return NextResponse.json({ insights: [] })
    }

    // 3. 組裝引擎輸入
    const input: InsightInput = {
      gender: client.gender || '男性',
      bodyWeight: latestWeight,
      goalType: (client.goal_type as 'cut' | 'bulk' | 'recomp') || 'cut',
      wellness: (wellnessRes.data || []).map((w: any) => ({
        date: w.date,
        sleep_quality: w.sleep_quality,
        energy_level: w.energy_level,
        mood: w.mood,
        stress_level: w.stress_level,
        cognitive_clarity: w.cognitive_clarity,
        training_drive: w.training_drive,
        device_recovery_score: w.device_recovery_score,
        resting_hr: w.resting_hr,
        hrv: w.hrv,
        wearable_sleep_score: w.wearable_sleep_score,
      })),
      nutrition: (nutritionRes.data || []).map((n: any) => ({
        date: n.date,
        calories: n.calories,
        carbs_grams: n.carbs_grams,
        protein_grams: n.protein_grams,
        compliant: n.compliant,
      })),
      training: (trainingRes.data || []).map((t: any) => ({
        date: t.date,
        training_type: t.training_type,
        rpe: t.rpe,
        duration: t.duration,
      })),
      supplementLogs: (suppLogsRes.data || []).map((s: any) => ({
        date: s.date,
        completed: s.completed,
      })),
      supplementCount: suppCountRes.data?.length || 0,
      weightHistory: bodyData.map((b: any) => ({ date: b.date, weight: b.weight })),
    }

    // 4. 執行引擎
    const insights = generateBehaviorInsights(input)

    // 5. 免費用戶限制 2 條
    const isFree = client.subscription_tier === 'free'
    const visibleInsights = isFree ? insights.slice(0, 2) : insights
    const hasMore = isFree && insights.length > 2

    return NextResponse.json({
      insights: visibleInsights,
      hasMore,
      totalCount: insights.length,
    })
  } catch (err: any) {
    console.error('[insights] Error:', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
