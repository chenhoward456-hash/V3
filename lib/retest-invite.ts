/**
 * 回檢邀請：血檢逾期的學員，教練一個字（「發回檢 名字」）就把「該回來抽血了＋去哪科、怎麼跟醫生說、驗哪些、怎麼準備」
 * 傳給他。
 *
 * 為什麼（2026-10-09）：晨報每天第一位都是「謝佳峻：血檢回檢逾期 76 天」，但沒有任何一個字能處理它 ——
 * 只能每天被提醒。9/30 那份給 Andre 的 LINE 版下次清單是手工做成桌面 txt 的。
 * 系統早就算得出要驗什麼（lib/lab-order → lib/lab-order-student 學員白話版），缺的是「教練一句話送出去」。
 *
 * 內容只用學員端已過合規的零件（visitToText／cleanPrepNotes），不帶價格、病名、藥名；
 * 送出前 sendCoachMessage 還會再掃一次。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildStudentLabVisit, visitToText, type StudentLabVisit } from './lab-order-student'
import { loadStudentLabOrder } from './lab-order-data'

const DEFAULT_PREP = [
  '・前 3 天別練大重量或新動作（肌肉被操完，肝指數和 CK 會高好幾天）',
  '・前一晚 10 點後只喝水，早上空腹去抽',
  '・前一天別喝酒',
]
const BIOTIN_NOTE = '・有吃生物素或高劑量 B 群的先停 3 天（會干擾荷爾蒙、甲狀腺的數字）'

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

export function buildRetestInvite(input: {
  name: string
  lastDrawDate: string | null
  today: string
  visit: StudentLabVisit
}): string {
  const { name, lastDrawDate, today, visit } = input
  const months = lastDrawDate ? Math.round((Date.parse(today) - Date.parse(lastDrawDate)) / (30.4 * 86_400_000)) : null
  const opener = lastDrawDate
    ? `${name}，上次抽血是 ${md(lastDrawDate)}${months != null && months >= 1 ? `，已經 ${months} 個月了` : ''}。該回來看看那幾個數字有沒有往好的方向走。`
    : `${name}，該抽一次血了，先拿到你自己的基準值，之後才看得出進退。`
  return [
    opener,
    '',
    visitToText(visit),
    '',
    '抽血前：',
    // 公版有寫準備事項就用公版的（避免同一件事講兩遍），只補公版沒有的生物素
    ...(visit.prepNotes.length ? visit.prepNotes.map(n => `・${n}`) : DEFAULT_PREP),
    BIOTIN_NOTE,
    '',
    visit.selfPayNote,
    '報告拿到後直接拍照傳到這裡，我幫你對上次的數字。',
  ].join('\n')
}

/** 讀 DB 組好整則邀請；學員沒開血檢追蹤或沒有可建議的項目回 null */
export async function loadRetestInvite(
  supabase: SupabaseClient,
  clientId: string,
  today: string,
): Promise<{ name: string; text: string } | null> {
  const [{ data: c }, order, { data: last }] = await Promise.all([
    supabase.from('clients').select('name, age, gender, goal_type, training_enabled').eq('id', clientId).maybeSingle(),
    loadStudentLabOrder(supabase, clientId),
    supabase.from('lab_results').select('date').eq('client_id', clientId).order('date', { ascending: false }).limit(1),
  ])
  if (!c || !order || !order.enabled) return null
  const client = c as { name: string; age: number | null; gender: string | null; goal_type: string | null; training_enabled: boolean | null }
  const visit = buildStudentLabVisit(order, {
    age: client.age, gender: client.gender, goalType: client.goal_type, trainingEnabled: client.training_enabled,
  })
  if (visit.items.length === 0) return null
  const lastDrawDate = (last as { date: string }[] | null)?.[0]?.date ?? null
  return { name: client.name, text: buildRetestInvite({ name: client.name, lastDrawDate, today, visit }) }
}
