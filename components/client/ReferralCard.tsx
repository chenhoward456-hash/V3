'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Share2, Users, Gift } from 'lucide-react'

interface ReferralCardProps {
  clientId: string  // unique_code
}

export default function ReferralCard({ clientId }: ReferralCardProps) {
  const [code, setCode] = useState<string | null>(null)
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [rewardDays, setRewardDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchReferral = async () => {
      try {
        const res = await fetch(`/api/referral?clientId=${clientId}`)
        if (!res.ok) {
          setError(true)
          return
        }
        const data = await res.json()
        setCode(data.code)
        setTotalReferrals(data.totalReferrals || 0)
        setRewardDays(data.rewardDays || 0)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchReferral()
  }, [clientId])

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const siteUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://howard456.vercel.app'

  const shareMessage = code
    ? `我在用 Howard Protocol 追蹤健康數據，很推薦你也試試！用我的推薦碼 ${code} 註冊：${siteUrl}/join?ref=${code}`
    : ''

  const handleShareLine = () => {
    if (!code) return
    const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(`${siteUrl}/join?ref=${code}`)}&text=${encodeURIComponent(shareMessage)}`
    window.open(lineShareUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-10 bg-gray-100 rounded-xl mb-3" />
        <div className="h-8 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (error || !code) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 mb-3">
      {/* Subtle decorative gradient border */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/10 via-indigo-400/5 to-purple-400/10 pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <Gift size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">推薦好友</h3>
            <p className="text-[11px] text-gray-500">每成功推薦 1 人，你可獲得 7 天免費使用</p>
          </div>
        </div>

        {/* Referral code display + copy */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-white/80 backdrop-blur-sm border border-indigo-200/50 rounded-xl px-4 py-2.5 font-mono text-sm font-bold text-indigo-700 tracking-wider text-center select-all">
            {code}
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已複製' : '複製'}
          </button>
        </div>

        {/* Share via LINE */}
        <button
          onClick={handleShareLine}
          className="w-full flex items-center justify-center gap-2 bg-[#06C755] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#05b04d] active:scale-[0.98] transition-all mb-4"
        >
          <Share2 size={14} />
          分享到 LINE
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Users size={13} className="text-indigo-500" />
              <span className="text-lg font-bold text-gray-800">{totalReferrals}</span>
            </div>
            <span className="text-[11px] text-gray-500">成功推薦</span>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Gift size={13} className="text-purple-500" />
              <span className="text-lg font-bold text-gray-800">{rewardDays}</span>
            </div>
            <span className="text-[11px] text-gray-500">獲得天數</span>
          </div>
        </div>
      </div>
    </div>
  )
}
