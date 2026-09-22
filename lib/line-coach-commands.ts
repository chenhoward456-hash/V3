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
import { buildCoachingDrafts, sendCoachMessage, type CoachingDraft } from './coaching-drafts'

export type CoachCommand =
  | { kind: 'list_proposals' }
  | { kind: 'list_messages' }
  | { kind: 'preview_message'; name: string }
  | { kind: 'send_message'; name: string }
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
    || /^(訊息|草稿|本週訊息)$/.test(t)
    || /^(訊息|草稿)\s*\S/.test(t)
    || /^(發|送|發送)\s*\S/.test(t)
}

export function parseCoachCommand(text: string, knownNames: string[]): CoachCommand | null {
  const t = text.trim()

  if (/^(提案|待辦|待審|有什麼等我)$/.test(t)) return { kind: 'list_proposals' }
  if (/^(訊息|草稿|本週訊息)$/.test(t)) return { kind: 'list_messages' }

  // 「訊息 震宣」看全文、「發 震宣」送出。
  // ⚠️ 名字一樣要**完全相符**，理由同下面那條：`發` 是不可逆的對外動作，
  //    寧可認不出來交還 AI Agent，也不要把「發現震宣這週掉太快」當成發送指令。
  const msgOne = t.match(/^(?:訊息|草稿)\s+(.+)$/)
  if (msgOne) {
    const name = msgOne[1].trim()
    return knownNames.some(n => n && n === name) ? { kind: 'preview_message', name } : null
  }
  const sendOne = t.match(/^(?:發|送|發送)\s+(.+)$/)
  if (sendOne) {
    const name = sendOne[1].trim()
    return knownNames.some(n => n && n === name) ? { kind: 'send_message', name } : null
  }

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

/** 一則草稿在 LINE 上怎麼攤開 */
function previewText(d: CoachingDraft): string {
  const parts = [`【${d.name}】${d.headline}`, `資料 ${d.dataDays} 天`]
  if (d.needsCoachReview) parts.push('⚠️ 引擎標了「要你看過」，不能用「發」一個字送出')
  if (d.bullets.length) parts.push('', '本週數據：', ...d.bullets.map((b) => `• ${b}`))
  if (d.adjustments.length) parts.push('', '建議調整：', ...d.adjustments.map((a) => `• ${a}`))
  if (d.flags.length) parts.push('', `旗標：${d.flags.join('、')}`)
  parts.push('', '────── 要發給他的原文 ──────', d.studentMessage)
  if (!d.needsCoachReview) parts.push('', `沒問題就打「發 ${d.name}」。`)
  return parts.join('\n')
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

  // ── 本週教練訊息：列出 / 看全文 / 送出 ──────────────────────────
  //
  // ⚠️ 這三個指令存在的理由：2026-09 查 production ——
  //    四個學員天天在記（震宣 30 天記了 29 天飲食），
  //    而 coach_messages 最後一則停在 8/31，23 天沒有人回應他們。
  //    引擎一直在算，唯一的出口是 /admin，而教練不開那一頁。
  //    所以出口搬到他本來就在看的地方。
  if (command.kind === 'list_messages') {
    const drafts = await buildCoachingDrafts(supabase)
    if (drafts.length === 0) {
      await replyMessage(replyToken, [{ type: 'text', text: '目前沒有在籍學員。' }])
      return true
    }
    const lines = drafts.map((d) => {
      const tag = d.needsCoachReview ? '⚠️ 要你看過 ' : ''
      return `• ${d.name}：${tag}${d.headline}（${d.dataDays} 天資料）`
    })
    await replyMessage(replyToken, [{
      type: 'text',
      text: `本週 ${drafts.length} 個人：\n\n${lines.join('\n')}\n\n`
        + `打「訊息 ${drafts[0].name}」看全文，看過再打「發 ${drafts[0].name}」送出。`,
    }])
    return true
  }

  if (command.kind === 'preview_message' || command.kind === 'send_message') {
    const cid = Object.keys(nameOf).find((id) => nameOf[id] === command.name)
    if (!cid) {
      await replyMessage(replyToken, [{ type: 'text', text: `找不到學員「${command.name}」` }])
      return true
    }
    const [draft] = await buildCoachingDrafts(supabase, { onlyClientId: cid })
    if (!draft) {
      await replyMessage(replyToken, [{ type: 'text', text: `算不出 ${command.name} 的草稿。` }])
      return true
    }

    if (command.kind === 'preview_message') {
      await replyMessage(replyToken, [{ type: 'text', text: previewText(draft) }])
      return true
    }

    // ⛔ 引擎自己標了「這個要人看」就不准一個字發送。
    //    needsCoachReview 會亮的情況包含：資料不足、變化速率離譜、有新血檢。
    //    那些正是最不該讓一句「發 X」自動送出去的。
    if (draft.needsCoachReview) {
      await replyMessage(replyToken, [{
        type: 'text',
        text: `⚠️ ${draft.name} 這則標了「要你看過」，不能一個字送出。\n\n`
          + `${draft.headline}\n\n`
          + `先打「訊息 ${draft.name}」看完整內容，要發的話去後台按，或改寫後再發。`,
      }])
      return true
    }

    const outcome = await sendCoachMessage(supabase, {
      clientId: cid,
      message: draft.studentMessage,
      mode: draft.mode,
    })
    if (!outcome.ok) {
      const extra = outcome.compliance?.length
        ? `\n\n命中：${outcome.compliance.map((c) => c.term).join('、')}`
        : ''
      await replyMessage(replyToken, [{ type: 'text', text: `沒發出去：${outcome.error}${extra}` }])
      return true
    }
    const via = outcome.delivered
      ? (outcome.method === 'web_push' ? '推播' : 'LINE')
      : '沒推成（他沒開推播也沒綁 LINE），但訊息已經存進他的儀表板'
    // ⚠️ 回覆帶上**實際送出去的全文**：一個字送出的東西，他要馬上看得到自己發了什麼。
    await replyMessage(replyToken, [{
      type: 'text',
      text: `已送給 ${draft.name}（${via}）\n\n────────\n${draft.studentMessage}`,
    }])
    return true
  }

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
