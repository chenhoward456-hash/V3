import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { isMedicallyCompliant } from '@/lib/compliance-scrub'

// 稽核 P-10：學員看得到的 FAQ 不可對特定病症給處方劑量
describe('health/learn FAQ — Omega-3 條目', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/c/[clientId]/health/learn/page.tsx'), 'utf8')
  const m = src.match(/q: 'Omega-3[^']*',\s*(?:\/\/[^\n]*\n\s*)*a: '([^']*)'/)
  const answer = m?.[1] ?? ''

  it('found the answer text', () => {
    expect(answer.length).toBeGreaterThan(20)
  })
  it('does not pair a condition with a prescription dose', () => {
    expect(answer).not.toMatch(/高三酸甘油酯/)
    expect(answer).not.toMatch(/處方/)
    expect(answer).not.toMatch(/4\s*g\/日/)
  })
  it('passes the medical compliance scan', () => {
    expect(isMedicallyCompliant(answer)).toBe(true)
  })
})
