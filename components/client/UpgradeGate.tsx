'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

interface UpgradeGateProps {
  feature: string
  description?: string
  tier?: 'self_managed' | 'coached'
}

/**
 * 免費用戶看到鎖定功能時的升級提示卡片
 */
export default function UpgradeGate({ feature, description, tier = 'self_managed' }: UpgradeGateProps) {
  const tierLabel = tier === 'coached' ? '教練指導方案' : '自主管理方案'
  const price = tier === 'coached' ? '2,999' : '499'

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
            href="/join"
            onClick={() => trackEvent('upgrade_cta_clicked', { feature, tier })}
            className="inline-block mt-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            升級{tierLabel} — NT${price}/月
          </Link>
        </div>
      </div>
    </div>
  )
}
