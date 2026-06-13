import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
  sanitizeTextField,
} from '@/lib/auth-middleware'
import { sendRoutineReminder } from '@/lib/notify'

const supabase = createServiceSupabase()

// GET /api/lab-panel-notes?clientId=<unique_code>
// 學員可公開讀取自己的整組血檢解讀（與 lab-results GET 一致）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return createErrorResponse('缺少客戶 ID', 400)
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    const { data, error } = await supabase
      .from('lab_panel_notes')
      .select('*')
      .eq('client_id', client.id)
      .order('panel_date', { ascending: false })

    if (error) {
      console.error('[lab-panel-notes GET] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    return createSuccessResponse(data ?? [])
  } catch (err) {
    console.error('[lab-panel-notes GET] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

// PUT /api/lab-panel-notes
// body: { clientId, panelDate, summary, priorities, nextReviewDate }
// Upsert by (client_id, panel_date)
export async function PUT(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
    }

    const body = await request.json()
    const { clientId, panelDate, summary, priorities, nextReviewDate } = body

    if (!clientId || !panelDate) {
      return createErrorResponse('缺少 clientId 或 panelDate', 400)
    }

    // 找 internal client.id（接受 unique_code 或 UUID）
    let internalId: string | null = null
    const { data: byCode } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .maybeSingle()
    if (byCode?.id) {
      internalId = byCode.id
    } else {
      const { data: byId } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .maybeSingle()
      if (byId?.id) internalId = byId.id
    }
    if (!internalId) {
      return createErrorResponse('找不到客戶', 404)
    }

    const sanitizedSummary = sanitizeTextField(summary, 4000)
    const sanitizedPriorities = sanitizeTextField(priorities, 2000)
    const nextReview = nextReviewDate && /^\d{4}-\d{2}-\d{2}$/.test(nextReviewDate)
      ? nextReviewDate
      : null

    const { data, error } = await supabase
      .from('lab_panel_notes')
      .upsert(
        {
          client_id: internalId,
          panel_date: panelDate,
          summary: sanitizedSummary,
          priorities: sanitizedPriorities,
          next_review_date: nextReview,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,panel_date' }
      )
      .select()
      .single()

    if (error) {
      console.error('[lab-panel-notes PUT] error:', error)
      return createErrorResponse('儲存失敗', 500)
    }

    // Audit log：把這次教練儲存的版本記到最近一筆 ai_draft_audit（同 client + panel_date）
    // 若該 client+date 沒有 audit row（教練純手寫沒按過 AI 草稿），跳過
    supabase
      .from('ai_draft_audit')
      .select('id')
      .eq('client_id', internalId)
      .eq('panel_date', panelDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: latest }) => {
        if (!latest?.id) return
        supabase
          .from('ai_draft_audit')
          .update({
            coach_saved_summary: sanitizedSummary,
            coach_saved_priorities: sanitizedPriorities,
            coach_saved_at: new Date().toISOString(),
          })
          .eq('id', latest.id)
          .then(({ error: auditErr }) => {
            if (auditErr) console.error('[lab-panel-notes PUT] audit update error:', auditErr)
          })
      })

    // 學員 LINE 通知（fire-and-forget，不阻擋儲存 response）
    notifyLearnerOfPanelNote({
      panelNoteId: data.id,
      clientInternalId: internalId,
      panelDate,
      summary: sanitizedSummary || '',
      priorities: sanitizedPriorities || '',
    }).catch(err => console.error('[lab-panel-notes PUT] notify error:', err))

    return createSuccessResponse(data)
  } catch (err) {
    console.error('[lab-panel-notes PUT] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

/**
 * 學員 LINE 通知：教練儲存 panel note → 推學員 LINE
 * 防呆：
 *   - summary + priorities 都空 → 跳過
 *   - 學員沒綁 LINE → 跳過
 *   - 同一筆 5 分鐘內已通知過 → 跳過（debounce 連續微調）
 */
async function notifyLearnerOfPanelNote(opts: {
  panelNoteId: string
  clientInternalId: string
  panelDate: string
  summary: string
  priorities: string
}): Promise<void> {
  if (!opts.summary.trim() && !opts.priorities.trim()) {
    return  // 都空，沒值得通知的東西
  }

  // 撈 panel note 的 learner_notified_at + 學員資訊
  const [{ data: note }, { data: client }] = await Promise.all([
    supabase
      .from('lab_panel_notes')
      .select('learner_notified_at')
      .eq('id', opts.panelNoteId)
      .maybeSingle<{ learner_notified_at: string | null }>(),
    supabase
      .from('clients')
      .select('name, unique_code, line_user_id')
      .eq('id', opts.clientInternalId)
      .maybeSingle<{ name: string; unique_code: string; line_user_id: string | null }>(),
  ])

  if (!client) return

  // Debounce: 5 分鐘內已通知過就跳過
  if (note?.learner_notified_at) {
    const last = new Date(note.learner_notified_at).getTime()
    if (Date.now() - last < 5 * 60 * 1000) return
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
  const summaryPreview = opts.summary.trim().slice(0, 80).replace(/\n/g, ' ')
  const reportPath = `/c/${client.unique_code}/report`

  const lineText = [
    `💬 Howard 更新了你的健康報告`,
    `📅 血檢日期：${opts.panelDate}`,
    '',
    summaryPreview ? `${summaryPreview}${opts.summary.length > 80 ? '...' : ''}` : '',
    '',
    '點下方看完整報告：',
    `${siteUrl}${reportPath}`,
  ].filter(l => l !== undefined).join('\n')

  try {
    // Web Push 優先（學員不必綁 LINE 也收得到），無訂閱才 fallback LINE
    const result = await sendRoutineReminder(opts.clientInternalId, client.line_user_id ?? '', {
      title: '💬 你的健康報告更新了',
      body: summaryPreview ? `${summaryPreview}${opts.summary.length > 80 ? '…' : ''}` : `${opts.panelDate} 血檢已判讀，點開看`,
      lineText,
      url: reportPath,
    })
    // push 或 LINE 任一成功才標記已通知（失敗則下次存檔再試）
    if (result.success) {
      await supabase
        .from('lab_panel_notes')
        .update({ learner_notified_at: new Date().toISOString() })
        .eq('id', opts.panelNoteId)
    }
  } catch (err) {
    console.error('[lab-panel-notes] notify failed:', err)
  }
}

// DELETE /api/lab-panel-notes?clientId=<id|code>&panelDate=YYYY-MM-DD
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const panelDate = searchParams.get('panelDate')

    if (!clientId || !panelDate) {
      return createErrorResponse('缺少參數', 400)
    }

    let internalId: string | null = null
    const { data: byCode } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .maybeSingle()
    if (byCode?.id) internalId = byCode.id
    if (!internalId) {
      const { data: byId } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .maybeSingle()
      if (byId?.id) internalId = byId.id
    }
    if (!internalId) {
      return createErrorResponse('找不到客戶', 404)
    }

    const { error } = await supabase
      .from('lab_panel_notes')
      .delete()
      .eq('client_id', internalId)
      .eq('panel_date', panelDate)

    if (error) {
      return createErrorResponse('刪除失敗', 500)
    }

    return createSuccessResponse({ deleted: true })
  } catch (err) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
