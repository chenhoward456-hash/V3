'use client'

import { memo } from 'react'
import { House, ChartNoAxesCombined, ClipboardList, HeartPulse, Menu } from 'lucide-react'

const homeIcons = { home: House, data: ChartNoAxesCombined, training: ClipboardList, lab: HeartPulse, more: Menu }

interface BottomNavProps {
  homeStyle?: boolean
  tabs: { id: string; icon: string; label: string }[]
  activeTab: string
  completedMap: Record<string, boolean>
  isToday: boolean
  onTabClick: (id: string) => void
}

function BottomNavInner({ tabs, activeTab, completedMap, isToday, onTabClick, homeStyle = false }: BottomNavProps) {
  if (tabs.length <= 1) return null

  return (
    <nav aria-label="學員導覽" className={homeStyle ? "fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50" : "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-4xl mx-auto flex">
        {tabs.map(tab => {
          const Icon = homeIcons[tab.id as keyof typeof homeIcons]
          const isDailyCompleted = isToday && completedMap[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center py-2 transition-colors relative ${activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'}`}
            >
              <span className={homeStyle ? 'px-4 py-1.5 rounded-xl' : `text-lg leading-none transition-transform duration-200 ${activeTab === tab.id ? 'scale-110 -translate-y-0.5' : ''}`}>{homeStyle && Icon ? <Icon size={21} strokeWidth={activeTab === tab.id ? 2 : 1.5} /> : tab.icon}</span>
              <span className="text-[11px] mt-0.5 font-medium">{tab.label}</span>
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
