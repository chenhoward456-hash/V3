'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'
import React from 'react'
import { LAB_THRESHOLDS, LAB_OPTIMAL_RANGES } from '@/utils/labStatus'

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
  gender?: '男性' | '女性'
}

// 有性別差異閾值的檢驗項目（與 utils/labStatus.ts 同步）
const FEMALE_VARIANTS = new Set([
  '鐵蛋白', '睪固酮', '游離睪固酮', 'HDL-C', '尿酸',
  'GGT', '肌酸酐', 'DHEA-S', '雌二醇', 'SHBG', '血紅素'
])

const HIGHER_IS_BETTER = new Set(['HDL-C', 'HDL-C_female', '白蛋白', 'eGFR'])

function resolveLookupName(testName: string, gender?: '男性' | '女性'): string {
  if (gender === '女性' && FEMALE_VARIANTS.has(testName)) {
    return `${testName}_female`
  }
  return testName
}

function LabResultTrendChart({
  testName,
  unit,
  data,
  referenceRange,
  targetValue,
  gender,
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

  // ── 功能醫學參考線設定 ──
  const lookupName = resolveLookupName(testName, gender)
  const threshold = (LAB_THRESHOLDS as Record<string, { normal: number | { min: number; max: number }; attention: number | { min: number; max: number } }>)[lookupName]
  const optimal = LAB_OPTIMAL_RANGES[lookupName]
  const higherBetter = HIGHER_IS_BETTER.has(lookupName)

  // 解析閾值 → 可畫成 ReferenceLine 的單一數字 / ReferenceArea 的 min-max
  type LineDef = { y: number; label: string; color: string }
  type AreaDef = { y1: number; y2: number; label: string; color: string }
  const lines: LineDef[] = []
  const areas: AreaDef[] = []

  if (threshold) {
    if (typeof threshold.normal === 'object') {
      // 範圍型（如 TSH、鐵蛋白、維生素D）：normal 是綠色帶狀
      const nr = threshold.normal as { min: number; max: number }
      const ar = threshold.attention as { min: number; max: number }
      areas.push({
        y1: nr.min, y2: nr.max,
        label: '醫院正常範圍',
        color: '#dcfce7',
      })
      // 注意範圍也可以畫成淡黃，但避免畫面太雜 — 只畫上下警示線
      lines.push({ y: ar.min, label: '警示下限', color: '#fda4af' })
      lines.push({ y: ar.max, label: '警示上限', color: '#fda4af' })
    } else {
      // 單一數值閾值
      const n = threshold.normal as number
      const a = threshold.attention as number
      if (higherBetter) {
        lines.push({ y: n, label: '正常下限', color: '#86efac' })
        lines.push({ y: a, label: '警示下限', color: '#fda4af' })
      } else {
        lines.push({ y: n, label: '醫院正常上限', color: '#86efac' })
        lines.push({ y: a, label: '警示上限', color: '#fda4af' })
      }
    }
  }

  // Howard 標準（功能醫學最佳化）— 強調用較粗線 + emerald 色
  let howardLine: LineDef | null = null
  let howardArea: AreaDef | null = null
  if (optimal !== undefined && optimal !== null) {
    if (typeof optimal === 'object') {
      howardArea = {
        y1: optimal.min, y2: optimal.max,
        label: 'Howard 標準',
        color: '#a7f3d0',
      }
    } else {
      howardLine = {
        y: optimal as number,
        label: `Howard 標準 ${higherBetter ? '>' : '<'}${optimal}`,
        color: '#059669',
      }
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
            
            {/* 醫院正常範圍（範圍型指標的綠色帶）*/}
            {areas.map((a, i) => (
              <ReferenceArea
                key={`area-${i}`}
                y1={a.y1}
                y2={a.y2}
                fill={a.color}
                fillOpacity={0.35}
                ifOverflow="extendDomain"
              />
            ))}

            {/* Howard 標準（功能醫學最佳化）範圍 — 較深的綠 */}
            {howardArea && (
              <ReferenceArea
                y1={howardArea.y1}
                y2={howardArea.y2}
                fill={howardArea.color}
                fillOpacity={0.55}
                ifOverflow="extendDomain"
                label={{ value: 'Howard 最佳', position: 'insideTopRight', fill: '#047857', fontSize: 11 }}
              />
            )}

            {/* 醫院標準與警示線 */}
            {lines.map((l, i) => (
              <ReferenceLine
                key={`line-${i}`}
                y={l.y}
                stroke={l.color}
                strokeDasharray="4 4"
                label={{ value: l.label, position: 'right', fill: l.color, fontSize: 10 }}
              />
            ))}

            {/* Howard 標準（單一閾值） */}
            {howardLine && (
              <ReferenceLine
                y={howardLine.y}
                stroke={howardLine.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                label={{ value: howardLine.label, position: 'insideTopLeft', fill: howardLine.color, fontSize: 11 }}
              />
            )}

            {/* 教練自訂目標參考線 */}
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
