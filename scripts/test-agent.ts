/**
 * One-off agent test runner (CLI)
 * Usage: npx tsx scripts/test-agent.ts "你的測試訊息"
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  // Dynamic import so dotenv loads first
  const { runAgent } = await import('../lib/agent-runner')
  const userMessage = process.argv[2] ?? '我覺得最近碳水太多想試低碳'

  console.log('━'.repeat(60))
  console.log('🧠 Test Message:', userMessage)
  console.log('🎯 Context: 陳胤豪 (client_id=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4)')
  console.log('━'.repeat(60))
  console.log('\n⏳ Running agent...\n')

  const t0 = Date.now()
  const result = await runAgent({
    userMessage,
    contextHint: '陳胤豪 (client_id=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4)',
  })
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`✅ Done in ${elapsedSec}s · stop_reason=${result.stopReason}`)
  console.log(`📊 Tokens: in=${result.totalTokens.input}, out=${result.totalTokens.output}`)
  console.log(`💰 Est cost: NT$${((result.totalTokens.input * 3 + result.totalTokens.output * 15) / 1_000_000 * 32).toFixed(2)}`)

  console.log('\n━━━━━━━━━━━━━━ 🛠️ Tool Calls (' + result.toolCalls.length + ') ━━━━━━━━━━━━━━')
  result.toolCalls.forEach((tc, i) => {
    console.log(`\n[${i + 1}] ${tc.name}`)
    console.log('  input:', JSON.stringify(tc.input).slice(0, 200))
    const resultStr = JSON.stringify(tc.result)
    console.log('  result:', resultStr.length > 400 ? resultStr.slice(0, 400) + '... (truncated)' : resultStr)
  })

  console.log('\n━━━━━━━━━━━━━━ 💬 Final Response ━━━━━━━━━━━━━━')
  console.log(result.finalText)
  console.log('━'.repeat(60))
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
