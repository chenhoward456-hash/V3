'use client'

import { memo } from 'react'

interface EngineStatusLineProps {
  caloriesTarget: number | null
  autoAdjustEnabled: boolean | null
  lastAutoAdjustAt: string | null
  coachOverride: { reason?: string | null } | null
  competitionDate: string | null
  targetDate: string | null
}

// 與 lib/trajectory-adjust 的 cooldownDaysFor 同邏輯：離目標日越近、冷卻越短
function cooldownDays(targetDate: string | null): number {
  if (!targetDate) return 7
  const daysLeft = Math.floor((new Date(targetDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 14) return 5
  if (daysLeft < 30) return 7
  return 14
}

/**
 * 一行「系統校正狀態」— 讓學員看得到引擎活著、為什麼按住、下次什麼時候動。
 * 解決「macros 一直不變，搞不清楚系統有沒有在算」的信任問題。刻意做成細線、不佔版面。
 */
function EngineStatusLineInner({
  caloriesTarget, autoAdjustEnabled, lastAutoAdjustAt, coachOverride, competitionDate, targetDate,
}: EngineStatusLineProps) {
  if (caloriesTarget == null) return null
  const cal = <b className="text-gray-700">{caloriesTarget} kcal</b>

  // 教練鎖定 → 引擎不動，明講
  //
  // ⚠️ 2026-08-26：這裡原本把 `coachOverride.reason` 整段印給學員看。
  // 那個欄位是**寫給教練與未來維護者的內部備註** —— 裡面有引擎 bug 的描述、
  // 改動的來龍去脈，甚至有 Howard 對我講的原話（含髒話）。震宣的頁面上實際出現過。
  // 學員要知道的只有「這組數字是教練定的，系統不會自己改」，理由不該外流。
  // 想給學員看的說明請走 coach_weekly_note / personal_notes，那些本來就是對外的。
  if (coachOverride) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-gray-500 px-1 mb-2 leading-snug">
        <span>教練手動設定 {cal}，系統不自動更動</span>
      </p>
    )
  }

  if (!autoAdjustEnabled) return null // 沒開自動調整就不顯示

  let detail: string = '隨你的體重趨勢隨時可調整'
  if (lastAutoAdjustAt) {
    const cd = cooldownDays(competitionDate || targetDate)
    const next = new Date(new Date(lastAutoAdjustAt).getTime() + cd * 86_400_000)
    if (Date.now() < next.getTime()) {
      detail = `冷卻中，約 ${next.getMonth() + 1}/${next.getDate()} 後依趨勢再評估`
    }
  }

  return (
    <p className="flex items-center gap-1.5 text-[11px] text-gray-500 px-1 mb-2 leading-snug">
      <span>系統自動校正中 · 目前 {cal} · {detail}</span>
    </p>
  )
}

export default memo(EngineStatusLineInner)
