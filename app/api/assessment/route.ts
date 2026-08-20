import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { extractInBody, isUsable, type OcrFile } from '@/lib/inbody-ocr'
import { buildAssessmentReport, type ActivityLevel } from '@/lib/assessment-report'

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
 * **這支不寫入任何資料庫** —— 讀完就回傳，教練確認過再決定要不要存。
 * 體測報表含個資，在保存政策定案前不落地。
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  let body: {
    files?: OcrFile[]
    gender?: 'male' | 'female'
    age?: number
    activity?: ActivityLevel
    weeks?: number
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

  const report = buildAssessmentReport({
    reading,
    gender: body.gender ?? null,
    age: body.age ?? null,
    activity: body.activity ?? 'light',
    weeks: body.weeks,
  })

  return NextResponse.json({ success: true, reading, report })
}
