/**
 * 缺哪格就只問哪格 —— 搭在學員自己傳來的 LINE 回覆上，零推播額度。
 *
 * ## 為什麼有這支（2026-09-30）
 *
 * 每個人斷掉的地方不一樣：Sean 14 天量了 8 次體重、飲食只記 1 筆；震宣飲食 15 筆、訓練 0 筆。
 * 叫他們「每天全部記好」沒用 —— 記錄成本高過當下回饋（陳胤豪自己都只記最低限度那格）。
 * 要的是：只補最便宜、他最常漏的那一格。
 *
 * ## 為什麼不用推播
 * 2026-09-29 晚 LINE 免費額度（200 則/月）用完，隔天早上的抽血提醒、晨報全部送不出去。
 * 「每天問一句」如果走 push，會直接把額度燒光。reply 不吃額度 —— 所以只在學員
 * **今天第一次**用 LINE 記東西時，在那則回覆後面多問一句。不存狀態、不會一天問好幾次。
 */

export type GapKind = 'weight' | 'nutrition' | 'training' | 'wellness'

export const GAP_META: Record<GapKind, { label: string; unit: string }> = {
  weight: { label: '體重', unit: '天' },
  nutrition: { label: '飲食', unit: '天' },
  training: { label: '訓練', unit: '天' },
  wellness: { label: '身體感受', unit: '天' },
}

export const GAP_WINDOW = 14
/** 引擎真正吃的兩格，優先問 */
const CORE: GapKind[] = ['nutrition', 'weight']
/** 這兩週已經記超過這個比例 → 不算他的漏洞，不問 */
export const GAP_SKIP_RATE = 0.8

export type GapContext = {
  /** 今天各格有沒有記（含剛剛這筆） */
  today: Record<GapKind, boolean>
  /** 近 14 天（不含今天）各格記了幾天 */
  days14: Record<GapKind, number>
  enabled: Record<GapKind, boolean>
}

/**
 * 挑要問哪一格。null＝不問。
 * - 只在今天第一次記錄時問（除了剛記的這格，今天其他格都還沒記）
 * - 候選＝今天沒記、有開、而且近 14 天記不到 80% 的格子；取記得最少的
 * - 訓練本來就不是天天練，門檻用「每週 3 天」當滿分
 * - 體重／飲食有缺就先問（引擎只吃這兩格），沒有才問訓練／身體感受
 */
export function pickGap(ctx: GapContext, justLogged: GapKind): GapKind | null {
  const kinds = Object.keys(GAP_META) as GapKind[]
  const othersToday = kinds.filter(k => k !== justLogged && ctx.today[k])
  if (othersToday.length > 0) return null

  const rate = (k: GapKind) => (k === 'training' ? ctx.days14[k] / 6 : ctx.days14[k] / GAP_WINDOW)
  const candidates = kinds
    .filter(k => k !== justLogged && ctx.enabled[k] && !ctx.today[k] && rate(k) < GAP_SKIP_RATE)
    .sort((a, b) => rate(a) - rate(b))
  // 體重、飲食是引擎調熱量唯一吃的兩格（Sean：飲食 1/14 天，引擎什麼都推不出來）→ 有缺先問這兩格
  return candidates.find(k => CORE.includes(k)) ?? candidates[0] ?? null
}

export type QuickItem = { label: string; text: string }

/** 回覆後面加的那一句＋一點就能記的按鈕 */
export function gapPrompt(kind: GapKind, days: number, lastWeight?: number | null): { text: string; items: QuickItem[] } {
  const m = GAP_META[kind]
  const head = `\n\n順便一格就好：你這兩週${m.label}記了 ${days}/${GAP_WINDOW} ${m.unit}，今天的還沒記 👇`
  switch (kind) {
    case 'wellness':
      return { text: head, items: [
        { label: '😊 好', text: '身心 4 4 4' }, { label: '😐 普通', text: '身心 3 3 3' }, { label: '😩 差', text: '身心 2 2 2' },
      ] }
    case 'weight':
      return { text: head, items: lastWeight
        ? [
          { label: `${(lastWeight - 0.5).toFixed(1)}`, text: `體重 ${(lastWeight - 0.5).toFixed(1)}` },
          { label: `${lastWeight.toFixed(1)}（不變）`, text: `體重 ${lastWeight.toFixed(1)}` },
          { label: `${(lastWeight + 0.5).toFixed(1)}`, text: `體重 ${(lastWeight + 0.5).toFixed(1)}` },
        ]
        : [{ label: '⚖️ 記體重', text: '記體重' }] }
    case 'nutrition':
      return { text: `\n\n順便一格就好：你這兩週飲食記了 ${days}/${GAP_WINDOW} 天。今天吃得有照計畫嗎？👇`, items: [
        { label: '✅ 有達標', text: '達標' }, { label: '❌ 沒達標', text: '未達標' },
      ] }
    case 'training':
      return { text: `\n\n順便一格就好：你這兩週訓練記了 ${days} 次，今天有練的話點一下 👇`, items: [
        { label: '🏋️ 有練，記一下', text: '記訓練' },
      ] }
  }
}

type QueryLike = { from: (t: string) => any }

const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

/** 撈判斷要用的資料：4 張表近 15 天的日期 */
export async function loadGapContext(
  supabase: QueryLike,
  client: { id: string; training_enabled?: boolean | null; wellness_enabled?: boolean | null },
  today: string,
): Promise<{ ctx: GapContext; lastWeight: number | null }> {
  const since = addDays(today, -GAP_WINDOW)
  const [w, n, t, wl] = await Promise.all([
    supabase.from('body_composition').select('date, weight').eq('client_id', client.id).gte('date', since).not('weight', 'is', null),
    supabase.from('nutrition_logs').select('date').eq('client_id', client.id).gte('date', since),
    supabase.from('training_logs').select('date').eq('client_id', client.id).gte('date', since),
    supabase.from('daily_wellness').select('date').eq('client_id', client.id).gte('date', since),
  ])
  const dates = (r: { data: { date: string }[] | null }) => new Set((r.data ?? []).map(x => x.date))
  const sets: Record<GapKind, Set<string>> = { weight: dates(w), nutrition: dates(n), training: dates(t), wellness: dates(wl) }
  const before = (s: Set<string>) => [...s].filter(d => d < today).length
  const weights = ((w.data ?? []) as { date: string; weight: number }[]).sort((a, b) => b.date.localeCompare(a.date))
  return {
    ctx: {
      today: { weight: sets.weight.has(today), nutrition: sets.nutrition.has(today), training: sets.training.has(today), wellness: sets.wellness.has(today) },
      days14: { weight: before(sets.weight), nutrition: before(sets.nutrition), training: before(sets.training), wellness: before(sets.wellness) },
      enabled: { weight: true, nutrition: true, training: client.training_enabled !== false, wellness: client.wellness_enabled !== false },
    },
    lastWeight: weights[0]?.weight != null ? Number(weights[0].weight) : null,
  }
}

/**
 * handler 用：剛記完 justLogged，回傳要附加的文字與 quick reply（沒有就 null）。
 * 任何錯誤都吞掉回 null —— 這一句是加分，不能讓主回覆失敗。
 */
export async function gapAddon(
  supabase: QueryLike,
  client: { id: string; training_enabled?: boolean | null; wellness_enabled?: boolean | null },
  today: string,
  justLogged: GapKind,
): Promise<{ text: string; items: QuickItem[] } | null> {
  try {
    const { ctx, lastWeight } = await loadGapContext(supabase, client, today)
    ctx.today[justLogged] = true
    const kind = pickGap(ctx, justLogged)
    return kind ? gapPrompt(kind, ctx.days14[kind], lastWeight) : null
  } catch {
    return null
  }
}
