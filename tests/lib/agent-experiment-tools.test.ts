import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: () => ({ from: () => ({}) }) }))
import { AGENT_TOOLS, ANALYSIS_TOOLS } from '@/lib/agent-tools'
import { EXPERIMENT_METRICS } from '@/lib/body-experiments'

describe('身體實驗 agent 工具', () => {
  it('工具的指標選單＝body_experiments 允許的指標（跟 DB CHECK 同一份）', () => {
    const tool = (AGENT_TOOLS as readonly { name: string; input_schema: unknown }[]).find(t => t.name === 'create_body_experiment')! as any
    const enumList = (tool.input_schema.properties as any).metric.enum as string[]
    expect([...enumList].sort()).toEqual(Object.keys(EXPERIMENT_METRICS).sort())
  })
  it('有唯讀的列表工具', () => {
    expect(ANALYSIS_TOOLS.some(t => t.name === 'list_body_experiments')).toBe(true)
  })
})
