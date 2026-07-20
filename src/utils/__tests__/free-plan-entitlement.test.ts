// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import { showPlanWriteError } from '@/utils/plan-write-feedback'

const feedbackMocks = vi.hoisted(() => ({
  openPrompt: vi.fn(
    (
      _featureName: string,
      _customDescription?: string,
      _entryPoint?: string,
      _options?: { secondaryActionText?: string; onSecondary?: () => void }
    ) => Promise.resolve(false)
  ),
  requestPlanTab: vi.fn(),
  showToast: vi.fn(),
  switchTab: vi.fn()
}))

vi.mock('@/stores/membership-prompt', () => ({
  useMembershipPromptStore: () => ({ open: feedbackMocks.openPrompt })
}))

vi.mock('@/stores/training-hub', () => ({
  useTrainingHubStore: () => ({ requestPlanTab: feedbackMocks.requestPlanTab })
}))

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('free plan entitlement contract', () => {
  it('lets the backend decide the free slot and explains the quota', () => {
    expect(readSource('src/utils/membership-guard.ts')).toContain(
      "featureName.includes('自定义训练计划')"
    )
    expect(readSource('src/pages/plan/create.vue')).toContain('showPlanWriteError')
    const promptSource = readSource('src/stores/membership-prompt.ts')
    expect(promptSource).toContain('secondaryActionText')
    expect(promptSource).toContain('if (!customDescription) description.value = value.description')
    expect(readSource('src/stores/training-hub.ts')).toContain('requestPlanTab')
    expect(readSource('src/pages/profile/membership.vue')).toContain('1 个我的计划')
  })

  it('uses the shared write feedback for every quota-managed plan write path', () => {
    const mutationContracts: Array<[string, RegExp]> = [
      [
        'src/pages/plan/create.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '计划创建失败，请重试'\)/
      ],
      [
        'src/pages/plan/index.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '计划复制失败，请重试'\)/
      ],
      [
        'src/pages/plan/detail.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '计划复制失败，请重试'\)/
      ],
      [
        'src/pages/plan/edit.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '计划保存失败，请重试'\)/
      ],
      [
        'src/pages/plan/day-edit.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '训练日保存失败，请重试'\)/
      ],
      [
        'src/pages/plan/active.vue',
        /catch \(err\) \{\s*showPlanWriteError\(err, '保存到我的计划失败，请重试'\)/
      ]
    ]

    mutationContracts.forEach(([path, contract]) => {
      expect(readSource(path)).toMatch(contract)
    })
  })

  it('passes original deletion errors to the shared feedback adapter', () => {
    const indexSource = readSource('src/pages/plan/index.vue')
    const detailSource = readSource('src/pages/plan/detail.vue')

    expect(indexSource).toMatch(
      /catch \(err\) \{\s*showPlanWriteError\(err, '计划删除失败，请重试'\)/
    )
    expect(detailSource).toMatch(
      /catch \(err\) \{\s*showPlanWriteError\(err, '计划删除失败，请重试'\)/
    )
    expect(detailSource).toMatch(
      /catch \(err\) \{\s*showPlanWriteError\(err, '训练日删除失败，请重试'\)/
    )
  })

  it('mounts the membership prompt in every plan write page', () => {
    const paths = [
      'src/pages/plan/create.vue',
      'src/pages/plan/index.vue',
      'src/pages/plan/detail.vue',
      'src/pages/plan/edit.vue',
      'src/pages/plan/day-edit.vue',
      'src/pages/plan/active.vue'
    ]

    paths.forEach((path) => {
      const source = readSource(path)
      expect(source).toContain(
        "import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'"
      )
      expect(source).toContain('<MembershipRequiredModal />')
    })
  })

  it('hydrates and resets the server-owned saved execution state', () => {
    const apiSource = readSource('src/api/plan.ts')
    const storeSource = readSource('src/stores/plan.ts')
    const activeSource = readSource('src/pages/plan/active.vue')

    expect(apiSource).toMatch(
      /export interface ActiveExecutionResponse \{[\s\S]*?savedDefinitionId\?: number \| null[\s\S]*?\n\}/
    )
    expect(activeSource).toContain(
      'const savedDefinitionId = computed(() => execution.value?.savedDefinitionId ?? null)'
    )
    expect(activeSource).toContain('!savedDefinitionId.value')
    expect(storeSource).toMatch(
      /if \(activeExecution\.value\?\.executionId === executionId\) \{[\s\S]*?savedDefinitionId: detail\.id/
    )
  })

  it('keeps plan deletion available without a membership pre-check', () => {
    const indexSource = readSource('src/pages/plan/index.vue')
    const detailSource = readSource('src/pages/plan/detail.vue')

    expect(indexSource).toContain("ensureFeatureAuth('删除训练计划')")
    expect(detailSource).toContain("ensureFeatureAuth('删除训练计划')")
  })
})

describe('showPlanWriteError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('uni', {
      showToast: feedbackMocks.showToast,
      switchTab: feedbackMocks.switchTab
    })
  })

  it('routes only 40311 to the quota prompt with the manage-plans action', () => {
    const handled = showPlanWriteError(
      new ApiError('免费版最多可拥有 1 个我的计划', 40311, 403),
      '计划创建失败，请重试'
    )

    expect(handled).toBe(true)
    expect(feedbackMocks.showToast).not.toHaveBeenCalled()
    expect(feedbackMocks.openPrompt).toHaveBeenCalledWith(
      '自定义训练计划',
      '免费版最多可拥有 1 个我的计划',
      'custom_plan',
      expect.objectContaining({
        secondaryActionText: '管理我的计划',
        onSecondary: expect.any(Function)
      })
    )

    const options = feedbackMocks.openPrompt.mock.calls[0]?.[3]
    options?.onSecondary?.()
    expect(feedbackMocks.requestPlanTab).toHaveBeenCalledWith('mine')
    expect(feedbackMocks.switchTab).toHaveBeenCalledWith({ url: '/pages/plan/index' })
  })

  it('keeps a non-quota ApiError message and uses fallback for unknown errors', () => {
    expect(showPlanWriteError(new ApiError('计划正在使用，不能删除', 40901, 409), '删除失败')).toBe(
      false
    )
    expect(feedbackMocks.showToast).toHaveBeenLastCalledWith({
      title: '计划正在使用，不能删除',
      icon: 'none'
    })

    expect(showPlanWriteError(new Error('network'), '计划删除失败，请重试')).toBe(false)
    expect(feedbackMocks.showToast).toHaveBeenLastCalledWith({
      title: '计划删除失败，请重试',
      icon: 'none'
    })
    expect(feedbackMocks.openPrompt).not.toHaveBeenCalled()
  })
})
