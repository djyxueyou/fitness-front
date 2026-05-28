import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createCustomExercise,
  type CreateCustomExerciseRequest,
  deleteCustomExercise,
  favoriteExercise,
  fetchExerciseCategories,
  fetchExerciseDetail,
  fetchExerciseList,
  fetchFavoriteExercises,
  type UpdateCustomExerciseRequest,
  updateCustomExercise,
  unfavoriteExercise
} from '@/api/exercise'
import { getToken } from '@/api/http'
import type { Exercise, ExerciseDetail } from '@/types/exercise'

const PAGE_SIZE = 6

interface ListCacheEntry {
  items: Exercise[]
  pageNo: number
  total: number
  hasMore: boolean
}

function toLevelText(level: string): string {
  switch (level) {
    case 'BEGINNER':
      return '初级'
    case 'INTERMEDIATE':
      return '中级'
    case 'ADVANCED':
      return '高级'
    default:
      return level || '未知'
  }
}

function normalizeSummary(item: import('@/api/exercise').ExerciseSummary): Exercise {
  return {
    id: item.id,
    name: item.name,
    category: item.categoryName,
    muscle: item.primaryMuscle || '-',
    equipment: item.equipment || '-',
    level: toLevelText(item.difficultyLevel),
    recordType: item.recordType || 'WEIGHT_REPS',
    exerciseType: item.exerciseType || 'SYSTEM',
    thumbnailUrl: item.thumbnailUrl || item.thumbnailPath
  }
}

function normalizeDetail(item: import('@/api/exercise').ExerciseDetail): ExerciseDetail {
  return {
    ...normalizeSummary(item),
    instructionText: item.instructionText,
    commonMistakesText: item.commonMistakesText,
    checklistText: item.checklistText,
    mediaUrl: item.mediaUrl || item.mediaPath,
    mediaSizeBytes: item.mediaSizeBytes,
    mediaWidth: item.mediaWidth,
    mediaHeight: item.mediaHeight
  }
}

function dedupeById<T extends Exercise>(list: T[]) {
  const map = new Map<number, T>()
  list.forEach((item) => {
    map.set(item.id, item)
  })
  return Array.from(map.values())
}

export const useExerciseStore = defineStore('exercise', () => {
  const items = ref<Exercise[]>([])
  const categories = ref<string[]>(['全部'])
  const categoryOptions = ref<Array<{ code: string; name: string }>>([{ code: '', name: '全部' }])
  const detailCache = ref<Record<number, ExerciseDetail>>({})
  const listCache = ref<Record<string, ListCacheEntry>>({})
  const activeCategoryCode = ref('')
  const activeKeyword = ref('')
  const activeScope = ref<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL')
  const pageNo = ref(0)
  const total = ref(0)
  const hasMore = ref(true)
  const loading = ref(false)
  const listError = ref('')
  const loadedFromServer = ref(false)
  const favoriteIds = ref<Set<number>>(new Set())
  const favoriteItems = ref<Exercise[]>([])

  const favorites = computed(() => favoriteItems.value)

  function queryKey(
    categoryCode = activeCategoryCode.value,
    keyword = activeKeyword.value,
    scope = activeScope.value
  ) {
    return `${scope}::${categoryCode || 'all'}::${keyword.trim()}`
  }

  async function fetchCategories() {
    try {
      const data = await fetchExerciseCategories()
      categoryOptions.value = [
        { code: '', name: '全部' },
        ...data.map((item) => ({ code: item.categoryCode, name: item.categoryName }))
      ]
      categories.value = categoryOptions.value.map((item) => item.name)
    } catch (err) {
      console.error('[exercise] fetch categories failed', err)
      categories.value = ['全部', ...Array.from(new Set(items.value.map((item) => item.category)))]
      categoryOptions.value = categories.value.map((name) => ({
        code: name === '全部' ? '' : name,
        name
      }))
    }
  }

  async function fetchExercises(options?: {
    reset?: boolean
    force?: boolean
    categoryCode?: string
    keyword?: string
    scope?: 'ALL' | 'SYSTEM' | 'CUSTOM'
  }) {
    const reset = options?.reset ?? false
    const force = options?.force ?? false
    const categoryCode = options?.categoryCode ?? activeCategoryCode.value
    const keyword = options?.keyword ?? activeKeyword.value
    const scope = options?.scope ?? activeScope.value
    const key = queryKey(categoryCode, keyword, scope)

    activeCategoryCode.value = categoryCode
    activeKeyword.value = keyword
    activeScope.value = scope

    if (reset && !force && listCache.value[key]) {
      const cached = listCache.value[key]
      items.value = applyFavoriteState(cached.items)
      pageNo.value = cached.pageNo
      total.value = cached.total
      hasMore.value = cached.hasMore
      loadedFromServer.value = true
      return
    }

    if (loading.value || (!reset && !hasMore.value)) {
      return
    }

    loading.value = true
    listError.value = ''
    try {
      const nextPageNo = reset ? 1 : pageNo.value + 1
      const page = await fetchExerciseList({
        pageNo: nextPageNo,
        pageSize: PAGE_SIZE,
        categoryCode: categoryCode || undefined,
        keyword: keyword.trim() || undefined,
        scope
      })
      await fetchFavoriteIdSet()
      const nextItems = page.list.map(normalizeSummary)
      const baseItems = reset
        ? dedupeById(nextItems)
        : dedupeById([...stripFavoriteState(items.value), ...nextItems])
      items.value = applyFavoriteState(baseItems)
      pageNo.value = page.pageNo
      total.value = page.total
      hasMore.value = items.value.length < page.total
      loadedFromServer.value = true
      listCache.value[key] = {
        items: baseItems,
        pageNo: pageNo.value,
        total: total.value,
        hasMore: hasMore.value
      }
    } catch (err) {
      console.error('[exercise] fetch failed', err)
      listError.value = '动作加载失败，请稍后重试'
      loadedFromServer.value = false
      if (reset) {
        items.value = []
        total.value = 0
        hasMore.value = false
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    const cached = detailCache.value[id]
    if (cached) return withFavoriteState(cached)

    const serverDetail = normalizeDetail(await fetchExerciseDetail(id))
    const favoriteIdSet = await fetchFavoriteIdSet()
    const detail = {
      ...serverDetail,
      favorited: favoriteIdSet.has(id)
    }
    detailCache.value = {
      ...detailCache.value,
      [id]: stripFavoriteState([detail])[0] as ExerciseDetail
    }
    upsertListItem(detail)
    return detail
  }

  async function toggleFavorite(id: number) {
    const target = findCachedExercise(id)
    if (!target) return

    await setFavorite(id, !target.favorited)
  }

  async function setFavorite(id: number, favorited: boolean) {
    const target = findCachedExercise(id)
    const before = !!target?.favorited

    if (before === favorited) {
      return
    }

    setFavoriteState(id, favorited)
    try {
      if (favorited) {
        await favoriteExercise(id)
      } else {
        await unfavoriteExercise(id)
      }
    } catch (err) {
      setFavoriteState(id, before)
      uni.showToast({
        title: '收藏操作失败',
        icon: 'none'
      })
      console.error('[exercise] favorite failed', err)
      return
    }

    try {
      await refreshFavoriteStates()
    } catch (err) {
      console.error('[exercise] refresh favorites failed', err)
    }
  }

  async function refreshFavoriteStates() {
    if (!getToken()) {
      favoriteIds.value = new Set()
      favoriteItems.value = []
      items.value = applyFavoriteState(stripFavoriteState(items.value))
      return
    }

    const favoriteSummaries = await fetchFavoriteExercises()
    const favoriteIdSet = new Set(favoriteSummaries.map((item) => item.id))
    favoriteIds.value = favoriteIdSet
    favoriteItems.value = favoriteSummaries.map((item) => ({
      ...normalizeSummary(item),
      favorited: true
    }))
    items.value = applyFavoriteState(stripFavoriteState(items.value))
  }

  function applyFavoriteState<T extends Exercise>(list: T[]) {
    return list.map((item) => ({
      ...item,
      favorited: favoriteIds.value.has(item.id)
    }))
  }

  function stripFavoriteState<T extends Exercise>(list: T[]) {
    return list.map((item) => {
      const { favorited: _favorited, ...baseItem } = item
      return baseItem as T
    })
  }

  function setFavoriteState(id: number, favorited: boolean) {
    const nextFavoriteIds = new Set(favoriteIds.value)
    if (favorited) {
      nextFavoriteIds.add(id)
    } else {
      nextFavoriteIds.delete(id)
    }
    favoriteIds.value = nextFavoriteIds
    items.value = applyFavoriteState(stripFavoriteState(items.value))
    syncFavoriteItem(id, favorited)
  }

  function syncFavoriteItem(id: number, favorited: boolean) {
    if (!favorited) {
      favoriteItems.value = favoriteItems.value.filter((item) => item.id !== id)
      return
    }

    const target =
      withFavoriteState(detailCache.value[id]) ??
      items.value.find((item) => item.id === id) ??
      favoriteItems.value.find((item) => item.id === id)
    if (!target) {
      return
    }

    const nextItem = { ...target, favorited: true }
    const exists = favoriteItems.value.some((item) => item.id === id)
    favoriteItems.value = exists
      ? favoriteItems.value.map((item) => (item.id === id ? nextItem : item))
      : [nextItem, ...favoriteItems.value]
  }

  function upsertListItem(detail: ExerciseDetail) {
    if (!items.value.some((item) => item.id === detail.id)) {
      return
    }
    items.value = items.value.map((item) =>
      item.id === detail.id
        ? { ...item, ...detail, favorited: favoriteIds.value.has(detail.id) }
        : item
    )
    for (const [key, entry] of Object.entries(listCache.value)) {
      listCache.value[key] = {
        ...entry,
        items: entry.items.map((item) =>
          item.id === detail.id ? stripFavoriteState([{ ...item, ...detail }])[0] : item
        )
      }
    }
  }

  function clearListCache() {
    listCache.value = {}
    listError.value = ''
  }

  function getById(id: number) {
    return findCachedExercise(id)
  }

  async function createCustom(payload: CreateCustomExerciseRequest) {
    const result = await createCustomExercise(payload)
    clearListCache()
    detailCache.value = {}
    await fetchExercises({ reset: true, force: true, scope: 'CUSTOM' })
    return result
  }

  async function updateCustom(id: number, payload: UpdateCustomExerciseRequest) {
    await updateCustomExercise(id, payload)
    clearListCache()
    detailCache.value = {}
    await fetchExercises({ reset: true, force: true, scope: 'CUSTOM' })
  }

  async function deleteCustom(id: number) {
    await deleteCustomExercise(id)
    clearListCache()
    detailCache.value = Object.fromEntries(
      Object.entries(detailCache.value).filter(([key]) => Number(key) !== id)
    )
    items.value = items.value.filter((item) => item.id !== id)
    favoriteItems.value = favoriteItems.value.filter((item) => item.id !== id)
    const nextFavoriteIds = new Set(favoriteIds.value)
    nextFavoriteIds.delete(id)
    favoriteIds.value = nextFavoriteIds
    await fetchExercises({ reset: true, force: true, scope: 'CUSTOM' })
  }

  function findCachedExercise(id: number) {
    return (
      withFavoriteState(detailCache.value[id]) ??
      items.value.find((item) => item.id === id) ??
      favoriteItems.value.find((item) => item.id === id)
    )
  }

  async function fetchFavoriteIdSet() {
    if (!getToken()) {
      favoriteIds.value = new Set()
      return favoriteIds.value
    }
    try {
      const favorites = await fetchFavoriteExercises()
      favoriteIds.value = new Set(favorites.map((item) => item.id))
      favoriteItems.value = favorites.map((item) => ({
        ...normalizeSummary(item),
        favorited: true
      }))
      return favoriteIds.value
    } catch (err) {
      console.error('[exercise] fetch favorites failed', err)
      return favoriteIds.value
    }
  }

  function withFavoriteState<T extends Exercise | undefined>(item: T): T {
    if (!item) return item
    return {
      ...item,
      favorited: favoriteIds.value.has(item.id)
    }
  }

  return {
    items,
    categories,
    categoryOptions,
    favorites,
    pageNo,
    total,
    hasMore,
    loading,
    listError,
    loadedFromServer,
    fetchCategories,
    fetchExercises,
    fetchDetail,
    refreshFavoriteStates,
    clearListCache,
    setFavorite,
    toggleFavorite,
    createCustom,
    updateCustom,
    deleteCustom,
    getById
  }
})
