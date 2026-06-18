import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('client-brief')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

const DAY_MS = 86400000

/**
 * GET /api/client-brief?name=Eddie
 * 給賴助手「代擬訊息」用：回傳單一學員的近況摘要，bot 端用它擬個人化訊息。
 * 認證：admin_session cookie（verifyCoachAuth）。SELECT-only。
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const name = (request.nextUrl.searchParams.get('name') || '').trim()
    if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })

    const { data: matches, error: cErr } = await supabase
      .from('clients')
      .select('id, name, status, goal_type, diet_start_date, subscription_tier, is_active, expires_at, target_weight')
      .ilike('name', `%${name}%`)
      .limit(5)
    if (cErr) logger.warn('查 clients 失敗', { error: cErr })

    if (!matches || matches.length === 0) {
      return NextResponse.json({ found: false, note: `找不到叫「${name}」的學員` })
    }
    if (matches.length > 1) {
      return NextResponse.json({ found: false, ambiguous: true, candidates: matches.map(m => m.name), note: '名字對到多人，請說更明確' })
    }
    const c = matches[0]
    const now = Date.now()
    const d21 = new Date(now - 21 * DAY_MS).toISOString().split('T')[0]
    const d10 = new Date(now - 10 * DAY_MS).toISOString().split('T')[0]
    const d90 = new Date(now - 90 * DAY_MS).toISOString().split('T')[0]

    const [bodyR, wellR, actB, actN, actW, actT] = await Promise.all([
      supabase.from('body_composition').select('date, weight').eq('client_id', c.id).gte('date', d21).not('weight', 'is', null).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('date, energy_level, device_recovery_score').eq('client_id', c.id).gte('date', d10).order('date', { ascending: true }),
      supabase.from('body_composition').select('date').eq('client_id', c.id).gte('date', d90),
      supabase.from('nutrition_logs').select('date').eq('client_id', c.id).gte('date', d90),
      supabase.from('daily_wellness').select('date').eq('client_id', c.id).gte('date', d90),
      supabase.from('training_logs').select('date').eq('client_id', c.id).gte('date', d90),
    ])

    const body = bodyR.data || []
    const latestWeight = body.length ? Number(body[body.length - 1].weight) : null
    const weight14 = body.filter(b => new Date(b.date).getTime() >= now - 14 * DAY_MS)
    const weightChange14 = weight14.length >= 2 ? +(Number(weight14[weight14.length - 1].weight) - Number(weight14[0].weight)).toFixed(1) : null

    const well = wellR.data || []
    const recentEnergies = well.slice(-7).map(w => w.energy_level).filter((e): e is number => e != null)
    const avgEnergy7 = recentEnergies.length ? +(recentEnergies.reduce((a, b) => a + b, 0) / recentEnergies.length).toFixed(1) : null
    const latestRecovery = [...well].reverse().find(w => w.device_recovery_score != null)?.device_recovery_score ?? null

    let lastActivity: string | null = null
    for (const arr of [actB.data, actN.data, actW.data, actT.data]) {
      for (const r of arr || []) if (!lastActivity || r.date > lastActivity) lastActivity = r.date as string
    }
    const daysSinceActivity = lastActivity ? Math.floor((now - new Date(lastActivity).getTime()) / DAY_MS) : null

    const gt = (c.goal_type || '').toLowerCase()
    const isFatLoss = gt.includes('loss') || gt === 'cut' || gt.includes('fat') || (c.goal_type || '').includes('減')
    const dietWeeks = c.diet_start_date ? Math.max(1, Math.floor((now - new Date(c.diet_start_date as string).getTime()) / (7 * DAY_MS))) : null

    return NextResponse.json({
      found: true,
      name: c.name,
      status: c.status,
      goal: c.goal_type,
      isFatLoss,
      dietWeeks,
      targetWeight: c.target_weight,
      latestWeight,
      weightChange14d: weightChange14,
      avgEnergy7d: avgEnergy7,
      latestRecovery,
      lastActivity,
      daysSinceActivity,
      subscriptionTier: c.subscription_tier,
      isActive: c.is_active,
    })
  } catch (error) {
    logger.warn('client-brief 失敗', { error })
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
