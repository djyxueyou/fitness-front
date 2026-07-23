import { describe, expect, it, vi } from 'vitest'
import { runSystemPlanActivation } from '@/utils/system-plan-activation'

describe('system plan activation replacement flow', () => {
  it('shows confirmation for 40910 and retries with replacement enabled', async () => {
    const activate = vi
      .fn<(replaceCurrent: boolean) => Promise<unknown>>()
      .mockRejectedValueOnce({ name: 'ApiError', code: 40910 })
      .mockResolvedValueOnce({ executionId: 2 })
    const confirmReplacement = vi.fn().mockResolvedValue(true)

    await expect(runSystemPlanActivation(activate, confirmReplacement)).resolves.toBe(true)
    expect(confirmReplacement).toHaveBeenCalledOnce()
    expect(activate.mock.calls).toEqual([[false], [true]])
  })

  it('does not retry when the user keeps the current plan', async () => {
    const activate = vi.fn().mockRejectedValueOnce({ code: '40910' })
    const confirmReplacement = vi.fn().mockResolvedValue(false)

    await expect(runSystemPlanActivation(activate, confirmReplacement)).resolves.toBe(false)
    expect(activate).toHaveBeenCalledOnce()
  })

  it('keeps unrelated activation failures on the normal error path', async () => {
    const failure = { code: 50000 }
    const activate = vi.fn().mockRejectedValueOnce(failure)
    const confirmReplacement = vi.fn()

    await expect(runSystemPlanActivation(activate, confirmReplacement)).rejects.toBe(failure)
    expect(confirmReplacement).not.toHaveBeenCalled()
  })
})
