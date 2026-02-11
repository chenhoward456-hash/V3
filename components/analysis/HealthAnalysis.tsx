'use client'

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Target, Award, AlertTriangle } from 'lucide-react'

interface HealthAnalysisProps {
  bodyData: any[]
  labResults: any[]
  supplements: any[]
}

const HealthAnalysis = ({ bodyData, labResults, supplements }: HealthAnalysisProps) => {
  // 計算健康趨勢分析
  const healthAnalysis = useMemo(() => {
    if (!bodyData || bodyData.length < 2) return null

    const sortedData = bodyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const latest = sortedData[sortedData.length - 1]
    const previous = sortedData[sortedData.length - 2]

    const analysis = {
      weight: {
        current: latest.weight,
        change: latest.weight - previous.weight,
        trend: latest.weight > previous.weight ? 'up' : latest.weight < previous.weight ? 'down' : 'stable',
        status: Math.abs(latest.weight - previous.weight) > 2 ? 'significant' : 'normal'
      },
      bodyFat: {
        current: latest.body_fat,
        change: latest.body_fat - previous.body_fat,
        trend: latest.body_fat > previous.body_fat ? 'up' : latest.body_fat < previous.body_fat ? 'down' : 'stable',
        status: Math.abs(latest.body_fat - previous.body_fat) > 1 ? 'significant' : 'normal'
      },
      muscleMass: latest.muscle_mass ? {
        current: latest.muscle_mass,
        change: latest.muscle_mass - (previous.muscle_mass || 0),
        trend: latest.muscle_mass > (previous.muscle_mass || 0) ? 'up' : latest.muscle_mass < (previous.muscle_mass || 0) ? 'down' : 'stable',
        status: Math.abs(latest.muscle_mass - (previous.muscle_mass || 0)) > 0.5 ? 'significant' : 'normal'
      } : null
    }

    return analysis
  }, [bodyData])

  // 計算健康評分
  const healthScore = useMemo(() => {
    if (!healthAnalysis) return 0

    let score = 50 // 基礎分

    // 體重趨勢評分
    if (healthAnalysis.weight.trend === 'down') score += 10
    else if (healthAnalysis.weight.trend === 'up') score -= 5

    // 體脂趨勢評分
    if (healthAnalysis.bodyFat.trend === 'down') score += 15
    else if (healthAnalysis.bodyFat.trend === 'up') score -= 10

    // 肌肉量趨勢評分
    if (healthAnalysis.muscleMass?.trend === 'up') score += 10
    else if (healthAnalysis.muscleMass?.trend === 'down') score -= 5

    // 血檢結果評分
    if (labResults) {
      const normalCount = labResults.filter(r => r.status === 'normal').length
      const totalCount = labResults.length
      const normalRate = totalCount > 0 ? (normalCount / totalCount) * 100 : 0
      score += (normalRate / 100) * 15
    }

    return Math.min(100, Math.max(0, Math.round(score)))
  }, [healthAnalysis, labResults])

  if (!healthAnalysis) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 健康分析</h2>
        <div className="text-center text-gray-500 py-8">
          需要至少兩筆身體數據才能進行分析
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 健康分析</h2>
      
      {/* 健康評分 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-medium text-gray-700">健康評分</span>
          <div className="flex items-center">
            <Award size={20} className="mr-2 text-yellow-500" />
            <span className="text-2xl font-bold text-gray-900">{healthScore}</span>
            <span className="text-gray-500 ml-1">/100</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              healthScore >= 80 ? 'bg-green-500' : 
              healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {/* 趨勢分析 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-700">趨勢分析</h3>
        
        {/* 體重趨勢 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
              healthAnalysis.weight.trend === 'down' ? 'bg-green-100' :
              healthAnalysis.weight.trend === 'up' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              {healthAnalysis.weight.trend === 'down' ? (
                <TrendingDown size={20} className="text-green-600" />
              ) : healthAnalysis.weight.trend === 'up' ? (
                <TrendingUp size={20} className="text-red-600" />
              ) : (
                <Minus size={20} className="text-gray-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">體重</div>
              <div className="text-sm text-gray-600">
                {healthAnalysis.weight.current}kg 
                {healthAnalysis.weight.change !== 0 && (
                  <span className={`ml-2 ${
                    healthAnalysis.weight.trend === 'down' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({healthAnalysis.weight.trend === 'down' ? '-' : '+'}{Math.abs(healthAnalysis.weight.change).toFixed(1)}kg)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            healthAnalysis.weight.status === 'significant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {healthAnalysis.weight.status === 'significant' ? '顯著變化' : '正常範圍'}
          </div>
        </div>

        {/* 體脂趨勢 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
              healthAnalysis.bodyFat.trend === 'down' ? 'bg-green-100' :
              healthAnalysis.bodyFat.trend === 'up' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              {healthAnalysis.bodyFat.trend === 'down' ? (
                <TrendingDown size={20} className="text-green-600" />
              ) : healthAnalysis.bodyFat.trend === 'up' ? (
                <TrendingUp size={20} className="text-red-600" />
              ) : (
                <Minus size={20} className="text-gray-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">體脂率</div>
              <div className="text-sm text-gray-600">
                {healthAnalysis.bodyFat.current}%
                {healthAnalysis.bodyFat.change !== 0 && (
                  <span className={`ml-2 ${
                    healthAnalysis.bodyFat.trend === 'down' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({healthAnalysis.bodyFat.trend === 'down' ? '-' : '+'}{Math.abs(healthAnalysis.bodyFat.change).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            healthAnalysis.bodyFat.status === 'significant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {healthAnalysis.bodyFat.status === 'significant' ? '顯著變化' : '正常範圍'}
          </div>
        </div>

        {/* 肌肉量趨勢 */}
        {healthAnalysis.muscleMass && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                healthAnalysis.muscleMass.trend === 'up' ? 'bg-green-100' :
                healthAnalysis.muscleMass.trend === 'down' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                {healthAnalysis.muscleMass.trend === 'up' ? (
                  <TrendingUp size={20} className="text-green-600" />
                ) : healthAnalysis.muscleMass.trend === 'down' ? (
                  <TrendingDown size={20} className="text-red-600" />
                ) : (
                  <Minus size={20} className="text-gray-600" />
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">肌肉量</div>
                <div className="text-sm text-gray-600">
                  {healthAnalysis.muscleMass.current}kg
                  {healthAnalysis.muscleMass.change !== 0 && (
                    <span className={`ml-2 ${
                      healthAnalysis.muscleMass.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ({healthAnalysis.muscleMass.trend === 'up' ? '+' : '-'}{Math.abs(healthAnalysis.muscleMass.change).toFixed(1)}kg)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              healthAnalysis.muscleMass.status === 'significant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {healthAnalysis.muscleMass.status === 'significant' ? '顯著變化' : '正常範圍'}
            </div>
          </div>
        )}
      </div>

      {/* 健康建議 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <div className="flex items-start">
          <Target size={20} className="text-blue-600 mr-3 mt-1" />
          <div>
            <div className="font-medium text-blue-900 mb-1">健康建議</div>
            <div className="text-sm text-blue-800">
              {healthScore >= 80 ? '健康狀況良好，請繼續保持！' :
               healthScore >= 60 ? '健康狀況尚可，建議加強運動和飲食控制。' :
               '健康狀況需要改善，建議諮詢專業醫療人員。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HealthAnalysis
