'use client'

import { useState } from 'react'

const TIERS = [
  { key: 'self_managed', label: '自主管理', price: 499 },
  { key: 'coached', label: '教練指導', price: 2999 },
  { key: 'combo', label: '全方位', price: 5000 },
] as const

export default function PaymentLinkPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [tier, setTier] = useState<string>('coached')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  const generateLink = () => {
    if (!email.trim()) return
    const params = new URLSearchParams({
      tier,
      email: email.trim(),
      ...(name.trim() ? { name: name.trim() } : {}),
    })
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/pay?${params.toString()}`
    setGeneratedLink(link)
    setCopied(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedPlan = TIERS.find(t => t.key === tier)

  return (
    <section className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
        產生付款連結
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        LINE 聊完後，產生連結丟給客戶自行付款
      </p>

      <div className="space-y-4">
        {/* 方案選擇 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">方案</label>
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map(t => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                className={`py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                  tier === t.key
                    ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div>{t.label}</div>
                <div className="text-xs mt-0.5">${t.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">客戶 Email *</label>
          <input
            type="email"
            placeholder="client@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
          />
        </div>

        {/* 姓名 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            客戶姓名 <span className="text-gray-400 font-normal">— 選填，預填表單用</span>
          </label>
          <input
            type="text"
            placeholder="王小明"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors"
          />
        </div>

        {/* 產生按鈕 */}
        <button
          onClick={generateLink}
          disabled={!email.trim()}
          className="w-full py-4 rounded-xl font-bold text-base bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
        >
          產生 NT${selectedPlan?.price} 付款連結
        </button>

        {/* 產生結果 */}
        {generatedLink && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500">付款連結（丟給客戶）</p>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 break-all font-mono">
              {generatedLink}
            </div>
            <button
              onClick={handleCopy}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              {copied ? '已複製 ✓' : '複製連結'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
