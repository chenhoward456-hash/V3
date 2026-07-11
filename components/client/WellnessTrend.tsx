'use client'

import { useMemo } from 'react'
import { WellnessData } from './types'
import { useMeasuredContainer } from '@/hooks/useMeasuredContainer'
import DashboardChart from '@/components/charts/DashboardChart'

interface WellnessTrendProps {
  wellness: WellnessData[]
}

// 示範：改用共用 DashboardChart wrapper（原本 inline recharts）。
// 行為不變：三條線(睡眠/精力/心情)、Y 軸固定 1-5、圖例、圓點；配色改走 DESIGN token。
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
      <h2 className="text-xl font-semibold text-gray-900 mb-4">感受趨勢</h2>
      {chartData.length < 2 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          資料累積中，持續記錄後會顯示趨勢
        </div>
      ) : (
        <div ref={chartRef} style={{ height: 256 }}>
          {measured && (
            <DashboardChart
              data={chartData}
              xKey="date"
              type="line"
              height={256}
              yDomain={[1, 5]}
              yTicks={[1, 2, 3, 4, 5]}
              legend
              dots
              series={[
                { key: '睡眠品質', color: '#2563EB' },
                { key: '精力水平', color: '#F59E0B' },
                { key: '心情', color: '#10B981' },
              ]}
            />
          )}
        </div>
      )}
    </div>
  )
}
