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
const WORKOUT_DRAFT_VERSION = 1

export type WorkoutSet = { reps: number; weight: number; done: boolean; completedAt?: string }
export type WorkoutExercise = {
  id: number
  name: string
  muscle: string
  ended?: boolean
  sets: WorkoutSet[]
}
export type CompletedWorkoutSummary = SaveTrainingResponse & {
  trainingName: string
  startedAt: string
  endedAt: string
}
type WorkoutDraft = {
  version: number
  savedAt: string
  activeTemplateId: number | null
  activeTemplateName: string
  startedAt: string
  elapsedSeconds: number
  activeExercises: WorkoutExercise[]
}

function createEmptyWorkout() {
  return [] as WorkoutExercise[]
}

function createDefaultSet(performanceSet?: ExerciseLastPerformanceSetResponse): WorkoutSet {
  return {
    reps: performanceSet?.reps ?? 10,
    weight: Number(performanceSet?.weightKg ?? 20),
    done: false
  }
}

function createSetsFromPerformance(
  targetSets: number,
  performance?: ExerciseLastPerformanceResponse
) {
  const sourceSets = performance?.sets || []
  return Array.from({ length: targetSets }, (_, index) =>
    createDefaultSet(sourceSets[index] || sourceSets[sourceSets.length - 1])
  )
}

function readWorkoutDraft() {
  try {
    const draft = uni.getStorageSync(WORKOUT_DRAFT_KEY) as WorkoutDraft | undefined
    if (
      !draft ||
      draft.version !== WORKOUT_DRAFT_VERSION ||
      !Array.isArray(draft.activeExercises)
    ) {
      return null
    }
    return draft
  } catch {
    return null
  }
}

export const useWorkoutStore = defineStore('workout', () => {
  const activeTemplateId = ref<number | null>(null)
  const activeTemplateName = ref('自由训练')
  const startedAt = ref<string | null>(null)
  const elapsedSeconds = ref(0)
  const activeExercises = ref<WorkoutExercise[]>(createEmptyWorkout())
  const completedSummary = ref<CompletedWorkoutSummary | null>(null)
  const lastPerformanceMap = ref<Record<number, ExerciseLastPerformanceResponse>>({})
  const hasPendingStart = ref(false)
  const pendingStartTemplateId = ref<number | null>(null)
  const hasDraft = ref(Boolean(readWorkoutDraft()))
  const draftSavedAt = ref(readWorkoutDraft()?.savedAt || '')

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
          .reduce((setSum, set) => setSum + set.weight * set.reps, 0),
      0
    )
  )
  const hasActiveWorkout = computed(() => Boolean(startedAt.value && activeExercises.value.length))
  const hasRecoverableWorkout = computed(() => hasActiveWorkout.value || hasDraft.value)

  async function startWorkout(templateId: number | null) {
    const templateStore = useTemplateStore()
    activeTemplateId.value = templateId
    activeTemplateName.value = templateStore.getById(templateId)?.name ?? '自由训练'
    startedAt.value = new Date().toISOString()
    elapsedSeconds.value = 0

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
      ended: false,
      sets: createSetsFromPerformance(item.targetSets, lastPerformanceMap.value[item.exerciseId])
    }))
    persistDraft()
  }

  function queueStartWorkout(templateId: number | null) {
    hasPendingStart.value = true
    pendingStartTemplateId.value = templateId
  }

  function clearPendingStart() {
    hasPendingStart.value = false
    pendingStartTemplateId.value = null
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
    persistDraft()
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set, innerIndex) =>
          innerIndex === setIndex && !set.done ? { ...set, ...patch } : set
        )
      }
    })
    persistDraft()
  }

  function adjustWeight(exerciseIndex: number, setIndex: number, deltaKg: number) {
    const set = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (!set || set.done) return
    updateSet(exerciseIndex, setIndex, {
      weight: Math.max(0, Number((set.weight + deltaKg).toFixed(2)))
    })
  }

  function adjustReps(exerciseIndex: number, setIndex: number, delta: number) {
    const set = activeExercises.value[exerciseIndex]?.sets[setIndex]
    if (!set || set.done) return
    updateSet(exerciseIndex, setIndex, {
      reps: Math.max(0, set.reps + delta)
    })
  }

  function addSet(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      const lastSet = exercise.sets[exercise.sets.length - 1] ?? {
        reps: 12,
        weight: 20,
        done: false
      }
      return {
        ...exercise,
        ended: false,
        sets: [...exercise.sets, { ...lastSet, done: false }]
      }
    })
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
    persistDraft()
    return true
  }

  function addExercise(id: number, name: string, muscle: string) {
    if (activeExercises.value.some((item) => item.id === id)) {
      return
    }
    const performance = lastPerformanceMap.value[id]
    activeExercises.value.push({
      id,
      name,
      muscle,
      ended: false,
      sets: createSetsFromPerformance(1, performance)
    })
    persistDraft()
    fetchExerciseLastPerformance(id)
      .then((performance) => {
        lastPerformanceMap.value = {
          ...lastPerformanceMap.value,
          [id]: performance
        }
        activeExercises.value = activeExercises.value.map((exercise) =>
          exercise.id === id && exercise.sets.length === 1 && !exercise.sets[0].done
            ? { ...exercise, sets: createSetsFromPerformance(1, performance) }
            : exercise
        )
        persistDraft()
      })
      .catch((err) => {
        console.error('[workout] last performance fetch failed', { exerciseId: id, err })
      })
  }

  function removeExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.filter((_, index) => index !== exerciseIndex)
    persistDraft()
  }

  function endExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, ended: true } : exercise
    )
    persistDraft()
  }

  function reopenExercise(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, ended: false } : exercise
    )
    persistDraft()
  }

  function finishWorkout() {
    activeTemplateId.value = null
    activeTemplateName.value = '自由训练'
    startedAt.value = null
    elapsedSeconds.value = 0
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
    clearDraft()
  }

  function setCompletedSummary(summary: CompletedWorkoutSummary | null) {
    completedSummary.value = summary
  }

  function persistDraft() {
    if (!startedAt.value || !activeExercises.value.length) {
      clearDraft()
      return
    }
    const draft: WorkoutDraft = {
      version: WORKOUT_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      activeTemplateId: activeTemplateId.value,
      activeTemplateName: activeTemplateName.value,
      startedAt: startedAt.value,
      elapsedSeconds: elapsedSeconds.value,
      activeExercises: activeExercises.value
    }
    uni.setStorageSync(WORKOUT_DRAFT_KEY, draft)
    hasDraft.value = true
    draftSavedAt.value = draft.savedAt
  }

  function clearDraft() {
    uni.removeStorageSync(WORKOUT_DRAFT_KEY)
    hasDraft.value = false
    draftSavedAt.value = ''
  }

  function refreshDraftState() {
    const draft = readWorkoutDraft()
    hasDraft.value = Boolean(draft)
    draftSavedAt.value = draft?.savedAt || ''
  }

  function restoreDraft() {
    if (hasActiveWorkout.value) return true
    const draft = readWorkoutDraft()
    if (!draft) {
      hasDraft.value = false
      return false
    }
    activeTemplateId.value = draft.activeTemplateId
    activeTemplateName.value = draft.activeTemplateName || '自由训练'
    startedAt.value = draft.startedAt
    elapsedSeconds.value = draft.elapsedSeconds || 0
    activeExercises.value = draft.activeExercises
    hasDraft.value = true
    draftSavedAt.value = draft.savedAt
    loadLastPerformances()
    return true
  }

  function discardWorkout() {
    activeTemplateId.value = null
    activeTemplateName.value = '自由训练'
    startedAt.value = null
    elapsedSeconds.value = 0
    activeExercises.value = createEmptyWorkout()
    lastPerformanceMap.value = {}
    clearDraft()
  }

  return {
    activeTemplateId,
    activeTemplateName,
    startedAt,
    elapsedSeconds,
    activeExercises,
    completedSummary,
    lastPerformanceMap,
    hasPendingStart,
    pendingStartTemplateId,
    hasDraft,
    draftSavedAt,
    totalSets,
    doneSets,
    progress,
    totalVolume,
    hasActiveWorkout,
    hasRecoverableWorkout,
    queueStartWorkout,
    clearPendingStart,
    startWorkout,
    loadLastPerformances,
    getLastPerformance,
    toggleSet,
    updateSet,
    adjustWeight,
    adjustReps,
    addSet,
    deleteLastSet,
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
    discardWorkout
  }
})
