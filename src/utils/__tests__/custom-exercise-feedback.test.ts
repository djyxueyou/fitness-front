import { describe, expect, it } from 'vitest'
import {
  mergeCustomExerciseSelection,
  upsertCustomExercise
} from '@/utils/custom-exercise-feedback'

describe('custom exercise feedback', () => {
  const first = { id: 1, name: '深蹲' }
  const created = { id: 2, name: '弹力带肩外旋' }

  it('prepends a newly created exercise without duplicates', () => {
    expect(upsertCustomExercise([first], created, true)).toEqual([created, first])
    expect(upsertCustomExercise([created, first], { ...created, name: '新名称' }, true)).toEqual([
      { id: 2, name: '新名称' },
      first
    ])
  })

  it('replaces an edited exercise in place', () => {
    expect(upsertCustomExercise([first, created], { ...created, name: '已编辑' }, false)).toEqual([
      first,
      { id: 2, name: '已编辑' }
    ])
  })

  it('keeps a created exercise selected and updates selected metadata by id', () => {
    expect(mergeCustomExerciseSelection([], created)).toEqual([created])
    expect(
      mergeCustomExerciseSelection([created, first], { ...created, name: '服务端名称' })
    ).toEqual([{ id: 2, name: '服务端名称' }, first])
  })
})
