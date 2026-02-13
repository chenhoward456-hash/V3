'use client'

import { LineChart, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Line } from 'recharts'
import React, { memo, useMemo } from 'react'

interface LazyChartProps {
  data: any[]
  height?: number
  width?: number
  stroke?: string
  strokeWidth?: number
}

const LazyChart = memo(({
  data,
  height = 100,
  width = 100,
  stroke = '#3b82f6',
  strokeWidth = 2
}: LazyChartProps) => {
  // 動態計算 Y 軸範圍：根據數據自動縮放，讓趨勢清晰可見
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 100]
    const values = data.map(d => d.value).filter((v): v is number => v != null)
    if (values.length === 0) return [0, 100]

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min

    // 根據數值大小決定 padding
    let padding: number
    if (range < 1) {
      // 只有一筆或幾乎相同的數據：用 ±5 的範圍
      padding = 5
    } else {
      // 多筆數據：上下留 30% 空間，至少 2
      padding = Math.max(range * 0.3, 2)
    }

    // 向下取整、向上取整到整數
    const yMin = Math.floor(min - padding)
    const yMax = Math.ceil(max + padding)

    return [yMin, yMax]
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        暫無數據
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={undefined}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={yDomain} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', borderRadius: 8, border: 'none' }}
            labelStyle={{ color: '#ccc' }}
            itemStyle={{ color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={strokeWidth}
            dot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: stroke, strokeWidth: 2, stroke: '#fff' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

LazyChart.displayName = 'LazyChart'

export default LazyChart
