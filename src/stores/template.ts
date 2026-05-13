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
  type UpsertTemplateItemRequest
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
    accent: TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length]
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

  function pruneRecentIds() {
    const validIds = new Set(items.value.map((item) => item.id))
    const next = recentIds.value.filter((id) => validIds.has(id))
    if (next.length === recentIds.value.length) return
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

  async function fetchTemplates(options?: { includeDetails?: boolean; force?: boolean }) {
    const includeDetails = options?.includeDetails ?? true
    const cacheUsable =
      !options?.force &&
      loadedFromServer.value &&
      Date.now() - loadedAt.value < TEMPLATE_CACHE_MS &&
      (!includeDetails || detailsLoaded.value)
    if (cacheUsable) return
    if (fetchPromise) {
      await fetchPromise
      return
    }

    loading.value = true
    listError.value = ''
    fetchPromise = (async () => {
      const list = await fetchTemplateList()
      if (!includeDetails) {
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
          accent: TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length]
        }))
        pruneRecentIds()
        loadedFromServer.value = true
        loadedAt.value = Date.now()
        return
      }

      const details = await Promise.all(list.map((item) => fetchTemplateDetail(item.id)))
      const cache: Record<number, TemplateDetailResponse> = {}
      details.forEach((detail) => {
        cache[detail.id] = detail
      })
      detailCache.value = cache
      items.value = details.map((detail, index) => toTemplate(detail, index))
      pruneRecentIds()
      loadedFromServer.value = true
      detailsLoaded.value = true
      loadedAt.value = Date.now()
    })()

    try {
      await fetchPromise
    } catch (err) {
      loadedFromServer.value = false
      listError.value = '模板加载失败，请稍后重试'
      console.error('[template] fetch failed', err)
    } finally {
      fetchPromise = null
      loading.value = false
    }
  }

  async function getDetail(id: number) {
    const cached = detailCache.value[id]
    if (cached) return cached
    const detail = await fetchTemplateDetail(id)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
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
        targetSets: item.targetSets
      }))
    }
    await updateTemplate(id, payload)
    await fetchTemplates({ force: true })
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
    await copyTemplate(id)
    await fetchTemplates({ force: true })
  }

  async function saveFromTraining(trainingId: number, name?: string) {
    const result = await createTemplateFromTraining(trainingId, name)
    detailCache.value = {}
    detailsLoaded.value = false
    await fetchTemplates({ force: true })
    return result
  }

  async function saveFromPlan(name: string, items: UpsertTemplateItemRequest[]) {
    const result = await createTemplate({ name, items })
    detailCache.value = {}
    detailsLoaded.value = false
    await fetchTemplates({ force: true })
    return result
  }

  async function createDefaultTemplate() {
    const page = await fetchExerciseList({ pageNo: 1, pageSize: 3 })
    const sourceItems = page.list.slice(0, 3)
    if (!sourceItems.length) {
      throw new Error('动作库为空，无法新建模板')
    }
    await createTemplate({
      name: `新模板 ${new Date().toLocaleTimeString()}`,
      items: sourceItems.map((item) => ({
        exerciseId: item.id,
        targetSets: 3
      }))
    })
    await fetchTemplates({ force: true })
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
    markUsed,
    getById,
    getDetail,
    rename,
    remove,
    duplicate,
    saveFromTraining,
    saveFromPlan,
    createDefaultTemplate
  }
})
