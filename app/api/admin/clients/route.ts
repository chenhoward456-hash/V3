import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'

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
    const { clientData, labResults, supplements, startingBody } = body

    // 白名單過濾：只允許合法欄位，防止注入 id 等內部欄位
    const ALLOWED_CREATE_FIELDS = [
      'unique_code', 'name', 'age', 'birth_year', 'gender', 'status', 'expires_at', 'is_active', 'subscription_tier',
      'nutrition_enabled', 'supplement_enabled', 'wellness_enabled', 'training_enabled',
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled', 'simple_mode', 'client_mode',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase', 'weigh_in_gap_hours',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day', 'cardio_minutes_per_day',
      'macro_bounds', 'auto_adjust_enabled', 'last_auto_adjust_at',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary', 'health_screening',
      'health_goals', 'quarterly_cycle_start',
      'gene_mthfr', 'gene_apoe', 'gene_depression_risk', 'gene_notes',
      'training_plan', 'training_experience',
      'coach_peak_week_plan', 'peak_week_history',
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
    const ALLOWED_LAB_FIELDS = ['test_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category', 'custom_advice', 'custom_target', 'coach_interpretation']
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
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'why', 'sort_order', 'started_at', 'archived_at', 'archive_reason', 'replaced_by_id', 'coach_rationale', 'mode_context']
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

    // 起始身體數據 → 寫一筆 body_composition（讓引擎拿得到 bodyWeight，建立後即可算 TDEE/營養素）
    if (startingBody && startingBody.weight != null) {
      const today = new Date().toISOString().split('T')[0]
      const { error: bodyError } = await supabase.from('body_composition').upsert({
        client_id: newClient.id,
        date: today,
        weight: startingBody.weight,
        height: startingBody.height ?? null,
        body_fat: startingBody.bodyFat ?? null,
      }, { onConflict: 'client_id,date' })
      if (bodyError) console.error('[admin/clients POST] 起始體組成寫入失敗:', bodyError)
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
    const { clientId, clientData, labResults, supplements, override_duration_days, override_reason, startingBody, lock_macros } = body

    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 白名單過濾 lab/supplement 欄位
    const ALLOWED_LAB_FIELDS = ['test_name', 'value', 'unit', 'date', 'status', 'reference_range', 'category', 'custom_advice', 'custom_target', 'coach_interpretation']
    const ALLOWED_SUPP_FIELDS = ['name', 'dosage', 'timing', 'why', 'sort_order', 'started_at', 'archived_at', 'archive_reason', 'replaced_by_id', 'coach_rationale', 'mode_context']

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

    // 起始身體數據 → upsert 今天的 body_composition（教練在後台補/改起始體重，引擎即可算 TDEE/營養素）
    if (startingBody && startingBody.weight != null) {
      const today = new Date().toISOString().split('T')[0]
      const { error: bodyError } = await supabase.from('body_composition').upsert({
        client_id: clientId,
        date: today,
        weight: startingBody.weight,
        height: startingBody.height ?? null,
        body_fat: startingBody.bodyFat ?? null,
      }, { onConflict: 'client_id,date' })
      if (bodyError) console.error('[admin/clients PUT] 起始體組成寫入失敗:', bodyError)
    }

    // 最後更新 client（教練設的 status 不會被 trigger 覆蓋）
    // 白名單過濾：只允許教練可修改的欄位，防止注入 id/unique_code 等不可變欄位
    const ALLOWED_CLIENT_FIELDS = [
      'name', 'age', 'birth_year', 'gender', 'status', 'expires_at', 'is_active', 'subscription_tier',
      'nutrition_enabled', 'supplement_enabled', 'wellness_enabled', 'training_enabled',
      'body_composition_enabled', 'lab_enabled', 'ai_chat_enabled', 'competition_enabled', 'health_mode_enabled', 'simple_mode', 'client_mode',
      'target_weight', 'body_fat_target', 'target_date', 'competition_date', 'prep_phase', 'weigh_in_gap_hours',
      'goal_type', 'activity_profile', 'diet_start_date',
      'calories_target', 'protein_target', 'carbs_target', 'fat_target', 'water_target',
      'carbs_training_day', 'carbs_rest_day', 'cardio_minutes_per_day',
      'macro_bounds', 'auto_adjust_enabled', 'last_auto_adjust_at',
      'next_checkup_date', 'coach_weekly_note', 'coach_summary', 'health_screening',
      'health_goals', 'quarterly_cycle_start',
      'gene_mthfr', 'gene_apoe', 'gene_depression_risk', 'gene_notes',
      'training_plan', 'training_experience',
      'coach_peak_week_plan', 'peak_week_history',
    ]
    const sanitizedClientData: Record<string, unknown> = {}
    if (clientData && typeof clientData === 'object') {
      for (const key of Object.keys(clientData)) {
        if (ALLOWED_CLIENT_FIELDS.includes(key)) {
          sanitizedClientData[key] = clientData[key]
        }
      }
    }

    // 升級偵測：更新前先讀舊 tier
    let oldTier: string | null = null
    if (sanitizedClientData.subscription_tier) {
      const { data: before } = await supabase
        .from('clients')
        .select('subscription_tier, line_user_id, name')
        .eq('id', clientId)
        .single()
      oldTier = before?.subscription_tier || null
    }

    // Audit gap fix：UPDATE 前先快照當前 macros（PUT 後對比要用）
    const MACRO_FIELDS = ['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day']
    const incomingMacroFields = MACRO_FIELDS.filter(f => f in sanitizedClientData && sanitizedClientData[f] != null)
    let preUpdateMacros: Record<string, unknown> | null = null
    if (incomingMacroFields.length > 0) {
      const { data: snap } = await supabase
        .from('clients')
        .select(MACRO_FIELDS.join(', '))
        .eq('id', clientId)
        .single()
      preUpdateMacros = (snap as Record<string, unknown> | null) ?? null
    }

    // 更新主要欄位
    const { error: clientError } = await supabase
      .from('clients')
      .update(sanitizedClientData)
      .eq('id', clientId)

    if (clientError) {
      console.error('[admin/clients PUT] 更新失敗:', clientError)
      return NextResponse.json({ error: '更新學員失敗' }, { status: 500 })
    }

    // 升級成功：發 LINE 歡迎訊息給客戶
    if (sanitizedClientData.subscription_tier && oldTier && sanitizedClientData.subscription_tier !== oldTier) {
      const { data: upgraded } = await supabase
        .from('clients')
        .select('line_user_id, name, subscription_tier')
        .eq('id', clientId)
        .single()

      if (upgraded?.line_user_id) {
        const tier = upgraded.subscription_tier
        const features = tier === 'coached'
          ? '🎉 你的教練方案已啟用！\n\n解鎖功能：\n' +
            '✅ 每日營養追蹤（碳水/蛋白質/脂肪）\n' +
            '✅ 訓練記錄 + 動作重量追蹤\n' +
            '✅ 每日身心狀態監測\n' +
            '✅ 補品服從追蹤\n' +
            '✅ AI 智能分析（每日 30 次）\n' +
            '✅ 血檢深度分析 + 飲食建議\n' +
            '✅ 教練每週審閱 + LINE 諮詢\n' +
            '✅ 碳循環自動調整\n' +
            '✅ 數據匯出（給 AI 討論）\n\n' +
            '從今天開始記錄吧 👇'
          : tier === 'self_managed'
          ? '🎉 自主管理方案已啟用！\n\n解鎖功能：\n' +
            '✅ 每日營養追蹤\n' +
            '✅ AI 自動分析（TDEE 校正 + Refeed 觸發）\n' +
            '✅ 訓練記錄\n' +
            '✅ 身心狀態監測\n' +
            '✅ 碳循環自動調整\n\n' +
            '從今天開始記錄吧 👇'
          : null

        if (features) {
          pushMessage(upgraded.line_user_id, [{ type: 'text', text: features }]).catch(() => {})
        }
      }
    }

    // 教練覆寫鎖定 + macro_adjustment_log audit（修 bug：對比 UPDATE 前快照而非後快照）
    try {
      let overrideValue: Record<string, unknown> | null | undefined = undefined

      // 用 UPDATE 前的快照對比，找出真正變動的 macro 欄位
      const actuallyChanged = preUpdateMacros
        ? incomingMacroFields.filter(f => {
            const oldV = preUpdateMacros![f]
            const newV = sanitizedClientData[f]
            // numeric comparison (string-stored numbers from supabase)
            return (oldV == null ? null : Number(oldV)) !== (newV == null ? null : Number(newV))
          })
        : incomingMacroFields

      if (actuallyChanged.length > 0 && preUpdateMacros) {
        // 1. 寫 macro_adjustment_log（修 audit gap：admin manual edit 也要進 log）
        const oldMacros: Record<string, number | null> = {}
        const newMacros: Record<string, number | null> = {}
        for (const f of MACRO_FIELDS) {
          const ov = preUpdateMacros[f]
          oldMacros[f] = ov != null ? Number(ov) : null
          const nv = sanitizedClientData[f]
          newMacros[f] = nv != null ? Number(nv) : (ov != null ? Number(ov) : null)
        }
        const { error: logErr } = await supabase.from('macro_adjustment_log').insert({
          client_id: clientId,
          applied_by: 'coach',
          trigger_source: 'manual',
          old_macros: oldMacros,
          new_macros: newMacros,
          reason: `教練後台手動編輯（admin UI）：${actuallyChanged.join('、')}`,
          trajectory_data: null,
          hit_boundary: false,
        })
        if (logErr) console.warn('[admin/clients PUT] macro_adjustment_log 寫入失敗:', logErr.message)

        // 2. 同步寫 last_auto_adjust_at（cooldown 邏輯需要）
        await supabase
          .from('clients')
          .update({ last_auto_adjust_at: new Date().toISOString() })
          .eq('id', clientId)

        // 3. 只有教練「明確要求鎖定」(lock_macros=true) 才建 override。
        //    預設不鎖 → 信任系統自動調整（有 stale/bounds/基因 安全層守著）。改 macro 仍會寫 log + cooldown。
        if (lock_macros === true) {
          overrideValue = {
            locked_at: new Date().toISOString(),
            expires_at: (typeof override_duration_days === 'number' && override_duration_days > 0)
              ? new Date(Date.now() + override_duration_days * 86400000).toISOString()
              : null,
            locked_fields: actuallyChanged,
            override_values: Object.fromEntries(
              actuallyChanged.map(f => [f, sanitizedClientData[f] ?? null])
            ),
            previous_values: Object.fromEntries(
              actuallyChanged.map(f => [f, preUpdateMacros![f]])
            ),
            reason: (typeof override_reason === 'string' && override_reason.trim())
              ? override_reason.trim()
              : null,
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
