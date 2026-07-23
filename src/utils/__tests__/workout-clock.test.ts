import { describe, expect, it } from 'vitest'
import {
  includeSuspendedWorkoutClock,
  effectiveElapsedSeconds,
  pauseWorkoutClock,
  resumeWorkoutClock,
  restoreSuspendedWorkoutClock,
  suspendWorkoutClock
} from '@/utils/workout-clock'

describe('workout clock', () => {
  it('uses wall time so background time still counts', () => {
    expect(
      effectiveElapsedSeconds(
        { startedAtMs: 1_000, pausedAtMs: null, accumulatedPausedSeconds: 0 },
        31_999
      )
    ).toBe(30)
  })

  it('excludes explicit pause time', () => {
    const paused = pauseWorkoutClock(
      { startedAtMs: 1_000, pausedAtMs: null, accumulatedPausedSeconds: 0 },
      11_000
    )
    expect(effectiveElapsedSeconds(paused, 31_000)).toBe(10)
    const resumed = resumeWorkoutClock(paused, 31_000)
    expect(effectiveElapsedSeconds(resumed, 41_000)).toBe(20)
    expect(resumed.accumulatedPausedSeconds).toBe(20)
  })

  it('keeps pause and resume idempotent', () => {
    const initial = { startedAtMs: 0, pausedAtMs: null, accumulatedPausedSeconds: 0 }
    const paused = pauseWorkoutClock(initial, 10_000)
    expect(pauseWorkoutClock(paused, 20_000)).toEqual(paused)
    const resumed = resumeWorkoutClock(paused, 20_000)
    expect(resumeWorkoutClock(resumed, 30_000)).toEqual(resumed)
  })

  it('freezes a saved draft without counting the draft gap as pause time', () => {
    const suspended = suspendWorkoutClock(
      {
        startedAtMs: 1_000,
        pausedAtMs: null,
        accumulatedPausedSeconds: 0,
        suspendedAtMs: null,
        accumulatedSuspendedSeconds: 0
      },
      11_000
    )

    expect(effectiveElapsedSeconds(suspended, 31_000)).toBe(10)

    const restored = restoreSuspendedWorkoutClock(suspended, 31_000)
    expect(restored.accumulatedPausedSeconds).toBe(0)
    expect(restored.accumulatedSuspendedSeconds).toBe(20)
    expect(effectiveElapsedSeconds(restored, 41_000)).toBe(20)
  })

  it('can include a cold-start gap when the user confirms it was training time', () => {
    const suspended = suspendWorkoutClock(
      {
        startedAtMs: 1_000,
        pausedAtMs: null,
        accumulatedPausedSeconds: 0,
        suspendedAtMs: null,
        accumulatedSuspendedSeconds: 0
      },
      11_000
    )

    const included = includeSuspendedWorkoutClock(suspended)

    expect(included.suspendedAtMs).toBeNull()
    expect(included.accumulatedSuspendedSeconds).toBe(0)
    expect(effectiveElapsedSeconds(included, 31_000)).toBe(30)
  })
})
