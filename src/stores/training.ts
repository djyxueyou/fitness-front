import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchTrainingCalendar,
  fetchTrainingDetail,
  fetchTrainingHistory,
  type TrainingCalendarDayResponse,
  type TrainingDetailResponse,
  type TrainingHistoryItemResponse
} from '@/api/training'

export const useTrainingStore = defineStore('training', () => {
  const HISTORY_PAGE_SIZE = 20
  const history = ref<TrainingHistoryItemResponse[]>([])
  const historyTotal = ref(0)
  const historyPageNo = ref(0)
  const loading = ref(false)
  const historyError = ref('')
  const detailCache = ref<Record<number, TrainingDetailResponse>>({})
  const calendarDays = ref<TrainingCalendarDayResponse[]>([])
  const historyHasMore = computed(() => history.value.length < historyTotal.value)

  const historyById = computed(() => {
    const map: Record<number, TrainingHistoryItemResponse> = {}
    history.value.forEach((item) => {
      map[item.id] = item
    })
    return map
  })

  async function fetchHistory(options?: {
    reset?: boolean
    startedFrom?: string
    startedTo?: string
  }) {
    if (loading.value) return
    loading.value = true
    historyError.value = ''
    try {
      const pageNo = options?.reset ? 1 : historyPageNo.value + 1
      const page = await fetchTrainingHistory({
        pageNo,
        pageSize: HISTORY_PAGE_SIZE,
        startedFrom: options?.startedFrom,
        startedTo: options?.startedTo
      })
      historyTotal.value = page.total
      historyPageNo.value = page.pageNo
      history.value = options?.reset ? page.list : [...history.value, ...page.list]
    } catch (err) {
      console.error('[training] fetch history failed', err)
      historyError.value = '训练记录加载失败，请稍后重试'
      if (options?.reset) {
        history.value = []
        historyTotal.value = 0
        historyPageNo.value = 0
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchCalendar(year: number, month: number) {
    try {
      calendarDays.value = await fetchTrainingCalendar({ year, month })
    } catch (err) {
      console.error('[training] fetch calendar failed', err)
      calendarDays.value = []
    }
  }

  async function fetchDetail(id: number) {
    if (detailCache.value[id]) {
      return detailCache.value[id]
    }
    const detail = await fetchTrainingDetail(id)
    detailCache.value = {
      ...detailCache.value,
      [id]: detail
    }
    return detail
  }

  async function deleteTraining(id: number) {
    const { deleteTraining: deleteApi } = await import('@/api/training')
    await deleteApi(id)
    history.value = history.value.filter((item) => item.id !== id)
    historyTotal.value = Math.max(0, historyTotal.value - 1)
    calendarDays.value = [] // Invalidate calendar
  }

  function invalidateCache() {
    history.value = []
    historyTotal.value = 0
    historyPageNo.value = 0
    historyError.value = ''
    detailCache.value = {}
    calendarDays.value = []
  }

  return {
    history,
    historyTotal,
    historyHasMore,
    loading,
    historyError,
    historyById,
    calendarDays,
    fetchHistory,
    fetchCalendar,
    fetchDetail,
    deleteTraining,
    invalidateCache
  }
})
