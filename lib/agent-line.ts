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

  // 顯示「處理中」避免 LINE 等太久 timeout
  try {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '🧠 AI 思考中...（10-30 秒）' },
    ])
    await dbg('reply_thinking_ok')
  } catch (e) {
    await dbg('reply_thinking_fail', (e as Error).message)
  }

  try {
    await dbg('runAgent_start')
    const result = await runAgent({
      userMessage: userText,
      contextHint: `(教練端 LINE 對話)\n${ADMIN_DEFAULT_CONTEXT}`,
      maxTurns: 6,
    })
    await dbg('runAgent_done', `text_len=${result.finalText.length} toolCalls=${result.toolCalls.length}`)

    const adminLineId = process.env.ADMIN_LINE_USER_ID
    if (!adminLineId) {
      await dbg('admin_env_missing')
      return
    }

    // 1. AI 回應本文（chunk）
    const textChunks = chunkText(result.finalText)
    await dbg('push_text_start', `chunks=${textChunks.length}`)
    for (const chunk of textChunks) {
      try {
        await pushMessage(adminLineId, [{ type: 'text', text: chunk }])
      } catch (e) {
        await dbg('push_text_fail', (e as Error).message)
      }
    }
    await dbg('push_text_done')

    // 2. 如果有新建立的 proposal，後接審核 quick reply
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
      await pushMessage(adminLineId, [
        {
          type: 'text',
          text: `📋 提案待審 ${proposalId.slice(0, 8)}\n\n${summary}`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: { type: 'postback', label: '✓ 核准套用', data: `agent_proposal:approve:${proposalId}`, displayText: `核准提案 ${proposalId.slice(0, 8)}` },
              },
              {
                type: 'action',
                action: { type: 'postback', label: '✗ 拒絕', data: `agent_proposal:reject:${proposalId}`, displayText: `拒絕提案 ${proposalId.slice(0, 8)}` },
              },
              {
                type: 'action',
                action: { type: 'postback', label: '💬 再聊', data: `agent_proposal:discuss:${proposalId}`, displayText: `再討論 ${proposalId.slice(0, 8)}` },
              },
            ],
          },
        } as any,
      ]).catch(() => {})
    }

    // 3. 成本資訊（debug 用，production 可關掉）
    const cost = ((result.totalTokens.input * 3 + result.totalTokens.output * 15) / 1_000_000 * 32).toFixed(2)
    await pushMessage(adminLineId, [
      { type: 'text', text: `🔧 ${result.toolCalls.length} tool calls · in ${result.totalTokens.input}t / out ${result.totalTokens.output}t · NT$${cost}` },
    ]).catch(() => {})
  } catch (err) {
    const msg = (err as Error).message || 'unknown'
    await dbg('agent_exception', msg)
    const adminLineId = process.env.ADMIN_LINE_USER_ID
    if (adminLineId) {
      await pushMessage(adminLineId, [
        { type: 'text', text: '❌ AI 處理失敗: ' + msg.slice(0, 200) },
      ]).catch(() => {})
    }
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
) {
  // format: agent_proposal:approve|reject|discuss:UUID
  const parts = postbackData.split(':')
  if (parts.length !== 3 || parts[0] !== 'agent_proposal') return false

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
  const macroFields = ['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day']
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
