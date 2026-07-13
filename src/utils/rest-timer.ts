export interface RestClockState {
  endsAtMs: number | null
  remainingWhenPaused: number | null
}

export function restRemainingSeconds(state: RestClockState, nowMs: number) {
  if (state.remainingWhenPaused !== null) return Math.max(0, state.remainingWhenPaused)
  if (state.endsAtMs === null) return 0
  return Math.max(0, Math.ceil((state.endsAtMs - nowMs) / 1000))
}

export function pauseRestClock(state: RestClockState, nowMs: number): RestClockState {
  if (state.remainingWhenPaused !== null || state.endsAtMs === null) return state
  return {
    endsAtMs: null,
    remainingWhenPaused: restRemainingSeconds(state, nowMs)
  }
}

export function resumeRestClock(state: RestClockState, nowMs: number): RestClockState {
  if (state.remainingWhenPaused === null) return state
  return {
    endsAtMs: nowMs + Math.max(0, state.remainingWhenPaused) * 1000,
    remainingWhenPaused: null
  }
}
