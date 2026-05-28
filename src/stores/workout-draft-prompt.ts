import { ref } from 'vue'
import { defineStore } from 'pinia'

type DraftChoice = 'continue' | 'discard' | null

let resolver: ((value: DraftChoice) => void) | null = null

export const useWorkoutDraftPromptStore = defineStore('workoutDraftPrompt', () => {
  const visible = ref(false)

  function open() {
    resolver?.(null)
    visible.value = true
    return new Promise<DraftChoice>((resolve) => {
      resolver = resolve
    })
  }

  function choose(choice: Exclude<DraftChoice, null>) {
    visible.value = false
    resolver?.(choice)
    resolver = null
  }

  function close() {
    visible.value = false
    resolver?.(null)
    resolver = null
  }

  return {
    visible,
    open,
    choose,
    close
  }
})
