import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchTemplateDetail } from '@/api/template'
import { useTemplateStore } from '@/stores/template'

type WorkoutSet = { reps: number; weight: number; done: boolean }
type WorkoutExercise = { id: number; name: string; muscle: string; sets: WorkoutSet[] }

const baseWorkoutExercises: WorkoutExercise[] = [
  {
    id: 1,
    name: '卧推',
    muscle: '胸大肌',
    sets: [
      { reps: 10, weight: 60, done: true },
      { reps: 10, weight: 65, done: true },
      { reps: 8, weight: 70, done: false }
    ]
  },
  {
    id: 2,
    name: '飞鸟',
    muscle: '胸大肌',
    sets: [
      { reps: 12, weight: 20, done: false },
      { reps: 12, weight: 20, done: false },
      { reps: 12, weight: 22, done: false }
    ]
  },
  {
    id: 3,
    name: '下压',
    muscle: '肱三头肌',
    sets: [
      { reps: 15, weight: 30, done: false },
      { reps: 15, weight: 32, done: false }
    ]
  }
]

function cloneBaseExercises() {
  return baseWorkoutExercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set }))
  }))
}

export const useWorkoutStore = defineStore('workout', () => {
  const activeTemplateId = ref<number | null>(null)
  const activeTemplateName = ref('自由训练')
  const elapsedSeconds = ref(0)
  const activeExercises = ref<WorkoutExercise[]>(cloneBaseExercises())

  const totalSets = computed(() =>
    activeExercises.value.reduce((total, exercise) => total + exercise.sets.length, 0)
  )
  const doneSets = computed(() =>
    activeExercises.value.reduce((total, exercise) => total + exercise.sets.filter((set) => set.done).length, 0)
  )
  const progress = computed(() => totalSets.value ? doneSets.value / totalSets.value : 0)
  const totalVolume = computed(() =>
    activeExercises.value.reduce(
      (sum, exercise) =>
        sum + exercise.sets.filter((set) => set.done).reduce((setSum, set) => setSum + set.weight * set.reps, 0),
      0
    )
  )

  async function startWorkout(templateId: number | null) {
    const templateStore = useTemplateStore()
    activeTemplateId.value = templateId
    activeTemplateName.value = templateStore.getById(templateId)?.name ?? '自由训练'
    elapsedSeconds.value = 0
    if (templateId == null) {
      activeExercises.value = cloneBaseExercises()
      return
    }

    const detail = await fetchTemplateDetail(templateId)
    activeTemplateName.value = detail.name
    activeExercises.value = detail.items.map((item) => ({
      id: item.exerciseId,
      name: item.exerciseName,
      muscle: '',
      sets: Array.from({ length: item.targetSets }, () => ({ reps: 10, weight: 20, done: false }))
    }))
  }

  function toggleSet(exerciseIndex: number, setIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set, innerIndex) =>
          innerIndex === setIndex ? { ...set, done: !set.done } : set
        )
      }
    })
  }

  function addSet(exerciseIndex: number) {
    activeExercises.value = activeExercises.value.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise
      const lastSet = exercise.sets[exercise.sets.length - 1] ?? { reps: 12, weight: 20, done: false }
      return {
        ...exercise,
        sets: [...exercise.sets, { ...lastSet, done: false }]
      }
    })
  }

  function addExercise(name: string, muscle: string) {
    activeExercises.value.push({
      id: Date.now(),
      name,
      muscle,
      sets: [{ reps: 12, weight: 20, done: false }]
    })
  }

  function finishWorkout() {
    activeTemplateId.value = null
    activeTemplateName.value = '自由训练'
    elapsedSeconds.value = 0
    activeExercises.value = cloneBaseExercises()
  }

  return {
    activeTemplateId,
    activeTemplateName,
    elapsedSeconds,
    activeExercises,
    totalSets,
    doneSets,
    progress,
    totalVolume,
    startWorkout,
    toggleSet,
    addSet,
    addExercise,
    finishWorkout
  }
})
