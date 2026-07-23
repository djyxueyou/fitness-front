import { describe, expect, it } from 'vitest'
import { validateProfileField } from '../profile-editing'

describe('profile field validation', () => {
  it('normalizes a valid nickname', () => {
    expect(validateProfileField('nickname', '  木木健身  ')).toEqual({ value: '木木健身' })
  })

  it('rejects invalid nickname lengths', () => {
    expect(validateProfileField('nickname', '木')).toEqual({ error: '昵称至少 2 个字符' })
    expect(validateProfileField('nickname', '木'.repeat(21))).toEqual({
      error: '昵称不能超过 20 个字符'
    })
  })

  it('supports an optional height and validates its range', () => {
    expect(validateProfileField('height', '')).toEqual({ value: null })
    expect(validateProfileField('height', '178')).toEqual({ value: 178 })
    expect(validateProfileField('height', '79')).toEqual({ error: '身高需在 80-250 之间' })
  })
})
