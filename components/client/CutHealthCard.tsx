'use client'

interface CutHealthCardProps {
  bodyData: { date: string; weight: number | null }[]
  wellness: { date: string; energy_level?: number | null }[]
  currentWeight: number | null
}

/** 近 21 天體重線性回歸 → kg/週 */
function weeklyRate(rows: { date: string; weight: number | null }[]): number | null {
  const v = rows.filter(r => r.weight != null).map(r => ({ d: r.date, w: r.weight as number })).sort((a, b) => a.d.localeCompare(b.d))
  if (v.length < 3) return null
  const DAY = 86400000
  const last = new Date(v[v.length - 1].d + 'T00:00:00').getTime()
  const recent = v.filter(p => (last - new Date(p.d + 'T00:00:00').getTime()) / DAY <= 21)
  if (recent.length < 3) return null
  const r0 = new Date(recent[0].d + 'T00:00:00').getTime()
  const span = (new Date(recent[recent.length - 1].d + 'T00:00:00').getTime() - r0) / DAY
  if (span < 5) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  const n = recent.length
  for (const p of recent) { const x = (new Date(p.d + 'T00:00:00').getTime() - r0) / DAY; sx += x; sy += p.w; sxy += x * p.w; sxx += x * x }
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  return ((n * sxy - sx * sy) / denom) * 7 // kg/週
}

/**
 * 本週減脂體檢：只用「可靠」的訊號 — 掉重速率(每天量) + 能量(每天填)。
 * 刻意不用體脂(後期量測失真)、也不用訓練力量(學員常不填重量/亂換動作 → 資料不可靠，
 * 秀精準力量趨勢會誤導、傷信任)。
 */
export default function CutHealthCard({ bodyData, wellness, currentWeight }: CutHealthCardProps) {
  // ── 1. 掉重速率 ──
  const kgPerWeek = weeklyRate(bodyData)
  const ratePct = kgPerWeek != null && currentWeight ? Math.abs(kgPerWeek) / currentWeight * 100 : null
  type RateState = 'fast' | 'brisk' | 'healthy' | 'slow' | 'wrong' | null
  let rate: RateState = null
  if (kgPerWeek != null && ratePct != null) {
    if (kgPerWeek > 0.1) rate = 'wrong'
    else if (ratePct > 1.5) rate = 'fast'
    else if (ratePct > 1.0) rate = 'brisk'
    else if (ratePct < 0.4) rate = 'slow'
    else rate = 'healthy'
  }
  if (rate == null) return null // 沒體重趨勢就不顯示這張卡

  // ── 2. 能量 ──
  const eRows = wellness.filter(w => w.energy_level != null).map(w => ({ d: w.date, e: w.energy_level as number })).sort((a, b) => b.d.localeCompare(a.d))
  let energyLow = false, energyDecl = false
  if (eRows.length >= 3) {
    const avg7 = eRows.slice(0, 7).reduce((s, x) => s + x.e, 0) / Math.min(7, eRows.length)
    energyLow = avg7 <= 2.3
    if (eRows.length >= 6) {
      const recent3 = eRows.slice(0, 3).reduce((s, x) => s + x.e, 0) / 3
      const prior3 = eRows.slice(3, 6).reduce((s, x) => s + x.e, 0) / 3
      energyDecl = recent3 < prior3 - 0.5
    }
  }
  const energyKnown = eRows.length >= 3
  const energyBad = energyLow || energyDecl

  // ── 判定 + 處方 ──
  let level: 'good' | 'watch' | 'risk' = 'good'
  let headline = ''
  let rx = ''
  if ((rate === 'fast' || rate === 'brisk') && energyBad) {
    level = 'risk'; headline = '掉得快又沒能量'
    rx = '本週排 1 次 refeed，把熱量拉回維持 1–2 天；蛋白吃滿，先穩住狀態。'
  } else if (rate === 'fast') {
    level = 'watch'; headline = '掉太猛（肌肉流失風險）'
    rx = `每週掉 ${ratePct!.toFixed(1)}% 太快 → 加 150–200 kcal，放慢到 ~0.8%/週保肌。`
  } else if (rate === 'wrong') {
    level = 'watch'; headline = '體重在上升，跟減脂反向'
    rx = '確認是不是真的有赤字 — 重新對一下熱量與份量，或回報給教練。'
  } else if (rate === 'slow') {
    level = 'watch'; headline = '減脂卡住了'
    rx = `每週只掉 ${ratePct!.toFixed(1)}% → 減 100–150 kcal，或加 2 次低強度有氧。`
  } else if (energyBad) {
    level = 'watch'; headline = '速度健康，但能量偏低'
    rx = '顧睡眠、別再壓熱量；連續撐不住就排一次 refeed。'
  } else if (rate === 'brisk') {
    level = 'good'; headline = '減脂中，狀態穩'
    rx = `每週掉 ${ratePct!.toFixed(1)}% 稍快，能量也穩 → 可照走；想多保肌就放慢到 ~0.8%/週。`
  } else {
    level = 'good'; headline = '乾淨減脂中'
    rx = `速度健康（${ratePct!.toFixed(1)}%/週）、能量穩 → 照計畫走，別亂改。`
  }

  const styles = {
    good: { box: 'border-emerald-200', pill: 'bg-emerald-100 text-emerald-700', emoji: '🟢' },
    watch: { box: 'border-amber-200', pill: 'bg-amber-100 text-amber-700', emoji: '🟡' },
    risk: { box: 'border-rose-200', pill: 'bg-rose-100 text-rose-700', emoji: '🔴' },
  }[level]

  const Chip = ({ ok, warn, label }: { ok: boolean; warn: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${warn ? 'bg-amber-50 text-amber-700' : ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
      {warn ? '⚠️' : ok ? '✓' : '–'} {label}
    </span>
  )

  return (
    <div className={`bg-white border rounded-2xl p-5 mb-4 ${styles.box}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-semibold text-gray-900">🩺 本週減脂體檢</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.pill}`}>{styles.emoji} {headline}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip ok={rate === 'healthy' || rate === 'brisk'} warn={rate === 'fast' || rate === 'slow' || rate === 'wrong'} label={
          rate === 'healthy' ? `掉重 ${ratePct!.toFixed(1)}%/週` : rate === 'brisk' ? `掉重 ${ratePct!.toFixed(1)}%/週(稍快)` : rate === 'fast' ? `掉太快 ${ratePct!.toFixed(1)}%/週` : rate === 'slow' ? `掉太慢 ${ratePct!.toFixed(1)}%/週` : '體重反向上升'
        } />
        <Chip ok={!energyBad && energyKnown} warn={energyBad} label={!energyKnown ? '能量資料不足' : energyBad ? '能量偏低' : '能量穩'} />
      </div>

      <div className="bg-slate-50 rounded-xl px-3 py-2.5">
        <p className="text-[11px] text-gray-400 mb-0.5">本週該怎麼調</p>
        <p className="text-sm text-gray-800 leading-snug">{rx}</p>
      </div>
    </div>
  )
}
