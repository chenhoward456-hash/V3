import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 處理事件
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const downloadToken = crypto.randomUUID()

      const { error } = await supabase
        .from('ebook_purchases')
        .update({
          status: 'completed',
          stripe_payment_intent_id: session.payment_intent as string,
          download_token: downloadToken,
          completed_at: new Date().toISOString(),
        })
        .eq('stripe_session_id', session.id)

      if (error) {
        console.error('[webhook] DB update error:', error)
      } else {
        console.log(`[webhook] Purchase completed: ${session.id} → token: ${downloadToken}`)
      }
      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object
      await supabase
        .from('ebook_purchases')
        .update({ status: 'failed' })
        .eq('stripe_session_id', session.id)
      break
    }

    default:
      // 忽略其他事件
      break
  }

  return NextResponse.json({ received: true })
}
