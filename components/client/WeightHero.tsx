'use client'

import { memo, useMemo } from 'react'

/**
 * 首頁主角數字：7 天平均體重 ＋ 4 週走勢。
 *
 * ⚠️ 2026-10-07 Howard：「我之前丟參考給你，為什麼你做不出來」。
 * 前幾輪只做減法（拔漸層、拔 emoji、卡片統一），結果首屏全是一句一句的字，
 * 學員每天打開最想知道的「我現在幾公斤、往哪走」沒有一個看得到的數字。
 * 這裡給它一個主角：大數字 + 一條線，目標畫成虛線。
 *
 * 用 7 天平均不用今天的單筆：單日會因水分上下跳 1kg，學員看單日只會焦慮（震宣 10/3 的 84.0）。
 */

type Point = { date: string; weight: number }

const DAY = 86400000
const dnum = (d: string) => Date.parse(d + 'T00:00:00Z')

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }

function WeightHeroInner({ weights, targetWeight, today }: { weights: Point[]; targetWeight: number | null; today: string }) {
  const view = useMemo(() => {
    const t = dnum(today)
    const pts = weights
      .filter(p => Number.isFinite(p.weight) && t - dnum(p.date) <= 27 * DAY && dnum(p.date) <= t)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (pts.length < 2) return null
    const thisWeek = pts.filter(p => t - dnum(p.date) <= 6 * DAY).map(p => p.weight)
    const lastWeek = pts.filter(p => t - dnum(p.date) > 6 * DAY && t - dnum(p.date) <= 13 * DAY).map(p => p.weight)
    const now = thisWeek.length ? avg(thisWeek) : pts[pts.length - 1].weight
    const delta = thisWeek.length && lastWeek.length ? now - avg(lastWeek) : null

    // 走勢線：x 依日期、y 依體重；目標在範圍附近（±3kg）才畫進來，太遠只寫字
    const W = 320, H = 72, PAD = 6
    const ys = pts.map(p => p.weight)
    const showTarget = targetWeight != null && Math.abs(targetWeight - now) <= 3
    let lo = Math.min(...ys, ...(showTarget ? [targetWeight!] : []))
    let hi = Math.max(...ys, ...(showTarget ? [targetWeight!] : []))
    if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - 0.75; hi = m + 0.75 }
    const x0 = t - 27 * DAY
    const X = (d: string) => PAD + ((dnum(d) - x0) / (27 * DAY)) * (W - PAD * 2)
    const Y = (w: number) => PAD + (1 - (w - lo) / (hi - lo)) * (H - PAD * 2)
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.weight).toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]
    return { now, delta, n: thisWeek.length, path, W, H, lastX: X(last.date), lastY: Y(last.weight), targetY: showTarget ? Y(targetWeight!) : null, lo, hi }
  }, [weights, targetWeight, today])

  if (!view) return null
  const toGo = targetWeight != null ? targetWeight - view.now : null

  return (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-400 tracking-wide">7 天平均體重</p>
          <p className="mt-0.5 leading-none text-slate-900 tabular-nums">
            <span className="text-[44px] font-semibold tracking-tight">{view.now.toFixed(1)}</span>
            <span className="text-base font-medium text-slate-400 ml-1">kg</span>
          </p>
        </div>
        <div className="text-right pb-1 tabular-nums">
          {view.delta != null && (
            <p className="text-sm font-semibold text-slate-700">
              {view.delta > 0 ? '+' : view.delta < 0 ? '−' : '±'}{Math.abs(view.delta).toFixed(1)}
              <span className="text-xs font-normal text-slate-400 ml-1">比上週</span>
            </p>
          )}
          {toGo != null && (
            <p className="text-xs text-slate-400 mt-0.5">
              {Math.abs(toGo) < 0.05 ? '已到目標' : `距目標 ${toGo > 0 ? '+' : '−'}${Math.abs(toGo).toFixed(1)} kg`}
            </p>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${view.W} ${view.H}`} className="w-full h-[72px] mt-3 overflow-visible" role="img" aria-label="近 4 週體重走勢">
        {view.targetY != null && (
          <>
            <line x1="0" x2={view.W} y1={view.targetY} y2={view.targetY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 4" />
            <text x={view.W} y={view.targetY - 4} textAnchor="end" className="fill-slate-400" fontSize="10">目標 {targetWeight}</text>
          </>
        )}
        <path d={view.path} fill="none" stroke="#1E4A73" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={view.lastX} cy={view.lastY} r="3.5" fill="#1E4A73" />
        <circle cx={view.lastX} cy={view.lastY} r="7" fill="#1E4A73" opacity="0.12" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-300 tabular-nums mt-1">
        <span>4 週前</span>
        <span>今天</span>
      </div>
    </div>
  )
}

export default memo(WeightHeroInner)
