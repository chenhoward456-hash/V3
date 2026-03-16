import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

// 驗證 admin session
function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

// GET: 取得單一學員（含 lab_results + supplements）
export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('id')
  if (!clientId) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*, lab_results(*), supplements(*)')
    .eq('id', clientId)
    .single()

  if (error) {
    console.error('[admin/clients GET] 載入失敗:', error)
    return NextResponse.json({ error: '載入失敗' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST: 新增學員
export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientData, labResults, supplements } = body

    // 白名單過濾：只允許合法欄位，防止注入 id 等內部欄位
    const ALLOWED_CREATE_FIELDS = [
      'unique_code', 'name', 'age', 'gender', 'status', 'expires_at', 'is_active', 'subscription_tier',
      'nutrition_enabled', 'supplement_enabled', 'wellness_enabled', 'training_enabled',
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled', 'simple_mode', 'client_mode',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary',
      'health_goals', 'quarterly_cycle_start',
      'gene_mthfr', 'gene_apoe', 'gene_depression_risk', 'gene_notes',
    ]
    const sanitizedClientData: Record<string, unknown> = {}
    if (clientData && typeof clientData === 'object') {
      for (const key of Object.keys(clientData)) {
        if (ALLOWED_CREATE_FIELDS.includes(key)) {
          sanitizedClientData[key] = clientData[key]
        }
      }
    }

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert(sanitizedClientData)
      .select()
      .single()

    if (clientError) {
      console.error('[admin/clients POST] 新增失敗:', clientError)
      return NextResponse.json({ error: '新增學員失敗' }, { status: 500 })
    }

    // 新增血檢（白名單過濾）
    const ALLOWED_LAB_FIELDS = ['test_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category']
    if (labResults?.length > 0) {
      const withId = labResults.map((r: Record<string, unknown>) => {
        const sanitized: Record<string, unknown> = { client_id: newClient.id }
        for (const key of Object.keys(r)) {
          if (ALLOWED_LAB_FIELDS.includes(key)) sanitized[key] = r[key]
        }
        return sanitized
      })
      const { error: labError } = await supabase.from('lab_results').insert(withId)
      if (labError) { console.error('[admin/clients POST] 血檢新增失敗:', labError) }
    }

    // 新增補品（白名單過濾）
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'frequency', 'notes', 'is_active', 'category']
    if (supplements?.length > 0) {
      const withId = supplements.map((s: Record<string, unknown>) => {
        const sanitized: Record<string, unknown> = { client_id: newClient.id }
        for (const key of Object.keys(s)) {
          if (ALLOWED_SUPP_FIELDS.includes(key)) sanitized[key] = s[key]
        }
        return sanitized
      })
      const { error: supError } = await supabase.from('supplements').insert(withId)
      if (supError) { console.error('[admin/clients POST] 補品新增失敗:', supError) }
    }

    return NextResponse.json({ success: true, id: newClient.id })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT: 更新學員
export async function PUT(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientId, clientData, labResults, supplements } = body

    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 白名單過濾 lab/supplement 欄位
    const ALLOWED_LAB_FIELDS = ['test_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category']
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'frequency', 'notes', 'is_active', 'category']

    function sanitizeFields(obj: Record<string, unknown>, allowedFields: string[]): Record<string, unknown> {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(obj)) {
        if (allowedFields.includes(key)) result[key] = obj[key]
      }
      return result
    }

    // 先更新血檢（會觸發 trigger 覆蓋 status）
    if (labResults) {
      for (const result of labResults) {
        const sanitized = sanitizeFields(result, ALLOWED_LAB_FIELDS)
        if (result.id) {
          const { error } = await supabase.from('lab_results').update(sanitized).eq('id', result.id).eq('client_id', clientId)
          if (error) console.error('[admin/clients PUT] 血檢更新失敗:', error)
        } else {
          const { error } = await supabase.from('lab_results').insert({ ...sanitized, client_id: clientId })
          if (error) console.error('[admin/clients PUT] 血檢新增失敗:', error)
        }
      }
    }

    // 再更新補品
    if (supplements) {
      for (const supplement of supplements) {
        const sanitized = sanitizeFields(supplement, ALLOWED_SUPP_FIELDS)
        if (supplement.id) {
          const { error } = await supabase.from('supplements').update(sanitized).eq('id', supplement.id).eq('client_id', clientId)
          if (error) console.error('[admin/clients PUT] 補品更新失敗:', error)
        } else {
          const { error } = await supabase.from('supplements').insert({ ...sanitized, client_id: clientId })
          if (error) console.error('[admin/clients PUT] 補品新增失敗:', error)
        }
      }
    }

    // 最後更新 client（教練設的 status 不會被 trigger 覆蓋）
    // 白名單過濾：只允許教練可修改的欄位，防止注入 id/unique_code 等不可變欄位
    const ALLOWED_CLIENT_FIELDS = [
      'name', 'age', 'gender', 'status', 'expires_at', 'is_active', 'subscription_tier',
      'nutrition_enabled', 'supplement_enabled', 'wellness_enabled', 'training_enabled',
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled', 'simple_mode', 'client_mode',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary',
      'health_goals', 'quarterly_cycle_start',
      'gene_mthfr', 'gene_apoe', 'gene_depression_risk', 'gene_notes',
    ]
    const sanitizedClientData: Record<string, unknown> = {}
    if (clientData && typeof clientData === 'object') {
      for (const key of Object.keys(clientData)) {
        if (ALLOWED_CLIENT_FIELDS.includes(key)) {
          sanitizedClientData[key] = clientData[key]
        }
      }
    }

    // 先更新主要欄位（不含 coach_macro_override，避免欄位不存在時整個更新失敗）
    const { error: clientError } = await supabase
      .from('clients')
      .update(sanitizedClientData)
      .eq('id', clientId)

    if (clientError) {
      console.error('[admin/clients PUT] 更新失敗:', clientError)
      return NextResponse.json({ error: '更新學員失敗' }, { status: 500 })
    }

    // 教練覆寫鎖定：如果教練修改了營養目標欄位，自動設定鎖定
    // 獨立更新 coach_macro_override，即使欄位不存在也不影響主要資料儲存
    try {
      const MACRO_FIELDS = ['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day']
      const changedMacroFields = MACRO_FIELDS.filter(f => f in sanitizedClientData && sanitizedClientData[f] != null)
      let overrideValue: Record<string, unknown> | null | undefined = undefined

      if (changedMacroFields.length > 0) {
        const { data: currentClient } = await supabase
          .from('clients')
          .select(MACRO_FIELDS.join(', '))
          .eq('id', clientId)
          .single()

        const cc = currentClient as Record<string, unknown> | null
        const actuallyChanged = cc
          ? changedMacroFields.filter(f => sanitizedClientData[f] !== cc[f])
          : changedMacroFields

        if (actuallyChanged.length > 0) {
          overrideValue = {
            locked_at: new Date().toISOString(),
            locked_fields: actuallyChanged,
            previous_values: cc
              ? Object.fromEntries(actuallyChanged.map(f => [f, cc[f]]))
              : {},
          }
        }
      }

      // 教練明確要求解鎖時
      if (clientData?.coach_macro_override === null) {
        overrideValue = null
      }

      if (overrideValue !== undefined) {
        const { error: overrideError } = await supabase
          .from('clients')
          .update({ coach_macro_override: overrideValue })
          .eq('id', clientId)
        if (overrideError) {
          console.warn('[admin/clients PUT] coach_macro_override 更新失敗（欄位可能不存在）:', overrideError.message)
        }
      }
    } catch (e) {
      console.warn('[admin/clients PUT] coach_macro_override 處理失敗:', e)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/clients PUT] 伺服器錯誤:', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// DELETE: 刪除學員
export async function DELETE(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('id')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 })
    }

    // 先刪除 subscription_purchases（沒有 ON DELETE CASCADE）
    const { error: purchaseError } = await supabase
      .from('subscription_purchases')
      .delete()
      .eq('client_id', clientId)

    if (purchaseError) {
      return NextResponse.json({ error: '刪除購買記錄失敗' }, { status: 500 })
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) {
      // 購買記錄已刪但客戶刪除失敗，記錄錯誤
      console.error('[admin/clients] 客戶刪除失敗，subscription_purchases 已刪除', { clientId, error })
      return NextResponse.json({ error: '刪除失敗，請聯繫技術支援' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
