'use client'

import { memo } from 'react'

/**
 * 當週任務卡 — 讀 clients.weekly_tasks（weekly cron 每週生成的 top-3 行動任務快照）。
 * 行動優先、置頂顯示；沒有任務（資料不足或非活躍學員未生成）就整張不顯示。
 * 遵守 DESIGN.md：白卡 + slate 邊框 + rounded-2xl；顏色只做語意，這裡用中性灰。
 */

interface WeeklyTaskItem {
  key: string
  icon: string
  title: string
  detail: string
}

export interface WeeklyTasksData {
  week_of: string
  generated_at?: string
  tasks: WeeklyTaskItem[]
}

function WeeklyTaskCardInner({ data }: { data: WeeklyTasksData | null }) {
  if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) return null

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="text-base leading-none">📋</span>
        <h2 className="text-sm font-semibold text-slate-900">本週任務</h2>
        <span className="ml-auto text-[11px] text-slate-400">{data.tasks.length} 件</span>
      </div>
      <ul className="space-y-3">
        {data.tasks.map((t) => (
          <li key={t.key} className="flex gap-3">
            <span className="text-lg leading-none mt-0.5 shrink-0">{t.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 leading-snug">{t.title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default memo(WeeklyTaskCardInner)
