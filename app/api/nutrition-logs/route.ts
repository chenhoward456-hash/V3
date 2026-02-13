import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, date, compliant, note } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    if (typeof compliant !== 'boolean') {
      return createErrorResponse('compliant 必須為布林值', 400)
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
      .upsert({
        client_id: client.id,
        date,
        compliant,
        note: note || null,
      }, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()

    if (nutritionError) {
      console.error('飲食紀錄 Upsert 錯誤:', nutritionError)
      return createErrorResponse('新增/更新飲食紀錄失敗', 500)
    }

    return createSuccessResponse(nutrition, '飲食紀錄已記錄')

  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
