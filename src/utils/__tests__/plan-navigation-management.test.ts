// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTrainingHubStore } from '@/stores/training-hub'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('plan navigation and management contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('requests and consumes plan intents once while no intent preserves current state', () => {
    const hub = useTrainingHubStore()

    hub.setActiveView('history')
    expect(hub.consumeRequestedView()).toBeNull()
    expect(hub.consumeRequestedPlanTab()).toBeNull()
    expect(hub.activeView).toBe('history')

    hub.requestPlanTab('mine')
    expect(hub.consumeRequestedView()).toBe('plan')
    expect(hub.consumeRequestedView()).toBeNull()
    expect(hub.consumeRequestedPlanTab()).toBe('mine')
    expect(hub.consumeRequestedPlanTab()).toBeNull()
  })

  it('carries an explicit landing tab and exposes current-plan stop', () => {
    const hub = readSource('src/stores/training-hub.ts')
    const home = readSource('src/pages/home/index.vue')
    const plan = readSource('src/pages/plan/index.vue')
    const active = readSource('src/pages/plan/active.vue')

    expect(hub).toContain('requestedPlanTab')
    expect(hub).toContain('consumeRequestedPlanTab')
    expect(home).toContain("requestPlanTab(planStore.userPlans.length ? 'mine' : 'system')")
    expect(plan).toContain('浏览系统计划')
    expect(active).toContain('停用当前计划')
    expect(active).toContain('savedDefinitionId')
  })

  it('consumes a requested plan subtab once without changing direct tab entry', () => {
    const plan = readSource('src/pages/plan/index.vue')

    expect(plan).toMatch(
      /const requestedPlanTab = trainingHubStore\.consumeRequestedPlanTab\(\)[\s\S]*?if \(requestedPlanTab\) activeTab\.value = requestedPlanTab/
    )
  })

  it('derives saved state from the active execution and updates it in the store', () => {
    const store = readSource('src/stores/plan.ts')
    const active = readSource('src/pages/plan/active.vue')

    expect(active).toContain(
      'const savedDefinitionId = computed(() => execution.value?.savedDefinitionId ?? null)'
    )
    expect(active).not.toContain('const savedDefinitionId = ref')
    expect(store).toMatch(
      /if \(activeExecution\.value\?\.executionId === executionId\) \{[\s\S]*?savedDefinitionId: detail\.id/
    )
  })

  it('confirms deactivation, prevents repeat submissions, and reports accurate errors', () => {
    const active = readSource('src/pages/plan/active.vue')

    expect(active).toContain('管理计划')
    expect(active).toContain(
      '停用后首页不再展示该计划的训练安排，已完成的训练记录和进度历史会保留。'
    )
    expect(active).toContain("trainingHubStore.requestPlanTab('system')")
    expect(active).toContain("uni.showToast({ title: '已停用当前计划', icon: 'none' })")
    expect(active).toContain("showPlanWriteError(err, '停用当前计划失败，请重试')")
    expect(active).toMatch(/if \(deactivating\.value\) return/)
  })

  it('routes active list management to the single current-plan flow', () => {
    const plan = readSource('src/pages/plan/index.vue')
    const handler = plan.match(
      /async function handlePlanAction[\s\S]*?(?=\nfunction formatPlanDate)/
    )?.[0]

    expect(handler).toBeTruthy()
    expect(handler).not.toContain('planStore.deactivateActive()')
    expect(handler).toContain('routes.planActive')
  })

  it('keeps system-plan customization on the committed store API', () => {
    const customize = readSource('src/pages/plan/customize.vue')
    const preview = readSource('src/pages/plan/customize-preview.vue')
    const combined = `${customize}\n${preview}`

    expect(combined).not.toContain('RecommendedPlan')
    expect(combined).not.toContain('getRecommendedIntro')
    expect(combined).not.toContain('previewRecommended')
    expect(combined).not.toContain('activateRecommended')
    expect(customize).toContain('getSystemPlanDetail')
    expect(preview).toContain('previewSystem')
    expect(preview).toContain('activateSystem')
  })
})
