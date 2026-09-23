import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { buildLabOrder, type TemplateItem } from '@/lib/lab-order'
import { getTaiwanDate } from '@/lib/date-utils'
import { degradeToSafe } from '@/lib/compliance-scrub'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/lab-order?code=<unique_code>
 * 學員版「下次抽血驗這些」：跑同一支減法開單引擎（lib/lab-order.ts），學員打開自己就知道要驗什麼、
 * 大約多少錢、哪些不用花錢、抽血前要注意什麼。唯讀、不寫 lab_panel_recommended。
 */
export async function GET(request: NextRequest) {
  const { allowed } = await rateLimit(`lab_order_${getClientIP(request)}`, 30, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  const code = new URL(request.url).searchParams.get('code')
  if (!code) return createErrorResponse('缺少代碼', 400)

  const { data: c } = await supabase
    .from('clients')
    .select('id, gender, is_active, lab_enabled, next_checkup_date, lab_results(test_name, value, unit, date, status)')
    .eq('unique_code', code)
    .maybeSingle()
  if (!c) return createErrorResponse('找不到資料', 404)
  if (c.is_active === false) return createErrorResponse('帳號已暫停', 403)
  if (!c.lab_enabled) return createSuccessResponse({ enabled: false })

  const { data: template } = await supabase
    .from('lab_panel_templates')
    .select('base_price, add_on_items, prep_notes')
    .eq('gender', c.gender || '男性')
    .eq('goal_orientation', 'target')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!template) return createSuccessResponse({ enabled: false })

  const plan = buildLabOrder({
    labs: (c.lab_results ?? []) as never,
    templateItems: (template.add_on_items ?? []) as TemplateItem[],
    basePrice: template.base_price,
    gender: c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined,
    today: getTaiwanDate(),
  })

  // 引擎的 why 是寫給教練的，學員版拿掉內部用語（例：「公版漏了這項。」）再過合規
  const safe = (t: string) => degradeToSafe(t.replace(/公版漏了這項[。，]?/g, '').trim(), '教練開單時會說明').text
  const pick = (l: typeof plan.must[number]) => ({ label: l.label, price: l.price, why: safe(l.why) })

  return createSuccessResponse({
    enabled: true,
    nextCheckupDate: c.next_checkup_date,
    must: plan.must.map(pick),
    defer: plan.defer.map(pick),
    skip: plan.skip.map(pick),
    mustCost: plan.mustCost,
    fullCost: plan.fullCost,
    templateCost: plan.templateCost,
    unknownPriceCount: plan.unknownPriceCount,
    basePackage: { price: plan.basePackage.price, skippable: plan.basePackage.skippable, why: safe(plan.basePackage.why) },
    prepNotes: template.prep_notes ?? null,
  })
}
