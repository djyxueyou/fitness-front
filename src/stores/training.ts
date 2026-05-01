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
  const history = ref<TrainingHistoryItemResponse[]>([])
  const loading = ref(false)
  const detailCache = ref<Record<number, TrainingDetailResponse>>({})
  const calendarDays = ref<TrainingCalendarDayResponse[]>([])

  const historyById = computed(() => {
    const map: Record<number, TrainingHistoryItemResponse> = {}
    history.value.forEach((item) => {
      map[item.id] = item
    })
    return map
  })

  async function fetchHistory() {
    loading.value = true
    try {
      const page = await fetchTrainingHistory({ pageNo: 1, pageSize: 200 })
      history.value = page.list
    } catch (err) {
      console.error('[training] fetch history failed', err)
      history.value = []
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

  return {
    history,
    loading,
    historyById,
    calendarDays,
    fetchHistory,
    fetchCalendar,
    fetchDetail
  }
})
