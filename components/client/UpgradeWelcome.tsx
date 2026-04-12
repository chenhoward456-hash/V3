'use client'

import { useState, useEffect } from 'react'

const TIER_RANK: Record<string, number> = {
  free: 0,
  self_managed: 1,
  coached: 2,
}

const UPGRADE_FEATURES: Record<string, string[]> = {
  'free→self_managed': ['營養自動追蹤', 'AI TDEE 校正', '碳循環', '訓練記錄'],
  'free→coached': [
    '營養自動追蹤', 'AI TDEE 校正', '碳循環', '訓練記錄',
    '血檢分析', '補品建議', 'AI 顧問（30次/天）', '教練週審', '基因分析',
  ],
  'self_managed→coached': ['血檢分析', '補品建議', 'AI 顧問升級', '教練週審', '基因分析'],
}

function getStorageKey(clientId: string) {
  return `hp_last_known_tier_${clientId}`
}

interface UpgradeWelcomeProps {
  clientId: string
  tier: string | null
}

export default function UpgradeWelcome({ clientId, tier }: UpgradeWelcomeProps) {
  const [features, setFeatures] = useState<string[] | null>(null)

  useEffect(() => {
    const currentTier = tier || 'free'
    const key = getStorageKey(clientId)
    const lastKnown = localStorage.getItem(key)

    if (lastKnown === null) {
      // First visit: store current tier, don't show banner
      localStorage.setItem(key, currentTier)
      return
    }

    const lastRank = TIER_RANK[lastKnown] ?? 0
    const currentRank = TIER_RANK[currentTier] ?? 0

    if (currentRank > lastRank) {
      const upgradeKey = `${lastKnown}→${currentTier}`
      const newFeatures = UPGRADE_FEATURES[upgradeKey]
      if (newFeatures) {
        setFeatures(newFeatures)
      }
    } else {
      // Tier same or downgraded: update stored tier silently
      localStorage.setItem(key, currentTier)
    }
  }, [clientId, tier])

  function handleDismiss() {
    const currentTier = tier || 'free'
    localStorage.setItem(getStorageKey(clientId), currentTier)
    setFeatures(null)
  }

  if (!features) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-4">
      <h3 className="text-base font-bold text-gray-900 mb-2">方案已升級！以下是你的新功能：</h3>
      <ul className="space-y-1 mb-4">
        {features.map((f) => (
          <li key={f} className="text-sm text-gray-700 flex items-center gap-2">
            <span className="text-blue-500">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={handleDismiss}
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        我知道了
      </button>
    </div>
  )
}
