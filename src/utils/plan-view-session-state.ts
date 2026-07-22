interface MutableValue<T> {
  value: T
}

export function resetPlanViewLocalState<Summary, SheetItem, Plan>(state: {
  activePlanSummary: MutableValue<Summary | null>
  busyPlanId: MutableValue<number | null>
  sheetVisible: MutableValue<boolean>
  sheetTitle: MutableValue<string>
  sheetSubtitle: MutableValue<string>
  sheetItems: MutableValue<SheetItem[]>
  sheetTargetPlan: MutableValue<Plan | null>
}) {
  state.activePlanSummary.value = null
  state.busyPlanId.value = null
  state.sheetVisible.value = false
  state.sheetTitle.value = ''
  state.sheetSubtitle.value = ''
  state.sheetItems.value = []
  state.sheetTargetPlan.value = null
}
