'use client'

import { useParams } from 'next/navigation'
import ConsentGate from '@/components/ConsentGate'

/**
 * 學員區共用 layout：把 ConsentGate 掛在這裡，確保「所有」子頁
 * （儀表板 + health/timeline/upload/standards/showcase + overview…）
 * 都被使用前同意（服務條款／隱私／醫療免責）攔住，
 * 不會有人直接打血檢路由的網址繞過免責同意。
 */
export default function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const raw = params?.clientId
  const clientId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  return (
    <>
      {clientId && <ConsentGate clientId={clientId} />}
      {children}
    </>
  )
}
