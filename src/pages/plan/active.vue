<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import {
  fetchActiveTrainingPlan,
  skipActiveTrainingPlanDay,
  type ActiveExecutionDayResponse,
  type ActiveExecutionItemResponse,
  type TrainingPlanDayResponse,
  type TrainingPlanDetailResponse
} from '@/api/plan'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { usePlanStore } from '@/stores/plan'
import { useTemplateStore } from '@/stores/template'
import { useThemeStore } from '@/stores/theme'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import type { TemplateDetailResponse } from '@/api/template'

type ScheduleSource = 'RECOMMENDED_EXECUTION' | 'MY_PLAN'

interface ScheduleDay {
  source: ScheduleSource
  id: number
  planDayId?: number
  templateId?: number
  title: string
  weekIndex: number
  date?: string
  status: string
  actionType?: string
  canSkip?: boolean
  completedTrainingId?: number
  itemCount?: number
  templateName?: string
  executionItems?: ActiveExecutionItemResponse[]
}

interface PreviewItem {
  id: string
  exerciseName: string
  primaryMuscle?: string
  equipment?: string
  recordType?: string
  targetSets?: number
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  replacementReason?: string
}

const planStore = usePlanStore()
const templateStore = useTemplateStore()
const themeStore = useThemeStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const loading = ref(true)
const missing = ref(false)
const activePlan = ref<TrainingPlanDetailResponse | null>(null)
const selectedDayKey = ref('')
const showFullSchedule = ref(false)
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewDay = ref<ScheduleDay | null>(null)
const previewItems = ref<PreviewItem[]>([])

const summary = computed(() => planStore.currentPlanSummary)
const execution = computed(() => planStore.activeExecution)
const planName = computed(() => summary.value?.planName || activePlan.value?.name || '当前计划')
const currentWeek = computed(
  () =>
    summary.value?.weekIndex || execution.value?.currentWeek || activePlan.value?.currentWeek || 1
)
const totalWeeks = computed(
  () =>
    summary.value?.cycleWeeks || execution.value?.cycleWeeks || activePlan.value?.cycleWeeks || 1
)
const completedThisWeek = computed(
  () => summary.value?.completedThisWeek ?? countCurrentWeekCompleted()
)
const scheduledThisWeek = computed(
  () => summary.value?.scheduledThisWeek ?? currentWeekDays.value.length
)
const remainingThisWeek = computed(
  () =>
    summary.value?.remainingThisWeek ??
    Math.max(0, scheduledThisWeek.value - completedThisWeek.value)
)
const progressPercent = computed(() =>
  scheduledThisWeek.value
    ? Math.min(100, Math.round((completedThisWeek.value / scheduledThisWeek.value) * 100))
    : 0
)
const statusText = computed(() =>
  summaryStatusText(summary.value?.executionStatus || activePlan.value?.executionStatus)
)
const scheduleDays = computed<ScheduleDay[]>(() => {
  if (execution.value?.days.length) {
    return execution.value.days.map((day) => toExecutionScheduleDay(day)).sort(sortScheduleDay)
  }
  return (activePlan.value?.days || []).map((day) => toPlanScheduleDay(day)).sort(sortScheduleDay)
})
const currentWeekDays = computed(() =>
  scheduleDays.value.filter((day) => day.weekIndex === currentWeek.value)
)
const focusedDays = computed(() => {
  const today = toDateString(new Date())
  const upcoming = scheduleDays.value.filter(
    (day) => !day.date || day.date >= today || isActionable(day)
  )
  return (upcoming.length ? upcoming : scheduleDays.value).slice(0, 10)
})
const groupedWeeks = computed(() => {
  const grouped = new Map<number, ScheduleDay[]>()
  scheduleDays.value.forEach((day) => {
    grouped.set(day.weekIndex, [...(grouped.get(day.weekIndex) || []), day])
  })
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekIndex, days]) => ({ weekIndex, days }))
})
const nextDay = computed(
  () =>
    scheduleDays.value.find((day) => isActionable(day)) ||
    scheduleDays.value.find((day) => !isCompleted(day)) ||
    null
)
const selectedDay = computed(
  () =>
    scheduleDays.value.find((day) => dayKey(day) === selectedDayKey.value) ||
    nextDay.value ||
    scheduleDays.value[0] ||
    null
)
const selectedCardLabel = computed(() => {
  const day = selectedDay.value
  if (!day) return '训练安排'
  if (isCompleted(day)) return '已完成训练'
  if (isToday(day.date)) return '今日训练'
  if (day.status === 'OVERDUE') return '待补练'
  return '计划训练'
})
const selectedActionText = computed(() => {
  const day = selectedDay.value
  if (!day) return '去选择'
  if (day.completedTrainingId || isCompleted(day)) return '查看记录'
  if (day.actionType === 'MAKE_UP' || day.status === 'OVERDUE') return '开始补练'
  if (day.actionType === 'START_EARLY') return '提前训练'
  if (isToday(day.date) && isActionable(day)) return '开始训练'
  if (isActionable(day)) return '提前训练'
  return '查看动作'
})
const selectedCanStart = computed(() =>
  Boolean(selectedDay.value && shouldStartDirectly(selectedDay.value))
)
const selectedCanSkip = computed(() => Boolean(selectedDay.value && canSkipDay(selectedDay.value)))
const heroSubtitle = computed(() => {
  if (!scheduleDays.value.length) return ''
  return `第 ${currentWeek.value}/${totalWeeks.value} 周`
})

onShow(loadSchedule)

async function loadSchedule() {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }

  loading.value = true
  missing.value = false
  activePlan.value = null
  try {
    await planStore.loadCurrentPlan()
    if (planStore.activeExecution?.days.length) return
    const active = await fetchActiveTrainingPlan()
    if (!active) {
      missing.value = true
      return
    }
    activePlan.value = active
  } catch (err) {
    missing.value = true
    console.error('[plan] active schedule failed', err)
  } finally {
    applyDefaultSelection()
    loading.value = false
  }
}

function toExecutionScheduleDay(day: ActiveExecutionDayResponse): ScheduleDay {
  return {
    source: 'RECOMMENDED_EXECUTION',
    id: day.id,
    title: day.title,
    weekIndex: day.weekIndex,
    date: day.plannedDate,
    status: day.displayStatus || day.status,
    actionType: day.actionType,
    canSkip: day.canSkip,
    completedTrainingId: day.completedTrainingRecordId,
    itemCount: day.items.length,
    executionItems: day.items
  }
}

function toPlanScheduleDay(day: TrainingPlanDayResponse): ScheduleDay {
  return {
    source: 'MY_PLAN',
    id: day.id,
    planDayId: day.id,
    templateId: day.templateId,
    title: day.title,
    weekIndex: day.weekIndex,
    date: day.scheduledDate,
    status: day.status || 'UPCOMING',
    actionType: day.actionType,
    canSkip: ['START', 'START_EARLY', 'MAKE_UP'].includes(day.actionType || ''),
    completedTrainingId: day.completedTrainingId,
    templateName: day.templateName
  }
}

function sortScheduleDay(a: ScheduleDay, b: ScheduleDay) {
  const dateCompare = (a.date || '').localeCompare(b.date || '')
  if (dateCompare) return dateCompare
  return a.weekIndex - b.weekIndex || a.id - b.id
}

function dayKey(day: ScheduleDay) {
  return `${day.source}-${day.id}`
}

function selectDay(day: ScheduleDay) {
  selectedDayKey.value = dayKey(day)
}

function applyDefaultSelection() {
  const days = scheduleDays.value
  if (!days.length) {
    selectedDayKey.value = ''
    return
  }
  if (selectedDayKey.value && days.some((day) => dayKey(day) === selectedDayKey.value)) return

  const today = toDateString(new Date())
  const todayDay = days.find((day) => day.date === today)
  const overdueDay = days.find((day) => day.status === 'OVERDUE')
  const futureDay = days.find((day) => day.date && day.date > today && !isCompleted(day))
  selectedDayKey.value = dayKey(todayDay || overdueDay || futureDay || nextDay.value || days[0])
}

function toggleFullSchedule() {
  showFullSchedule.value = !showFullSchedule.value
}

function countCurrentWeekCompleted() {
  return currentWeekDays.value.filter((day) => isCompleted(day)).length
}

function isCompleted(day: ScheduleDay) {
  return ['COMPLETED', 'COMPLETED_EARLY', 'COMPLETED_LATE'].includes(day.status)
}

function isActionable(day: ScheduleDay) {
  return ['START', 'START_EARLY', 'MAKE_UP'].includes(day.actionType || '')
}

function canSkipDay(day: ScheduleDay) {
  return Boolean(day.canSkip || ['START', 'START_EARLY', 'MAKE_UP'].includes(day.actionType || ''))
}

function scheduleStatusText(day: ScheduleDay) {
  const labels: Record<string, string> = {
    PENDING: isToday(day.date) ? '今日待训练' : '待训练',
    TODAY_PENDING: '今日待训练',
    UPCOMING: '计划训练',
    OVERDUE: '待补练',
    SKIPPED: '已跳过',
    COMPLETED: '已完成',
    COMPLETED_EARLY: '提前完成',
    COMPLETED_LATE: '补练完成',
    NOT_APPLICABLE: '未纳入'
  }
  return labels[day.status] || '计划训练'
}

function summaryStatusText(status?: string) {
  const labels: Record<string, string> = {
    SCHEDULED: '待生效',
    ACTIVE: '进行中',
    FINISHING: '待收尾',
    COMPLETED: '已完成',
    STOPPED: '已停用',
    REPLACED: '已替换'
  }
  return status ? labels[status] || '进行中' : '进行中'
}

function dateMain(value?: string) {
  if (!value) return '--'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '--'
  return String(date.getDate()).padStart(2, '0')
}

function dateWeekday(value?: string) {
  if (!value) return '待排期'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '待排期'
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
}

function dateLabel(value?: string) {
  if (!value) return '待排期'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${dateWeekday(value)}`
}

function selectedMeta(day: ScheduleDay) {
  const parts = [dateLabel(day.date), scheduleStatusText(day)]
  if (day.itemCount) parts.push(`${day.itemCount} 个动作`)
  else if (day.templateName) parts.push(day.templateName)
  return parts.join(' · ')
}

function isToday(value?: string) {
  return Boolean(value && value === toDateString(new Date()))
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shouldStartDirectly(day: ScheduleDay) {
  return isActionable(day)
}

async function openDay(day: ScheduleDay | null) {
  if (!day) {
    uni.switchTab({ url: routes.planIndex })
    return
  }
  if (day.completedTrainingId) {
    uni.navigateTo({ url: `${routes.historyDetail}?id=${day.completedTrainingId}` })
    return
  }
  if (shouldStartDirectly(day)) {
    await startScheduleDay(day)
    return
  }
  if (day.source === 'RECOMMENDED_EXECUTION') {
    uni.navigateTo({ url: `${routes.planExecutionDay}?dayId=${day.id}` })
    return
  }
  if (day.templateId) {
    uni.navigateTo({ url: `${routes.templateDetail}?id=${day.templateId}` })
  }
}

function openSelectedDay() {
  void openDay(selectedDay.value)
}

async function previewSelectedDay() {
  if (!selectedDay.value) return
  await openActionPreview(selectedDay.value)
}

async function openActionPreview(day: ScheduleDay) {
  previewDay.value = day
  previewVisible.value = true
  previewItems.value = []
  previewLoading.value = true
  try {
    if (day.source === 'RECOMMENDED_EXECUTION') {
      const executionDay = execution.value?.days.find((item) => item.id === day.id)
      previewItems.value = (executionDay?.items || day.executionItems || []).map((item) =>
        toPreviewItem(item)
      )
      return
    }
    if (day.templateId) {
      const detail = await templateStore.getDetail(day.templateId)
      previewItems.value = detail.items.map((item, index) => toTemplatePreviewItem(item, index))
    }
  } catch (err) {
    previewItems.value = []
    uni.showToast({ title: '动作加载失败', icon: 'none' })
    console.error('[plan] action preview failed', err)
  } finally {
    previewLoading.value = false
  }
}

function closeActionPreview() {
  previewVisible.value = false
  previewDay.value = null
  previewItems.value = []
}

async function startPreviewDay() {
  const day = previewDay.value
  if (!day || !shouldStartDirectly(day)) return
  closeActionPreview()
  await startScheduleDay(day)
}

async function skipSelectedDay() {
  const day = selectedDay.value
  if (!day || !canSkipDay(day)) return
  const confirmed = await confirmModal(
    '跳过本次安排',
    '本次安排不会计入完成进度，也不会再进入待补练推荐。'
  )
  if (!confirmed) return
  try {
    await skipActiveTrainingPlanDay(day.id)
    uni.showToast({ title: '已跳过本次安排', icon: 'none' })
    selectedDayKey.value = ''
    await loadSchedule()
  } catch (err) {
    uni.showToast({ title: '跳过失败，请稍后重试', icon: 'none' })
    console.error('[plan] skip schedule day failed', err)
  }
}

function confirmModal(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText: '确认跳过',
      cancelText: '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
}

function toPreviewItem(item: ActiveExecutionItemResponse): PreviewItem {
  return {
    id: `execution-${item.id}`,
    exerciseName: item.exerciseName,
    primaryMuscle: item.primaryMuscle,
    equipment: item.equipment,
    recordType: item.recordType,
    targetSets: item.targetSets,
    targetWeightKg: item.targetWeightKg,
    targetReps: item.targetReps,
    targetDurationSeconds: item.targetDurationSeconds,
    replacementReason: item.replacementReason
  }
}

function toTemplatePreviewItem(
  item: TemplateDetailResponse['items'][number],
  index: number
): PreviewItem {
  return {
    id: `template-${item.exerciseId}-${index}`,
    exerciseName: item.exerciseName,
    equipment: item.equipment,
    recordType: item.recordType,
    targetSets: item.targetSets,
    targetWeightKg: item.targetWeightKg,
    targetReps: item.targetReps,
    targetDurationSeconds: item.targetDurationSeconds
  }
}

function previewTarget(item: PreviewItem) {
  const sets = item.targetSets || 1
  if (item.recordType === 'DURATION' || item.targetDurationSeconds) {
    return item.targetDurationSeconds
      ? `${sets} 组 · ${item.targetDurationSeconds} 秒`
      : `${sets} 组`
  }
  if (item.targetWeightKg != null && item.targetReps) {
    return `${sets} 组 · ${item.targetWeightKg}kg × ${item.targetReps} 次`
  }
  if (item.targetReps) return `${sets} 组 · ${item.targetReps} 次`
  return `${sets} 组`
}

async function startScheduleDay(day: ScheduleDay) {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout(day.title)
  if (!canStart) return

  if (day.source === 'RECOMMENDED_EXECUTION') {
    const currentExecution = execution.value
    const executionDay = currentExecution?.days.find((item) => item.id === day.id)
    if (!currentExecution || !executionDay?.items.length) {
      uni.navigateTo({ url: `${routes.planExecutionDay}?dayId=${day.id}` })
      return
    }
    workoutStore.queueStartWorkout(null, {
      executionId: currentExecution.executionId,
      executionDayId: executionDay.id,
      executionDayTitle: executionDay.title,
      executionItems: executionDay.items
    })
    uni.navigateTo({ url: routes.workoutActive })
    return
  }

  if (!day.templateId) return
  templateStore.markUsed(day.templateId)
  workoutStore.queueStartWorkout(day.templateId, {
    planId: summary.value?.planId || activePlan.value?.id || null,
    planDayId: day.planDayId || day.id
  })
  uni.navigateTo({ url: routes.workoutActive })
}

async function prepareNewWorkout(nextTitle?: string) {
  workoutStore.refreshDraftState()
  if (!workoutStore.hasRecoverableWorkout) return true

  const action = await draftPromptStore.open(
    nextTitle ? { title: nextTitle, subtitle: '计划训练日 · 删除当前草稿后直接开始' } : undefined
  )
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
    return false
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
    return true
  }
  return false
}

function goPlans() {
  uni.switchTab({ url: routes.planIndex })
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: routes.planIndex })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell active-plan secondary-page safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="当前安排" show-back @back="goBack" />

      <view v-if="loading" class="active-plan__loading">正在整理训练安排...</view>
      <template v-else-if="!missing">
        <view class="active-plan__hero">
          <view class="active-plan__hero-top">
            <view>
              <view class="active-plan__eyebrow">当前计划</view>
              <view class="active-plan__title">{{ planName }}</view>
            </view>
            <view class="active-plan__status">{{ statusText }}</view>
          </view>
          <view class="active-plan__progress-row">
            <view>
              <view class="active-plan__progress-title">第 {{ currentWeek }} 周</view>
              <view class="active-plan__progress-copy">
                已完成 {{ completedThisWeek }}/{{ scheduledThisWeek }} · 剩余
                {{ remainingThisWeek }} 次
              </view>
            </view>
            <view class="active-plan__progress-percent">{{ progressPercent }}%</view>
          </view>
          <view class="active-plan__track">
            <view class="active-plan__track-fill" :style="{ width: `${progressPercent}%` }" />
          </view>
        </view>

        <view class="active-plan__dates">
          <scroll-view scroll-x class="active-plan__date-scroll" :show-scrollbar="false">
            <view class="active-plan__date-list">
              <view
                v-for="day in focusedDays"
                :key="`${day.source}-${day.id}`"
                class="active-plan__date btn-press"
                :class="{
                  'active-plan__date--today': isToday(day.date),
                  'active-plan__date--done': isCompleted(day),
                  'active-plan__date--selected': selectedDay && dayKey(day) === dayKey(selectedDay),
                  'active-plan__date--next':
                    nextDay?.id === day.id && nextDay?.source === day.source
                }"
                @tap="selectDay(day)"
              >
                <view class="active-plan__date-week">
                  {{ day.date ? `周${dateWeekday(day.date)}` : '待排期' }}
                </view>
                <view class="active-plan__date-num">{{ dateMain(day.date) }}</view>
                <view class="active-plan__date-dot" />
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="active-plan__next-card">
          <view class="active-plan__next-main">
            <view class="active-plan__eyebrow">{{ selectedCardLabel }}</view>
            <view class="active-plan__next-title">
              {{ selectedDay?.title || '暂无待训练安排' }}
            </view>
            <view class="active-plan__next-sub">
              {{ selectedDay ? selectedMeta(selectedDay) : '可以去计划页选择或调整训练计划' }}
            </view>
          </view>
          <view class="active-plan__next-footer">
            <view
              v-if="selectedCanSkip"
              class="active-plan__next-skip btn-press"
              @tap.stop="skipSelectedDay"
            >
              跳过本次
            </view>
            <view class="active-plan__next-actions">
              <view
                class="active-plan__next-action active-plan__next-action--ghost btn-press"
                @tap.stop="previewSelectedDay"
              >
                查看动作
              </view>
              <view
                v-if="
                  selectedCanStart ||
                  selectedDay?.completedTrainingId ||
                  (selectedDay && isCompleted(selectedDay))
                "
                class="active-plan__next-action btn-press"
                @tap.stop="openSelectedDay"
              >
                {{ selectedActionText }}
              </view>
            </view>
          </view>
        </view>

        <view class="active-plan__section-head">
          <view>
            <view class="active-plan__section-title">完整周期</view>
            <view class="active-plan__section-sub">
              {{ heroSubtitle }} · 共 {{ scheduleDays.length }} 个训练日
            </view>
          </view>
          <view class="active-plan__section-action btn-press" @tap="toggleFullSchedule">
            {{ showFullSchedule ? '收起' : '查看' }}
          </view>
        </view>

        <template v-if="showFullSchedule">
          <view v-for="week in groupedWeeks" :key="week.weekIndex" class="active-plan__week">
            <view class="active-plan__week-title">第 {{ week.weekIndex }} 周</view>
            <view
              v-for="day in week.days"
              :key="`${day.source}-${day.id}`"
              class="active-plan__day btn-press"
              :class="{
                'active-plan__day--selected': selectedDay && dayKey(day) === dayKey(selectedDay)
              }"
              @tap="selectDay(day)"
            >
              <view class="active-plan__day-date">
                <view>{{ dateMain(day.date) }}</view>
                <text>{{ day.date ? `周${dateWeekday(day.date)}` : '待排期' }}</text>
              </view>
              <view class="active-plan__day-body">
                <view class="active-plan__day-title">{{ day.title }}</view>
                <view class="active-plan__day-sub">
                  {{ dateLabel(day.date) }}
                  <text v-if="day.itemCount"> · {{ day.itemCount }} 个动作</text>
                  <text v-else-if="day.templateName"> · {{ day.templateName }}</text>
                </view>
              </view>
              <view
                class="active-plan__day-status"
                :class="{
                  'active-plan__day-status--done': isCompleted(day),
                  'active-plan__day-status--action': isActionable(day)
                }"
              >
                {{ scheduleStatusText(day) }}
              </view>
            </view>
          </view>
        </template>
      </template>

      <template v-else>
        <EmptyState
          icon="+"
          title="还没有启用计划"
          description="请返回计划页，从推荐计划或我的计划中启用一套安排。"
        />
        <view class="active-plan__empty-action btn-press" @tap="goPlans">返回计划页</view>
      </template>
    </view>
  </scroll-view>
  <view v-if="previewVisible" class="active-plan__sheet-mask" @tap="closeActionPreview">
    <view class="active-plan__sheet" @tap.stop>
      <view class="active-plan__sheet-handle" />
      <view class="active-plan__sheet-head">
        <view>
          <view class="active-plan__sheet-title">{{ previewDay?.title || '训练动作' }}</view>
          <view class="active-plan__sheet-sub">
            {{ previewDay ? selectedMeta(previewDay) : '查看训练日动作安排' }}
          </view>
        </view>
        <view class="active-plan__sheet-close btn-press" @tap="closeActionPreview">×</view>
      </view>
      <view v-if="previewLoading" class="active-plan__sheet-state">正在加载动作...</view>
      <view v-else-if="!previewItems.length" class="active-plan__sheet-state"> 暂无动作数据 </view>
      <scroll-view v-else scroll-y class="active-plan__sheet-list">
        <view v-for="item in previewItems" :key="item.id" class="active-plan__sheet-item">
          <view>
            <view class="active-plan__sheet-name">{{ item.exerciseName }}</view>
            <view class="active-plan__sheet-meta">
              {{ item.primaryMuscle || item.equipment || '目标动作' }}
              <text v-if="item.primaryMuscle && item.equipment"> · {{ item.equipment }}</text>
            </view>
          </view>
          <view class="active-plan__sheet-target">{{ previewTarget(item) }}</view>
          <view v-if="item.replacementReason" class="active-plan__sheet-reason">
            {{ item.replacementReason }}
          </view>
        </view>
      </scroll-view>
      <view
        v-if="previewDay && shouldStartDirectly(previewDay)"
        class="active-plan__sheet-submit btn-press"
        @tap="startPreviewDay"
      >
        {{ selectedActionText }}
      </view>
    </view>
  </view>
  <WorkoutDraftPrompt />
</template>

<style lang="scss" scoped>
.active-plan {
  &__loading {
    padding-top: 120rpx;
    color: var(--app-text-muted);
    text-align: center;
    font-size: 24rpx;
  }

  &__hero,
  &__next-card,
  &__day {
    border: 1rpx solid var(--app-border);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 10rpx 28rpx rgba(31, 49, 72, 0.06);
  }

  &__hero {
    padding: 28rpx;
    border-radius: 34rpx;
  }

  &__hero-top,
  &__progress-row,
  &__day {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__eyebrow,
  &__progress-copy,
  &__next-sub,
  &__section-sub,
  &__day-sub {
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 38rpx;
    font-weight: 950;
    line-height: 1.18;
  }

  &__status,
  &__next-action,
  &__day-status {
    flex-shrink: 0;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__status {
    padding: 10rpx 18rpx;
  }

  &__progress-row {
    margin-top: 26rpx;
  }

  &__progress-title {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__progress-percent {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 950;
  }

  &__track {
    height: 10rpx;
    margin-top: 18rpx;
    overflow: hidden;
    border-radius: 999rpx;
    background: #edf1f5;
  }

  &__track-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff6418, #ffb13b);
    transition: width 220ms ease;
  }

  &__dates {
    margin-top: 24rpx;
  }

  &__date-scroll {
    white-space: nowrap;
  }

  &__date-list {
    display: inline-flex;
    gap: 14rpx;
    padding-bottom: 2rpx;
  }

  &__date {
    width: 92rpx;
    min-height: 128rpx;
    border: 1rpx solid transparent;
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.78);
    color: var(--app-text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
  }

  &__date--selected,
  &__date--today,
  &__date--next {
    border-color: rgba(255, 100, 24, 0.2);
    background: #ffffff;
    color: var(--app-accent);
    box-shadow: 0 10rpx 24rpx rgba(31, 49, 72, 0.08);
  }

  &__date--done {
    color: #3fc18e;
  }

  &__date-week {
    font-size: 20rpx;
    font-weight: 800;
  }

  &__date-num {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 950;
  }

  &__date-dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background: currentColor;
  }

  &__next-card {
    margin-top: 24rpx;
    padding: 24rpx;
    border-radius: 30rpx;
  }

  &__next-title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 950;
  }

  &__next-main {
    min-width: 0;
    flex: 1;
  }

  &__next-footer {
    margin-top: 20rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__next-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10rpx;
  }

  &__next-skip {
    min-height: 60rpx;
    display: flex;
    align-items: center;
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 800;
    flex-shrink: 0;
  }

  &__next-action {
    min-width: 96rpx;
    min-height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16rpx;
  }

  &__next-action--ghost {
    border: 1rpx solid rgba(255, 100, 24, 0.18);
    background: #fff;
  }

  &__section-head {
    margin-top: 34rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__section-title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 950;
  }

  &__section-sub {
    margin-top: 8rpx;
  }

  &__section-action {
    min-width: 92rpx;
    min-height: 56rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__week {
    margin-top: 22rpx;
  }

  &__week-title {
    margin-bottom: 12rpx;
    color: var(--app-text-secondary);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__day {
    min-height: 112rpx;
    padding: 20rpx;
    border-radius: 26rpx;
    margin-top: 12rpx;
  }

  &__day--selected {
    border-color: rgba(255, 100, 24, 0.22);
    box-shadow: 0 12rpx 30rpx rgba(255, 100, 24, 0.08);

    .active-plan__day-date {
      background: var(--app-accent-soft);
      color: var(--app-accent);
    }
  }

  &__day-date {
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
    color: var(--app-text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 950;
    flex-shrink: 0;

    text {
      margin-top: 2rpx;
      color: var(--app-text-muted);
      font-size: 17rpx;
      font-weight: 800;
    }
  }

  &__day-body {
    min-width: 0;
    flex: 1;
  }

  &__day-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 950;
    line-height: 1.3;
  }

  &__day-status {
    padding: 10rpx 14rpx;
    font-size: 20rpx;
  }

  &__day-status--done {
    background: rgba(63, 193, 142, 0.14);
    color: #3fc18e;
  }

  &__day-status--action {
    background: var(--app-accent);
    color: #fff;
  }

  &__empty-action {
    width: 220rpx;
    min-height: 64rpx;
    margin: 28rpx auto 0;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: var(--app-accent);
    font-size: 23rpx;
    font-weight: 900;
  }

  &__sheet-mask {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(15, 23, 42, 0.52);
  }

  &__sheet {
    width: 100%;
    max-height: 78vh;
    padding: 16rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
    border-radius: 34rpx 34rpx 0 0;
    background: var(--app-surface);
    box-shadow: 0 -20rpx 60rpx rgba(15, 23, 42, 0.18);
  }

  &__sheet-handle {
    width: 64rpx;
    height: 8rpx;
    margin: 0 auto 24rpx;
    border-radius: 999rpx;
    background: #dbe2ea;
  }

  &__sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__sheet-title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 950;
  }

  &__sheet-sub,
  &__sheet-meta,
  &__sheet-state,
  &__sheet-reason {
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__sheet-sub {
    margin-top: 6rpx;
  }

  &__sheet-close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    color: var(--app-text-muted);
    font-size: 34rpx;
    font-weight: 800;
    flex-shrink: 0;
  }

  &__sheet-state {
    margin-top: 22rpx;
    padding: 30rpx;
    border-radius: 24rpx;
    background: var(--app-bg);
    text-align: center;
  }

  &__sheet-list {
    max-height: 50vh;
    margin-top: 22rpx;
  }

  &__sheet-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
    min-height: 90rpx;
    padding: 18rpx 0;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  }

  &__sheet-name {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__sheet-target {
    color: var(--app-text);
    font-size: 23rpx;
    font-weight: 800;
    flex-shrink: 0;
  }

  &__sheet-reason {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -4rpx;
  }

  &__sheet-submit {
    min-height: 76rpx;
    margin-top: 22rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-accent);
    color: #fff;
    font-size: 26rpx;
    font-weight: 950;
    box-shadow: var(--app-shadow-cta);
  }
}
</style>
