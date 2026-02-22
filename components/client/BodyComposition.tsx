'use client'

import { useState, useMemo } from 'react'
import { Calendar, X, Plus, Scale, Activity, Dumbbell, Ruler, Heart } from 'lucide-react'
import LazyChart from '@/components/charts/LazyChart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface BodyCompositionProps {
  latestBodyData: any
  prevBodyData: any
  bmi: string | null
  trendData: Record<string, any[]>
  bodyData: any[]
  clientId: string
  competitionEnabled?: boolean
  targetWeight?: number | null
  competitionDate?: string | null
  onMutate: () => void
}

export default function BodyComposition({
  latestBodyData, prevBodyData, bmi, trendData, bodyData, clientId, competitionEnabled, targetWeight, competitionDate, onMutate
}: BodyCompositionProps) {
  const [trendType, setTrendType] = useState<'weight' | 'body_fat'>('weight')
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: todayStr,
    weight: '', body_fat: '', muscle_mass: '', height: '', visceral_fat: ''
  })

  // 選定日期是否已有紀錄
  const existingRecord = bodyData?.find((r: any) => r.date === form.date) || null
  const isUpdate = !!existingRecord

  // 7 日移動平均線（備賽模式）
  const weightMAData = useMemo(() => {
    if (!bodyData?.length) return null
    const sorted = [...bodyData]
      .filter((r: any) => r.weight != null)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    if (sorted.length < 3) return null

    return sorted.map((r: any, idx: number) => {
      const windowStart = Math.max(0, idx - 6)
      const window = sorted.slice(windowStart, idx + 1)
      const ma = window.reduce((sum: number, d: any) => sum + d.weight, 0) / window.length
      return {
        date: new Date(r.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        rawDate: r.date,
        value: r.weight,
        ma7: Math.round(ma * 10) / 10,
      }
    })
  }, [bodyData])

  // 體重軌跡 vs 目標體重（含預測線）
  const trajectoryData = useMemo(() => {
    if (!competitionEnabled || !targetWeight || !competitionDate || !weightMAData || weightMAData.length < 3) return null

    const compDate = new Date(competitionDate)
    const now = new Date()
    const daysToComp = Math.ceil((compDate.getTime() - now.getTime()) / 86400000)
    if (daysToComp < 0) return null // 比賽已過

    // 取近 14 天的 MA7 做線性回歸
    const recentMA = weightMAData.slice(-14)
    const n = recentMA.length

    // 線性回歸：y = a + bx（x = 天數索引）
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    recentMA.forEach((d, i) => {
      sumX += i
      sumY += d.ma7
      sumXY += i * d.ma7
      sumX2 += i * i
    })
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const lastMA = recentMA[recentMA.length - 1].ma7

    // 預測比賽日體重
    const predictedWeight = Math.round((lastMA + slope * daysToComp) * 10) / 10

    // 構建圖表數據：實際數據 + 預測延伸
    const chartData: { date: string; actual: number | null; ma7: number | null; predicted: number | null }[] = []

    // 加入歷史數據（最近 30 天）
    const recent30 = weightMAData.slice(-30)
    recent30.forEach((d) => {
      chartData.push({
        date: d.date,
        actual: d.value,
        ma7: d.ma7,
        predicted: null,
      })
    })

    // 從最後一個 MA7 開始預測到比賽日
    const lastEntry = recent30[recent30.length - 1]
    // 把最後一個點也加到 predicted 讓線連接
    chartData[chartData.length - 1].predicted = lastEntry.ma7

    // 每 3 天加一個預測點（或到比賽日）
    const interval = Math.max(1, Math.min(3, Math.floor(daysToComp / 6)))
    for (let day = interval; day <= daysToComp; day += interval) {
      const predDate = new Date(now)
      predDate.setDate(now.getDate() + day)
      const predWeight = Math.round((lastMA + slope * day) * 10) / 10
      chartData.push({
        date: predDate.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        actual: null,
        ma7: null,
        predicted: predWeight,
      })
    }

    // 確保比賽日那天有一個點
    const compDateStr = compDate.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
    const lastChartDate = chartData[chartData.length - 1]?.date
    if (lastChartDate !== compDateStr) {
      chartData.push({
        date: compDateStr,
        actual: null,
        ma7: null,
        predicted: predictedWeight,
      })
    }

    // 計算 Y 軸範圍
    const allValues = [
      ...chartData.map(d => d.actual).filter((v): v is number => v != null),
      ...chartData.map(d => d.ma7).filter((v): v is number => v != null),
      ...chartData.map(d => d.predicted).filter((v): v is number => v != null),
      targetWeight,
    ]
    const minY = Math.floor(Math.min(...allValues) - 1)
    const maxY = Math.ceil(Math.max(...allValues) + 1)

    const diff = Math.abs(predictedWeight - targetWeight)
    const onTrack = diff <= 0.5

    return { chartData, predictedWeight, daysToComp, slope, lastMA, minY, maxY, onTrack, diff }
  }, [competitionEnabled, targetWeight, competitionDate, weightMAData])

  const handleSubmit = async () => {
    if (!form.weight || form.weight.trim() === '') { alert('請輸入體重'); return }
    const weight = parseFloat(form.weight)
    if (isNaN(weight) || weight < 20 || weight > 300) { alert('體重請輸入 20-300kg 之間的數值'); return }
    try {
      const res = await fetch('/api/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, date: form.date, weight,
          bodyFat: form.body_fat ? parseFloat(form.body_fat) : null,
          muscleMass: form.muscle_mass ? parseFloat(form.muscle_mass) : null,
          height: form.height ? parseFloat(form.height) : null,
          visceralFat: form.visceral_fat ? parseFloat(form.visceral_fat) : null
        })
      })
      if (!res.ok) throw new Error('保存失敗')
      setShowModal(false)
      setForm({ date: new Date().toISOString().split('T')[0], weight: '', body_fat: '', muscle_mass: '', height: '', visceral_fat: '' })
      onMutate()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch { alert('儲存失敗，請重試') }
  }

  return (
    <>
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-lg">🎉</span>
          <span className="text-sm font-medium">身體數據已記錄！</span>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">身體數據追蹤</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: '體重', value: latestBodyData?.weight, prev: prevBodyData?.weight, unit: 'kg', lowerBetter: true },
            { label: '體脂', value: latestBodyData?.body_fat, prev: prevBodyData?.body_fat, unit: '%', lowerBetter: true },
            { label: 'BMI', value: bmi ? parseFloat(bmi) : null, prev: null, unit: '', lowerBetter: false },
            { label: '肌肉量', value: latestBodyData?.muscle_mass, prev: prevBodyData?.muscle_mass, unit: 'kg', lowerBetter: false },
          ].map(({ label, value, prev, unit, lowerBetter }) => (
            <div key={label} className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-xl font-bold text-gray-900">
                {value != null ? `${value}${unit ? ` ${unit}` : ''}` : '--'}
              </p>
              {prev != null && value != null && prev !== value && (
                <p className={`text-xs mt-1 ${(lowerBetter ? value < prev : value > prev) ? 'text-green-600' : 'text-red-500'}`}>
                  {(lowerBetter ? value < prev : value > prev) ? (lowerBetter ? '↓' : '↑') : (lowerBetter ? '↑' : '↓')}
                  {Math.abs(value - prev).toFixed(1)}{unit}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex space-x-2 mb-4">
          {(['weight', 'body_fat'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTrendType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                trendType === type ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {type === 'weight' ? '體重趨勢' : '體脂趨勢'}
            </button>
          ))}
        </div>

        <div className="h-64 w-full min-w-0">
          <LazyChart data={trendData[trendType] || []} height={256} stroke="#3b82f6" strokeWidth={2} />
        </div>

        {/* 體重軌跡 vs 目標體重（備賽模式） */}
        {trajectoryData && targetWeight && (
          <div className="mt-4 border-t border-amber-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">🏆 體重軌跡 vs 目標</p>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> 實際</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" /> 7日均</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-400 inline-block rounded" style={{borderTop: '2px dashed #9ca3af', height: 0}} /> 預測</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" style={{borderTop: '2px dashed #f87171', height: 0}} /> 目標</span>
              </div>
            </div>

            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryData.chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} tick={{ fill: '#9ca3af' }} interval="preserveStartEnd" />
                  <YAxis domain={[trajectoryData.minY, trajectoryData.maxY]} fontSize={10} tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 8, border: 'none', fontSize: 12 }}
                    labelStyle={{ color: '#ccc' }}
                    formatter={(value: any, name: any) => {
                      const labels: Record<string, string> = { actual: '實際體重', ma7: '7日均值', predicted: '預測' }
                      return [`${value} kg`, labels[name as string] || name]
                    }}
                  />
                  <ReferenceLine
                    y={targetWeight}
                    stroke="#f87171"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: `目標 ${targetWeight}kg`, position: 'right', fontSize: 10, fill: '#f87171' }}
                  />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2, fill: '#3b82f6' }} connectNulls={false} />
                  <Line type="monotone" dataKey="ma7" stroke="#f97316" strokeWidth={2} dot={{ r: 2, fill: '#f97316' }} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2, fill: '#9ca3af' }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 資訊摘要 */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">目前體重（7日均）</p>
                <p className="text-lg font-bold text-orange-600">{trajectoryData.lastMA} kg</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">目標體重</p>
                <p className="text-lg font-bold text-red-500">{targetWeight} kg</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">預測比賽日體重</p>
                <p className={`text-lg font-bold ${trajectoryData.onTrack ? 'text-green-600' : 'text-amber-600'}`}>
                  {trajectoryData.predictedWeight} kg
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">距離比賽</p>
                <p className="text-lg font-bold text-gray-700">{trajectoryData.daysToComp} 天</p>
              </div>
            </div>

            {/* 狀態判斷 */}
            <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
              trajectoryData.onTrack
                ? 'bg-green-50 text-green-700 border border-green-200'
                : trajectoryData.predictedWeight > targetWeight
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {trajectoryData.onTrack
                ? '✅ 在軌道上！照目前趨勢，比賽日可以達到目標體重'
                : trajectoryData.predictedWeight > targetWeight
                  ? `⚠️ 預計比目標重 ${trajectoryData.diff.toFixed(1)} kg，需要加速減重`
                  : `💡 預計比目標輕 ${trajectoryData.diff.toFixed(1)} kg，減重速度良好`
              }
            </div>

            {/* 每週掉重速率 */}
            {trajectoryData.slope !== 0 && (
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                目前趨勢：每週 {trajectoryData.slope > 0 ? '+' : ''}{(trajectoryData.slope * 7).toFixed(2)} kg/週
              </p>
            )}
          </div>
        )}

        {/* 7 日移動平均線（備賽模式，無目標體重時 fallback） */}
        {competitionEnabled && !trajectoryData && weightMAData && weightMAData.length >= 3 && (
          <div className="mt-4 border-t border-amber-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">🏆 體重 7 日移動平均</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> 實際</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded border-dashed" style={{borderTop: '2px dashed #fb923c', height: 0}} /> 7日均</span>
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-28">
              {weightMAData.slice(-14).map((d, i) => {
                const allValues = weightMAData.slice(-14)
                const minW = Math.min(...allValues.map(v => Math.min(v.value, v.ma7))) - 0.5
                const maxW = Math.max(...allValues.map(v => Math.max(v.value, v.ma7))) + 0.5
                const range = maxW - minW || 1
                const rawPct = ((d.value - minW) / range) * 100
                const maPct = ((d.ma7 - minW) / range) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center relative" style={{height: '100%'}}>
                    <div
                      className="absolute w-2 h-2 bg-orange-400 rounded-full z-10"
                      style={{ bottom: `${maPct}%`, transform: 'translateY(50%)' }}
                      title={`7日均: ${d.ma7}kg`}
                    />
                    <div
                      className="absolute w-2 h-2 bg-blue-500 rounded-full z-10"
                      style={{ bottom: `${rawPct}%`, transform: 'translateY(50%)' }}
                      title={`${d.value}kg`}
                    />
                    <span className="absolute bottom-0 translate-y-full text-[8px] text-gray-400 mt-1">{i % 2 === 0 ? d.date.split('/')[1] : ''}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-4 text-xs text-gray-500">
              <span>最新均值: <strong className="text-orange-600">{weightMAData[weightMAData.length - 1].ma7}kg</strong></span>
              {weightMAData.length >= 8 && (
                <span>
                  vs 上週均: {(() => {
                    const diff = weightMAData[weightMAData.length - 1].ma7 - weightMAData[Math.max(0, weightMAData.length - 8)].ma7
                    return <strong className={diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-500' : 'text-gray-500'}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}kg</strong>
                  })()}
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0]
            const todayRecord = bodyData?.find((r: any) => r.date === today)
            if (todayRecord) {
              setForm({
                date: today,
                weight: todayRecord.weight != null ? String(todayRecord.weight) : '',
                body_fat: todayRecord.body_fat != null ? String(todayRecord.body_fat) : '',
                muscle_mass: todayRecord.muscle_mass != null ? String(todayRecord.muscle_mass) : '',
                height: todayRecord.height != null ? String(todayRecord.height) : '',
                visceral_fat: todayRecord.visceral_fat != null ? String(todayRecord.visceral_fat) : '',
              })
            } else {
              setForm({ date: today, weight: '', body_fat: '', muscle_mass: '', height: '', visceral_fat: '' })
            }
            setShowModal(true)
          }}
          className="w-full mt-4 bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> 新增身體紀錄
        </button>
      </div>


      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end justify-center z-[100] backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Plus size={16} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{isUpdate ? '更新身體數據' : '新增身體數據'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { key: 'date', label: '日期', icon: Calendar, type: 'date', required: false, unit: '', min: '', max: '', step: '' },
                { key: 'weight', label: '體重 (kg)', icon: Scale, type: 'number', required: true, unit: 'kg', min: '20', max: '300', step: '0.1' },
                { key: 'body_fat', label: '體脂 (%)', icon: Activity, type: 'number', required: false, unit: '%', min: '1', max: '60', step: '0.1' },
                { key: 'muscle_mass', label: '肌肉量 (kg)', icon: Dumbbell, type: 'number', required: false, unit: 'kg', min: '10', max: '100', step: '0.1' },
                { key: 'height', label: '身高 (cm)', icon: Ruler, type: 'number', required: false, unit: 'cm', min: '100', max: '250', step: '0.1' },
                { key: 'visceral_fat', label: '內臟脂肪', icon: Heart, type: 'number', required: false, unit: '', min: '1', max: '30', step: '0.1' },
              ].map(({ key, label, icon: Icon, type, required, unit, min, max, step }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Icon size={16} className="mr-1 text-gray-500" />
                    {label} {required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={type}
                      step={step || undefined}
                      min={min || undefined}
                      max={max || undefined}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => {
                        const val = e.target.value
                        if (key === 'date') {
                          const rec = bodyData?.find((r: any) => r.date === val)
                          if (rec) {
                            setForm({
                              date: val,
                              weight: rec.weight != null ? String(rec.weight) : '',
                              body_fat: rec.body_fat != null ? String(rec.body_fat) : '',
                              muscle_mass: rec.muscle_mass != null ? String(rec.muscle_mass) : '',
                              height: rec.height != null ? String(rec.height) : '',
                              visceral_fat: rec.visceral_fat != null ? String(rec.visceral_fat) : '',
                            })
                          } else {
                            setForm({ date: val, weight: '', body_fat: '', muscle_mass: '', height: '', visceral_fat: '' })
                          }
                        } else {
                          setForm(prev => ({ ...prev, [key]: val }))
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder={required ? `請輸入${label.split(' ')[0]}` : '選填'}
                    />
                    {unit && <span className="absolute right-3 top-3 text-gray-500 text-sm">{unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <button onClick={handleSubmit} className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg">
                <Plus size={20} className="mr-2" /> {isUpdate ? '更新紀錄' : '儲存紀錄'}
              </button>
              <button onClick={() => setShowModal(false)} className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-all">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
