import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// TEMP DIAGNOSTIC — remove after debugging client-diagnosis empty-result issue.
// Reports only non-secret diagnostics (key presence boolean, public URL host, row count).
export async function GET(_request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const host = url.replace(/^https?:\/\//, '').split('.')[0]
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const serviceKeyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length
  // first segment of a JWT-style key reveals alg/typ only (non-secret); the role
  // claim lives in the payload (2nd segment) — decode payload role only.
  let keyRole: string | null = null
  try {
    const payload = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').split('.')[1]
    if (payload) keyRole = JSON.parse(Buffer.from(payload, 'base64').toString()).role || null
  } catch {
    keyRole = 'unparseable'
  }
  let count: number | null = null
  let err: string | null = null
  try {
    const supabase = createServiceSupabase()
    const r = await supabase.from('clients').select('id', { count: 'exact', head: true })
    count = r.count ?? null
    if (r.error) err = r.error.message
  } catch (e) {
    err = (e as Error).message
  }
  return NextResponse.json({ host, hasServiceKey, serviceKeyLen, keyRole, clientsCount: count, err })
}
