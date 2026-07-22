import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  activateSystemPlan,
  activateTrainingPlan,
  copyTrainingPlan,
  createTrainingPlan,
  createTrainingPlanDay,
  deactivateActiveTrainingPlan,
  deleteTrainingPlan,
  deleteTrainingPlanDay,
  fetchActivePlanExecution,
  fetchActiveTrainingPlanSummary,
  fetchSystemPlanDetail,
  fetchSystemPlans,
  fetchTodayPlanRecommendation,
  fetchTrainingPlanDetail,
  fetchTrainingPlans,
  previewSystemPlan,
  savePlanExecutionAsMyPlan,
  updateTrainingPlan,
  updateTrainingPlanDay,
  type ActiveExecutionResponse,
  type ActivePlanSummaryResponse,
  type CreateTrainingPlanDayRequest,
  type CreateTrainingPlanRequest,
  type PlanRecommendationResponse,
  type SystemPlanDetailResponse,
  type SystemPlanListItemResponse,
  type SystemPlanCustomizationRequest,
  type SystemPlanPreviewResponse,
  type TrainingPlanDetailResponse,
  type TrainingPlanListItemResponse,
  type UpdateTrainingPlanDayRequest,
  type UpdateTrainingPlanRequest
} from '@/api/plan'

const PLAN_CACHE_MS = 30000

export class StalePlanDetailError extends Error {
  readonly planId: number

  constructor(planId: number) {
    super('Plan detail request is no longer current')
    this.name = 'StalePlanDetailError'
    this.planId = planId
  }
}

export function isStalePlanDetailError(err: unknown): err is StalePlanDetailError {
  return err instanceof StalePlanDetailError
}

export const usePlanStore = defineStore('plan', () => {
  const items = ref<TrainingPlanListItemResponse[]>([])
  const systemPlans = ref<SystemPlanListItemResponse[]>([])
  const detailCache = ref<Record<number, TrainingPlanDetailResponse>>({})
  const systemPlanDetailCache = ref<Record<number, SystemPlanDetailResponse>>({})
  const activeExecution = ref<ActiveExecutionResponse | null>(null)
  const currentPlanSummary = ref<ActivePlanSummaryResponse | null>(null)
  const recommendation = ref<PlanRecommendationResponse | null>(null)
  const loading = ref(false)
  const loadedAt = ref(0)
  const listError = ref('')
  let fetchPromise: Promise<void> | null = null
  let systemPlanFetchPromise: Promise<void> | null = null
  let currentPlanPromise: Promise<void> | null = null
  let recommendationPromise: Promise<void> | null = null
  let sessionEpoch = 0
  let planListRequestEpoch = 0
  let systemPlanRequestEpoch = 0
  let currentPlanRequestEpoch = 0
  let recommendationRequestEpoch = 0
  const detailReadVersions = new Map<number, number>()
  const detailReadOwners = new Map<number, Map<symbol, number>>()
  let planListLoadingOwner: symbol | null = null
  let systemPlanLoadingOwner: symbol | null = null

  const userPlans = computed(() => items.value)
  const activePlan = computed(() => items.value.find((item) => item.active) || null)
  const hasCurrentPlan = computed(() => Boolean(currentPlanSummary.value))

  function syncLoading() {
    loading.value = Boolean(planListLoadingOwner || systemPlanLoadingOwner)
  }

  function invalidatePendingRequests() {
    planListRequestEpoch += 1
    systemPlanRequestEpoch += 1
    currentPlanRequestEpoch += 1
    recommendationRequestEpoch += 1
    fetchPromise = null
    systemPlanFetchPromise = null
    currentPlanPromise = null
    recommendationPromise = null
    planListLoadingOwner = null
    systemPlanLoadingOwner = null
    syncLoading()
  }

  async function fetchPlans(options?: { force?: boolean }) {
    const cacheUsable =
      !options?.force && items.value.length > 0 && Date.now() - loadedAt.value < PLAN_CACHE_MS
    if (cacheUsable) return
    if (!options?.force && fetchPromise) {
      await fetchPromise
      return
    }

    const requestEpoch = ++planListRequestEpoch
    const catalogEpoch = ++systemPlanRequestEpoch
    const requestSessionEpoch = sessionEpoch
    const loadingOwner = Symbol('plan-list-request')
    planListLoadingOwner = loadingOwner
    syncLoading()
    listError.value = ''
    const request = (async () => {
      const [catalogPlans, savedPlans] = await Promise.all([
        fetchSystemPlans(),
        fetchTrainingPlans()
      ])
      if (requestSessionEpoch !== sessionEpoch || requestEpoch !== planListRequestEpoch) return
      if (catalogEpoch === systemPlanRequestEpoch) systemPlans.value = catalogPlans
      items.value = savedPlans
      loadedAt.value = Date.now()
    })()
    fetchPromise = request

    try {
      await request
    } catch (err) {
      if (requestSessionEpoch === sessionEpoch && requestEpoch === planListRequestEpoch) {
        listError.value = '训练计划加载失败，请稍后重试'
      }
      console.error('[plan] fetch plans failed', err)
    } finally {
      if (fetchPromise === request) fetchPromise = null
      if (planListLoadingOwner === loadingOwner) planListLoadingOwner = null
      syncLoading()
    }
  }

  async function fetchSystemPlanList(options?: { force?: boolean }) {
    const cacheUsable =
      !options?.force && systemPlans.value.length > 0 && Date.now() - loadedAt.value < PLAN_CACHE_MS
    if (cacheUsable) return
    if (!options?.force && systemPlanFetchPromise) {
      await systemPlanFetchPromise
      return
    }

    const requestEpoch = ++systemPlanRequestEpoch
    const requestSessionEpoch = sessionEpoch
    const loadingOwner = Symbol('system-plan-request')
    systemPlanLoadingOwner = loadingOwner
    syncLoading()
    listError.value = ''
    const request = (async () => {
      try {
        const catalogPlans = await fetchSystemPlans()
        if (requestSessionEpoch !== sessionEpoch || requestEpoch !== systemPlanRequestEpoch) return
        systemPlans.value = catalogPlans
        loadedAt.value = Date.now()
      } catch (err) {
        if (requestSessionEpoch === sessionEpoch && requestEpoch === systemPlanRequestEpoch) {
          listError.value = '训练计划加载失败，请稍后重试'
        }
        console.error('[plan] system plans fetch failed', err)
      }
    })()
    systemPlanFetchPromise = request

    try {
      await request
    } finally {
      if (systemPlanFetchPromise === request) systemPlanFetchPromise = null
      if (systemPlanLoadingOwner === loadingOwner) systemPlanLoadingOwner = null
      syncLoading()
    }
  }

  async function getDetail(id: number, force = false) {
    if (!force && detailCache.value[id]) return detailCache.value[id]
    const requestSessionEpoch = sessionEpoch
    const requestReadVersion = detailReadVersions.get(id) || 0
    const readOwner = Symbol('plan-detail-read')
    const owners = detailReadOwners.get(id) || new Map<symbol, number>()
    owners.set(readOwner, requestSessionEpoch)
    detailReadOwners.set(id, owners)

    try {
      const detail = await fetchTrainingPlanDetail(id)
      if (requestSessionEpoch !== sessionEpoch) throw new StalePlanDetailError(id)
      if (requestReadVersion !== (detailReadVersions.get(id) || 0)) {
        const latestDetail = detailCache.value[id]
        if (latestDetail) return latestDetail
        throw new StalePlanDetailError(id)
      }
      writePersonalDetailCache(id, detail)
      return detail
    } catch (err) {
      if (isStalePlanDetailError(err)) throw err
      if (
        requestSessionEpoch !== sessionEpoch ||
        requestReadVersion !== (detailReadVersions.get(id) || 0)
      ) {
        throw new StalePlanDetailError(id)
      }
      throw err
    } finally {
      const currentOwners = detailReadOwners.get(id)
      currentOwners?.delete(readOwner)
      if (!currentOwners?.size) detailReadOwners.delete(id)
    }
  }

  function invalidatePersonalDetailReads(id: number) {
    detailReadVersions.set(id, (detailReadVersions.get(id) || 0) + 1)
  }

  function writePersonalDetailCache(id: number, detail: TrainingPlanDetailResponse) {
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
  }

  function commitPersonalDetail(
    id: number,
    detail: TrainingPlanDetailResponse,
    mutationSessionEpoch = sessionEpoch
  ) {
    if (mutationSessionEpoch !== sessionEpoch) return
    invalidatePersonalDetailReads(id)
    writePersonalDetailCache(id, detail)
  }

  function createSessionOperationTicket(planId: number) {
    const operationSessionEpoch = sessionEpoch

    function assertCurrent() {
      if (operationSessionEpoch !== sessionEpoch) throw new StalePlanDetailError(planId)
    }

    async function waitFor<T>(step: () => Promise<T>) {
      assertCurrent()
      try {
        const result = await step()
        assertCurrent()
        return result
      } catch (err) {
        if (isStalePlanDetailError(err)) throw err
        assertCurrent()
        throw err
      }
    }

    return { assertCurrent, waitFor }
  }

  async function getSystemPlanDetail(id: number, force = false) {
    if (!force && systemPlanDetailCache.value[id]) return systemPlanDetailCache.value[id]
    const intro = await fetchSystemPlanDetail(id)
    systemPlanDetailCache.value = {
      ...systemPlanDetailCache.value,
      [id]: intro
    }
    return intro
  }

  async function previewSystem(
    id: number,
    payload: SystemPlanCustomizationRequest
  ): Promise<SystemPlanPreviewResponse> {
    return previewSystemPlan(id, payload)
  }

  async function activateSystem(
    id: number,
    payload: SystemPlanCustomizationRequest
  ): Promise<ActivePlanSummaryResponse> {
    const operation = createSessionOperationTicket(id)
    const summary = await operation.waitFor(() => activateSystemPlan(id, payload))
    operation.assertCurrent()
    invalidatePendingRequests()
    operation.assertCurrent()
    currentPlanSummary.value = summary
    await operation.waitFor(() => loadCurrentPlan({ force: true }))
    operation.assertCurrent()
    await operation.waitFor(() => fetchPlans({ force: true }))
    operation.assertCurrent()
    await operation.waitFor(() => loadRecommendation({ force: true }))
    operation.assertCurrent()
    return summary
  }

  async function loadCurrentPlan(options?: { force?: boolean }) {
    if (!options?.force && currentPlanPromise) {
      await currentPlanPromise
      return currentPlanSummary.value
    }

    const requestEpoch = ++currentPlanRequestEpoch
    const requestSessionEpoch = sessionEpoch
    const request = (async () => {
      const [summary, execution] = await Promise.all([
        fetchActiveTrainingPlanSummary(),
        fetchActivePlanExecution()
      ])
      if (requestSessionEpoch !== sessionEpoch || requestEpoch !== currentPlanRequestEpoch) return
      currentPlanSummary.value = summary
      activeExecution.value = execution && 'executionId' in execution ? execution : null
    })()
    currentPlanPromise = request

    try {
      await request
    } catch (err) {
      if (requestSessionEpoch === sessionEpoch && requestEpoch === currentPlanRequestEpoch) {
        currentPlanSummary.value = null
        activeExecution.value = null
      }
      console.error('[plan] current plan fetch failed', err)
    } finally {
      if (currentPlanPromise === request) currentPlanPromise = null
    }
    return currentPlanSummary.value
  }

  async function loadActiveExecution() {
    await loadCurrentPlan()
    return activeExecution.value
  }

  async function activate(id: number, mode: 'THIS_WEEK' | 'NEXT_WEEK' = 'THIS_WEEK') {
    const operation = createSessionOperationTicket(id)
    await operation.waitFor(() => activateTrainingPlan(id, mode))
    operation.assertCurrent()
    invalidatePendingRequests()
    operation.assertCurrent()
    invalidatePersonalDetailReads(id)
    const cached = detailCache.value[id]
    if (cached) {
      operation.assertCurrent()
      writePersonalDetailCache(id, { ...cached, active: true })
    }
    await operation.waitFor(() => fetchPlans({ force: true }))
    operation.assertCurrent()
    await operation.waitFor(() => loadCurrentPlan({ force: true }))
    operation.assertCurrent()
    await operation.waitFor(() => loadRecommendation({ force: true }))
    operation.assertCurrent()
  }

  async function createPlan(payload: CreateTrainingPlanRequest) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await createTrainingPlan(payload)
    commitPersonalDetail(detail.id, detail, mutationSessionEpoch)
    await fetchPlans({ force: true })
    return detail
  }

  async function deactivateActive() {
    const planId =
      currentPlanSummary.value?.definitionId ?? activeExecution.value?.definitionId ?? 0
    const operation = createSessionOperationTicket(planId)
    await operation.waitFor(deactivateActiveTrainingPlan)
    operation.assertCurrent()
    invalidatePendingRequests()
    operation.assertCurrent()
    const affectedPlanIds = new Set([
      ...Object.keys(detailCache.value).map(Number),
      ...Array.from(detailReadOwners.entries())
        .filter(([, owners]) => Array.from(owners.values()).some((epoch) => epoch === sessionEpoch))
        .map(([id]) => id)
    ])
    operation.assertCurrent()
    affectedPlanIds.forEach(invalidatePersonalDetailReads)
    operation.assertCurrent()
    activeExecution.value = null
    currentPlanSummary.value = null
    recommendation.value = null
    items.value = items.value.map((item) => ({ ...item, active: false }))
    detailCache.value = Object.fromEntries(
      Object.entries(detailCache.value).map(([id, detail]) => {
        return [id, { ...detail, active: false }]
      })
    )
    await operation.waitFor(() => fetchPlans({ force: true }))
    operation.assertCurrent()
    await operation.waitFor(() => loadRecommendation({ force: true }))
    operation.assertCurrent()
  }

  async function saveActiveToMyPlans(executionId: number) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await savePlanExecutionAsMyPlan(executionId)
    if (mutationSessionEpoch !== sessionEpoch) return detail
    invalidatePendingRequests()
    if (activeExecution.value?.executionId === executionId) {
      activeExecution.value = {
        ...activeExecution.value,
        savedDefinitionId: detail.id
      }
    }
    commitPersonalDetail(detail.id, detail)
    await fetchPlans({ force: true })
    return detail
  }

  async function duplicate(id: number) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await copyTrainingPlan(id)
    commitPersonalDetail(detail.id, detail, mutationSessionEpoch)
    await fetchPlans({ force: true })
    return detail
  }

  async function updatePlan(id: number, payload: UpdateTrainingPlanRequest) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await updateTrainingPlan(id, payload)
    commitPersonalDetail(id, detail, mutationSessionEpoch)
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
    return detail
  }

  async function removePlan(id: number) {
    const mutationSessionEpoch = sessionEpoch
    await deleteTrainingPlan(id)
    if (mutationSessionEpoch !== sessionEpoch) return
    invalidatePersonalDetailReads(id)
    const nextCache = { ...detailCache.value }
    delete nextCache[id]
    detailCache.value = nextCache
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
  }

  async function createDay(id: number, payload: CreateTrainingPlanDayRequest) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await createTrainingPlanDay(id, payload)
    commitPersonalDetail(id, detail, mutationSessionEpoch)
    await loadRecommendation({ force: true })
    return detail
  }

  async function updateDay(id: number, dayId: number, payload: UpdateTrainingPlanDayRequest) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await updateTrainingPlanDay(id, dayId, payload)
    commitPersonalDetail(id, detail, mutationSessionEpoch)
    await loadRecommendation({ force: true })
    return detail
  }

  async function deleteDay(id: number, dayId: number) {
    const mutationSessionEpoch = sessionEpoch
    const detail = await deleteTrainingPlanDay(id, dayId)
    commitPersonalDetail(id, detail, mutationSessionEpoch)
    await loadRecommendation({ force: true })
    return detail
  }

  async function loadRecommendation(options?: { force?: boolean }) {
    if (!options?.force && recommendationPromise) {
      await recommendationPromise
      return
    }

    const requestEpoch = ++recommendationRequestEpoch
    const requestSessionEpoch = sessionEpoch
    const request = (async () => {
      const nextRecommendation = await fetchTodayPlanRecommendation()
      if (requestSessionEpoch !== sessionEpoch || requestEpoch !== recommendationRequestEpoch)
        return
      recommendation.value = nextRecommendation
    })()
    recommendationPromise = request

    try {
      await request
    } catch (err) {
      if (requestSessionEpoch === sessionEpoch && requestEpoch === recommendationRequestEpoch) {
        recommendation.value = null
      }
      console.error('[plan] recommendation fetch failed', err)
    } finally {
      if (recommendationPromise === request) recommendationPromise = null
    }
  }

  function clearPersonalPlanState() {
    sessionEpoch += 1
    invalidatePendingRequests()
    items.value = []
    detailCache.value = {}
    detailReadVersions.clear()
    activeExecution.value = null
    currentPlanSummary.value = null
    recommendation.value = null
  }

  return {
    items,
    systemPlans,
    userPlans,
    activePlan,
    activeExecution,
    currentPlanSummary,
    hasCurrentPlan,
    recommendation,
    loading,
    listError,
    fetchPlans,
    fetchSystemPlanList,
    getDetail,
    getSystemPlanDetail,
    previewSystem,
    activateSystem,
    loadCurrentPlan,
    loadActiveExecution,
    activate,
    createPlan,
    saveActiveToMyPlans,
    deactivateActive,
    duplicate,
    updatePlan,
    removePlan,
    createDay,
    updateDay,
    deleteDay,
    loadRecommendation,
    clearPersonalPlanState
  }
})
