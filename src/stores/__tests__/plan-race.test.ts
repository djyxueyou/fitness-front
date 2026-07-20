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
  savePlanExecutionAsMyPlan: vi.fn(),
  updateTrainingPlan: vi.fn(),
  updateTrainingPlanDay: vi.fn()
}))

vi.mock('@/api/plan', () => apiMocks)

import { usePlanStore } from '@/stores/plan'
import type {
  ActiveExecutionResponse,
  ActivePlanSummaryResponse,
  SystemPlanListItemResponse,
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

describe('plan store request epochs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
    apiMocks.deactivateActiveTrainingPlan.mockResolvedValue(undefined)
    apiMocks.fetchTodayPlanRecommendation.mockResolvedValue(null)
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
})
