import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { readFile } from 'fs/promises'
import path from 'path'

const supabase = createServiceSupabase()

// PDF 檔案對照表
const EBOOK_FILES: Record<string, string> = {
  'system-reboot-v1': 'system-reboot-v1.pdf',
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ebook_download_${ip}`, 10, 60_000)
  if (!allowed) {
    return createErrorResponse('下載過於頻繁，請稍後再試', 429)
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return createErrorResponse('缺少下載憑證', 400)
  }

  try {
    // 查詢購買紀錄
    const { data: purchase, error } = await supabase
      .from('ebook_purchases')
      .select('id, product_key, download_count, status')
      .eq('download_token', token)
      .eq('status', 'completed')
      .maybeSingle()

    if (error || !purchase) {
      return createErrorResponse('無效的下載連結，請確認已完成付款', 404)
    }

    // 防濫用：最多 20 次下載
    if (purchase.download_count >= 20) {
      return createErrorResponse('下載次數已達上限，如需協助請聯繫我們', 403)
    }

    // 使用條件更新防止併發請求繞過限制
    const { data: updated, error: updateError } = await supabase
      .from('ebook_purchases')
      .update({ download_count: purchase.download_count + 1 })
      .eq('id', purchase.id)
      .lt('download_count', 20)
      .select('id')

    if (updateError || !updated || updated.length === 0) {
      return createErrorResponse('下載次數已達上限，如需協助請聯繫我們', 403)
    }

    // 讀取 PDF 檔案
    const filename = EBOOK_FILES[purchase.product_key]
    if (!filename) {
      return createErrorResponse('電子書檔案不存在', 404)
    }

    const filePath = path.join(process.cwd(), 'data', 'ebooks', filename)
    const fileBuffer = await readFile(filePath)

    // 回傳 PDF
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Howard-Protocol-System-Reboot.pdf"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return createErrorResponse('下載失敗，請稍後再試', 500)
  }
}
