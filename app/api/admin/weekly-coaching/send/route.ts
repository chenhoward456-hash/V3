import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { sendRoutineReminder } from '@/lib/notify'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

const MAX_MESSAGE_LEN = 1500 // 學員卡片是完整顯示，過長會吃滿首屏

// POST /api/admin/weekly-coaching/send  { clientId, message, mode }
// 發送本週教練訊息給單一學員：Web Push 優先、沒推播才退 LINE（sendRoutineReminder）。
// 兩管道都接好 → 隨學員陸續開通推播，同一顆鈕自動走 web、不佔 LINE 額度。
export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  let body: { clientId?: string; message?: string; mode?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  const { clientId, message, mode } = body
  if (!clientId || typeof clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: '無效的 clientId' }, { status: 400 })
  }
  if (!message || !message.trim()) {
    return NextResponse.json({ error: '缺少 message' }, { status: 400 })
  }
  const cleanMsg = message.trim()
  if (cleanMsg.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `訊息過長（${cleanMsg.length}/${MAX_MESSAGE_LEN}）` }, { status: 400 })
  }

  // 醫療合規紅線：教練可手改草稿，發送前攔下診斷/處方/疾病名（V3 紅線）
  const hits = scanMedicalCompliance(cleanMsg)
  if (hits.length > 0) {
    return NextResponse.json({
      error: '訊息含醫療合規紅線字，請改寫後再發',
      compliance: hits, // [{ term, reason }]
    }, { status: 422 })
  }

  const supabase = createServiceSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('name, line_user_id, unique_code, is_active, expires_at')
    .eq('id', clientId)
    .maybeSingle<{ name: string; line_user_id: string | null; unique_code: string; is_active: boolean | null; expires_at: string | null }>()
  if (!client) return NextResponse.json({ error: '找不到學員' }, { status: 404 })
  // 與 /api/clients、佇列端一致：停用/過期學員不發送
  if (client.is_active === false) return NextResponse.json({ error: '此學員已停用，不發送' }, { status: 409 })
  if (client.expires_at && new Date(client.expires_at) < new Date()) {
    return NextResponse.json({ error: '此學員已過期，不發送' }, { status: 409 })
  }

  const title = mode === 'accountability' ? '👋 Howard 找你回來' : '💬 Howard 的本週調整'
  const firstLine = cleanMsg.split('\n').find(l => l.trim()) || '點開看本週調整'

  // 1) 先持久化（確保學員「點進去一定看得到」）。insert 失敗就不推播、回 500 讓教練重試，
  //    避免「推播跳通知、但儀表板查無此筆 → 又看不到內容」的回歸 bug。
  const { data: inserted, error: insertErr } = await supabase
    .from('coach_messages')
    .insert({
      client_id: clientId,
      title,
      body: cleanMsg,
      mode: mode === 'accountability' ? 'accountability' : 'adjust',
      sent_via: 'manual', // 先佔位，推播後回填實際管道
    })
    .select('id')
    .single<{ id: string }>()
  if (insertErr || !inserted) {
    console.error('[weekly-coaching/send] coach_messages insert 失敗', insertErr)
    return NextResponse.json({ error: '訊息儲存失敗，尚未發送，請重試' }, { status: 500 })
  }

  // 2) 推播（Web Push 優先、退 LINE、都沒有就 skipped）
  const result = await sendRoutineReminder(clientId, client.line_user_id ?? '', {
    title,
    body: firstLine.slice(0, 80),
    lineText: cleanMsg,
    url: `/c/${client.unique_code}`, // 學員實際儀表板（/dashboard 不存在會 404）
  })

  // 3) 回填「實際送達管道」——沒成功就記 skipped，別讓稽核以為送出去了
  await supabase
    .from('coach_messages')
    .update({ sent_via: result.success ? result.method : 'skipped' })
    .eq('id', inserted.id)

  return NextResponse.json({
    method: result.method,           // web_push / line_push / skipped
    success: result.success,         // 推播是否真的送出
    saved: true,                     // 訊息已存進儀表板（學員自己打開就看得到，不靠推播）
  })
}
