'use client'

import { memo } from 'react'
import { daysUntilDateTW } from '@/lib/date-utils'
import { projectMetricToDate, projectWeightVerdict } from '@/lib/comp-projection'

interface BodyPoint { date: string; weight: number | null; body_fat: number | null }

interface CompWarRoomProps {
  bodyData: BodyPoint[]
  competitionDate: string | null
  targetWeight: number | null
  targetBodyFat: number | null
  prepPhase?: string | null
}

// 投影邏輯抽到 @/lib/comp-projection（與教練端 /admin 備賽倒數共用，確保判斷一致）
const projectMetric = projectMetricToDate

/** 最近一筆非空值（不管多久前都拿，用來顯示「現在」） */
function latest(rows: { date: string; value: number | null }[]): number | null {
  const v = rows.filter(r => r.value != null).sort((a, b) => b.date.localeCompare(a.date))
  return v.length ? (v[0].value as number) : null
}

function CompWarRoomInner({ bodyData, competitionDate, targetWeight, targetBodyFat, prepPhase }: CompWarRoomProps) {
  if (!competitionDate) return null
  const daysLeft = daysUntilDateTW(competitionDate)
  if (daysLeft < 0) return null
  // 備賽後期低碳 → 肝醣+水分下降 → InBody 肌肉偏低、體脂%被高估 → 體脂量測越來越不準
  const latePrep = daysLeft <= 28 || prepPhase === 'peak_week'

  const wRows = bodyData.map(b => ({ date: b.date, value: b.weight }))
  const bfRows = bodyData.map(b => ({ date: b.date, value: b.body_fat }))
  // 體重變化快 → 看近 21 天；體脂量得少、變化慢 → 放寬到 60 天
  // 體重：走共用的 projectWeightVerdict（14 天窗、容差 1.0kg）→ 與教練端 /admin 備賽倒數完全一致
  const wv = projectWeightVerdict(wRows, competitionDate, targetWeight)
  const w = wv ? { projected: wv.projected, slopePerWeek: wv.slopePerWeek } : null
  const wj = wv ? { ok: wv.onTrack, gap: wv.gap } : null
  const bf = projectMetric(bfRows, competitionDate, 60)
  const curWeight = latest(wRows)
  const curBf = latest(bfRows)

  // 體脂判定（cut：越低越好；±0.3 容差）— 僅作參考，後期量測失真
  const judge = (proj: number | null, target: number | null) => {
    if (proj == null || target == null) return null
    const gap = proj - target
    if (gap <= 0.3) return { ok: true, gap }
    return { ok: false, gap }
  }
  const bfj = bf ? judge(bf.projected, targetBodyFat) : null

  // 判定「會不會準時」以體重為主（天天量、可靠）。體脂是目標但 InBody 量測會失真，不當紅燈主依據。
  let level: 'on' | 'tight' | 'miss' | 'insufficient' = 'insufficient'
  if (wj) {
    if (wj.ok) level = 'on'
    else if (wj.gap > 2 || daysLeft <= 14) level = 'miss'
    else level = 'tight'
  } else if (bfj && !latePrep) {
    // 沒體重投影、又非後期 → 退而用體脂(仍標caveat)
    level = bfj.ok ? 'on' : bfj.gap > 1.5 ? 'miss' : 'tight'
  }

  // 組合白話結論（體重主、體脂輔且標明量測限制）
  const parts: string[] = []
  if (wj) parts.push(wj.ok ? '體重會準時達標' : `體重還差 ${wj.gap.toFixed(1)}kg、要加速`)
  else if (curWeight != null) parts.push('體重資料不足、多記幾天')
  if (bfj) parts.push(bfj.ok ? '體脂趨勢也到位' : `體脂目標還差 ${bfj.gap.toFixed(1)}%（量測僅參考）`)
  const headline = parts.join('；')

  const styles = {
    on: { pill: 'bg-emerald-100 text-emerald-700', emoji: '🟢', label: '進度達標' },
    tight: { pill: 'bg-amber-100 text-amber-700', emoji: '🟡', label: '要加速' },
    miss: { pill: 'bg-red-100 text-red-700', emoji: '🔴', label: '來不及' },
    insufficient: { pill: 'bg-slate-100 text-slate-500', emoji: '⚪', label: '資料不足' },
  }[level]

  const weightGap = curWeight != null && targetWeight != null ? Math.abs(curWeight - targetWeight) : null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-900">🏆 備賽作戰室</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.pill}`}>{styles.emoji} {styles.label}</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{daysLeft}</span>
          <span className="text-xs text-gray-400 ml-0.5">天</span>
        </div>
      </div>

      {headline && (
        <p className="text-sm text-gray-700 mb-3 leading-snug">會不會準時上台？<span className="font-semibold">{headline}</span></p>
      )}

      {/* 體重（主、可靠）+ 體脂（次、參考） */}
      <div className="space-y-2">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[11px] text-gray-400 mb-0.5">體重 · 現在 → 上台{w?.slopePerWeek != null ? `（${w.slopePerWeek > 0 ? '+' : ''}${w.slopePerWeek.toFixed(1)} kg/週）` : ''}</p>
          <p className="text-sm text-gray-700">
            <span className="font-bold text-gray-900 tabular-nums">{curWeight != null ? curWeight.toFixed(1) : '--'}</span>
            <span className="text-gray-400"> → {targetWeight ?? '--'} kg</span>
            {weightGap != null && weightGap > 0 && <span className="text-gray-400">（差 {weightGap.toFixed(1)}）</span>}
          </p>
          {w?.projected != null ? (
            <p className={`text-xs mt-1 font-medium ${wj ? (wj.ok ? 'text-emerald-600' : 'text-rose-500') : 'text-gray-500'}`}>
              比賽日預測 <span className="tabular-nums">{w.projected.toFixed(1)} kg</span>{wj ? (wj.ok ? ' ✓ 達標' : `（仍差 ${(w.projected - (targetWeight ?? 0)).toFixed(1)}）`) : ''}
            </p>
          ) : (
            <p className="text-xs mt-1 text-amber-600">多記幾天才能預測趨勢</p>
          )}
        </div>
        {(curBf != null || bf) && (
          <div className="flex items-baseline justify-between text-sm px-1">
            <span className="text-xs text-gray-400">體脂 · 參考</span>
            <span className="text-gray-600 tabular-nums">{curBf != null ? curBf.toFixed(1) : '--'} → {targetBodyFat ?? '--'}%{!latePrep && bf?.projected != null ? ` · 預測 ${bf.projected.toFixed(1)}%` : ''}</span>
          </div>
        )}
      </div>

      {(curBf != null || bf) && (
        <p className="text-[11px] text-amber-600 mt-3 leading-snug">
          ℹ️ 體脂 InBody 量{latePrep ? '，備賽後期' : ''}低碳→肝醣與水分↓→<b>體脂%被高估</b>，以體重＋外觀＋教練判斷為準。
        </p>
      )}
      {level === 'insufficient' && curBf == null && !bf && (
        <p className="text-xs text-gray-400 mt-3">持續每天記體重，累積 ~1 週系統就能預測你比賽日會落在哪。</p>
      )}
    </div>
  )
}

// 首屏卡片：props 由 page.tsx 穩定引用（EMPTY_ARRAY），memo 擋掉父層 state 變動引起的重繪
export default memo(CompWarRoomInner)
