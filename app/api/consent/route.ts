import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

const CURRENT_VERSIONS = {
  terms: 'v1.0',
  privacy: 'v1.0',
  health_disclaimer: 'v1.0',
}

// GET ?clientId=xxx — 查詢使用者是否同意當前版本所有條款
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Resolve unique_code → uuid
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let id = clientId
  if (!UUID_RE.test(clientId)) {
    const { data } = await supabase.from('clients').select('id').eq('unique_code', clientId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'client not found' }, { status: 404 })
    id = data.id
  }

  const { data: consents } = await supabase
    .from('user_consents')
    .select('consent_type, version, accepted_at')
    .eq('client_id', id)
    .order('accepted_at', { ascending: false })

  const latest: Record<string, string | null> = {}
  for (const c of (consents ?? [])) {
    if (!latest[c.consent_type]) latest[c.consent_type] = c.version
  }

  const status = {
    terms: latest['terms'] === CURRENT_VERSIONS.terms,
    privacy: latest['privacy'] === CURRENT_VERSIONS.privacy,
    health_disclaimer: latest['health_disclaimer'] === CURRENT_VERSIONS.health_disclaimer,
  }
  const allAccepted = status.terms && status.privacy && status.health_disclaimer

  return NextResponse.json({
    success: true,
    allAccepted,
    status,
    currentVersions: CURRENT_VERSIONS,
    history: consents ?? [],
  })
}

// POST body: { clientId, types: ['terms', 'privacy', 'health_disclaimer'] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, types } = body
    if (!clientId || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: 'clientId and types required' }, { status: 400 })
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let id = clientId
    let line_user_id: string | null = null
    if (!UUID_RE.test(clientId)) {
      const { data } = await supabase.from('clients').select('id, line_user_id').eq('unique_code', clientId).maybeSingle()
      if (!data) return NextResponse.json({ error: 'client not found' }, { status: 404 })
      id = data.id
      line_user_id = data.line_user_id
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ua = request.headers.get('user-agent') ?? null

    const inserts = types
      .filter((t: string) => t in CURRENT_VERSIONS)
      .map((t: string) => ({
        client_id: id,
        line_user_id,
        consent_type: t,
        version: CURRENT_VERSIONS[t as keyof typeof CURRENT_VERSIONS],
        ip_address: ip,
        user_agent: ua,
      }))

    if (inserts.length === 0) {
      return NextResponse.json({ error: 'invalid consent types' }, { status: 400 })
    }

    const { error } = await supabase.from('user_consents').insert(inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, recorded: inserts.length, versions: CURRENT_VERSIONS })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
