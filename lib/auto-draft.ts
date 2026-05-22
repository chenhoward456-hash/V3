/**
 * 自動 AI 草稿生成 — 學員上傳血檢後在背景觸發。
 *
 * 流程：
 *   1. 撈該學員近兩年 lab_results
 *   2. 跑 trend analyzer
 *   3. 呼叫 Claude 產 panel note 草稿
 *   4. 寫進 ai_draft_audit（source = 'auto_after_upload'）
 *   5. 若同 client + panel_date 已有未審 auto-draft → 標為 superseded
 *
 * 不會寫進 lab_panel_notes（教練按儲存後才會）
 */

import { createServiceSupabase } from './supabase'
import { analyzeLabs, type LabResultRow } from './lab-trend-analyzer'
import { generatePanelNoteDraft } from './lab-draft-engine'
import { pushMessage } from './line'

const supabase = createServiceSupabase()

/**
 * 推送 LINE 通知給教練（學員上傳完血檢 + AI 草稿生成完）
 * 環境變數 `COACH_LINE_USER_ID` 沒設就跳過、不報錯
 */
async function notifyCoachOnLine(opts: {
  clientName: string
  clientUniqueCode: string | null
  panelDate: string
  triggerLabCount: number
  findingsBriefTop: { testName: string; severity: string }[]
}): Promise<void> {
  const coachLineId = process.env.COACH_LINE_USER_ID
  if (!coachLineId) return  // 未設定就跳過

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
  const criticalNames = opts.findingsBriefTop
    .filter(f => f.severity === 'critical')
    .slice(0, 3)
    .map(f => f.testName)
    .join('、')
  const summary = criticalNames
    ? `⚠️ Critical: ${criticalNames}`
    : '✅ 無 critical / attention 警示'

  const text = [
    `🩸 ${opts.clientName} 上傳了 ${opts.triggerLabCount} 筆血檢`,
    `日期：${opts.panelDate}`,
    summary,
    '',
    'AI 草稿已自動生成，點下方連結審核 → 儲存：',
    `${siteUrl}/admin/ai-audit`,
  ].join('\n')

  try {
    await pushMessage(coachLineId, [{ type: 'text', text }])
  } catch (err) {
    console.error('[auto-draft] LINE push failed:', err)
  }
}

type ClientRow = {
  id: string
  name: string
  age: number | null
  gender: string | null
  client_mode: string | null
  subscription_tier: string | null
}

export interface AutoDraftJob {
  clientId: string   // internal UUID
  panelDate: string  // YYYY-MM-DD
  triggerLabCount: number  // 這次學員上傳了幾筆造成觸發
}

/**
 * 跑一次「為某 client 的某 panel_date 自動生草稿」。
 * 不會 throw — 任何錯誤都會 swallow + log，避免阻擋學員的上傳成功訊息。
 */
export async function runAutoDraft(job: AutoDraftJob): Promise<void> {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, age, gender, client_mode, subscription_tier')
      .eq('id', job.clientId)
      .maybeSingle<ClientRow>()

    if (!client) {
      console.warn('[auto-draft] client not found:', job.clientId)
      return
    }

    // 拉近 2 年 lab_results
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { data: labs, error: labsErr } = await supabase
      .from('lab_results')
      .select('test_name, value, unit, date, status')
      .eq('client_id', client.id)
      .gte('date', cutoffStr)
      .order('date', { ascending: true })

    if (labsErr || !labs || labs.length === 0) {
      console.warn('[auto-draft] no labs for', client.id, labsErr)
      return
    }

    const gender =
      client.gender === '男性' || client.gender === '女性' ? client.gender : undefined

    const findings = analyzeLabs(labs as LabResultRow[], { gender })
    if (findings.length === 0) {
      console.warn('[auto-draft] no findings — skip')
      return
    }

    const draft = await generatePanelNoteDraft({
      panelDate: job.panelDate,
      clientName: client.name ?? undefined,
      clientAge: client.age,
      clientGender: gender ?? null,
      clientMode: client.client_mode,
      subscriptionTier: client.subscription_tier,
      findings,
    })

    const findingsBrief = findings.slice(0, 12).map(f => ({
      testName: f.testName,
      severity: f.severity,
      trend: f.trend,
      latestValue: f.latestValue,
      changePercent: f.changePercent,
      label: f.autoLabel,
    }))

    // Insert new audit row
    const { data: inserted, error: insertErr } = await supabase
      .from('ai_draft_audit')
      .insert({
        client_id: client.id,
        panel_date: job.panelDate,
        client_mode: client.client_mode,
        findings_count: draft.findingsCount,
        findings_brief: findingsBrief,
        ai_summary: draft.summary,
        ai_priorities: draft.priorities,
        model_used: draft.modelUsed,
        source: 'auto_after_upload',
        trigger_lab_count: job.triggerLabCount,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[auto-draft] insert audit failed:', insertErr)
      return
    }

    // 把同 client + panel_date 之前未審的 auto-draft 標為 superseded
    await supabase
      .from('ai_draft_audit')
      .update({ superseded_by_id: inserted.id })
      .eq('client_id', client.id)
      .eq('panel_date', job.panelDate)
      .eq('source', 'auto_after_upload')
      .is('coach_saved_at', null)
      .is('superseded_by_id', null)
      .neq('id', inserted.id)

    // LINE 通知教練（學員 unique_code 之後另外查）
    const { data: clientCode } = await supabase
      .from('clients')
      .select('unique_code')
      .eq('id', client.id)
      .maybeSingle<{ unique_code: string | null }>()

    await notifyCoachOnLine({
      clientName: client.name ?? '(未知學員)',
      clientUniqueCode: clientCode?.unique_code ?? null,
      panelDate: job.panelDate,
      triggerLabCount: job.triggerLabCount,
      findingsBriefTop: findingsBrief.slice(0, 5),
    })
  } catch (err) {
    console.error('[auto-draft] exception:', err)
  }
}

/**
 * 批次觸發：學員一次上傳了多個日期 → 為每個 unique date 各生一份。
 * 全部 async fire-and-forget，不 await。
 */
export function fireAutoDraftsForDates(
  clientId: string,
  dateCountMap: Map<string, number>,
): void {
  // 使用 setImmediate / setTimeout 0 讓 HTTP response 可以先返回
  setTimeout(() => {
    for (const [date, count] of dateCountMap.entries()) {
      runAutoDraft({ clientId, panelDate: date, triggerLabCount: count }).catch(err => {
        console.error('[auto-draft] job error:', err)
      })
    }
  }, 0)
}
