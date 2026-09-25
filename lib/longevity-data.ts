/**
 * 長壽透鏡的資料組裝（server 端共用）：教練版 /api/admin/longevity 和學員版 /api/longevity 都走這裡，
 * 避免兩邊各查一套、慢慢分岔。純讀取。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildHorsemen, strengthByMonth, gradeHypothesis, buildFitness, currentForCapacity, MARKERS,
  type LabPoint, type LabHypothesis, type FitnessRow, type DecathlonGoal,
} from '@/lib/longevity-lens'
import { getTaiwanDate } from '@/lib/date-utils'

export async function loadLongevity(supabase: SupabaseClient, clientDbId: string, gender?: string | null) {
  const [labs, weights, nutrition, training, wellness, sets, hyps, fitness, goals] = await Promise.all([
    supabase.from('lab_results').select('test_name, value, unit, date').eq('client_id', clientDbId).order('date'),
    supabase.from('body_composition').select('date, weight').eq('client_id', clientDbId).not('weight', 'is', null).order('date'),
    supabase.from('nutrition_logs').select('date, calories').eq('client_id', clientDbId).order('date'),
    supabase.from('training_logs').select('date, training_type').eq('client_id', clientDbId).order('date'),
    supabase.from('daily_wellness').select('date, sleep_quality').eq('client_id', clientDbId).order('date'),
    supabase.from('training_sets').select('date, exercise_name, weight, reps, is_main_lift').eq('client_id', clientDbId).eq('is_main_lift', true).order('date'),
    supabase.from('lab_hypotheses').select('*').eq('client_id', clientDbId).order('created_at', { ascending: false }),
    supabase.from('fitness_markers').select('id, kind, date, value, method, note').eq('client_id', clientDbId).order('date'),
    supabase.from('decathlon_goals').select('id, event, capacity, created_at').eq('client_id', clientDbId).order('created_at'),
  ])
  const firstError = [labs, weights, nutrition, training, wellness, sets, hyps, fitness, goals].find(r => r.error)?.error
  if (firstError) throw new Error(firstError.message)

  const labsByName: Record<string, LabPoint[]> = {}
  for (const l of labs.data ?? []) {
    if (l.value == null) continue
    ;(labsByName[l.test_name] ??= []).push({ date: l.date, value: Number(l.value), unit: l.unit })
  }
  const rows = {
    weights: weights.data ?? [],
    nutrition: nutrition.data ?? [],
    training: training.data ?? [],
    wellness: wellness.data ?? [],
  }
  const today = getTaiwanDate()

  const strength = strengthByMonth(sets.data ?? [])
  const fitnessViews = buildFitness((fitness.data ?? []) as FitnessRow[])

  return {
    today,
    horsemen: buildHorsemen(labsByName, rows, today, gender),
    strength,
    fitness: fitnessViews,
    decathlon: ((goals.data ?? []) as DecathlonGoal[]).map(g => ({ ...g, current: currentForCapacity(g.capacity, strength, fitnessViews) })),
    hypotheses: ((hyps.data ?? []) as LabHypothesis[]).map(h => ({ ...h, grade: gradeHypothesis(h, labsByName[h.marker] ?? [], today, gender) })),
    unmapped: Object.keys(labsByName).filter(n => !(n in MARKERS)),
  }
}
