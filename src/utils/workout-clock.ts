export interface WorkoutClockState {
  startedAtMs: number
  pausedAtMs: number | null
  accumulatedPausedSeconds: number
  suspendedAtMs?: number | null
  accumulatedSuspendedSeconds?: number
}

export function effectiveElapsedSeconds(state: WorkoutClockState, nowMs: number) {
  const effectiveNow = state.suspendedAtMs ?? state.pausedAtMs ?? nowMs
  const wallSeconds = Math.floor((effectiveNow - state.startedAtMs) / 1000)
  return Math.max(
    0,
    wallSeconds -
      Math.max(0, state.accumulatedPausedSeconds) -
      Math.max(0, state.accumulatedSuspendedSeconds || 0)
  )
}

export function pauseWorkoutClock(state: WorkoutClockState, nowMs: number): WorkoutClockState {
  if (state.pausedAtMs !== null) return state
  return { ...state, pausedAtMs: nowMs }
}

export function resumeWorkoutClock(state: WorkoutClockState, nowMs: number): WorkoutClockState {
  if (state.pausedAtMs === null) return state
  const pauseSeconds = Math.max(0, Math.floor((nowMs - state.pausedAtMs) / 1000))
  return {
    ...state,
    pausedAtMs: null,
    accumulatedPausedSeconds: state.accumulatedPausedSeconds + pauseSeconds
  }
}

export function suspendWorkoutClock(state: WorkoutClockState, nowMs: number): WorkoutClockState {
  if (state.suspendedAtMs != null) return state
  return { ...state, suspendedAtMs: nowMs }
}

export function restoreSuspendedWorkoutClock(
  state: WorkoutClockState,
  nowMs: number
): WorkoutClockState {
  if (state.suspendedAtMs == null) return state
  const suspendedSeconds = Math.max(0, Math.floor((nowMs - state.suspendedAtMs) / 1000))
  return {
    ...state,
    suspendedAtMs: null,
    accumulatedSuspendedSeconds:
      Math.max(0, state.accumulatedSuspendedSeconds || 0) + suspendedSeconds
  }
}
