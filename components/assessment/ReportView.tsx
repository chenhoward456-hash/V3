import type { AssessmentReport } from '@/lib/assessment-report'

/**
 * 體測報告的呈現層。demo 頁與教練上傳後的預覽共用同一個元件 ——
 * 這樣「Howard 在後台看到的」跟「會員拿到的」永遠是同一份東西。
 */

function Stat({ label, value, unit, tone, soWhat }: {
  label: string; value: string; unit: string
  tone: 'neutral' | 'watch' | 'good'; soWhat: string
}) {
  const valueColor =
    tone === 'watch' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900'
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}<span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{soWhat}</p>
    </div>
  )
}

export default function ReportView({
  report, meta, showCta = true,
}: {
  report: AssessmentReport
  meta: { measuredAt?: string | null; gender?: string | null; age?: number | null; height?: number | null; weight?: number | null }
  showCta?: boolean
}) {
  const { headline, headlineDetail, keyStats, goal, nutrition, training } = report

  return (
    <div className="space-y-4">
      <div>
        {meta.measuredAt && (
          <p className="text-[11px] text-slate-400 tabular-nums">體測日期 {meta.measuredAt}</p>
        )}
        <h1 className="text-xl font-bold text-gray-900 mt-0.5">你的身體現況</h1>
        <p className="text-xs text-slate-500 mt-1 tabular-nums">
          {[meta.gender, meta.age ? `${meta.age} 歲` : null, meta.height ? `${meta.height} cm` : null, meta.weight ? `${meta.weight} kg` : null]
            .filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* 一句話 —— 會員唯一會記住的東西 */}
      <div className="bg-white border-l-4 border-l-primary-600 border border-slate-200 rounded-2xl p-5">
        <p className="text-[11px] text-slate-400 mb-1.5">一句話</p>
        <p className="text-lg font-bold text-gray-900 leading-snug">{headline}</p>
        <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">{headlineDetail}</p>
      </div>

      {keyStats.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">這次量出來，{keyStats.length} 個要看的數字</p>
          <div className="grid grid-cols-1 gap-2.5">
            {keyStats.map(s => <Stat key={s.label} {...s} />)}
          </div>
        </div>
      )}

      {goal && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2">{goal.weeks} 週之後</p>
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{goal.currentWeight}</span>
            <span className="text-slate-400">→</span>
            <span className="text-2xl font-bold text-primary-600 tabular-nums">{goal.targetWeight}</span>
            <span className="text-sm text-slate-400">kg</span>
            {goal.currentBodyFat != null && goal.targetBodyFat != null && (
              <span className="text-xs text-slate-400 ml-1 tabular-nums">
                （體脂 {goal.currentBodyFat}% → {goal.targetBodyFat}%）
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed tabular-nums">
            一週 {Math.abs(goal.ratePerWeek)} 公斤，慢到你不會覺得在節食。
            這個速度掉的幾乎都是脂肪 —— 掉太快的話肌肉會跟著走。
          </p>
          {goal.primaryMetricNote && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 leading-relaxed">
                <b className="text-slate-700">{goal.primaryMetricNote}</b>
              </p>
            </div>
          )}
        </div>
      )}

      {nutrition && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2.5">每天吃這些</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {([
              ['熱量', nutrition.calories, 'kcal'],
              ['蛋白質', nutrition.protein, 'g'],
              ['碳水', nutrition.carbs, 'g'],
              ['脂肪', nutrition.fat, 'g'],
            ] as [string, number, string][]).map(([l, v, u]) => (
              <div key={l} className="bg-slate-50 rounded-xl px-2 py-2.5 text-center">
                <p className="text-[10px] text-slate-400">{l}</p>
                <p className="text-base font-bold text-gray-900 tabular-nums leading-tight mt-0.5">{v}</p>
                <p className="text-[10px] text-slate-400">{u}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed tabular-nums">
            你的基礎代謝 <b>{nutrition.bmr}</b>、日常消耗約 <b>{nutrition.tdee}</b>。{nutrition.deficitNote}
          </p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            蛋白質 {nutrition.protein} 克是這四個數字裡<b>最重要的一個</b>：
            減脂期蛋白吃不夠，掉的體重會有一半是肌肉。
          </p>
        </div>
      )}

      {training.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 mb-2.5">怎麼練</p>
          <ul className="space-y-2.5 text-sm text-slate-600">
            {training.map((t, i) => (
              <li key={t.title} className="flex gap-2.5">
                <span className="text-primary-600 font-bold shrink-0">{i + 1}</span>
                <span><b className="text-gray-900">{t.title}。</b>{t.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ⚠️ 2026-08-21：CTA 刻意**不放連結**。
          這份報告是健身房的服務，成交發生在現場而不是線上；
          原本連到 /join（Howard Protocol 的線上方案）是定位錯誤 ——
          而且這條線之後要給館內其他教練用，別人的會員不該被導去某個人的個人生意。 */}
      {showCta && (
        <div className="bg-primary-600 rounded-2xl p-5 text-white">
          <p className="text-base font-bold leading-snug">這份計畫要有人幫你盯數字嗎？</p>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            上面的數字是系統依你這次體測算的。真正難的不是知道要做什麼，
            是十二週之後還在做 —— 那是教練的工作。
          </p>
          <p className="text-sm text-white/90 mt-3 font-medium">
            想開始的話，直接跟今天幫你做體測的教練說一聲就可以。
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed pb-6">
        本報告依據體組成分析儀的量測值與一般族群參考範圍產生，屬健康與體態管理建議，
        不是醫療診斷、也不能取代醫療專業評估。若你有慢性疾病、規則服藥、懷孕哺乳或近期手術，
        開始任何飲食或訓練計畫前請先諮詢醫師或營養師。
        體組成量測值會受水分、進食與量測時間影響，單次數值僅供參考，趨勢比單點更有意義。
      </p>
    </div>
  )
}
