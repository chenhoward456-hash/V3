/**
 * AI Agent runner with tool use loop.
 *
 * Wraps Anthropic Messages API with the agent-tools schema,
 * handles multi-turn tool_use → tool_result → final answer flow.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_TOOLS, executeAgentTool } from './agent-tools'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是 Howard 教練的 AI 助理，協助管理學員的訓練營養。

# 你的職責
1. 學員或教練 LINE 對話時，根據對話內容判斷是否需要調整 macros
2. 任何提案前，**先呼叫 read_client_state 拿完整 context**
3. 提案前必須查 personal_notes — 學員的歷史失敗、生理反應、偏好絕對不能違反
4. 提案調整時用 propose_macro_adjustment（會送給教練審核，不會直接套用）
5. 學員透露新的失敗經驗 / 偏好 / 限制時，用 add_personal_note 記下

# 重要規則
- **永遠不要直接給數字而不先讀 context**。沒讀 client state 就提案 = 失格。
- **personal_notes weight ≥ 8 的條目視為絕對禁區** — 違反就是傷害學員。
- **每次提案附完整理由**：引用具體數字（體重趨勢、血檢值、合規率）+ 引用 personal_notes 條目 + 解釋為什麼這樣調。
- **保守優先**：寧可分 2-3 次小調整，不要一次大改。單次熱量變動 ≤ 15%。
- **碳水是敏感變量**：對 SHBG 敏感、有低碳失敗史的學員，cut 優先從脂肪 + cardio 取得缺口。
- **不要編造數據**：不知道就說不知道，不要假設。
- **語氣**：直接、不囉嗦、用學員聽得懂的話。教練語氣可以粗（fuck 之類 OK），但對學員要尊重。

# 工具使用順序
標準 flow：
1. read_client_state（必做）
2. 思考：要 propose 嗎？還是只要對話回答？還是需要先 add_personal_note 記下新資訊？
3. 如要提案：propose_macro_adjustment
4. 如有新發現的歷史/偏好：add_personal_note
5. 最後給人類一段中文回應（解釋你做了什麼）

# 邊界
- 你只能 propose，不能 apply。教練 LINE 審核才會生效。
- 違反 macro_bounds（min_calories、min_protein 等）的提案會被 propose_macro_adjustment 自動拒絕。
- 24 小時內同學員只能 propose 一次。

今天日期：${new Date().toISOString().split('T')[0]}`

export interface AgentRunOptions {
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  contextHint?: string  // e.g. "currently talking about 陳胤豪 (id=2b7e3242-d325-4c1c-bf66-c7fd5e56cac4)"
  maxTurns?: number
}

export interface AgentRunResult {
  finalText: string
  toolCalls: Array<{ name: string; input: any; result: any }>
  totalTokens: { input: number; output: number }
  stopReason: string
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const messages: Anthropic.MessageParam[] = []

  for (const msg of opts.conversationHistory ?? []) {
    messages.push({ role: msg.role, content: msg.content })
  }

  const userContent = opts.contextHint
    ? `${opts.contextHint}\n\n---\n\n${opts.userMessage}`
    : opts.userMessage
  messages.push({ role: 'user', content: userContent })

  const toolCalls: AgentRunResult['toolCalls'] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  const maxTurns = opts.maxTurns ?? 6
  let finalText = ''
  let stopReason = 'unknown'

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      // System prompt + tools 用 prompt caching（5 分鐘 TTL）
      // 5 分鐘內重複呼叫只收 10% 的 input cost
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ] as any,
      tools: AGENT_TOOLS as any,
      messages,
    })

    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens
    stopReason = response.stop_reason ?? 'unknown'

    const textBlocks = response.content.filter(b => b.type === 'text') as Array<{ type: 'text'; text: string }>
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Array<{ type: 'tool_use'; id: string; name: string; input: any }>

    if (textBlocks.length > 0) {
      finalText = textBlocks.map(b => b.text).join('\n\n')
    }

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      break
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      const result = await executeAgentTool(tu.name, tu.input)
      toolCalls.push({ name: tu.name, input: tu.input, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return {
    finalText,
    toolCalls,
    totalTokens: { input: totalInputTokens, output: totalOutputTokens },
    stopReason,
  }
}
