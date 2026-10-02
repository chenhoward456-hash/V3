import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { applyMedicationChange, resolveMedicationKey, MEDICATION_EFFECTS, type ClientMedication } from '@/lib/medication-effects'
import { getTaiwanDate } from '@/lib/date-utils'

const logger = createLogger('client-medication')
export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

/**
 * POST /api/client-medication（2026-10-03）
 * 賴助手寫學員用藥的入口（Howard 不開後台：在 LINE 說「A 酸停了」「XX 5/1 開始吃 A 酸」）。
 * body: { name, medication, action: 'start'|'stop', date?: 'YYYY-MM-DD'（預設今天） }
 * 寫 clients.medications（血檢顧問卡用它標出「藥造成的偏高」）。認證：admin_session cookie。
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const name = String(body.name || '').trim()
    const medication = String(body.medication || '').trim()
    const action = body.action === 'stop' ? 'stop' : body.action === 'start' ? 'start' : null
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : getTaiwanDate()
    if (!name || !medication || !action) return NextResponse.json({ error: '需要 name、medication、action（start/stop）' }, { status: 400 })

    const { data: matches } = await supabase.from('clients').select('id, name, medications').ilike('name', `%${name}%`).limit(5)
    if (!matches || matches.length === 0) return NextResponse.json({ found: false, note: `找不到叫「${name}」的學員` })
    if (matches.length > 1) return NextResponse.json({ found: false, ambiguous: true, candidates: matches.map(m => m.name) })
    const c = matches[0] as { id: string; name: string; medications: ClientMedication[] | null }

    const key = resolveMedicationKey(medication) ?? `other:${medication.slice(0, 40)}`
    const { medications, changed } = applyMedicationChange(c.medications, { action, key, name: medication, date })
    if (!changed) return NextResponse.json({ ok: false, client: c.name, note: `${c.name} 沒有在吃「${medication}」的紀錄，不用停` })

    const { error } = await supabase.from('clients').update({ medications }).eq('id', c.id)
    if (error) { logger.error('update medications failed', error); return NextResponse.json({ error: '寫入失敗' }, { status: 500 }) }
    const known = MEDICATION_EFFECTS[key]
    return NextResponse.json({
      ok: true, client: c.name, action, date, medications,
      affects: known ? known.markers : [],
      note: known ? `血檢判讀會把 ${known.markers.join('、')} 在服藥期間的偏高標成「藥造成的」` : '這個藥系統還沒有已知的血檢影響，只記錄不影響判讀',
    })
  } catch (err) {
    logger.error('client-medication error', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
