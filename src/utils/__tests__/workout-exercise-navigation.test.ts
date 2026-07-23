import { describe, expect, it } from 'vitest'
import { findNextIncompleteExerciseIndex } from '@/utils/workout-exercise-navigation'

describe('workout exercise navigation', () => {
  it('wraps from the last exercise to the first incomplete exercise', () => {
    expect(findNextIncompleteExerciseIndex([false, false, true], 2)).toBe(0)
  })

  it('returns the next incomplete exercise after the current one', () => {
    expect(findNextIncompleteExerciseIndex([false, true, false], 0)).toBe(2)
  })

  it('returns null when every exercise is completed', () => {
    expect(findNextIncompleteExerciseIndex([true, true, true], 2)).toBeNull()
  })
})
