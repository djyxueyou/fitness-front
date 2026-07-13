import { describe, expect, it } from 'vitest'
import { adjustRestSeconds, normalizeRestSeconds, restScopePayload } from '@/utils/rest-options'

describe('rest options', () => {
  it('clamps values to the server range', () => {
    expect(normalizeRestSeconds(-5)).toBe(0)
    expect(normalizeRestSeconds(999)).toBe(600)
  })

  it('adjusts in fifteen second steps', () => {
    expect(adjustRestSeconds(60, 1)).toBe(75)
    expect(adjustRestSeconds(5, -1)).toBe(0)
  })

  it('constructs explicit scope payloads', () => {
    expect(restScopePayload(8, 120, 'CURRENT')).toEqual({
      exerciseId: 8,
      restSeconds: 120,
      scope: 'CURRENT'
    })
  })
})
