import { describe, expect, it } from 'vitest'
import { pauseRestClock, restRemainingSeconds, resumeRestClock } from '@/utils/rest-timer'

describe('rest timer', () => {
  it('uses its deadline after backgrounding', () => {
    expect(restRemainingSeconds({ endsAtMs: 61_000, remainingWhenPaused: null }, 31_000)).toBe(30)
  })

  it('freezes only for an explicit workout pause', () => {
    const paused = pauseRestClock({ endsAtMs: 61_000, remainingWhenPaused: null }, 31_000)
    expect(paused).toEqual({ endsAtMs: null, remainingWhenPaused: 30 })
    expect(restRemainingSeconds(paused, 50_000)).toBe(30)
    expect(resumeRestClock(paused, 50_000)).toEqual({
      endsAtMs: 80_000,
      remainingWhenPaused: null
    })
  })
})
