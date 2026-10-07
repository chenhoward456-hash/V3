interface HomeMetricStripProps {
  showWeight?: boolean
  showCarbs?: boolean
  weight: number | string | null | undefined
  carbs: number | string | null | undefined
  streak: number
  weightDate: string | null | undefined
}

/** A visual summary of values already available on the student dashboard. */
export default function HomeMetricStrip({
  showWeight = true,
  showCarbs = true,
  weight,
  carbs,
  streak,
  weightDate,
}: HomeMetricStripProps) {
  return (
    <section
      aria-label="體重、今天碳水與連續記錄"
      className="overflow-hidden rounded-2xl bg-slate-950 text-white"
    >
      <dl className={`grid h-full ${showWeight ? 'grid-cols-[1.2fr_1fr]' : 'grid-cols-1'}`}>
        {showWeight && <div className="row-span-2 flex flex-col justify-center px-6 py-7">
          <dt className="text-xs font-medium tracking-widest text-slate-400">體重</dt>
          <dd className="mt-3 flex items-baseline gap-2.5 tabular-nums">
            <span className="text-[60px] font-medium leading-none tracking-[-0.06em]">
              {weight ?? '—'}
            </span>
            {weight != null && <span className="text-sm text-slate-400">kg</span>}
          </dd>
          {weightDate && <dd className="mt-3 text-xs tabular-nums text-slate-400">{weightDate}</dd>}
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
        <div className="border-l border-t border-white/10 px-5 py-5">
          <dt className="text-xs font-medium tracking-widest text-slate-400">連續記錄</dt>
          <dd className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-[32px] font-medium leading-none tracking-[-0.04em]">
              {streak}
            </span>
            <span className="text-xs text-slate-400">天</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
