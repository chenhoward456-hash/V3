/**
 * 保健品對帳主動通知（2026-10-03）。Howard：「系統可以聰明到這種也跟我說嗎，我不能一輩子問你吧」。
 * 血檢上傳、或用藥變動之後，重跑一次顧問卡的保健品對帳（lib/lab-consult.ts buildStack），
 * 有「要注意」或「沒有血檢依據」的就整理成一則給 Howard（走助手 relay，不吃學員 OA 額度）。
 * 純函式＋一支組裝；沒有要講的回 null，不洗版。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConsultStackItem } from '@/lib/lab-consult'
import { loadLabConsult } from '@/lib/lab-consult-data'

export function formatStackAlert(clientName: string, stack: ConsultStackItem[], trigger: string): string | null {
  const caution = stack.filter(x => x.status === 'caution')
  const none = stack.filter(x => x.status === 'no-indication')
  if (!caution.length && !none.length) return null
  const lines = [`💊 ${clientName} 的保健品對帳（${trigger}）`]
  if (caution.length) {
    lines.push('', '要注意：')
    for (const x of caution) lines.push(`・${x.name}：${x.basis}`)
  }
  if (none.length) {
    lines.push('', '血檢看不出需要：')
    for (const x of none) lines.push(`・${x.name}：${x.basis}`)
  }
  lines.push('', '要改清單跟助手說，或到後台補品頁改。')
  return lines.join('\n').slice(0, 4500)
}

/** 讀這位學員現在的顧問卡、組通知文字；讀不到或沒事回 null（呼叫端決定要不要推） */
export async function buildStackAlertFor(supabase: SupabaseClient, clientDbId: string, clientName: string, trigger: string): Promise<string | null> {
  try {
    const loaded = await loadLabConsult(supabase, clientDbId)
    if (!loaded?.consult) return null
    return formatStackAlert(clientName, loaded.consult.stack, trigger)
  } catch {
    return null
  }
}
