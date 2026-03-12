import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FaqAccordion from '@/components/FaqAccordion'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FaqAccordion', () => {
  it('renders all FAQ questions', () => {
    render(<FaqAccordion />)

    expect(screen.getByText(/這跟一般的飲食 App 有什麼不同/)).toBeInTheDocument()
    expect(screen.getByText(/我不會計算熱量/)).toBeInTheDocument()
    expect(screen.getByText(/要綁約嗎/)).toBeInTheDocument()
    expect(screen.getByText(/免費版可以用多久/)).toBeInTheDocument()
    expect(screen.getByText(/需要什麼設備/)).toBeInTheDocument()
  })

  it('all answers are collapsed by default', () => {
    render(<FaqAccordion />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  it('opens an answer when its question is clicked', () => {
    render(<FaqAccordion />)

    const firstQuestion = screen.getAllByRole('button')[0]
    fireEvent.click(firstQuestion)

    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    // Answer content is visible
    expect(screen.getByText(/智能引擎會根據你的真實體重趨勢/)).toBeInTheDocument()
  })

  it('only one answer is open at a time (accordion behavior)', () => {
    render(<FaqAccordion />)

    const buttons = screen.getAllByRole('button')

    // Open the first question
    fireEvent.click(buttons[0])
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true')

    // Open the second question
    fireEvent.click(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true')
    // First should now be closed
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes an open answer when clicked again', () => {
    render(<FaqAccordion />)

    const firstQuestion = screen.getAllByRole('button')[0]

    fireEvent.click(firstQuestion)
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(firstQuestion)
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })

  it('has correct aria-controls attributes linking questions to answers', () => {
    render(<FaqAccordion />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button, index) => {
      expect(button).toHaveAttribute('aria-controls', `faq-answer-${index}`)
    })
  })
})
