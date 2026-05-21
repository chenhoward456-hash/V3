import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
  sanitizeTextField,
} from '@/lib/auth-middleware'

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

    return createSuccessResponse(data)
  } catch (err) {
    console.error('[lab-panel-notes PUT] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
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
