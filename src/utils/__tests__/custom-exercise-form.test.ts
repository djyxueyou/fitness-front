import { describe, expect, it } from 'vitest'
import {
  canSubmitCustomExercise,
  initialCustomExerciseCategory,
  initialCustomExerciseEquipment,
  normalizeCustomExerciseCategoryPayload,
  normalizeCustomExerciseOption
} from '@/utils/custom-exercise-form'

describe('custom exercise form', () => {
  it('defaults new bodyweight exercises to bodyweight equipment', () => {
    expect(initialCustomExerciseEquipment('create', 'BODYWEIGHT_REPS')).toBe('BODYWEIGHT')
  })

  it('does not guess equipment for weighted or duration exercises', () => {
    expect(initialCustomExerciseEquipment('create', 'WEIGHT_REPS')).toBe('')
    expect(initialCustomExerciseEquipment('create', 'DURATION')).toBe('')
  })

  it('preserves an existing equipment selection while editing', () => {
    expect(initialCustomExerciseEquipment('edit', 'BODYWEIGHT_REPS', 'DUMBBELL')).toBe('DUMBBELL')
    expect(initialCustomExerciseEquipment('edit', 'BODYWEIGHT_REPS', '')).toBe('')
  })

  it('treats legacy custom category as unclassified while editing', () => {
    expect(initialCustomExerciseCategory('edit', 'custom')).toBe('')
    expect(initialCustomExerciseCategory('edit', 'back')).toBe('back')
  })

  it('allows submit with only a non-empty name', () => {
    expect(canSubmitCustomExercise(' 弹力带肩外旋 ')).toBe(true)
    expect(canSubmitCustomExercise('   ')).toBe(false)
  })

  it('uses the custom category code when an existing category is cleared', () => {
    const options = [{ value: 'back', label: '背部' }]
    expect(normalizeCustomExerciseCategoryPayload('create', '', options)).toEqual({
      code: undefined,
      name: undefined
    })
    expect(normalizeCustomExerciseCategoryPayload('edit', '', options)).toEqual({
      code: 'custom',
      name: '自定义'
    })
  })

  it('maps a selected option to canonical code and name and allows clearing', () => {
    const options = [{ value: 'DUMBBELL', label: '哑铃' }]
    expect(normalizeCustomExerciseOption('DUMBBELL', options)).toEqual({
      code: 'DUMBBELL',
      name: '哑铃'
    })
    expect(normalizeCustomExerciseOption('', options)).toEqual({ code: undefined, name: undefined })
  })
})
