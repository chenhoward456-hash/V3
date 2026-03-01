import { NextRequest, NextResponse } from 'next/server'
import { stripe, EBOOK_PRODUCTS } from '@/lib/stripe'
import { rateLimit, getClientIP, createErrorResponse } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Rate limit: 5 次 / 分鐘 / IP
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ebook_checkout_${ip}`, 5, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const { email, quizData } = await request.json()

    // 驗證 email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return createErrorResponse('請輸入有效的 Email', 400)
    }

    const product = EBOOK_PRODUCTS['system-reboot-v1']
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'

    // 建立 Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.amount, // TWD 是零位小數幣別
          },
          quantity: 1,
        },
      ],
      metadata: {
        product_key: 'system-reboot-v1',
        email,
      },
      success_url: `${origin}/diagnosis/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/diagnosis?step=3&cancelled=1`,
    })

    // 寫入 DB（pending 狀態）
    await supabase.from('ebook_purchases').insert({
      email,
      stripe_session_id: session.id,
      product_key: 'system-reboot-v1',
      amount: product.amount,
      currency: product.currency,
      status: 'pending',
      quiz_data: quizData || null,
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err: any) {
    console.error('[create-checkout] Error:', err?.message || err)
    return createErrorResponse('建立結帳失敗，請稍後再試', 500)
  }
}
