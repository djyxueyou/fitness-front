import { describe, expect, it } from 'vitest'
import { workoutHeaderActions } from '@/utils/workout-header-actions'

describe('workout header actions', () => {
  it('keeps pause available and disables finish while submitting', () => {
    expect(workoutHeaderActions(true, false)).toEqual({
      minimizeLabel: '最小化训练',
      exitLabel: '退出训练',
      pauseLabel: '暂停',
      finishLabel: '保存中',
      finishDisabled: true
    })
  })

  it('changes the pause action to resume without changing navigation actions', () => {
    expect(workoutHeaderActions(false, true)).toEqual({
      minimizeLabel: '最小化训练',
      exitLabel: '退出训练',
      pauseLabel: '继续',
      finishLabel: '完成训练',
      finishDisabled: false
    })
  })
})
