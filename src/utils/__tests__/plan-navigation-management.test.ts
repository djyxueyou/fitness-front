// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolvePlanLandingTab, useTrainingHubStore } from '@/stores/training-hub'
import { createSessionLoadCoordinator } from '@/utils/session-load-coordinator'
import { resetPlanViewLocalState } from '@/utils/plan-view-session-state'

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

    hub.requestPlanTab('auto')
    expect(hub.consumeRequestedView()).toBe('plan')
    expect(hub.consumeRequestedPlanTab()).toBe('auto')
    expect(hub.consumeRequestedPlanTab()).toBeNull()
  })

  it('carries an explicit landing tab and exposes current-plan stop', () => {
    const hub = readSource('src/stores/training-hub.ts')
    const home = readSource('src/pages/home/index.vue')
    const plan = readSource('src/pages/plan/index.vue')
    const active = readSource('src/pages/plan/active.vue')

    expect(hub).toContain('requestedPlanTab')
    expect(hub).toContain('consumeRequestedPlanTab')
    expect(home).toContain("requestPlanTab('auto')")
    expect(home).not.toContain("requestPlanTab(planStore.userPlans.length ? 'mine' : 'system')")
    expect(plan).toContain('浏览系统计划')
    expect(active).toContain('停用当前计划')
    expect(active).not.toContain('存为我的计划')
  })

  it('consumes a requested plan subtab once without changing direct tab entry', () => {
    const plan = readSource('src/pages/plan/index.vue')

    expect(plan).toMatch(
      /const loadTicket = planViewLoadCoordinator\.begin\([\s\S]*?await loadTicket\.promise[\s\S]*?if \(!loadTicket\.isCurrent\(\)\) return[\s\S]*?const requestedPlanTab = trainingHubStore\.consumeRequestedPlanTab\(\)/
    )
    expect(plan).toContain('resolvePlanLandingTab(')
    expect(plan).toContain('!planStore.listError && Boolean(planStore.userPlans.length)')
    expect(plan).toMatch(/if \(!requestedPlanTab\) return/)
  })

  it('resolves auto from a loaded user-plan result and keeps failure or empty results safe', () => {
    const hub = useTrainingHubStore()
    hub.requestPlanTab('auto')

    const intent = hub.consumeRequestedPlanTab()
    expect(intent).toBe('auto')
    expect(resolvePlanLandingTab(intent!, true)).toBe('mine')
    expect(resolvePlanLandingTab('auto', false)).toBe('system')
    expect(hub.consumeRequestedPlanTab()).toBeNull()
  })

  it('isolates anonymous and authenticated loads while keeping cleanup identity-safe', async () => {
    let resolveAnonymous!: () => void
    let resolveAuthenticated!: () => void
    const anonymousLoad = new Promise<void>((resolve) => {
      resolveAnonymous = resolve
    })
    const authenticatedLoad = new Promise<void>((resolve) => {
      resolveAuthenticated = resolve
    })
    const sessionChanges: Array<[string | null, string | null]> = []
    const coordinator = createSessionLoadCoordinator<string | null>({
      onSessionChange: (previous, next) => sessionChanges.push([previous, next])
    })
    const hub = useTrainingHubStore()
    hub.requestPlanTab('auto')
    let anonymousIsCurrent: (() => boolean) | undefined
    let authenticatedIsCurrent: (() => boolean) | undefined

    const anonymous = coordinator.begin(null, (isCurrent) => {
      anonymousIsCurrent = isCurrent
      return anonymousLoad
    })
    const authenticated = coordinator.begin('token-a', (isCurrent) => {
      authenticatedIsCurrent = isCurrent
      return authenticatedLoad
    })
    const duplicateAuthenticated = coordinator.begin('token-a', () => {
      throw new Error('same-session load should have been reused')
    })

    expect(duplicateAuthenticated).toBe(authenticated)
    expect(sessionChanges).toEqual([[null, 'token-a']])
    expect(anonymousIsCurrent?.()).toBe(false)
    expect(authenticatedIsCurrent?.()).toBe(true)
    resolveAnonymous()
    await anonymous.promise
    expect(anonymous.isCurrent()).toBe(false)
    expect(hub.requestedPlanTab).toBe('auto')
    expect(
      coordinator.begin('token-a', () => {
        throw new Error('old cleanup must not clear the new session load')
      })
    ).toBe(authenticated)

    resolveAuthenticated()
    await authenticated.promise
    expect(authenticated.isCurrent()).toBe(true)
    expect(hub.consumeRequestedPlanTab()).toBe('auto')
    expect(hub.consumeRequestedPlanTab()).toBeNull()
  })

  it('silently ignores stale personal-detail loads on the detail page', () => {
    const pages = [
      readSource('src/pages/plan/detail.vue'),
      readSource('src/pages/plan/edit.vue'),
      readSource('src/pages/plan/day-edit.vue')
    ]

    pages.forEach((page) => {
      expect(page).toContain('isStalePlanDetailError')
      expect(page).toMatch(/catch \(err\) \{\s*if \(isStalePlanDetailError\(err\)\) return/)
    })
  })

  it('clears account-bound plan-page local state immediately on a session change', () => {
    const state = {
      activePlanSummary: { value: { definitionId: 1 } as object | null },
      busyPlanId: { value: 7 as number | null },
      sheetVisible: { value: true },
      sheetTitle: { value: '账号 A 计划' },
      sheetSubtitle: { value: '账号 A 数据' },
      sheetItems: { value: [{ key: 'delete' }] as unknown[] },
      sheetTargetPlan: { value: { id: 7 } as object | null }
    }

    resetPlanViewLocalState(state)

    expect(state).toEqual({
      activePlanSummary: { value: null },
      busyPlanId: { value: null },
      sheetVisible: { value: false },
      sheetTitle: { value: '' },
      sheetSubtitle: { value: '' },
      sheetItems: { value: [] },
      sheetTargetPlan: { value: null }
    })
    const plan = readSource('src/pages/plan/index.vue')
    expect(plan).toContain('resetPlanViewLocalState({')
  })

  it('silently cancels old-session plan mutations before pages show success or navigate', () => {
    const pages = [
      readSource('src/pages/plan/index.vue'),
      readSource('src/pages/plan/detail.vue'),
      readSource('src/pages/plan/active.vue'),
      readSource('src/pages/plan/customize-preview.vue')
    ]

    pages.forEach((page) => {
      expect(page).toContain('isStalePlanDetailError')
    })
    expect(
      pages.join('\n').match(/if \(isStalePlanDetailError\(err\)\) return/g)?.length
    ).toBeGreaterThanOrEqual(5)
  })

  it('keeps system executions separate from user-owned plans', () => {
    const store = readSource('src/stores/plan.ts')
    const active = readSource('src/pages/plan/active.vue')
    const api = readSource('src/api/plan.ts')

    expect(active).not.toContain('saveToMyPlans')
    expect(store).not.toContain('saveActiveToMyPlans')
    expect(api).not.toContain('save-as-my-plan')
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
    expect(preview).toContain('clientRequestId')
    expect(preview).toContain('replaceCurrent')
    expect(preview).toContain('uni.reLaunch({ url: routes.planActive })')
    expect(preview).toContain('runSystemPlanActivation')
    expect(preview).toContain('<AppActionSheet')
    expect(preview).toContain('cancel-text="暂不替换"')
    expect(preview).toContain("key: 'confirm-replacement'")
    expect(preview).not.toContain('uni.showModal')
    expect(readSource('src/pages/plan/active.vue')).toMatch(
      /function goBack\(\) \{\s*uni\.switchTab\(\{ url: routes\.planIndex \}\)\s*\}/
    )
  })
})
