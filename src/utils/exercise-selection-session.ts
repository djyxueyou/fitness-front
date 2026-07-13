const SESSION_TTL_MS = 30 * 60 * 1000

export function mergePendingExercises<T extends { id: number }>(current: T[], returned: T[]) {
  const seen = new Set<number>()
  return [...current, ...returned].filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function setPendingExerciseSelection<T extends { id: number }>(
  current: T[],
  exercise: T,
  selected: boolean
) {
  const exists = current.some((item) => item.id === exercise.id)
  if (selected) return exists ? current : [...current, exercise]
  return exists ? current.filter((item) => item.id !== exercise.id) : current
}

export function selectionSessionExpired(session: { updatedAtMs: number }, nowMs = Date.now()) {
  return nowMs - session.updatedAtMs > SESSION_TTL_MS
}
