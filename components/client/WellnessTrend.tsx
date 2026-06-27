'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { WellnessData } from './types'
import { useMeasuredContainer } from '@/hooks/useMeasuredContainer'

interface WellnessTrendProps {
  wellness: WellnessData[]
}

export default function WellnessTrend({ wellness }: WellnessTrendProps) {
  const { ref: chartRef, measured } = useMeasuredContainer()
  const chartData = useMemo(() => {
    if (!wellness?.length) return []
    return [...wellness]
      .filter(w => w.sleep_quality != null || w.energy_level != null || w.mood != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(w => ({
        date: new Date(w.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        睡眠品質: w.sleep_quality,
        精力水平: w.energy_level,
        心情: w.mood,
      }))
  }, [wellness])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">😊 感受趨勢</h2>
      {chartData.length < 2 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          資料累積中，持續記錄後會顯示趨勢
        </div>
      ) : (
        <div ref={chartRef} style={{ height: 256 }}>
        {measured && (
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="睡眠品質" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="精力水平" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="心情" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        )}
        </div>
      )}
    </div>
  )
}
