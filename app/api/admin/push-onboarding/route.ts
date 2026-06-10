/**
 * 把 onboarding 公版 render 成個別學員版本，推到 admin LINE 讓 Howard copy-paste 給學員
 *
 * Auth: CRON_SECRET header 或 admin session
 * Usage: GET /api/admin/push-onboarding?clientId=<uuid>&templateId=<uuid>&riceTrain=500&riceRest=230&targetBf=13
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'

export const maxDuration = 60

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

function renderTemplate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key]
    return v != null ? String(v) : `{{${key}}}`
  })
}

function generateRoadmapText(startWeight: number, targetWeight: number, weeksTotal: number): string {
  const stages = Math.min(6, Math.ceil(weeksTotal / 2))
  const lossPerStage = (startWeight - targetWeight) / stages
  const lines: string[] = []
  for (let i = 0; i < stages; i++) {
    const w1 = i * 2 + 1
    const w2 = Math.min(weeksTotal, (i + 1) * 2)
    const from = startWeight - i * lossPerStage
    const to = startWeight - (i + 1) * lossPerStage
    const phase =
      i === 0 ? '適應系統、找飲食卡點' :
      i === 1 ? '中期觀察 HRV、調整 cardio' :
      i === stages - 1 ? '最後 polish 階段' :
      i === stages - 2 ? '最後衝刺前段' :
      '可能第一次停滯，動策略'
    lines.push(`W${w1}-${w2}：${from.toFixed(1)} → ${to.toFixed(1)} kg（${phase}）`)
  }
  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })

  const templateId = request.nextUrl.searchParams.get('templateId')
  const riceTrain = Number(request.nextUrl.searchParams.get('riceTrain') ?? 500)
  const riceRest = Number(request.nextUrl.searchParams.get('riceRest') ?? 230)
  const targetBf = Number(request.nextUrl.searchParams.get('targetBf') ?? 13)
  const minKcal = Number(request.nextUrl.searchParams.get('minKcal') ?? 1700)
  const minProtein = Number(request.nextUrl.searchParams.get('minProtein') ?? 180)
  const minFat = Number(request.nextUrl.searchParams.get('minFat') ?? 55)

  const supabase = createServiceSupabase()

  // load client + latest body_composition + template
  const [clientRes, bodyRes, templateRes] = await Promise.all([
    supabase.from('clients').select('id, name, target_weight, competition_date, target_date, calories_target, protein_target, fat_target, carbs_target, carbs_training_day, carbs_rest_day').eq('id', clientId).maybeSingle(),
    supabase.from('body_composition').select('weight, body_fat').eq('client_id', clientId).order('date', { ascending: false }).limit(1).maybeSingle(),
    templateId
      ? supabase.from('client_onboarding_notes').select('id, name, sections').eq('id', templateId).maybeSingle()
      : supabase.from('client_onboarding_notes').select('id, name, sections').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const c = clientRes.data
  if (!c) return NextResponse.json({ error: '找不到學員' }, { status: 404 })
  const body = bodyRes.data
  if (!body || body.weight == null) return NextResponse.json({ error: '缺起始體重 (body_composition)' }, { status: 400 })
  const template = templateRes.data
  if (!template) return NextResponse.json({ error: '找不到 template' }, { status: 404 })

  const startWeight = Number(body.weight)
  const startBf = body.body_fat != null ? Number(body.body_fat) : 0
  const targetWeight = Number(c.target_weight)
  const protein = Number(c.protein_target ?? 0)
  const fat = Number(c.fat_target ?? 0)
  const carbTrain = Number(c.carbs_training_day ?? c.carbs_target ?? 0)
  const carbRest = Number(c.carbs_rest_day ?? c.carbs_target ?? 0)
  const compDate = c.competition_date || c.target_date
  if (!compDate) return NextResponse.json({ error: '缺 competition_date / target_date' }, { status: 400 })

  const kcalTrain = (protein + carbTrain) * 4 + fat * 9
  const kcalRest = (protein + carbRest) * 4 + fat * 9
  const fatMass = startBf > 0 ? (startWeight * startBf / 100).toFixed(1) : '?'
  const leanMass = startBf > 0 ? (startWeight - Number(fatMass)).toFixed(1) : '?'
  const weightToLose = (startWeight - targetWeight).toFixed(1)
  const daysToComp = Math.max(1, Math.floor((new Date(compDate).getTime() - Date.now()) / 86_400_000))
  const weeksLeft = Math.max(1, Math.ceil(daysToComp / 7))
  const weeksTotal = weeksLeft  // 預設等於剩餘週數
  const weeklyKg = (Number(weightToLose) / weeksTotal).toFixed(2)
  const roadmapText = generateRoadmapText(startWeight, targetWeight, weeksTotal)

  const vars: Record<string, string | number> = {
    name: c.name,
    kcal_train: Math.round(kcalTrain),
    kcal_rest: Math.round(kcalRest),
    carb_train: carbTrain,
    carb_rest: carbRest,
    protein,
    fat,
    rice_train: riceTrain,
    rice_rest: riceRest,
    start_weight: startWeight,
    start_bf: startBf,
    fat_mass: fatMass,
    lean_mass: leanMass,
    target_weight: targetWeight,
    target_bf: targetBf,
    weight_to_lose: weightToLose,
    weeks_left: weeksLeft,
    weeks_total: weeksTotal,
    comp_date: compDate,
    weekly_kg: weeklyKg,
    roadmap_text: roadmapText,
    min_kcal: minKcal,
    min_protein: minProtein,
    min_fat: minFat,
  }

  const sections = (template.sections as any[]).map(s => ({
    slug: s.slug,
    title: s.title,
    body: renderTemplate(s.body_md, vars),
  }))

  // save rendered to clients table for audit
  await supabase
    .from('clients')
    .update({ onboarding_notes_rendered: { template_id: template.id, rendered_at: new Date().toISOString(), sections } })
    .eq('id', clientId)

  // push to admin LINE — 一節一則
  const adminLineId = process.env.ADMIN_LINE_USER_ID
  if (!adminLineId) return NextResponse.json({ ok: true, sections, pushed: false, reason: 'no admin LINE id' })

  // 前置告知 + 後段說明
  await pushMessage(adminLineId, [{
    type: 'text',
    text: `📋 ${c.name} onboarding 記事本（${sections.length} 則）\n\n下面每則是一個獨立記事本，請逐則複製貼到你跟學員的 LINE 對話\n\n變數已自動代入 ${c.name} 的數字`
  }]).catch(() => {})

  for (const s of sections) {
    const text = `═══ ${s.title} ═══\n\n${s.body}`
    // LINE 上限 5000 字，個別記事本長度應該都在內
    await pushMessage(adminLineId, [{ type: 'text', text }]).catch(() => {})
    // 小延遲避免訊息順序亂掉
    await new Promise(r => setTimeout(r, 400))
  }

  await pushMessage(adminLineId, [{
    type: 'text',
    text: `✅ ${sections.length} 則 onboarding 推完。複製貼上給 ${c.name} 後，跟他確認他收到了`
  }]).catch(() => {})

  return NextResponse.json({ ok: true, sections_count: sections.length, pushed: true })
}
