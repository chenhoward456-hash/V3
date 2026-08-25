import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { sanitizeTextField, validateNumericField, rateLimit, getClientIP } from '@/lib/auth-middleware'

const supabaseAdmin = createServiceSupabase()

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: unknown, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message })
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    const { data: nutrition, error: nutritionError } = await supabaseAdmin
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle()

    if (nutritionError) {
      return createErrorResponse('查詢飲食紀錄失敗', 500)
    }

    if (!nutrition) {
      return createSuccessResponse({
        client_id: client.id,
        date,
        compliant: null,
        note: null
      }, '當日飲食尚未記錄')
    }

    return createSuccessResponse(nutrition)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`nutrition:${ip}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })

  try {
    const body = await request.json()
    const { clientId, date, compliant, note, protein_grams, water_ml, carbs_grams, fat_grams, calories, sodium_mg } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    if (compliant !== null && typeof compliant !== 'boolean') {
      return createErrorResponse('compliant 必須為布林值或 null', 400)
    }

    // 驗證 protein_grams
    const proteinValidation = validateNumericField(protein_grams, 0, 1000, 'protein_grams')
    if (!proteinValidation.isValid) {
      return createErrorResponse(proteinValidation.error, 400)
    }

    // 驗證 water_ml
    const waterValidation = validateNumericField(water_ml, 0, 10000, 'water_ml')
    if (!waterValidation.isValid) {
      return createErrorResponse(waterValidation.error, 400)
    }

    // 驗證備賽巨量營養素欄位
    const carbsValidation = validateNumericField(carbs_grams, 0, 2000, 'carbs_grams')
    if (!carbsValidation.isValid) return createErrorResponse(carbsValidation.error, 400)

    const fatValidation = validateNumericField(fat_grams, 0, 500, 'fat_grams')
    if (!fatValidation.isValid) return createErrorResponse(fatValidation.error, 400)

    const caloriesValidation = validateNumericField(calories, 0, 10000, 'calories')
    if (!caloriesValidation.isValid) return createErrorResponse(caloriesValidation.error, 400)

    const sodiumValidation = validateNumericField(sodium_mg, 0, 15000, 'sodium_mg')
    if (!sodiumValidation.isValid) return createErrorResponse(sodiumValidation.error, 400)

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note)

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, is_active, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    if (client.is_active === false) {
      return createErrorResponse('帳號已暫停', 403)
    }
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('帳號已過期', 403)
    }

    const { data: nutrition, error: nutritionError } = await supabaseAdmin
      .from('nutrition_logs')
      .upsert({
        client_id: client.id,
        date,
        compliant,
        note: sanitizedNote,
        protein_grams: protein_grams ?? null,
        water_ml: water_ml ?? null,
        carbs_grams: carbs_grams ?? null,
        fat_grams: fat_grams ?? null,
        calories: calories ?? null,
        sodium_mg: sodium_mg ?? null,
      }, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()

    if (nutritionError) {
      return createErrorResponse('新增/更新飲食紀錄失敗', 500)
    }

    return createSuccessResponse(nutrition, '飲食紀錄已記錄')

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

/**
 * PATCH — 記錄「實際攝取」的巨量營養素，用來覆寫/累加當天 nutrition_logs。
 *
 * 為什麼要跟 POST 分開：POST 是 upsert 整列，沒帶到的欄位會被寫成 null——
 * 一旦「達標」按鈕照 macro 設定自動帶了目標值進 nutrition_logs（見 page.tsx onQuickNutrition），
 * 使用者若只想改碳水，用 POST 會把蛋白/脂肪/水/備註全清掉。
 * PATCH 只動有帶進來的欄位（其餘保留），讓「實秤」能安全覆寫「自動帶的目標值」。
 *
 * mode='set' → 把該欄位設成傳入值（拖進度條：今天吃到哪）
 * mode='add' → 在現有值上累加（+記一餐：把這餐的巨量加上去）
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`nutrition:${ip}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })

  try {
    const body = await request.json()
    const { clientId, date, mode } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }
    if (mode !== 'set' && mode !== 'add') {
      return createErrorResponse('mode 必須為 set 或 add', 400)
    }

    // 只處理實際攝取的巨量欄位；每個都選填，帶了才動
    const fieldSpecs: { key: 'protein_grams' | 'carbs_grams' | 'fat_grams' | 'calories' | 'water_ml'; max: number }[] = [
      { key: 'protein_grams', max: 1000 },
      { key: 'carbs_grams', max: 2000 },
      { key: 'fat_grams', max: 500 },
      { key: 'calories', max: 10000 },
      { key: 'water_ml', max: 10000 },
    ]

    const provided: Partial<Record<typeof fieldSpecs[number]['key'], number>> = {}
    for (const { key, max } of fieldSpecs) {
      const v = body[key]
      if (v === undefined || v === null) continue
      const validation = validateNumericField(v, 0, max, key)
      if (!validation.isValid) return createErrorResponse(validation.error, 400)
      provided[key] = Number(v)
    }

    if (Object.keys(provided).length === 0) {
      return createErrorResponse('沒有要更新的營養素欄位', 400)
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, is_active, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }
    if (client.is_active === false) {
      return createErrorResponse('帳號已暫停', 403)
    }
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('帳號已過期', 403)
    }

    // 讀現有列，決定要 update（保留未帶欄位）還是 insert
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('nutrition_logs')
      .select('id, protein_grams, carbs_grams, fat_grams, calories, water_ml')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle()

    if (existingError) {
      return createErrorResponse('查詢飲食紀錄失敗', 500)
    }

    // 只組出「有帶進來」的欄位；set=覆寫、add=在現有值上累加
    const patch: Record<string, number> = {}
    for (const [key, value] of Object.entries(provided)) {
      if (mode === 'add') {
        const prev = existing ? Number((existing as Record<string, unknown>)[key] ?? 0) : 0
        patch[key] = Math.round((prev + value) * 100) / 100
      } else {
        patch[key] = value
      }
    }

    let saved
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('nutrition_logs')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return createErrorResponse('更新飲食紀錄失敗', 500)
      saved = data
    } else {
      // ⚠️ 一定要顯式帶 compliant: null（2026-08-25 震宣案例）。
      //
      // `nutrition_logs.compliant` 的**資料庫預設值是 true**。這個 insert 分支原本
      // 只帶巨量欄位，於是每一筆從這條路徑新建的列都被記成「今天達標」——
      // 即使學員按的是「沒達標」（把巨量歸零）或只是拖了一下進度條。
      //
      // 震宣 8/25 09:20 的實際紀錄：四個巨量全 0、compliant = true。
      // 他一口食物都沒記，系統卻認定他達標。
      // 全庫掃出 10 筆這種列（跨 6 位學員），會直接灌水服從率並誤導引擎。
      //
      // compliant 是「學員自己回答有沒有做到」，只有他答了才該有值。
      // 沒答就是 null（不知道），不是 true。POST 那條本來就強制帶（見上面的驗證），
      // 破口只在這裡。
      const { data, error } = await supabaseAdmin
        .from('nutrition_logs')
        .insert({ client_id: client.id, date, compliant: null, ...patch })
        .select()
        .single()
      if (error) return createErrorResponse('新增飲食紀錄失敗', 500)
      saved = data
    }

    return createSuccessResponse(saved, '實際攝取已更新')

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
