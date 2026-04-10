import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DailyNutritionTarget from '@/components/client/DailyNutritionTarget'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DailyNutritionTarget', () => {
  it('renders macro target values', () => {
    render(
      <DailyNutritionTarget
        caloriesTarget={2000}
        proteinTarget={150}
        carbsTarget={200}
        fatTarget={60}
      />
    )

    // Component recalculates calories: protein*4 + carbs*4 + fat*9 = 150*4+200*4+60*9 = 1940
    expect(screen.getByText('1940')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('renders null (nothing) when all targets are null', () => {
    const { container } = render(
      <DailyNutritionTarget
        caloriesTarget={null}
        proteinTarget={null}
        carbsTarget={null}
        fatTarget={null}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders only items with values, omitting null ones', () => {
    render(
      <DailyNutritionTarget
        caloriesTarget={1800}
        proteinTarget={null}
        carbsTarget={null}
        fatTarget={50}
      />
    )

    expect(screen.getByText('1800')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    // Should not render protein or carbs labels when they have no values
    expect(screen.queryByText('150')).not.toBeInTheDocument()
  })

  it('shows carb cycling toggle when enabled', () => {
    render(
      <DailyNutritionTarget
        caloriesTarget={2000}
        proteinTarget={150}
        carbsTarget={200}
        fatTarget={60}
        carbsCyclingEnabled={true}
        isTrainingDay={true}
        carbsTrainingDay={250}
        carbsRestDay={150}
      />
    )

    const toggleBtn = screen.getByRole('button')
    expect(toggleBtn.textContent).toMatch(/訓練日/)
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('toggles between training and rest day carbs', () => {
    render(
      <DailyNutritionTarget
        caloriesTarget={2000}
        proteinTarget={120}
        carbsTarget={200}
        fatTarget={60}
        carbsCyclingEnabled={true}
        isTrainingDay={true}
        carbsTrainingDay={250}
        carbsRestDay={150}
      />
    )

    // Initially training day with 250g carbs
    expect(screen.getByText('250')).toBeInTheDocument()

    // Click the toggle button to switch to rest day
    const toggleBtn = screen.getByRole('button')
    fireEvent.click(toggleBtn)

    // Rest day carbs = 150 (also appears in the cycling summary footer)
    expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1)
    expect(toggleBtn.textContent).toMatch(/休息日/)
  })

  it('renders genetic corrections when provided', () => {
    render(
      <DailyNutritionTarget
        caloriesTarget={2000}
        proteinTarget={150}
        carbsTarget={200}
        fatTarget={60}
        geneticCorrections={[
          { gene: 'FTO', rule: 'fat_sensitivity', adjustment: 'FTO 基因：建議降低脂肪攝取比例' },
        ]}
      />
    )

    expect(screen.getByText('FTO 基因：建議降低脂肪攝取比例')).toBeInTheDocument()
  })
})
