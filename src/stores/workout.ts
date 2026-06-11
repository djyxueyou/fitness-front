import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchExerciseLastPerformances,
  fetchExerciseLastPerformance,
  type ExerciseLastPerformanceResponse,
  type ExerciseLastPerformanceSetResponse,
  type SaveTrainingResponse
} from '@/api/training'
import { useTemplateStore } from '@/stores/template'

const WORKOUT_DRAFT_KEY = 'LIFTLOG_WORKOUT_DRAFT'
const WORKOUT_DRAFT_VERSION = 3
const WORKOUT_DRAFT_TTL_MS = 6 * 60 * 60 * 1000

export type WorkoutRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
export type WorkoutSet = {
  reps: number
  weight: number
  durationSeconds?: number
  setType?: 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE'
  note?: string
  done: boolean
  completedAt?: string
}
export type WorkoutExercise = {
  id: number
  name: string
  muscle: string
  recordType: WorkoutRecordType
  ended?: boolean
  sets: WorkoutSet[]
}
export type CompletedWorkoutSummary = SaveTrainingResponse & {
  trainingName: string
  startedAt: string
  endedAt: string
  activeTemplateId?: number | null
  activePlanId?: number | null
  activePlanDayId?: number | null
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
  activeTemplateId: number | null
  activePlanId?: number | null
  activePlanDayId?: number | null
  activeTemplateName: string
  clientRequestId?: string
  startedAt: string
  elapsedSeconds: number
  activeExercises: WorkoutExercise[]
  lastActiveExerciseId?: number | null
  lastActiveExerciseIndex?: number | null
  lastActiveSetIndex?: number | null
}

type StoredWorkoutDraft = Omit<WorkoutDraft, 'version'> & {
  version: number
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
      uni.removeStorageSync(WORKOUT_DRAFT_KEY)
      return null
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

export const useWorkoutStore = defineStore('workout', () => {
  const initialDraft = readWorkoutDraft()
  const activeTemplateId = ref<number | null>(null)
  const activePlanId = ref<number | null>(null)
  const activePlanDayId = ref<number | null>(null)
  const activeTemplateName = ref('自由训练')
  const clientRequestId = ref('')
  const startedAt = ref<string | null>(null)
  const elapsedSeconds = ref(0)
  const activeExercises = ref<WorkoutExercise[]>(createEmptyWorkout())
  const lastActiveExerciseId = ref<number | null>(null)
  const lastActiveExerciseIndex = ref<number | null>(null)
  const lastActiveSetIndex = ref<number | null>(null)
  const completedSummary = ref<CompletedWorkoutSummary | null>(null)
  const lastPerformanceMap = ref<Record<number, ExerciseLastPerformanceResponse>>({})
  const hasPendingStart = ref(false)
  const pendingStartTemplateId = ref<number | null>(null)
  const pendingStartPlanId = ref<number | null>(null)
  const pendingStartPlanDayId = ref<number | null>(null)
  const draftSnapshot = ref<WorkoutDraft | null>(initialDraft)
  const hasDraft = ref(Boolean(initialDraft))
  const draftSavedAt = ref(initialDraft?.savedAt || '')
  const workoutDirty = ref(false)

  const totalSets = computed(() =>
    activeExercises.value.reduce((total, exercise) => total + exercise.sets.length, 0)
  )
  const doneSets = computed(() =>
    activeExercises.value.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
      0
    )
  )
  const progress = computed(() => (totalSets.value ? doneSets.value / totalSets.value : 0))
  const totalVolume = computed(() =>
    activeExercises.value.reduce(
      (sum, exercise) =>
        sum +
        exercise.sets
          .filter((set) => set.done)
          .reduce(
            (setSum, set) =>
              setSum + (isDurationRecord(exercise.recordType) ? 0 : set.weight * set.reps),
            0
          ),
      0
    )
  )
  const hasActiveWorkout = computed(() => Boolean(startedAt.value && activeExercises.value.length))
  const hasMeaningfulDraft = computed(
    () => Boolean(workoutDirty.value && startedAt.value && activeExercises.value.length)
  )
  const hasRecoverableWorkout = computed(() => hasMeaningfulDraft.value || hasDraft.value)
  const draftSource = computed(() =>
    hasMeaningfulDraft.value
      ? {
          activeTemplateName: activeTemplateName.value,
          elapsedSeconds: elapsedSeconds.value,
          activeExercises: activeExercises.value,
          savedAt: draftSavedAt.value
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
  const draftElapsedText = computed(() => formatDraftDuration(draftSource.value?.elapsedSeconds || 0))
  const draftSummary = computed(() => ({
    title: draftSource.value?.activeTemplateName || '自由训练',
    durationText: draftElapsedText.value,
    exerciseCount: draftExerciseCount.value,
    doneSets: draftDoneSets.value,
    savedAt: draftSource.value?.savedAt || ''
  }))
  const sourceType = computed<'PLAN' | 'TEMPLATE' | 'FREE'>(() => {
    if (activePlanId.value && activePlanDayId.value) return 'PLAN'
    if (activeTemplateId.value) return 'TEMPLATE'
    return 'FREE'
  })

  function startFreeWorkout() {
    activeTemplateId.value = null
    activePlanId.value = null
    activePlanDayId.value = null
    activeTemplateName.value = '自由训练'
    clientRequestId.value = createClientRequestId()
    startedAt.value = new Date().toISOString()
    elapsedSeconds.value = 0
    workoutDirty.value = false
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
    context?: { planId?: number | null; planDayId?: number | null }
  ) {
    const templateStore = useTemplateStore()
    activeTemplateId.value = templateId
    activePlanId.value = context?.planId ?? null
    activePlanDayId.value = context?.planDayId ?? null
    activeTemplateName.value = templateStore.getById(templateId)?.name ?? '自由训练'
    clientRequestId.value = createClientRequestId()
    startedAt.value = new Date().toISOString()
    elapsedSeconds.value = 0
    workoutDirty.value = false
    resetDraftFocus()

    if (!templateId) {
      activeExercises.value = createEmptyWorkout()
      clearDraft()
      return
    }

    const detail = await templateStore.getDetail(templateId)
    activeTemplateName.value = detail.name
    const exerciseIds = detail.items.map((item) => item.exerciseId)
    await loadLastPerformances(exerciseIds)
    activeExercises.value = detail.items.map((item) => ({
      id: item.exerciseId,
      name: item.exerciseName,
      muscle: '',
      recordType: item.recordType || 'WEIGHT_REPS',
      ended: false,
      sets: createSetsFromTemplateTargets(
        item.targetSets,
        item.recordType || 'WEIGHT_REPS',
        {
          targetWeightKg: item.targetWeightKg,
          targetReps: item.targetReps,
          targetDurationSeconds: item.targetDurationSeconds
        }
      )
    }))
    updateDraftFocus(0)
  }

  function queueStartWorkout(
    templateId: number | null,
    context?: { planId?: number | null; planDayId?: number | null }
  ) {
    hasPendingStart.value = true
    pendingStartTemplateId.value = templateId
    pendingStartPlanId.value = context?.planId ?? null
    pendingStartPlanDayId.value = context?.planDayId ?? null
  }

  function clearPendingStart() {
    hasPendingStart.value = false
    pendingStartTemplateId.value = null
    pendingStartPlanId.value = null
    pendingStartPlanDayId.value = null
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
      !Object.entries(patch).some(
        ([key, value]) => targetSet[key as keyof WorkoutSet] !== value
      )
    ) {
      return
    }
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set, innerIndex) =>
          innerIndex === setIndex && !set.done ? { ...set, ...patch } : set
        )
      }
    })
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
    markWorkoutDirty()
    updateDraftFocus(exerciseIndex)
    persistDraft()
    return true
  }

  function addExercise(
    id: number,
    name: string,
    muscle: string,
    recordType: WorkoutRecordType = 'WEIGHT_REPS'
  ) {
    ensureWorkoutSession()
    if (hasExercise(id)) {
      return false
    }
    activeExercises.value.push({
      id,
      name,
      muscle,
      recordType,
      ended: false,
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
    return true
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
    activeTemplateName.value = '自由训练'
    clientRequestId.value = ''
    startedAt.value = null
    elapsedSeconds.value = 0
    workoutDirty.value = false
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
    resetDraftFocus()
    clearDraft()
  }

  function setCompletedSummary(summary: CompletedWorkoutSummary | null) {
    completedSummary.value = summary
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
      activeTemplateId: activeTemplateId.value,
      activePlanId: activePlanId.value,
      activePlanDayId: activePlanDayId.value,
      activeTemplateName: activeTemplateName.value,
      clientRequestId: ensureClientRequestId(),
      startedAt: activeStartedAt,
      elapsedSeconds: elapsedSeconds.value,
      activeExercises: activeExercises.value,
      lastActiveExerciseId: lastActiveExerciseId.value,
      lastActiveExerciseIndex: lastActiveExerciseIndex.value,
      lastActiveSetIndex: lastActiveSetIndex.value
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
  }

  function refreshDraftState() {
    const draft = readWorkoutDraft()
    draftSnapshot.value = draft
    hasDraft.value = Boolean(draft)
    draftSavedAt.value = draft?.savedAt || ''
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
    activeTemplateName.value = draft.activeTemplateName || '自由训练'
    clientRequestId.value = draft.clientRequestId || createClientRequestId()
    startedAt.value = draft.startedAt
    elapsedSeconds.value = draft.elapsedSeconds || 0
    workoutDirty.value = true
    lastActiveExerciseId.value = draft.lastActiveExerciseId ?? null
    lastActiveExerciseIndex.value = draft.lastActiveExerciseIndex ?? null
    lastActiveSetIndex.value = draft.lastActiveSetIndex ?? null
    activeExercises.value = draft.activeExercises.map((exercise) => {
      const recordType = exercise.recordType || 'WEIGHT_REPS'
      return {
        ...exercise,
        recordType,
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
    return true
  }

  function discardWorkout() {
    activeTemplateId.value = null
    activePlanId.value = null
    activePlanDayId.value = null
    activeTemplateName.value = '自由训练'
    clientRequestId.value = ''
    startedAt.value = null
    elapsedSeconds.value = 0
    workoutDirty.value = false
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
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
    activeTemplateName,
    clientRequestId,
    startedAt,
    elapsedSeconds,
    activeExercises,
    completedSummary,
    lastPerformanceMap,
    lastActiveExerciseId,
    lastActiveExerciseIndex,
    lastActiveSetIndex,
    hasPendingStart,
    pendingStartTemplateId,
    pendingStartPlanId,
    pendingStartPlanDayId,
    hasDraft,
    draftSavedAt,
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
    sourceType,
    queueStartWorkout,
    clearPendingStart,
    startWorkout,
    startFreeWorkout,
    ensureWorkoutSession,
    hasExercise,
    loadLastPerformances,
    getLastPerformance,
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
    removeExercise,
    endExercise,
    reopenExercise,
    finishWorkout,
    setCompletedSummary,
    persistDraft,
    clearDraft,
    refreshDraftState,
    restoreDraft,
    ensureClientRequestId,
    discardWorkout
  }
})
