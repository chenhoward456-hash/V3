import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase'
import ReportView from '@/components/assessment/ReportView'
import type { AssessmentReport } from '@/lib/assessment-report'
import type { InBodyReading } from '@/lib/inbody-ocr'

export const dynamic = 'force-dynamic'

/**
 * 會員看的體測報告（不需登入，靠不可猜的 token）。
 *
 * ⚠️ 顯示的是**產出當下的快照**，不是即時重算 ——
 * 判讀邏輯之後會改，但會員手上那份連結看到的東西不該無聲變動。
 *
 * 沒有帳號也看得到，因為大多數做體測的人還不是學員。
 * 要他先註冊才能看自己的身體數據，那是把摩擦放在最錯的位置。
 */

export const metadata = {
  title: '你的體測報告',
  robots: { index: false, follow: false },   // 不進搜尋引擎
}

export default async function AssessmentTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(token)) notFound()

  const supabase = createServiceSupabase()
  const { data } = await supabase
    .from('assessments')
    .select('measured_at, reading, report, revoked_at')
    .eq('token', token)
    .maybeSingle<{
      measured_at: string | null
      reading: InBodyReading
      report: AssessmentReport
      revoked_at: string | null
    }>()

  if (!data || data.revoked_at) notFound()

  const r = data.reading

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <ReportView
          report={data.report}
          meta={{
            measuredAt: data.measured_at ?? r.measured_at,
            gender: r.gender,
            age: r.age,
            height: r.height,
            weight: r.weight,
          }}
        />
      </div>
    </main>
  )
}
