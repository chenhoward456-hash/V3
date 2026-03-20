'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

interface UpgradeGateProps {
  feature: string
  description?: string
  tier?: 'self_managed' | 'coached'
  currentTier?: 'free' | 'self_managed' | 'coached'
  previewContent?: React.ReactNode
  benefits?: string[]
}

const TIER_INFO = {
  self_managed: {
    label: '自主管理方案',
    price: '499',
    defaultBenefits: [
      '卡住時 AI 告訴你原因，不用自己猜',
      '每週自動調整該吃多少，不用重新算',
      '訓練日多吃、休息日少吃，系統自動排',
      '停滯期主動提醒你，不會卡住沒人講',
      '訓練 + 身心狀態完整追蹤',
    ],
  },
  coached: {
    label: '教練指導方案',
    price: '2,999',
    defaultBenefits: [
      '教練每週看你的數據，告訴你哪裡要調',
      '根據你的血檢和基因，給只屬於你的建議',
      'LINE 隨時問，不用等、不用自己扛',
      '你負責執行，教練負責確保方向正確',
    ],
  },
}

/**
 * 免費/低階方案用戶看到鎖定功能時的升級提示卡片
 * 支援簡易模式（向後相容）及帶預覽/功能列表的進階模式
 */
export default function UpgradeGate({
  feature,
  description,
  tier = 'self_managed',
  currentTier,
  previewContent,
  benefits,
}: UpgradeGateProps) {
  const info = TIER_INFO[tier]
  // Only show default benefits when currentTier is provided (enhanced variant)
  const displayBenefits = benefits ?? (currentTier ? info.defaultBenefits : [])

  // Determine the upgrade link with context params
  const upgradeHref = currentTier
    ? `/upgrade?from=${currentTier}&feature=${encodeURIComponent(feature)}`
    : `/upgrade?feature=${encodeURIComponent(feature)}`

  const hasPreview = !!previewContent
  const hasBenefits = displayBenefits.length > 0

  // Simple variant: no preview, no benefits, no currentTier -- compact card (backward-compatible layout)
  if (!hasPreview && !hasBenefits && !currentTier) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0">🔒</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{feature}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
            <Link
              href={upgradeHref}
              onClick={() => trackEvent('upgrade_cta_clicked', { feature, tier })}
              className="inline-block mt-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              升級{info.label} — NT${info.price}/月
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Enhanced variant: with preview, benefits list, and upgrade path context
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden">
      {/* Blurred preview overlay */}
      {hasPreview && (
        <div className="relative">
          <div className="blur-[6px] opacity-60 pointer-events-none select-none overflow-hidden max-h-48">
            {previewContent}
          </div>
          {/* Overlay badge */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span className="text-sm font-semibold text-gray-700">
                升級後解鎖
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content section */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {!hasPreview && <span className="text-xl shrink-0">🔒</span>}
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{feature}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}

            {/* Current tier context */}
            {currentTier && (
              <p className="text-[11px] text-blue-500 font-medium mt-1.5">
                {currentTier === 'free' && tier === 'self_managed' && '免費版 → 自主管理版'}
                {currentTier === 'free' && tier === 'coached' && '免費版 → 教練指導版'}
                {currentTier === 'self_managed' && tier === 'coached' && '自主管理版 → 教練指導版'}
              </p>
            )}

            {/* Benefits list */}
            {hasBenefits && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  升級後你將獲得
                </p>
                <ul className="space-y-1">
                  {displayBenefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <Link
              href={upgradeHref}
              onClick={() => trackEvent('upgrade_cta_clicked', { feature, tier, currentTier })}
              className="inline-block mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
            >
              升級{info.label} — NT${info.price}/月
            </Link>
            <Link
              href={upgradeHref}
              className="inline-block mt-1.5 text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
            >
              查看完整方案比較 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
