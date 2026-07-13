export function shouldPromptForEffort(input: {
  enabled: boolean
  handled: boolean
  completedSetType: 'NORMAL' | 'WARMUP'
  remainingIncompleteWorkingSets: number
  inSupersetTransition: boolean
}) {
  return (
    input.enabled &&
    !input.handled &&
    input.completedSetType !== 'WARMUP' &&
    input.remainingIncompleteWorkingSets === 0 &&
    !input.inSupersetTransition
  )
}
