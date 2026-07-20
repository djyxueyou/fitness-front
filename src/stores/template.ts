import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  copyTemplate,
  createTemplate,
  createTemplateFromTraining,
  deleteTemplate,
  fetchTemplateDetail,
  fetchTemplateList,
  updateTemplate,
  type TemplateDetailResponse,
  type UpsertTemplateItemRequest,
  type UpsertTemplateRequest
} from '@/api/template'
import { fetchExerciseList } from '@/api/exercise'
import type { TrainingHistoryItemResponse } from '@/api/training'
import type { Template } from '@/types/template'

const RECENT_TEMPLATE_IDS_KEY = 'LIFTLOG_RECENT_TEMPLATE_IDS'
const TEMPLATE_CACHE_MS = 30000

const USER_TEMPLATE_TAGS = ['PUSH', 'PULL', 'LEGS', 'FULL', 'UPPER', 'LOWER']
const TEMPLATE_COLORS = [
  'rgba(255, 80, 30, 0.16)',
  'rgba(80, 200, 255, 0.16)',
  'rgba(255, 200, 80, 0.16)',
  'rgba(80, 220, 180, 0.16)'
]
const TEMPLATE_ACCENTS = ['#ff501e', '#50c8ff', '#ffc850', '#3dd9a2']

function getRecentTemplateIds() {
  const value = uni.getStorageSync(RECENT_TEMPLATE_IDS_KEY) as number[] | undefined
  return Array.isArray(value) ? value : []
}

function setRecentTemplateIds(ids: number[]) {
  uni.setStorageSync(RECENT_TEMPLATE_IDS_KEY, ids)
}

function toTemplate(detail: TemplateDetailResponse, index: number): Template {
  const exercises = detail.items.length
  const isSystem = detail.templateType === 'SYSTEM'
  const coverItem =
    detail.items.find((item) => item.thumbnailUrl || item.thumbnailPath) || detail.items[0]
  return {
    id: detail.id,
    name: detail.name,
    templateType: detail.templateType,
    description: detail.description,
    tag: isSystem ? 'SYS' : USER_TEMPLATE_TAGS[index % USER_TEMPLATE_TAGS.length] || 'PLAN',
    exercises,
    duration: Math.max(25, exercises * 10),
    level: exercises >= 7 ? '高级' : exercises >= 4 ? '中级' : '初级',
    muscles: detail.description
      ? [detail.description]
      : detail.items.slice(0, 4).map((item) => item.exerciseName),
    color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
    accent: TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length],
    coverUrl: coverItem?.thumbnailUrl || coverItem?.thumbnailPath,
    coverRecordType: coverItem?.recordType
  }
}

export const useTemplateStore = defineStore('template', () => {
  const items = ref<Template[]>([])
  const loading = ref(false)
  const loadedFromServer = ref(false)
  const listError = ref('')
  const loadedAt = ref(0)
  const detailsLoaded = ref(false)
  const detailCache = ref<Record<number, TemplateDetailResponse>>({})
  const recentIds = ref<number[]>(getRecentTemplateIds())
  let fetchPromise: Promise<void> | null = null
  let sessionGeneration = 0
  let fetchGeneration = 0

  const userItems = computed(() => items.value.filter((item) => item.templateType !== 'SYSTEM'))
  const systemItems = computed(() => items.value.filter((item) => item.templateType === 'SYSTEM'))
  const recentItems = computed(() =>
    recentIds.value
      .map((id) => items.value.find((item) => item.id === id))
      .filter((item): item is Template => Boolean(item))
  )

  function getRecentItemsFromHistory(history: TrainingHistoryItemResponse[], limit = 3) {
    const localItems = recentItems.value
    const localIdSet = new Set(localItems.map((item) => item.id))
    const historyIdSet = new Set<number>()
    const historyItems = history
      .map((record) => (record.templateId ? getById(record.templateId) : undefined))
      .filter((item): item is Template => {
        if (!item || localIdSet.has(item.id) || historyIdSet.has(item.id)) return false
        historyIdSet.add(item.id)
        return true
      })
    return [...localItems, ...historyItems].slice(0, limit)
  }

  function pruneRecentIds(shouldCommit?: () => boolean) {
    if (shouldCommit && !shouldCommit()) return
    const validIds = new Set(items.value.map((item) => item.id))
    const next = recentIds.value.filter((id) => validIds.has(id))
    if (next.length === recentIds.value.length) return
    if (shouldCommit && !shouldCommit()) return
    recentIds.value = next
    setRecentTemplateIds(next)
  }

  function markUsed(id: number) {
    if (!id) return
    const next = [id, ...recentIds.value.filter((itemId) => itemId !== id)].slice(0, 6)
    recentIds.value = next
    setRecentTemplateIds(next)
  }

  function getById(id: number | null) {
    return items.value.find((item) => item.id === id)
  }

  function upsertDetail(detail: TemplateDetailResponse) {
    listError.value = ''
    detailCache.value = { ...detailCache.value, [detail.id]: detail }
    const next = toTemplate(detail, 0)
    items.value = [next, ...items.value.filter((item) => item.id !== detail.id)]
    loadedFromServer.value = true
    loadedAt.value = Date.now()
  }

  function invalidateTemplateReads() {
    fetchGeneration += 1
    fetchPromise = null
    loading.value = false
  }

  function commitWrite(detail: TemplateDetailResponse, mutationSession: number) {
    if (sessionGeneration !== mutationSession) return
    invalidateTemplateReads()
    upsertDetail(detail)
  }

  function invalidateSession() {
    sessionGeneration += 1
    invalidateTemplateReads()
    items.value = []
    detailCache.value = {}
    recentIds.value = []
    setRecentTemplateIds([])
    loadedFromServer.value = false
    detailsLoaded.value = false
    loadedAt.value = 0
    listError.value = ''
  }

  async function fetchTemplates(options?: {
    includeDetails?: boolean
    force?: boolean
    shouldCommit?: () => boolean
  }) {
    const includeDetails = options?.includeDetails ?? true
    const shouldCommit = options?.shouldCommit || (() => true)
    const cacheUsable =
      !options?.force &&
      loadedFromServer.value &&
      Date.now() - loadedAt.value < TEMPLATE_CACHE_MS &&
      (!includeDetails || detailsLoaded.value)
    if (cacheUsable) return
    const requestSession = sessionGeneration
    const requestGeneration = fetchGeneration
    if (fetchPromise) {
      const pendingFetch = fetchPromise
      await pendingFetch
      if (
        sessionGeneration !== requestSession ||
        fetchGeneration !== requestGeneration ||
        !shouldCommit()
      ) {
        return
      }
      return fetchTemplates(options)
    }

    const canCommit = () =>
      sessionGeneration === requestSession &&
      fetchGeneration === requestGeneration &&
      shouldCommit()
    if (!canCommit()) return

    loading.value = true
    listError.value = ''
    let pendingFetch: Promise<void>
    pendingFetch = (async () => {
      const list = await fetchTemplateList()
      if (!includeDetails) {
        if (!canCommit()) return
        items.value = list.map((item, index) => ({
          id: item.id,
          name: item.name,
          templateType: item.templateType,
          description: item.description,
          tag:
            item.templateType === 'SYSTEM'
              ? 'SYS'
              : USER_TEMPLATE_TAGS[index % USER_TEMPLATE_TAGS.length] || 'PLAN',
          exercises: item.exerciseCount,
          duration: Math.max(25, item.exerciseCount * 10),
          level: item.exerciseCount >= 7 ? '高级' : item.exerciseCount >= 4 ? '中级' : '初级',
          muscles: item.description ? [item.description] : [],
          color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
          accent: TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length],
          coverUrl: item.coverUrl,
          coverRecordType: item.coverRecordType
        }))
        if (!canCommit()) return
        pruneRecentIds(canCommit)
        if (!canCommit()) return
        loadedFromServer.value = true
        if (!canCommit()) return
        loadedAt.value = Date.now()
        return
      }

      const details = await Promise.all(list.map((item) => fetchTemplateDetail(item.id)))
      const cache: Record<number, TemplateDetailResponse> = {}
      details.forEach((detail) => {
        cache[detail.id] = detail
      })
      if (!canCommit()) return
      detailCache.value = cache
      if (!canCommit()) return
      items.value = details.map((detail, index) => toTemplate(detail, index))
      if (!canCommit()) return
      pruneRecentIds(canCommit)
      if (!canCommit()) return
      loadedFromServer.value = true
      if (!canCommit()) return
      detailsLoaded.value = true
      if (!canCommit()) return
      loadedAt.value = Date.now()
    })()
    fetchPromise = pendingFetch

    try {
      await pendingFetch
    } catch (err) {
      if (canCommit()) {
        loadedFromServer.value = false
        listError.value = '模板加载失败，请稍后重试'
      }
      console.error('[template] fetch failed', err)
    } finally {
      if (fetchPromise === pendingFetch) {
        fetchPromise = null
        loading.value = false
      }
    }
  }

  async function getDetail(id: number) {
    const cached = detailCache.value[id]
    if (cached) return cached
    const detailSession = sessionGeneration
    const detailGeneration = fetchGeneration
    const detail = await fetchTemplateDetail(id)
    if (sessionGeneration === detailSession && fetchGeneration === detailGeneration) {
      detailCache.value = {
        ...detailCache.value,
        [id]: detail
      }
    }
    return detail
  }

  async function rename(id: number, name: string) {
    const detail = await getDetail(id)
    if (detail.templateType === 'SYSTEM') return
    const payload = {
      name,
      items: detail.items.map<UpsertTemplateItemRequest>((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetWeightKg: item.targetWeightKg,
        targetReps: item.targetReps,
        targetDurationSeconds: item.targetDurationSeconds,
        restSeconds: item.restSeconds
      }))
    }
    return save(payload, id)
  }

  async function save(payload: UpsertTemplateRequest, id?: number) {
    const mutationSession = sessionGeneration
    const detail = id ? await updateTemplate(id, payload) : await createTemplate(payload)
    commitWrite(detail, mutationSession)
    return detail
  }

  async function remove(id: number) {
    const detail = await getDetail(id)
    if (detail.templateType === 'SYSTEM') return
    await deleteTemplate(id)
    recentIds.value = recentIds.value.filter((itemId) => itemId !== id)
    setRecentTemplateIds(recentIds.value)
    await fetchTemplates({ force: true })
  }

  async function duplicate(id: number) {
    const mutationSession = sessionGeneration
    const detail = await copyTemplate(id)
    commitWrite(detail, mutationSession)
    return detail
  }

  async function saveFromTraining(trainingId: number, name?: string) {
    const mutationSession = sessionGeneration
    const detail = await createTemplateFromTraining(trainingId, name)
    commitWrite(detail, mutationSession)
    return detail
  }

  async function saveFromPlan(name: string, items: UpsertTemplateItemRequest[]) {
    return save({ name, items })
  }

  async function createDefaultTemplate() {
    const page = await fetchExerciseList({ pageNo: 1, pageSize: 3 })
    const sourceItems = page.list.slice(0, 3)
    if (!sourceItems.length) {
      throw new Error('动作库为空，无法新建模板')
    }
    return save({
      name: `新模板 ${new Date().toLocaleTimeString()}`,
      items: sourceItems.map((item) => ({
        exerciseId: item.id,
        targetSets: 3,
        targetWeightKg: item.recordType === 'WEIGHT_REPS' ? 20 : undefined,
        targetReps: item.recordType !== 'DURATION' ? 10 : undefined,
        targetDurationSeconds: item.recordType === 'DURATION' ? 60 : undefined
      }))
    })
  }

  return {
    items,
    userItems,
    systemItems,
    loading,
    loadedFromServer,
    listError,
    recentItems,
    getRecentItemsFromHistory,
    fetchTemplates,
    invalidateSession,
    markUsed,
    getById,
    getDetail,
    save,
    rename,
    remove,
    duplicate,
    saveFromTraining,
    saveFromPlan,
    createDefaultTemplate
  }
})
