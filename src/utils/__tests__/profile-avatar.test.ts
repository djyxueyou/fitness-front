import { describe, expect, it, vi } from 'vitest'
import { cleanupAvatarTempFiles, isAvatarSelectionCancelled } from '../profile-avatar'

describe('profile avatar helpers', () => {
  it('recognizes the mini program choose-image cancellation object', () => {
    expect(isAvatarSelectionCancelled({ errMsg: 'chooseImage:fail cancel' })).toBe(true)
    expect(isAvatarSelectionCancelled(new Error('chooseImage:fail cancel'))).toBe(true)
  })

  it('does not hide real avatar failures', () => {
    expect(isAvatarSelectionCancelled({ errMsg: 'chooseImage:fail permission denied' })).toBe(false)
    expect(isAvatarSelectionCancelled(new Error('upload timeout'))).toBe(false)
  })

  it('deduplicates paths and never rejects when cleanup fails', async () => {
    const remove = vi
      .fn<(path: string) => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('already gone'))

    await expect(
      cleanupAvatarTempFiles(['wxfile://a.jpg', 'wxfile://a.jpg', '', 'wxfile://b.jpg'], remove)
    ).resolves.toBeUndefined()
    expect(remove.mock.calls).toEqual([['wxfile://a.jpg'], ['wxfile://b.jpg']])
  })
})
