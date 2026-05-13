<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import ExercisePicker from '@/components/exercise-picker/index.vue'
import ProgressBar from '@/components/progress-bar/index.vue'
import type { ExerciseSummary } from '@/api/exercise'
import { saveTraining } from '@/api/training'
import { routes } from '@/utils/navigation'
import { formatSeconds } from '@/utils/format'
import { emitTrainingChanged } from '@/utils/training-events'
import { useProfileStore } from '@/stores/profile'
import { useTrainingStore } from '@/stores/training'
import { convertUnitToKg, formatWeight, type WeightUnit } from '@/utils/unit'
import { useWorkoutStore, type WorkoutComparison, type WorkoutExercise } from '@/stores/workout'

const REST_SECONDS = 60
const KG_STEP = 2.5
const LB_STEP = 5

const workoutStore = useWorkoutStore()
const profileStore = useProfileStore()
const trainingStore = useTrainingStore()
const showFinish = ref(false)
const submitting = ref(false)
const currentExerciseIndex = ref(0)
const menuExerciseIndex = ref<number | null>(null)
const restRemaining = ref(0)
const restTitle = ref('')
const restNextExerciseIndex = ref<number | null>(null)
const pickerVisible = ref(false)
const startupLoading = ref(false)
const unit = computed<WeightUnit>(() => profileStore.unit)
let timer: ReturnType<typeof setInterval> | null = null
let restTimer: ReturnType<typeof setInterval> | null = null
let stepTimer: ReturnType<typeof setInterval> | null = null
let stepDelayTimer: ReturnType<typeof setTimeout> | null = null
let lastDraftPersistedAt = 0

function startStepTimer(action: () => void) {
  clearStepTimer()
  action()
  stepDelayTimer = setTimeout(() => {
    stepTimer = setInterval(action, 80)
  }, 500)
}

function clearStepTimer() {
  if (stepTimer) clearInterval(stepTimer)
  if (stepDelayTimer) clearTimeout(stepDelayTimer)
  stepTimer = null
  stepDelayTimer = null
}

const currentExercise = computed(() => workoutStore.activeExercises[currentExerciseIndex.value])
const currentSetIndex = computed(() => {
  const exercise = currentExercise.value
  if (!exercise) return -1
  const nextIndex = exercise.sets.findIndex((set) => !set.done)
  return nextIndex >= 0 ? nextIndex : Math.max(exercise.sets.length - 1, 0)
})
const currentExerciseScrollId = computed(() => `workout-exercise-${currentExerciseIndex.value}`)
const displayTotalVolume = computed(() =>
  formatWeight(Number(workoutStore.totalVolume || 0), unit.value, 1)
)
const displayStep = computed(() => (unit.value === 'lb' ? LB_STEP : KG_STEP))
const selectedExerciseIds = computed(() =>
  workoutStore.activeExercises.map((exercise) => exercise.id)
)

function toLocalDateTimeString(iso: string) {
  const date = new Date(iso)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

function exerciseDoneSets(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.done).length
}

function exerciseVolume(exercise: WorkoutExercise) {
  return exercise.sets
    .filter((set) => set.done)
    .reduce((total, set) => total + set.weight * set.reps, 0)
}

function isExerciseCompleted(exercise: WorkoutExercise) {
  return !!exercise.ended
}

function lastSetText(exercise: WorkoutExercise, setIndex: number) {
  const performance = workoutStore.getLastPerformance(exercise.id)
  if (!performance?.sets?.length) {
    return '上次：暂无记录'
  }
  const matchedSet = performance.sets[setIndex] || performance.sets[performance.sets.length - 1]
  return `上次：${formatWeight(matchedSet.weightKg, unit.value, 1)} ${unit.value} x ${matchedSet.reps}`
}

function closePage() {
  clearTimers()
  uni.navigateBack()
}

function clearTimers() {
  if (timer) clearInterval(timer)
  if (restTimer) clearInterval(restTimer)
  timer = null
  restTimer = null
}

function startRest(title: string, nextExerciseIndex: number | null = null) {
  if (restTimer) clearInterval(restTimer)
  restTitle.value = title
  restNextExerciseIndex.value = nextExerciseIndex
  restRemaining.value = REST_SECONDS
  restTimer = setInterval(() => {
    restRemaining.value -= 1
    if (restRemaining.value <= 0) {
      skipRest()
    }
  }, 1000)
}

function skipRest() {
  if (restTimer) clearInterval(restTimer)
  const nextExerciseIndex = restNextExerciseIndex.value
  restTimer = null
  restRemaining.value = 0
  restTitle.value = ''
  restNextExerciseIndex.value = null
  if (nextExerciseIndex !== null) {
    currentExerciseIndex.value = nextExerciseIndex
  }
}

function addRestSeconds(seconds: number) {
  restRemaining.value += seconds
}

async function initializeWorkout() {
  if (!workoutStore.hasPendingStart) {
    if (!workoutStore.activeExercises.length) {
      workoutStore.restoreDraft()
    }
    return
  }

  const templateId = workoutStore.pendingStartTemplateId
  startupLoading.value = true
  try {
    await workoutStore.startWorkout(templateId)
    workoutStore.clearPendingStart()
  } catch (err) {
    workoutStore.clearPendingStart()
    uni.showToast({ title: '训练加载失败，请重试', icon: 'none' })
    console.error('[workout] start failed', err)
    if (!workoutStore.activeExercises.length) {
      setTimeout(() => uni.navigateBack(), 600)
    }
  } finally {
    startupLoading.value = false
  }
}

function switchExercise(delta: number) {
  const nextIndex = findAdjacentActiveExerciseIndex(currentExerciseIndex.value, delta)
  if (nextIndex === null) return
  currentExerciseIndex.value = nextIndex
  menuExerciseIndex.value = null
}

function selectExercise(index: number) {
  if (!workoutStore.activeExercises[index]) return
  currentExerciseIndex.value = index
  menuExerciseIndex.value = null
}

function reopenExercise(index: number) {
  workoutStore.reopenExercise(index)
  currentExerciseIndex.value = index
  menuExerciseIndex.value = null
}

function stepWeight(setIndex: number, direction: 1 | -1) {
  if (currentExercise.value?.ended) return
  const deltaInUnit = displayStep.value * direction
  workoutStore.adjustWeight(
    currentExerciseIndex.value,
    setIndex,
    convertUnitToKg(deltaInUnit, unit.value)
  )
}

function stepReps(setIndex: number, direction: 1 | -1) {
  if (currentExercise.value?.ended) return
  workoutStore.adjustReps(currentExerciseIndex.value, setIndex, direction)
}

function updateWeight(setIndex: number, event: { detail: { value: string } }) {
  if (currentExercise.value?.ended) return
  const value = Number(event.detail.value)
  if (!Number.isFinite(value)) return
  workoutStore.updateSet(currentExerciseIndex.value, setIndex, {
    weight: Math.max(0, Number(convertUnitToKg(value, unit.value).toFixed(2)))
  })
}

function updateReps(setIndex: number, event: { detail: { value: string } }) {
  if (currentExercise.value?.ended) return
  const value = Number(event.detail.value)
  if (!Number.isFinite(value)) return
  workoutStore.updateSet(currentExerciseIndex.value, setIndex, {
    reps: Math.max(0, Math.round(value))
  })
}

function toggleSetDone(setIndex: number) {
  const exercise = currentExercise.value
  const targetSet = exercise?.sets[setIndex]
  if (!exercise || !targetSet || exercise.ended) return

  if (targetSet.done) {
    workoutStore.toggleSet(currentExerciseIndex.value, setIndex)
    skipRest()
    return
  }

  workoutStore.toggleSet(currentExerciseIndex.value, setIndex)
  const afterExercise = workoutStore.activeExercises[currentExerciseIndex.value]
  if (afterExercise.sets.every((set) => set.done)) {
    const nextIndex = findNextExerciseIndex(currentExerciseIndex.value)
    workoutStore.endExercise(currentExerciseIndex.value)
    startRest(`${afterExercise.name} 已完成`, nextIndex)
    return
  }
  startRest(`第 ${setIndex + 1} 组已完成`)
}

function addSet(exerciseIndex = currentExerciseIndex.value) {
  if (workoutStore.activeExercises[exerciseIndex]?.ended) return
  workoutStore.addSet(exerciseIndex)
  menuExerciseIndex.value = null
}

function deleteLastSet(exerciseIndex = currentExerciseIndex.value) {
  if (workoutStore.activeExercises[exerciseIndex]?.ended) return
  const ok = workoutStore.deleteLastSet(exerciseIndex)
  menuExerciseIndex.value = null
  if (!ok) {
    uni.showToast({ title: '已完成组不能删除', icon: 'none' })
  }
}

function deleteSet(exerciseIndex: number, setIndex: number) {
  const targetSet = workoutStore.activeExercises[exerciseIndex]?.sets[setIndex]
  if (!targetSet) return
  if (targetSet.done) {
    uni.showToast({ title: '已完成组不能删除', icon: 'none' })
    return
  }
  const ok = workoutStore.removeSet(exerciseIndex, setIndex)
  if (!ok) {
    uni.showToast({ title: '至少保留一组', icon: 'none' })
  }
}

function openExercisePicker() {
  pickerVisible.value = true
}

function closeExercisePicker() {
  pickerVisible.value = false
}

function addExerciseFromPicker(exercise: ExerciseSummary) {
  const added = workoutStore.addExercise(exercise.id, exercise.name, exercise.primaryMuscle || '')
  if (!added) {
    uni.showToast({ title: '该动作已在本次训练中', icon: 'none' })
    return
  }
  currentExerciseIndex.value = workoutStore.activeExercises.length - 1
  menuExerciseIndex.value = null
  pickerVisible.value = false
  uni.showToast({ title: '已添加动作', icon: 'none' })
}

function finishExerciseEarly() {
  const exercise = currentExercise.value
  if (!exercise) return

  if (exercise.ended) {
    workoutStore.reopenExercise(currentExerciseIndex.value)
    return
  }

  const doneCount = exerciseDoneSets(exercise)
  if (!doneCount) {
    uni.showToast({ title: '请至少完成一组训练', icon: 'none' })
    return
  }

  const nextIndex = findNextExerciseIndex(currentExerciseIndex.value)
  if (nextIndex !== null) {
    workoutStore.endExercise(currentExerciseIndex.value)
    startRest(`${exercise.name} 已完成`, nextIndex)
    return
  }

  handleFinishTap()
}

function toggleMenu(index: number) {
  if (workoutStore.activeExercises[index]?.ended) return
  menuExerciseIndex.value = menuExerciseIndex.value === index ? null : index
}

function openExerciseDetail(exerciseId: number) {
  workoutStore.persistDraft()
  menuExerciseIndex.value = null
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${exerciseId}` })
}

function findNextExerciseIndex(fromIndex: number) {
  const nextIndex = workoutStore.activeExercises.findIndex(
    (exercise, index) => index > fromIndex && !isExerciseCompleted(exercise)
  )
  return nextIndex >= 0 ? nextIndex : null
}

function findAdjacentActiveExerciseIndex(fromIndex: number, delta: number) {
  let nextIndex = fromIndex + delta
  while (nextIndex >= 0 && nextIndex < workoutStore.activeExercises.length) {
    if (!isExerciseCompleted(workoutStore.activeExercises[nextIndex])) {
      return nextIndex
    }
    nextIndex += delta
  }
  return null
}

function deleteExercise(index: number) {
  const exercise = workoutStore.activeExercises[index]
  if (!exercise) return

  const remove = () => {
    workoutStore.removeExercise(index)
    currentExerciseIndex.value = Math.min(
      currentExerciseIndex.value,
      Math.max(workoutStore.activeExercises.length - 1, 0)
    )
    menuExerciseIndex.value = null
  }

  if (!exerciseDoneSets(exercise)) {
    remove()
    return
  }

  uni.showModal({
    title: '删除动作？',
    content: `${exercise.name} 已有完成组，删除后本次训练不会提交这些组。`,
    confirmText: '删除',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) remove()
    }
  })
}

function buildWorkoutComparisons() {
  return workoutStore.activeExercises
    .map<WorkoutComparison | null>((exercise) => {
      const doneSets = exercise.sets.filter((set) => set.done)
      if (!doneSets.length) return null
      const currentVolumeKg = doneSets.reduce((total, set) => total + set.weight * set.reps, 0)
      const currentMaxWeightKg = doneSets.reduce((max, set) => Math.max(max, set.weight), 0)
      const lastPerformance = workoutStore.getLastPerformance(exercise.id)
      return {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        currentVolumeKg,
        volumeDeltaKg: lastPerformance
          ? Number((currentVolumeKg - Number(lastPerformance.bestVolumeKg || 0)).toFixed(2))
          : null,
        currentMaxWeightKg,
        maxWeightDeltaKg: lastPerformance
          ? Number((currentMaxWeightKg - Number(lastPerformance.bestWeightKg || 0)).toFixed(2))
          : null
      }
    })
    .filter((item): item is WorkoutComparison => Boolean(item))
}

function handleFinishTap() {
  if (submitting.value) return
  if (!workoutStore.doneSets) {
    uni.showToast({ title: '请至少完成一组再结束训练', icon: 'none' })
    return
  }
  showFinish.value = true
}

async function confirmFinish() {
  if (submitting.value) return
  const startedAt =
    workoutStore.startedAt ||
    new Date(Date.now() - workoutStore.elapsedSeconds * 1000).toISOString()
  const endedAt = new Date().toISOString()
  const items = workoutStore.activeExercises
    .map((exercise) => ({
      exerciseId: exercise.id,
      targetSets: exercise.sets.length,
      sets: exercise.sets
        .filter((set) => set.done)
        .map((set) => ({
          weightKg: Number(set.weight.toFixed(2)),
          reps: set.reps
        }))
    }))
    .filter((item) => item.sets.length > 0)

  if (!items.length) {
    uni.showToast({ title: '请至少完成一组再提交', icon: 'none' })
    return
  }

  workoutStore.persistDraft()
  submitting.value = true
  let result: Awaited<ReturnType<typeof saveTraining>>
  try {
    result = await saveTraining({
      templateId: workoutStore.activeTemplateId,
      clientRequestId: workoutStore.ensureClientRequestId(),
      trainingName: workoutStore.activeTemplateName || '自由训练',
      startedAt: toLocalDateTimeString(startedAt),
      endedAt: toLocalDateTimeString(endedAt),
      items
    })
  } catch (err) {
    workoutStore.persistDraft()
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[training] save failed', err)
    submitting.value = false
    return
  }

  clearTimers()
  workoutStore.setCompletedSummary({
    ...result,
    trainingName: workoutStore.activeTemplateName || '自由训练',
    startedAt,
    endedAt,
    plannedItems: workoutStore.activeExercises.map((exercise) => ({
      exerciseId: exercise.id,
      targetSets: exercise.sets.length
    })),
    comparisons: buildWorkoutComparisons()
  })
  workoutStore.finishWorkout()
  trainingStore.invalidateCache()
  emitTrainingChanged()
  uni.redirectTo({ url: routes.workoutSummary })
}

onMounted(() => {
  void initializeWorkout()

  timer = setInterval(() => {
    workoutStore.elapsedSeconds += 1
    if (Date.now() - lastDraftPersistedAt > 10000) {
      workoutStore.persistDraft()
      lastDraftPersistedAt = Date.now()
    }
  }, 1000)
})

onHide(() => {
  workoutStore.persistDraft()
})

onUnmounted(() => {
  workoutStore.persistDraft()
  clearTimers()
})
</script>

<template>
  <view class="workout-active">
    <view class="workout-active__top">
      <view class="workout-active__close btn-press" @tap="closePage">×</view>
      <view class="workout-active__title-wrap">
        <view class="workout-active__title">{{ workoutStore.activeTemplateName }}</view>
        <view class="workout-active__timer">{{ formatSeconds(workoutStore.elapsedSeconds) }}</view>
      </view>
      <view
        class="workout-active__done btn-press"
        :class="{ 'workout-active__done--disabled': submitting }"
        @tap="handleFinishTap"
      >
        {{ submitting ? '保存中' : '完成训练' }}
      </view>
    </view>

    <view class="workout-active__progress">
      <view class="space-between">
        <view class="muted">{{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组已完成</view>
        <view class="workout-active__percent">{{ Math.round(workoutStore.progress * 100) }}%</view>
      </view>
      <ProgressBar :value="workoutStore.progress" />
    </view>

    <view class="workout-active__stats">
      <view class="glass-card workout-active__stat">
        <view class="workout-active__stat-label">时长</view>
        <view class="workout-active__stat-value">{{
          formatSeconds(workoutStore.elapsedSeconds)
        }}</view>
      </view>
      <view class="glass-card workout-active__stat">
        <view class="workout-active__stat-label">总容量</view>
        <view class="workout-active__stat-value">{{ displayTotalVolume }} {{ unit }}</view>
      </view>
    </view>

    <view class="workout-active__switcher">
      <view class="glass-card workout-active__switch btn-press" @tap="switchExercise(-1)"
        >上一个动作</view
      >
      <view class="workout-active__switch-index">
        {{ workoutStore.activeExercises.length ? currentExerciseIndex + 1 : 0 }} /
        {{ workoutStore.activeExercises.length }}
      </view>
      <view class="glass-card workout-active__switch btn-press" @tap="switchExercise(1)"
        >下一个动作</view
      >
    </view>

    <scroll-view
      v-if="workoutStore.activeExercises.length"
      scroll-y
      scroll-with-animation
      class="workout-active__list"
      :scroll-into-view="currentExerciseScrollId"
    >
      <view
        v-for="(exercise, exerciseIndex) in workoutStore.activeExercises"
        :id="`workout-exercise-${exerciseIndex}`"
        :key="`${exercise.id}-${exerciseIndex}`"
        class="glass-card workout-active__card"
        :class="{
          'workout-active__card--current': exerciseIndex === currentExerciseIndex,
          'workout-active__card--collapsed': exerciseIndex !== currentExerciseIndex,
          'workout-active__card--ended': isExerciseCompleted(exercise),
          'workout-active__card--menu-open': menuExerciseIndex === exerciseIndex
        }"
        @tap="exerciseIndex !== currentExerciseIndex && selectExercise(exerciseIndex)"
      >
        <view class="workout-active__card-top">
          <view class="workout-active__card-main">
            <view
              class="workout-active__card-index"
              :class="{
                'workout-active__card-index--current': exerciseIndex === currentExerciseIndex
              }"
            >
              {{ exerciseIndex + 1 }}
            </view>
            <view class="workout-active__card-copy">
              <view
                class="workout-active__card-title"
                :class="{ 'workout-active__card-title--ended': isExerciseCompleted(exercise) }"
              >
                <text class="workout-active__card-title-text">{{ exercise.name }}</text>
              </view>
              <view class="workout-active__card-sub">
                {{ exerciseDoneSets(exercise) }}组 ·
                {{ formatWeight(exerciseVolume(exercise), unit, 1) }}
                {{ unit }}
                <text v-if="isExerciseCompleted(exercise)"> · 已完成</text>
              </view>
            </view>
          </view>
          <view
            v-if="exercise.ended && exerciseIndex !== currentExerciseIndex"
            class="workout-active__resume btn-press"
            @tap.stop="reopenExercise(exerciseIndex)"
          >
            已完成
          </view>
          <view v-if="!exercise.ended" class="workout-active__menu-wrap" @tap.stop>
            <view class="workout-active__menu-btn" @tap="toggleMenu(exerciseIndex)">...</view>
            <view v-if="menuExerciseIndex === exerciseIndex" class="workout-active__menu">
              <view class="workout-active__menu-item" @tap="openExerciseDetail(exercise.id)"
                >查看动作详情</view
              >
              <view class="workout-active__menu-item" @tap="addSet(exerciseIndex)">添加一组</view>
              <view class="workout-active__menu-item" @tap="deleteLastSet(exerciseIndex)"
                >删除最后一组</view
              >
              <view
                class="workout-active__menu-item workout-active__menu-item--danger"
                @tap="deleteExercise(exerciseIndex)"
              >
                删除动作
              </view>
            </view>
          </view>
        </view>

        <view class="workout-active__card-content">
          <view class="workout-active__current">
            当前第 {{ currentSetIndex + 1 }} / {{ exercise.sets.length }} 组
          </view>
          <view class="workout-active__last-reference">
            {{ lastSetText(exercise, currentSetIndex) }}
          </view>

          <view class="workout-active__set-labels">
            <text>组</text>
            <text>重量({{ unit }})</text>
            <text>次数</text>
            <text>完成</text>
          </view>

          <app-swipe-action
            v-for="(set, setIndex) in exercise.sets"
            :key="`${exercise.id}-${setIndex}`"
            :disabled="exercise.ended"
            @delete="deleteSet(exerciseIndex, setIndex)"
          >
            <view
              class="workout-active__set"
              :class="{
                'workout-active__set--current': setIndex === currentSetIndex && !set.done,
                'workout-active__set--done': set.done
              }"
            >
              <view class="workout-active__set-index">{{ setIndex + 1 }}</view>
              <view class="workout-active__stepper">
                <view
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="startStepTimer(() => stepWeight(setIndex, -1))"
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  -
                </view>
                <input
                  class="workout-active__input"
                  :class="{ 'workout-active__input--locked': set.done || exercise.ended }"
                  type="digit"
                  :disabled="set.done || exercise.ended"
                  :value="formatWeight(set.weight, unit, 1)"
                  @blur="updateWeight(setIndex, $event)"
                />
                <view
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="startStepTimer(() => stepWeight(setIndex, 1))"
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  +
                </view>
              </view>
              <view class="workout-active__stepper">
                <view
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="startStepTimer(() => stepReps(setIndex, -1))"
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  -
                </view>
                <input
                  class="workout-active__input"
                  :class="{ 'workout-active__input--locked': set.done || exercise.ended }"
                  type="number"
                  :disabled="set.done || exercise.ended"
                  :value="set.reps"
                  @blur="updateReps(setIndex, $event)"
                />
                <view
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="startStepTimer(() => stepReps(setIndex, 1))"
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  +
                </view>
              </view>
              <view
                class="workout-active__set-toggle"
                :class="{ 'workout-active__set-toggle--done': set.done }"
                @tap.stop="toggleSetDone(setIndex)"
              >
                ✓
              </view>
            </view>
          </app-swipe-action>

          <view v-if="!exercise.ended" class="workout-active__actions">
            <view
              class="glass-card workout-active__action btn-press"
              @tap.stop="addSet(currentExerciseIndex)"
            >
              + 添加一组
            </view>
            <view
              class="glass-card workout-active__action btn-press"
              @tap.stop="deleteLastSet(currentExerciseIndex)"
            >
              删除最后一组
            </view>
          </view>
          <view
            class="gradient-fire workout-active__finish-exercise btn-press"
            :class="{ 'workout-active__finish-exercise--done': exercise.ended }"
            @tap="finishExerciseEarly"
          >
            {{ exercise.ended ? '已完成' : '完成此动作' }}
          </view>
        </view>
      </view>

      <view class="glass-card workout-active__add-exercise btn-press" @tap="openExercisePicker">
        + 添加动作
      </view>
    </scroll-view>

    <view v-else-if="startupLoading" class="workout-active__empty">
      <view class="workout-active__empty-title">正在准备训练</view>
      <view class="workout-active__empty-sub">正在加载模板和上次训练记录...</view>
    </view>

    <view v-else class="workout-active__empty">
      <view class="workout-active__empty-title">还没有训练动作</view>
      <view class="workout-active__empty-sub">自由训练可以先添加一个动作，再记录重量和次数。</view>
      <view class="gradient-fire workout-active__empty-btn btn-press" @tap="openExercisePicker">
        添加第一个动作
      </view>
    </view>

    <view v-if="restRemaining > 0" class="workout-active__rest">
      <view>
        <view class="workout-active__rest-title">{{ restTitle }}</view>
        <view class="workout-active__rest-time">休息 {{ formatSeconds(restRemaining) }}</view>
      </view>
      <view class="workout-active__rest-actions">
        <view class="workout-active__rest-btn" @tap="addRestSeconds(30)">+30秒</view>
        <view class="workout-active__rest-btn workout-active__rest-btn--primary" @tap="skipRest"
          >跳过</view
        >
      </view>
    </view>

    <view v-if="showFinish" class="workout-active__overlay" @tap="showFinish = false">
      <view class="workout-active__sheet" @tap.stop>
        <view class="workout-active__sheet-handle" />
        <view class="title-lg">完成训练？</view>
        <view class="muted workout-active__sheet-sub">
          已完成 {{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组，训练时长
          {{ formatSeconds(workoutStore.elapsedSeconds) }}
        </view>
        <view
          class="gradient-fire workout-active__sheet-btn btn-press"
          :class="{ 'workout-active__sheet-btn--disabled': submitting }"
          @tap="confirmFinish"
        >
          {{ submitting ? '保存中...' : '保存并完成' }}
        </view>
        <view class="glass-card workout-active__sheet-btn btn-press" @tap="showFinish = false">
          继续训练
        </view>
      </view>
    </view>

    <ExercisePicker
      :visible="pickerVisible"
      title="添加训练动作"
      subtitle="搜索并加入本次训练"
      :selected-ids="selectedExerciseIds"
      @close="closeExercisePicker"
      @select="addExerciseFromPicker"
    />
  </view>
</template>

<style lang="scss" scoped>
.workout-active {
  min-height: 100vh;
  background: #0a0a0e;
  padding: calc(env(safe-area-inset-top) + 24rpx) 32rpx calc(env(safe-area-inset-bottom) + 148rpx);
  display: flex;
  flex-direction: column;

  &__top,
  &__progress,
  &__stats,
  &__switcher {
    flex-shrink: 0;
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__close,
  &__done {
    min-width: 72rpx;
    min-height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 34rpx;
  }

  &__done {
    padding: 0 24rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-weight: 800;

    &--disabled {
      opacity: 0.62;
    }
  }

  &__title-wrap {
    flex: 1;
    text-align: center;
  }

  &__title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__timer,
  &__percent {
    color: #ff501e;
    font-weight: 800;
  }

  &__timer {
    margin-top: 8rpx;
    font-size: 40rpx;
  }

  &__progress {
    margin-top: 24rpx;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    margin: 24rpx 0;
  }

  &__stat {
    padding: 22rpx;
  }

  &__stat-label {
    color: #828296;
    font-size: 22rpx;
  }

  &__stat-value {
    margin-top: 8rpx;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__switcher {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 20rpx;
  }

  &__switch {
    padding: 18rpx 20rpx;
    text-align: center;
    color: #f5f5fa;
    font-size: 24rpx;
  }

  &__switch-index {
    color: #828296;
    font-size: 22rpx;
  }

  &__list {
    flex: 1;
  }

  &__empty {
    flex: 1;
    margin-top: 24rpx;
    padding: 48rpx 32rpx;
    border-radius: 36rpx;
    background:
      radial-gradient(circle at 30% 10%, rgba(255, 80, 30, 0.16), transparent 38%),
      rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  &__empty-title {
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__empty-sub {
    max-width: 520rpx;
    margin-top: 14rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.7;
  }

  &__empty-btn {
    min-width: 320rpx;
    min-height: 88rpx;
    margin-top: 30rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__card {
    position: relative;
    padding: 24rpx;
    margin-bottom: 20rpx;
    overflow: visible !important;

    &--current {
      border-color: rgba(255, 80, 30, 0.28);
      z-index: 1;
    }

    &--collapsed {
      padding: 22rpx 24rpx;
    }

    &--ended {
      border-color: rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.04);
    }

    &--menu-open {
      z-index: 50;
    }
  }

  &__card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__card-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 18rpx;
  }

  &__card-index {
    width: 52rpx;
    height: 52rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.16);
    border: 1px solid rgba(255, 80, 30, 0.28);
    color: #ff7a32;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 24rpx;
    font-weight: 900;

    &--current {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.28);
    }
  }

  &__card-copy {
    min-width: 0;
  }

  &__card-title {
    font-size: 30rpx;
    font-weight: 800;

    &-text {
      display: inline;
    }

    &--ended {
      color: #828296;

      .workout-active__card-title-text {
        text-decoration: line-through;
        text-decoration-thickness: 3rpx;
        text-decoration-color: rgba(255, 122, 50, 0.78);
      }
    }
  }

  &__card-sub {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__resume {
    min-width: 112rpx;
    min-height: 56rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);
    color: #b8b8c8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 800;
  }

  &__menu-wrap {
    position: relative;
  }

  &__menu-btn {
    min-width: 58rpx;
    min-height: 44rpx;
    color: #828296;
    text-align: right;
    font-size: 32rpx;
    line-height: 36rpx;
  }

  &__menu {
    position: absolute;
    right: 0;
    top: 52rpx;
    width: 220rpx;
    padding: 10rpx;
    border-radius: 24rpx;
    background: #20202a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 60;
    box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.36);
  }

  &__menu-item {
    padding: 18rpx;
    color: #f5f5fa;
    font-size: 24rpx;

    &--danger {
      color: #ff6b4a;
    }
  }

  &__card-content {
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 0;
    opacity: 0;
    visibility: hidden;

    .workout-active__card--current & {
      max-height: 2400rpx;
      opacity: 1;
      visibility: visible;
      margin-top: 24rpx;
    }
  }

  &__current {
    margin: 8rpx 0 8rpx;
    color: #ff7a32;
    font-size: 24rpx;
    font-weight: 700;
  }

  &__last-reference {
    margin-bottom: 16rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__set {
    display: grid;
    grid-template-columns: 58rpx 1fr 1fr 64rpx;
    gap: 16rpx;
    align-items: center;
    padding: 18rpx 8rpx;
    border-radius: 24rpx;
    margin-bottom: 12rpx;
    border: 1px solid transparent;

    &--current {
      background: rgba(255, 80, 30, 0.1);
      border-color: rgba(255, 80, 30, 0.42);
    }

    &--done {
      opacity: 0.78;
    }
  }

  &__set-index {
    color: #f5f5fa;
    text-align: center;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__stepper {
    display: grid;
    grid-template-columns: 60rpx 1fr 60rpx;
    align-items: center;
    min-height: 84rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__stepper-btn {
    height: 84rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.02);

    &:active {
      background: rgba(255, 80, 30, 0.15);
      color: #ff501e;
    }
  }

  &__input {
    height: 84rpx;
    color: #f5f5fa;
    text-align: center;
    font-size: 32rpx;
    font-weight: 800;

    &--locked {
      color: #8b8b9a;
    }
  }

  &__set-toggle {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a5a5b8;
    font-size: 28rpx;
    font-weight: 800;

    &--done {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      border-color: transparent;
      color: #fff;
    }
  }

  &__set-labels {
    display: grid;
    grid-template-columns: 58rpx 1fr 1fr 64rpx;
    gap: 16rpx;
    color: #828296;
    font-size: 20rpx;
    text-align: center;
    padding: 0 8rpx 12rpx;
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    margin-top: 10rpx;
  }

  &__action {
    min-height: 76rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff7a32;
    font-size: 24rpx;
    font-weight: 700;
  }

  &__finish-exercise,
  &__add-exercise {
    min-height: 88rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16rpx;
    color: #fff;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__finish-exercise--done {
    background: rgba(255, 255, 255, 0.08);
    color: #b8b8c8;
  }

  &__add-exercise {
    margin-bottom: 32rpx;
    color: #ff7a32;
  }

  &__rest {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(env(safe-area-inset-bottom) + 32rpx);
    z-index: 100;
    padding: 32rpx;
    border-radius: 40rpx;
    background: rgba(20, 20, 28, 0.95);
    border: 1px solid rgba(255, 80, 30, 0.4);
    backdrop-filter: blur(20px);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    box-shadow:
      0 32rpx 80rpx rgba(0, 0, 0, 0.6),
      0 0 40rpx rgba(255, 80, 30, 0.2);
  }

  &__rest-title {
    color: rgba(255, 255, 255, 0.6);
    font-size: 22rpx;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }

  &__rest-time {
    margin-top: 8rpx;
    font-size: 44rpx;
    font-weight: 900;
    color: #ff501e;
    text-shadow: 0 0 20rpx rgba(255, 80, 30, 0.4);
  }

  &__rest-actions {
    display: flex;
    gap: 12rpx;
  }

  &__rest-btn {
    padding: 16rpx 20rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.18);
    font-size: 22rpx;

    &--primary {
      background: #fff;
      color: #ff501e;
      font-weight: 800;
    }
  }

  &__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: flex-end;
    z-index: 20;
  }

  &__sheet {
    width: 100%;
    background: #14141c;
    border-radius: 36rpx 36rpx 0 0;
    padding: 24rpx 32rpx calc(env(safe-area-inset-bottom) + 24rpx);
  }

  &__sheet-handle {
    width: 80rpx;
    height: 8rpx;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999rpx;
    margin: 0 auto 24rpx;
  }

  &__sheet-sub {
    margin: 16rpx 0 24rpx;
  }

  &__sheet-btn {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16rpx;
    font-size: 28rpx;
    font-weight: 700;
    color: #fff;

    &--disabled {
      opacity: 0.62;
    }
  }
}
</style>
