/**
 * 誰的資料密度夠讓引擎自己決定？
 *
 * 跑法：npx tsx scripts/automation-readiness.ts
 *
 * ⚠️ 這支存在的理由（2026-08-16 Howard：「是不是很難有折衷之道？」）：
 * 「自動 vs 教練手動」不是信任問題，是**資料問題**。引擎在資料稀疏時會產生
 * 離譜建議 —— 2026-06 那批提案就是證據：Eddie 被建議砍到 1500 kcal、William
 * 被建議加到 4510，兩人當時都已經好幾週沒記錄。批准制擋下來是對的。
 *
 * 所以判斷「能不能交給引擎」的標準不是學員多重要、教練多信任系統，
 * 而是**過去 21 天他到底記了幾天**。這支就是量那個。
 *
 * 門檻（跟 trajectory-adjust 的守門一致的精神，但更嚴）：
 *   · 體重 ≥ 70%（15/21 天）—— 引擎的主訊號，要能算出可信斜率
 *   · 飲食 ≥ 50%（11/21 天）—— 用來對帳（見 lib/implied-intake）
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const WINDOW_DAYS = 21
const WEIGHT_THRESHOLD = 0.70
const NUTRITION_THRESHOLD = 0.50
const DAY = 86400000

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, subscription_tier, coach_macro_override, auto_adjust_enabled')
    .eq('is_active', true)
  if (error) throw error

  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString().slice(0, 10)
  const rows: Array<{ name: string; wRate: number; nRate: number; ready: boolean; locked: boolean }> = []

  for (const c of clients ?? []) {
    const [{ data: body }, { data: nutrition }] = await Promise.all([
      supabase.from('body_composition').select('date').eq('client_id', c.id).gte('date', since).not('weight', 'is', null),
      supabase.from('nutrition_logs').select('date').eq('client_id', c.id).gte('date', since).not('calories', 'is', null),
    ])
    const wDays = new Set((body ?? []).map(x => x.date)).size
    const nDays = new Set((nutrition ?? []).map(x => x.date)).size
    const wRate = wDays / WINDOW_DAYS
    const nRate = nDays / WINDOW_DAYS
    rows.push({
      name: c.name,
      wRate,
      nRate,
      ready: wRate >= WEIGHT_THRESHOLD && nRate >= NUTRITION_THRESHOLD,
      locked: !!c.coach_macro_override,
    })
  }

  rows.sort((a, b) => (b.wRate + b.nRate) - (a.wRate + a.nRate))

  console.log(`\n近 ${WINDOW_DAYS} 天資料密度（門檻：體重 ${WEIGHT_THRESHOLD * 100}% / 飲食 ${NUTRITION_THRESHOLD * 100}%）\n`)
  for (const r of rows) {
    const pct = (v: number) => String(Math.round(v * 100)).padStart(3) + '%'
    console.log(
      r.name.padEnd(8),
      '體重', pct(r.wRate),
      '飲食', pct(r.nRate),
      r.ready ? ' ✅ 可交給引擎' : ' ❌ 資料不夠，引擎會亂猜',
      r.locked ? '（macro 目前鎖住，引擎不會動）' : '',
    )
  }

  const ready = rows.filter(r => r.ready)
  console.log(`\n${ready.length} / ${rows.length} 人資料夠。`)
  if (ready.length) console.log('可考慮放進 AUTO_APPLY_CLIENT_IDS：', ready.map(r => r.name).join('、'))
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
