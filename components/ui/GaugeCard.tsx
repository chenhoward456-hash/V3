'use client'

/**
 * Garmin-style 半圓弧 Gauge 卡片
 * 用於顯示 0-100 的指標（恢復分數、睡眠分數等）
 */

interface GaugeCardProps {
  label: string
  value: number | null
  max?: number
  unit?: string
  statusLabel?: string
  statusColor?: string  // tailwind text color class
  color: string         // SVG stroke color (hex)
  bgColor: string       // tailwind bg class for card
  icon?: string
  dark?: boolean        // 深色模式（文字改為白色系）
}

export default function GaugeCard({
  label,
  value,
  max = 100,
  unit = '',
  statusLabel,
  statusColor = 'text-gray-500',
  color,
  bgColor,
  icon,
  dark = false,
}: GaugeCardProps) {
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const centerX = size / 2
  const centerY = size / 2 + 4 // 稍微往下移讓半圓更居中

  // 半圓弧（180 度，從左到右）
  const startAngle = Math.PI   // 180°
  const endAngle = 0           // 0°
  const pct = value !== null ? Math.min(Math.max(value / max, 0), 1) : 0
  const sweepAngle = startAngle - (startAngle - endAngle) * pct

  // 顏色配置
  const trackColor = dark ? '#374151' : '#e5e7eb'  // 背景弧顏色
  const textFill = dark ? '#f3f4f6' : '#1f2937'     // 數值文字
  const unitFill = dark ? '#6b7280' : '#9ca3af'      // 單位文字
  const labelClass = dark ? 'text-gray-400' : 'text-gray-600'

  // 背景弧
  const bgArcStart = { x: centerX + radius * Math.cos(startAngle), y: centerY - radius * Math.sin(startAngle) }
  const bgArcEnd = { x: centerX + radius * Math.cos(endAngle), y: centerY - radius * Math.sin(endAngle) }
  const bgPath = `M ${bgArcStart.x} ${bgArcStart.y} A ${radius} ${radius} 0 0 1 ${bgArcEnd.x} ${bgArcEnd.y}`

  // 值弧
  const valArcEnd = { x: centerX + radius * Math.cos(sweepAngle), y: centerY - radius * Math.sin(sweepAngle) }
  const largeArc = pct > 0.5 ? 1 : 0
  const valPath = value !== null && pct > 0
    ? `M ${bgArcStart.x} ${bgArcStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valArcEnd.x} ${valArcEnd.y}`
    : ''

  return (
    <div className={`${bgColor} rounded-2xl p-3 flex flex-col items-center`}>
      {/* 標題 */}
      <div className="flex items-center gap-1 mb-1 self-start">
        {icon && <span className="text-xs">{icon}</span>}
        <p className={`text-[11px] font-medium ${labelClass}`}>{label}</p>
      </div>

      {/* Gauge */}
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        {/* 背景弧 */}
        <path
          d={bgPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 值弧 */}
        {valPath && (
          <path
            d={valPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* 末端圓點 */}
        {value !== null && pct > 0 && (
          <circle
            cx={valArcEnd.x}
            cy={valArcEnd.y}
            r={strokeWidth / 2 + 1}
            fill={color}
          />
        )}
        {/* 中間數值 */}
        <text
          x={centerX}
          y={centerY - 2}
          textAnchor="middle"
          className="font-bold"
          style={{ fontSize: value !== null ? '18px' : '16px', fill: textFill }}
        >
          {value !== null ? value : '--'}
        </text>
        {unit && value !== null && (
          <text
            x={centerX}
            y={centerY + 12}
            textAnchor="middle"
            style={{ fontSize: '9px', fill: unitFill }}
          >
            {unit}
          </text>
        )}
      </svg>

      {/* 狀態標籤 */}
      {statusLabel && (
        <span className={`text-[10px] font-bold mt-0.5 ${statusColor}`}>
          {statusLabel}
        </span>
      )}
    </div>
  )
}
