'use client'

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Calendar, TrendingUp, Target, Award, Activity, Heart, Scale } from 'lucide-react'

interface StatisticsReportProps {
  bodyData: any[]
  labResults: any[]
  supplements: any[]
  wellnessData: any[]
}

const StatisticsReport = ({ bodyData, labResults, supplements, wellnessData }: StatisticsReportProps) => {
  // 計算月度統計
  const monthlyStats = useMemo(() => {
    if (!bodyData || bodyData.length === 0) return []

    const monthlyData: Record<string, any> = {}
    
    bodyData.forEach(record => {
      const date = new Date(record.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          weightRecords: [],
          bodyFatRecords: [],
          muscleMassRecords: []
        }
      }
      
      if (record.weight) monthlyData[monthKey].weightRecords.push(record.weight)
      if (record.body_fat) monthlyData[monthKey].bodyFatRecords.push(record.body_fat)
      if (record.muscle_mass) monthlyData[monthKey].muscleMassRecords.push(record.muscle_mass)
    })

    return Object.values(monthlyData).map(month => ({
      month: month.month,
      avgWeight: month.weightRecords.length > 0 ? 
        (month.weightRecords.reduce((a: number, b: number) => a + b, 0) / month.weightRecords.length).toFixed(1) : 0,
      avgBodyFat: month.bodyFatRecords.length > 0 ? 
        (month.bodyFatRecords.reduce((a: number, b: number) => a + b, 0) / month.bodyFatRecords.length).toFixed(1) : 0,
      avgMuscleMass: month.muscleMassRecords.length > 0 ? 
        (month.muscleMassRecords.reduce((a: number, b: number) => a + b, 0) / month.muscleMassRecords.length).toFixed(1) : 0,
      recordCount: month.weightRecords.length
    })).sort((a, b) => a.month.localeCompare(b.month))
  }, [bodyData])

  // 計算血檢狀態分佈
  const labStatusDistribution = useMemo(() => {
    if (!labResults || labResults.length === 0) return []

    const statusCount = labResults.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return [
      { name: '正常', value: statusCount.normal || 0, color: '#10b981' },
      { name: '注意', value: statusCount.attention || 0, color: '#f59e0b' },
      { name: '警報', value: statusCount.alert || 0, color: '#ef4444' }
    ]
  }, [labResults])

  // 計算補品服從率
  const supplementCompliance = useMemo(() => {
    if (!supplements || !wellnessData) return []

    return supplements.map(supplement => {
      const logs = wellnessData.filter(log => log.supplement_id === supplement.id)
      const completedCount = logs.filter(log => log.completed).length
      const totalCount = logs.length
      
      return {
        name: supplement.name,
        compliance: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        takenCount: completedCount,
        totalCount
      }
    })
  }, [supplements, wellnessData])

  // 計算健康指標
  const healthMetrics = useMemo(() => {
    if (!bodyData || bodyData.length === 0) return []

    const latest = bodyData[bodyData.length - 1]
    const oldest = bodyData[0]

    return [
      {
        name: '體重變化',
        current: latest?.weight || 0,
        change: latest && oldest ? (latest.weight - oldest.weight).toFixed(1) : 0,
        unit: 'kg',
        icon: Scale,
        color: latest?.weight > (oldest?.weight || 0) ? '#ef4444' : '#10b981'
      },
      {
        name: '體脂變化',
        current: latest?.body_fat || 0,
        change: latest && oldest ? (latest.body_fat - oldest.body_fat).toFixed(1) : 0,
        unit: '%',
        icon: Activity,
        color: latest?.body_fat > (oldest?.body_fat || 0) ? '#ef4444' : '#10b981'
      },
      {
        name: '記錄天數',
        current: bodyData.length,
        change: 0,
        unit: '天',
        icon: Calendar,
        color: '#3b82f6'
      },
      {
        name: '血檢項目',
        current: labResults?.length || 0,
        change: 0,
        unit: '項',
        icon: Heart,
        color: '#8b5cf6'
      }
    ]
  }, [bodyData, labResults])

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">📈 統計報表</h2>

      {/* 健康指標卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {healthMetrics.map((metric, index) => (
          <div key={index} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center`} style={{ backgroundColor: `${metric.color}20` }}>
                <metric.icon size={20} style={{ color: metric.color }} />
              </div>
              {metric.change !== 0 && (
                <div className={`text-sm font-medium ${metric.color === '#ef4444' ? 'text-red-600' : 'text-green-600'}`}>
                  {metric.color === '#ef4444' ? '+' : ''}{metric.change}
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {metric.current}
              <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
            </div>
            <div className="text-sm text-gray-600">{metric.name}</div>
          </div>
        ))}
      </div>

      {/* 月度統計圖表 */}
      {monthlyStats.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-700 mb-4">月度趨勢</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgWeight" fill="#3b82f6" name="平均體重" />
                <Bar dataKey="avgBodyFat" fill="#10b981" name="平均體脂" />
                <Bar dataKey="avgMuscleMass" fill="#f59e0b" name="平均肌肉量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 血檢狀態分佈 */}
      {labStatusDistribution.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-700 mb-4">血檢狀態分佈</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={labStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {labStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 補品服從率 */}
      {supplementCompliance.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-700 mb-4">補品服從率</h3>
          <div className="space-y-3">
            {supplementCompliance.map((supplement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{supplement.name}</div>
                  <div className="text-sm text-gray-600">
                    已服用 {supplement.takenCount} / {supplement.totalCount} 次
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${supplement.compliance}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{supplement.compliance}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 總結統計 */}
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="flex items-start">
          <Award size={20} className="text-blue-600 mr-3 mt-1" />
          <div>
            <div className="font-medium text-blue-900 mb-1">數據總結</div>
            <div className="text-sm text-blue-800 space-y-1">
              <div>• 總記錄天數：{bodyData?.length || 0} 天</div>
              <div>• 血檢項目：{labResults?.length || 0} 項</div>
              <div>• 補品種類：{supplements?.length || 0} 種</div>
              <div>• 平均服從率：{supplementCompliance.length > 0 ? 
                Math.round(supplementCompliance.reduce((sum, s) => sum + s.compliance, 0) / supplementCompliance.length) : 0}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsReport
