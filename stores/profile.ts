import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useProfileStore = defineStore('profile', () => {
  const notifications = ref(true)
  const darkMode = ref(true)
  const unit = ref<'kg' | 'lb'>('kg')

  return {
    notifications,
    darkMode,
    unit
  }
})
