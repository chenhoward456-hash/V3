'use client'

import { memo } from 'react'
import { daysUntilDateTW } from '@/lib/date-utils'
import type { WeeklyTasksData } from './WeeklyTaskCard'

/**
 * 今日主線 — 首屏「一句判定 + 今天一個動作」的脊椎卡。
 *
 * 目的：把原本並排的多張狀態卡（本週任務 / 作戰室 / 減脂體檢）收斂成「一個聲音」，
 * 讓學員一眼知道「我在哪 + 今天做這件」，其餘細節降到下面（想看再翻）。
 *
 * 資料重用（不重算、不跟引擎打架）：
 *   - 判定文字直接吃 clients.weekly_tasks（weekly cron 每週生成的判定），tasks[0]=主判定。
 *   - 「今天這一件」用當日訓練/休息 + 當日碳水目標（碳循環），全是既有資料。
 *   - 血檢/指標的「需要關注」不當紅字嚇人，收斂成一句「往下看」的小字（跟減脂軌跡是兩個軸）。
 *
 * DESIGN.md：白卡 + slate 邊框 + rounded-2xl；顏色只做語意（emerald=在軌道/綠燈，amber=要留意）。
 */

const PHASE_LABEL: Record<string, string> = {
  cut: '減脂期',
  peak_week: 'Peak Week',
  competition: '比賽週',
  bulk: '增肌期',
  off_season: '休賽期',
  recovery: '恢復期',
  preparation: '準備期',
  weigh_in: '過磅',
  rebound: '反彈期',
}

// 從伺服器判定的文字/圖示判語意色（純呈現，不改任何引擎邏輯）。
const POSITIVE_RE = /穩|達標|乾淨|在軌道|照走|照計畫|進步|做得好|保持/
const NEGATIVE_RE = /卡|停滯|落後|超標|過快|太慢|注意|偏離|要調|掉太/

export interface TodayHeadlineProps {
  prepPhase: string | null
  competitionDate: string | null
  isCompetition: boolean
  targetWeight: string | number | null
  isTrainingDay: boolean
  carbsTrainingDay: number | null
  carbsRestDay: number | null
  carbsTarget: number | null
  weeklyTasks: WeeklyTasksData | null
  hasAttention: boolean
}

function TodayHeadlineInner({
  prepPhase,
  competitionDate,
  isCompetition,
  targetWeight,
  isTrainingDay,
  carbsTrainingDay,
  carbsRestDay,
  carbsTarget,
  weeklyTasks,
  hasAttention,
}: TodayHeadlineProps) {
  const tasks = Array.isArray(weeklyTasks?.tasks) ? weeklyTasks!.tasks : []
  const verdict = tasks[0] ?? null
  const extraTasks = tasks.slice(1)

  const daysLeft = competitionDate ? daysUntilDateTW(competitionDate) : null
  const phaseLabel = prepPhase ? PHASE_LABEL[prepPhase] ?? null : null

  const carbs = (carbsTrainingDay && carbsRestDay)
    ? (isTrainingDay ? carbsTrainingDay : carbsRestDay)
    : carbsTarget

  // 判定語意：先看有沒有負向詞，再看正向詞，都沒有就中性。
  const verdictText = `${verdict?.title ?? ''}${verdict?.detail ?? ''}`
  const isNegative = NEGATIVE_RE.test(verdictText)
  const isPositive = !isNegative && POSITIVE_RE.test(verdictText)

  // 今天這一件（動作，永遠具體、來自真實資料）。
  const dayLabel = isTrainingDay ? '💪 訓練日' : '😴 休息日'
  const carbPart = carbs != null ? `碳水吃滿 ${carbs}g` : null
  const doPart = isTrainingDay ? '把課表練完' : '好好恢復、別加練'
  const actionText = [dayLabel, carbPart, doPart].filter(Boolean).join('，')

  // 沒有任何可講的（無判定、無倒數、無動作）就整張不顯示，讓既有卡片接手。
  if (!verdict && !isCompetition && carbs == null) return null

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      {/* 目標 + 倒數 */}
      {(phaseLabel || (isCompetition && daysLeft != null) || targetWeight) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mb-2.5">
          {phaseLabel && <span className="font-medium text-slate-600">{phaseLabel}</span>}
          {isCompetition && daysLeft != null && daysLeft >= 0 && <span>· 剩 {daysLeft} 天</span>}
          {targetWeight != null && targetWeight !== '' && <span>· 目標 {targetWeight}kg</span>}
        </div>
      )}

      {/* 判定（一句、重用伺服器 weekly_tasks 主判定） */}
      {verdict && (
        <div className="flex items-start gap-2 mb-3">
          <span className="text-lg leading-none mt-0.5 shrink-0">{verdict.icon || (isNegative ? '🟡' : '🟢')}</span>
          <p className={`text-base font-bold leading-snug ${isPositive ? 'text-emerald-700' : isNegative ? 'text-amber-700' : 'text-slate-900'}`}>
            {verdict.title}
          </p>
        </div>
      )}

      {/* 今天就一件（動作） */}
      {actionText && (
        <div className="rounded-xl bg-slate-50 px-3.5 py-3">
          <p className="text-sm text-slate-800 leading-relaxed">
            <span className="font-semibold text-slate-900">今天就一件：</span>
            {actionText}。
            {isPositive && <span className="text-slate-500"> 其他照走、別亂改。</span>}
          </p>
        </div>
      )}

      {/* 佐證小字 + 血檢留意（跟減脂軌跡是兩個軸，收斂成一句，不當紅字嚇人） */}
      {(verdict?.detail || hasAttention) && (
        <p className="text-xs text-slate-500 leading-relaxed mt-2.5">
          {verdict?.detail}
          {hasAttention && (
            <>
              {verdict?.detail ? ' · ' : ''}
              <span className="text-amber-600">有健康指標要留意，往下看血檢</span>
            </>
          )}
        </p>
      )}

      {/* 本週還要（weekly_tasks 其餘行動項，降為小清單） */}
      {extraTasks.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {extraTasks.map((t) => (
            <li key={t.key} className="flex gap-2 text-xs text-slate-600 leading-snug">
              <span className="shrink-0">{t.icon}</span>
              <span>{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default memo(TodayHeadlineInner)
