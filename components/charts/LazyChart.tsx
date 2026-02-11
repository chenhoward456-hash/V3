'use client'

import { LineChart, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Line } from 'recharts'
import React, { memo } from 'react'

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
          <YAxis />
          <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

LazyChart.displayName = 'LazyChart'

export default LazyChart
