import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { exercises as seedExercises } from '@/mock/exercises'
import type { Exercise } from '@/types/exercise'

export const useExerciseStore = defineStore('exercise', () => {
  const items = ref<Exercise[]>(seedExercises.map((item) => ({ ...item })))

  const favorites = computed(() => items.value.filter((item) => item.favorited))

  function toggleFavorite(id: number) {
    items.value = items.value.map((item) =>
      item.id === id ? { ...item, favorited: !item.favorited } : item
    )
  }

  function getById(id: number) {
    return items.value.find((item) => item.id === id)
  }

  return {
    items,
    favorites,
    toggleFavorite,
    getById
  }
})
