import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('client-macro-adjust')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

const MACRO_FIELDS = ['calories_target', 'protein_target', 'carbs_target', 'fat_target'] as const
type MacroField = (typeof MACRO_FIELDS)[number]

/**
 * POST /api/client-macro-adjust
 * 賴助手「閉環執行」唯一的學員寫入口（教練兩步確認後才會打到這）。
 * body: { name, calories?, protein?, carbs?, fat?, reason }
 * 行為（鏡像 admin/clients PUT 的權威流程）：
 *   1. 依名字解析學員（須唯一）
 *   2. 更新 *_target
 *   3. 寫 macro_adjustment_log（applied_by=coach, trigger_source=manual）
 *   4. last_auto_adjust_at（cooldown）
 *   5. 設 coach_macro_override 鎖住變動欄位（教練刻意改→別讓引擎覆寫，見 macro-lock）
 * 認證：admin_session cookie（verifyCoachAuth）。
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null

    // 收集要改的 macro（只接受正數；key 用 calories/protein/carbs/fat）
    const changes: Partial<Record<MacroField, number>> = {}
    for (const f of MACRO_FIELDS) {
      const key = f.replace('_target', '') as 'calories' | 'protein' | 'carbs' | 'fat'
      const v = body[key]
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) changes[f] = Math.round(Number(v))
    }
    if (!Object.keys(changes).length) {
      return NextResponse.json({ error: '沒有要調整的 macro（calories/protein/carbs/fat 至少給一個正數）' }, { status: 400 })
    }

    const { data: matches, error: cErr } = await supabase
      .from('clients')
      .select('id, name, calories_target, protein_target, carbs_target, fat_target')
      .ilike('name', `%${name}%`)
      .limit(5)
    if (cErr) logger.warn('查 clients 失敗', { error: cErr })
    if (!matches || matches.length === 0) return NextResponse.json({ found: false, note: `找不到叫「${name}」的學員` })
    if (matches.length > 1) {
      return NextResponse.json({ found: false, ambiguous: true, candidates: matches.map((m) => m.name) })
    }
    const c = matches[0] as Record<string, unknown> & { id: string; name: string }

    // old / new 快照（全 4 欄，log 要完整）
    const oldMacros: Record<string, number | null> = {}
    const newMacros: Record<string, number | null> = {}
    for (const f of MACRO_FIELDS) {
      const ov = c[f]
      oldMacros[f] = ov != null ? Number(ov) : null
      newMacros[f] = changes[f] != null ? (changes[f] as number) : oldMacros[f]
    }
    const actuallyChanged = MACRO_FIELDS.filter((f) => oldMacros[f] !== newMacros[f])
    if (actuallyChanged.length === 0) {
      return NextResponse.json({ ok: true, name: c.name, changed: [], note: '數字跟現在一樣，沒改動', old: oldMacros, new: newMacros })
    }

    // 1. 更新 macros
    const { error: upErr } = await supabase.from('clients').update(changes).eq('id', c.id)
    if (upErr) return NextResponse.json({ error: '更新失敗：' + upErr.message }, { status: 500 })

    // 2. macro_adjustment_log（紅線：applied_by=coach、trigger_source=manual）
    const { error: logErr } = await supabase.from('macro_adjustment_log').insert({
      client_id: c.id,
      applied_by: 'coach',
      trigger_source: 'manual',
      old_macros: oldMacros,
      new_macros: newMacros,
      reason: reason ? `LINE 助手（教練核准）：${reason}` : 'LINE 助手（教練核准）手動調整',
      trajectory_data: null,
      hit_boundary: false,
    })
    if (logErr) logger.warn('macro_adjustment_log 寫入失敗', { error: logErr.message })

    // 3. cooldown 時間戳
    await supabase.from('clients').update({ last_auto_adjust_at: new Date().toISOString() }).eq('id', c.id)

    // 4. coach_macro_override：**預設不鎖**（Howard 決策：系統本來就自動調，應急改只是當下推一把、讓引擎繼續自動 tune）。
    //    只有明確 body.lock===true 才鎖住（停掉該生自動調整、定住數字直到手動解鎖）。
    let locked = false
    if (body.lock === true) {
      const overrideValue = {
        locked_at: new Date().toISOString(),
        expires_at: null,
        locked_fields: actuallyChanged,
        override_values: Object.fromEntries(actuallyChanged.map((f) => [f, newMacros[f]])),
        previous_values: Object.fromEntries(actuallyChanged.map((f) => [f, oldMacros[f]])),
        reason: reason ? `LINE 助手：${reason}` : 'LINE 助手手動調整',
      }
      const { error: ovErr } = await supabase.from('clients').update({ coach_macro_override: overrideValue }).eq('id', c.id)
      if (ovErr) logger.warn('coach_macro_override 更新失敗', { error: ovErr.message })
      else locked = true
    }

    return NextResponse.json({ ok: true, name: c.name, changed: actuallyChanged, old: oldMacros, new: newMacros, locked })
  } catch (error) {
    logger.warn('client-macro-adjust 失敗', { error })
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
