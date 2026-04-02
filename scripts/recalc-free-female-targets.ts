/**
 * 一次性腳本：重算 subscription_tier=free 且 gender=女性 且 calories_target<=1200 的學員目標
 * 執行：npx ts-node -e "require('./scripts/recalc-free-female-targets.ts')"
 * 或：npx tsx scripts/recalc-free-female-targets.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calculateInitialTargets } from '../lib/nutrition-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // 1. 撈所有符合條件的免費女性學員
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, gender, goal_type, calories_target, activity_profile, diet_start_date')
    .eq('subscription_tier', 'free')
    .eq('gender', '女性')
    .lte('calories_target', 1200)

  if (error) {
    console.error('撈資料失敗', error)
    process.exit(1)
  }

  console.log(`找到 ${clients?.length ?? 0} 位學員需要更新`)

  let updated = 0
  let skipped = 0

  for (const client of clients ?? []) {
    // 2. 撈最新體重 + 體脂率
    const { data: bodyRows } = await supabase
      .from('body_composition')
      .select('weight, body_fat, height')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(1)

    const body = bodyRows?.[0]
    if (!body?.weight) {
      console.log(`⚠️  ${client.name} (${client.id}) — 無體重資料，跳過`)
      skipped++
      continue
    }

    // 3. 重算
    const targets = calculateInitialTargets({
      gender: client.gender,
      bodyWeight: body.weight,
      height: body.height ?? null,
      bodyFatPct: body.body_fat ?? null,
      goalType: (client.goal_type || 'cut') as 'cut' | 'bulk' | 'recomp',
      activityProfile: client.activity_profile ?? undefined,
      trainingDaysPerWeek: 3,
    })

    // 4. 更新
    const { error: updateErr } = await supabase
      .from('clients')
      .update({
        calories_target: targets.calories,
        protein_target: targets.protein,
        carbs_target: targets.carbs,
        fat_target: targets.fat,
      })
      .eq('id', client.id)

    if (updateErr) {
      console.error(`❌  ${client.name} 更新失敗`, updateErr)
    } else {
      console.log(`✅  ${client.name} — ${client.calories_target} → ${targets.calories} kcal`)
      updated++
    }
  }

  console.log(`\n完成：更新 ${updated} 人，跳過 ${skipped} 人`)
}

main().catch(console.error)
