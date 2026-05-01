const TRAINING_CHANGED_EVENT = 'LIFTLOG_TRAINING_CHANGED'

export function emitTrainingChanged() {
  uni.$emit(TRAINING_CHANGED_EVENT)
}

export function onTrainingChanged(handler: () => void) {
  uni.$on(TRAINING_CHANGED_EVENT, handler)
}

export function offTrainingChanged(handler: () => void) {
  uni.$off(TRAINING_CHANGED_EVENT, handler)
}
