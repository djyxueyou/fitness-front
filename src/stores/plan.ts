import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  activateRecommendedPlan,
  activateTrainingPlan,
  copyTrainingPlan,
  createTrainingPlan,
  createTrainingPlanDay,
  deactivateActiveTrainingPlan,
  deleteTrainingPlan,
  deleteTrainingPlanDay,
  fetchActivePlanExecution,
  fetchRecommendedPlanIntro,
  fetchRecommendedPlans,
  fetchTodayPlanRecommendation,
  fetchTrainingPlanDetail,
  fetchTrainingPlans,
  previewRecommendedPlan,
  updateTrainingPlan,
  updateTrainingPlanDay,
  type ActiveExecutionResponse,
  type ActivePlanSummaryResponse,
  type CreateTrainingPlanDayRequest,
  type CreateTrainingPlanRequest,
  type PlanRecommendationResponse,
  type RecommendedPlanIntroResponse,
  type RecommendedPlanListItemResponse,
  type RecommendedPlanPersonalizationRequest,
  type RecommendedPlanPreviewResponse,
  type TrainingPlanDetailResponse,
  type TrainingPlanListItemResponse,
  type UpdateTrainingPlanDayRequest,
  type UpdateTrainingPlanRequest
} from '@/api/plan'

const PLAN_CACHE_MS = 30000

export const usePlanStore = defineStore('plan', () => {
  const items = ref<TrainingPlanListItemResponse[]>([])
  const recommendedPlans = ref<RecommendedPlanListItemResponse[]>([])
  const detailCache = ref<Record<number, TrainingPlanDetailResponse>>({})
  const recommendedIntroCache = ref<Record<number, RecommendedPlanIntroResponse>>({})
  const activeExecution = ref<ActiveExecutionResponse | null>(null)
  const recommendation = ref<PlanRecommendationResponse | null>(null)
  const loading = ref(false)
  const loadedAt = ref(0)
  const listError = ref('')
  let fetchPromise: Promise<void> | null = null

  const systemPlans = computed(() => items.value.filter((item) => item.planType === 'SYSTEM'))
  const userPlans = computed(() => items.value.filter((item) => item.planType !== 'SYSTEM'))
  const activePlan = computed(() => items.value.find((item) => item.active) || null)

  async function fetchPlans(options?: { force?: boolean }) {
    const cacheUsable =
      !options?.force && items.value.length > 0 && Date.now() - loadedAt.value < PLAN_CACHE_MS
    if (cacheUsable) return
    if (fetchPromise) {
      await fetchPromise
      return
    }

    loading.value = true
    listError.value = ''
    fetchPromise = (async () => {
      const [recommended, legacyPlans] = await Promise.all([
        fetchRecommendedPlans(),
        fetchTrainingPlans('all')
      ])
      recommendedPlans.value = recommended
      items.value = legacyPlans
      loadedAt.value = Date.now()
    })()

    try {
      await fetchPromise
    } catch (err) {
      listError.value = '训练计划加载失败，请稍后重试'
      console.error('[plan] fetch plans failed', err)
    } finally {
      fetchPromise = null
      loading.value = false
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

  async function getRecommendedIntro(id: number, force = false) {
    if (!force && recommendedIntroCache.value[id]) return recommendedIntroCache.value[id]
    const intro = await fetchRecommendedPlanIntro(id)
    recommendedIntroCache.value = {
      ...recommendedIntroCache.value,
      [id]: intro
    }
    return intro
  }

  async function previewRecommended(
    id: number,
    payload: RecommendedPlanPersonalizationRequest
  ): Promise<RecommendedPlanPreviewResponse> {
    return previewRecommendedPlan(id, payload)
  }

  async function activateRecommended(
    id: number,
    payload: RecommendedPlanPersonalizationRequest
  ): Promise<ActivePlanSummaryResponse> {
    const summary = await activateRecommendedPlan(id, payload)
    await loadActiveExecution()
    await fetchPlans({ force: true })
    await loadRecommendation()
    return summary
  }

  async function loadActiveExecution() {
    try {
      const execution = await fetchActivePlanExecution()
      activeExecution.value = execution && 'executionId' in execution ? execution : null
    } catch (err) {
      activeExecution.value = null
      console.error('[plan] active execution fetch failed', err)
    }
    return activeExecution.value
  }

  async function activate(id: number, mode: 'THIS_WEEK' | 'NEXT_WEEK' = 'THIS_WEEK') {
    await activateTrainingPlan(id, mode)
    await fetchPlans({ force: true })
    const cached = detailCache.value[id]
    if (cached) {
      detailCache.value = {
        ...detailCache.value,
        [id]: { ...cached, active: true }
      }
    }
    await loadRecommendation()
  }

  async function createPlan(payload: CreateTrainingPlanRequest) {
    const detail = await createTrainingPlan(payload)
    detailCache.value = { ...detailCache.value, [detail.id]: detail }
    await fetchPlans({ force: true })
    return detail
  }

  async function deactivateActive() {
    await deactivateActiveTrainingPlan()
    activeExecution.value = null
    detailCache.value = Object.fromEntries(
      Object.entries(detailCache.value).map(([id, detail]) => [id, { ...detail, active: false }])
    )
    await fetchPlans({ force: true })
    await loadRecommendation()
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
    await loadRecommendation()
    return detail
  }

  async function removePlan(id: number) {
    await deleteTrainingPlan(id)
    const nextCache = { ...detailCache.value }
    delete nextCache[id]
    detailCache.value = nextCache
    await fetchPlans({ force: true })
    await loadRecommendation()
  }

  async function createDay(id: number, payload: CreateTrainingPlanDayRequest) {
    const detail = await createTrainingPlanDay(id, payload)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation()
    return detail
  }

  async function updateDay(id: number, dayId: number, payload: UpdateTrainingPlanDayRequest) {
    const detail = await updateTrainingPlanDay(id, dayId, payload)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation()
    return detail
  }

  async function deleteDay(id: number, dayId: number) {
    const detail = await deleteTrainingPlanDay(id, dayId)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    await loadRecommendation()
    return detail
  }

  async function loadRecommendation() {
    try {
      recommendation.value = await fetchTodayPlanRecommendation()
    } catch (err) {
      recommendation.value = null
      console.error('[plan] recommendation fetch failed', err)
    }
  }

  return {
    items,
    recommendedPlans,
    systemPlans,
    userPlans,
    activePlan,
    activeExecution,
    recommendation,
    loading,
    listError,
    fetchPlans,
    getDetail,
    getRecommendedIntro,
    previewRecommended,
    activateRecommended,
    loadActiveExecution,
    activate,
    createPlan,
    deactivateActive,
    duplicate,
    updatePlan,
    removePlan,
    createDay,
    updateDay,
    deleteDay,
    loadRecommendation
  }
})
