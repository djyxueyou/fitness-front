import { describe, expect, it } from 'vitest'
import { pickerCopy, orderedUniqueExercises } from '@/utils/exercise-picker-context'

describe('exercise picker context', () => {
  it('uses context-specific existing and confirm labels', () => {
    expect(pickerCopy('WORKOUT', 2)).toMatchObject({
      existing: '已在训练',
      confirm: '添加到训练（2）'
    })
    expect(pickerCopy('TEMPLATE', 1)).toMatchObject({
      existing: '已在模板',
      confirm: '添加到模板（1）'
    })
    expect(pickerCopy('REPLACE', 0).confirm).toBe('确认替换')
  })

  it('keeps selection order while removing duplicates', () => {
    expect(orderedUniqueExercises([{ id: 2 }, { id: 1 }, { id: 2 }])).toEqual([
      { id: 2 },
      { id: 1 }
    ])
  })
})
