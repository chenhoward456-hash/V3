/**
 * AI Agent tool definitions for Claude tool use
 *
 * Phase 1 scope:
 *   - Single client: 陳胤豪 (ai_agent_enabled = true)
 *   - 3 tools: read_client_state, propose_macro_adjustment, add_personal_note
 *   - All proposals require coach approval before applying
 *
 * Safety architecture:
 *   1. AI proposes (never applies directly)
 *   2. proposal goes through nutrition-engine safety gate
 *   3. proposal goes through macro_bounds check + variation cap
 *   4. proposal written to pending_proposals (status='pending')
 *   5. coach LINE notification with [✓][✗][💬] buttons
 *   6. coach approval → write to macro_adjustment_log + update clients
 */

import { createServiceSupabase } from '@/lib/supabase'
import { computeTrajectoryAdjustment, type MacroBounds } from '@/lib/trajectory-adjust'

const supabase = createServiceSupabase()

// ========== Tool Schemas (for Anthropic Messages API tools param) ==========

export const AGENT_TOOLS = [
  {
    name: 'read_client_state',
    description: '讀取學員當前完整狀態：最近 14 天體重、wellness、訓練、營養紀錄，加上 macros 目標、目標體重/日期、最近血檢、個人筆記（歷史失敗/偏好/限制）。任何提案前都必須先呼叫此工具。',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: '學員 UUID' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'propose_macro_adjustment',
    description: '提議調整學員的 macros 或 cardio 分鐘數。AI 不會直接套用 — 提案會送給教練審核。一次只能 propose 一個方向（cut 或 maintain 或 bulk）。必須附上明確理由。',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        proposed_changes: {
          type: 'object' as const,
          description: '只填要改的欄位，其他不要寫。',
          properties: {
            calories_target: { type: 'number', description: '目標每日總熱量 kcal' },
            protein_target: { type: 'number', description: '蛋白質 g/天' },
            carbs_target: { type: 'number', description: '平均碳水 g/天' },
            fat_target: { type: 'number', description: '脂肪 g/天' },
            carbs_training_day: { type: 'number', description: '訓練日碳水 g' },
            carbs_rest_day: { type: 'number', description: '非訓練日碳水 g' },
            cardio_minutes_per_day: { type: 'number', description: '建議 Zone 2 cardio 分鐘/天' },
          },
        },
        reasoning: {
          type: 'string',
          description: '提案理由。必須引用具體數字 + 引用 personal_notes 內容（如有相關）+ 解釋為什麼這樣調。',
        },
        triggering_context: {
          type: 'string',
          description: '觸發這個提案的對話內容、學員回報、或數據觀察（簡短）',
        },
      },
      required: ['client_id', 'proposed_changes', 'reasoning'],
    },
  },
  {
    name: 'add_personal_note',
    description: '把學員的歷史失敗、生理反應、偏好、限制等寫入個人筆記。AI 在後續提案中會自動讀取這些筆記避免重蹈覆轍。範例：「對 SHBG 敏感」「不吃牛奶」「5/28-6/2 出國」',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        category: {
          type: 'string',
          enum: ['historical_failure', 'preference', 'constraint', 'context', 'goal_change', 'physiological_response'],
        },
        note: { type: 'string', description: '筆記內容（中文，盡量具體含數據）' },
        weight: { type: 'integer', description: '重要性 1-10。10 = 必讀絕不忽略；5 = 中等；1 = 補充參考', minimum: 1, maximum: 10 },
        relevant_until: { type: 'string', description: '限期型筆記的截止日 YYYY-MM-DD。永久型筆記留空' },
      },
      required: ['client_id', 'category', 'note', 'weight'],
    },
  },
] as const

// ========== Tool Implementations ==========

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveClientId(idOrCode: string): Promise<string | null> {
  if (UUID_RE.test(idOrCode)) return idOrCode
  const { data } = await supabase.from('clients').select('id').eq('unique_code', idOrCode).maybeSingle()
  return data?.id ?? null
}

export async function readClientState(clientIdOrCode: string) {
  const clientId = await resolveClientId(clientIdOrCode)
  if (!clientId) return { error: 'client not found' }

  // 成本優化：14d → 7d，只回 essential，labs 只回有意義的（過濾正常值前）
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenStr = sevenDaysAgo.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const [clientRes, bodyRes, wellnessRes, trainingRes, nutritionRes, labRes, notesRes, recentLogsRes] = await Promise.all([
    supabase.from('clients').select('id, name, age, gender, goal_type, target_weight, target_date, competition_date, calories_target, protein_target, carbs_target, fat_target, carbs_training_day, carbs_rest_day, last_auto_adjust_at, gene_mthfr').eq('id', clientId).maybeSingle(),
    supabase.from('body_composition').select('date, weight, body_fat').eq('client_id', clientId).gte('date', sevenStr).order('date', { ascending: false }),
    supabase.from('daily_wellness').select('date, energy_level, training_drive, sleep_quality, mood, period_start').eq('client_id', clientId).gte('date', sevenStr).order('date', { ascending: false }),
    supabase.from('training_logs').select('date, training_type, rpe').eq('client_id', clientId).gte('date', sevenStr).order('date', { ascending: false }),
    supabase.from('nutrition_logs').select('date, calories, protein_grams, carbs_grams, compliant').eq('client_id', clientId).gte('date', sevenStr).order('date', { ascending: false }),
    // labs：只取最近 3 個月 + 含基本荷爾蒙/代謝
    supabase.from('lab_results').select('test_name, value, unit, date').eq('client_id', clientId).order('date', { ascending: false }).limit(15),
    // personal_notes：只取 weight ≥ 7 的（重要的）+ 還在有效期內
    supabase.from('personal_notes').select('category, note, weight').eq('client_id', clientId).gte('weight', 7).or('relevant_until.is.null,relevant_until.gte.' + today).order('weight', { ascending: false }).limit(8),
    // macro_adjustment_log：只回最近 2 筆 + 簡化欄位
    supabase.from('macro_adjustment_log').select('applied_at, reason').eq('client_id', clientId).order('applied_at', { ascending: false }).limit(2),
  ])

  // 月經週期推算（女性學員，從近 60 天 wellness 找最後一次 period_start）
  let cycleInfo: any = null
  if (clientRes.data?.gender === '女性') {
    const { data: lastPeriod } = await supabase
      .from('daily_wellness')
      .select('date')
      .eq('client_id', clientId)
      .eq('period_start', true)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastPeriod?.date) {
      const daysSince = Math.floor((Date.now() - new Date(lastPeriod.date).getTime()) / 86_400_000)
      const cycleDay = (daysSince % 28) + 1
      cycleInfo = {
        last_period_start_date: lastPeriod.date,
        days_since_last_period: daysSince,
        estimated_cycle_day: cycleDay,
        estimated_phase:
          cycleDay <= 5 ? '月經期'
          : cycleDay <= 13 ? '濾泡期'
          : cycleDay <= 16 ? '排卵期'
          : '黃體期',
        in_luteal_phase: cycleDay > 16,
        red_s_warning: daysSince > 45 ? `⚠️ ${daysSince} 天未來潮，可能是 RED-S 早期信號（>45d）` : null,
      }
    } else {
      cycleInfo = { red_s_warning: '⚠️ 尚無經期紀錄，無法判斷週期' }
    }
  }

  return {
    client: clientRes.data,
    body_7d: bodyRes.data ?? [],
    wellness_7d: wellnessRes.data ?? [],
    training_7d: trainingRes.data ?? [],
    nutrition_7d: nutritionRes.data ?? [],
    recent_labs: labRes.data ?? [],
    personal_notes_important: notesRes.data ?? [],
    last_2_adjustments: recentLogsRes.data ?? [],
    menstrual_cycle: cycleInfo,
    _note: '若需更詳細的歷史資料（>7 天），告知我再特別查',
  }
}

export interface ProposedChanges {
  calories_target?: number
  protein_target?: number
  carbs_target?: number
  fat_target?: number
  carbs_training_day?: number
  carbs_rest_day?: number
  cardio_minutes_per_day?: number
}

export interface SafetyCheckResult {
  passed: boolean
  violations: string[]
  warnings: string[]
  deltas: Record<string, { from: number | null; to: number; pct: number }>
}

const DEFAULT_BOUNDS: Required<MacroBounds> = {
  min_calories: 1500,
  min_protein_per_kg: 1.8,
  max_loss_per_week: 1.0,
  min_loss_per_week: 0.3,
}

const VARIATION_CAPS = {
  calories: 0.15,
  carbs: 0.25,
  fat: 0.30,
  protein: 0.15,
  carbs_training: 0.25,
  carbs_rest: 0.30,
}

function safetyCheck(current: any, proposed: ProposedChanges, bounds: MacroBounds | null, bodyWeight: number, gender: string | null): SafetyCheckResult {
  const violations: string[] = []
  const warnings: string[] = []
  const deltas: SafetyCheckResult['deltas'] = {}

  const effective = {
    min_calories: bounds?.min_calories ?? (gender === '女性' ? 1200 : DEFAULT_BOUNDS.min_calories!),
    min_protein_per_kg: bounds?.min_protein_per_kg ?? DEFAULT_BOUNDS.min_protein_per_kg!,
    max_loss_per_week: bounds?.max_loss_per_week ?? Math.max(0.5, bodyWeight * 0.01),
    min_loss_per_week: bounds?.min_loss_per_week ?? DEFAULT_BOUNDS.min_loss_per_week!,
  }

  const checkDelta = (key: string, oldVal: number | null, newVal: number | undefined, cap: number) => {
    if (newVal === undefined) return
    const old = oldVal ?? 0
    const pct = old > 0 ? Math.abs(newVal - old) / old : 1
    deltas[key] = { from: oldVal, to: newVal, pct: Math.round(pct * 100) / 100 }
    if (pct > cap) violations.push(`${key} 變動 ${(pct * 100).toFixed(0)}% > 單次上限 ${(cap * 100).toFixed(0)}%`)
  }

  checkDelta('calories_target', current.calories_target, proposed.calories_target, VARIATION_CAPS.calories)
  checkDelta('carbs_target', current.carbs_target, proposed.carbs_target, VARIATION_CAPS.carbs)
  checkDelta('fat_target', current.fat_target, proposed.fat_target, VARIATION_CAPS.fat)
  checkDelta('protein_target', current.protein_target, proposed.protein_target, VARIATION_CAPS.protein)
  checkDelta('carbs_training_day', current.carbs_training_day, proposed.carbs_training_day, VARIATION_CAPS.carbs_training)
  checkDelta('carbs_rest_day', current.carbs_rest_day, proposed.carbs_rest_day, VARIATION_CAPS.carbs_rest)

  if (proposed.calories_target != null && proposed.calories_target < effective.min_calories) {
    violations.push(`熱量 ${proposed.calories_target} < min_calories ${effective.min_calories}`)
  }
  const proposedProtein = proposed.protein_target ?? current.protein_target ?? 0
  if (proposedProtein < effective.min_protein_per_kg * bodyWeight) {
    violations.push(`蛋白質 ${proposedProtein}g < ${effective.min_protein_per_kg} g/kg × ${bodyWeight} kg = ${Math.round(effective.min_protein_per_kg * bodyWeight)}g 下限`)
  }

  const proposedFat = proposed.fat_target ?? current.fat_target ?? 0
  if (proposedFat > 0 && proposedFat < 0.5 * bodyWeight) {
    warnings.push(`脂肪 ${proposedFat}g < 0.5 g/kg = ${Math.round(0.5 * bodyWeight)}g（T 合成警戒）`)
  }
  if (proposed.carbs_target != null && proposed.carbs_target < 50) {
    violations.push(`碳水 ${proposed.carbs_target}g < 50g 醫學下限`)
  }
  if (proposed.carbs_training_day != null && proposed.carbs_training_day < 100) {
    warnings.push(`訓練日碳水 ${proposed.carbs_training_day}g < 100g（重訓表現警戒）`)
  }
  if (proposed.cardio_minutes_per_day != null && proposed.cardio_minutes_per_day > 90) {
    warnings.push(`每日 cardio ${proposed.cardio_minutes_per_day} min > 90 min（過度訓練警戒）`)
  }

  return { passed: violations.length === 0, violations, warnings, deltas }
}

export async function proposeMacroAdjustment(input: {
  client_id: string
  proposed_changes: ProposedChanges
  reasoning: string
  triggering_context?: string
}) {
  const clientId = await resolveClientId(input.client_id)
  if (!clientId) return { error: 'client not found' }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ai_agent_enabled, gender, calories_target, protein_target, carbs_target, fat_target, carbs_training_day, carbs_rest_day, macro_bounds')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) return { error: 'client not found' }
  if (!client.ai_agent_enabled) return { error: 'AI Agent 未啟用此學員（ai_agent_enabled=false）' }

  const { data: latestBody } = await supabase
    .from('body_composition')
    .select('weight')
    .eq('client_id', clientId)
    .not('weight', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const bodyWeight = latestBody?.weight ? Number(latestBody.weight) : 70

  const current = {
    calories_target: client.calories_target ? Number(client.calories_target) : null,
    protein_target: client.protein_target ? Number(client.protein_target) : null,
    carbs_target: client.carbs_target ? Number(client.carbs_target) : null,
    fat_target: client.fat_target ? Number(client.fat_target) : null,
    carbs_training_day: client.carbs_training_day ? Number(client.carbs_training_day) : null,
    carbs_rest_day: client.carbs_rest_day ? Number(client.carbs_rest_day) : null,
  }

  const safety = safetyCheck(current, input.proposed_changes, client.macro_bounds as MacroBounds | null, bodyWeight, client.gender)

  // 24 小時內已有 pending → 拒絕重複提案
  const { data: existing } = await supabase
    .from('pending_proposals')
    .select('id, proposed_at')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .gte('proposed_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(1)
    .maybeSingle()
  if (existing) {
    return { error: `已有 pending proposal (${existing.id})，請先處理或等過期。` }
  }

  // 違反硬性 bounds → 拒絕（連寫入都不寫）
  if (!safety.passed) {
    return {
      error: '提案違反安全 bounds，已拒絕。請調整後重試。',
      violations: safety.violations,
      warnings: safety.warnings,
    }
  }

  const { data: proposal, error: insertErr } = await supabase
    .from('pending_proposals')
    .insert({
      client_id: clientId,
      proposed_by: 'ai_agent',
      proposal_type: 'macro_adjustment',
      current_state: current,
      proposed_changes: input.proposed_changes,
      reasoning: input.reasoning,
      triggering_context: input.triggering_context ? { text: input.triggering_context } : null,
      safety_check_result: safety as any,
    })
    .select()
    .single()

  if (insertErr) return { error: 'DB 寫入失敗: ' + insertErr.message }

  return {
    success: true,
    proposal_id: proposal.id,
    safety,
    message: `提案已建立（id=${proposal.id}），等教練審核。24 小時內未審會自動 expired。`,
  }
}

export async function addPersonalNote(input: {
  client_id: string
  category: 'historical_failure' | 'preference' | 'constraint' | 'context' | 'goal_change' | 'physiological_response'
  note: string
  weight: number
  relevant_until?: string
}) {
  const clientId = await resolveClientId(input.client_id)
  if (!clientId) return { error: 'client not found' }

  // AI 寫筆記改成「提案」而非直接寫入，等教練核准
  // 避免 AI 把假設性對話誤判為真實事實
  const { data: proposal, error } = await supabase
    .from('pending_proposals')
    .insert({
      client_id: clientId,
      proposed_by: 'ai_agent',
      proposal_type: 'personal_note',
      current_state: {},
      proposed_changes: {
        category: input.category,
        note: input.note,
        weight: input.weight,
        relevant_until: input.relevant_until ?? null,
      },
      reasoning: `AI 想記錄一筆「${input.category}」個人筆記（weight=${input.weight}）`,
      safety_check_result: null,
    })
    .select()
    .single()

  if (error) return { error: 'DB 寫入失敗: ' + error.message }
  return {
    success: true,
    proposal_id: proposal.id,
    message: '已建立筆記提案，等教練審核後才會寫入永久記憶。',
  }
}

// ========== Tool dispatcher ==========

export async function executeAgentTool(name: string, input: any) {
  switch (name) {
    case 'read_client_state':
      return await readClientState(input.client_id)
    case 'propose_macro_adjustment':
      return await proposeMacroAdjustment(input)
    case 'add_personal_note':
      return await addPersonalNote(input)
    default:
      return { error: `unknown tool: ${name}` }
  }
}
