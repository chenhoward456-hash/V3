import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { extractInBody, isUsable, type OcrFile } from '@/lib/inbody-ocr'
import { buildAssessmentReport, type ActivityLevel } from '@/lib/assessment-report'
import { createServiceSupabase } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // OCR 實測約 25 秒

/**
 * POST /api/assessment
 * 上傳 ACCUNIQ 體測報表照片 → OCR → 產出會員看得懂的報告內容。
 *
 * ⚠️ 只有教練能呼叫（要 admin session）。理由：
 * ①OCR 每次都花錢 ②報表上有會員的身分識別資訊
 * ③這是教練交付流程的一環，不是公開工具。
 *
 * 存的東西刻意最少（2026-08-21 決定）：**不存原始照片、不存報表上的 ID/姓名**，
 * 只存體組成數值與報告快照。這樣即使外洩也只是一組沒有身分的數字。
 * 存的理由是「三個月後能比對」—— 不存的話這份報告跟那張紙一樣，關掉就沒了。
 */
export async function POST(request: NextRequest) {
  const session = request.cookies.get('admin_session')?.value
  if (!session || !verifyAdminSession(session)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  let body: {
    files?: OcrFile[]
    gender?: 'male' | 'female'
    age?: number
    activity?: ActivityLevel
    weeks?: number
    /** 教練自己記的識別（暱稱／後四碼）。⚠️ 不要放真實姓名 */
    label?: string
    /** 複測：上一次報告的 token。有的話報告會多一段「上次到現在變了什麼」 */
    previousToken?: string
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }

  const files = body.files
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: '缺少照片' }, { status: 400 })
  }
  if (files.length > 3) {
    return NextResponse.json({ error: '一次最多 3 張' }, { status: 400 })
  }

  let reading
  try {
    reading = await extractInBody(files)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '報表讀取失敗' },
      { status: 422 },
    )
  }

  if (!isUsable(reading)) {
    return NextResponse.json({
      error: '這張讀不出體重，可能是角度或反光。換一張再試一次。',
      reading,
    }, { status: 422 })
  }

  // 複測：把上一次的讀數撈出來做比對。
  // ⚠️ 用「教練手上的舊連結」來識別同一個人，而不是存姓名 ——
  //    這樣既能追蹤變化，又不用在資料庫裡放身分資訊。
  let previous = null
  if (body.previousToken) {
    const supabase = createServiceSupabase()
    const { data: prev } = await supabase
      .from('assessments')
      .select('reading')
      .eq('token', body.previousToken)
      .maybeSingle<{ reading: typeof reading }>()
    previous = prev?.reading ?? null
  }

  const report = buildAssessmentReport({
    reading,
    gender: body.gender ?? null,
    age: body.age ?? null,
    activity: body.activity ?? 'light',
    weeks: body.weeks,
    previous,
  })

  // 存快照並產出給會員的連結。
  // ⚠️ 存 report 快照而不是每次重算：判讀邏輯之後會改，
  //    但會員手上那份連結看到的內容不該無聲變動。
  let token: string | null = null
  try {
    const supabase = createServiceSupabase()
    token = randomBytes(6).toString('base64url')   // 8 字元，不可猜
    const { error } = await supabase.from('assessments').insert({
      token,
      measured_at: reading.measured_at,
      label: typeof body.label === 'string' ? body.label.slice(0, 40) : null,
      reading,
      report,
      activity: body.activity ?? 'light',
    })
    if (error) { console.error('[assessment] 存檔失敗', error.message); token = null }
  } catch (e) {
    console.error('[assessment] 存檔例外', e)
    token = null   // 存不起來不影響教練當場講解
  }

  return NextResponse.json({ success: true, reading, report, token })
}
