'use client'

import { useParams } from 'next/navigation'
import HealthReportDocument from '@/components/HealthReportDocument'

// 學員端報告 = 共用文件的 client 模式（隱藏學術文獻欄）。與教練看到的同一份來源。
// 同意 gate 由 app/c/[clientId]/layout.tsx 包住，這裡不需重複處理。
export default function ClientReportPage() {
  const { clientId } = useParams()
  return <HealthReportDocument clientId={String(clientId)} mode="client" />
}
