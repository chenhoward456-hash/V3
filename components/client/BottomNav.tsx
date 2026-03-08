'use client'

import { memo } from 'react'

interface BottomNavProps {
  tabs: { id: string; icon: string; label: string }[]
  activeTab: string
  completedMap: Record<string, boolean>
  isToday: boolean
  onTabClick: (id: string) => void
}

function BottomNavInner({ tabs, activeTab, completedMap, isToday, onTabClick }: BottomNavProps) {
  if (tabs.length <= 1) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-4xl mx-auto flex">
        {tabs.map(tab => {
          const isDailyCompleted = isToday && completedMap[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 transition-colors relative ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              {isDailyCompleted && (
                <span className="absolute top-1 right-1/2 translate-x-4 w-1.5 h-1.5 bg-green-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default memo(BottomNavInner)
