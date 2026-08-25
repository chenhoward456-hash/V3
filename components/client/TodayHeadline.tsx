'use client'

import { memo } from 'react'
import { daysUntilDateTW } from '@/lib/date-utils'
import { degradeToSafe } from '@/lib/compliance-scrub'
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

/**
 * 引擎即時判定（來自頁層 nutritionEngineSuggestion，鏡像顯示不重算）。
 * 只取「今天就一件」需要的欄位；有氧分鐘/步數是引擎已算好的數字，這裡只轉述不自己編（紅線 3）。
 */
export interface EngineActionInput {
  status: string
  statusLabel?: string | null
  message?: string | null
  statusEmoji?: string | null
  refeedSuggested?: boolean
  refeedDays?: number | null
  deadlineInfo?: {
    extraCardioNeeded?: boolean
    suggestedCardioMinutes?: number
    suggestedDailySteps?: number
  } | null
}

// 這幾種引擎狀態＝真的偏離軌道，才用引擎覆蓋「今天就一件」；其餘照走 weekly_tasks，不打架。
const OFF_TRACK_STATUSES = new Set(['too_fast', 'plateau', 'wrong_direction', 'low_compliance'])

/** 引擎狀態 → 今天一個具體動作。只用引擎算好的數字，不發明 macro。
 *
 * ⚠️ 2026-08-11 修：too_fast / plateau 原本寫死減脂語意，增肌學員看到的是相反的指令——
 * 陳胤豪（bulk）判定 chip 顯示「增太快」、行動句卻是「掉太快了，今天把目標吃滿別壓熱量」，
 * 照做會增更快，而且跟引擎自己算的「可考慮微降熱量 150kcal」互相打架。
 * 引擎層早就懂 bulk（見 project_v3_bulk_no_cut），是 UI 文案層假設了減脂。
 * plateau 同理：減脂停滯要加有氧，增肌停滯是「沒長大」——要加熱量，不是加有氧。 */
function engineActionText(e: EngineActionInput, goalType?: string | null): string | null {
  const isBulk = goalType === 'bulk'
  if (e.refeedSuggested) {
    return `照計畫安排 refeed（把碳水吃回來的恢復日${e.refeedDays ? `，約 ${e.refeedDays} 天` : ''}）——細節看計畫分頁的今日營養處方`
  }
  switch (e.status) {
    case 'too_fast':
      return isBulk
        ? '增太快了——體重衝過頭多半是脂肪跟水，今天照目標吃就好，別再多加'
        : '掉太快了——今天把目標吃滿，別自己再壓熱量'
    case 'plateau': {
      // 增肌停滯＝沒長大，加有氧只會更難長；要的是把熱量吃滿（引擎才有依據往上調）
      if (isBulk) return '體重卡住了——今天先把目標熱量吃滿、記錄記齊，長不動多半是沒吃夠'
      const di = e.deadlineInfo
      if (di?.extraCardioNeeded && di.suggestedCardioMinutes) {
        return `卡住了——今天加 ${di.suggestedCardioMinutes} 分鐘中等強度有氧${di.suggestedDailySteps ? `（或走到 ${di.suggestedDailySteps.toLocaleString()} 步）` : ''}，飲食照目標別亂砍`
      }
      return '卡住了——今天照目標吃滿、把記錄記齊，引擎才判斷得準'
    }
    case 'wrong_direction':
      return isBulk
        ? '方向不對——體重在往下掉，今天先回到目標吃法，並把飲食記錄記齊'
        : '方向不對——今天先回到目標吃法，並把飲食記錄記齊'
    case 'low_compliance':
      return '這週依從掉了——今天就照目標吃、照實記，一天就好'
    default:
      return null
  }
}

export interface TodayHeadlineProps {
  /** cut / bulk / recomp —— 決定 too_fast / plateau 的行動句方向（增肌與減脂相反）*/
  goalType?: string | null
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
  /** 近期有在記錄（streakDays>0）——沒有伺服器判定時，決定主線是「輕判定」還是「推去開始」 */
  recentlyActive: boolean
  /** 引擎即時判定（可缺）：偏離軌道時覆蓋判定與「今天就一件」，比 weekly cron 新鮮 */
  engine?: EngineActionInput | null
}

function TodayHeadlineInner({
  goalType,
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
  recentlyActive,
  engine,
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

  // 引擎即時覆蓋：真的偏離軌道（或引擎建議 refeed）時，主線聽引擎的——它吃的是最新記錄，
  // 比週更的 weekly_tasks 新鮮。顏色直接用 status 決定（不靠關鍵字正則），文字過 degradeToSafe。
  const engineOff = !!engine && OFF_TRACK_STATUSES.has(engine.status)
  const engineAction = engine && (engineOff || engine.refeedSuggested) ? engineActionText(engine, goalType) : null
  const engineTitle = engineOff ? degradeToSafe(engine!.statusLabel || '狀態要留意').text : null
  const engineDetailRaw = engineOff && engine?.message ? degradeToSafe(engine.message).text : null
  const engineDetail = engineDetailRaw && engineDetailRaw.length > 90 ? `${engineDetailRaw.slice(0, 90)}…` : engineDetailRaw

  // Fallback：沒有伺服器判定(weekly_tasks 只餵得到少數活躍者)時，主線仍要有一句話——
  // 讓「管家」對全班成立，不只有 cron 生得出任務的人。沒在記錄的人 → 推去開始（直接對打留存）。
  const hasServerVerdict = !!verdict
  const startMode = !hasServerVerdict && !recentlyActive
  const fallbackTitle = hasServerVerdict
    ? null
    : recentlyActive
      ? '有在記錄，保持——資料再多一點，我就開始幫你抓趨勢'
      : '還沒開始追蹤你的進度'

  // 今天這一件（動作）：沒資料的人 → 推去開始；其餘 → 具體訓練/碳水。
  const dayLabel = isTrainingDay ? '訓練日' : '休息日'
  const carbPart = carbs != null ? `碳水吃滿 ${carbs}g` : null
  const doPart = isTrainingDay ? '把課表練完' : '好好恢復、別加練'
  const actionText = startMode
    ? '先從今天記一項開始（量體重或記一餐都行），我才幫得上你'
    : engineAction ?? [dayLabel, carbPart, doPart].filter(Boolean).join('，')

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      {/* 目標 + 倒數 — 備賽客戶的階段/倒數由下方備賽倒數卡講（同屏不講兩次），這裡只補目標 */}
      {(() => {
        const chips = [
          !isCompetition && phaseLabel,
          targetWeight != null && targetWeight !== '' && `目標 ${targetWeight}kg`,
        ].filter(Boolean) as string[]
        if (chips.length === 0) return null
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mb-2.5 tabular-nums">
            {chips.map((t, i) => <span key={t} className={i === 0 ? 'font-medium text-slate-600' : ''}>{i > 0 ? `· ${t}` : t}</span>)}
          </div>
        )
      })()}

      {/* 判定（一句）：引擎說偏離軌道 → 聽引擎（最新記錄）；否則 weekly_tasks；再不然 fallback。
          語意用 CSS 色點承接（emoji 依 DESIGN.md 全數移除）：amber=要留意、emerald=在軌道、blue=推去開始、slate=中性 */}
      {(engineTitle || verdict || fallbackTitle) && (
        <div className="flex items-start gap-2 mb-3">
          <span className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${
            engineTitle
              ? 'bg-amber-500'
              : verdict
                ? (isPositive ? 'bg-emerald-500' : isNegative ? 'bg-amber-500' : 'bg-slate-300')
                : startMode ? 'bg-primary-500' : 'bg-slate-300'
          }`} />
          <p className={`text-base font-bold leading-snug ${
            engineTitle
              ? 'text-amber-700'
              : verdict
                ? (isPositive ? 'text-emerald-700' : isNegative ? 'text-amber-700' : 'text-slate-900')
                : startMode ? 'text-primary-700' : 'text-slate-700'
          }`}>
            {engineTitle ?? (verdict ? verdict.title : fallbackTitle)}
          </p>
        </div>
      )}

      {/* 今天的重點（動作）
          ⚠️ 2026-08-26：這裡原本寫「今天就一件：」，但下面的 QuickActions 也有一句
          「今天只有一件必做 · 量早晨體重」—— 同一個畫面上兩句「只有一件」，
          講的還是不同件事（一個是訓練/營養方向，一個是必做的紀錄動作）。
          震宣回報「介面感覺更複雜了」，互相打架的指令比多一個按鈕更糟。
          必做的那件留給 QuickActions（它才是真的只有一件），這裡改成「訓練與飲食的重點」。 */}
      {actionText && (
        <div className="rounded-xl bg-slate-50 px-3.5 py-3">
          <p className="text-sm text-slate-800 leading-relaxed">
            <span className="font-semibold text-slate-900">今天的重點：</span>
            {actionText}。
            {isPositive && !engineAction && <span className="text-slate-500"> 其他照走、別亂改。</span>}
          </p>
        </div>
      )}

      {/* 佐證小字 + 血檢留意（跟減脂軌跡是兩個軸，收斂成一句，不當紅字嚇人） */}
      {(engineDetail || verdict?.detail || hasAttention) && (
        <p className="text-xs text-slate-500 leading-relaxed mt-2.5">
          {engineDetail ?? verdict?.detail}
          {hasAttention && (
            <>
              {(engineDetail ?? verdict?.detail) ? ' · ' : ''}
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
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
              <span>{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default memo(TodayHeadlineInner)
