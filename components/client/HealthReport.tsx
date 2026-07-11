'use client'

import { useRef, useMemo } from 'react'
import { LabResult, Supplement, BodyData } from './types'
import { getLabAdvice } from './types'

interface HealthReportProps {
  client: {
    name: string
    age: number
    gender: string
    coach_summary?: string
    health_goals?: string
    next_checkup_date?: string
    lab_results?: LabResult[]
    supplements?: Supplement[]
  }
  latestBodyData: BodyData | null
  bmi: string | null
  weekRate: number
  monthRate: number
}

export default function HealthReport({ client, latestBodyData, bmi, weekRate, monthRate }: HealthReportProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const statusLabel = (s: string) => s === 'normal' ? '正常' : s === 'attention' ? '需注意' : '異常'

  // 每個指標只取最新一筆
  const latestLabResults = useMemo(() => {
    if (!client.lab_results?.length) return []
    const map = new Map<string, LabResult>()
    for (const r of client.lab_results) {
      const existing = map.get(r.test_name)
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        map.set(r.test_name, r)
      }
    }
    return [...map.values()]
  }, [client.lab_results])

  return (
    <>
      <button
        onClick={handlePrint}
        className="w-full bg-gray-800 text-white py-3 rounded-xl font-medium hover:bg-gray-900 transition-colors mb-20"
      >
        匯出健康報告
      </button>

      {/* 隱藏的列印區塊 */}
      <div ref={printRef} className="print-report">
        <h1>{client.name} 健康追蹤報告</h1>
        <p className="report-date">匯出日期：{today}</p>

        <section>
          <h2>基本資料</h2>
          <table>
            <tbody>
              <tr><td>姓名</td><td>{client.name}</td></tr>
              <tr><td>年齡</td><td>{client.age} 歲</td></tr>
              <tr><td>性別</td><td>{client.gender}</td></tr>
            </tbody>
          </table>
        </section>

        {client.coach_summary && (
          <section>
            <h2>教練健康摘要</h2>
            <p className="report-summary">{client.coach_summary}</p>
          </section>
        )}

        <section>
          <h2>身體數據（最新）</h2>
          {latestBodyData ? (
            <table>
              <tbody>
                {latestBodyData.weight != null && <tr><td>體重</td><td>{latestBodyData.weight} kg</td></tr>}
                {latestBodyData.body_fat != null && <tr><td>體脂率</td><td>{latestBodyData.body_fat}%</td></tr>}
                {bmi && <tr><td>BMI</td><td>{bmi}</td></tr>}
                {latestBodyData.muscle_mass != null && <tr><td>肌肉量</td><td>{latestBodyData.muscle_mass} kg</td></tr>}
              </tbody>
            </table>
          ) : (
            <p>尚無身體數據</p>
          )}
        </section>

        {latestLabResults.length > 0 && (
          <section>
            <h2>血檢指標</h2>
            <table>
              <thead>
                <tr><th>指標</th><th>數值</th><th>參考範圍</th><th>狀態</th><th>建議</th></tr>
              </thead>
              <tbody>
                {latestLabResults.map((r) => (
                  <tr key={r.id}>
                    <td>{r.test_name}</td>
                    <td>{r.value} {r.unit}</td>
                    <td>{r.custom_target || r.reference_range}</td>
                    <td>{statusLabel(r.status)}</td>
                    <td>{r.custom_advice || getLabAdvice(r.test_name, r.value) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {client.supplements && client.supplements.length > 0 && (
          <section>
            <h2>補品方案</h2>
            <table>
              <thead>
                <tr><th>名稱</th><th>劑量</th><th>服用時間</th></tr>
              </thead>
              <tbody>
                {client.supplements.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.dosage}</td>
                    <td>{s.timing || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-compliance">本週補品服從率：{weekRate}% ｜ 本月補品服從率：{monthRate}%</p>
          </section>
        )}

        <section>
          <h2>健康計畫</h2>
          <table>
            <tbody>
              {client.health_goals && <tr><td>健康目標</td><td>{client.health_goals}</td></tr>}
              {client.next_checkup_date && (
                <tr><td>下次回檢</td><td>{new Date(client.next_checkup_date).toLocaleDateString('zh-TW')}</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <footer>
          <p>Howard 健康管理系統 — 此報告由系統自動產生</p>
        </footer>
      </div>
    </>
  )
}
