import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendNewsletterEmail } from '@/lib/email'
import { getClientEmail } from '@/lib/get-client-email'
import { createServiceSupabase } from '@/lib/supabase'

// 臨時測試用，驗證完刪除
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-test-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceSupabase()

  // 取本週文章
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('title, description, slug, category, read_time')
    .gte('date', sevenDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(3)

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: 'no posts this week' })
  }

  // 取 opt-in 用戶
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, unique_code')
    .eq('is_active', true)
    .eq('email_newsletter_opt_in', true)

  const results: { name: string; success: boolean; error?: string }[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
  const cronSecret = process.env.CRON_SECRET || ''

  for (const client of clients || []) {
    const email = await getClientEmail(supabase, client.id)
    if (!email) {
      results.push({ name: client.name, success: false, error: 'no email' })
      continue
    }

    const token = crypto.createHmac('sha256', cronSecret).update(client.unique_code).digest('hex')
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?clientId=${encodeURIComponent(client.unique_code)}&token=${token}`

    const r = await sendNewsletterEmail({
      to: email,
      name: client.name,
      posts: posts.map(p => ({ ...p, readTime: p.read_time })),
      unsubscribeUrl,
    })
    results.push({ name: client.name, success: r.success, error: r.error })
  }

  return NextResponse.json({ posts: posts.length, clients: results })
}
