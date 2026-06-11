/**
 * 跨表 invariant 檢查（CLI 入口）
 *
 * 檢查邏輯在 lib/invariant-checks.ts（與每日 cron /api/cron/invariants 共用）。
 *
 * 用法：npm run check:invariants
 * 有 violation → exit 1（可掛 cron / CI；warning 不影響 exit code）
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { runInvariantChecks } from '../lib/invariant-checks'

// ── env ──
function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env.local 不存在時靠外部環境變數 */
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

async function main() {
  const findings = await runInvariantChecks(createClient(url!, key!))

  const violations = findings.filter(f => f.severity === 'violation')
  const warnings = findings.filter(f => f.severity === 'warning')

  for (const f of findings) {
    console.log(`${f.severity === 'violation' ? '❌' : '⚠️ '} [${f.check}] ${f.detail}`)
  }
  console.log(`\n結果：${violations.length} violations, ${warnings.length} warnings`)
  process.exit(violations.length > 0 ? 1 : 0)
}

main()
