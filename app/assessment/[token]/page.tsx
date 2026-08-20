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

/**
 * ⚠️ 2026-08-21 完全去品牌（Howard 決定）。
 *
 * 根 layout 的 metadata 掛的是「Howard Protocol」個人品牌（含 OG 圖是他本人照片）。
 * 這份報告要給館內其他教練用，會員拿到一份掛著某個教練個人品牌的東西不合適 ——
 * 分享到 LINE 時預覽卡也會是那樣。
 *
 * 所以整組覆寫成中性的：標題、描述、OG、Twitter 卡全部不提任何品牌或人名。
 * 之後若要掛場館品牌，改這一處即可。
 */
export const metadata = {
  title: '體測報告',
  description: '你的體組成分析與後續建議。',
  robots: { index: false, follow: false },   // 不進搜尋引擎
  // 根 layout 的 author/keywords 會被繼承下來（"Howard Chen" + 一串個人品牌關鍵字）→ 清掉
  authors: [] as never[],
  keywords: [] as never[],
  openGraph: {
    title: '體測報告',
    description: '你的體組成分析與後續建議。',
    type: 'article' as const,
    locale: 'zh_TW',
    siteName: '',
    images: [] as never[],
  },
  twitter: { card: 'summary' as const, title: '體測報告', description: '你的體組成分析與後續建議。', images: [] as never[] },
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

  // 記一次瀏覽。⚠️ 只記次數與時間，不記 IP、裝置或任何識別資訊 ——
  // 這是要回答「會員到底有沒有點開」，不是要追蹤人。
  // fire-and-forget：計數失敗不能影響會員看報告。
  void supabase.rpc('increment_assessment_view', { p_token: token }).then(
    ({ error }) => { if (error) console.error('[assessment] 計數失敗', error.message) },
  )

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
