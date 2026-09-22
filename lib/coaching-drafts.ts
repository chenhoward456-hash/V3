/**
 * coaching-drafts.ts —— 「本週該跟每個學員說什麼」的共用層
 *
 * ⚠️ 為什麼抽出來（2026-09-23）：
 *    產草稿與發送原本各自寫死在 `/api/admin/weekly-coaching` 與它的 `send/` 裡，
 *    唯一的入口是 /admin。而 /admin 正好是教練不會開的那一頁——
 *    production 實況：學員四個人天天在記（震宣 30 天記了 29 天飲食），
 *    `coach_messages` 最後一則停在 8/31，整整 23 天沒有任何人回應他們。
 *
 *    所以出口要搬到他本來就在看的地方（LINE）。
 *    這支跟 `lib/proposal-actions.ts` 是同一個模式：**共用給 /admin 與 LINE**。
 *
 * ⚠️ 合規、持久化、推播回填這三件事都留在這裡，不要讓呼叫端各寫一份——
 *    「先 insert 再推播」那條是踩過回歸 bug 才立的（推播跳了但儀表板查無此筆）。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeWeeklyCoachingDraft, type WCInput, type WeeklyCoachingDraft } from './weekly-coaching'
import { sendRoutineReminder } from './notify'
import { scanMedicalCompliance } from './compliance-scrub'
import { getTaiwanDate, taiwanDateAgo } from './date-utils'

/** 學員卡片是完整顯示，過長會吃滿首屏 */
export const MAX_MESSAGE_LEN = 1500

/** 產草稿時往回撈幾天 */
const WINDOW_DAYS = 21

export type CoachingDraft = WeeklyCoachingDraft & {
  clientId: string
  name: string
  uniqueCode: string
  hasPush: boolean
  hasLine: boolean
}

type ClientRow = {
  id: string
  name: string
  unique_code: string
  line_user_id: string | null
  [k: string]: unknown
}

function group<T extends { client_id: string }>(rows: T[] | null): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows || []) {
    const a = m.get(r.client_id) || []
    a.push(r)
    m.set(r.client_id, a)
  }
  return m
}

/**
 * 幫所有啟用中的學員各算一份本週草稿。
 *
 * @param onlyClientId 只算某一個（/admin 逐筆重算用）
 */
export async function buildCoachingDrafts(
  supabase: SupabaseClient,
  opts: { onlyClientId?: string | null } = {},
): Promise<CoachingDraft[]> {
  // ⚠️ 日期一律走台北時區。`since` 原本是 toISOString().slice(0,10)＝UTC，
  //    台灣凌晨 0–8 點會多撈一天（見 lib/date-utils 那段說明）。
  const now = getTaiwanDate()
  const since = taiwanDateAgo(WINDOW_DAYS)

  let clientQ = supabase
    .from('clients')
    .select('id, name, unique_code, line_user_id, goal_type, prep_phase, competition_date, competition_enabled, target_weight, calories_target, protein_target, fat_target, training_plan')
    .eq('is_active', true)
  if (opts.onlyClientId) clientQ = clientQ.eq('id', opts.onlyClientId)

  const { data: clients, error } = await clientQ
  if (error || !clients) throw new Error(error?.message || '查詢學員失敗')

  const ids = (clients as ClientRow[]).map((c) => c.id)
  if (ids.length === 0) return []

  // 批次撈：一次查、依 client_id 分組，避免 N 次往返
  const [bodyR, nutR, trnR, welR, labR, pushR, setsR, macroR] = await Promise.all([
    supabase.from('body_composition').select('client_id, date, weight, body_fat').in('client_id', ids).gte('date', since),
    supabase.from('nutrition_logs').select('client_id, date, compliant, calories, protein_grams, fat_grams').in('client_id', ids).gte('date', since),
    supabase.from('training_logs').select('client_id, date, training_type').in('client_id', ids).gte('date', since),
    supabase.from('daily_wellness').select('client_id, date, energy_level').in('client_id', ids).gte('date', since),
    supabase.from('lab_results').select('client_id, test_name, value, status, date').in('client_id', ids).gte('date', since),
    supabase.from('push_subscriptions').select('client_id').in('client_id', ids),
    // ⭐ 實際做的組數。⚠️ 覆蓋率很低（2026-09 只有林宥任 60%，其餘 0%），
    //    引擎那邊有 SET_LOG_MIN_DAYS 門檻擋著，低於門檻只會說「看不到你練了什麼」。
    supabase.from('training_sets').select('client_id, date, exercise_name').in('client_id', ids).gte('date', since),
    // 碳水回補期偵測：碳水被往上調之後那兩週的體重是水，不能拿來跟學員講趨勢
    supabase.from('macro_adjustment_log')
      .select('client_id, applied_at, old_macros, new_macros')
      .in('client_id', ids)
      .gte('applied_at', new Date(Date.now() - 60 * 86_400_000).toISOString()),
  ])

  const pushSet = new Set((pushR.data || []).map((r: { client_id: string }) => r.client_id))
  const bodyByC = group(bodyR.data), nutByC = group(nutR.data), trnByC = group(trnR.data)
  const welByC = group(welR.data), labByC = group(labR.data), macroByC = group(macroR.data)
  const setsByC = group(setsR.data)

  const drafts = (clients as ClientRow[]).map((c) => {
    const input: WCInput = {
      client: c as WCInput['client'],
      weights: (bodyByC.get(c.id) || []).map((r: any) => ({ date: r.date, weight: r.weight, body_fat: r.body_fat })),
      nutrition: (nutByC.get(c.id) || []).map((r: any) => ({ date: r.date, compliant: r.compliant, calories: r.calories, protein_grams: r.protein_grams, fat_grams: r.fat_grams })),
      training: (trnByC.get(c.id) || []).map((r: any) => ({ date: r.date, training_type: r.training_type })),
      wellness: (welByC.get(c.id) || []).map((r: any) => ({ date: r.date, energy_level: r.energy_level })),
      labs: (labByC.get(c.id) || []).map((r: any) => ({ test_name: r.test_name, value: r.value, status: r.status, date: r.date })),
      macroLog: (macroByC.get(c.id) || []).map((r: any) => ({ applied_at: r.applied_at, old_macros: r.old_macros, new_macros: r.new_macros })),
      trainingSets: (setsByC.get(c.id) || []).map((r: any) => ({ date: r.date, exercise_name: r.exercise_name })),
      trainingPlan: (c as any).training_plan ?? null,
      now,
    }
    return {
      clientId: c.id,
      name: c.name,
      uniqueCode: c.unique_code,
      hasPush: pushSet.has(c.id),
      hasLine: !!c.line_user_id,
      ...computeWeeklyCoachingDraft(input),
    }
  })

  // 需教練介入（問責／新血檢）在前，再來資料多的
  drafts.sort((a, b) => (Number(b.needsCoachReview) - Number(a.needsCoachReview)) || (b.dataDays - a.dataDays))
  return drafts
}

export type SendOutcome =
  | { ok: true; method: string; delivered: boolean }
  | { ok: false; status: number; error: string; compliance?: Array<{ term: string; reason: string }> }

/**
 * 發一則教練訊息給學員。
 *
 * 順序是有意的，不要改：
 *   ① 合規掃描（診斷/處方/疾病名一律擋在發送之前）
 *   ② 先寫進 `coach_messages` —— insert 失敗就不推播。
 *      ⚠️ 這條是踩過回歸 bug 立的：先推播後儲存會造成「通知跳了、
 *         學員點進去卻查無此筆」，比沒發還糟。
 *   ③ 推播（Web Push 優先、退 LINE）
 *   ④ 回填實際送達管道 —— 沒送成就記 skipped，別讓稽核以為送出去了
 */
export async function sendCoachMessage(
  supabase: SupabaseClient,
  args: { clientId: string; message: string; mode?: string },
): Promise<SendOutcome> {
  const { clientId, mode } = args
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return { ok: false, status: 400, error: '無效的 clientId' }
  }
  const cleanMsg = (args.message ?? '').trim()
  if (!cleanMsg) return { ok: false, status: 400, error: '缺少 message' }
  if (cleanMsg.length > MAX_MESSAGE_LEN) {
    return { ok: false, status: 400, error: `訊息過長（${cleanMsg.length}/${MAX_MESSAGE_LEN}）` }
  }

  // ① 醫療合規紅線：教練可手改草稿，發送前攔下診斷/處方/疾病名（V3 紅線）
  const hits = scanMedicalCompliance(cleanMsg)
  if (hits.length > 0) {
    return { ok: false, status: 422, error: '訊息含醫療合規紅線字，請改寫後再發', compliance: hits }
  }

  const { data: client } = await supabase
    .from('clients')
    .select('name, line_user_id, unique_code, is_active, expires_at')
    .eq('id', clientId)
    .maybeSingle<{ name: string; line_user_id: string | null; unique_code: string; is_active: boolean | null; expires_at: string | null }>()
  if (!client) return { ok: false, status: 404, error: '找不到學員' }
  if (client.is_active === false) return { ok: false, status: 409, error: '此學員已停用，不發送' }
  if (client.expires_at && new Date(client.expires_at) < new Date()) {
    return { ok: false, status: 409, error: '此學員已過期，不發送' }
  }

  const title = mode === 'accountability' ? '👋 Howard 找你回來' : '💬 Howard 的本週調整'
  const firstLine = cleanMsg.split('\n').find((l) => l.trim()) || '點開看本週調整'

  // ② 先持久化
  const { data: inserted, error: insertErr } = await supabase
    .from('coach_messages')
    .insert({
      client_id: clientId,
      title,
      body: cleanMsg,
      mode: mode === 'accountability' ? 'accountability' : 'adjust',
      sent_via: 'manual', // 先佔位，推播後回填實際管道
    })
    .select('id')
    .single<{ id: string }>()
  if (insertErr || !inserted) {
    console.error('[coaching-drafts] coach_messages insert 失敗', insertErr)
    return { ok: false, status: 500, error: '訊息儲存失敗，尚未發送，請重試' }
  }

  // ③ 推播
  const result = await sendRoutineReminder(clientId, client.line_user_id ?? '', {
    title,
    body: firstLine.slice(0, 80),
    lineText: cleanMsg,
    url: `/c/${client.unique_code}`, // 學員實際儀表板（/dashboard 不存在會 404）
  })

  // ④ 回填實際送達管道
  await supabase
    .from('coach_messages')
    .update({ sent_via: result.success ? result.method : 'skipped' })
    .eq('id', inserted.id)

  return { ok: true, method: result.method, delivered: result.success }
}
