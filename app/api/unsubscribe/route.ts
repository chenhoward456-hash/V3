import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

function verifyToken(clientId: string, token: string): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(clientId).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const token = searchParams.get('token')

  if (!clientId || !token) {
    return new NextResponse('缺少參數', { status: 400 })
  }

  if (!verifyToken(clientId, token)) {
    return new NextResponse('無效的連結', { status: 403 })
  }

  const { error } = await supabase
    .from('clients')
    .update({ email_newsletter_opt_in: false })
    .eq('unique_code', clientId)

  if (error) {
    return new NextResponse('取消訂閱失敗，請稍後再試', { status: 500 })
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>取消訂閱</title></head>
<body style="margin:0;padding:40px 20px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
  <div style="max-width:400px;margin:0 auto;background:white;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <p style="font-size:32px;margin:0 0 16px;">✅</p>
    <h1 style="font-size:20px;color:#1e3a5f;margin:0 0 8px;">已取消訂閱</h1>
    <p style="font-size:14px;color:#64748b;margin:0 0 24px;">你不會再收到每週電子報。</p>
    <a href="https://howard456.vercel.app" style="color:#2563eb;font-size:14px;text-decoration:none;">回到首頁 →</a>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
