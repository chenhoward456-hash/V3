import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { computeWeeklyCoachingDraft, type WCInput } from '@/lib/weekly-coaching'

export const dynamic = 'force-dynamic'

// GET /api/admin/weekly-coaching[?clientId=<uuid>]
// 每週教練佇列：對活躍學員即時草擬本週教練動作（不寫 DB，MVP read-only）
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const onlyClient = new URL(request.url).searchParams.get('clientId')
  const now = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD 台灣
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10)

  let clientQ = supabase
    .from('clients')
    .select('id, name, unique_code, line_user_id, goal_type, prep_phase, competition_date, competition_enabled, target_weight, calories_target, protein_target')
    .eq('is_active', true)
  if (onlyClient) clientQ = clientQ.eq('id', onlyClient)
  const { data: clients, error } = await clientQ
  if (error || !clients) return NextResponse.json({ error: '查詢學員失敗' }, { status: 500 })

  const ids = clients.map(c => c.id)
  if (ids.length === 0) return NextResponse.json({ drafts: [], generatedAt: now })

  // 批次撈近 21 天數據（一次查、依 client_id 分組，避免 N 次往返）
  const [bodyR, nutR, trnR, welR, labR, pushR] = await Promise.all([
    supabase.from('body_composition').select('client_id, date, weight, body_fat').in('client_id', ids).gte('date', since),
    supabase.from('nutrition_logs').select('client_id, date, compliant, calories, protein_grams').in('client_id', ids).gte('date', since),
    supabase.from('training_logs').select('client_id, date, training_type').in('client_id', ids).gte('date', since),
    supabase.from('daily_wellness').select('client_id, date, energy_level').in('client_id', ids).gte('date', since),
    supabase.from('lab_results').select('client_id, test_name, value, status, date').in('client_id', ids).gte('date', since),
    supabase.from('push_subscriptions').select('client_id').in('client_id', ids),
  ])
  const pushSet = new Set((pushR.data || []).map((r: { client_id: string }) => r.client_id))

  const group = <T extends { client_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows || []) { const a = m.get(r.client_id) || []; a.push(r); m.set(r.client_id, a) }
    return m
  }
  const bodyByC = group(bodyR.data), nutByC = group(nutR.data), trnByC = group(trnR.data), welByC = group(welR.data), labByC = group(labR.data)

  const drafts = clients.map(c => {
    const input: WCInput = {
      client: c,
      weights: (bodyByC.get(c.id) || []).map(r => ({ date: r.date, weight: r.weight, body_fat: r.body_fat })),
      nutrition: (nutByC.get(c.id) || []).map(r => ({ date: r.date, compliant: r.compliant, calories: r.calories, protein_grams: r.protein_grams })),
      training: (trnByC.get(c.id) || []).map(r => ({ date: r.date, training_type: r.training_type })),
      wellness: (welByC.get(c.id) || []).map(r => ({ date: r.date, energy_level: r.energy_level })),
      labs: (labByC.get(c.id) || []).map(r => ({ test_name: r.test_name, value: r.value, status: r.status, date: r.date })),
      now,
    }
    const draft = computeWeeklyCoachingDraft(input)
    return { clientId: c.id, name: c.name, uniqueCode: c.unique_code, hasPush: pushSet.has(c.id), hasLine: !!c.line_user_id, ...draft }
  })

  // 排序：需教練介入(問責/新血檢)在前，再來資料多的
  drafts.sort((a, b) => (Number(b.needsCoachReview) - Number(a.needsCoachReview)) || (b.dataDays - a.dataDays))

  return NextResponse.json({ drafts, generatedAt: now })
}
