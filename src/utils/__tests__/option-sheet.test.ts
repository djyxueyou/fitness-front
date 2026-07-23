import { describe, expect, it } from 'vitest'
import { isOptionSelected } from '@/utils/option-sheet'

describe('option sheet selection', () => {
  it('matches selected values exactly including the empty option', () => {
    expect(isOptionSelected('back', 'back')).toBe(true)
    expect(isOptionSelected('back', 'chest')).toBe(false)
    expect(isOptionSelected('', '')).toBe(true)
  })
})
