import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabaseAdmin = createServiceSupabase()

// GET - 列出所有 Supabase 文章
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value
  if (!sessionToken || !verifyAdminSession(sessionToken)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('id, title, description, date, category, read_time, slug')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST - 新增文章
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value
  if (!sessionToken || !verifyAdminSession(sessionToken)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, content, slug, category, readTime, date } = body

  if (!title || !description || !content || !slug || !category) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  // 檢查 slug 是否重複
  const { data: existing } = await supabaseAdmin
    .from('blog_posts')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: '此 slug 已存在，請換一個網址' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .insert({
      title,
      description,
      content,
      slug,
      category,
      read_time: readTime || '5 分鐘',
      date: date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE - 刪除文章
export async function DELETE(request: NextRequest) {
  const sessionToken = request.cookies.get('admin_session')?.value
  if (!sessionToken || !verifyAdminSession(sessionToken)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: '缺少文章 ID' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('blog_posts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
