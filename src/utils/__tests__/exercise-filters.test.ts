import { describe, expect, it } from 'vitest'
import {
  activeFilterChips,
  countAdvancedFilters,
  emptyExerciseFilters,
  toExerciseQuery
} from '@/utils/exercise-filters'

describe('exercise filters', () => {
  it('counts only advanced filters', () => {
    expect(
      countAdvancedFilters({
        ...emptyExerciseFilters(),
        equipmentCode: 'DUMBBELL',
        recordType: 'WEIGHT_REPS'
      })
    ).toBe(2)
  })

  it('builds removable chips from metadata', () => {
    expect(
      activeFilterChips(
        { ...emptyExerciseFilters(), equipmentCode: 'DUMBBELL', difficultyCode: 'BEGINNER' },
        {
          equipment: [{ label: '哑铃', value: 'DUMBBELL' }],
          difficulty: [{ label: '初级', value: 'BEGINNER' }],
          recordTypes: []
        }
      )
    ).toEqual([
      { key: 'equipmentCode', label: '哑铃' },
      { key: 'difficultyCode', label: '初级' }
    ])
  })

  it('maps non-empty filters to the exercise query', () => {
    expect(
      toExerciseQuery({ ...emptyExerciseFilters(), categoryCode: 'back', equipmentCode: 'BARBELL' })
    ).toEqual({
      categoryCode: 'back',
      equipmentCode: 'BARBELL'
    })
  })
})
