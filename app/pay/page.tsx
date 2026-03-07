'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

const PLAN_INFO: Record<string, { name: string; price: number; priceLabel: string; features: string[] }> = {
  self_managed: {
    name: '自主管理方案',
    price: 499,
    priceLabel: '499',
    features: ['AI 飲食顧問完整存取', '訓練 / 體態 / 感受追蹤', 'TDEE + 巨量營養素自動校正', '碳水循環 & Refeed 智能提醒'],
  },
  coached: {
    name: '教練指導方案',
    price: 2999,
    priceLabel: '2,999',
    features: ['包含自主管理所有功能', 'CSCS 教練每週數據審閱', 'LINE 一對一營養 / 訓練諮詢', '個人化補劑與血檢建議'],
  },
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">載入中...</div>}>
      <PayContent />
    </Suspense>
  )
}

function PayContent() {
  const searchParams = useSearchParams()
  const tierParam = searchParams.get('tier') || 'coached'
  const emailParam = searchParams.get('email') || ''
  const nameParam = searchParams.get('name') || ''

  const plan = PLAN_INFO[tierParam]

  const [name, setName] = useState(nameParam)
  const [email, setEmail] = useState(emailParam)
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'男性' | '女性' | ''>('')
  const [age, setAge] = useState('')
  const [goalType, setGoalType] = useState<'cut' | 'bulk'>('cut')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!plan) {
    return (
      <section className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-red-600">無效的方案</h1>
        <p className="text-gray-500 mt-2">請確認連結是否正確。</p>
      </section>
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('請輸入姓名'); return }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('請輸入有效的 Email'); return }

    setError('')
    setIsSubmitting(true)

    trackEvent('pay_link_checkout', { tier: tierParam, email })

    try {
      const res = await fetch('/api/subscribe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          tier: tierParam,
          registrationData: {
            gender: gender || null,
            age: age ? parseInt(age) : null,
            goalType,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '結帳失敗')

      if (data.htmlForm) {
        document.open()
        document.write(data.htmlForm)
        document.close()
      }
    } catch (err: any) {
      setError(err.message || '結帳失敗，請稍後再試')
      setIsSubmitting(false)
    }
  }

  return (
    <section className="max-w-lg mx-auto px-6 py-16 md:py-20">
      {/* Plan Summary */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-2xl p-6 text-white mb-8 text-center">
        <p className="text-sm opacity-80 mb-1">Howard Protocol</p>
        <h1 className="text-2xl font-bold mb-2">{plan.name}</h1>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-sm opacity-80">NT$</span>
          <span className="text-4xl font-bold">{plan.priceLabel}</span>
          <span className="text-sm opacity-80">/月</span>
        </div>
        <ul className="mt-4 space-y-1.5 text-left max-w-xs mx-auto">
          {plan.features.map((f, i) => (
            <li key={i} className="text-sm opacity-90 flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">&#10003;</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Registration Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#1e3a5f' }}>填寫資料並付款</h2>
        <p className="text-xs text-gray-400 mb-6">付款由綠界科技（ECPay）安全處理</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">姓名 *</label>
            <input
              type="text" placeholder="你的名字" value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Email *</label>
            <input
              type="email" placeholder="your@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">帳號資訊會寄到這裡</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              手機號碼 <span className="text-gray-400 font-normal">— 選填</span>
            </label>
            <input
              type="tel" placeholder="0912345678" value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">性別</label>
            <div className="grid grid-cols-2 gap-3">
              {(['男性', '女性'] as const).map(g => (
                <button key={g} type="button" onClick={() => setGender(g)}
                  className={`py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
                    gender === g ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {g === '男性' ? '♂ 男性' : '♀ 女性'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">你的目標</label>
            <div className="grid grid-cols-2 gap-3">
              {([{ key: 'cut' as const, label: '減脂' }, { key: 'bulk' as const, label: '增肌' }]).map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setGoalType(key)}
                  className={`py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
                    goalType === key ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={isSubmitting}
            className="w-full py-4 rounded-xl font-bold text-base bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 mt-2"
          >
            {isSubmitting ? '正在跳轉至付款頁面...' : `前往付款 — NT$${plan.priceLabel}`}
          </button>

          <p className="text-center text-xs text-gray-400 mt-2">
            支援信用卡、ATM、超商付款
          </p>
        </div>
      </div>
    </section>
  )
}
