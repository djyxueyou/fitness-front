import { ref } from 'vue'
import { defineStore } from 'pinia'

export type TrainingHubView = 'plan' | 'calendar' | 'history'

export const useTrainingHubStore = defineStore('training-hub', () => {
  const activeView = ref<TrainingHubView>('plan')
  const requestedView = ref<TrainingHubView | null>(null)

  function open(view: TrainingHubView) {
    requestedView.value = view
  }

  function setActiveView(view: TrainingHubView) {
    activeView.value = view
  }

  function consumeRequestedView() {
    const view = requestedView.value
    requestedView.value = null
    return view
  }

  return {
    activeView,
    open,
    setActiveView,
    consumeRequestedView
  }
})
