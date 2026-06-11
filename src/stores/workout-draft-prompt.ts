import { ref } from 'vue'
import { defineStore } from 'pinia'

type DraftChoice = 'continue' | 'discard' | null
export interface DraftStartTarget {
  title: string
  subtitle?: string
}

let resolver: ((value: DraftChoice) => void) | null = null

export const useWorkoutDraftPromptStore = defineStore('workoutDraftPrompt', () => {
  const visible = ref(false)
  const confirmingDiscard = ref(false)
  const startTarget = ref<DraftStartTarget | null>(null)

  function open(target?: DraftStartTarget) {
    resolver?.(null)
    confirmingDiscard.value = false
    startTarget.value = target || null
    visible.value = true
    return new Promise<DraftChoice>((resolve) => {
      resolver = resolve
    })
  }

  function choose(choice: Exclude<DraftChoice, null>) {
    visible.value = false
    confirmingDiscard.value = false
    startTarget.value = null
    resolver?.(choice)
    resolver = null
  }

  function close() {
    visible.value = false
    confirmingDiscard.value = false
    startTarget.value = null
    resolver?.(null)
    resolver = null
  }

  function requestDiscard() {
    confirmingDiscard.value = true
  }

  function cancelDiscard() {
    confirmingDiscard.value = false
  }

  return {
    visible,
    confirmingDiscard,
    startTarget,
    open,
    choose,
    close,
    requestDiscard,
    cancelDiscard
  }
})
