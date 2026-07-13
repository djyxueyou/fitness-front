import { describe, expect, it } from 'vitest'
import { planExerciseThumbnail } from '@/utils/plan-exercise-thumbnail'

describe('plan exercise thumbnail', () => {
  it('preserves the backend-resolved thumbnail and record type', () => {
    expect(
      planExerciseThumbnail({
        recordType: 'WEIGHT_REPS',
        thumbnailUrl: 'https://assets.example.com/media/exercises/bench.jpg'
      })
    ).toEqual({
      recordType: 'WEIGHT_REPS',
      thumbnailUrl: 'https://assets.example.com/media/exercises/bench.jpg'
    })
  })

  it('leaves the url undefined so ExerciseThumbnail can use its fallback', () => {
    expect(planExerciseThumbnail({ recordType: 'DURATION' })).toEqual({
      recordType: 'DURATION',
      thumbnailUrl: undefined
    })
  })
})
