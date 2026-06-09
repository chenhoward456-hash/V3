'use client'

import type { Client } from '@/hooks/useClientData'

interface Props {
  client: Client
  streakDays: number
  todayCompletedCount: number
  todayTotalCount: number
  weeklyTrainingDays: number
}

function getGreetingLabel(): string {
  const h = new Date().getHours()
  if (h < 5) return 'LATE NIGHT'
  if (h < 12) return 'MORNING'
  if (h < 18) return 'AFTERNOON'
  return 'EVENING'
}

function getCoachMessage(streak: number, completed: number, total: number, weeklyTraining: number): string {
  if (streak === 0) return '今天打第一筆，就能啟動連續紀錄。'
  if (streak === 1) return '一天才剛開始。明天再來一次，連到 2。'
  if (streak < 7) return `已連續 ${streak} 天。一週是第一個里程碑。`
  if (streak < 14) return `${streak} 天了。趨勢圖再過幾天會更穩。`
  if (streak < 30) return `${streak} 天。週平均體重和訓練量已經能說話了。`
  if (streak < 100) return `${streak} 天。habit 已經內化，繼續累積。`
  return `${streak} 天連續，這是少數人能做到的數字。`
}

export default function DashboardSignatureHero({
  client,
  streakDays,
  todayCompletedCount,
  todayTotalCount,
  weeklyTrainingDays,
}: Props) {
  const dateLabel = new Date().toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const message = getCoachMessage(streakDays, todayCompletedCount, todayTotalCount, weeklyTrainingDays)

  return (
    <div className="bg-zinc-950 rounded-3xl px-6 pt-7 pb-8 mb-6 overflow-hidden relative">
      {/* Top eyebrow row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-400 font-semibold">
          {getGreetingLabel()} · {dateLabel}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold">
          {client.subscription_tier === 'coached' ? 'Coached'
            : client.subscription_tier === 'self_managed' ? 'Self-Managed'
            : 'Free'}
        </p>
      </div>

      {/* Name */}
      <h1 className="text-white font-black text-3xl tracking-tight mt-2 leading-tight">
        {client.name}
      </h1>

      {/* Streak big number */}
      <div className="mt-7 flex items-end gap-5">
        <div className="flex-shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-1">Streak</p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-emerald-400 font-black tabular-nums leading-none"
              style={{ fontSize: '5.5rem', letterSpacing: '-0.05em' }}
            >
              {streakDays}
            </span>
            <span className="text-zinc-500 text-sm">d</span>
          </div>
        </div>

        <div className="flex-1 pb-2 min-w-0">
          <p className="text-xs text-zinc-400 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {/* Bottom stat strip */}
      <div className="mt-7 pt-5 border-t border-white/10 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Today</p>
          <p className="text-white text-xl font-black tabular-nums mt-0.5">
            {todayCompletedCount}<span className="text-zinc-600">/</span>{todayTotalCount || '—'}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Week training</p>
          <p className="text-white text-xl font-black tabular-nums mt-0.5">
            {weeklyTrainingDays}<span className="text-zinc-600 text-sm">d</span>
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Plan</p>
          <p className="text-white text-xl font-black mt-0.5 truncate">
            {client.subscription_tier === 'coached' ? '2999'
              : client.subscription_tier === 'self_managed' ? '499'
              : 'Free'}
          </p>
        </div>
      </div>
    </div>
  )
}
