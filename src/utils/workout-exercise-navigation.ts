export function findNextIncompleteExerciseIndex(
  completedStates: boolean[],
  currentIndex: number
): number | null {
  if (!completedStates.length) return null
  for (let offset = 1; offset <= completedStates.length; offset += 1) {
    const index = (currentIndex + offset) % completedStates.length
    if (!completedStates[index]) return index
  }
  return null
}
