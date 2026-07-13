export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 180, 300] as const
export type RestApplyScope = 'CURRENT' | 'ALL_MATCHING'

export function normalizeRestSeconds(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(600, Math.max(0, Math.round(value)))
}

export function adjustRestSeconds(value: number, direction: -1 | 1) {
  return normalizeRestSeconds(value + direction * 15)
}

export function restScopePayload(exerciseId: number, restSeconds: number, scope: RestApplyScope) {
  return { exerciseId, restSeconds: normalizeRestSeconds(restSeconds), scope }
}
