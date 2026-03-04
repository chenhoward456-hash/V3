/**
 * Claude AI 整合模組
 * 使用 Anthropic Claude Haiku 模型提供 AI 智能回覆
 * 適用於健康諮詢、營養建議、訓練指導等場景
 */

import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null

function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  }
  return _anthropic
}

// Howard Protocol 系統提示詞
const SYSTEM_PROMPT = `你是 Howard Protocol 的 AI 健康顧問助手。你的角色是：

1. 根據用戶提供的健康數據，給予專業但易懂的建議
2. 涵蓋範圍：營養規劃、訓練建議、恢復策略、補劑使用
3. 回答以繁體中文為主
4. 保持專業但親切的語氣
5. 如果問題超出你的專業範圍，建議用戶諮詢專業醫師

重要原則：
- 不做醫療診斷
- 建議都需有科學依據
- 回答簡潔實用，避免冗長`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 估算 token 數量（粗略：中文 ~1.5 tokens/字，英文 ~0.4 tokens/char）
 */
function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const otherChars = text.length - cjkChars
  return Math.ceil(cjkChars * 1.5 + otherChars * 0.4)
}

/**
 * 裁剪對話歷史，確保不超過 token 上限
 * 保留最新的訊息，從舊的開始裁剪
 */
function trimMessagesToFit(messages: ChatMessage[], maxTokens: number = 6000): ChatMessage[] {
  let totalTokens = 0
  const result: ChatMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content)
    if (totalTokens + msgTokens > maxTokens && result.length > 0) break
    totalTokens += msgTokens
    result.unshift(messages[i])
  }

  return result
}

export async function askClaude(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const trimmedMessages = trimMessagesToFit(messages, 6000)

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt || SYSTEM_PROMPT,
    messages: trimmedMessages,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock ? textBlock.text : ''
}

/**
 * 根據客戶健康數據生成個人化建議
 */
export async function generateHealthAdvice(
  clientContext: string,
  question: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `以下是學員的健康數據摘要：\n${clientContext}\n\n問題：${question}`,
    },
  ]

  return askClaude(messages)
}
