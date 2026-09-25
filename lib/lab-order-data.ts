/**
 * 學員版「下次抽血驗這些」的資料組裝：/api/lab-order（網頁卡片）和 LINE「血檢」指令共用，
 * 避免兩邊各算一套。唯讀、不寫 lab_panel_recommended。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLabOrder, type TemplateItem } from '@/lib/lab-order'
import { getTaiwanDate } from '@/lib/date-utils'
import { degradeToSafe } from '@/lib/compliance-scrub'

export type StudentLabOrder =
  | { enabled: false }
  | {
      enabled: true
      nextCheckupDate: string | null
      must: { label: string; price: number | null; why: string }[]
      defer: { label: string; price: number | null; why: string }[]
      skip: { label: string; price: number | null; why: string }[]
      mustCost: number
      fullCost: number
      templateCost: number
      unknownPriceCount: number
      basePackage: { price: number | null; skippable: boolean; why: string }
      prepNotes: string | null
    }

/** 找不到學員回 null；帳號暫停由呼叫端判斷（這裡不管） */
export async function loadStudentLabOrder(supabase: SupabaseClient, clientDbId: string): Promise<StudentLabOrder | null> {
  const { data: c } = await supabase
    .from('clients')
    .select('id, gender, lab_enabled, next_checkup_date, lab_results(test_name, value, unit, date, status)')
    .eq('id', clientDbId)
    .maybeSingle()
  if (!c) return null
  if (!c.lab_enabled) return { enabled: false }

  const { data: template } = await supabase
    .from('lab_panel_templates')
    .select('base_price, add_on_items, prep_notes')
    .eq('gender', c.gender || '男性')
    .eq('goal_orientation', 'target')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!template) return { enabled: false }

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

  return {
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
  }
}
