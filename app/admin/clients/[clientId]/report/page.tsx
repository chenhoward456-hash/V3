'use client'

import { useParams } from 'next/navigation'
import HealthReportDocument from '@/components/HealthReportDocument'

// 教練端報告 = 共用文件的 coach 模式（含文獻欄）。實際內容在 components/HealthReportDocument.tsx
export default function AdminReportPage() {
  const { clientId } = useParams()
  return <HealthReportDocument clientId={String(clientId)} mode="coach" />
}
