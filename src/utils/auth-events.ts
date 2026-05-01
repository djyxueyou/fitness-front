export const AUTH_CHANGED_EVENT = 'auth:changed'

export function emitAuthChanged() {
  uni.$emit(AUTH_CHANGED_EVENT)
}

export function onAuthChanged(handler: () => void) {
  uni.$on(AUTH_CHANGED_EVENT, handler)
}

export function offAuthChanged(handler: () => void) {
  uni.$off(AUTH_CHANGED_EVENT, handler)
}
