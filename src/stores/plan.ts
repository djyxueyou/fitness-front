import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  activateTrainingPlan,
  copyTrainingPlan,
  createTrainingPlan,
  createTrainingPlanDay,
  deactivateActiveTrainingPlan,
  deleteTrainingPlan,
  deleteTrainingPlanDay,
  fetchTodayPlanRecommendation,
  fetchTrainingPlanDetail,
  fetchTrainingPlans,
  updateTrainingPlan,
  updateTrainingPlanDay,
  type CreateTrainingPlanDayRequest,
  type CreateTrainingPlanRequest,
  type PlanRecommendationResponse,
  type TrainingPlanDetailResponse,
  type TrainingPlanListItemResponse,
  type UpdateTrainingPlanDayRequest,
  type UpdateTrainingPlanRequest
} from '@/api/plan'

const PLAN_CACHE_MS = 30000

export const usePlanStore = defineStore('plan', () => {
  const items = ref<TrainingPlanListItemResponse[]>([])
  const detailCache = ref<Record<number, TrainingPlanDetailResponse>>({})
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
      items.value = await fetchTrainingPlans('all')
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
    systemPlans,
    userPlans,
    activePlan,
    recommendation,
    loading,
    listError,
    fetchPlans,
    getDetail,
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
