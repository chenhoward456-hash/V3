import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeTextField, validateNumericField } from '@/lib/auth-middleware'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: any, message?: string) {
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
  try {
    const body = await request.json()
    const { clientId, date, compliant, note, protein_grams, water_ml, carbs_grams, fat_grams, calories } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    if (typeof compliant !== 'boolean') {
      return createErrorResponse('compliant 必須為布林值', 400)
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

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note)

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
