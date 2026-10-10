import type { SupabaseClient } from '@supabase/supabase-js'

export type CoachMacroOverride = {
  locked_at: string
  expires_at?: string | null
  locked_fields: string[]
  override_values?: Record<string, number | null>
  previous_values?: Record<string, number | null>
  reason?: string | null
}

export function isCoachOverrideExpired(override: CoachMacroOverride | null, now = new Date()): boolean {
  return !!override?.expires_at && new Date(override.expires_at).getTime() <= now.getTime()
}

/** Command only: the daily maintenance job and explicit nutrition POST share this.
 * Compare the stored override before clearing it, so a fresh coach setting wins.
 */
export async function restoreExpiredCoachOverride(
  supabase: SupabaseClient,
  clientId: string,
  override: CoachMacroOverride,
  now = new Date(),
): Promise<{ restored: boolean; values: Record<string, number>; error?: string }> {
  if (!isCoachOverrideExpired(override, now)) return { restored: false, values: {} }
  const values: Record<string, number> = {}
  const allowedFields = new Set(['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day'])
  for (const [key, value] of Object.entries(override.previous_values ?? {})) {
    if (allowedFields.has(key) && value != null && Number.isFinite(Number(value))) values[key] = Number(value)
  }
  const { data, error } = await supabase.from('clients')
    .update({ ...values, coach_macro_override: null })
    .eq('id', clientId)
    .eq('coach_macro_override', JSON.stringify(override))
    .select('id')
    .maybeSingle()
  if (error) return { restored: false, values: {}, error: error.message }
  if (!data) return { restored: false, values: {} }
  if (Object.keys(values).length) {
    const { error: logError } = await supabase.from('macro_adjustment_log').insert({
      client_id: clientId, applied_by: 'system', trigger_source: 'manual',
      old_macros: override.override_values ?? {}, new_macros: values,
      reason: `教練覆寫到期（${override.expires_at}），自動還原覆寫前的營養目標`,
    })
    if (logError) return { restored: true, values, error: `還原已完成，但調整紀錄儲存失敗：${logError.message}` }
  }
  return { restored: true, values }
}
