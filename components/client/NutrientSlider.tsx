'use client'

import { useRef, useCallback } from 'react'

interface NutrientSliderProps {
  label: string
  emoji?: string
  value: string
  onChange: (val: string) => void
  target?: number | null
  unit: string
  max: number
  step: number
  color?: string // tailwind color name: blue, cyan, orange, amber, yellow
}

export default function NutrientSlider({ label, emoji, value, onChange, target, unit, max, step, color = 'blue' }: NutrientSliderProps) {
  const numValue = value ? Number(value) : 0
  const pct = target ? Math.min(100, Math.round((numValue / target) * 100)) : 0
  const reached = target ? numValue >= target : false
  const sliderRef = useRef<HTMLInputElement>(null)

  // 快捷按鈕：+step / -step
  const adjust = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(max, numValue + delta))
    onChange(next === 0 ? '' : String(next))
  }, [numValue, max, onChange])

  // 顏色映射（避免 Tailwind JIT purge 問題）
  const colorMap: Record<string, { bg: string; text: string; slider: string }> = {
    blue:   { bg: 'bg-blue-400',   text: 'text-blue-600',   slider: 'accent-blue-500' },
    cyan:   { bg: 'bg-cyan-400',   text: 'text-cyan-600',   slider: 'accent-cyan-500' },
    orange: { bg: 'bg-orange-400', text: 'text-orange-600', slider: 'accent-orange-500' },
    amber:  { bg: 'bg-amber-400',  text: 'text-amber-600',  slider: 'accent-amber-500' },
    yellow: { bg: 'bg-yellow-400', text: 'text-yellow-600', slider: 'accent-yellow-500' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-gray-600">{emoji ? `${emoji} ` : ''}{label}</label>
        <div className="flex items-center gap-2">
          {target && (
            <span className="text-xs text-gray-400">目標 {target}{unit}</span>
          )}
          <span className={`text-sm font-bold tabular-nums ${reached ? 'text-green-600' : numValue > 0 ? c.text : 'text-gray-400'}`}>
            {numValue > 0 ? numValue : '--'}{numValue > 0 ? unit : ''}
          </span>
        </div>
      </div>

      {/* 滑桿 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => adjust(-step)}
          disabled={numValue <= 0}
          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 font-bold text-lg flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-30 shrink-0"
        >
          −
        </button>
        <div className="flex-1 relative">
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={max}
            step={step}
            value={numValue}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange(v === 0 ? '' : String(v))
            }}
            className={`w-full h-2 rounded-full appearance-none cursor-pointer ${c.slider}`}
            style={{
              background: `linear-gradient(to right, ${reached ? '#22c55e' : 'currentColor'} ${(numValue / max) * 100}%, #f3f4f6 ${(numValue / max) * 100}%)`,
            }}
          />
          {/* 目標線 */}
          {target && target <= max && (
            <div
              className="absolute top-0 w-0.5 h-2 bg-gray-400 pointer-events-none"
              style={{ left: `${(target / max) * 100}%` }}
            />
          )}
        </div>
        <button
          onClick={() => adjust(step)}
          disabled={numValue >= max}
          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 font-bold text-lg flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-30 shrink-0"
        >
          +
        </button>
      </div>

      {/* 進度條 */}
      {target && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${reached ? 'bg-green-500' : c.bg}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-medium w-10 text-right ${reached ? 'text-green-600' : numValue > 0 ? c.text : 'text-gray-400'}`}>
            {numValue > 0 ? `${pct}%` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
