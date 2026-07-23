import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  activateSystemPlan: vi.fn(),
  activateTrainingPlan: vi.fn(),
  copyTrainingPlan: vi.fn(),
  createTrainingPlan: vi.fn(),
  createTrainingPlanDay: vi.fn(),
  deactivateActiveTrainingPlan: vi.fn(),
  deleteTrainingPlan: vi.fn(),
  deleteTrainingPlanDay: vi.fn(),
  fetchActivePlanExecution: vi.fn(),
  fetchActiveTrainingPlanSummary: vi.fn(),
  fetchSystemPlanDetail: vi.fn(),
  fetchSystemPlans: vi.fn(),
  fetchTodayPlanRecommendation: vi.fn(),
  fetchTrainingPlanDetail: vi.fn(),
  fetchTrainingPlans: vi.fn(),
  previewSystemPlan: vi.fn(),
  updateTrainingPlan: vi.fn(),
  updateTrainingPlanDay: vi.fn()
}))

vi.mock('@/api/plan', () => apiMocks)

import { StalePlanDetailError, usePlanStore } from '@/stores/plan'
import { resolvePlanLandingTab, useTrainingHubStore } from '@/stores/training-hub'
import type {
  ActiveExecutionResponse,
  ActivePlanSummaryResponse,
  PlanRecommendationResponse,
  SystemPlanListItemResponse,
  TrainingPlanDetailResponse,
  TrainingPlanListItemResponse
} from '@/api/plan'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const systemPlan = (id: number): SystemPlanListItemResponse => ({
  id,
  name: `系统计划 ${id}`,
  cycleWeeks: 4,
  minWeeklyFrequency: 2,
  maxWeeklyFrequency: 4,
  collectionCodes: [],
  supportedEquipment: ['GYM'],
  supportedDurations: [35]
})

const userPlan = (id: number, active: boolean): TrainingPlanListItemResponse => ({
  id,
  name: `我的计划 ${id}`,
  planType: 'USER',
  cycleWeeks: 4,
  active
})

const detail = (id: number, name: string, active = false): TrainingPlanDetailResponse => ({
  id,
  name,
  planType: 'USER',
  cycleWeeks: 4,
  active,
  days: []
})

const activeSummary = (): ActivePlanSummaryResponse => ({
  definitionId: 1,
  planName: '迟到计划',
  executionStatus: 'ACTIVE',
  weekIndex: 1,
  cycleWeeks: 4,
  totalDays: 4,
  completedTotal: 0,
  scheduledThisWeek: 1,
  completedThisWeek: 0,
  skippedThisWeek: 0,
  overdueCount: 0,
  remainingThisWeek: 1
})

const activeExecution = (): ActiveExecutionResponse => ({
  executionId: 10,
  definitionId: 1,
  planName: '迟到计划',
  status: 'ACTIVE',
  currentWeek: 1,
  cycleWeeks: 4,
  scheduleStartDate: '2026-07-20',
  scheduleEndDate: '2026-08-16',
  days: []
})

const restRecommendation = (title: string): PlanRecommendationResponse => ({
  type: 'PLAN_REST',
  title,
  subtitle: '休息'
})

describe('plan store request epochs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
    apiMocks.deactivateActiveTrainingPlan.mockResolvedValue(undefined)
    apiMocks.fetchTodayPlanRecommendation.mockResolvedValue(null)
    apiMocks.fetchSystemPlans.mockResolvedValue([])
    apiMocks.fetchTrainingPlans.mockResolvedValue([])
    apiMocks.fetchActiveTrainingPlanSummary.mockResolvedValue(null)
    apiMocks.fetchActivePlanExecution.mockResolvedValue(null)
  })

  it('force refresh starts a replacement request and ignores the older response', async () => {
    const firstSystems = deferred<SystemPlanListItemResponse[]>()
    const firstUsers = deferred<TrainingPlanListItemResponse[]>()
    const secondSystems = deferred<SystemPlanListItemResponse[]>()
    const secondUsers = deferred<TrainingPlanListItemResponse[]>()
    apiMocks.fetchSystemPlans
      .mockReturnValueOnce(firstSystems.promise)
      .mockReturnValueOnce(secondSystems.promise)
    apiMocks.fetchTrainingPlans
      .mockReturnValueOnce(firstUsers.promise)
      .mockReturnValueOnce(secondUsers.promise)
    const store = usePlanStore()

    const older = store.fetchPlans()
    const replacement = store.fetchPlans({ force: true })

    expect(apiMocks.fetchSystemPlans).toHaveBeenCalledTimes(2)
    expect(apiMocks.fetchTrainingPlans).toHaveBeenCalledTimes(2)

    firstSystems.resolve([systemPlan(1)])
    firstUsers.resolve([userPlan(1, true)])
    await older
    expect(store.items).toEqual([])
    expect(store.loading).toBe(true)

    secondSystems.resolve([systemPlan(2)])
    secondUsers.resolve([userPlan(2, false)])
    await replacement
    expect(store.systemPlans.map((item) => item.id)).toEqual([2])
    expect(store.items).toEqual([userPlan(2, false)])
    expect(store.loading).toBe(false)
  })

  it('consumes auto once after the mocked user-plan list has really loaded', async () => {
    apiMocks.fetchSystemPlans.mockResolvedValueOnce([systemPlan(1)])
    apiMocks.fetchTrainingPlans.mockResolvedValueOnce([userPlan(7, false)])
    const plans = usePlanStore()
    const hub = useTrainingHubStore()
    hub.requestPlanTab('auto')

    await plans.fetchPlans({ force: true })
    const intent = hub.consumeRequestedPlanTab()

    expect(intent).toBe('auto')
    expect(
      resolvePlanLandingTab(intent!, !plans.listError && Boolean(plans.userPlans.length))
    ).toBe('mine')
    expect(hub.consumeRequestedPlanTab()).toBeNull()
  })

  it('deactivation invalidates older list and current-plan responses without deleting copies', async () => {
    const staleSystems = deferred<SystemPlanListItemResponse[]>()
    const staleUsers = deferred<TrainingPlanListItemResponse[]>()
    const staleSummary = deferred<ActivePlanSummaryResponse>()
    const staleExecution = deferred<ActiveExecutionResponse>()
    apiMocks.fetchSystemPlans
      .mockReturnValueOnce(staleSystems.promise)
      .mockResolvedValueOnce([systemPlan(2)])
    apiMocks.fetchTrainingPlans
      .mockReturnValueOnce(staleUsers.promise)
      .mockResolvedValueOnce([userPlan(1, false), userPlan(2, false)])
    apiMocks.fetchActiveTrainingPlanSummary.mockReturnValueOnce(staleSummary.promise)
    apiMocks.fetchActivePlanExecution.mockReturnValueOnce(staleExecution.promise)
    const store = usePlanStore()
    store.items = [userPlan(1, true), userPlan(2, false)]
    store.currentPlanSummary = activeSummary()
    store.activeExecution = activeExecution()

    const oldListRequest = store.fetchPlans()
    const oldCurrentRequest = store.loadCurrentPlan()
    const deactivation = store.deactivateActive()
    await Promise.resolve()
    await Promise.resolve()

    expect(apiMocks.fetchSystemPlans).toHaveBeenCalledTimes(2)
    expect(apiMocks.fetchTrainingPlans).toHaveBeenCalledTimes(2)
    await deactivation

    expect(store.items.map((item) => item.id)).toEqual([1, 2])
    expect(store.items.every((item) => !item.active)).toBe(true)
    expect(store.currentPlanSummary).toBeNull()
    expect(store.activeExecution).toBeNull()

    staleSystems.resolve([systemPlan(1)])
    staleUsers.resolve([userPlan(1, true)])
    staleSummary.resolve(activeSummary())
    staleExecution.resolve(activeExecution())
    await Promise.all([oldListRequest, oldCurrentRequest])

    expect(store.items.map((item) => item.id)).toEqual([1, 2])
    expect(store.items.every((item) => !item.active)).toBe(true)
    expect(store.currentPlanSummary).toBeNull()
    expect(store.activeExecution).toBeNull()
  })

  it('does not let an older detail GET overwrite a successful plan update', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail.mockReturnValueOnce(staleRead.promise)
    apiMocks.updateTrainingPlan.mockResolvedValueOnce(detail(7, '已更新'))
    const store = usePlanStore()

    const oldRequest = store.getDetail(7, true)
    await store.updatePlan(7, { name: '已更新', cycleWeeks: 4 })
    staleRead.resolve(detail(7, '旧详情'))

    await expect(oldRequest).resolves.toEqual(detail(7, '已更新'))
    await expect(store.getDetail(7)).resolves.toEqual(detail(7, '已更新'))
    expect(apiMocks.fetchTrainingPlanDetail).toHaveBeenCalledTimes(1)
  })

  it('turns an older GET rejection into stale after a successful mutation', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail.mockReturnValueOnce(staleRead.promise)
    apiMocks.updateTrainingPlan.mockResolvedValueOnce(detail(7, '已更新'))
    const store = usePlanStore()

    const oldRequest = store.getDetail(7, true)
    const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    await store.updatePlan(7, { name: '已更新', cycleWeeks: 4 })
    staleRead.reject(new Error('旧请求网络失败'))

    await oldAssertion
    await expect(store.getDetail(7)).resolves.toEqual(detail(7, '已更新'))
  })

  it('keeps an unrelated plan detail read valid while another plan is mutated', async () => {
    const otherPlanRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail.mockReturnValueOnce(otherPlanRead.promise)
    apiMocks.updateTrainingPlan.mockResolvedValueOnce(detail(8, '计划 8 已更新'))
    const store = usePlanStore()

    const request = store.getDetail(7, true)
    await store.updatePlan(8, { name: '计划 8 已更新', cycleWeeks: 4 })
    otherPlanRead.resolve(detail(7, '计划 7 详情'))
    await request

    await expect(store.getDetail(7)).resolves.toEqual(detail(7, '计划 7 详情'))
    expect(apiMocks.fetchTrainingPlanDetail).toHaveBeenCalledTimes(1)
  })

  it('keeps an in-flight detail mutation valid when active-plan requests are invalidated', async () => {
    const pendingUpdate = deferred<TrainingPlanDetailResponse>()
    apiMocks.updateTrainingPlan.mockReturnValueOnce(pendingUpdate.promise)
    const store = usePlanStore()

    const updateRequest = store.updatePlan(7, { name: '请求失效后仍保存', cycleWeeks: 4 })
    await store.deactivateActive()
    pendingUpdate.resolve(detail(7, '请求失效后仍保存'))
    await updateRequest

    await expect(store.getDetail(7)).resolves.toEqual(detail(7, '请求失效后仍保存'))
    expect(apiMocks.fetchTrainingPlanDetail).not.toHaveBeenCalled()
  })

  it('invalidates an uncached in-flight detail GET when that plan is activated', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce(detail(17, '启用后详情', true))
    const store = usePlanStore()

    const oldRequest = store.getDetail(17, true)
    await store.activate(17)
    staleRead.resolve(detail(17, '启用前详情', false))

    await expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    await expect(store.getDetail(17)).resolves.toEqual(detail(17, '启用后详情', true))
  })

  it('invalidates every uncached in-flight detail GET when the active plan is stopped', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce(detail(19, '停用后详情', false))
    const store = usePlanStore()

    const oldRequest = store.getDetail(19, true)
    await store.deactivateActive()
    staleRead.resolve(detail(19, '停用前详情', true))

    await expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    await expect(store.getDetail(19)).resolves.toEqual(detail(19, '停用后详情', false))
  })

  it('does not let an old-session activation touch the new-session same-id state', async () => {
    const activation = deferred<void>()
    apiMocks.activateTrainingPlan.mockReturnValueOnce(activation.promise)
    apiMocks.fetchTrainingPlanDetail.mockResolvedValueOnce(detail(31, '账号 B 详情', false))
    const store = usePlanStore()

    const oldRequest = store.activate(31)
    const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 31, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 休息日')
    store.items = [userPlan(31, false)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    await store.getDetail(31, true)
    activation.resolve()

    await oldAssertion
    expect(store.items).toEqual([userPlan(31, false)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
    await expect(store.getDetail(31)).resolves.toEqual(detail(31, '账号 B 详情', false))
    expect(apiMocks.fetchSystemPlans).not.toHaveBeenCalled()
  })

  it('does not let an old-session deactivation clear new-session current state or detail', async () => {
    const deactivation = deferred<void>()
    apiMocks.deactivateActiveTrainingPlan.mockReturnValueOnce(deactivation.promise)
    apiMocks.fetchTrainingPlanDetail.mockResolvedValueOnce(detail(33, '账号 B 详情', true))
    const store = usePlanStore()

    const oldRequest = store.deactivateActive()
    const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 33, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 推荐')
    store.items = [userPlan(33, true)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    await store.getDetail(33, true)
    deactivation.resolve()

    await oldAssertion
    expect(store.items).toEqual([userPlan(33, true)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
    await expect(store.getDetail(33)).resolves.toEqual(detail(33, '账号 B 详情', true))
    expect(apiMocks.fetchSystemPlans).not.toHaveBeenCalled()
  })

  it('does not let an old-session system activation replace new-session current state', async () => {
    const activation = deferred<ActivePlanSummaryResponse>()
    apiMocks.activateSystemPlan.mockReturnValueOnce(activation.promise)
    apiMocks.fetchTrainingPlanDetail.mockResolvedValueOnce(detail(35, '账号 B 详情', true))
    const store = usePlanStore()

    const oldRequest = store.activateSystem(35, {
      weeklyFrequency: 3,
      unavailableBodyParts: ['NONE'],
      equipment: 'GYM',
      durationMinutes: 35
    })
    const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 35, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 推荐')
    store.items = [userPlan(35, true)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    await store.getDetail(35, true)
    activation.resolve({ ...activeSummary(), definitionId: 35, planName: '账号 A 系统计划' })

    await oldAssertion
    expect(store.items).toEqual([userPlan(35, true)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
    await expect(store.getDetail(35)).resolves.toEqual(detail(35, '账号 B 详情', true))
    expect(apiMocks.fetchSystemPlans).not.toHaveBeenCalled()
  })

  it('turns all three old-session mutation API failures into stale without touching session B', async () => {
    const scenarios = [
      {
        configure: (failure: Promise<never>) =>
          apiMocks.activateTrainingPlan.mockReturnValueOnce(failure),
        run: (store: ReturnType<typeof usePlanStore>) => store.activate(41)
      },
      {
        configure: (failure: Promise<never>) =>
          apiMocks.deactivateActiveTrainingPlan.mockReturnValueOnce(failure),
        run: (store: ReturnType<typeof usePlanStore>) => store.deactivateActive()
      },
      {
        configure: (failure: Promise<never>) =>
          apiMocks.activateSystemPlan.mockReturnValueOnce(failure),
        run: (store: ReturnType<typeof usePlanStore>) =>
          store.activateSystem(41, {
            weeklyFrequency: 3,
            unavailableBodyParts: ['NONE'],
            equipment: 'GYM',
            durationMinutes: 35
          })
      }
    ]

    for (const scenario of scenarios) {
      setActivePinia(createPinia())
      const failure = deferred<never>()
      scenario.configure(failure.promise)
      const store = usePlanStore()
      const oldRequest = scenario.run(store)
      const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
      store.clearPersonalPlanState()
      const bSummary = { ...activeSummary(), definitionId: 41, planName: '账号 B 当前计划' }
      const bRecommendation = restRecommendation('账号 B 推荐')
      store.items = [userPlan(41, true)]
      store.currentPlanSummary = bSummary
      store.recommendation = bRecommendation
      apiMocks.fetchTrainingPlanDetail.mockResolvedValueOnce(detail(41, '账号 B 详情', true))
      await store.getDetail(41, true)
      failure.reject(new Error('账号 A 请求失败'))

      await oldAssertion
      expect(store.items).toEqual([userPlan(41, true)])
      expect(store.currentPlanSummary).toEqual(bSummary)
      expect(store.recommendation).toEqual(bRecommendation)
      await expect(store.getDetail(41)).resolves.toEqual(detail(41, '账号 B 详情', true))
    }
  })

  it('stops activation after its plan-list refresh crosses into session B', async () => {
    const systems = deferred<SystemPlanListItemResponse[]>()
    const users = deferred<TrainingPlanListItemResponse[]>()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    apiMocks.activateTrainingPlan.mockResolvedValueOnce(undefined)
    apiMocks.fetchSystemPlans.mockReturnValueOnce(systems.promise)
    apiMocks.fetchTrainingPlans.mockReturnValueOnce(users.promise)
    const store = usePlanStore()

    const oldOperation = store.activate(51)
    const oldAssertion = expect(oldOperation).rejects.toBeInstanceOf(StalePlanDetailError)
    await vi.waitFor(() => expect(apiMocks.fetchTrainingPlans).toHaveBeenCalledTimes(1))

    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 51, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 推荐')
    store.items = [userPlan(51, false)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    systems.reject(new Error('账号 A 列表刷新失败'))
    users.resolve([userPlan(51, true)])

    await oldAssertion
    expect(apiMocks.fetchActiveTrainingPlanSummary).not.toHaveBeenCalled()
    expect(apiMocks.fetchActivePlanExecution).not.toHaveBeenCalled()
    expect(apiMocks.fetchTodayPlanRecommendation).not.toHaveBeenCalled()
    expect(store.items).toEqual([userPlan(51, false)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
    expect(errorLog).toHaveBeenCalledWith('[plan] fetch plans failed', expect.any(Error))
    errorLog.mockRestore()
  })

  it('stops system activation after its current-plan refresh crosses into session B', async () => {
    const summaryRefresh = deferred<ActivePlanSummaryResponse | null>()
    const executionRefresh = deferred<ActiveExecutionResponse | null>()
    apiMocks.activateSystemPlan.mockResolvedValueOnce({
      ...activeSummary(),
      definitionId: 53,
      planName: '账号 A 系统计划'
    })
    apiMocks.fetchActiveTrainingPlanSummary.mockReturnValueOnce(summaryRefresh.promise)
    apiMocks.fetchActivePlanExecution.mockReturnValueOnce(executionRefresh.promise)
    const store = usePlanStore()

    const oldOperation = store.activateSystem(53, {
      weeklyFrequency: 3,
      unavailableBodyParts: ['NONE'],
      equipment: 'GYM',
      durationMinutes: 35
    })
    const oldAssertion = expect(oldOperation).rejects.toBeInstanceOf(StalePlanDetailError)
    await vi.waitFor(() => expect(apiMocks.fetchActiveTrainingPlanSummary).toHaveBeenCalledTimes(1))

    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 53, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 推荐')
    store.items = [userPlan(53, true)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    summaryRefresh.resolve({ ...activeSummary(), definitionId: 53, planName: '账号 A 刷新结果' })
    executionRefresh.resolve({ ...activeExecution(), definitionId: 53, planName: '账号 A 执行' })

    await oldAssertion
    expect(apiMocks.fetchSystemPlans).not.toHaveBeenCalled()
    expect(apiMocks.fetchTrainingPlans).not.toHaveBeenCalled()
    expect(apiMocks.fetchTodayPlanRecommendation).not.toHaveBeenCalled()
    expect(store.items).toEqual([userPlan(53, true)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
  })

  it('makes deactivation stale when its final recommendation refresh finishes in session B', async () => {
    const recommendationRefresh = deferred<PlanRecommendationResponse | null>()
    apiMocks.fetchTodayPlanRecommendation.mockReturnValueOnce(recommendationRefresh.promise)
    const store = usePlanStore()

    const oldOperation = store.deactivateActive()
    const oldAssertion = expect(oldOperation).rejects.toBeInstanceOf(StalePlanDetailError)
    await vi.waitFor(() => expect(apiMocks.fetchTodayPlanRecommendation).toHaveBeenCalledTimes(1))
    const recommendationCallsBeforeSwitch = apiMocks.fetchTodayPlanRecommendation.mock.calls.length

    store.clearPersonalPlanState()
    const bSummary = { ...activeSummary(), definitionId: 55, planName: '账号 B 当前计划' }
    const bRecommendation = restRecommendation('账号 B 推荐')
    store.items = [userPlan(55, true)]
    store.currentPlanSummary = bSummary
    store.recommendation = bRecommendation
    recommendationRefresh.resolve(restRecommendation('账号 A 推荐'))

    await oldAssertion
    expect(apiMocks.fetchTodayPlanRecommendation).toHaveBeenCalledTimes(
      recommendationCallsBeforeSwitch
    )
    expect(apiMocks.fetchActiveTrainingPlanSummary).not.toHaveBeenCalled()
    expect(apiMocks.fetchActivePlanExecution).not.toHaveBeenCalled()
    expect(store.items).toEqual([userPlan(55, true)])
    expect(store.currentPlanSummary).toEqual(bSummary)
    expect(store.recommendation).toEqual(bRecommendation)
  })

  it('clears personal details across sessions and ignores a late prior-session GET', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce(detail(9, '新会话详情'))
    const store = usePlanStore()

    const oldRequest = store.getDetail(9, true)
    store.clearPersonalPlanState()
    staleRead.resolve(detail(9, '旧会话详情'))

    await expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    await expect(store.getDetail(9)).resolves.toEqual(detail(9, '新会话详情'))
    expect(apiMocks.fetchTrainingPlanDetail).toHaveBeenCalledTimes(2)
  })

  it('turns an old GET rejection into stale after the session is cleared', async () => {
    const staleRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail.mockReturnValueOnce(staleRead.promise)
    const store = usePlanStore()

    const oldRequest = store.getDetail(9, true)
    const oldAssertion = expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    store.clearPersonalPlanState()
    staleRead.reject(new Error('旧账号请求失败'))

    await oldAssertion
  })

  it('never returns a new-session same-id cache to an old-session caller', async () => {
    const oldSessionRead = deferred<TrainingPlanDetailResponse>()
    apiMocks.fetchTrainingPlanDetail
      .mockReturnValueOnce(oldSessionRead.promise)
      .mockResolvedValueOnce(detail(23, '账号 B 详情'))
    const store = usePlanStore()

    const oldRequest = store.getDetail(23, true)
    store.clearPersonalPlanState()
    await expect(store.getDetail(23, true)).resolves.toEqual(detail(23, '账号 B 详情'))
    oldSessionRead.resolve(detail(23, '账号 A 详情'))

    await expect(oldRequest).rejects.toBeInstanceOf(StalePlanDetailError)
    await expect(store.getDetail(23)).resolves.toEqual(detail(23, '账号 B 详情'))
  })

  it('drops an already cached detail on session clear so the next session fetches again', async () => {
    apiMocks.fetchTrainingPlanDetail
      .mockResolvedValueOnce(detail(11, '旧会话缓存'))
      .mockResolvedValueOnce(detail(11, '新会话详情'))
    const store = usePlanStore()

    await store.getDetail(11)
    store.clearPersonalPlanState()

    await expect(store.getDetail(11)).resolves.toEqual(detail(11, '新会话详情'))
    expect(apiMocks.fetchTrainingPlanDetail).toHaveBeenCalledTimes(2)
  })
})
