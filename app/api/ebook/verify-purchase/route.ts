import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ebook_verify_${ip}`, 30, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁', 429)
  }

  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return createErrorResponse('缺少 session_id', 400)
  }

  try {
    // 先查 DB
    const { data: purchase } = await supabase
      .from('ebook_purchases')
      .select('status, download_token, email')
      .eq('stripe_session_id', sessionId)
      .single()

    if (!purchase) {
      return NextResponse.json({ purchased: false })
    }

    if (purchase.status === 'completed' && purchase.download_token) {
      return NextResponse.json({
        purchased: true,
        downloadToken: purchase.download_token,
        email: purchase.email,
      })
    }

    // status 還是 pending → 可能 webhook 延遲，直接問 Stripe
    if (purchase.status === 'pending') {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        if (session.payment_status === 'paid') {
          // Webhook 還沒到，我們自己更新
          const downloadToken = crypto.randomUUID()
          await supabase
            .from('ebook_purchases')
            .update({
              status: 'completed',
              stripe_payment_intent_id: session.payment_intent as string,
              download_token: downloadToken,
              completed_at: new Date().toISOString(),
            })
            .eq('stripe_session_id', sessionId)

          return NextResponse.json({
            purchased: true,
            downloadToken,
            email: purchase.email,
          })
        }
      } catch {
        // Stripe API 錯誤，回傳 pending
      }
    }

    return NextResponse.json({ purchased: false, status: purchase.status })
  } catch (err: any) {
    console.error('[verify-purchase] Error:', err?.message)
    return createErrorResponse('驗證失敗', 500)
  }
}
