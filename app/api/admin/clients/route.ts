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
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary',
    ]
    const sanitizedClientData: Record<string, any> = {}
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
      return NextResponse.json({ error: '新增學員失敗' }, { status: 500 })
    }

    // 新增血檢（白名單過濾）
    const ALLOWED_LAB_FIELDS = ['marker_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category']
    if (labResults?.length > 0) {
      const withId = labResults.map((r: any) => {
        const sanitized: Record<string, any> = { client_id: newClient.id }
        for (const key of Object.keys(r)) {
          if (ALLOWED_LAB_FIELDS.includes(key)) sanitized[key] = r[key]
        }
        return sanitized
      })
      const { error: labError } = await supabase.from('lab_results').insert(withId)
      if (labError) { /* error logged via response */ }
    }

    // 新增補品（白名單過濾）
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'frequency', 'notes', 'is_active', 'category']
    if (supplements?.length > 0) {
      const withId = supplements.map((s: any) => {
        const sanitized: Record<string, any> = { client_id: newClient.id }
        for (const key of Object.keys(s)) {
          if (ALLOWED_SUPP_FIELDS.includes(key)) sanitized[key] = s[key]
        }
        return sanitized
      })
      const { error: supError } = await supabase.from('supplements').insert(withId)
      if (supError) { /* error logged via response */ }
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
    const ALLOWED_LAB_FIELDS = ['marker_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category']
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'frequency', 'notes', 'is_active', 'category']

    function sanitizeFields(obj: any, allowedFields: string[]): Record<string, any> {
      const result: Record<string, any> = {}
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
          await supabase.from('lab_results').update(sanitized).eq('id', result.id).eq('client_id', clientId)
        } else {
          await supabase.from('lab_results').insert({ ...sanitized, client_id: clientId })
        }
      }
    }

    // 再更新補品
    if (supplements) {
      for (const supplement of supplements) {
        const sanitized = sanitizeFields(supplement, ALLOWED_SUPP_FIELDS)
        if (supplement.id) {
          await supabase.from('supplements').update(sanitized).eq('id', supplement.id).eq('client_id', clientId)
        } else {
          await supabase.from('supplements').insert({ ...sanitized, client_id: clientId })
        }
      }
    }

    // 最後更新 client（教練設的 status 不會被 trigger 覆蓋）
    // 白名單過濾：只允許教練可修改的欄位，防止注入 id/unique_code 等不可變欄位
    const ALLOWED_CLIENT_FIELDS = [
      'name', 'age', 'gender', 'status', 'expires_at', 'is_active', 'subscription_tier',
      'nutrition_enabled', 'supplement_enabled', 'wellness_enabled', 'training_enabled',
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary',
    ]
    const sanitizedClientData: Record<string, any> = {}
    if (clientData && typeof clientData === 'object') {
      for (const key of Object.keys(clientData)) {
        if (ALLOWED_CLIENT_FIELDS.includes(key)) {
          sanitizedClientData[key] = clientData[key]
        }
      }
    }

    const { error: clientError } = await supabase
      .from('clients')
      .update(sanitizedClientData)
      .eq('id', clientId)

    if (clientError) {
      return NextResponse.json({ error: '更新學員失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
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
    await supabase
      .from('subscription_purchases')
      .delete()
      .eq('client_id', clientId)

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) {
      return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
