'use client'

import { useState } from 'react'

// 用 Email 取回儀表板連結（忘記網址/換裝置時）。系統把 /c/[code] 連結寄到信箱。
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('請輸入有效的 Email')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.status === 429) { setError('請求太頻繁，請稍後再試'); return }
      setSent(true)
    } catch {
      setError('送出失敗，請再試一次')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">用 Email 登入</h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          忘記你的儀表板網址或換了手機？輸入註冊用的 Email，我們把登入連結寄給你。
        </p>

        {sent ? (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-800">📧 寄出了（如果這個 Email 有註冊）</p>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              到信箱點「進入我的儀表板」就能回來。沒收到的話檢查垃圾信，或確認當初註冊用的 Email。
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="你的 Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
            {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-3 w-full bg-primary-600 text-white font-medium py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '寄送中…' : '寄登入連結給我'}
            </button>
            <p className="text-[11px] text-slate-400 mt-3 leading-snug">
              還沒有帳號？<a href="/diagnosis" className="text-primary-600">先免費試算你的數字 →</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
