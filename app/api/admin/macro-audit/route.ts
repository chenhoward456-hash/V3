import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { auditAll, type AuditInput } from '@/lib/macro-audit'
import { getLocalDateStr } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

/**
 * 巨量健全性稽核：掃所有在籍學員的營養設定，找內部矛盾與超出實證邊界的地方。
 * 只讀不寫 —— 改學員的數字是教練的決定，這支只負責把問題端上來。
 * 規則與出處見 lib/macro-audit.ts。
 */
export async function GET(request: NextRequest) {
  const s = request.cookies.get('admin_session')?.value
  if (!s || !verifyAdminSession(s)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const supabase = createServiceSupabase()
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id,name,goal_type,prep_phase,target_weight,target_date,competition_date,competition_enabled,calories_target,protein_target,carbs_target,fat_target,carbs_training_day,carbs_rest_day')
    .eq('is_active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ success: true, scanned: 0, findings: [] })

  // 體脂不會天天量 → 往回撈一段，各自取「最近一筆有值的」（體重與體脂可能不同天）
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
  const { data: body } = await supabase
    .from('body_composition')
    .select('client_id, date, weight, body_fat')
    .in('client_id', clients.map(c => c.id))
    .gte('date', since)
    .order('date', { ascending: false })

  const latestWeight = new Map<string, number>()
  const latestBf = new Map<string, number>()
  for (const r of (body ?? []) as { client_id: string; weight: number | null; body_fat: number | null }[]) {
    if (r.weight != null && !latestWeight.has(r.client_id)) latestWeight.set(r.client_id, r.weight)
    if (r.body_fat != null && !latestBf.has(r.client_id)) latestBf.set(r.client_id, r.body_fat)
  }

  const today = getLocalDateStr(new Date())
  const inputs: AuditInput[] = clients.map(c => ({
    client: c,
    weight: latestWeight.get(c.id) ?? null,
    bodyFat: latestBf.get(c.id) ?? null,
    today,
  }))

  const findings = auditAll(inputs)
  return NextResponse.json({
    success: true,
    scanned: clients.length,
    high: findings.filter(f => f.severity === 'high').length,
    findings,
  })
}
