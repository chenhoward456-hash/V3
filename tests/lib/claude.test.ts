import { describe, it, expect } from 'vitest'

// Test the token estimation and trimming logic directly
// We'll re-implement the private functions for testing since they're not exported

function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const otherChars = text.length - cjkChars
  return Math.ceil(cjkChars * 1.5 + otherChars * 0.4)
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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

describe('estimateTokens', () => {
  it('should estimate Chinese text tokens', () => {
    const text = '你好世界'
    const tokens = estimateTokens(text)
    expect(tokens).toBe(Math.ceil(4 * 1.5)) // 6
  })

  it('should estimate English text tokens', () => {
    const text = 'hello world'
    const tokens = estimateTokens(text)
    expect(tokens).toBe(Math.ceil(11 * 0.4)) // 5
  })

  it('should handle mixed content', () => {
    const text = '你好 hello'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('trimMessagesToFit', () => {
  it('should keep all messages if under limit', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]
    const result = trimMessagesToFit(messages, 1000)
    expect(result).toHaveLength(2)
  })

  it('should trim old messages when over limit', () => {
    const longContent = '你好世界'.repeat(500)
    const messages: ChatMessage[] = [
      { role: 'user', content: longContent },
      { role: 'assistant', content: longContent },
      { role: 'user', content: '最新的問題' },
    ]
    const result = trimMessagesToFit(messages, 100)
    // Should at least keep the latest message
    expect(result.length).toBeLessThan(messages.length)
    expect(result[result.length - 1].content).toBe('最新的問題')
  })

  it('should always keep at least one message', () => {
    const longContent = '很長的內容'.repeat(1000)
    const messages: ChatMessage[] = [
      { role: 'user', content: longContent },
    ]
    const result = trimMessagesToFit(messages, 10)
    expect(result).toHaveLength(1)
  })
})
