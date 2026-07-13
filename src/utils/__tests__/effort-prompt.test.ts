import { describe, expect, it } from 'vitest'
import { shouldPromptForEffort } from '@/utils/effort-prompt'

const base = {
  enabled: true,
  handled: false,
  completedSetType: 'NORMAL' as const,
  remainingIncompleteWorkingSets: 0,
  inSupersetTransition: false
}

describe('effort prompt', () => {
  it('asks after the final working set', () => expect(shouldPromptForEffort(base)).toBe(true))
  it('does not ask twice', () =>
    expect(shouldPromptForEffort({ ...base, handled: true })).toBe(false))
  it('does not ask for warmups or disabled preferences', () => {
    expect(shouldPromptForEffort({ ...base, completedSetType: 'WARMUP' })).toBe(false)
    expect(shouldPromptForEffort({ ...base, enabled: false })).toBe(false)
  })
  it('does not interrupt a superset transition', () => {
    expect(shouldPromptForEffort({ ...base, inSupersetTransition: true })).toBe(false)
  })
})
