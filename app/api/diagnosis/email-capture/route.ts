import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('diagnosis-email-capture')

export async function POST(request: Request) {
  try {
    const { email, tdee, gender, age, weight, height, goal } = await request.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    const { error } = await supabase
      .from('diagnosis_emails')
      .upsert(
        {
          email: email.trim().toLowerCase(),
          tdee: tdee || null,
          gender: gender || null,
          age: age || null,
          weight: weight || null,
          height: height || null,
          goal: goal || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )

    if (error) {
      logger.warn('Diagnosis email insert failed', { message: error.message })
      // Even if storage fails, return success so we don't block the user experience
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
