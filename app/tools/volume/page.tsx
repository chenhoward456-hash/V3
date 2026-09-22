'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { parseWorkout, toSetRows } from '@/lib/workout-parse'
import {
  actualVolume,
  findGaps,
  findImbalances,
  pushPullRatio,
  MUSCLE_LABEL,
  VOLUME_MIN,
  VOLUME_MAX,
} from '@/lib/volume-audit'

/**
 * ⚠️ 低摩擦鐵律（見記憶 feedback_low_friction_tools）：
 *    價值要「不輸入就拿得到」。但組數對帳本質上就是要有課表才算得出來，
 *    所以改用**預填一份完整的四練課表**——一進來就是完整結果，使用者改成自己的。
 *
 * 這份範例刻意保留三個真實世界最常見的問題型態：
 *   · 肩後束遠少於中束（幾乎每份課表都有）
 *   · 小腿掛零
 *   · 核心掛零
 * 這樣第一眼看到的就是「原來這東西在幫我抓什麼」。
 */
const SAMPLE = `推日
啞鈴肩推 3組 8~10下
上斜臥推 3組 6~10下
機械胸推 3組 8~12下
夾胸 3組 12下
前平舉 3組 12~15下
三頭下壓 3組 10~12下

拉日
槓鈴划船 3組 10~12下
滑輪下拉 3組 10~12下
坐姿划船 3組 10~12下
側平舉 3組 12~15下
反向飛鳥 3組 12~15下
二頭彎舉 3組 10~12下

腿日
深蹲 3組 8~12下
臀推 3組 8~12下
腿彎舉 3組 10~15下
腿伸 3組 12~15下
弓步 3組 10下

上肢日
器械肩推 3組 8~10下
側平舉 5組 12~15下
坐姿划船 3組 10~12下
三頭伸展 3組 10~12下
二頭彎舉 3組 10~12下`

const CARD = 'bg-white border border-slate-200 rounded-2xl p-5'

export default function VolumeToolPage() {
  const [text, setText] = useState(SAMPLE)
  const [isSample, setIsSample] = useState(true)

  const result = useMemo(() => {
    const parsed = parseWorkout(text)
    const volume = actualVolume(toSetRows(parsed.exercises))
    const rows = (Object.keys(volume.byMuscle) as Array<keyof typeof MUSCLE_LABEL>)
      .map((m) => ({ muscle: m, label: MUSCLE_LABEL[m], sets: volume.byMuscle[m] ?? 0 }))
      .sort((a, b) => b.sets - a.sets)
    return {
      parsed,
      volume,
      rows,
      gaps: findGaps(volume),
      imbalances: findImbalances(volume),
      ratio: pushPullRatio(volume),
      guessed: parsed.exercises.filter((e) => e.confidence === 'guess'),
    }
  }, [text])

  const handleChange = useCallback((v: string) => {
    setText(v)
    if (isSample) {
      setIsSample(false)
      trackEvent('volume_tool_edit', {})
    }
  }, [isSample])

  const clear = useCallback(() => {
    setText('')
    setIsSample(false)
  }, [])

  const restore = useCallback(() => {
    setText(SAMPLE)
    setIsSample(true)
  }, [])

  const max = Math.max(VOLUME_MAX, ...result.rows.map((r) => r.sets))
  const hasContent = result.parsed.exercises.length > 0
  // 明細表只有「真的有東西要確認」時才預設攤開
  const needsAttention = result.guessed.length > 0 || result.volume.unresolved.length > 0

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-6">

        {/* ── 標題 ── */}
        <header className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-widest uppercase text-slate-400">課表工具</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-snug text-balance">
            你的課表，每個部位一週練了幾組？
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            寫課表的時候最常漏掉的不是動作，是<strong className="font-medium text-slate-900">某個部位根本沒被排到</strong>。
            那件事用眼睛看不出來，要把整週加總才會現形。
          </p>
          <p className="text-xs text-slate-400">
            貼上課表就會算。全部在你的瀏覽器裡跑，不上傳、不儲存。
          </p>
        </header>

        {/* ── 輸入 ── */}
        <section className={CARD}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-900">把課表貼進來</h2>
            <div className="flex items-center gap-3 text-xs">
              {isSample ? (
                <span className="text-slate-400">目前是範例</span>
              ) : (
                <button type="button" onClick={restore} className="text-primary-600 hover:text-primary-700 hover:underline">
                  放回範例
                </button>
              )}
              {text && (
                <button type="button" onClick={clear} className="text-slate-400 hover:text-slate-600 hover:underline">
                  清空
                </button>
              )}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
            rows={14}
            aria-label="課表內容"
            placeholder={'一行一個動作，例如：\n啞鈴肩推 3組 8~10下\n側平舉 12下x4\n引體向上*10*2'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600"
          />
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            這幾種寫法都讀得懂：<span className="text-slate-500">3組</span>、
            <span className="text-slate-500">8下x4</span>、
            <span className="text-slate-500">動作*12*3</span>、
            <span className="text-slate-500">腿推 3、前蹲 3</span>。日期標題和分隔線會自動跳過。
          </p>
        </section>

        {!hasContent ? (
          <section className={`${CARD} text-center py-10`}>
            <p className="text-sm text-slate-500">貼上課表就會出現結果。</p>
            <button type="button" onClick={restore} className="mt-3 text-sm text-primary-600 hover:text-primary-700 hover:underline">
              先看範例
            </button>
          </section>
        ) : (
          <>
            {/* ── 先講最重要的：缺口與失衡 ── */}
            {(result.gaps.length > 0 || result.imbalances.length > 0) && (
              <section className={CARD}>
                <h2 className="text-sm font-semibold text-slate-900 mb-1">先看這裡</h2>
                <p className="text-xs text-slate-500 mb-4">下面這些是把整週加起來才看得到的東西。</p>
                <div className="flex flex-col gap-3">
                  {result.imbalances.map((im) => (
                    <div key={`${im.high}-${im.low}`} className="flex gap-3 items-start">
                      <span className="shrink-0 mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">失衡</span>
                      <div className="min-w-0 text-sm">
                        <p className="text-slate-900 tabular-nums">
                          {im.highLabel} <span className="font-semibold">{im.highSets}</span>
                          <span className="text-slate-300 mx-1.5">:</span>
                          {im.lowLabel} <span className="font-semibold">{im.lowSets}</span>
                          <span className="text-slate-400 ml-2 text-xs">
                            {im.ratio === Infinity ? '∞' : im.ratio.toFixed(1)}:1
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{im.why}</p>
                      </div>
                    </div>
                  ))}
                  {result.gaps.length > 0 && (
                    <div className="flex gap-3 items-start">
                      <span className="shrink-0 mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">缺口</span>
                      <div className="min-w-0 text-sm flex flex-wrap gap-x-4 gap-y-1">
                        {result.gaps.map((g) => (
                          <span key={g.muscle} className="tabular-nums">
                            {g.severity === 'zero' ? (
                              <span className="text-rose-600 font-medium">{g.label} 0 組</span>
                            ) : (
                              <span className="text-slate-700">{g.label} {g.direct} 組</span>
                            )}
                            {g.indirect > 0 && <span className="text-slate-400 text-xs">（間接 {g.indirect}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                  缺口的門檻是「0 組或 ≤2 組」＝幾乎沒碰，而且算的是<span className="text-slate-500">直接 ＋ 間接</span>
                  —— 所以被別的動作餵飽的部位（例如胸推會練到肩前束）不會被誤報。斜方、前臂、內收、外展不列入檢查。
                </p>
              </section>
            )}

            {/* ── 每個部位幾組 ── */}
            <section className={CARD}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="text-sm font-semibold text-slate-900">每個部位一週幾組</h2>
                <span className="text-xs text-slate-400 tabular-nums">
                  共 {result.volume.total} 組
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                灰色區帶是 {VOLUME_MIN}–{VOLUME_MAX} 組，肌肥大研究裡常見的參考範圍。
                <span className="text-slate-400">不是每個人都要落在裡面 —— 維持期、備賽期、專攻某部位時本來就會偏。</span>
              </p>
              <div className="flex flex-col gap-2.5">
                {result.rows.map((r) => {
                  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`
                  const tone =
                    r.sets < VOLUME_MIN ? 'text-amber-700' : r.sets > VOLUME_MAX ? 'text-rose-700' : 'text-slate-500'
                  return (
                    <div key={r.muscle} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs text-slate-600">{r.label}</span>
                      <div className="flex-1 min-w-0 relative h-2.5 rounded-sm bg-slate-100 overflow-hidden">
                        {/* 參考區帶 */}
                        <div
                          className="absolute inset-y-0 bg-slate-300/70"
                          style={{ left: pct(VOLUME_MIN), width: `calc(${pct(VOLUME_MAX)} - ${pct(VOLUME_MIN)})` }}
                          aria-hidden
                        />
                        <div className="absolute inset-y-0 left-0 bg-primary-600" style={{ width: pct(r.sets) }} />
                      </div>
                      <span className={`w-14 shrink-0 text-right text-xs tabular-nums ${tone}`}>
                        <span className="font-medium">{r.sets}</span> 組
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 tabular-nums">
                <span>推 {result.ratio.push} : 拉 {result.ratio.pull}</span>
                <span>過頭位的拉 {result.volume.overheadPull} 組<span className="text-slate-400">（背闊覆蓋）</span></span>
                {result.volume.excluded > 0 && (
                  <span className="text-slate-400">暖身／有氧／Posing {result.volume.excluded} 組（不計入）</span>
                )}
              </div>
            </section>

            {/* ── 解析明細：哪些讀懂了、哪些沒有 ──
                 ⚠️ 預設收合。一份四練課表有 20+ 個動作、絕大多數是「3 組」，
                    全部攤開會佔掉整頁一半而且沒有資訊量。
                    只有「有推測組數或有認不出的動作」時才預設打開——那時它才重要。 */}
            <section className={CARD}>
              <details open={needsAttention}>
                <summary className="cursor-pointer list-none flex items-baseline justify-between gap-3 -m-1 p-1 rounded">
                  <span className="text-sm font-semibold text-slate-900">我讀到的是這些</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">
                    {needsAttention ? '有幾個要確認' : `${result.parsed.exercises.length} 個動作 · 點開核對`}
                  </span>
                </summary>
              <p className="text-xs text-slate-500 mt-2 mb-4">
                數字讀錯的話上面全部都不準，所以有疑慮就對一下。
              </p>

              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm min-w-[340px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="text-left font-medium pb-2">動作</th>
                      <th className="text-right font-medium pb-2 w-16">組數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.parsed.exercises.map((e, i) => (
                      <tr key={`${e.raw}-${i}`} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-700">
                          {e.name}
                          {e.confidence === 'guess' && (
                            <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              組數是推測
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-900 font-medium">{e.sets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.guessed.length > 0 && (
                <p className="text-xs text-amber-700 mt-3 leading-relaxed">
                  有 {result.guessed.length} 個動作的組數是從「行尾那個數字」推測的。
                  如果不對，把那幾行改成「<span className="font-medium">動作 3組</span>」這種寫法最準。
                </p>
              )}

              {result.volume.unresolved.length > 0 && (
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  有 {result.volume.unresolved.length} 個動作我認不出是練哪個部位，沒算進去：
                  <span className="text-slate-700">
                    {Array.from(new Set(result.volume.unresolved)).slice(0, 8).join('、')}
                  </span>
                  。換成常見的中文名稱通常就讀得到。
                </p>
              )}

              {result.parsed.skipped.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                    跳過了 {result.parsed.skipped.length} 行（標題、分隔線、說明）
                  </summary>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {result.parsed.skipped.map((s, i) => (
                      <li key={`${s}-${i}`} className="text-xs text-slate-400 font-mono truncate">{s}</li>
                    ))}
                  </ul>
                </details>
              )}
              </details>
            </section>
          </>
        )}

        {/* ── 怎麼讀 ── */}
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">這些數字怎麼用</h2>
          <div className="flex flex-col gap-3 text-sm text-slate-600 leading-relaxed">
            <p>
              <strong className="font-medium text-slate-900">先看有沒有掛零。</strong>
              這是最常見也最容易修的問題。一份看起來很完整的課表，加總之後常常會發現某個部位整週一組都沒有
              —— 小腿、核心、肩後束是前三名。
            </p>
            <p>
              <strong className="font-medium text-slate-900">再看對立的兩邊差多少。</strong>
              同一個關節的兩側（肩中/肩後、股四/腿後、胸/背）長期偏一邊，除了外型，關節受力也會偏。
              比例超過 2.5:1 就會標出來。
            </p>
            <p>
              <strong className="font-medium text-slate-900">最後才看總量。</strong>
              10–20 組是常被引用的參考範圍，但它是平均值，不是規定。
              <span className="text-slate-500">
                備賽期把腿壓低、弱點期把某個部位拉到 30 組，都會超出範圍，那是刻意的不是錯的。
              </span>
              所以這頁只告訴你數字長什麼樣，不判斷是不是刻意的 —— 那得你自己知道目標才答得出來。
            </p>
            <p className="text-xs text-slate-400">
              部位是從<span className="text-slate-500">動作名稱</span>推出來的（195 個以上的對應）。
              暖身、呼吸、Posing、有氧不計入組數。
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-primary-600 rounded-2xl p-6 text-center">
          <h2 className="text-base font-semibold text-white mb-2">想知道你的熱量跟三大營養素該怎麼抓？</h2>
          <p className="text-sm text-white/80 mb-4 leading-relaxed">
            課表只是一半。另一半是吃多少 —— 兩分鐘算完，不用註冊。
          </p>
          <Link
            href="/diagnosis"
            onClick={() => trackEvent('volume_tool_cta', { from: 'volume' })}
            className="inline-block bg-white text-primary-700 font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            免費算一次
          </Link>
        </section>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          這頁只做訓練量的加總與比較，不對個人身體狀況做任何判斷。
          <br />
          有傷痛或身體不適，請先找醫師或物理治療師。
        </p>
      </div>
    </main>
  )
}
