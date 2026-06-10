/**
 * 把血檢公版套用到學員、推到 admin LINE 讓 Howard copy 給學員去抽血
 *
 * Auth: CRON_SECRET header 或 admin session
 * Usage: GET /api/admin/push-lab-recommendation?clientId=<uuid>&templateId=<uuid>&dryRun=1
 *
 * 若不指定 templateId，會依學員 gender 自動挑「目標導向」公版（coached 比賽模式預設目標導向）
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

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })

  const templateIdParam = request.nextUrl.searchParams.get('templateId')
  const orientationParam = request.nextUrl.searchParams.get('orientation') ?? 'target'  // target / general_health
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'

  const supabase = createServiceSupabase()

  const { data: c } = await supabase
    .from('clients')
    .select('id, name, gender, client_mode')
    .eq('id', clientId)
    .maybeSingle()
  if (!c) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  // 挑公版：指定 templateId 優先，否則用 gender + orientation
  let template: any
  if (templateIdParam) {
    const { data } = await supabase.from('lab_panel_templates').select('*').eq('id', templateIdParam).maybeSingle()
    template = data
  } else {
    const { data } = await supabase
      .from('lab_panel_templates')
      .select('*')
      .eq('gender', c.gender || '男性')
      .eq('goal_orientation', orientationParam)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    template = data
  }
  if (!template) return NextResponse.json({ error: '找不到對應公版' }, { status: 404 })

  const items = template.add_on_items as any[]
  const mustItems = items.filter(i => i.priority === 'must')
  const optionalItems = items.filter(i => i.priority === 'optional')
  const mustTotal = mustItems.reduce((s, i) => s + Number(i.price ?? 0), 0)
  const optionalTotal = optionalItems.reduce((s, i) => s + Number(i.price ?? 0), 0)
  const baseAndMust = (template.base_price ?? 0) + mustTotal

  const fmt = (item: any) =>
    `・${item.name}${item.source === 'outsource' ? ' (外送)' : ''} — NT$${item.price}\n  └ ${item.why}`

  const messages: string[] = []

  // 摘要
  messages.push(
    `🩸 ${c.name} 血檢建議\n\n` +
    `公版：${template.name}\n` +
    `底盤：${template.base_package} 套餐 NT$${template.base_price}\n` +
    `必驗加項：${mustItems.length} 項 NT$${mustTotal}\n` +
    `可選加項：${optionalItems.length} 項 NT$${optionalTotal}\n` +
    `\n💰 預估總額：\n` +
    `・必驗組合：NT$${baseAndMust}\n` +
    `・全選（含可選）：NT$${baseAndMust + optionalTotal}`
  )

  // 抽血準備
  if (template.prep_notes) {
    messages.push(`📋 抽血準備\n\n${template.prep_notes}`)
  }

  // 必驗清單
  messages.push(`✅ 必驗項目（${mustItems.length} 項 / NT$${mustTotal}）\n\n${mustItems.map(fmt).join('\n\n')}`)

  // 可選清單
  if (optionalItems.length > 0) {
    messages.push(`⭐ 可選項目（${optionalItems.length} 項 / NT$${optionalTotal}）\n\n${optionalItems.map(fmt).join('\n\n')}`)
  }

  // snapshot 存 client
  const snapshot = {
    template_id: template.id,
    template_name: template.name,
    rendered_at: new Date().toISOString(),
    base_package: template.base_package,
    base_price: template.base_price,
    items,
    must_total: mustTotal,
    optional_total: optionalTotal,
    base_and_must: baseAndMust,
  }
  await supabase.from('clients').update({ lab_panel_recommended: snapshot }).eq('id', clientId)

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, snapshot, messages })
  }

  const adminLineId = process.env.ADMIN_LINE_USER_ID
  if (!adminLineId) {
    return NextResponse.json({ ok: true, snapshot, pushed: false, reason: 'no admin LINE id' })
  }

  for (const text of messages) {
    await pushMessage(adminLineId, [{ type: 'text', text }]).catch(() => {})
    await new Promise(r => setTimeout(r, 400))
  }

  return NextResponse.json({ ok: true, snapshot, pushed: true, message_count: messages.length })
}
