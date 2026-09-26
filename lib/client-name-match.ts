/**
 * 用名字找學員（Howard 助手的 client_brief / client_diagnosis 用）。
 * 先照字比對（ilike 包含）；對不到再用「念起來一樣」找一次 —— 語音輸入、打字選錯同音字很常見：
 * 2026-08-29 問「震軒狀況如何」回找不到，V3 裡是「震宣」。
 * 同音／暱稱只在「字面完全對不到」時才啟用，而且要剛好一人，避免亂猜到別人身上。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { pinyin } from 'pinyin-pro'

const toSound = (s: string) => pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').toLowerCase().replace(/\s+/g, '')

export type NameMatch<T> =
  | { kind: 'none' }
  | { kind: 'many'; candidates: string[] }
  | { kind: 'one'; client: T; bySound: boolean }

export async function findClientByName<T extends { id: string; name: string }>(
  supabase: SupabaseClient,
  name: string,
  select: string,
): Promise<NameMatch<T>> {
  const { data: exact } = await supabase.from('clients').select(select).ilike('name', `%${name}%`).limit(5)
  const rows = (exact ?? []) as unknown as T[]
  if (rows.length > 1) return { kind: 'many', candidates: rows.map(r => r.name) }
  if (rows.length === 1) return { kind: 'one', client: rows[0], bySound: false }

  // 暱稱：「哲哥」→ 哲、「小宣」→ 宣（2026-06-30 問「哲哥最近怎麼樣」找不到萬哲鴻）
  const core = name.replace(/^(小|阿)/, '').replace(/(哥|姐|姊|弟|妹|仔)$/, '')
  if (core && core !== name) {
    const { data: nick } = await supabase.from('clients').select(select).ilike('name', `%${core}%`).limit(5)
    const nrows = (nick ?? []) as unknown as T[]
    if (nrows.length === 1) return { kind: 'one', client: nrows[0], bySound: true }
    if (nrows.length > 1) return { kind: 'many', candidates: nrows.map(r => r.name) }
  }

  const q = toSound(core || name)
  if (q.length < 2) return { kind: 'none' }
  const { data: all } = await supabase.from('clients').select('id, name')
  const hits = ((all ?? []) as { id: string; name: string }[]).filter(c => c.name && toSound(c.name).includes(q))
  if (hits.length > 1) return { kind: 'many', candidates: hits.map(h => h.name) }
  if (hits.length === 0) return { kind: 'none' }
  const { data: one } = await supabase.from('clients').select(select).eq('id', hits[0].id).maybeSingle()
  return one ? { kind: 'one', client: one as unknown as T, bySound: true } : { kind: 'none' }
}
