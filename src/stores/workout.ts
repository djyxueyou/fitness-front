import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  effectiveElapsedSeconds,
  pauseWorkoutClock,
  resumeWorkoutClock,
  restoreSuspendedWorkoutClock,
  suspendWorkoutClock
} from '@/utils/workout-clock'
import {
  fetchExerciseLastPerformances,
  fetchExerciseLastPerformance,
  type ExerciseLastPerformanceResponse,
  type ExerciseLastPerformanceSetResponse,
  type SaveTrainingRequest,
  type SaveTrainingResponse
} from '@/api/training'
import { useTemplateStore } from '@/stores/template'
import { useProfileStore } from '@/stores/profile'
import {
  fetchProgressionRecommendation,
  sendProgressionRecommendationFeedback,
  type ExerciseProgressionRecommendation
} from '@/api/progression'

const WORKOUT_DRAFT_KEY = 'LIFTLOG_WORKOUT_DRAFT'
const WORKOUT_DRAFT_VERSION = 4
const WORKOUT_DRAFT_TTL_MS = 48 * 60 * 60 * 1000

export type WorkoutRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
export type WorkoutSet = {
  reps: number
  weight: number
  durationSeconds?: number
  setType?: 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE'
  effort?: 'RIR_4_PLUS' | 'RIR_2_3' | 'RIR_1' | 'RIR_0' | 'FAILED'
  note?: string
  done: boolean
  completedAt?: string
  plannedWeightKg?: number
  plannedReps?: number
  plannedDurationSeconds?: number
  targetSource?: 'PLAN' | 'TEMPLATE' | 'LAST_PERFORMANCE' | 'PROGRESSION_RECOMMENDATION' | 'MANUAL'
  sourceRecommendationId?: string
}
export type WorkoutSetType = NonNullable<WorkoutSet['setType']>
export type WorkoutEffort = NonNullable<WorkoutSet['effort']>
export type WorkoutExercise = {
  id: number
  name: string
  muscle: string
  equipment?: string
  recordType: WorkoutRecordType
  ended?: boolean
  supersetGroupId?: string
  restSeconds?: number
  effortPromptHandled?: boolean
  sets: WorkoutSet[]
}
export type WorkoutExecutionDayItem = {
  exerciseId: number
  exerciseName: string
  primaryMuscle?: string
  equipment?: string
  recordType?: WorkoutRecordType
  targetSets?: number
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  plannedRestSeconds?: number
}
export type CompletedWorkoutSummary = SaveTrainingResponse & {
  trainingName: string
  startedAt: string
  endedAt: string
  activeTemplateId?: number | null
  activePlanId?: number | null
  activePlanDayId?: number | null
  activeExecutionId?: number | null
  activeExecutionDayId?: number | null
  activeExecutionDayTitle?: string | null
  plannedItems?: Array<{
    exerciseId: number
    targetSets: number
  }>
  comparisons?: WorkoutComparison[]
}
export type WorkoutComparison = {
  exerciseId: number
  exerciseName: string
  currentVolumeKg: number
  volumeDeltaKg?: number | null
  currentMaxWeightKg: number
  maxWeightDeltaKg?: number | null
}
type WorkoutDraft = {
  version: number
  savedAt: string
  status?: 'ACTIVE' | 'EXPIRED' | 'SAVE_FAILED'
  activeTemplateId: number | null
  activePlanId?: number | null
  activePlanDayId?: number | null
  activeExecutionId?: number | null
  activeExecutionDayId?: number | null
  activeExecutionDayTitle?: string | null
  activeTemplateName: string
  clientRequestId?: string
  startedAt: string
  elapsedSeconds: number
  pausedAtMs?: number | null
  accumulatedPausedSeconds?: number
  sessionState?: 'RUNNING' | 'SAVED_DRAFT'
  suspendedAtMs?: number | null
  accumulatedSuspendedSeconds?: number
  activeExercises: WorkoutExercise[]
  lastActiveExerciseId?: number | null
  lastActiveExerciseIndex?: number | null
  lastActiveSetIndex?: number | null
  appliedRecommendationSnapshots?: Record<number, AppliedRecommendationSnapshot>
  lastSubmitPayload?: SaveTrainingRequest
}

type StoredWorkoutDraft = Omit<WorkoutDraft, 'version'> & {
  version: number
}

type AppliedRecommendationSetSnapshot = {
  weight: number
  reps: number
  durationSeconds?: number
}

type AppliedRecommendationSnapshot = {
  exerciseId: number
  recommendationId: string
  appliedSets: AppliedRecommendationSetSnapshot[]
  dirtyAfterRecommendation: boolean
  overrideReported: boolean
}

function createEmptyWorkout() {
  return [] as WorkoutExercise[]
}

function isBodyweightRecord(recordType?: WorkoutRecordType) {
  return recordType === 'BODYWEIGHT_REPS'
}

function isDurationRecord(recordType?: WorkoutRecordType) {
  return recordType === 'DURATION'
}

function createDefaultSet(
  performanceSet?: ExerciseLastPerformanceSetResponse,
  recordType: WorkoutRecordType = 'WEIGHT_REPS'
): WorkoutSet {
  if (isDurationRecord(recordType)) {
    return {
      reps: 1,
      weight: 0,
      durationSeconds: performanceSet?.durationSeconds ?? 60,
      setType: 'NORMAL',
      note: '',
      done: false
    }
  }

  return {
    reps: performanceSet?.reps ?? 10,
    weight: isBodyweightRecord(recordType) ? 0 : Number(performanceSet?.weightKg ?? 20),
    setType: 'NORMAL',
    note: '',
    done: false
  }
}

function createClientRequestId() {
  return `wx-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDraftDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min'
  const minutes = Math.max(1, Math.floor(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`
}

function createSetsFromTemplateTargets(
  targetSets: number,
  recordType: WorkoutRecordType = 'WEIGHT_REPS',
  targets?: {
    targetWeightKg?: number
    targetReps?: number
    targetDurationSeconds?: number
  }
) {
  return Array.from({ length: targetSets }, () => {
    const set = createDefaultSet(undefined, recordType)
    if (isDurationRecord(recordType) && targets?.targetDurationSeconds != null) {
      return { ...set, durationSeconds: targets.targetDurationSeconds }
    }
    if (targets?.targetReps != null) {
      set.reps = targets.targetReps
    }
    if (!isBodyweightRecord(recordType) && targets?.targetWeightKg != null) {
      set.weight = targets.targetWeightKg
    }
    return set
  })
}

function readWorkoutDraft() {
  try {
    const draft = uni.getStorageSync(WORKOUT_DRAFT_KEY) as StoredWorkoutDraft | undefined
    if (!draft || !Array.isArray(draft.activeExercises)) {
      return null
    }
    if (isDraftExpired(draft)) {
      draft.status = 'EXPIRED'
    }
    if (draft.version === 1) {
      return migrateDraftV1(draft)
    }
    if (draft.version === 2) {
      return migrateDraftV2(draft)
    }
    if (draft.version !== WORKOUT_DRAFT_VERSION) {
      uni.removeStorageSync(WORKOUT_DRAFT_KEY)
      return null
    }
    return normalizeDraftSets(draft)
  } catch {
    return null
  }
}

function isDraftExpired(draft: StoredWorkoutDraft) {
  const savedAt = new Date(draft.savedAt).getTime()
  if (!Number.isFinite(savedAt)) {
    return true
  }
  return Date.now() - savedAt > WORKOUT_DRAFT_TTL_MS
}

function migrateDraftV1(draft: StoredWorkoutDraft): WorkoutDraft {
  return migrateDraftV2({
    ...draft,
    version: 2
  })
}

function migrateDraftV2(draft: StoredWorkoutDraft): WorkoutDraft {
  const activeExercises = Array.isArray(draft.activeExercises) ? draft.activeExercises : []
  const firstUnfinishedIndex = activeExercises.findIndex(
    (exercise) => !exercise.ended && exercise.sets.some((set) => !set.done)
  )
  const fallbackIndex = firstUnfinishedIndex >= 0 ? firstUnfinishedIndex : 0
  const fallbackExercise = activeExercises[fallbackIndex]
  const fallbackSetIndex = fallbackExercise?.sets.findIndex((set) => !set.done) ?? -1

  return normalizeDraftSets({
    ...draft,
    version: WORKOUT_DRAFT_VERSION,
    lastActiveExerciseId: fallbackExercise?.id ?? null,
    lastActiveExerciseIndex: fallbackExercise ? fallbackIndex : null,
    lastActiveSetIndex: fallbackSetIndex >= 0 ? fallbackSetIndex : null
  })
}

function normalizeDraftSets(draft: StoredWorkoutDraft): WorkoutDraft {
  return {
    ...draft,
    version: WORKOUT_DRAFT_VERSION,
    activeExercises: draft.activeExercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        setType: set.setType || 'NORMAL',
        note: set.note || ''
      }))
    }))
  }
}

function normalSetSnapshots(sets: WorkoutSet[]): AppliedRecommendationSetSnapshot[] {
  return sets
    .filter((set) => (set.setType || 'NORMAL') === 'NORMAL')
    .map((set) => ({
      weight: Number(set.weight || 0),
      reps: Number(set.reps || 0),
      durationSeconds: set.durationSeconds
    }))
}

function sameAppliedSnapshot(
  current: AppliedRecommendationSetSnapshot[],
  applied: AppliedRecommendationSetSnapshot[]
) {
  if (current.length !== applied.length) return false
  return current.every((set, index) => {
    const target = applied[index]
    return (
      set.weight === target.weight &&
      set.reps === target.reps &&
      set.durationSeconds === target.durationSeconds
    )
  })
}

export const useWorkoutStore = defineStore('workout', () => {
  const initialDraft = readWorkoutDraft()
  const activeTemplateId = ref<number | null>(null)
  const activePlanId = ref<number | null>(null)
  const activePlanDayId = ref<number | null>(null)
  const activeExecutionId = ref<number | null>(null)
  const activeExecutionDayId = ref<number | null>(null)
  const activeExecutionDayTitle = ref<string | null>(null)
  const activeTemplateName = ref('自由训练')
  const clientRequestId = ref('')
  const startedAt = ref<string | null>(null)
  const elapsedSeconds = ref(0)
  const pausedAtMs = ref<number | null>(null)
  const accumulatedPausedSeconds = ref(0)
  const sessionState = ref<'RUNNING' | 'SAVED_DRAFT'>(initialDraft?.sessionState || 'SAVED_DRAFT')
  const suspendedAtMs = ref<number | null>(initialDraft?.suspendedAtMs ?? null)
  const accumulatedSuspendedSeconds = ref(initialDraft?.accumulatedSuspendedSeconds ?? 0)
  const activeExercises = ref<WorkoutExercise[]>(createEmptyWorkout())
  const lastActiveExerciseId = ref<number | null>(null)
  const lastActiveExerciseIndex = ref<number | null>(null)
  const lastActiveSetIndex = ref<number | null>(null)
  const completedSummary = ref<CompletedWorkoutSummary | null>(null)
  const lastPerformanceMap = ref<Record<number, ExerciseLastPerformanceResponse>>({})
  const recommendationMap = ref<Record<number, ExerciseProgressionRecommendation>>({})
  const appliedRecommendationSnapshots = ref<Record<number, AppliedRecommendationSnapshot>>({})
  const hasPendingStart = ref(false)
  const pendingStartTemplateId = ref<number | null>(null)
  const pendingStartPlanId = ref<number | null>(null)
  const pendingStartPlanDayId = ref<number | null>(null)
  const pendingStartExecutionId = ref<number | null>(null)
  const pendingStartExecutionDayId = ref<number | null>(null)
  const pendingStartExecutionDayTitle = ref<string | null>(null)
  const pendingStartExecutionItems = ref<WorkoutExecutionDayItem[]>([])
  const draftSnapshot = ref<WorkoutDraft | null>(initialDraft)
  const hasDraft = ref(Boolean(initialDraft))
  const draftSavedAt = ref(initialDraft?.savedAt || '')
  const draftStatus = ref<WorkoutDraft['status']>(initialDraft?.status || 'ACTIVE')
  const lastSubmitPayload = ref<SaveTrainingRequest | null>(initialDraft?.lastSubmitPayload || null)
  const workoutDirty = ref(false)

  const totalSets = computed(() =>
    activeExercises.value.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.setType !== 'WARMUP').length,
      0
    )
  )
  const doneSets = computed(() =>
    activeExercises.value.reduce(
      (total, exercise) =>
        total + exercise.sets.filter((set) => set.done && set.setType !== 'WARMUP').length,
      0
    )
  )
  const progress = computed(() => (totalSets.value ? doneSets.value / totalSets.value : 0))
  const totalVolume = computed(() =>
    activeExercises.value.reduce(
      (sum, exercise) =>
        sum +
        exercise.sets
          .filter((set) => set.done && set.setType !== 'WARMUP')
          .reduce(
            (setSum, set) =>
              setSum + (isDurationRecord(exercise.recordType) ? 0 : set.weight * set.reps),
            0
          ),
      0
    )
  )
  const hasActiveWorkout = computed(() => Boolean(startedAt.value && activeExercises.value.length))
  const isPaused = computed(() => pausedAtMs.value !== null)
  const isSavedDraft = computed(() => sessionState.value === 'SAVED_DRAFT')
  const hasMeaningfulDraft = computed(() =>
    Boolean(workoutDirty.value && startedAt.value && activeExercises.value.length)
  )
  const hasRecoverableWorkout = computed(() => hasMeaningfulDraft.value || hasDraft.value)
  const hasSaveFailedDraft = computed(
    () => draftStatus.value === 'SAVE_FAILED' && Boolean(lastSubmitPayload.value)
  )
  const hasExpiredDraft = computed(() => draftStatus.value === 'EXPIRED')
  const draftSource = computed(() =>
    hasMeaningfulDraft.value
      ? {
          activeTemplateName: activeTemplateName.value,
          elapsedSeconds: elapsedSeconds.value,
          activeExercises: activeExercises.value,
          savedAt: draftSavedAt.value,
          sessionState: sessionState.value
        }
      : draftSnapshot.value
  )
  const draftExerciseCount = computed(() => draftSource.value?.activeExercises.length || 0)
  const draftDoneSets = computed(
    () =>
      draftSource.value?.activeExercises.reduce(
        (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
        0
      ) || 0
  )
  const draftElapsedText = computed(() =>
    formatDraftDuration(draftSource.value?.elapsedSeconds || 0)
  )
  const draftSummary = computed(() => ({
    title: draftSource.value?.activeTemplateName || '自由训练',
    durationText: draftElapsedText.value,
    exerciseCount: draftExerciseCount.value,
    doneSets: draftDoneSets.value,
    savedAt: draftSource.value?.savedAt || '',
    state: draftSource.value?.sessionState || 'SAVED_DRAFT'
  }))
  const sourceType = computed<'PLAN' | 'TEMPLATE' | 'FREE'>(() => {
    if (
      (activePlanId.value && activePlanDayId.value) ||
      (activeExecutionId.value && activeExecutionDayId.value)
    ) {
      return 'PLAN'
    }
    if (activeTemplateId.value) return 'TEMPLATE'
    return 'FREE'
  })

  function startFreeWorkout() {
    activeTemplateId.value = null
    activePlanId.value = null
    activePlanDayId.value = null
    activeExecutionId.value = null
    activeExecutionDayId.value = null
    activeExecutionDayTitle.value = null
    activeTemplateName.value = '自由训练'
    clientRequestId.value = createClientRequestId()
    startedAt.value = new Date().toISOString()
    elapsedSeconds.value = 0
    pausedAtMs.value = null
    accumulatedPausedSeconds.value = 0
    sessionState.value = 'RUNNING'
    suspendedAtMs.value = null
    accumulatedSuspendedSeconds.value = 0
    workoutDirty.value = false
    draftStatus.value = 'ACTIVE'
    lastSubmitPayload.value = null
    resetDraftFocus()
    activeExercises.value = createEmptyWorkout()
  }

  function ensureWorkoutSession() {
    if (hasActiveWorkout.value) return
    if (restoreDraft()) return
    startFreeWorkout()
  }

  function hasExercise(exerciseId: number) {
    return activeExercises.value.some((item) => item.id === exerciseId)
  }

  async function startWorkout(
    templateId: number | null,
    context?: {
      planId?: number | null
      planDayId?: number | null
      executionId?: number | null
      executionDayId?: number | null
      executionDayTitle?: string | null
      executionItems?: WorkoutExecutionDayItem[]
    }
  ) {
    const templateStore = useTemplateStore()
    const profileStore = useProfileStore()
    activeTemplateId.value = templateId
    activePlanId.value = context?.planId ?? null
    activePlanDayId.value = context?.planDayId ?? null
    activeExecutionId.value = context?.executionId ?? null
    activeExecutionDayId.value = context?.executionDayId ?? null
    activeExecutionDayTitle.value = context?.executionDayTitle ?? null
    activeTemplateName.value =
      context?.executionDayTitle || templateStore.getById(templateId)?.name || '自由训练'
    clientRequestId.value = createClientRequestId()
    startedAt.value = new Date().toISOString()
    elapsedSeconds.value = 0
    pausedAtMs.value = null
    accumulatedPausedSeconds.value = 0
    sessionState.value = 'RUNNING'
    suspendedAtMs.value = null
    accumulatedSuspendedSeconds.value = 0
    workoutDirty.value = false
    draftStatus.value = 'ACTIVE'
    lastSubmitPayload.value = null
    resetDraftFocus()

    if (context?.executionItems?.length) {
      const exerciseIds = context.executionItems.map((item) => item.exerciseId)
      await loadLastPerformances(exerciseIds)
      await loadRecommendations(exerciseIds)
      activeExercises.value = context.executionItems.map((item) => {
        const recordType = item.recordType || 'WEIGHT_REPS'
        return {
          id: item.exerciseId,
          name: item.exerciseName,
          muscle: item.primaryMuscle || '',
          equipment: item.equipment,
          recordType,
          ended: false,
          restSeconds: item.plannedRestSeconds ?? profileStore.restSeconds,
          effortPromptHandled: false,
          sets: createSetsFromTemplateTargets(Math.max(1, item.targetSets || 1), recordType, {
            targetWeightKg: item.targetWeightKg,
            targetReps: item.targetReps,
            targetDurationSeconds: item.targetDurationSeconds
          })
        }
      })
      updateDraftFocus(0)
      return
    }

    if (!templateId) {
      activeExercises.value = createEmptyWorkout()
      clearDraft()
      return
    }

    const detail = await templateStore.getDetail(templateId)
    activeTemplateName.value = detail.name
    const exerciseIds = detail.items.map((item) => item.exerciseId)
    await loadLastPerformances(exerciseIds)
    await loadRecommendations(exerciseIds)
    activeExercises.value = detail.items.map((item) => ({
      id: item.exerciseId,
      name: item.exerciseName,
      muscle: '',
      equipment: item.equipment,
      recordType: item.recordType || 'WEIGHT_REPS',
      ended: false,
      restSeconds: item.restSeconds ?? profileStore.restSeconds,
      effortPromptHandled: false,
      sets: createSetsFromTemplateTargets(item.targetSets, item.recordType || 'WEIGHT_REPS', {
        targetWeightKg: item.effectiveTargetWeightKg,
        targetReps: item.effectiveTargetReps,
        targetDurationSeconds: item.effectiveTargetDurationSeconds
      })
    }))
    updateDraftFocus(0)
  }

  function queueStartWorkout(
    templateId: number | null,
    context?: {
      planId?: number | null
      planDayId?: number | null
      executionId?: number | null
      executionDayId?: number | null
      executionDayTitle?: string | null
      executionItems?: WorkoutExecutionDayItem[]
    }
  ) {
    hasPendingStart.value = true
    pendingStartTemplateId.value = templateId
    pendingStartPlanId.value = context?.planId ?? null
    pendingStartPlanDayId.value = context?.planDayId ?? null
    pendingStartExecutionId.value = context?.executionId ?? null
    pendingStartExecutionDayId.value = context?.executionDayId ?? null
    pendingStartExecutionDayTitle.value = context?.executionDayTitle ?? null
    pendingStartExecutionItems.value = context?.executionItems ?? []
  }

  function clearPendingStart() {
    hasPendingStart.value = false
    pendingStartTemplateId.value = null
    pendingStartPlanId.value = null
    pendingStartPlanDayId.value = null
    pendingStartExecutionId.value = null
    pendingStartExecutionDayId.value = null
    pendingStartExecutionDayTitle.value = null
    pendingStartExecutionItems.value = []
  }

  async function loadLastPerformances(exerciseIds?: number[]) {
    const ids = Array.from(new Set(exerciseIds || activeExercises.value.map((item) => item.id)))
    if (!ids.length) return
    try {
      const performances = await fetchExerciseLastPerformances(ids)
      lastPerformanceMap.value = performances.reduce(
        (map, performance) => ({
          ...map,
          [performance.exerciseId]: performance
        }),
        { ...lastPerformanceMap.value }
      )
    } catch (err) {
      console.error('[workout] last performances fetch failed', { exerciseIds: ids, err })
    }
  }

  function getLastPerformance(exerciseId: number) {
    return lastPerformanceMap.value[exerciseId]
  }

  async function loadRecommendations(exerciseIds?: number[]) {
    const ids = Array.from(new Set(exerciseIds || activeExercises.value.map((item) => item.id)))
    if (!ids.length) return
    const results = await Promise.all(
      ids.map(async (exerciseId) => {
        try {
          return [exerciseId, await fetchProgressionRecommendation(exerciseId)] as const
        } catch {
          return null
        }
      })
    )
    recommendationMap.value = results.reduce(
      (map, result) => (result ? { ...map, [result[0]]: result[1] } : map),
      { ...recommendationMap.value }
    )
  }

  function markRecommendationDirtyIfNeeded(exerciseIndex: number, setsChanged = false) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise || !setsChanged) return
    const snapshot = appliedRecommendationSnapshots.value[exercise.id]
    if (!snapshot || snapshot.overrideReported) return
    appliedRecommendationSnapshots.value = {
      ...appliedRecommendationSnapshots.value,
      [exercise.id]: { ...snapshot, dirtyAfterRecommendation: true }
    }
  }

  async function reportRecommendationOverrideIfNeeded(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise) return false
    const snapshot = appliedRecommendationSnapshots.value[exercise.id]
    if (!snapshot || snapshot.overrideReported || !snapshot.dirtyAfterRecommendation) {
      return false
    }
    if (sameAppliedSnapshot(normalSetSnapshots(exercise.sets), snapshot.appliedSets)) {
      appliedRecommendationSnapshots.value = {
        ...appliedRecommendationSnapshots.value,
        [exercise.id]: { ...snapshot, dirtyAfterRecommendation: false }
      }
      persistDraft()
      return false
    }

    try {
      await sendProgressionRecommendationFeedback(
        exercise.id,
        snapshot.recommendationId,
        'OVERRIDDEN'
      )
    } catch (err) {
      console.warn('[progression] override feedback failed', err)
      persistDraft()
      return false
    }
    appliedRecommendationSnapshots.value = {
      ...appliedRecommendationSnapshots.value,
      [exercise.id]: { ...snapshot, overrideReported: true }
    }
    persistDraft()
    return true
  }

  async function reportAllRecommendationOverrides() {
    for (let index = 0; index < activeExercises.value.length; index += 1) {
      await reportRecommendationOverrideIfNeeded(index)
    }
  }

  function setSetType(exerciseIndex: number, setIndex: number, setType: WorkoutSetType) {
    updateSet(exerciseIndex, setIndex, { setType })
  }

  function setEffort(exerciseIndex: number, setIndex: number, effort?: WorkoutEffort) {
    const exercise = activeExercises.value[exerciseIndex]
    const set = exercise?.sets[setIndex]
    if (!set || !set.done) return
    activeExercises.value = activeExercises.value.map((item, itemIndex) =>
      itemIndex === exerciseIndex
        ? {
            ...item,
            sets: item.sets.map((target, targetIndex) =>
              targetIndex === setIndex ? { ...target, effort } : target
            )
          }
        : item
    )
    markWorkoutDirty()
    persistDraft()
  }

  function markEffortPromptHandled(exerciseIndex: number, handled = true) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise) return
    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex ? { ...item, effortPromptHandled: handled } : item
    )
    markWorkoutDirty()
    persistDraft()
  }

  function setExerciseRestSeconds(exerciseIndex: number, restSeconds: number) {
    const normalized = Math.min(600, Math.max(0, Math.round(restSeconds)))
    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex ? { ...item, restSeconds: normalized } : item
    )
    markWorkoutDirty()
    persistDraft()
  }

  function clockState() {
    return {
      startedAtMs: startedAt.value ? new Date(startedAt.value).getTime() : Date.now(),
      pausedAtMs: pausedAtMs.value,
      accumulatedPausedSeconds: accumulatedPausedSeconds.value,
      suspendedAtMs: suspendedAtMs.value,
      accumulatedSuspendedSeconds: accumulatedSuspendedSeconds.value
    }
  }

  function syncElapsed(nowMs = Date.now()) {
    if (!startedAt.value) return
    elapsedSeconds.value = effectiveElapsedSeconds(clockState(), nowMs)
  }

  function pauseWorkout(nowMs = Date.now()) {
    if (!startedAt.value) return
    const next = pauseWorkoutClock(clockState(), nowMs)
    pausedAtMs.value = next.pausedAtMs
    syncElapsed(nowMs)
    markWorkoutDirty()
    persistDraft()
  }

  function resumeWorkout(nowMs = Date.now()) {
    if (!startedAt.value) return
    const next = resumeWorkoutClock(clockState(), nowMs)
    pausedAtMs.value = next.pausedAtMs
    accumulatedPausedSeconds.value = next.accumulatedPausedSeconds
    syncElapsed(nowMs)
    markWorkoutDirty()
    persistDraft()
  }

  function minimizeWorkout() {
    sessionState.value = 'RUNNING'
    markWorkoutDirty()
    persistDraft()
  }

  function saveDraftAndStop(nowMs = Date.now()) {
    if (!startedAt.value) return
    if (isPaused.value) {
      const resumed = resumeWorkoutClock(clockState(), nowMs)
      pausedAtMs.value = resumed.pausedAtMs
      accumulatedPausedSeconds.value = resumed.accumulatedPausedSeconds
    }
    syncElapsed(nowMs)
    const suspended = suspendWorkoutClock(clockState(), nowMs)
    suspendedAtMs.value = suspended.suspendedAtMs ?? null
    sessionState.value = 'SAVED_DRAFT'
    markWorkoutDirty()
    persistDraft()
  }

  function resumeSavedDraft(nowMs = Date.now()) {
    if (!startedAt.value || sessionState.value !== 'SAVED_DRAFT') return
    const restored = restoreSuspendedWorkoutClock(clockState(), nowMs)
    suspendedAtMs.value = restored.suspendedAtMs ?? null
    accumulatedSuspendedSeconds.value = restored.accumulatedSuspendedSeconds || 0
    sessionState.value = 'RUNNING'
    syncElapsed(nowMs)
    markWorkoutDirty()
    persistDraft()
  }

  async function applyRecommendation(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    const recommendation = exercise ? recommendationMap.value[exercise.id] : null
    if (!exercise || !recommendation?.available) return false
    if (recommendation.recommendationId) {
      await sendProgressionRecommendationFeedback(
        exercise.id,
        recommendation.recommendationId,
        'APPLIED'
      )
    }
    activeExercises.value = activeExercises.value.map((item, itemIndex) =>
      itemIndex === exerciseIndex
        ? {
            ...item,
            sets: item.sets.map((set) =>
              set.done || set.setType === 'WARMUP'
                ? set
                : {
                    ...set,
                    weight: recommendation.targetWeightKg ?? set.weight,
                    reps: recommendation.targetReps ?? set.reps,
                    durationSeconds: recommendation.targetDurationSeconds ?? set.durationSeconds,
                    plannedWeightKg: recommendation.targetWeightKg ?? set.weight,
                    plannedReps: recommendation.targetReps ?? set.reps,
                    plannedDurationSeconds:
                      recommendation.targetDurationSeconds ?? set.durationSeconds,
                    targetSource: 'PROGRESSION_RECOMMENDATION',
                    sourceRecommendationId: recommendation.recommendationId
                  }
            )
          }
        : item
    )
    const updatedExercise = activeExercises.value[exerciseIndex]
    if (updatedExercise && recommendation.recommendationId) {
      appliedRecommendationSnapshots.value = {
        ...appliedRecommendationSnapshots.value,
        [updatedExercise.id]: {
          exerciseId: updatedExercise.id,
          recommendationId: recommendation.recommendationId,
          appliedSets: normalSetSnapshots(updatedExercise.sets),
          dirtyAfterRecommendation: false,
          overrideReported: false
        }
      }
    }
    recommendationMap.value = {
      ...recommendationMap.value,
      [exercise.id]: { ...recommendation, available: false }
    }
    markWorkoutDirty()
    persistDraft()
    return true
  }

  async function dismissRecommendation(exerciseId: number) {
    const recommendation = recommendationMap.value[exerciseId]
    if (!recommendation) return
    if (recommendation.recommendationId) {
      await sendProgressionRecommendationFeedback(
        exerciseId,
        recommendation.recommendationId,
        'DISMISSED'
      )
    }
    recommendationMap.value = {
      ...recommendationMap.value,
      [exerciseId]: { ...recommendation, available: false }
    }
  }

  function applyLastPerformance(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    const performance = exercise ? lastPerformanceMap.value[exercise.id] : null
    if (!exercise || !performance?.sets?.length) return false
    activeExercises.value = activeExercises.value.map((item, itemIndex) =>
      itemIndex === exerciseIndex
        ? {
            ...item,
            sets: item.sets.map((set, setIndex) => {
              if (set.done || set.setType === 'WARMUP') return set
              const previous =
                performance.sets[setIndex] || performance.sets[performance.sets.length - 1]
              return {
                ...set,
                weight: isBodyweightRecord(item.recordType) ? 0 : Number(previous.weightKg || 0),
                reps: isDurationRecord(item.recordType) ? 1 : previous.reps,
                durationSeconds: isDurationRecord(item.recordType)
                  ? previous.durationSeconds || set.durationSeconds
                  : undefined
              }
            })
          }
        : item
    )
    markWorkoutDirty()
    persistDraft()
    return true
  }

  function generateWarmupSets(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    if (
      !exercise ||
      isBodyweightRecord(exercise.recordType) ||
      isDurationRecord(exercise.recordType)
    ) {
      return false
    }
    const firstWorkSet = exercise.sets.find((set) => set.setType !== 'WARMUP')
    if (
      !firstWorkSet ||
      firstWorkSet.weight <= 0 ||
      exercise.sets.some((set) => set.setType === 'WARMUP')
    ) {
      return false
    }
    const warmups: WorkoutSet[] = [0.5, 0.75].map((ratio) => ({
      reps: Math.max(5, Math.min(firstWorkSet.reps, 10)),
      weight: Number((firstWorkSet.weight * ratio).toFixed(2)),
      setType: 'WARMUP',
      note: '',
      done: false
    }))
    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex ? { ...item, sets: [...warmups, ...item.sets] } : item
    )
    markWorkoutDirty()
    persistDraft()
    return true
  }

  function insertWarmupSets(
    exerciseIndex: number,
    warmups: Array<{ weight: number; reps: number }>
  ) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise || !warmups.length || exercise.sets.some((set) => set.setType === 'WARMUP')) {
      return false
    }
    const warmupSets: WorkoutSet[] = warmups.map((warmup) => ({
      reps: warmup.reps,
      weight: warmup.weight,
      setType: 'WARMUP',
      note: '',
      done: false
    }))
    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex ? { ...item, sets: [...warmupSets, ...item.sets] } : item
    )
    markWorkoutDirty()
    persistDraft()
    return true
  }

  function removeWarmupSets(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    const warmupSets = exercise?.sets.filter((set) => set.setType === 'WARMUP') || []
    if (!exercise || !warmupSets.length || warmupSets.some((set) => set.done)) {
      return false
    }
    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex
        ? { ...item, sets: item.sets.filter((set) => set.setType !== 'WARMUP') }
        : item
    )
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
    return true
  }

  function toggleSupersetWithNext(exerciseIndex: number) {
    const current = activeExercises.value[exerciseIndex]
    const next = activeExercises.value[exerciseIndex + 1]
    if (!current || !next) return false
    const groupId = `superset-${Date.now()}`
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex || index === exerciseIndex + 1
        ? { ...exercise, supersetGroupId: groupId }
        : exercise
    )
    markWorkoutDirty()
    persistDraft()
    return true
  }

  function removeSuperset(exerciseIndex: number) {
    const groupId = activeExercises.value[exerciseIndex]?.supersetGroupId
    if (!groupId) return false
    activeExercises.value = activeExercises.value.map((exercise) =>
      exercise.supersetGroupId === groupId ? { ...exercise, supersetGroupId: undefined } : exercise
    )
    markWorkoutDirty()
    persistDraft()
    return true
  }

  function replaceExercise(
    exerciseIndex: number,
    id: number,
    name: string,
    muscle: string,
    recordType: WorkoutRecordType,
    equipment?: string
  ) {
    if (!activeExercises.value[exerciseIndex] || hasExercise(id)) return false
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex
        ? {
            id,
            name,
            muscle,
            equipment,
            recordType,
            ended: false,
            supersetGroupId: exercise.supersetGroupId,
            sets: createSetsFromTemplateTargets(Math.max(1, exercise.sets.length), recordType)
          }
        : exercise
    )
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
    void loadLastPerformances([id])
    void loadRecommendations([id])
    return true
  }

  function resetDraftFocus() {
    lastActiveExerciseId.value = null
    lastActiveExerciseIndex.value = null
    lastActiveSetIndex.value = null
  }

  function updateDraftFocus(exerciseIndex: number, setIndex?: number | null) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise) return
    const nextSetIndex = exercise.sets.findIndex((set) => !set.done)
    lastActiveExerciseId.value = exercise.id
    lastActiveExerciseIndex.value = exerciseIndex
    lastActiveSetIndex.value = setIndex ?? (nextSetIndex >= 0 ? nextSetIndex : null)
  }

  function resolveDraftFocusIndex() {
    if (!activeExercises.value.length) return 0

    if (lastActiveExerciseId.value !== null) {
      const matchedIndex = activeExercises.value.findIndex(
        (exercise) => exercise.id === lastActiveExerciseId.value
      )
      if (matchedIndex >= 0) return matchedIndex
    }

    if (
      lastActiveExerciseIndex.value !== null &&
      lastActiveExerciseIndex.value >= 0 &&
      lastActiveExerciseIndex.value < activeExercises.value.length
    ) {
      return lastActiveExerciseIndex.value
    }

    const firstUnfinishedIndex = activeExercises.value.findIndex(
      (exercise) => !exercise.ended && exercise.sets.some((set) => !set.done)
    )
    if (firstUnfinishedIndex >= 0) return firstUnfinishedIndex

    return Math.max(activeExercises.value.length - 1, 0)
  }

  function toggleSet(exerciseIndex: number, setIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      const targetSet = exercise.sets[setIndex]
      const nextDone = !targetSet?.done
      return {
        ...exercise,
        ended: nextDone ? exercise.ended : false,
        sets: exercise.sets.map((set, innerIndex) =>
          innerIndex === setIndex
            ? {
                ...set,
                done: nextDone,
                completedAt: nextDone ? new Date().toISOString() : undefined
              }
            : set
        )
      }
    })
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex, setIndex)
    persistDraft()
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) {
    const targetSet = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (
      !targetSet ||
      targetSet.done ||
      !Object.entries(patch).some(([key, value]) => targetSet[key as keyof WorkoutSet] !== value)
    ) {
      return
    }
    const marksRecommendationDirty =
      (targetSet.setType || 'NORMAL') === 'NORMAL' &&
      ['weight', 'reps', 'durationSeconds'].some((key) => key in patch)
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set, innerIndex) =>
          innerIndex === setIndex && !set.done ? { ...set, ...patch } : set
        )
      }
    })
    markRecommendationDirtyIfNeeded(exerciseIndex, marksRecommendationDirty)
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex, setIndex)
    persistDraft()
  }

  function adjustWeight(exerciseIndex: number, setIndex: number, deltaKg: number) {
    if (isBodyweightRecord(activeExercises.value[exerciseIndex]?.recordType)) return
    const set = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (!set || set.done) return
    updateSet(exerciseIndex, setIndex, {
      weight: Math.max(0, Number((set.weight + deltaKg).toFixed(2)))
    })
  }

  function adjustReps(exerciseIndex: number, setIndex: number, delta: number) {
    if (isDurationRecord(activeExercises.value[exerciseIndex]?.recordType)) return
    const set = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (!set || set.done) return
    updateSet(exerciseIndex, setIndex, {
      reps: Math.max(0, set.reps + delta)
    })
  }

  function adjustDuration(exerciseIndex: number, setIndex: number, deltaSeconds: number) {
    if (!isDurationRecord(activeExercises.value[exerciseIndex]?.recordType)) return
    const set = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (!set || set.done) return
    updateSet(exerciseIndex, setIndex, {
      durationSeconds: Math.max(1, (set.durationSeconds || 60) + deltaSeconds)
    })
  }

  function addSet(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      const lastSet = exercise.sets[exercise.sets.length - 1] ?? {
        reps: isDurationRecord(exercise.recordType) ? 1 : 12,
        weight:
          isBodyweightRecord(exercise.recordType) || isDurationRecord(exercise.recordType) ? 0 : 20,
        durationSeconds: isDurationRecord(exercise.recordType) ? 60 : undefined,
        setType: 'NORMAL' as const,
        note: '',
        done: false
      }
      return {
        ...exercise,
        ended: false,
        sets: [...exercise.sets, { ...lastSet, done: false, completedAt: undefined }]
      }
    })
    markRecommendationDirtyIfNeeded(exerciseIndex, true)
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
  }

  function deleteLastSet(exerciseIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    const lastSet = exercise?.sets[exercise.sets.length - 1]
    if (!exercise || !lastSet || lastSet.done) {
      return false
    }

    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex ? { ...item, sets: item.sets.slice(0, -1) } : item
    )
    markRecommendationDirtyIfNeeded(exerciseIndex, (lastSet.setType || 'NORMAL') === 'NORMAL')
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
    return true
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    const exercise = activeExercises.value[exerciseIndex]
    if (!exercise || exercise.sets.length <= 1) {
      return false
    }

    activeExercises.value = activeExercises.value.map((item, index) =>
      index === exerciseIndex
        ? { ...item, sets: item.sets.filter((_, idx) => idx !== setIndex) }
        : item
    )
    markRecommendationDirtyIfNeeded(
      exerciseIndex,
      (exercise.sets[setIndex]?.setType || 'NORMAL') === 'NORMAL'
    )
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
    return true
  }

  function addExercise(
    id: number,
    name: string,
    muscle: string,
    recordType: WorkoutRecordType = 'WEIGHT_REPS',
    equipment?: string
  ) {
    ensureWorkoutSession()
    if (hasExercise(id)) {
      return false
    }
    activeExercises.value.push({
      id,
      name,
      muscle,
      equipment,
      recordType,
      ended: false,
      restSeconds: useProfileStore().restSeconds,
      effortPromptHandled: false,
      sets: createSetsFromTemplateTargets(1, recordType)
    })
    markWorkoutDirty()
    updateDraftFocus(activeExercises.value.length - 1)
    persistDraft()
    fetchExerciseLastPerformance(id)
      .then((performance) => {
        lastPerformanceMap.value = {
          ...lastPerformanceMap.value,
          [id]: performance
        }
        persistDraft()
      })
      .catch((err) => {
        console.error('[workout] last performance fetch failed', { exerciseId: id, err })
      })
    void loadRecommendations([id])
    return true
  }

  function addExercises(
    exercises: Array<{
      id: number
      name: string
      muscle: string
      recordType?: WorkoutRecordType
      equipment?: string
    }>
  ) {
    ensureWorkoutSession()
    const existingIds = new Set(activeExercises.value.map((item) => item.id))
    const unique = exercises.filter((item, index, list) => {
      if (existingIds.has(item.id)) return false
      return list.findIndex((candidate) => candidate.id === item.id) === index
    })
    if (!unique.length) {
      return { addedIds: [] as number[], duplicateIds: exercises.map((item) => item.id) }
    }
    const firstAddedIndex = activeExercises.value.length
    activeExercises.value = [
      ...activeExercises.value,
      ...unique.map((item) => {
        const recordType = item.recordType || 'WEIGHT_REPS'
        return {
          id: item.id,
          name: item.name,
          muscle: item.muscle,
          equipment: item.equipment,
          recordType,
          ended: false,
          restSeconds: useProfileStore().restSeconds,
          effortPromptHandled: false,
          sets: createSetsFromTemplateTargets(1, recordType)
        }
      })
    ]
    markWorkoutDirty()
    updateDraftFocus(firstAddedIndex)
    persistDraft()
    const addedIds = unique.map((item) => item.id)
    void loadLastPerformances(addedIds)
    void loadRecommendations(addedIds)
    return {
      addedIds,
      duplicateIds: exercises.filter((item) => !addedIds.includes(item.id)).map((item) => item.id)
    }
  }

  function removeExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.filter((_, index) => index !== exerciseIndex)
    markWorkoutDirty()
    if (activeExercises.value.length) {
      updateDraftFocus(Math.min(exerciseIndex, activeExercises.value.length - 1))
    } else {
      resetDraftFocus()
    }
    persistDraft()
  }

  function endExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, ended: true } : exercise
    )
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
  }

  function reopenExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, ended: false } : exercise
    )
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
  }

  function finishWorkout() {
    activeTemplateId.value = null
    activePlanId.value = null
    activePlanDayId.value = null
    activeExecutionId.value = null
    activeExecutionDayId.value = null
    activeExecutionDayTitle.value = null
    activeTemplateName.value = '自由训练'
    clientRequestId.value = ''
    startedAt.value = null
    elapsedSeconds.value = 0
    pausedAtMs.value = null
    accumulatedPausedSeconds.value = 0
    sessionState.value = 'RUNNING'
    suspendedAtMs.value = null
    accumulatedSuspendedSeconds.value = 0
    workoutDirty.value = false
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
    recommendationMap.value = {}
    appliedRecommendationSnapshots.value = {}
    draftStatus.value = 'ACTIVE'
    lastSubmitPayload.value = null
    resetDraftFocus()
    clearDraft()
  }

  function setCompletedSummary(summary: CompletedWorkoutSummary | null) {
    completedSummary.value = summary
  }

  function markSaveFailed(payload: SaveTrainingRequest) {
    lastSubmitPayload.value = payload
    draftStatus.value = 'SAVE_FAILED'
    workoutDirty.value = true
    persistDraft()
  }

  function clearSaveFailure() {
    lastSubmitPayload.value = null
    draftStatus.value = 'ACTIVE'
    persistDraft()
  }

  function persistDraft() {
    const activeStartedAt = startedAt.value
    if (!workoutDirty.value || !activeStartedAt || !activeExercises.value.length) {
      clearDraft()
      return
    }
    const draft: WorkoutDraft = {
      version: WORKOUT_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      status: draftStatus.value || 'ACTIVE',
      activeTemplateId: activeTemplateId.value,
      activePlanId: activePlanId.value,
      activePlanDayId: activePlanDayId.value,
      activeExecutionId: activeExecutionId.value,
      activeExecutionDayId: activeExecutionDayId.value,
      activeExecutionDayTitle: activeExecutionDayTitle.value,
      activeTemplateName: activeTemplateName.value,
      clientRequestId: ensureClientRequestId(),
      startedAt: activeStartedAt,
      elapsedSeconds: elapsedSeconds.value,
      pausedAtMs: pausedAtMs.value,
      accumulatedPausedSeconds: accumulatedPausedSeconds.value,
      sessionState: sessionState.value,
      suspendedAtMs: suspendedAtMs.value,
      accumulatedSuspendedSeconds: accumulatedSuspendedSeconds.value,
      activeExercises: activeExercises.value,
      lastActiveExerciseId: lastActiveExerciseId.value,
      lastActiveExerciseIndex: lastActiveExerciseIndex.value,
      lastActiveSetIndex: lastActiveSetIndex.value,
      appliedRecommendationSnapshots: appliedRecommendationSnapshots.value,
      lastSubmitPayload: lastSubmitPayload.value || undefined
    }
    uni.setStorageSync(WORKOUT_DRAFT_KEY, draft)
    draftSnapshot.value = draft
    hasDraft.value = true
    draftSavedAt.value = draft.savedAt
  }

  function clearDraft() {
    uni.removeStorageSync(WORKOUT_DRAFT_KEY)
    draftSnapshot.value = null
    hasDraft.value = false
    draftSavedAt.value = ''
    draftStatus.value = 'ACTIVE'
    lastSubmitPayload.value = null
  }

  function refreshDraftState() {
    const draft = readWorkoutDraft()
    draftSnapshot.value = draft
    hasDraft.value = Boolean(draft)
    draftSavedAt.value = draft?.savedAt || ''
    draftStatus.value = draft?.status || 'ACTIVE'
    lastSubmitPayload.value = draft?.lastSubmitPayload || null
  }

  function restoreDraft() {
    if (hasActiveWorkout.value) return true
    const draft = readWorkoutDraft()
    if (!draft) {
      draftSnapshot.value = null
      hasDraft.value = false
      return false
    }
    activeTemplateId.value = draft.activeTemplateId
    activePlanId.value = draft.activePlanId ?? null
    activePlanDayId.value = draft.activePlanDayId ?? null
    activeExecutionId.value = draft.activeExecutionId ?? null
    activeExecutionDayId.value = draft.activeExecutionDayId ?? null
    activeExecutionDayTitle.value = draft.activeExecutionDayTitle ?? null
    activeTemplateName.value = draft.activeTemplateName || '自由训练'
    clientRequestId.value = draft.clientRequestId || createClientRequestId()
    startedAt.value = draft.startedAt
    elapsedSeconds.value = draft.elapsedSeconds || 0
    pausedAtMs.value = draft.pausedAtMs ?? null
    accumulatedPausedSeconds.value = draft.accumulatedPausedSeconds ?? 0
    sessionState.value = draft.sessionState || 'SAVED_DRAFT'
    suspendedAtMs.value =
      draft.suspendedAtMs ??
      (sessionState.value === 'SAVED_DRAFT' ? new Date(draft.savedAt).getTime() : null)
    accumulatedSuspendedSeconds.value = draft.accumulatedSuspendedSeconds ?? 0
    workoutDirty.value = true
    lastActiveExerciseId.value = draft.lastActiveExerciseId ?? null
    lastActiveExerciseIndex.value = draft.lastActiveExerciseIndex ?? null
    lastActiveSetIndex.value = draft.lastActiveSetIndex ?? null
    appliedRecommendationSnapshots.value = draft.appliedRecommendationSnapshots || {}
    draftStatus.value = draft.status || 'ACTIVE'
    lastSubmitPayload.value = draft.lastSubmitPayload || null
    activeExercises.value = draft.activeExercises.map((exercise) => {
      const recordType = exercise.recordType || 'WEIGHT_REPS'
      return {
        ...exercise,
        recordType,
        restSeconds: exercise.restSeconds ?? useProfileStore().restSeconds,
        effortPromptHandled: exercise.effortPromptHandled ?? false,
        sets: exercise.sets.map((set) => ({
          ...set,
          reps: isDurationRecord(recordType) ? 1 : set.reps,
          weight: isBodyweightRecord(recordType) || isDurationRecord(recordType) ? 0 : set.weight,
          durationSeconds: isDurationRecord(recordType) ? set.durationSeconds || 60 : undefined
        }))
      }
    })
    draftSnapshot.value = draft
    hasDraft.value = true
    draftSavedAt.value = draft.savedAt
    loadLastPerformances()
    void loadRecommendations()
    return true
  }

  function discardWorkout() {
    activeTemplateId.value = null
    activePlanId.value = null
    activePlanDayId.value = null
    activeExecutionId.value = null
    activeExecutionDayId.value = null
    activeExecutionDayTitle.value = null
    activeTemplateName.value = '自由训练'
    clientRequestId.value = ''
    startedAt.value = null
    elapsedSeconds.value = 0
    pausedAtMs.value = null
    accumulatedPausedSeconds.value = 0
    sessionState.value = 'RUNNING'
    suspendedAtMs.value = null
    accumulatedSuspendedSeconds.value = 0
    workoutDirty.value = false
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
    recommendationMap.value = {}
    appliedRecommendationSnapshots.value = {}
    draftStatus.value = 'ACTIVE'
    lastSubmitPayload.value = null
    resetDraftFocus()
    clearDraft()
  }

  function ensureClientRequestId() {
    if (!clientRequestId.value) {
      clientRequestId.value = createClientRequestId()
    }
    return clientRequestId.value
  }

  function markWorkoutDirty() {
    workoutDirty.value = true
  }

  return {
    activeTemplateId,
    activePlanId,
    activePlanDayId,
    activeExecutionId,
    activeExecutionDayId,
    activeExecutionDayTitle,
    activeTemplateName,
    clientRequestId,
    startedAt,
    elapsedSeconds,
    pausedAtMs,
    accumulatedPausedSeconds,
    sessionState,
    suspendedAtMs,
    accumulatedSuspendedSeconds,
    isPaused,
    isSavedDraft,
    activeExercises,
    completedSummary,
    lastPerformanceMap,
    recommendationMap,
    lastActiveExerciseId,
    lastActiveExerciseIndex,
    lastActiveSetIndex,
    hasPendingStart,
    pendingStartTemplateId,
    pendingStartPlanId,
    pendingStartPlanDayId,
    pendingStartExecutionId,
    pendingStartExecutionDayId,
    pendingStartExecutionDayTitle,
    pendingStartExecutionItems,
    hasDraft,
    draftSavedAt,
    draftStatus,
    lastSubmitPayload,
    draftSummary,
    draftElapsedText,
    draftExerciseCount,
    draftDoneSets,
    totalSets,
    doneSets,
    progress,
    totalVolume,
    hasActiveWorkout,
    hasMeaningfulDraft,
    hasRecoverableWorkout,
    hasSaveFailedDraft,
    hasExpiredDraft,
    sourceType,
    queueStartWorkout,
    clearPendingStart,
    startWorkout,
    startFreeWorkout,
    ensureWorkoutSession,
    hasExercise,
    loadLastPerformances,
    getLastPerformance,
    loadRecommendations,
    setSetType,
    setEffort,
    markEffortPromptHandled,
    setExerciseRestSeconds,
    syncElapsed,
    pauseWorkout,
    resumeWorkout,
    minimizeWorkout,
    saveDraftAndStop,
    resumeSavedDraft,
    applyRecommendation,
    dismissRecommendation,
    applyLastPerformance,
    generateWarmupSets,
    insertWarmupSets,
    removeWarmupSets,
    reportRecommendationOverrideIfNeeded,
    reportAllRecommendationOverrides,
    toggleSupersetWithNext,
    removeSuperset,
    replaceExercise,
    updateDraftFocus,
    resolveDraftFocusIndex,
    toggleSet,
    updateSet,
    adjustWeight,
    adjustReps,
    adjustDuration,
    addSet,
    deleteLastSet,
    removeSet,
    addExercise,
    addExercises,
    removeExercise,
    endExercise,
    reopenExercise,
    finishWorkout,
    setCompletedSummary,
    markSaveFailed,
    clearSaveFailure,
    persistDraft,
    clearDraft,
    refreshDraftState,
    restoreDraft,
    ensureClientRequestId,
    discardWorkout
  }
})
