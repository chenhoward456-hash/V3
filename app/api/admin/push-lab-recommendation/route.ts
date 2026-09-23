/**
 * 把血檢建議推到 admin LINE 讓 Howard copy 給學員去抽血。
 *
 * Auth: CRON_SECRET header 或 admin session
 * Usage: GET /api/admin/push-lab-recommendation?clientId=<uuid>&templateId=<uuid>&dryRun=1
 *        加 &raw=1 可看公版原樣（不跑減法）
 *
 * 若不指定 templateId，會依學員 gender 自動挑「目標導向」公版。
 *
 * ⚠️ 2026-09-13 改掉了原本的行為：這支原本**把公版整包吐出來**
 * ——男生目標導向那份是加驗 6,870 ＋底盤 3,600 ＝ 11,970，不管對方是誰、上次驗了什麼。
 * Howard 看到手做版的價格時的原話是「太貴了，乾，沒錢啦」。
 * 現在先跑 `lib/lab-order.ts` 的減法（扣掉基因型驗過的、算得出來的、
 * 三個月內驗過且在最佳範圍的、要等上游結果的），再分「必開／可延後／不用開」三桶。
 * 想看公版原樣加 `?raw=1`。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { buildLabOrder, type TemplateItem } from '@/lib/lab-order'

export const maxDuration = 60

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (process.env.CRON_SECRET && cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
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

  const raw = request.nextUrl.searchParams.get('raw') === '1'

  const { data: c } = await supabase
    .from('clients')
    .select('id, name, gender, client_mode, lab_results(test_name, value, unit, date, status)')
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

  // ── 減法：先算「你還不知道什麼」，再決定要開什麼 ──
  const plan = buildLabOrder({
    labs: (c.lab_results ?? []) as never,
    templateItems: items as TemplateItem[],
    basePrice: template.base_price,
    gender: c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined,
    today: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  const messages: string[] = []

  if (!raw) {
    const line = (l: { label: string; price: number | null; why: string }) =>
      `・${l.label} — ${l.price != null ? `NT$${l.price}` : '價格未知，開單時問'}\n  └ ${l.why}`
    const unknown = plan.must.filter(l => l.price == null).length

    messages.push(
      `🩸 ${c.name} 血檢建議（已扣掉不用驗的）\n\n` +
      `💰 必開 ${plan.must.length} 項：NT$${plan.mustCost.toLocaleString()}` +
      `${unknown > 0 ? `（另 ${unknown} 項價格未知）` : ''}\n` +
      `　 有錢再加 ${plan.defer.length} 項：NT$${(plan.fullCost - plan.mustCost).toLocaleString()}\n` +
      `　 不用開 ${plan.skip.length} 項\n\n` +
      `對照：公版全開 NT$${(plan.templateCost + (plan.basePackage.price ?? 0)).toLocaleString()}\n\n` +
      `底盤 ${template.base_package} 套餐 NT$${template.base_price}：` +
      `${plan.basePackage.skippable ? '可以不開' : '該開'}\n└ ${plan.basePackage.why}`,
    )
    messages.push(`✅ 必開（${plan.must.length} 項 / NT$${plan.mustCost.toLocaleString()}）\n\n${plan.must.map(line).join('\n\n')}`)
    if (plan.defer.length > 0) {
      messages.push(`⏳ 有錢再加（純基準線，沒有已知問題要追）\n\n${plan.defer.map(line).join('\n\n')}`)
    }
    if (plan.skip.length > 0) {
      messages.push(`✂️ 不用開（省下 NT$${plan.skip.reduce((s, l) => s + (l.price ?? 0), 0).toLocaleString()}）\n\n${plan.skip.map(line).join('\n\n')}`)
    }
    if (template.prep_notes) messages.push(`📋 抽血準備\n\n${template.prep_notes}`)
  }

  // 摘要
  if (raw) messages.push(
    `🩸 ${c.name} 血檢建議\n\n` +
    `公版：${template.name}\n` +
    `底盤：${template.base_package} 套餐 NT$${template.base_price}\n` +
    `必驗加項：${mustItems.length} 項 NT$${mustTotal}\n` +
    `可選加項：${optionalItems.length} 項 NT$${optionalTotal}\n` +
    `\n💰 預估總額：\n` +
    `・必驗組合：NT$${baseAndMust}\n` +
    `・全選（含可選）：NT$${baseAndMust + optionalTotal}`
  )

  if (raw) {
    if (template.prep_notes) messages.push(`📋 抽血準備\n\n${template.prep_notes}`)
    messages.push(`✅ 必驗項目（${mustItems.length} 項 / NT$${mustTotal}）\n\n${mustItems.map(fmt).join('\n\n')}`)
    if (optionalItems.length > 0) {
      messages.push(`⭐ 可選項目（${optionalItems.length} 項 / NT$${optionalTotal}）\n\n${optionalItems.map(fmt).join('\n\n')}`)
    }
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
    // 減法後的實際建議（公版是對照組，這個才是要開的）
    plan: {
      must: plan.must, defer: plan.defer, skip: plan.skip,
      must_cost: plan.mustCost, full_cost: plan.fullCost,
      base_package: plan.basePackage,
    },
  }
  // ⚠️ dryRun 不可以寫 DB。原本這行在 dryRun 檢查**之前**，
  // 等於「預覽」也會改到學員資料（clients.lab_panel_recommended）——
  // 那就不叫 dry run。2026-09-13 實際踩到：預覽一次就寫了一次 production。
  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, snapshot, messages })
  }

  await supabase.from('clients').update({ lab_panel_recommended: snapshot }).eq('id', clientId)

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
