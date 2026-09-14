/**
 * 教練在 LINE 上的「回一個字就做完」指令。
 *
 * ## 為什麼（2026-09-14）
 *
 * Howard：「我都懶得開後台」→ `pending_proposals` 10 筆躺兩週沒人處理、
 * `coach_messages` 9 月整月 0 則。系統算出來的東西沒有出口。
 * 晨報已經會**講**這些事（2026-09-13），但講完之後還是只能開後台才能動手。
 *
 * ## ⚠️ 為什麼不做成 agent 工具，而是擺在 agent 前面
 *
 * webhook 現在的行為是：**admin 的任何訊息都丟給 AI Agent**。
 * 那條路有兩個問題，剛好都是這裡不能忍的：
 *   1. **慢** —— agent 一輪 20-24 秒。「套用 Sean」是一個決定，不是一段對話。
 *   2. **不可預測** —— 這幾個指令會**寫學員的 macros**。走 LLM 意圖判斷，
 *      代價是某天它把「不要再幫他加碳水了」理解成 reject 指令。
 *
 * 所以這裡是**確定性的快速路徑**：只認嚴格格式，認不出來就回 false 原封不動交還給 agent。
 * 寧可漏判（行為跟今天一樣）也不要誤判（動到學員處方）。
 * 同一個原則見 `lib/line-nl-log.ts` 的熱量分類器與 `isCoachCommand`。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { replyMessage } from './line'
import {
  listActionableProposals, actOnProposal, describeProposal, isProposalExpired,
  type ProposalRow,
} from './proposal-actions'
import { handleNaturalLog, type LineClient } from './line-handlers'

export type CoachCommand =
  | { kind: 'list_proposals' }
  | { kind: 'approve'; name: string }
  | { kind: 'reject'; name: string }
  | { kind: 'proxy_log'; name: string; content: string }

/**
 * 這句話是不是教練指令？
 *
 * ⚠️ 嚴格到「整句就是指令」才算。`不要` 尤其危險 ——
 * 「不要再幫他加碳水了」如果被吃掉，會退掉一筆他其實想留的提案。
 * 所以動詞後面必須**剛好是一個已知學員名字**，不能有其他字。
 *
 * @param knownNames 目前有效提案的學員名字（呼叫端查 DB 給），不是全部學員
 */
/** 便宜的形狀檢查：連動詞都沒有就不用查 DB 了 */
export function looksLikeCoachCommand(text: string): boolean {
  const t = text.trim()
  return /^(提案|待辦|待審|有什麼等我)$/.test(t)
    || /^(套用|採用|同意|批准|不要|退掉|退回|拒絕)\s*\S/.test(t)
    || /^(代記|幫記)\s*\S/.test(t)
}

export function parseCoachCommand(text: string, knownNames: string[]): CoachCommand | null {
  const t = text.trim()

  if (/^(提案|待辦|待審|有什麼等我)$/.test(t)) return { kind: 'list_proposals' }

  // 代記：`代記 Eddie 85.2 早餐雞胸便當`
  //
  // ⚠️ 需要**明確的動詞**，不能只靠「名字開頭」。
  // 「Eddie 這週怎樣」「Eddie 的碳水改 250」都是以名字開頭卻完全不是要記錄的句子，
  // 少了動詞會把教練的問句寫成學員的紀錄（同 isCoachCommand 那道防線的理由）。
  const proxy = t.match(/^(?:代記|幫記)\s+(\S+)\s+([\s\S]+)$/)
  if (proxy) {
    const name = proxy[1].trim()
    const content = proxy[2].trim()
    if (content && knownNames.some(n => n && n === name)) {
      return { kind: 'proxy_log', name, content }
    }
    return null
  }

  const m = t.match(/^(套用|採用|同意|批准|不要|退掉|退回|拒絕)\s*(.+)$/)
  if (!m) return null

  const verb = m[1]
  const target = m[2].trim()
  // 名字要完全相符。`includes` 會讓「不要 Sean 的碳水改太多」也命中。
  if (!knownNames.some(n => n && n === target)) return null

  const approve = ['套用', '採用', '同意', '批准'].includes(verb)
  return approve ? { kind: 'approve', name: target } : { kind: 'reject', name: target }
}

/** 這筆提案在 LINE 上怎麼講 */
function proposalLine(p: ProposalRow, name: string): string {
  const age = Math.round((Date.now() - Date.parse(p.proposed_at)) / 86400000)
  return `• ${name}：${describeProposal(p)}（${age === 0 ? '今天' : `${age} 天前`}）`
}

/**
 * 跑教練指令。認不出來回 false，呼叫端原封不動繼續走原本的路（AI Agent）。
 */
export async function tryCoachCommand(
  replyToken: string,
  text: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  // 便宜的形狀檢查先做：不像指令就不要為了它打 DB。
  // 教練絕大多數訊息都是問句，會在這裡就回 false 交還給 agent。
  if (!looksLikeCoachCommand(text)) return false

  // ⚠️ 名字要對**全部在籍學員**解析，不是只對「有活提案的人」。
  // 只比對有提案的人的話，「套用 Sean」在他剛好沒提案時會整句掉給 agent ——
  // 教練得到的是一段 20 秒的 LLM 閒聊，而不是「Sean 沒有等你處理的提案」。
  // 認得出對象、但沒事可做，也是一個明確的答案。
  const { data: allClients } = await supabase
    .from('clients').select('id, name').eq('is_active', true)
  const nameOf: Record<string, string> = Object.fromEntries(
    ((allClients ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]),
  )

  const command = parseCoachCommand(text, Object.values(nameOf))
  if (!command) return false

  // ── 代記：把學員在私訊裡講的話，原句轉進他自己的紀錄 ──
  if (command.kind === 'proxy_log') {
    const targetId = Object.keys(nameOf).find(id => nameOf[id] === command.name)
    if (!targetId) {
      await replyMessage(replyToken, [{ type: 'text', text: `找不到學員「${command.name}」` }])
      return true
    }
    const { data: target } = await supabase
      .from('clients')
      .select('id, name, unique_code, protein_target, water_target, calories_target, subscription_tier, training_enabled, wellness_enabled, gender, lab_enabled')
      .eq('id', targetId)
      .maybeSingle<LineClient>()
    if (!target) {
      await replyMessage(replyToken, [{ type: 'text', text: `讀不到 ${command.name} 的資料` }])
      return true
    }
    const ok = await handleNaturalLog(replyToken, target, command.content, supabase, command.name)
    if (!ok) {
      await replyMessage(replyToken, [{
        type: 'text',
        text: `這句我讀不出可以記的東西：「${command.content}」\n`
          + '可以寫得像學員自己講的話，例如：代記 Eddie 早上量 85.2、午餐雞胸便當、練了推',
      }])
    }
    return true
  }

  const actionable = await listActionableProposals(supabase)

  if (command.kind === 'list_proposals') {
    if (actionable.length === 0) {
      await replyMessage(replyToken, [{ type: 'text', text: '沒有等你處理的提案 👍' }])
      return true
    }
    const byClient: Record<string, ProposalRow[]> = {}
    for (const p of actionable) (byClient[p.client_id] ||= []).push(p)
    const lines = ['📥 等你處理的提案：', '']
    for (const [cid, ps] of Object.entries(byClient)) {
      lines.push(proposalLine(ps[0], nameOf[cid] ?? '?'))
      if (ps.length > 1) lines.push(`   ⚠️ 這個人還有 ${ps.length - 1} 筆，要開後台逐筆看`)
    }
    lines.push('', '回「套用 <名字>」就改、「不要 <名字>」就退掉。')
    await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }])
    return true
  }

  const targetId = Object.keys(nameOf).find(id => nameOf[id] === command.name)
  const mine = actionable.filter(p => p.client_id === targetId)

  if (mine.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: `${command.name} 沒有等你處理的提案。` }])
    return true
  }

  // ⚠️ 一個人有多筆時不准用一個字決定 —— Sean 2026-09 那 10 筆的 current_state 全是同一個 2250，
  // 它們不是連續調整而是同一個決定被重算十次；連著套用兩筆＝疊加砍兩次。
  if (mine.length > 1 && command.kind === 'approve') {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `${command.name} 有 ${mine.length} 筆待處理提案，不能一個字全套用。\n\n`
        + `它們多半是同一個決定被重算很多次（每筆的起點都一樣），連著套用會疊加。\n`
        + `回「不要 ${command.name}」可以整批退掉讓引擎用新資料重算，或開後台逐筆看。`,
    }])
    return true
  }

  if (command.kind === 'reject') {
    let n = 0
    for (const p of mine) {
      const r = await actOnProposal(supabase, {
        proposalId: p.id, action: 'reject',
        reviewNote: 'LINE 晨報退掉', reviewedBy: 'coach',
      })
      if (r.ok) n++
    }
    await replyMessage(replyToken, [{
      type: 'text',
      text: `好，${command.name} 的 ${n} 筆提案退掉了。引擎會用新資料重算。`,
    }])
    return true
  }

  const p = mine[0]
  if (isProposalExpired(p)) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `${command.name} 這筆已經過有效期了，不讓一個字套用。\n`
        + `引擎當時看到的資料跟現在不一樣，直接套會用舊結論改今天的處方。\n`
        + `回「不要 ${command.name}」退掉讓它重算，或開後台確認後強制套用。`,
    }])
    return true
  }

  const result = await actOnProposal(supabase, {
    proposalId: p.id, action: 'approve',
    reviewNote: 'LINE 晨報一鍵套用', reviewedBy: 'coach',
  })

  await replyMessage(replyToken, [{
    type: 'text',
    text: result.ok
      ? `✅ ${command.name} 已套用：${describeProposal(p)}`
      : `套用失敗：${result.reason}`,
  }])
  return true
}
