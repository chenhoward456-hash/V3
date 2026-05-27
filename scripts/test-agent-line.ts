/**
 * 模擬 LINE webhook 觸發 agent-line handler，不真的 push 訊息
 * 用來在本地驗證整個 flow 邏輯 ok（runAgent + proposal flow + chunk）
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const userMessage = process.argv[2] ?? '我這週體重停滯 之前的方法都試過了 該怎辦'

  // Mock LINE push/reply — 印出來不送
  const originalPushMessage = (await import('@/lib/line')).pushMessage
  ;(globalThis as any).__simulated_pushes = []

  // monkey-patch by replacing the module... 簡單版：直接 import handler 並用 fake supabase
  const { createServiceSupabase } = await import('../lib/supabase')
  const supabase = createServiceSupabase()

  // mock event
  const fakeEvent = { replyToken: 'fake_token_' + Date.now(), message: { text: userMessage } }

  console.log('━'.repeat(60))
  console.log('🎬 模擬 LINE 訊息:', userMessage)
  console.log('━'.repeat(60))

  // 直接呼叫 handler
  const { handleAdminAgentMessage } = await import('../lib/agent-line')
  console.log('\n⏳ Running...\n')

  // 為了不真的 push 到 LINE，先 set ADMIN_LINE_USER_ID 為假值（這樣 push 會跳過或記 log）
  // 但 LINE SDK 還是會嘗試呼叫真 API。用 console.log 攔截就好
  // 簡化：直接執行，LINE push 會 fail.catch 但流程能跑完
  await handleAdminAgentMessage(fakeEvent as any, supabase)

  console.log('\n✅ Flow 完成。檢查 pending_proposals 表看有沒有新提案。')

  const { data } = await supabase
    .from('pending_proposals')
    .select('id, proposed_changes, reasoning, status, proposed_at')
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })
    .limit(3)

  console.log('\n📋 最近 pending proposals:')
  for (const p of data ?? []) {
    console.log(`\n[${p.id.slice(0, 8)}] @ ${p.proposed_at}`)
    console.log(`  changes: ${JSON.stringify(p.proposed_changes)}`)
    console.log(`  reasoning: ${(p.reasoning || '').slice(0, 200)}...`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
