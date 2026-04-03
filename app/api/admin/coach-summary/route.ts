/**
 * 教練 AI 建議摘要 API
 *
 * GET /api/admin/coach-summary?clientId=xxx
 * 根據學員近 14 天數據，用 Claude 生成 3-5 點建議調整
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createServiceSupabase()

  try {
    // Resolve clientId (UUID or unique_code)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    const clientRes = isUUID
      ? await supabase.from('clients').select('*').eq('id', clientId).single()
      : await supabase.from('clients').select('*').eq('unique_code', clientId).single()

    if (!clientRes.data) {
      return NextResponse.json({ error: '找不到學員' }, { status: 404 })
    }

    const client = clientRes.data
    const realId = client.id

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const sinceDate = fourteenDaysAgo.toISOString().split('T')[0]

    // Fetch all relevant data in parallel
    const [nutritionRes, wellnessRes, trainingRes, labRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('id, date, training_type, rpe').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('lab_results').select('*').eq('client_id', realId).order('date', { ascending: false }).limit(20),
    ])

    const nutrition = nutritionRes.data || []
    const wellness = wellnessRes.data || []
    const training = trainingRes.data || []
    const labs = labRes.data || []

    // Build structured data for the prompt
    const dataLines: string[] = []

    // Client profile
    dataLines.push(`【學員基本資料】`)
    dataLines.push(`姓名：${client.name}`)
    dataLines.push(`年齡：${client.age}歲，性別：${client.gender}`)
    if (client.goal_type) dataLines.push(`目標：${client.goal_type}`)
    if (client.client_mode) dataLines.push(`模式：${client.client_mode}`)
    if (client.health_goals) dataLines.push(`健康目標：${client.health_goals}`)
    if (client.prep_phase) dataLines.push(`備賽階段：${client.prep_phase}`)
    if (client.competition_date) dataLines.push(`比賽日期：${client.competition_date}`)

    // Nutrition targets
    dataLines.push(`\n【營養目標】`)
    if (client.protein_target) dataLines.push(`蛋白質目標：${client.protein_target}g`)
    if (client.calories_target) dataLines.push(`熱量目標：${client.calories_target}kcal`)
    if (client.carbs_target) dataLines.push(`碳水目標：${client.carbs_target}g`)
    if (client.fat_target) dataLines.push(`脂肪目標：${client.fat_target}g`)
    if (client.water_target) dataLines.push(`飲水目標：${client.water_target}ml`)

    // Nutrition logs (14 days)
    if (nutrition.length > 0) {
      dataLines.push(`\n【近 14 天營養紀錄（${nutrition.length} 筆）】`)
      for (const n of nutrition) {
        const parts = [n.date]
        if (n.protein_grams != null) parts.push(`蛋白質${n.protein_grams}g`)
        if (n.calories != null) parts.push(`熱量${n.calories}kcal`)
        if (n.carbs_grams != null) parts.push(`碳水${n.carbs_grams}g`)
        if (n.fat_grams != null) parts.push(`脂肪${n.fat_grams}g`)
        if (n.water_ml != null) parts.push(`飲水${n.water_ml}ml`)
        dataLines.push(parts.join(' | '))
      }
    } else {
      dataLines.push(`\n【營養紀錄】無近 14 天數據`)
    }

    // Wellness (14 days)
    if (wellness.length > 0) {
      dataLines.push(`\n【近 14 天身心狀態（${wellness.length} 筆）】`)
      for (const w of wellness) {
        const parts = [w.date]
        if (w.sleep_hours != null) parts.push(`睡眠${w.sleep_hours}h`)
        if (w.energy_level != null) parts.push(`精力${w.energy_level}/5`)
        if (w.mood != null) parts.push(`情緒${w.mood}/5`)
        if (w.stress_level != null) parts.push(`壓力${w.stress_level}/5`)
        if (w.notes) parts.push(`備註：${w.notes}`)
        dataLines.push(parts.join(' | '))
      }
    } else {
      dataLines.push(`\n【身心狀態】無近 14 天數據`)
    }

    // Training (14 days)
    if (training.length > 0) {
      dataLines.push(`\n【近 14 天訓練紀錄（${training.length} 筆）】`)
      for (const t of training) {
        const parts = [t.date, t.training_type || '未分類']
        if (t.rpe != null) parts.push(`RPE ${t.rpe}`)
        dataLines.push(parts.join(' | '))
      }
    } else {
      dataLines.push(`\n【訓練紀錄】無近 14 天數據`)
    }

    // Lab results (latest)
    if (labs.length > 0) {
      dataLines.push(`\n【最近血檢數據（${Math.min(labs.length, 10)} 筆）】`)
      for (const l of labs.slice(0, 10)) {
        const parts = [l.date, l.test_name, `${l.value} ${l.unit || ''}`]
        if (l.status) parts.push(`狀態：${l.status}`)
        if (l.reference_range) parts.push(`參考：${l.reference_range}`)
        dataLines.push(parts.join(' | '))
      }
    }

    const clientData = dataLines.join('\n')

    const systemPrompt = `你是一位 CSCS 認證的備賽教練。根據以下客戶數據，列出 3-5 個本週最重要的建議調整，用繁體中文。每一點要具體，包含數字。格式用 bullet points（用 • 開頭）。不要加標題，直接列出建議。`

    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: clientData,
        },
      ],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    const summary = textBlock ? textBlock.text : ''

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Coach summary error:', err)
    return NextResponse.json({ error: '生成建議失敗' }, { status: 500 })
  }
}
