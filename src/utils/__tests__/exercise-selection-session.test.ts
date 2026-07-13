import { describe, expect, it } from 'vitest'
import {
  mergePendingExercises,
  selectionSessionExpired,
  setPendingExerciseSelection
} from '@/utils/exercise-selection-session'

describe('exercise selection session', () => {
  it('preserves order and removes duplicate returned exercises', () => {
    expect(mergePendingExercises([{ id: 1 }], [{ id: 2 }, { id: 1 }])).toEqual([
      { id: 1 },
      { id: 2 }
    ])
  })

  it('expires stale sessions', () => {
    expect(selectionSessionExpired({ updatedAtMs: 1_000 }, 31 * 60_000)).toBe(true)
    expect(selectionSessionExpired({ updatedAtMs: 1_000 }, 10_000)).toBe(false)
  })

  it('sets detail selection explicitly instead of toggling an existing selection', () => {
    const selected = [{ id: 1, name: '深蹲' }]

    expect(setPendingExerciseSelection(selected, { id: 1, name: '深蹲' }, true)).toEqual(selected)
    expect(setPendingExerciseSelection(selected, { id: 1, name: '深蹲' }, false)).toEqual([])
    expect(setPendingExerciseSelection(selected, { id: 2, name: '卧推' }, true)).toEqual([
      { id: 1, name: '深蹲' },
      { id: 2, name: '卧推' }
    ])
  })
})
