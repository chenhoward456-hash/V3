import { useMemo } from 'react'

interface HomeMetricStripProps {
  showWeight?: boolean
  showCarbs?: boolean
  /** 最新單筆體重 —— 只在沒有足夠序列算 7 天平均時才用 */
  weight: number | string | null | undefined
  carbs: number | string | null | undefined
  streak: number
  weightDate: string | null | undefined
  /** 體重序列：有的話主數字改成 7 天平均＋4 週走勢 */
  weights?: { date: string; weight: number }[]
  /** 台灣日 YYYY-MM-DD */
  today?: string
  targetWeight?: number | null
}

/**
 * 首頁主角區塊（視覺：Codex 2026-10-07；數字：Claude 修）
 *
 * ⚠️ 數字規則（見 ~/codex-visual-brief.md「數字放大的規則」）：
 * - 主數字用 7 天平均，不用今天單日 —— 單日會因水分跳 1kg，學員看單日會焦慮（震宣 10/3 的 84.0）
 * - 連續記錄 <3 天不放大（「連續記錄 1 天」對紀錄很勤只是斷一天的人是打擊），改顯示距目標
 */
const DAY = 86400000
const dnum = (d: string) => Date.parse(d + 'T00:00:00Z')
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const STREAK_SHOW_MIN = 3

export default function HomeMetricStrip({
  showWeight = true,
  showCarbs = true,
  weight,
  carbs,
  streak,
  weightDate,
  weights,
  today,
  targetWeight,
}: HomeMetricStripProps) {
  const w = useMemo(() => {
    if (!weights || !today) return null
    const t = dnum(today)
    const pts = weights
      .filter(p => Number.isFinite(p.weight) && dnum(p.date) <= t && t - dnum(p.date) <= 27 * DAY)
      .sort((a, b) => a.date.localeCompare(b.date))
    const thisWeek = pts.filter(p => t - dnum(p.date) <= 6 * DAY).map(p => p.weight)
    if (!thisWeek.length) return null
    const lastWeek = pts.filter(p => t - dnum(p.date) > 6 * DAY && t - dnum(p.date) <= 13 * DAY).map(p => p.weight)
    const now = avg(thisWeek)
    const delta = lastWeek.length ? now - avg(lastWeek) : null
    let path: string | null = null
    if (pts.length >= 3) {
      const W = 160, H = 36
      const ys = pts.map(p => p.weight)
      let lo = Math.min(...ys), hi = Math.max(...ys)
      if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - 0.75; hi = m + 0.75 }
      const x0 = t - 27 * DAY
      path = pts.map((p, i) => {
        const x = ((dnum(p.date) - x0) / (27 * DAY)) * W
        const y = 2 + (1 - (p.weight - lo) / (hi - lo)) * (H - 4)
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
    }
    return { now, delta, path }
  }, [weights, today])

  const mainValue = w ? w.now.toFixed(1) : (weight ?? '—')
  const current = w ? w.now : (weight != null && weight !== '' ? Number(weight) : null)
  const toGo = targetWeight != null && current != null && Number.isFinite(current) ? targetWeight - current : null
  const showStreak = streak >= STREAK_SHOW_MIN

  return (
    <section
      aria-label="體重、今天碳水與進度"
      className="overflow-hidden rounded-2xl bg-slate-950 text-white"
    >
      <dl className={`grid h-full ${showWeight ? 'grid-cols-[1.2fr_1fr]' : 'grid-cols-1'}`}>
        {showWeight && <div className="row-span-2 flex flex-col justify-center px-6 py-7">
          <dt className="text-xs font-medium tracking-widest text-slate-400">{w ? '7 天平均體重' : '體重'}</dt>
          <dd className="mt-3 flex items-baseline gap-2.5 tabular-nums">
            <span className="text-[56px] font-medium leading-none tracking-[-0.06em]">
              {mainValue}
            </span>
            {mainValue !== '—' && <span className="text-sm text-slate-400">kg</span>}
          </dd>
          {w?.delta != null ? (
            <dd className="mt-3 text-xs tabular-nums text-slate-400">
              比上週 <span className="text-slate-200 font-medium">{w.delta > 0 ? '+' : w.delta < 0 ? '−' : '±'}{Math.abs(w.delta).toFixed(1)}</span>
            </dd>
          ) : weightDate ? <dd className="mt-3 text-xs tabular-nums text-slate-400">{weightDate}</dd> : null}
          {w?.path && (
            <dd className="mt-3">
              <svg viewBox="0 0 160 36" className="w-full max-w-[160px] h-9 overflow-visible" role="img" aria-label="近 4 週體重走勢">
                <path d={w.path} fill="none" stroke="currentColor" className="text-slate-300" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </dd>
          )}
        </div>}
        {showCarbs && <div className="border-l border-white/10 px-5 py-5">
          <dt className="text-xs font-medium tracking-widest text-slate-400">碳水目標</dt>
          <dd className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-[32px] font-medium leading-none tracking-[-0.04em]">
              {carbs ?? '—'}
            </span>
            {carbs != null && <span className="text-xs text-slate-400">g</span>}
          </dd>
        </div>}
        {showStreak ? (
          <div className="border-l border-t border-white/10 px-5 py-5">
            <dt className="text-xs font-medium tracking-widest text-slate-400">連續記錄</dt>
            <dd className="mt-3 flex items-baseline gap-2 tabular-nums">
              <span className="text-[32px] font-medium leading-none tracking-[-0.04em]">{streak}</span>
              <span className="text-xs text-slate-400">天</span>
            </dd>
          </div>
        ) : toGo != null ? (
          <div className="border-l border-t border-white/10 px-5 py-5">
            <dt className="text-xs font-medium tracking-widest text-slate-400">距目標</dt>
            <dd className="mt-3 flex items-baseline gap-2 tabular-nums">
              <span className="text-[32px] font-medium leading-none tracking-[-0.04em]">
                {Math.abs(toGo) < 0.05 ? '0' : `${toGo > 0 ? '+' : '−'}${Math.abs(toGo).toFixed(1)}`}
              </span>
              <span className="text-xs text-slate-400">kg</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
