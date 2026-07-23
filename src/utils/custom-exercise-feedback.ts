export function upsertCustomExercise<T extends { id: number }>(
  items: T[],
  exercise: T,
  prepend: boolean
) {
  const index = items.findIndex((item) => item.id === exercise.id)
  if (index < 0) return prepend ? [exercise, ...items] : [...items, exercise]
  if (prepend) return [exercise, ...items.filter((item) => item.id !== exercise.id)]
  return items.map((item) => (item.id === exercise.id ? exercise : item))
}

export function mergeCustomExerciseSelection<T extends { id: number }>(items: T[], exercise: T) {
  const exists = items.some((item) => item.id === exercise.id)
  return exists
    ? items.map((item) => (item.id === exercise.id ? exercise : item))
    : [...items, exercise]
}
