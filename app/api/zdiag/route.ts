import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const FULL_COLS =
  'id, name, status, client_mode, goal_type, prep_phase, gender, age, diet_start_date, target_weight, body_fat_target, target_date, calories_target, protein_target, carbs_target, fat_target, coach_macro_override, auto_adjust_enabled, subscription_tier, is_active'

// TEMP DIAGNOSTIC — remove after debugging client-diagnosis empty-result issue.
export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get('name') || '陳胤豪').trim()
  const supabase = createServiceSupabase()
  const out: Record<string, unknown> = { name }

  // A) minimal id,name ilike (same shape as a working query)
  const a = await supabase.from('clients').select('id, name').ilike('name', `%${name}%`).limit(5)
  out.minimal = { rows: a.data?.map((r) => r.name) ?? null, err: a.error?.message ?? null }

  // B) full 20-column select ilike (what client-diagnosis actually runs)
  const b = await supabase.from('clients').select(FULL_COLS).ilike('name', `%${name}%`).limit(5)
  out.full = { count: b.data?.length ?? null, err: b.error?.message ?? null }

  // C) list a few names so we can see what the service client actually sees
  const c = await supabase.from('clients').select('name').limit(30)
  out.allNames = c.data?.map((r) => r.name) ?? null

  return NextResponse.json(out)
}
