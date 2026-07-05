<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import ExercisePicker from '@/components/exercise-picker/index.vue'
import ProgressBar from '@/components/progress-bar/index.vue'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import EffortPicker from '@/components/effort-picker/index.vue'
import ProgressionRecommendation from '@/components/progression-recommendation/index.vue'
import { useMembershipPromptStore } from '@/stores/membership-prompt'
import PlateCalculator from '@/components/plate-calculator/index.vue'
import type { ExerciseSummary } from '@/api/exercise'
import { saveTraining, type SaveTrainingRequest } from '@/api/training'
import { routes } from '@/utils/navigation'
import { formatSeconds } from '@/utils/format'
import { emitTrainingChanged } from '@/utils/training-events'
import { buildWarmupCandidates, type WarmupCandidate } from '@/utils/warmup'
import { useProfileStore } from '@/stores/profile'
import { useTrainingStore } from '@/stores/training'
import { useThemeStore } from '@/stores/theme'
import { convertUnitToKg, formatWeight, type WeightUnit } from '@/utils/unit'
import {
  useWorkoutStore,
  type WorkoutComparison,
  type WorkoutEffort,
  type WorkoutExercise,
  type WorkoutSetType
} from '@/stores/workout'

const workoutStore = useWorkoutStore()
const profileStore = useProfileStore()
const membershipPromptStore = useMembershipPromptStore()
const trainingStore = useTrainingStore()
const themeStore = useThemeStore()
const showFinish = ref(false)
const showExitConfirm = ref(false)
const submitting = ref(false)
const currentExerciseIndex = ref(0)
const menuExerciseIndex = ref<number | null>(null)
const restRemaining = ref(0)
const restTitle = ref('')
const pickerVisible = ref(false)
const startupLoading = ref(false)
const effortTarget = ref<{ exerciseIndex: number; setIndex: number } | null>(null)
const plateCalculatorVisible = ref(false)
const toolFeedback = ref('')
const warmupManagerIndex = ref<number | null>(null)
const warmupPreviewIndex = ref<number | null>(null)
const warmupPreviewSets = ref<WarmupCandidate[]>([])
const supersetIntroIndex = ref<number | null>(null)
const replacementTargetIndex = ref<number | null>(null)
const pendingReplacement = ref<{ targetIndex: number; exercise: ExerciseSummary } | null>(null)
const pendingDeleteIndex = ref<number | null>(null)
const restFocusIndex = ref<number | null>(null)
const unit = computed<WeightUnit>(() => profileStore.unit)
let timer: ReturnType<typeof setInterval> | null = null
let restTimer: ReturnType<typeof setInterval> | null = null
let stepTimer: ReturnType<typeof setInterval> | null = null
let stepDelayTimer: ReturnType<typeof setTimeout> | null = null
let toolFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let lastDraftPersistedAt = 0
let restStartedAt = 0
let restDurationSeconds = 0

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
const currentExerciseDoneCount = computed(() =>
  currentExercise.value ? exerciseDoneSets(currentExercise.value) : 0
)
const previousExerciseIndex = computed(() =>
  findAdjacentActiveExerciseIndex(currentExerciseIndex.value, -1)
)
const nextExerciseIndex = computed(() =>
  findAdjacentActiveExerciseIndex(currentExerciseIndex.value, 1)
)
const previousExerciseText = computed(() =>
  previousExerciseIndex.value === null
    ? '没有上一个'
    : workoutStore.activeExercises[previousExerciseIndex.value]?.name || '上一个动作'
)
const nextExerciseText = computed(() =>
  nextExerciseIndex.value === null
    ? '没有下一个'
    : workoutStore.activeExercises[nextExerciseIndex.value]?.name || '下一个动作'
)
const currentActionTitle = computed(() => {
  const exercise = currentExercise.value
  if (!exercise) return '准备训练'
  if (exercise.ended) return `${exercise.name} 已完成`
  return exercise.name
})
const currentActionSub = computed(() => {
  const exercise = currentExercise.value
  if (!exercise) return '添加动作后开始记录训练。'
  if (exercise.ended) {
    const nextIndex = nextExerciseIndex.value
    return nextIndex === null
      ? '所有动作都已完成，可以结束训练。'
      : `下一个动作：${workoutStore.activeExercises[nextIndex]?.name || '继续训练'}`
  }
  return `当前第 ${currentSetIndex.value + 1} / ${exercise.sets.length} 组 · 已完成 ${currentExerciseDoneCount.value} 组`
})
const currentExerciseScrollId = computed(() => `workout-exercise-${currentExerciseIndex.value}`)
const displayTotalVolume = computed(() =>
  formatWeight(Number(workoutStore.totalVolume || 0), unit.value, 1)
)
const displayStep = computed(() =>
  unit.value === 'lb' ? profileStore.weightStepLb : profileStore.weightStepKg
)
const sourceText = computed(() => {
  if (workoutStore.sourceType === 'PLAN') return '计划训练'
  if (workoutStore.sourceType === 'TEMPLATE') return '模板训练'
  return '自由训练'
})
const selectedExerciseIds = computed(() =>
  workoutStore.activeExercises
    .filter((_, index) => index !== replacementTargetIndex.value)
    .map((exercise) => exercise.id)
)
const plateCalculatorTarget = computed(() => {
  const set = currentExercise.value?.sets.find((item) => item.setType !== 'WARMUP' && !item.done)
  return set?.weight || 0
})
const warmupPreviewExercise = computed(() =>
  warmupPreviewIndex.value === null ? null : workoutStore.activeExercises[warmupPreviewIndex.value]
)
const exitConfirmTitle = '\u9000\u51fa\u8bad\u7ec3\uff1f'
const exitConfirmDesc =
  '\u5f53\u524d\u8bad\u7ec3\u4f1a\u4fdd\u5b58\u4e3a\u8349\u7a3f\uff0c\u7a0d\u540e\u53ef\u4ee5\u4ece\u53f3\u4fa7\u5165\u53e3\u7ee7\u7eed\u3002'
const exitConfirmHint =
  '\u9000\u51fa\u540e\u4e0d\u4f1a\u5b8c\u6210\u8bad\u7ec3\uff0c\u4e5f\u4e0d\u4f1a\u751f\u6210\u8bad\u7ec3\u8bb0\u5f55\u3002'
const exitConfirmCancelText = '\u7ee7\u7eed\u8bad\u7ec3'
const exitConfirmSubmitText = '\u4fdd\u5b58\u5e76\u9000\u51fa'

function toLocalDateTimeString(iso: string) {
  const date = new Date(iso)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

function exerciseDoneSets(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.done && set.setType !== 'WARMUP').length
}

function exerciseVolume(exercise: WorkoutExercise) {
  if (isBodyweightExercise(exercise)) return 0
  return exercise.sets
    .filter((set) => set.done && set.setType !== 'WARMUP')
    .reduce((total, set) => total + set.weight * set.reps, 0)
}

function isExerciseCompleted(exercise: WorkoutExercise) {
  return !!exercise.ended
}

function isBodyweightExercise(exercise?: WorkoutExercise) {
  return exercise?.recordType === 'BODYWEIGHT_REPS'
}

function isDurationExercise(exercise?: WorkoutExercise) {
  return exercise?.recordType === 'DURATION'
}

function hasWarmupSets(exercise: WorkoutExercise) {
  return exercise.sets.some((set) => set.setType === 'WARMUP')
}

function warmupSetCount(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.setType === 'WARMUP').length
}

function isBarbellExercise(exercise: WorkoutExercise) {
  return Boolean(exercise.equipment?.includes('杠铃'))
}

function exerciseSummaryText(exercise: WorkoutExercise) {
  const doneSets = exerciseDoneSets(exercise)
  if (isDurationExercise(exercise)) {
    const totalSeconds = exercise.sets
      .filter((set) => set.done)
      .reduce((total, set) => total + (set.durationSeconds || 0), 0)
    return `${doneSets}组 · ${formatSeconds(totalSeconds)} · 计时`
  }
  if (isBodyweightExercise(exercise)) {
    return `${doneSets}组 · 自重次数`
  }
  return `${doneSets}组 · ${formatWeight(exerciseVolume(exercise), unit.value, 1)} ${unit.value} · 重量次数`
}

function lastSetText(exercise: WorkoutExercise, setIndex: number) {
  const performance = workoutStore.getLastPerformance(exercise.id)
  if (!performance?.sets?.length) {
    return '上次：暂无记录'
  }
  const matchedSet = performance.sets[setIndex] || performance.sets[performance.sets.length - 1]
  if (isDurationExercise(exercise)) {
    return `上次：${formatSeconds(matchedSet.durationSeconds || 0)}`
  }
  if (isBodyweightExercise(exercise)) {
    return `上次：自重 x ${matchedSet.reps}`
  }
  return `上次：${formatWeight(matchedSet.weightKg, unit.value, 1)} ${unit.value} x ${matchedSet.reps}`
}

function closePage() {
  if (workoutStore.hasMeaningfulDraft) {
    showExitConfirm.value = true
  } else {
    workoutStore.discardWorkout()
    clearTimers()
    uni.navigateBack()
  }
}

function cancelExit() {
  showExitConfirm.value = false
}

async function confirmExit() {
  showExitConfirm.value = false
  await workoutStore.reportAllRecommendationOverrides()
  workoutStore.persistDraft()
  clearTimers()
  uni.navigateBack()
}

function clearTimers() {
  if (timer) clearInterval(timer)
  if (restTimer) clearInterval(restTimer)
  if (toolFeedbackTimer) clearTimeout(toolFeedbackTimer)
  timer = null
  restTimer = null
  toolFeedbackTimer = null
}

function startRestInterval() {
  if (restTimer) clearInterval(restTimer)
  restTimer = setInterval(() => {
    restRemaining.value -= 1
    if (restRemaining.value <= 0) {
      skipRest(true)
    }
  }, 1000)
}

function startRest(title: string, focusAfterRestIndex: number | null = null) {
  if (restTimer) clearInterval(restTimer)
  restTitle.value = title
  restRemaining.value = profileStore.restSeconds
  restDurationSeconds = profileStore.restSeconds
  restStartedAt = Date.now()
  restFocusIndex.value = focusAfterRestIndex

  if (restRemaining.value <= 0) {
    skipRest()
    return
  }

  startRestInterval()
}

function notifyRestFinished() {
  if (profileStore.restVibration) {
    uni.vibrateShort({ type: 'medium' })
  }
  uni.showToast({ title: '休息结束，开始下一组', icon: 'none' })
}

function skipRest(notify = false) {
  if (restTimer) clearInterval(restTimer)
  restTimer = null
  restRemaining.value = 0
  restStartedAt = 0
  restDurationSeconds = 0
  restTitle.value = ''
  const focusIndex = restFocusIndex.value
  restFocusIndex.value = null
  if (notify) {
    notifyRestFinished()
  }
  if (focusIndex !== null) {
    void focusWorkoutExercise(focusIndex)
  }
}

function addRestSeconds(seconds: number) {
  restRemaining.value += seconds
  restDurationSeconds += seconds
}

function restoreRestFromClock() {
  if (!restStartedAt || !restDurationSeconds || restRemaining.value <= 0) return
  const elapsed = Math.floor((Date.now() - restStartedAt) / 1000)
  const remaining = restDurationSeconds - elapsed
  if (remaining <= 0) {
    skipRest(true)
    return
  }
  restRemaining.value = remaining
  startRestInterval()
}

async function focusWorkoutExercise(index: number, persist = true) {
  if (!workoutStore.activeExercises[index]) return
  if (persist && index !== currentExerciseIndex.value && currentExerciseIndex.value >= 0) {
    await workoutStore.reportRecommendationOverrideIfNeeded(currentExerciseIndex.value)
  }
  currentExerciseIndex.value = -1
  await nextTick()
  currentExerciseIndex.value = index
  menuExerciseIndex.value = null
  if (persist) {
    workoutStore.updateDraftFocus(index)
  }
}

async function applyRestoredDraftFocus() {
  if (!workoutStore.activeExercises.length) return
  await focusWorkoutExercise(workoutStore.resolveDraftFocusIndex(), false)
}

async function initializeWorkout() {
  if (!workoutStore.hasPendingStart) {
    if (!workoutStore.activeExercises.length) {
      workoutStore.restoreDraft()
    }
    await applyRestoredDraftFocus()
    return
  }

  const templateId = workoutStore.pendingStartTemplateId
  const planId = workoutStore.pendingStartPlanId
  const planDayId = workoutStore.pendingStartPlanDayId
  const executionId = workoutStore.pendingStartExecutionId
  const executionDayId = workoutStore.pendingStartExecutionDayId
  startupLoading.value = true
  try {
    await workoutStore.startWorkout(templateId, { planId, planDayId, executionId, executionDayId })
    workoutStore.clearPendingStart()
    await applyRestoredDraftFocus()
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

async function switchExercise(delta: number) {
  const from =
    currentExerciseIndex.value < 0
      ? delta > 0
        ? -1
        : workoutStore.activeExercises.length
      : currentExerciseIndex.value
  const nextIndex = findAdjacentActiveExerciseIndex(from, delta)
  if (nextIndex === null) return
  await focusWorkoutExercise(nextIndex)
}

async function selectExercise(index: number) {
  if (!workoutStore.activeExercises[index]) return
  await focusWorkoutExercise(index)
}

function handleCardTap(index: number) {
  if (index === currentExerciseIndex.value) {
    currentExerciseIndex.value = -1
    menuExerciseIndex.value = null
  } else {
    void selectExercise(index)
  }
}

async function reopenExercise(index: number) {
  workoutStore.reopenExercise(index)
  await focusWorkoutExercise(index)
}

function stepWeight(setIndex: number, direction: 1 | -1) {
  if (
    currentExercise.value?.ended ||
    isBodyweightExercise(currentExercise.value) ||
    isDurationExercise(currentExercise.value)
  ) {
    return
  }
  const deltaInUnit = displayStep.value * direction
  workoutStore.adjustWeight(
    currentExerciseIndex.value,
    setIndex,
    convertUnitToKg(deltaInUnit, unit.value)
  )
}

function stepReps(setIndex: number, direction: 1 | -1) {
  if (currentExercise.value?.ended || isDurationExercise(currentExercise.value)) return
  workoutStore.adjustReps(currentExerciseIndex.value, setIndex, profileStore.repsStep * direction)
}

function stepDuration(setIndex: number, direction: 1 | -1) {
  if (currentExercise.value?.ended || !isDurationExercise(currentExercise.value)) return
  workoutStore.adjustDuration(
    currentExerciseIndex.value,
    setIndex,
    profileStore.durationStepSeconds * direction
  )
}

function inputValue(event: unknown) {
  return String((event as { detail?: { value?: string | number } })?.detail?.value ?? '')
}

function updateWeight(setIndex: number, event: unknown) {
  if (
    currentExercise.value?.ended ||
    isBodyweightExercise(currentExercise.value) ||
    isDurationExercise(currentExercise.value)
  ) {
    return
  }
  const value = Number(inputValue(event))
  if (!Number.isFinite(value)) return
  workoutStore.updateSet(currentExerciseIndex.value, setIndex, {
    weight: Math.max(0, Number(convertUnitToKg(value, unit.value).toFixed(2)))
  })
  workoutStore.updateDraftFocus(currentExerciseIndex.value, setIndex)
}

function updateReps(setIndex: number, event: unknown) {
  if (currentExercise.value?.ended || isDurationExercise(currentExercise.value)) return
  const value = Number(inputValue(event))
  if (!Number.isFinite(value)) return
  workoutStore.updateSet(currentExerciseIndex.value, setIndex, {
    reps: Math.max(0, Math.round(value))
  })
  workoutStore.updateDraftFocus(currentExerciseIndex.value, setIndex)
}

function updateDuration(setIndex: number, event: unknown) {
  if (currentExercise.value?.ended || !isDurationExercise(currentExercise.value)) return
  const value = Number(inputValue(event))
  if (!Number.isFinite(value)) return
  workoutStore.updateSet(currentExerciseIndex.value, setIndex, {
    durationSeconds: Math.max(1, Math.round(value))
  })
  workoutStore.updateDraftFocus(currentExerciseIndex.value, setIndex)
}

function setTypeText(setType?: WorkoutSetType) {
  if (setType === 'WARMUP') return '热'
  if (setType === 'DROP') return '降'
  if (setType === 'FAILURE') return '力'
  return ''
}

function chooseSetType(exerciseIndex: number, setIndex: number) {
  const set = workoutStore.activeExercises[exerciseIndex]?.sets[setIndex]
  if (!set || set.done) return
  const values: WorkoutSetType[] = ['NORMAL', 'WARMUP', 'DROP', 'FAILURE']
  uni.showActionSheet({
    itemList: ['普通组', '热身组', '递减组', '力竭组'],
    success: ({ tapIndex }) => {
      const type = values[tapIndex]
      if (type) workoutStore.setSetType(exerciseIndex, setIndex, type)
    }
  })
}

function selectEffort(effort: WorkoutEffort) {
  const target = effortTarget.value
  if (!target) return
  workoutStore.setEffort(target.exerciseIndex, target.setIndex, effort)
  effortTarget.value = null
}

async function applyRecommendation(exerciseIndex: number) {
  try {
    if (await workoutStore.applyRecommendation(exerciseIndex)) {
      uni.showToast({ title: '已应用为本次及下次目标', icon: 'none' })
    }
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : '建议已过期，请重新进入训练'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
  }
}

function showProgressionMembership() {
  void membershipPromptStore.open(
    'Pro 训练建议',
    '升级 Pro 后可查看下一次训练的具体重量、次数或时长目标，以及生成建议的训练依据。',
    'progression_recommendation'
  )
}

async function keepCurrentRecommendation(exerciseIndex: number) {
  const exercise = workoutStore.activeExercises[exerciseIndex]
  if (!exercise) return
  try {
    await workoutStore.dismissRecommendation(exercise.id)
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : '建议已过期，请重新进入训练'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
  }
}

function applyLastPerformance(exerciseIndex: number) {
  const applied = workoutStore.applyLastPerformance(exerciseIndex)
  uni.showToast({ title: applied ? '已沿用上次记录' : '暂无上次记录', icon: 'none' })
}

function showToolFeedback(message: string) {
  toolFeedback.value = message
  if (toolFeedbackTimer) clearTimeout(toolFeedbackTimer)
  toolFeedbackTimer = setTimeout(() => {
    toolFeedback.value = ''
    toolFeedbackTimer = null
  }, 2800)
}

function generateWarmups(exerciseIndex: number) {
  const exercise = workoutStore.activeExercises[exerciseIndex]
  if (!exercise) return
  if (hasWarmupSets(exercise)) {
    warmupManagerIndex.value = exerciseIndex
    return
  }
  if (isBodyweightExercise(exercise)) {
    showToolFeedback('自重动作建议直接开始，也可以手动添加适应组')
    return
  }
  if (isDurationExercise(exercise)) {
    showToolFeedback('计时动作暂不生成热身组')
    return
  }
  const firstWorkSet = exercise.sets.find((set) => set.setType !== 'WARMUP')
  if (!firstWorkSet?.weight) {
    showToolFeedback('请先设置第一个正式组重量')
    return
  }
  const candidates = buildWarmupCandidates({
    targetWeight: firstWorkSet.weight,
    targetReps: firstWorkSet.reps,
    weightStep:
      unit.value === 'lb' ? convertUnitToKg(profileStore.weightStepLb, 'lb') : profileStore.weightStepKg
  })
  if (!candidates.length) {
    showToolFeedback('当前重量不需要额外热身组')
    return
  }
  warmupPreviewIndex.value = exerciseIndex
  warmupPreviewSets.value = candidates
  return
  const generated = workoutStore.generateWarmupSets(exerciseIndex)
  showToolFeedback(generated ? '已生成 2 组热身组，可继续调整重量和次数' : '请先设置首个正式组重量')
}

function insertWarmupPreview() {
  const exerciseIndex = warmupPreviewIndex.value
  if (exerciseIndex === null) return
  const inserted = workoutStore.insertWarmupSets(exerciseIndex, warmupPreviewSets.value)
  showToolFeedback(
    inserted
      ? `已插入 ${warmupPreviewSets.value.length} 组热身组，可继续调整重量和次数`
      : '当前动作无法插入热身组'
  )
  closeWarmupPreview()
}

function closeWarmupPreview() {
  warmupPreviewIndex.value = null
  warmupPreviewSets.value = []
}

function applySupersetToggle(exerciseIndex: number) {
  const exercise = workoutStore.activeExercises[exerciseIndex]
  const ok = exercise?.supersetGroupId
    ? workoutStore.removeSuperset(exerciseIndex)
    : workoutStore.toggleSupersetWithNext(exerciseIndex)
  menuExerciseIndex.value = null
  if (!ok) uni.showToast({ title: '需要下一个动作才能组成超级组', icon: 'none' })
}

function toggleSuperset(exerciseIndex: number) {
  const exercise = workoutStore.activeExercises[exerciseIndex]
  if (exercise?.supersetGroupId || uni.getStorageSync('FITFORGE_SUPERSET_INTRO_SEEN')) {
    applySupersetToggle(exerciseIndex)
    return
  }
  menuExerciseIndex.value = null
  supersetIntroIndex.value = exerciseIndex
}

function startSupersetFromIntro() {
  const exerciseIndex = supersetIntroIndex.value
  if (exerciseIndex === null) return
  uni.setStorageSync('FITFORGE_SUPERSET_INTRO_SEEN', '1')
  supersetIntroIndex.value = null
  applySupersetToggle(exerciseIndex)
}

function handleWarmupManagerAction(item: { key: string }) {
  const exerciseIndex = warmupManagerIndex.value
  if (exerciseIndex === null) return
  if (item.key === 'regenerate') {
    const removed = workoutStore.removeWarmupSets(exerciseIndex)
    if (removed) generateWarmups(exerciseIndex)
    else uni.showToast({ title: '已完成的热身组不能重新生成', icon: 'none' })
  }
  if (item.key === 'remove') {
    const removed = workoutStore.removeWarmupSets(exerciseIndex)
    showToolFeedback(removed ? '已删除全部热身组' : '已完成的热身组不能删除')
  }
  warmupManagerIndex.value = null
}

function openPlateCalculator(exerciseIndex: number) {
  currentExerciseIndex.value = exerciseIndex
  menuExerciseIndex.value = null
  plateCalculatorVisible.value = true
}

function findSupersetNextIndex(exerciseIndex: number) {
  const groupId = workoutStore.activeExercises[exerciseIndex]?.supersetGroupId
  if (!groupId) return null
  const candidates = workoutStore.activeExercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(
      ({ exercise, index }) =>
        index !== exerciseIndex &&
        exercise.supersetGroupId === groupId &&
        !exercise.ended &&
        exercise.sets.some((set) => !set.done)
    )
  return candidates[0]?.index ?? null
}

function canToggleSuperset(exerciseIndex: number) {
  const exercise = workoutStore.activeExercises[exerciseIndex]
  if (exercise?.supersetGroupId) return true
  const nextExercise = workoutStore.activeExercises[exerciseIndex + 1]
  return Boolean(nextExercise && !nextExercise.ended)
}

function openReplacementPicker(exerciseIndex: number) {
  replacementTargetIndex.value = exerciseIndex
  pickerVisible.value = true
  menuExerciseIndex.value = null
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

  const shouldAskEffort =
    (targetSet.setType || 'NORMAL') !== 'WARMUP' &&
    exercise.sets.filter((set) => set.setType !== 'WARMUP' && !set.done).length === 1

  workoutStore.toggleSet(currentExerciseIndex.value, setIndex)
  void workoutStore.reportRecommendationOverrideIfNeeded(currentExerciseIndex.value)
  const afterExercise = workoutStore.activeExercises[currentExerciseIndex.value]
  const supersetNextIndex = findSupersetNextIndex(currentExerciseIndex.value)
  if (supersetNextIndex !== null) {
    if (afterExercise.sets.every((set) => set.done)) {
      workoutStore.endExercise(currentExerciseIndex.value)
    }
    if (supersetNextIndex < currentExerciseIndex.value) {
      startRest('超级组一轮已完成', supersetNextIndex)
    } else {
      void focusWorkoutExercise(supersetNextIndex)
    }
    return
  }
  // 余力反馈只在不需要切换超级组动作时询问，避免打断组合训练节奏。
  if (shouldAskEffort) {
    effortTarget.value = { exerciseIndex: currentExerciseIndex.value, setIndex }
  }
  if (afterExercise.sets.every((set) => set.done)) {
    const nextIndex = findNextExerciseIndex(currentExerciseIndex.value)
    workoutStore.endExercise(currentExerciseIndex.value)
    if (nextIndex !== null) {
      void focusWorkoutExercise(nextIndex)
    }
    startRest(
      nextIndex === null
        ? `${afterExercise.name} 已完成`
        : `${afterExercise.name} 已完成 · 下一项 ${workoutStore.activeExercises[nextIndex]?.name || ''}`
    )
    return
  }
  startRest(`第 ${setIndex + 1} 组已完成`)
}

function addSet(exerciseIndex = currentExerciseIndex.value) {
  if (workoutStore.activeExercises[exerciseIndex]?.ended) return
  workoutStore.addSet(exerciseIndex)
  menuExerciseIndex.value = null
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
  workoutStore.updateDraftFocus(exerciseIndex)
}

function openExercisePicker() {
  pickerVisible.value = true
}

function closeExercisePicker() {
  pickerVisible.value = false
  replacementTargetIndex.value = null
}

function addExerciseFromPicker(exercise: ExerciseSummary) {
  if (replacementTargetIndex.value !== null) {
    const targetIndex = replacementTargetIndex.value
    const current = workoutStore.activeExercises[targetIndex]
    if (current?.sets.some((set) => set.done)) {
      pendingReplacement.value = { targetIndex, exercise }
      pickerVisible.value = false
    } else {
      replaceExercise(targetIndex, exercise)
    }
    return
  }
  const added = workoutStore.addExercise(
    exercise.id,
    exercise.name,
    exercise.primaryMuscle || '',
    exercise.recordType || 'WEIGHT_REPS',
    exercise.equipment
  )
  if (!added) {
    uni.showToast({ title: '该动作已在本次训练中', icon: 'none' })
    return
  }
  void focusWorkoutExercise(workoutStore.activeExercises.length - 1)
  pickerVisible.value = false
  uni.showToast({ title: '已添加动作', icon: 'none' })
}

function replaceExercise(targetIndex: number, exercise: ExerciseSummary) {
  const replaced = workoutStore.replaceExercise(
    targetIndex,
    exercise.id,
    exercise.name,
    exercise.primaryMuscle || '',
    exercise.recordType || 'WEIGHT_REPS',
    exercise.equipment
  )
  if (replaced) void focusWorkoutExercise(targetIndex)
  pickerVisible.value = false
  replacementTargetIndex.value = null
  pendingReplacement.value = null
}

function confirmReplacement() {
  const pending = pendingReplacement.value
  if (pending) replaceExercise(pending.targetIndex, pending.exercise)
}

function cancelReplacement() {
  pendingReplacement.value = null
  replacementTargetIndex.value = null
}

function finishExerciseEarly() {
  const exercise = currentExercise.value
  if (!exercise) return
  void workoutStore.reportRecommendationOverrideIfNeeded(currentExerciseIndex.value)

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
    void focusWorkoutExercise(nextIndex)
    startRest(
      `${exercise.name} 已完成 · 下一项 ${workoutStore.activeExercises[nextIndex]?.name || ''}`
    )
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

  if (!exerciseDoneSets(exercise)) {
    confirmDeleteExercise(index)
    return
  }

  pendingDeleteIndex.value = index
  menuExerciseIndex.value = null
}

function confirmDeleteExercise(index = pendingDeleteIndex.value) {
  if (index === null) return
  workoutStore.removeExercise(index)
  currentExerciseIndex.value = Math.min(
    currentExerciseIndex.value,
    Math.max(workoutStore.activeExercises.length - 1, 0)
  )
  workoutStore.updateDraftFocus(currentExerciseIndex.value)
  menuExerciseIndex.value = null
  pendingDeleteIndex.value = null
}

function buildWorkoutComparisons() {
  return workoutStore.activeExercises
    .map<WorkoutComparison | null>((exercise) => {
      const doneSets = exercise.sets.filter((set) => set.done && set.setType !== 'WARMUP')
      if (!doneSets.length) return null
      const currentVolumeKg = isBodyweightExercise(exercise)
        ? 0
        : doneSets.reduce((total, set) => total + set.weight * set.reps, 0)
      const currentMaxWeightKg = isBodyweightExercise(exercise)
        ? 0
        : doneSets.reduce((max, set) => Math.max(max, set.weight), 0)
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
  await workoutStore.reportAllRecommendationOverrides()
  const startedAt =
    workoutStore.startedAt ||
    new Date(Date.now() - workoutStore.elapsedSeconds * 1000).toISOString()
  const endedAt = new Date().toISOString()
  const items = workoutStore.activeExercises
    .map((exercise) => ({
      exerciseId: exercise.id,
      targetSets: exercise.sets.filter((set) => set.setType !== 'WARMUP').length,
      sets: exercise.sets
        .filter((set) => set.done)
        .map((set) => ({
          weightKg:
            isBodyweightExercise(exercise) || isDurationExercise(exercise)
              ? 0
              : Number(set.weight.toFixed(2)),
          reps: isDurationExercise(exercise) ? 1 : set.reps,
          durationSeconds: isDurationExercise(exercise) ? set.durationSeconds || 60 : undefined,
          setType: set.setType || 'NORMAL',
          effort: set.effort,
          plannedWeightKg: set.plannedWeightKg ?? set.weight,
          plannedReps: set.plannedReps ?? set.reps,
          plannedDurationSeconds: set.plannedDurationSeconds ?? set.durationSeconds,
          targetSource: set.targetSource ?? 'MANUAL',
          sourceRecommendationId: set.sourceRecommendationId
        }))
    }))
    .filter((item) => item.sets.length > 0)

  if (!items.length) {
    uni.showToast({ title: '请至少完成一组再提交', icon: 'none' })
    return
  }

  workoutStore.persistDraft()
  submitting.value = true
  const payload: SaveTrainingRequest = {
    templateId: workoutStore.activeTemplateId,
    planId: workoutStore.activePlanId,
    planDayId: workoutStore.activePlanDayId,
    executionId: workoutStore.activeExecutionId,
    executionDayId: workoutStore.activeExecutionDayId,
    sourceType:
      workoutStore.activeExecutionId && workoutStore.activeExecutionDayId
        ? 'SYSTEM_EXECUTION'
        : undefined,
    clientRequestId: workoutStore.ensureClientRequestId(),
    trainingName: workoutStore.activeTemplateName || '自由训练',
    startedAt: toLocalDateTimeString(startedAt),
    endedAt: toLocalDateTimeString(endedAt),
    items
  }
  let result: Awaited<ReturnType<typeof saveTraining>>
  try {
    result = await saveTraining({
      ...payload
    })
  } catch (err) {
    workoutStore.markSaveFailed(payload)
    const message = err instanceof Error && err.message ? err.message : '保存失败，请重试'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
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
    activeTemplateId: workoutStore.activeTemplateId,
    activePlanId: workoutStore.activePlanId,
    activePlanDayId: workoutStore.activePlanDayId,
    activeExecutionId: workoutStore.activeExecutionId,
    activeExecutionDayId: workoutStore.activeExecutionDayId,
    plannedItems: workoutStore.activeExercises.map((exercise) => ({
      exerciseId: exercise.id,
      targetSets: exercise.sets.length
    })),
    comparisons: buildWorkoutComparisons()
  })
  workoutStore.finishWorkout()
  trainingStore.invalidateCache()
  emitTrainingChanged()
  uni.redirectTo({ url: `${routes.historyDetail}?id=${result.trainingId}&settleLevel=1` })
}

async function retrySaveFailedDraft() {
  if (submitting.value || !workoutStore.lastSubmitPayload) return
  submitting.value = true
  try {
    const result = await saveTraining(workoutStore.lastSubmitPayload)
    workoutStore.setCompletedSummary({
      ...result,
      trainingName: workoutStore.lastSubmitPayload.trainingName,
      startedAt: workoutStore.lastSubmitPayload.startedAt,
      endedAt: workoutStore.lastSubmitPayload.endedAt,
      activeTemplateId: workoutStore.lastSubmitPayload.templateId,
      activePlanId: workoutStore.lastSubmitPayload.planId,
      activePlanDayId: workoutStore.lastSubmitPayload.planDayId,
      activeExecutionId: workoutStore.lastSubmitPayload.executionId,
      activeExecutionDayId: workoutStore.lastSubmitPayload.executionDayId,
      plannedItems: workoutStore.activeExercises.map((exercise) => ({
        exerciseId: exercise.id,
        targetSets: exercise.sets.length
      })),
      comparisons: buildWorkoutComparisons()
    })
    workoutStore.finishWorkout()
    trainingStore.invalidateCache()
    emitTrainingChanged()
    uni.redirectTo({ url: `${routes.historyDetail}?id=${result.trainingId}&settleLevel=1` })
  } catch (err) {
    console.error('[training] retry failed save failed', err)
    uni.showToast({ title: '重新提交失败，请稍后再试', icon: 'none' })
  } finally {
    submitting.value = false
  }
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
  if (restTimer) clearInterval(restTimer)
  restTimer = null
  workoutStore.persistDraft()
})

onShow(() => {
  restoreRestFromClock()
})

onUnmounted(() => {
  if (workoutStore.hasMeaningfulDraft) {
    workoutStore.persistDraft()
  } else {
    workoutStore.discardWorkout()
  }
  clearTimers()
})
</script>

<template>
  <view class="workout-active" :class="themeStore.themeClass">
    <view class="workout-active__top">
      <view class="workout-active__close btn-press" @tap="closePage">×</view>
      <view class="workout-active__title-wrap">
        <view class="workout-active__source">{{ sourceText }}</view>
        <view class="workout-active__title">{{ workoutStore.activeTemplateName }}</view>
        <view class="workout-active__timer">{{ formatSeconds(workoutStore.elapsedSeconds) }}</view>
      </view>
      <view class="workout-active__top-spacer" />
    </view>

    <view class="workout-active__progress">
      <view class="workout-active__progress-head">
        <view>
          <view class="muted">{{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组已完成</view>
          <view class="workout-active__percent">{{ Math.round(workoutStore.progress * 100) }}%</view>
        </view>
        <view
          class="workout-active__done btn-press"
          :class="{ 'workout-active__done--disabled': submitting }"
          @tap="handleFinishTap"
        >
          {{ submitting ? '保存中' : '完成训练' }}
        </view>
      </view>
      <ProgressBar :value="workoutStore.progress" />
    </view>

    <view v-if="workoutStore.hasSaveFailedDraft" class="workout-active__save-failed">
      <view>
        <view class="workout-active__save-failed-title">训练已保存在本机</view>
        <view class="workout-active__save-failed-sub">上次提交失败，可以继续训练或重新提交。</view>
      </view>
      <view class="workout-active__save-failed-action btn-press" @tap="retrySaveFailedDraft">
        重新提交
      </view>
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

    <view class="glass-card workout-active__focus">
      <view>
        <view class="workout-active__focus-label">当前动作</view>
        <view class="workout-active__focus-title">{{ currentActionTitle }}</view>
        <view class="workout-active__focus-sub">{{ currentActionSub }}</view>
      </view>
      <view class="workout-active__focus-pill">
        {{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组
      </view>
    </view>

    <view class="workout-active__switcher">
      <view
        class="glass-card workout-active__switch btn-press"
        :class="{ 'workout-active__switch--disabled': previousExerciseIndex === null }"
        @tap="switchExercise(-1)"
        >{{ previousExerciseText }}</view
      >
      <view class="workout-active__switch-index">
        {{ workoutStore.activeExercises.length ? currentExerciseIndex + 1 : 0 }} /
        {{ workoutStore.activeExercises.length }}
      </view>
      <view
        class="glass-card workout-active__switch btn-press"
        :class="{ 'workout-active__switch--disabled': nextExerciseIndex === null }"
        @tap="switchExercise(1)"
        >{{ nextExerciseText }}</view
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
      >
        <view class="workout-active__card-top" @tap="handleCardTap(exerciseIndex)">
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
                <text v-if="exercise.supersetGroupId" class="workout-active__superset-badge"
                  >超级组</text
                >
              </view>
              <view class="workout-active__card-sub">
                {{ exerciseSummaryText(exercise) }}
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
              <view class="workout-active__menu-item" @tap="openReplacementPicker(exerciseIndex)">
                替换动作
              </view>
              <view
                v-if="canToggleSuperset(exerciseIndex)"
                class="workout-active__menu-item"
                @tap="toggleSuperset(exerciseIndex)"
              >
                {{ exercise.supersetGroupId ? '取消组合训练' : '与下一动作组合训练' }}
              </view>
              <view
                v-if="isBarbellExercise(exercise)"
                class="workout-active__menu-item"
                @tap="openPlateCalculator(exerciseIndex)"
              >
                杠铃片计算
              </view>
              <view
                class="workout-active__menu-item workout-active__menu-item--danger"
                @tap="deleteExercise(exerciseIndex)"
              >
                删除动作
              </view>
            </view>
          </view>
        </view>

        <view class="workout-active__card-content" @tap.stop>
          <view class="workout-active__current">
            当前第 {{ currentSetIndex + 1 }} / {{ exercise.sets.length }} 组
          </view>
          <view class="workout-active__last-reference">
            {{ lastSetText(exercise, currentSetIndex) }}
          </view>

          <ProgressionRecommendation
            :recommendation="workoutStore.recommendationMap[exercise.id]"
            @apply="applyRecommendation(exerciseIndex)"
            @keep="keepCurrentRecommendation(exerciseIndex)"
            @upgrade="showProgressionMembership"
          />

          <view v-if="!exercise.ended" class="workout-active__quick-tools">
            <view
              class="workout-active__quick-tool btn-press"
              @tap="applyLastPerformance(exerciseIndex)"
            >
              沿用上次
            </view>
            <view
              v-if="!isBodyweightExercise(exercise) && !isDurationExercise(exercise)"
              class="workout-active__quick-tool btn-press"
              @tap="generateWarmups(exerciseIndex)"
            >
              {{
                hasWarmupSets(exercise) ? `热身组 ${warmupSetCount(exercise)}组 ▾` : '生成热身组'
              }}
            </view>
          </view>
          <view v-if="toolFeedback" class="workout-active__tool-feedback">
            {{ toolFeedback }}
          </view>

          <view
            class="workout-active__set-labels"
            :class="{ 'workout-active__set-labels--duration': isDurationExercise(exercise) }"
          >
            <text>组</text>
            <text>{{
              isDurationExercise(exercise)
                ? '时长(秒)'
                : isBodyweightExercise(exercise)
                  ? '自重'
                  : `重量(${unit})`
            }}</text>
            <text v-if="!isDurationExercise(exercise)">次数</text>
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
                'workout-active__set--done': set.done,
                'workout-active__set--duration': isDurationExercise(exercise)
              }"
            >
              <view
                class="workout-active__set-index btn-press"
                :class="{ 'workout-active__set-index--typed': setTypeText(set.setType) }"
                @tap.stop="chooseSetType(exerciseIndex, setIndex)"
              >
                {{ setTypeText(set.setType) || setIndex + 1 }}
              </view>
              <view
                class="workout-active__stepper"
                :class="{ 'workout-active__stepper--static': isBodyweightExercise(exercise) }"
              >
                <view
                  v-if="!isBodyweightExercise(exercise)"
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="
                    startStepTimer(() =>
                      isDurationExercise(exercise)
                        ? stepDuration(setIndex, -1)
                        : stepWeight(setIndex, -1)
                    )
                  "
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  -
                </view>
                <input
                  class="workout-active__input"
                  :class="{
                    'workout-active__input--locked':
                      set.done || exercise.ended || isBodyweightExercise(exercise)
                  }"
                  :type="isBodyweightExercise(exercise) ? 'text' : 'digit'"
                  :disabled="set.done || exercise.ended || isBodyweightExercise(exercise)"
                  :value="
                    isDurationExercise(exercise)
                      ? set.durationSeconds || 60
                      : isBodyweightExercise(exercise)
                        ? '自重'
                        : formatWeight(set.weight, unit, 1)
                  "
                  @blur="
                    isDurationExercise(exercise)
                      ? updateDuration(setIndex, $event)
                      : updateWeight(setIndex, $event)
                  "
                />
                <view
                  v-if="!isBodyweightExercise(exercise)"
                  class="workout-active__stepper-btn btn-press"
                  @touchstart.stop.prevent="
                    startStepTimer(() =>
                      isDurationExercise(exercise)
                        ? stepDuration(setIndex, 1)
                        : stepWeight(setIndex, 1)
                    )
                  "
                  @touchend.stop.prevent="clearStepTimer"
                  @touchcancel.stop.prevent="clearStepTimer"
                >
                  +
                </view>
              </view>
              <view v-if="!isDurationExercise(exercise)" class="workout-active__stepper">
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
          </view>
          <view
            class="gradient-fire workout-active__finish-exercise btn-press"
            :class="{ 'workout-active__finish-exercise--done': exercise.ended }"
            @tap.stop="finishExerciseEarly"
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

    <view v-if="showExitConfirm" class="workout-active__overlay" @tap="cancelExit">
      <view class="workout-active__sheet workout-active__sheet--confirm" @tap.stop>
        <view class="workout-active__sheet-handle" />
        <view class="workout-active__confirm-title">{{ exitConfirmTitle }}</view>
        <view class="muted workout-active__confirm-desc">{{ exitConfirmDesc }}</view>
        <view class="workout-active__confirm-hint">{{ exitConfirmHint }}</view>
        <view class="workout-active__confirm-actions">
          <view class="glass-card workout-active__confirm-btn btn-press" @tap="cancelExit">
            {{ exitConfirmCancelText }}
          </view>
          <view
            class="gradient-fire workout-active__confirm-btn workout-active__confirm-btn--primary btn-press"
            @tap="confirmExit"
          >
            {{ exitConfirmSubmitText }}
          </view>
        </view>
      </view>
    </view>

    <ExercisePicker
      :class="themeStore.themeClass"
      :visible="pickerVisible"
      title="添加训练动作"
      subtitle="搜索并加入本次训练"
      :selected-ids="selectedExerciseIds"
      @close="closeExercisePicker"
      @select="addExerciseFromPicker"
    />
    <EffortPicker
      :visible="Boolean(effortTarget)"
      @close="effortTarget = null"
      @select="selectEffort"
    />
    <PlateCalculator
      :visible="plateCalculatorVisible"
      :target-weight="plateCalculatorTarget"
      :default-bar-weight="profileStore.barWeightKg"
      @close="plateCalculatorVisible = false"
    />
    <view v-if="warmupPreviewIndex !== null" class="workout-active__overlay" @tap="closeWarmupPreview">
      <view class="workout-active__sheet workout-active__warmup-sheet" @tap.stop>
        <view class="workout-active__sheet-handle" />
        <view class="title-lg">建议热身组</view>
        <view class="muted workout-active__sheet-sub">
          根据 {{ warmupPreviewExercise?.name || '当前动作' }} 的第一个正式组计算，热身组不计入容量、完成率和进阶判断。
        </view>
        <view class="workout-active__warmup-list">
          <view
            v-for="(item, index) in warmupPreviewSets"
            :key="`${item.weight}-${item.reps}-${index}`"
            class="workout-active__warmup-row"
          >
            <view class="workout-active__warmup-index">{{ index + 1 }}</view>
            <view>
              <view class="workout-active__warmup-value">
                {{ formatWeight(item.weight, unit, 1) }} {{ unit }} × {{ item.reps }}
              </view>
              <view class="muted workout-active__warmup-desc">插入后可继续手动调整</view>
            </view>
          </view>
        </view>
        <view class="gradient-fire workout-active__sheet-btn btn-press" @tap="insertWarmupPreview">
          插入热身组
        </view>
        <view class="glass-card workout-active__sheet-btn btn-press" @tap="closeWarmupPreview">
          取消
        </view>
      </view>
    </view>
    <AppActionSheet
      :visible="warmupManagerIndex !== null"
      title="管理热身组"
      subtitle="热身组不会计入正式训练统计"
      :items="[
        {
          key: 'regenerate',
          label: '按正式组重新生成',
          description: '删除当前热身组，并按首个正式组重量重新计算'
        },
        { key: 'remove', label: '删除全部热身组', danger: true }
      ]"
      @close="warmupManagerIndex = null"
      @select="handleWarmupManagerAction"
    />
    <AppActionSheet
      :visible="supersetIntroIndex !== null"
      title="组合训练"
      subtitle="两个动作会交替进行，完成一轮后再开始休息。"
      :items="[
        {
          key: 'start',
          label: '与下一动作开始组合',
          description: '完成当前组后自动切换到配对动作',
          primary: true
        }
      ]"
      @close="supersetIntroIndex = null"
      @select="startSupersetFromIntro"
    />
    <AppActionSheet
      :visible="pendingReplacement !== null"
      title="替换动作？"
      subtitle="当前动作已有完成组，替换后这些完成组会被移除。"
      :items="[{ key: 'confirm', label: '确认替换', danger: true }]"
      @close="cancelReplacement"
      @select="confirmReplacement"
    />
    <AppActionSheet
      :visible="pendingDeleteIndex !== null"
      title="删除动作？"
      :subtitle="`${workoutStore.activeExercises[pendingDeleteIndex ?? -1]?.name || '当前动作'} 已有完成组，删除后本次训练不会提交这些组。`"
      :items="[{ key: 'confirm', label: '确认删除', danger: true }]"
      @close="pendingDeleteIndex = null"
      @select="confirmDeleteExercise()"
    />
  </view>
</template>

<style lang="scss" scoped>
.workout-active {
  min-height: 100vh;
  background: var(--app-bg);
  padding: calc(var(--status-bar-height, 0px) + env(safe-area-inset-top) + 24rpx) 32rpx
    calc(env(safe-area-inset-bottom) + 148rpx);
  display: flex;
  flex-direction: column;

  &__top,
  &__progress,
  &__stats,
  &__focus,
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
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    font-size: 34rpx;
  }

  &__top-spacer {
    width: 72rpx;
    height: 72rpx;
    flex-shrink: 0;
  }

  &__done {
    min-width: 168rpx;
    min-height: 68rpx;
    padding: 0 24rpx;
    border-radius: 24rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-size: 24rpx;
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

  &__source {
    margin-bottom: 4rpx;
    color: var(--app-accent);
    font-size: 20rpx;
    font-weight: 800;
  }

  &__timer,
  &__percent {
    color: var(--app-accent);
    font-weight: 800;
  }

  &__timer {
    margin-top: 8rpx;
    font-size: 40rpx;
  }

  &__progress {
    margin-top: 24rpx;
  }

  &__progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
    margin-bottom: 8rpx;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12rpx;
    margin: 18rpx 0 14rpx;
  }

  &__save-failed {
    margin-top: 18rpx;
    padding: 20rpx;
    border: 1rpx solid rgba(255, 100, 24, 0.2);
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
    background: linear-gradient(135deg, rgba(255, 246, 239, 0.98), rgba(255, 255, 255, 0.94));
  }

  &__save-failed-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__save-failed-sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
    line-height: 1.4;
  }

  &__save-failed-action {
    flex-shrink: 0;
    padding: 12rpx 18rpx;
    border-radius: 999rpx;
    color: #fff;
    background: var(--app-accent);
    font-size: 21rpx;
    font-weight: 900;
  }

  &__stat {
    padding: 18rpx 20rpx;
  }

  &__stat-label {
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__stat-value {
    margin-top: 8rpx;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__focus {
    padding: 20rpx 22rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    border-color: rgba(255, 80, 30, 0.18);
  }

  &__focus-label {
    color: var(--app-accent);
    font-size: 21rpx;
    font-weight: 800;
  }

  &__focus-title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 800;
    line-height: 1.35;
  }

  &__focus-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__focus-pill {
    flex-shrink: 0;
    padding: 12rpx 18rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__switcher {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16rpx;
    margin: 12rpx 0 16rpx;
  }

  &__switch {
    padding: 18rpx 20rpx;
    text-align: center;
    color: var(--app-text);
    font-size: 24rpx;
    line-height: 1.35;

    &--disabled {
      opacity: 0.72;
    }
  }

  &__switch-index {
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__list {
    flex: 1;
  }

  &__empty {
    flex: 0 0 auto;
    min-height: 360rpx;
    margin-top: 24rpx;
    padding: 40rpx 32rpx;
    border-radius: 28rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  &__empty-title {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__empty-sub {
    max-width: 520rpx;
    margin-top: 14rpx;
    color: var(--app-text-muted);
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
    padding: 20rpx;
    margin-bottom: 14rpx;
    overflow: visible !important;

    &--current {
      border-color: rgba(255, 80, 30, 0.28);
      z-index: 1;
    }

    &--collapsed {
      padding: 22rpx 24rpx;
    }

    &--ended {
      border-color: var(--app-border);
      background: var(--app-surface);
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
    background: var(--app-accent-soft);
    border: 1px solid rgba(255, 80, 30, 0.28);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 24rpx;
    font-weight: 900;

    &--current {
      background: var(--app-accent);
      border-color: transparent;
      color: #fff;
      box-shadow: none;
    }
  }

  &__card-copy {
    min-width: 0;
  }

  &__card-title {
    font-size: 30rpx;
    font-weight: 700;

    &-text {
      display: inline;
    }

    &--ended {
      color: var(--app-text-muted);

      .workout-active__card-title-text {
        text-decoration: line-through;
        text-decoration-thickness: 3rpx;
        text-decoration-color: rgba(255, 122, 50, 0.78);
      }
    }
  }

  &__superset-badge {
    display: inline-block;
    margin-left: 10rpx;
    padding: 4rpx 10rpx;
    border-radius: 999rpx;
    background: rgba(47, 125, 247, 0.1);
    color: var(--app-info, #2f7df7);
    font-size: 18rpx;
    vertical-align: middle;
  }

  &__card-sub {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: var(--app-text-muted);
  }

  &__resume {
    min-width: 112rpx;
    min-height: 56rpx;
    border-radius: 999rpx;
    background: var(--app-surface);
    color: var(--app-text-secondary);
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
    color: var(--app-text-muted);
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
    background: var(--app-surface-raised);
    border: 1px solid var(--app-border);
    z-index: 60;
    box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.36);
  }

  &__menu-item {
    padding: 18rpx;
    color: var(--app-text);
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
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 700;
  }

  &__quick-tools {
    display: flex;
    gap: 12rpx;
    margin-bottom: 16rpx;
  }

  &__quick-tool {
    padding: 12rpx 18rpx;
    border-radius: 999rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    color: var(--app-text-secondary);
    font-size: 21rpx;
    font-weight: 800;

    &--disabled {
      color: var(--app-text-muted);
      background: var(--app-surface-subtle);
      opacity: 0.72;
    }
  }

  &__tool-feedback {
    margin: -4rpx 0 16rpx;
    padding: 14rpx 18rpx;
    border-radius: 18rpx;
    background: var(--app-accent-soft);
    border: 1px solid rgba(255, 100, 24, 0.16);
    color: var(--app-text-secondary);
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__last-reference {
    margin-bottom: 16rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__set {
    display: grid;
    grid-template-columns: 58rpx 1fr 1fr 64rpx;
    gap: 12rpx;
    align-items: center;
    padding: 12rpx 8rpx;
    border-radius: 20rpx;
    margin-bottom: 10rpx;
    border: 1px solid transparent;

    &--current {
      background: rgba(255, 80, 30, 0.1);
      border-color: rgba(255, 80, 30, 0.42);
    }

    &--done {
      opacity: 1;
    }

    &--duration {
      grid-template-columns: 58rpx 1fr 64rpx;
    }
  }

  &__set-index {
    color: var(--app-text);
    text-align: center;
    font-size: 30rpx;
    font-weight: 800;

    &--typed {
      width: 48rpx;
      height: 48rpx;
      margin: 0 auto;
      border-radius: 999rpx;
      background: var(--app-accent-soft);
      color: var(--app-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20rpx;
    }
  }

  &__stepper {
    display: grid;
    grid-template-columns: 60rpx 1fr 60rpx;
    align-items: center;
    min-height: 76rpx;
    border-radius: 18rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    overflow: hidden;

    &--static {
      grid-template-columns: 1fr;
      background: var(--app-bg);
    }
  }

  &__stepper-btn {
    height: 76rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    font-size: 32rpx;
    font-weight: 700;
    background: var(--app-bg);

    &:active {
      background: rgba(255, 80, 30, 0.15);
      color: var(--app-accent);
    }
  }

  &__input {
    height: 76rpx;
    color: var(--app-text);
    text-align: center;
    font-size: 32rpx;
    font-weight: 800;

    &--locked {
      color: var(--app-text-muted);
    }
  }

  &__set-toggle {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    font-size: 28rpx;
    font-weight: 800;

    &--done {
      background: var(--app-success);
      border-color: transparent;
      color: #fff;
    }
  }

  &__set-labels {
    display: grid;
    grid-template-columns: 58rpx 1fr 1fr 64rpx;
    gap: 16rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
    text-align: center;
    padding: 0 8rpx 12rpx;

    &--duration {
      grid-template-columns: 58rpx 1fr 64rpx;
    }
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16rpx;
    margin-top: 10rpx;
  }

  &__action {
    min-height: 76rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
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
    background: var(--app-surface);
    color: var(--app-text-secondary);
  }

  &__add-exercise {
    margin-bottom: 32rpx;
    color: var(--app-accent);
  }

  &__rest {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(env(safe-area-inset-bottom) + 32rpx);
    z-index: 100;
    padding: 32rpx;
    border-radius: 40rpx;
    background: var(--app-surface-raised);
    border: 1px solid rgba(255, 80, 30, 0.4);
    backdrop-filter: blur(20px);
    color: var(--app-text);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    box-shadow:
      0 32rpx 80rpx rgba(0, 0, 0, 0.6),
      0 0 40rpx rgba(255, 80, 30, 0.2);
  }

  &__rest-title {
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }

  &__rest-time {
    margin-top: 8rpx;
    font-size: 44rpx;
    font-weight: 900;
    color: var(--app-accent);
    text-shadow: 0 0 20rpx rgba(255, 80, 30, 0.4);
  }

  &__rest-actions {
    display: flex;
    gap: 12rpx;
  }

  &__rest-btn {
    padding: 16rpx 20rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;

    &--primary {
      background: var(--app-accent);
      color: #fff;
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
    background: var(--app-surface-raised);
    border-radius: 36rpx 36rpx 0 0;
    padding: 28rpx 32rpx calc(env(safe-area-inset-bottom) + 28rpx);

    &--confirm {
      margin: 0 24rpx calc(env(safe-area-inset-bottom) + 24rpx);
      border-radius: 34rpx;
      background: var(--app-surface-raised);
      border: 1px solid var(--app-border);
      box-shadow: 0 -24rpx 80rpx rgba(0, 0, 0, 0.52);
      backdrop-filter: blur(18rpx);
    }
  }

  &__sheet-handle {
    width: 80rpx;
    height: 8rpx;
    background: var(--app-border-strong);
    border-radius: 999rpx;
    margin: 0 auto 24rpx;
  }

  &__sheet-sub {
    margin: 16rpx 0 24rpx;
  }

  &__warmup-sheet {
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-floating);
  }

  &__warmup-list {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
    margin-bottom: 22rpx;
  }

  &__warmup-row {
    min-height: 92rpx;
    padding: 18rpx 20rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__warmup-index {
    width: 54rpx;
    height: 54rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-weight: 900;
  }

  &__warmup-value {
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 900;
  }

  &__warmup-desc {
    margin-top: 4rpx;
    font-size: 22rpx;
  }

  &__sheet-btn {
    min-height: 88rpx;
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

  &__confirm-title {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__confirm-desc {
    margin-top: 14rpx;
    font-size: 25rpx;
    line-height: 1.55;
  }

  &__confirm-hint {
    margin-top: 22rpx;
    padding: 18rpx 20rpx;
    border-radius: 22rpx;
    background: rgba(255, 125, 25, 0.12);
    border: 1px solid rgba(255, 125, 25, 0.18);
    color: var(--app-text-secondary);
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__confirm-btn {
    min-height: 88rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    font-size: 28rpx;
    font-weight: 900;

    &--primary {
      color: #fff;
      box-shadow: 0 18rpx 44rpx rgba(255, 93, 24, 0.3);
    }
  }
}
</style>
