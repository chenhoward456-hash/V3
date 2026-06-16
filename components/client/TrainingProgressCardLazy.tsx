'use client'

import { useEffect, useState } from 'react'
import TrainingProgressCard from '@/components/client/TrainingProgressCard'
import type { TrainingSetRow } from '@/lib/training-progress'

/**
 * 學員端的訓練進步卡：自己抓近 120 天逐組紀錄（不再塞進首屏 /api/clients payload）。
 * 它在頁面尾段(below-fold)，mount 時才抓 → 首屏更輕。Admin 端仍直接用 TrainingProgressCard。
 */
export default function TrainingProgressCardLazy({ clientCode }: { clientCode: string }) {
  const [sets, setSets] = useState<TrainingSetRow[] | null>(null)

  useEffect(() => {
    if (!clientCode) return
    let alive = true
    fetch(`/api/training-sets-range?clientId=${encodeURIComponent(clientCode)}&days=120`)
      .then(r => r.json())
      .then(d => { if (alive) setSets(Array.isArray(d?.data) ? d.data : []) })
      .catch(() => { if (alive) setSets([]) })
    return () => { alive = false }
  }, [clientCode])

  if (!sets || sets.length === 0) return null // 還在抓 or 沒資料 → 不佔位
  return <TrainingProgressCard sets={sets} />
}
