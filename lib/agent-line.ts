/**
 * AI Agent ↔ LINE bridge for the coach (Howard).
 *
 * Phase 2a: When admin LINE messages the bot, route to agent runner.
 * Agent reply + pending proposal preview + quick reply buttons all
 * sent back to admin LINE.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { replyMessage, pushMessage } from '@/lib/line'
import { runAgent } from '@/lib/agent-runner'
import { createServiceSupabase } from '@/lib/supabase'

async function dbg(action: string, error?: string) {
  try {
    await createServiceSupabase().from('line_webhook_debug_log').insert({
      user_id: 'agent_line',
      event_type: 'agent_step',
      action_taken: action,
      error_msg: error ?? null,
    })
  } catch {}
}

const ADMIN_DEFAULT_CONTEXT = '陳胤豪 (client_id=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4)'

const MAX_TEXT_CHARS = 4800  // LINE 上限 5000，留一些 buffer

function chunkText(text: string, maxLen = MAX_TEXT_CHARS): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    // 找最後一個換行
    let splitAt = remaining.lastIndexOf('\n', maxLen)
    if (splitAt < maxLen / 2) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }
  if (remaining.length > 0) chunks.push(remaining)
  return chunks
}

// TODO (Phase 2c): 學員端 handleClientAgentMessage 要檢查
//   - client.subscription_tier === 'protocol' (4999)
//   - client.ai_agent_enabled === true
//   - 每日呼叫上限 (rate limit by client_id)
// 目前只有 admin（Howard）走這條，不需要 tier check。
export async function handleAdminAgentMessage(
  event: { replyToken: string; message?: { text?: string } },
  supabase: SupabaseClient,
) {
  await dbg('handler_entry')
  const userText = event.message?.text?.trim() ?? ''
  if (!userText) { await dbg('empty_text_skip'); return }

  // Pre-route：admin 用快速指令時不走 AI
  if (/^(list|proposals|待審|清單)$/i.test(userText)) {
    await listPendingProposalsToAdmin(event.replyToken, supabase)
    return
  }

  const startMs = Date.now()

  try {
    await dbg('runAgent_start')
    const result = await runAgent({
      userMessage: userText,
      contextHint: `(教練端 LINE 對話)\n${ADMIN_DEFAULT_CONTEXT}`,
      maxTurns: 6,
    })
    const elapsedSec = (Date.now() - startMs) / 1000
    await dbg('runAgent_done', `text_len=${result.finalText.length} toolCalls=${result.toolCalls.length} elapsed=${elapsedSec.toFixed(1)}s`)

    // 組裝所有要送的訊息（為了省 push 配額：所有訊息打包成 1 次 LINE call）
    const messages: any[] = []

    // 1. AI 回應本文（chunk）— append 成本到最後一則
    const cost = ((result.totalTokens.input * 3 + result.totalTokens.output * 15) / 1_000_000 * 32).toFixed(2)
    const textChunks = chunkText(result.finalText + `\n\n— — — — — —\n🔧 ${result.toolCalls.length} tools · NT$${cost}`)
    for (const chunk of textChunks) {
      messages.push({ type: 'text', text: chunk })
    }

    // 2. 如果有新建立的 proposal，附審核 quick reply
    const createdProposals = result.toolCalls
      .filter(tc => tc.name === 'propose_macro_adjustment' && tc.result?.success && tc.result?.proposal_id)
      .map(tc => tc.result.proposal_id as string)

    for (const proposalId of createdProposals) {
      const { data: proposal } = await supabase
        .from('pending_proposals')
        .select('id, current_state, proposed_changes, reasoning, safety_check_result')
        .eq('id', proposalId)
        .maybeSingle()
      if (!proposal) continue
      const summary = formatProposalSummary(proposal)
      messages.push({
        type: 'text',
        text: `📋 提案待審 ${proposalId.slice(0, 8)}\n\n${summary}`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'postback', label: '✓ 核准套用', data: `agent_proposal:approve:${proposalId}`, displayText: `核准 ${proposalId.slice(0, 8)}` } },
            { type: 'action', action: { type: 'postback', label: '✗ 拒絕', data: `agent_proposal:reject:${proposalId}`, displayText: `拒絕 ${proposalId.slice(0, 8)}` } },
            { type: 'action', action: { type: 'postback', label: '💬 再聊', data: `agent_proposal:discuss:${proposalId}`, displayText: `再聊 ${proposalId.slice(0, 8)}` } },
          ],
        },
      })
    }

    // LINE 一次最多 5 則
    const toSend = messages.slice(0, 5)

    // 優先用 replyMessage（免費），超時 fallback pushMessage（1 次扣 1 額度）
    let usedReply = false
    if (elapsedSec < 50) {
      try {
        await replyMessage(event.replyToken, toSend)
        usedReply = true
        await dbg('reply_ok', `messages=${toSend.length} sec=${elapsedSec.toFixed(1)}`)
      } catch (e) {
        await dbg('reply_fail_fallback_push', (e as Error).message)
      }
    }

    if (!usedReply) {
      const adminLineId = process.env.ADMIN_LINE_USER_ID
      if (!adminLineId) { await dbg('admin_env_missing'); return }
      try {
        await pushMessage(adminLineId, toSend)
        await dbg('push_fallback_ok', `messages=${toSend.length}`)
      } catch (e) {
        await dbg('push_fallback_fail', (e as Error).message)
      }
    }
  } catch (err) {
    const msg = (err as Error).message || 'unknown'
    await dbg('agent_exception', msg)
    // 嘗試用 replyToken 報錯（free），用過就算了
    try {
      await replyMessage(event.replyToken, [{ type: 'text', text: '❌ AI 處理失敗: ' + msg.slice(0, 200) }])
    } catch {}
  }
}

function formatProposalSummary(p: any): string {
  const cur = p.current_state ?? {}
  const ch = p.proposed_changes ?? {}
  const lines: string[] = []
  const fmt = (label: string, key: string, unit = '') => {
    if (ch[key] != null) lines.push(`${label}: ${cur[key] ?? '-'} → ${ch[key]} ${unit}`.trim())
  }
  fmt('熱量', 'calories_target', 'kcal')
  fmt('蛋白', 'protein_target', 'g')
  fmt('碳水', 'carbs_target', 'g')
  fmt('脂肪', 'fat_target', 'g')
  fmt('訓練日碳', 'carbs_training_day', 'g')
  fmt('非訓碳', 'carbs_rest_day', 'g')
  fmt('Cardio', 'cardio_minutes_per_day', 'min/天')

  let summary = lines.join('\n')
  if (p.reasoning) summary += `\n\n📝 理由：\n${p.reasoning.slice(0, 600)}`
  if (p.safety_check_result?.warnings?.length > 0) {
    summary += `\n\n⚠️ ${p.safety_check_result.warnings.join('；')}`
  }
  return summary
}

async function listPendingProposalsToAdmin(replyToken: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from('pending_proposals')
    .select('id, proposed_at, current_state, proposed_changes, reasoning, clients(name)')
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: '✅ 沒有 pending 提案' }])
    return
  }

  const text = data.map((p: any) => {
    const name = p.clients?.name ?? p.client_id?.slice(0, 8)
    const cur = p.current_state ?? {}
    const ch = p.proposed_changes ?? {}
    const calLine = ch.calories_target != null ? `${cur.calories_target}→${ch.calories_target}kcal` : ''
    return `· ${p.id.slice(0, 8)} ${name} · ${calLine}\n  ${p.reasoning.slice(0, 80)}...`
  }).join('\n\n')

  await replyMessage(replyToken, [{ type: 'text', text: `📋 Pending 提案 (${data.length}):\n\n${text}` }])
}

export async function handleAgentProposalPostback(
  postbackData: string,
  replyToken: string,
  supabase: SupabaseClient,
  callerUserId?: string,  // 新增：呼叫者 LINE userId 用於驗證
) {
  // format: agent_proposal:approve|reject|discuss:UUID
  const parts = postbackData.split(':')
  if (parts.length !== 3 || parts[0] !== 'agent_proposal') return false

  // 修 MEDIUM：驗證呼叫者是 admin（單教練 SaaS 階段）
  // 多教練階段要改成「驗證該教練是否負責此 client_id」
  const adminLineId = process.env.ADMIN_LINE_USER_ID
  if (callerUserId && adminLineId && callerUserId !== adminLineId) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ 你沒有權限處理此提案' }])
    return true
  }

  const action = parts[1] as 'approve' | 'reject' | 'discuss'
  const proposalId = parts[2]

  const { data: proposal, error: fetchErr } = await supabase
    .from('pending_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle()

  if (fetchErr || !proposal) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ 找不到提案' }])
    return true
  }
  if (proposal.status !== 'pending') {
    await replyMessage(replyToken, [{ type: 'text', text: `提案已是 ${proposal.status} 狀態，無法再處理` }])
    return true
  }

  const now = new Date().toISOString()

  if (action === 'reject' || action === 'discuss') {
    const newStatus = action === 'reject' ? 'rejected' : 'discussing'
    await supabase
      .from('pending_proposals')
      .update({ status: newStatus, reviewed_by: 'coach_line', reviewed_at: now })
      .eq('id', proposalId)
    await replyMessage(replyToken, [
      { type: 'text', text: action === 'reject' ? '✗ 已拒絕，不套用' : '💬 標記為討論中，請繼續對話' },
    ])
    return true
  }

  // approve
  const changes = (proposal.proposed_changes ?? {}) as Record<string, number>
  const clientUpdates: Record<string, any> = { last_auto_adjust_at: now }
  const macroFields = ['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day', 'cardio_minutes_per_day']
  for (const f of macroFields) if (changes[f] != null) clientUpdates[f] = changes[f]

  if (Object.keys(clientUpdates).length > 1) {
    const { error: updErr } = await supabase.from('clients').update(clientUpdates).eq('id', proposal.client_id)
    if (updErr) {
      await replyMessage(replyToken, [{ type: 'text', text: '❌ DB 更新失敗: ' + updErr.message }])
      return true
    }
  }

  const { data: logRow } = await supabase
    .from('macro_adjustment_log')
    .insert({
      client_id: proposal.client_id,
      applied_by: 'coach',
      trigger_source: 'manual',
      old_macros: proposal.current_state,
      new_macros: proposal.proposed_changes,
      reason: `AI 提案教練 LINE 核准：${proposal.reasoning}`,
      trajectory_data: { ai_proposal_id: proposal.id, source: 'line_quick_reply' },
    })
    .select()
    .single()

  await supabase
    .from('pending_proposals')
    .update({
      status: 'approved',
      reviewed_by: 'coach_line',
      reviewed_at: now,
      applied_log_id: logRow?.id ?? null,
    })
    .eq('id', proposalId)

  await replyMessage(replyToken, [{ type: 'text', text: '✓ 已核准 + 套用到 DB' }])
  return true
}

// ═══════════════════════════════════════
// Coach one-tap action postback (safety-blocked alert)
// ═══════════════════════════════════════

const COACH_ACTION_COOLDOWN_MS = 10 * 60 * 1000

function addDaysUTC(dateStr: string | null, days: number): string {
  const base = dateStr ? new Date(dateStr) : new Date()
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().split('T')[0]
}

/**
 * 教練在 LINE 收到「安全層擋住」alert 後，點 quick reply 按鈕的 postback handler。
 * 格式：coach_action:<action>:<clientId>
 *   actions: extend_target | ease_target | add_cardio | cancel
 */
export async function handleCoachActionPostback(
  postbackData: string,
  replyToken: string,
  supabase: SupabaseClient,
  callerUserId?: string,
): Promise<boolean> {
  const parts = postbackData.split(':')
  if (parts.length !== 3 || parts[0] !== 'coach_action') return false

  const adminLineId = process.env.ADMIN_LINE_USER_ID
  if (callerUserId && adminLineId && callerUserId !== adminLineId) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ 你沒有權限' }])
    return true
  }

  const action = parts[1] as 'extend_target' | 'ease_target' | 'add_cardio' | 'cancel' | 'nudge_weight' | 'force_recalc'
  const clientId = parts[2]

  if (action === 'cancel') {
    await replyMessage(replyToken, [{ type: 'text', text: '🛑 已忽略，請進後台 /admin/clients 手動處理' }])
    return true
  }

  if (action === 'nudge_weight') {
    const { data: c } = await supabase.from('clients').select('id, name, line_user_id').eq('id', clientId).maybeSingle()
    if (!c) {
      await replyMessage(replyToken, [{ type: 'text', text: '❌ 找不到學員' }])
      return true
    }
    if (!c.line_user_id) {
      await replyMessage(replyToken, [{ type: 'text', text: `⚠️ ${c.name} 還沒綁 LINE，無法推提醒` }])
      return true
    }
    await pushMessage(c.line_user_id, [{
      type: 'text',
      text: `Hi ${c.name}，我這邊看到你的體重紀錄不足 2 週，沒辦法幫你算趨勢。\n\n抓緊時間每天早上起床上完廁所量一下吧，連續一週就能開始調整營養素了 💪`,
    }]).catch(() => {})
    await replyMessage(replyToken, [{ type: 'text', text: `✓ 已推 ${c.name} 量體重提醒` }])
    return true
  }

  if (action === 'force_recalc') {
    // 直接打自家 trajectory-check endpoint：跑一次當前軌跡，推給 admin
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
    const secret = process.env.CRON_SECRET || ''
    try {
      const res = await fetch(`${site}/api/admin/trajectory-check?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      const j = await res.json()
      await replyMessage(replyToken, [{ type: 'text', text: `▶ 強制重算完成：${j.decision ?? 'unknown'}\n${j.reason ?? ''}\n\n（如果有結果會單獨推一則）` }])
    } catch (e) {
      await replyMessage(replyToken, [{ type: 'text', text: `❌ 重算失敗：${(e as Error).message}` }])
    }
    return true
  }

  // Cooldown / 防呆：10 分鐘內已有同類 coach_action 就拒絕重複
  const { data: recentLog } = await supabase
    .from('macro_adjustment_log')
    .select('id, created_at, trigger_source, reason')
    .eq('client_id', clientId)
    .eq('applied_by', 'coach_line_action')
    .gte('created_at', new Date(Date.now() - COACH_ACTION_COOLDOWN_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recentLog) {
    await replyMessage(replyToken, [{ type: 'text', text: '⏱ 10 分鐘內已處理過，避免重複套用。如需再調整請進後台' }])
    return true
  }

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('id, name, goal_type, target_weight, target_date, competition_date, cardio_minutes_per_day')
    .eq('id', clientId)
    .maybeSingle()
  if (cErr || !client) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ 找不到學員資料' }])
    return true
  }

  const updates: Record<string, any> = {}
  let summary = ''

  if (action === 'extend_target') {
    if (client.competition_date) {
      const newDate = addDaysUTC(client.competition_date, 14)
      updates.competition_date = newDate
      summary = `延比賽日：${client.competition_date} → ${newDate}（+14 天）`
    } else if (client.target_date) {
      const newDate = addDaysUTC(client.target_date, 14)
      updates.target_date = newDate
      summary = `延目標日：${client.target_date} → ${newDate}（+14 天）`
    } else {
      await replyMessage(replyToken, [{ type: 'text', text: '⚠️ 此學員未設定目標日，無法延' }])
      return true
    }
  } else if (action === 'ease_target') {
    if (client.target_weight == null) {
      await replyMessage(replyToken, [{ type: 'text', text: '⚠️ 此學員未設定 target_weight' }])
      return true
    }
    const goal = (client.goal_type || 'cut') as string
    // cut (要瘦): target 變重 = 容易；bulk (要壯): target 變輕 = 容易；recomp 預設往上 1 kg
    const delta = goal === 'bulk' ? -1 : 1
    const newWeight = Number(client.target_weight) + delta
    updates.target_weight = newWeight
    summary = `放鬆目標：target_weight ${client.target_weight} → ${newWeight} kg（${goal} 方向 ${delta > 0 ? '+' : ''}${delta}）`
  } else if (action === 'add_cardio') {
    const current = Number(client.cardio_minutes_per_day ?? 0)
    const next = Math.min(90, current + 30)
    if (next === current) {
      await replyMessage(replyToken, [{ type: 'text', text: '⚠️ Cardio 已達 90 min/天上限，無法再加' }])
      return true
    }
    updates.cardio_minutes_per_day = next
    summary = `加有氧：${current} → ${next} min/天`
  } else {
    return false
  }

  const { error: updErr } = await supabase.from('clients').update(updates).eq('id', clientId)
  if (updErr) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ DB 更新失敗: ' + updErr.message }])
    return true
  }

  await supabase.from('macro_adjustment_log').insert({
    client_id: clientId,
    applied_by: 'coach_line_action',
    trigger_source: 'safety_blocked_quick_reply',
    old_macros: {
      target_weight: client.target_weight,
      target_date: client.target_date,
      competition_date: client.competition_date,
      cardio_minutes_per_day: client.cardio_minutes_per_day,
    },
    new_macros: updates,
    reason: `教練 LINE 一鍵動作：${summary}`,
  })

  await replyMessage(replyToken, [{ type: 'text', text: `✓ ${client.name}：${summary}\n\n隔天 cron 會用新參數重算軌跡` }])
  return true
}
