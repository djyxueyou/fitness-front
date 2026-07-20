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
  let stateEpoch = 0
  let planListRequestEpoch = 0
  let systemPlanRequestEpoch = 0
  let currentPlanRequestEpoch = 0
  let recommendationRequestEpoch = 0
  let planListLoadingOwner: symbol | null = null
  let systemPlanLoadingOwner: symbol | null = null

  const userPlans = computed(() => items.value)
  const activePlan = computed(() => items.value.find((item) => item.active) || null)
  const hasCurrentPlan = computed(() => Boolean(currentPlanSummary.value))

  function syncLoading() {
    loading.value = Boolean(planListLoadingOwner || systemPlanLoadingOwner)
  }

  function invalidatePendingRequests() {
    stateEpoch += 1
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
    const requestStateEpoch = stateEpoch
    const loadingOwner = Symbol('plan-list-request')
    planListLoadingOwner = loadingOwner
    syncLoading()
    listError.value = ''
    const request = (async () => {
      const [catalogPlans, savedPlans] = await Promise.all([
        fetchSystemPlans(),
        fetchTrainingPlans()
      ])
      if (requestStateEpoch !== stateEpoch || requestEpoch !== planListRequestEpoch) return
      if (catalogEpoch === systemPlanRequestEpoch) systemPlans.value = catalogPlans
      items.value = savedPlans
      loadedAt.value = Date.now()
    })()
    fetchPromise = request

    try {
      await request
    } catch (err) {
      if (requestStateEpoch === stateEpoch && requestEpoch === planListRequestEpoch) {
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
    const requestStateEpoch = stateEpoch
    const loadingOwner = Symbol('system-plan-request')
    systemPlanLoadingOwner = loadingOwner
    syncLoading()
    listError.value = ''
    const request = (async () => {
      try {
        const catalogPlans = await fetchSystemPlans()
        if (requestStateEpoch !== stateEpoch || requestEpoch !== systemPlanRequestEpoch) return
        systemPlans.value = catalogPlans
        loadedAt.value = Date.now()
      } catch (err) {
        if (requestStateEpoch === stateEpoch && requestEpoch === systemPlanRequestEpoch) {
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
    const detail = await fetchTrainingPlanDetail(id)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    return detail
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
    const summary = await activateSystemPlan(id, payload)
    invalidatePendingRequests()
    currentPlanSummary.value = summary
    await loadCurrentPlan({ force: true })
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
    return summary
  }

  async function loadCurrentPlan(options?: { force?: boolean }) {
    if (!options?.force && currentPlanPromise) {
      await currentPlanPromise
      return currentPlanSummary.value
    }

    const requestEpoch = ++currentPlanRequestEpoch
    const requestStateEpoch = stateEpoch
    const request = (async () => {
      const [summary, execution] = await Promise.all([
        fetchActiveTrainingPlanSummary(),
        fetchActivePlanExecution()
      ])
      if (requestStateEpoch !== stateEpoch || requestEpoch !== currentPlanRequestEpoch) return
      currentPlanSummary.value = summary
      activeExecution.value = execution && 'executionId' in execution ? execution : null
    })()
    currentPlanPromise = request

    try {
      await request
    } catch (err) {
      if (requestStateEpoch === stateEpoch && requestEpoch === currentPlanRequestEpoch) {
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
    await activateTrainingPlan(id, mode)
    invalidatePendingRequests()
    await fetchPlans({ force: true })
    const cached = detailCache.value[id]
    if (cached) {
      detailCache.value = {
        ...detailCache.value,
        [id]: { ...cached, active: true }
      }
    }
    await loadCurrentPlan({ force: true })
    await loadRecommendation({ force: true })
  }

  async function createPlan(payload: CreateTrainingPlanRequest) {
    const detail = await createTrainingPlan(payload)
    detailCache.value = { ...detailCache.value, [detail.id]: detail }
    await fetchPlans({ force: true })
    return detail
  }

  async function deactivateActive() {
    await deactivateActiveTrainingPlan()
    invalidatePendingRequests()
    activeExecution.value = null
    currentPlanSummary.value = null
    recommendation.value = null
    items.value = items.value.map((item) => ({ ...item, active: false }))
    detailCache.value = Object.fromEntries(
      Object.entries(detailCache.value).map(([id, detail]) => [id, { ...detail, active: false }])
    )
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
  }

  async function saveActiveToMyPlans(executionId: number) {
    const detail = await savePlanExecutionAsMyPlan(executionId)
    invalidatePendingRequests()
    if (activeExecution.value?.executionId === executionId) {
      activeExecution.value = {
        ...activeExecution.value,
        savedDefinitionId: detail.id
      }
    }
    detailCache.value = { ...detailCache.value, [detail.id]: detail }
    await fetchPlans({ force: true })
    return detail
  }

  async function duplicate(id: number) {
    const detail = await copyTrainingPlan(id)
    detailCache.value = {
      ...detailCache.value,
      [detail.id]: detail
    }
    await fetchPlans({ force: true })
    return detail
  }

  async function updatePlan(id: number, payload: UpdateTrainingPlanRequest) {
    const detail = await updateTrainingPlan(id, payload)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
    return detail
  }

  async function removePlan(id: number) {
    await deleteTrainingPlan(id)
    const nextCache = { ...detailCache.value }
    delete nextCache[id]
    detailCache.value = nextCache
    await fetchPlans({ force: true })
    await loadRecommendation({ force: true })
  }

  async function createDay(id: number, payload: CreateTrainingPlanDayRequest) {
    const detail = await createTrainingPlanDay(id, payload)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation({ force: true })
    return detail
  }

  async function updateDay(id: number, dayId: number, payload: UpdateTrainingPlanDayRequest) {
    const detail = await updateTrainingPlanDay(id, dayId, payload)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation({ force: true })
    return detail
  }

  async function deleteDay(id: number, dayId: number) {
    const detail = await deleteTrainingPlanDay(id, dayId)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation({ force: true })
    return detail
  }

  async function loadRecommendation(options?: { force?: boolean }) {
    if (!options?.force && recommendationPromise) {
      await recommendationPromise
      return
    }

    const requestEpoch = ++recommendationRequestEpoch
    const requestStateEpoch = stateEpoch
    const request = (async () => {
      const nextRecommendation = await fetchTodayPlanRecommendation()
      if (requestStateEpoch !== stateEpoch || requestEpoch !== recommendationRequestEpoch) return
      recommendation.value = nextRecommendation
    })()
    recommendationPromise = request

    try {
      await request
    } catch (err) {
      if (requestStateEpoch === stateEpoch && requestEpoch === recommendationRequestEpoch) {
        recommendation.value = null
      }
      console.error('[plan] recommendation fetch failed', err)
    } finally {
      if (recommendationPromise === request) recommendationPromise = null
    }
  }

  function clearPersonalPlanState() {
    invalidatePendingRequests()
    items.value = []
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
