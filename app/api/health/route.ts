import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-health')

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {}

  // 1. Database connection
  try {
    const supabase = createServiceSupabase()
    const { error } = await supabase.from('clients').select('id', { count: 'exact', head: true })
    // 稽核 S-14：公開端點不回 DB 錯誤原文，細節只進 log
    if (error) logger.error('health: database check failed', error)
    checks.database = error ? { status: 'error' } : { status: 'ok' }
  } catch (err) {
    logger.error('health: database check threw', err)
    checks.database = { status: 'error' }
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
  // 稽核 S-14：缺哪些 env 的名稱不對外，只寫 log
  if (missingEnvs.length > 0) logger.error('health: missing env vars', { missing: missingEnvs })
  checks.environment = missingEnvs.length === 0
    ? { status: 'ok' }
    : { status: 'error' }

  // 3. Overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok')

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 })
}
