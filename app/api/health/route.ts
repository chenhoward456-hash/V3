import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {}

  // 1. Database connection
  try {
    const supabase = createServiceSupabase()
    const { error } = await supabase.from('clients').select('id', { count: 'exact', head: true })
    checks.database = error ? { status: 'error', message: error.message } : { status: 'ok' }
  } catch (err) {
    checks.database = { status: 'error', message: (err as Error).message }
  }

  // 2. Required env vars (check existence, not values)
  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
  ]
  const missingEnvs = requiredEnvs.filter(key => !process.env[key])
  checks.environment = missingEnvs.length === 0
    ? { status: 'ok' }
    : { status: 'error', message: `Missing: ${missingEnvs.join(', ')}` }

  // 3. Overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok')

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 })
}
