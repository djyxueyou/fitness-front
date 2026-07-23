import { describe, expect, it } from 'vitest'
import { systemPlanDifficultyText, systemPlanGoalText } from '@/utils/system-plan-metadata'

describe('system plan metadata presentation', () => {
  it('maps backend hypertrophy codes to a Chinese label', () => {
    expect(systemPlanGoalText('HYPERTROPHY')).toBe('增肌')
    expect(systemPlanGoalText('MUSCLE_GAIN')).toBe('增肌')
  })

  it('does not expose an unknown backend code to users', () => {
    expect(systemPlanGoalText('FUTURE_GOAL')).toBe('综合训练')
    expect(systemPlanDifficultyText('FUTURE_LEVEL')).toBe('通用')
  })
})
