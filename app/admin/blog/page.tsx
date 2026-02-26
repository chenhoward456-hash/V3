'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  description: string
  date: string
  category: string
  read_time: string
  slug: string
}

const CATEGORIES = ['血檢優化', '營養策略', '訓練方法', '恢復優化', '個案追蹤'] as const

const INITIAL_FORM = {
  title: '',
  description: '',
  slug: '',
  date: new Date().toISOString().split('T')[0],
  category: '恢復優化',
  readTime: '5 分鐘',
  content: '',
}

export default function AdminBlogPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(res => {
        if (!res.ok) { router.push('/admin/login'); return }
        fetchPosts()
      })
      .catch(() => router.push('/admin/login'))
  }, [router])

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/admin/blog')
      if (!res.ok) { if (res.status === 401) { router.push('/admin/login'); return } }
      const data = await res.json()
      setPosts(data.data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  // 自動產生 slug（從標題轉英文需手動填，這裡只清理格式）
  const handleTitleChange = (val: string) => {
    setForm(f => ({ ...f, title: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '發布失敗')
        return
      }

      setSuccess('文章發布成功！')
      setForm(INITIAL_FORM)
      setShowForm(false)
      fetchPosts()
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除「${title}」嗎？此操作無法復原。`)) return

    setDeleting(id)
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setPosts(posts.filter(p => p.id !== id))
        setSuccess('文章已刪除')
      } else {
        const data = await res.json()
        setError(data.error || '刪除失敗')
      }
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9F9F7' }}>
        <div className="text-gray-500">載入中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9F9F7' }}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700 text-sm">
              ← 返回後台
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: '#2D2D2D' }}>文章管理</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
            className="px-5 py-2.5 rounded-xl font-semibold text-white transition-all"
            style={{ backgroundColor: '#4CAF82' }}
          >
            {showForm ? '收起' : '+ 新增文章'}
          </button>
        </div>

        {/* 通知 */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 新增文章表單 */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
            <h2 className="text-lg font-bold mb-6" style={{ color: '#2D2D2D' }}>新增文章</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 標題 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">標題 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="文章標題"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
              </div>

              {/* 簡介 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">簡介（文章列表顯示）*</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="1-2 句話描述文章重點"
                  required
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                />
              </div>

              {/* Slug + 日期 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    網址 Slug * <span className="text-gray-400 font-normal">（英文，不含空格）</span>
                  </label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="my-article-title"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-mono"
                  />
                  {form.slug && (
                    <p className="text-xs text-gray-400 mt-1">/blog/{form.slug}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">發布日期 *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                </div>
              </div>

              {/* 分類 + 閱讀時間 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">分類 *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm bg-white"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">閱讀時間</label>
                  <input
                    type="text"
                    value={form.readTime}
                    onChange={e => setForm(f => ({ ...f, readTime: e.target.value }))}
                    placeholder="5 分鐘"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                </div>
              </div>

              {/* 內容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  文章內容 * <span className="text-gray-400 font-normal">（支援 Markdown：## 標題、**粗體**、- 列表、--- 分隔線）</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={`## 前言\n\n這是文章開頭...\n\n---\n\n## 第一節\n\n內容段落。**重點**可以這樣標記。\n\n- 列表項目 1\n- 列表項目 2\n\n---\n\n## 免責聲明\n\n本文僅供教育參考，不構成醫療建議。`}
                  required
                  rows={20}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-mono leading-relaxed"
                />
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: '#4CAF82' }}
                >
                  {saving ? '發布中...' : '立即發布'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError('') }}
                  className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 已發布文章列表 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">已發布文章（Supabase）</h2>
            <p className="text-xs text-gray-400 mt-0.5">舊文章存在程式碼中，不顯示於此列表</p>
          </div>

          {posts.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              還沒有透過後台發布的文章
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.map(post => (
                <div key={post.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#4CAF8215', color: '#4CAF82' }}>
                        {post.category}
                      </span>
                      <span className="text-xs text-gray-400">{post.date}</span>
                      <span className="text-xs text-gray-400">{post.read_time}</span>
                    </div>
                    <p className="font-semibold text-gray-800 truncate">{post.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">/blog/{post.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      預覽
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id, post.title)}
                      disabled={deleting === post.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {deleting === post.id ? '刪除中...' : '刪除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
