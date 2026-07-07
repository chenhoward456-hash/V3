'use client'

import {
  ResponsiveContainer, AreaChart, BarChart, LineChart,
  Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

// Tremor 味的統一儀表板圖表，但建在專案既有的 recharts 3 上（不引入衝突的 @tremor/react ＝ recharts 2）。
// 一致的樣式＝之後加圖表快、又不破 DESIGN.md（顏色只做語意：藍＝互動/品牌）。
// 用法：<DashboardChart data={rows} xKey="date" series={[{ key:'weight', name:'體重' }]} type="area" />

type Point = Record<string, string | number | null | undefined>
type Series = { key: string; name?: string; color?: string }

interface DashboardChartProps {
  data: Point[]
  xKey: string
  series: Series[]
  type?: 'area' | 'line' | 'bar'
  height?: number
  yWidth?: number
  showGrid?: boolean
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']
  yTicks?: number[]
  legend?: boolean       // 多條線時開圖例
  dots?: boolean         // line 是否顯示資料點
  className?: string
}

const BRAND = '#2563EB'       // DESIGN token：primary
const PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#1e3a5f']
const AXIS = '#718096'        // text.muted
const GRID = '#E8E5E0'        // border

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="mb-1 font-medium text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 tabular-nums text-gray-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}：{p.value}
        </div>
      ))}
    </div>
  )
}

export default function DashboardChart({
  data, xKey, series, type = 'area', height = 220, yWidth = 32, showGrid = true,
  yDomain, yTicks, legend = false, dots = false, className,
}: DashboardChartProps) {
  const color = (s: Series, i: number) => s.color || PALETTE[i % PALETTE.length] || BRAND
  const commonAxis = {
    tick: { fontSize: 11, fill: AXIS },
    axisLine: { stroke: GRID },
    tickLine: false as const,
  }

  const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} /> : null
  const x = <XAxis dataKey={xKey} {...commonAxis} />
  const y = <YAxis width={yWidth} domain={yDomain} ticks={yTicks} {...commonAxis} />
  const tip = <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />
  const leg = legend ? <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" /> : null

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {grid}{x}{y}{tip}{leg}
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name || s.key} fill={color(s, i)} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {grid}{x}{y}{tip}{leg}
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={color(s, i)} strokeWidth={2} dot={dots ? { r: 3 } : false} />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color(s, i)} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color(s, i)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {grid}{x}{y}{tip}{leg}
            {series.map((s, i) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key}
                stroke={color(s, i)} strokeWidth={2} fill={`url(#grad-${s.key})`} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
