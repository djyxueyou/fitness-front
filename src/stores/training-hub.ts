import { ref } from 'vue'
import { defineStore } from 'pinia'

export type TrainingHubView = 'plan' | 'calendar' | 'history'
export type PlanLandingTab = 'system' | 'mine'
export type PlanLandingIntent = PlanLandingTab | 'auto'

export function resolvePlanLandingTab(
  intent: PlanLandingIntent,
  hasValidUserPlans: boolean
): PlanLandingTab {
  return intent === 'auto' ? (hasValidUserPlans ? 'mine' : 'system') : intent
}

export const useTrainingHubStore = defineStore('training-hub', () => {
  const activeView = ref<TrainingHubView>('plan')
  const requestedView = ref<TrainingHubView | null>(null)
  const requestedPlanTab = ref<PlanLandingIntent | null>(null)

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

  function requestPlanTab(tab: PlanLandingIntent) {
    requestedView.value = 'plan'
    requestedPlanTab.value = tab
  }

  function consumeRequestedPlanTab() {
    const tab = requestedPlanTab.value
    requestedPlanTab.value = null
    return tab
  }

  return {
    activeView,
    requestedPlanTab,
    open,
    setActiveView,
    consumeRequestedView,
    requestPlanTab,
    consumeRequestedPlanTab
  }
})
