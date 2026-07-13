export type ExercisePickerContext = 'WORKOUT' | 'TEMPLATE' | 'REPLACE'

export function pickerCopy(context: ExercisePickerContext, count: number) {
  if (context === 'TEMPLATE') {
    return {
      existing: '已在模板',
      action: '选择',
      confirm: count ? `添加到模板（${count}）` : '添加到模板'
    }
  }
  if (context === 'REPLACE') {
    return { existing: '当前动作', action: '替换', confirm: '确认替换' }
  }
  return {
    existing: '已在训练',
    action: '选择',
    confirm: count ? `添加到训练（${count}）` : '添加到训练'
  }
}

export function orderedUniqueExercises<T extends { id: number }>(items: T[]) {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
