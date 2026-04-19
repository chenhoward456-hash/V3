import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Look up a client's email from their most recent completed subscription purchase.
 */
export async function getClientEmail(supabase: SupabaseClient, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from('subscription_purchases')
    .select('email')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.email || null
}
