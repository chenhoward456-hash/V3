'use client'

import { useMemo, useState } from 'react'
import { checkPlanHealth, MOVEMENT_PATTERNS } from '@/lib/plan-health'
import { VOLUME_MIN, VOLUME_MAX, CORE_MUSCLES } from '@/lib/volume-audit'

/**
 * 課表健檢 —— 設完課表當下就看到「這份漏了什麼」。
 *
 * ⚠️ 為什麼不做「計畫 vs 實做」：2026-09-23 查 production，四個活躍學員裡
 *    三個的 training_sets 是空的。那個覆蓋率下算出來的落差分不出
 *    「他沒做」還是「他沒記」，講出去會冤枉人。
 *    課表是教練自己寫的，資料一定完整 —— 所以先檢查課表本身。
 */
export default function PlanHealthCheck({ plan }: { plan: unknown }) {
  const h = useMemo(() => checkPlanHealth(plan), [plan])
  const [open, setOpen] = useState(false)
  const [openPatterns, setOpenPatterns] = useState(false)

  if (!h.hasPlan) return null
  const max = Math.max(VOLUME_MAX, ...h.rows.map((r) => r.sets))
  const unnoted = h.gaps.filter((g) => !g.notedByCoach)
  const noted = h.gaps.filter((g) => g.notedByCoach)
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`

  return (
    <div className="mt-4 border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-baseline justify-between gap-3 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-gray-900">課表健檢</h4>
        <span className="text-xs text-slate-400 tabular-nums">
          {h.dayCount} 天 · 週 {h.totalSets} 組
          {h.excludedSets > 0 && <span className="ml-1.5">（暖身／有氧 {h.excludedSets} 組不計）</span>}
        </span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {/* ⚠️ 認不出的動作放最前面：有一個認不出來，那個部位的組數就整批不見，
             下面所有的缺口／失衡判斷都會跟著失真。修這個的優先度高於修課表本身。 */}
        {h.unresolved.length > 0 && (
          <div className="flex gap-2.5 items-start">
            <span className="shrink-0 mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
              認不出
            </span>
            <p className="text-sm text-slate-700 leading-relaxed min-w-0">
              {h.unresolved.slice(0, 6).join('、')}
              {h.unresolved.length > 6 && ` 等 ${h.unresolved.length} 個`}
              <span className="block text-xs text-slate-500 mt-0.5">
                這些動作沒算進組數，所以下面的數字會偏低。改成常見的中文名稱，或補進 lib/volume-audit.ts。
              </span>
            </p>
          </div>
        )}

        {h.imbalances.map((im) => (
          <div key={`${im.high}-${im.low}`} className="flex gap-2.5 items-start">
            {/* ⚠️ 教練在 phaseNote 裡交代過的，降級成灰色——那是處方不是疏漏。
                 但不拿掉，因為寫了理由不代表數字就一定對。 */}
            <span className={`shrink-0 mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded ${
              im.notedByCoach ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-700'
            }`}>
              {im.notedByCoach ? '已註明' : '失衡'}
            </span>
            <p className="text-sm text-slate-700 min-w-0">
              <span className="tabular-nums">
                {im.highLabel} <span className="font-semibold">{im.highSets}</span>
                <span className="text-slate-300 mx-1">:</span>
                {im.lowLabel} <span className="font-semibold">{im.lowSets}</span>
                <span className="text-slate-400 ml-1.5 text-xs">
                  {im.ratio === Infinity ? '∞' : im.ratio.toFixed(1)}:1
                </span>
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">{im.why}</span>
            </p>
          </div>
        ))}

        {unnoted.length > 0 && (
          <div className="flex gap-2.5 items-start">
            <span className="shrink-0 mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
              缺口
            </span>
            <p className="text-sm min-w-0 flex flex-wrap gap-x-3 gap-y-0.5">
              {unnoted.map((g) => (
                <span key={g.muscle} className="tabular-nums">
                  {g.severity === 'zero' ? (
                    <span className="text-rose-600 font-medium">{g.label} 0 組</span>
                  ) : (
                    <span className="text-slate-700">{g.label} {g.direct} 組</span>
                  )}
                  {g.indirect > 0 && <span className="text-slate-400 text-xs">（間接 {g.indirect}）</span>}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* 教練已經在 phaseNote 裡交代過的，另外一排、灰的。
            看得到但不吵——那是處方，不是要修的東西。 */}
        {noted.length > 0 && (
          <div className="flex gap-2.5 items-start">
            <span className="shrink-0 mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              已註明
            </span>
            <p className="text-sm text-slate-500 min-w-0 flex flex-wrap gap-x-3 gap-y-0.5">
              {noted.map((g) => (
                <span key={g.muscle} className="tabular-nums">
                  {g.label} {g.direct} 組
                </span>
              ))}
              <span className="text-xs text-slate-400 w-full">課表備註裡有提到這些部位，當成刻意的處理。</span>
            </p>
          </div>
        )}

        {!h.hasFindings && (
          <p className="text-sm text-slate-600">
            {noted.length > 0 || h.imbalances.length > 0
              ? '偏離的部位課表備註裡都交代過了，沒有沒解釋的缺口。'
              : '沒有掛零的部位，對立肌群的比例也在範圍內。'}
          </p>
        )}

        {/* ⭐ 兩把尺並列。
             部位覆蓋是**肌肥大**的標準；拿它量運動表現課表會得到一堆假警報。
             不猜取向 —— 兩把都給，標清楚各自在量什麼，讓教練自己看哪把適用。 */}
        <div className="mt-1 pt-2.5 border-t border-slate-100 grid sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 transition-colors"
          >
            <span className="block text-[11px] text-slate-400">部位覆蓋 · 肌肥大取向</span>
            <span className="block text-sm text-slate-900 mt-0.5 tabular-nums">
              {CORE_MUSCLES.length} 項中 <span className="font-medium">{CORE_MUSCLES.length - h.gaps.filter((g) => g.severity === 'zero').length}</span> 項有排
              {unnoted.length > 0 && <span className="text-rose-600 ml-1.5">· {unnoted.length} 項缺口</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpenPatterns((v) => !v)}
            className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 transition-colors"
          >
            <span className="block text-[11px] text-slate-400">動作模式 · 運動表現取向</span>
            <span className="block text-sm text-slate-900 mt-0.5 tabular-nums">
              {MOVEMENT_PATTERNS.length} 種中 <span className="font-medium">{h.patternsCovered}</span> 種有排
              {h.patternsCovered < MOVEMENT_PATTERNS.length && (
                <span className="text-amber-700 ml-1.5">· 缺 {MOVEMENT_PATTERNS.length - h.patternsCovered} 種</span>
              )}
            </span>
          </button>
        </div>

        {openPatterns && (
          <div className="flex flex-col gap-1.5 pt-1">
            {h.patterns.map((p) => (
              <div key={p.pattern} className="flex items-baseline gap-3 text-xs">
                <span className="w-16 shrink-0 text-slate-600">{p.label}</span>
                <span className={`w-10 shrink-0 text-right tabular-nums font-medium ${p.sets === 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                  {p.sets} 組
                </span>
                <span className="text-slate-400 leading-relaxed min-w-0">{p.why}</span>
              </div>
            ))}
            <p className="text-xs text-slate-400 pt-1 leading-relaxed">
              單關節（補強）另有 {h.isoSets} 組，不算模式。
              <br />
              ⚠️ 這八種是<span className="text-slate-500 font-medium">運動表現／功能</span>取向的檢查點。
              純健美課表缺「負重行走」不是問題，就像籃球課表缺「肩中束」不是問題
              —— 兩把尺量的是不同的東西。
            </p>
          </div>
        )}

        {open && (
          <div className="flex flex-col gap-2 pt-1">
            {h.rows.map((r) => (
              <div key={r.muscle} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-slate-600">{r.label}</span>
                <div className="flex-1 min-w-0 relative h-2 rounded-sm bg-slate-100 overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-slate-300/70"
                    style={{ left: pct(VOLUME_MIN), width: `calc(${pct(VOLUME_MAX)} - ${pct(VOLUME_MIN)})` }}
                    aria-hidden
                  />
                  <div className="absolute inset-y-0 left-0 bg-primary-600" style={{ width: pct(r.sets) }} />
                </div>
                {/* ⚠️ 數字一律中性灰。原本 under 標橘色，結果 3 天課表的 12 個部位全橘，
                     看起來像整份都不對——但少天數／專項課表本來就會低於 10-20。
                     狀態交給上面的「缺口／失衡／已註明」三排講，那裡才知道是不是刻意的。
                     （DESIGN.md：顏色只做語意，不做裝飾。） */}
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  <span className="font-medium">{r.sets}</span> 組
                </span>
              </div>
            ))}
            <p className="text-xs text-slate-400 tabular-nums pt-1">
              推 {h.push} : 拉 {h.pull}　·　過頭位的拉 {h.overheadPull} 組
              <span className="ml-2">
                灰帶＝{VOLUME_MIN}–{VOLUME_MAX} 組／部位／週的常見參考範圍（天數少或專項課表本來就會偏離）
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
