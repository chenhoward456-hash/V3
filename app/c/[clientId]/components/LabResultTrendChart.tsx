'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import React from 'react'

interface TrendDataPoint {
  date: string
  value: number
  status: 'normal' | 'attention' | 'alert'
}

interface LabResultTrendChartProps {
  testName: string
  unit: string
  data: TrendDataPoint[]
  referenceRange: string
  targetValue?: number
}

function LabResultTrendChart({
  testName,
  unit,
  data,
  referenceRange,
  targetValue
}: LabResultTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{testName} 趨勢</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">尚無歷史數據</p>
        </div>
      </div>
    )
  }
  
  // 計算變化百分比
  const latestValue = data[data.length - 1].value
  const previousValue = data[data.length - 2]?.value
  const changePercent = previousValue 
    ? ((latestValue - previousValue) / previousValue * 100).toFixed(1)
    : null
  
  // 判斷趨勢方向
  const trend = changePercent 
    ? parseFloat(changePercent) > 0 ? '↑' : '↓'
    : ''
  
  // 判斷狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-100'
      case 'attention': return 'text-yellow-600 bg-yellow-100'
      case 'alert': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{testName} 趨勢</h3>
          <div className="flex items-center gap-3">
            {/* 最新數值 */}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(data[data.length - 1].status)}`}>
              {latestValue} {unit}
            </span>
            
            {/* 變化百分比 */}
            {changePercent && (
              <span className={`text-sm font-medium ${
                parseFloat(changePercent) > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {trend} {Math.abs(parseFloat(changePercent))}%
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          標準範圍：{referenceRange}
        </p>
      </div>
      
      {/* 圖表 */}
      <div className="h-[300px] md:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ 
                value: unit, 
                angle: -90, 
                position: 'insideLeft', 
                style: { fontSize: '12px' } 
              }}
            />
            
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              formatter={(value: any) => [`${value} ${unit}`, testName]}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            />
            
            {/* 目標參考線 */}
            {targetValue && (
              <ReferenceLine 
                y={targetValue} 
                stroke="#10b981" 
                strokeDasharray="5 5"
                label={{ 
                  value: '目標', 
                  position: 'right',
                  fill: '#10b981',
                  fontSize: 12
                }}
              />
            )}
            
            {/* 數據線 */}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: '#2563eb' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* 數據點列表 */}
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">歷史記錄</h4>
        {data.slice().reverse().map((point, index) => (
          <div 
            key={index}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
          >
            <span className="text-sm text-gray-600">{point.date}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{point.value} {unit}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(point.status)}`}>
                {point.status === 'normal' ? '正常' :
                 point.status === 'attention' ? '注意' : '警示'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default React.memo(LabResultTrendChart)
