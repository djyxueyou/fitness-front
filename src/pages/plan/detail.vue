<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import ShareCardSheet from '@/components/share-card-sheet/index.vue'
import TemplateCover from '@/components/template-cover/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { showPlanWriteError } from '@/utils/plan-write-feedback'
import { isStalePlanDetailError, usePlanStore } from '@/stores/plan'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import { fetchPlanDaySharePreview, type SharePreviewResponse } from '@/api/share'
import type {
  SystemPlanDetailResponse,
  TrainingPlanDayResponse,
  TrainingPlanDetailResponse
} from '@/api/plan'
import {
  fetchPlanActivationOptions,
  finishActiveTrainingPlan,
  skipActiveTrainingPlanDay,
  unskipActiveTrainingPlanDay
} from '@/api/plan'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const planStore = usePlanStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const detail = ref<TrainingPlanDetailResponse | null>(null)
const systemPlanDetail = ref<SystemPlanDetailResponse | null>(null)
const isSystemPlan = ref(false)
const loading = ref(false)
const busy = ref(false)
const sheetVisible = ref(false)
const sheetTitle = ref('')
const sheetSubtitle = ref('')
const sheetItems = ref<ActionSheetItem[]>([])
const sheetTargetDay = ref<TrainingPlanDayResponse | null>(null)
const copiedPlanId = ref<number | null>(null)
const shareVisible = ref(false)
const shareLoading = ref(false)
const sharePreview = ref<SharePreviewResponse | null>(null)

const weeks = computed(() => {
  const grouped = new Map<number, TrainingPlanDayResponse[]>()
  ;(detail.value?.days || []).forEach((day) => {
    const week = day.weekIndex || 1
    grouped.set(week, [...(grouped.get(week) || []), day])
  })
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekIndex, days]) => ({
      weekIndex,
      days: days.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.sortOrder - b.sortOrder)
    }))
})
const heroMeta = computed(() => {
  if (systemPlanDetail.value) {
    return `${systemPlanDetail.value.cycleWeeks} 周 · ${systemPlanDetail.value.minWeeklyFrequency}-${systemPlanDetail.value.maxWeeklyFrequency} 练 · ${difficultyText(
      systemPlanDetail.value.difficultyLevel
    )} · ${goalText(systemPlanDetail.value.goal)}`
  }
  if (!detail.value) return ''
  return `${detail.value.cycleWeeks} 周 · ${detail.value.days.length} 个训练日 · ${difficultyText(
    detail.value.difficultyLevel
  )} · ${goalText(detail.value.goal)}`
})
const sortedDays = computed(() =>
  [...(detail.value?.days || [])].sort(
    (a, b) => a.weekIndex - b.weekIndex || a.dayOfWeek - b.dayOfWeek || a.sortOrder - b.sortOrder
  )
)
const nextPlanDay = computed(() => sortedDays.value.find((day) => canStartDay(day)) || null)
const canEditPlan = computed(() => detail.value?.planType !== 'SYSTEM')
const canEditSchedule = computed(() => canEditPlan.value && !detail.value?.active)
const hasPlanDays = computed(() => Boolean(detail.value?.days.length))
const completedCount = computed(() => sortedDays.value.filter((day) => day.completed).length)
const progressPercent = computed(() =>
  sortedDays.value.length ? Math.round((completedCount.value / sortedDays.value.length) * 100) : 0
)
const executionStatusText = computed(() => {
  const labels: Record<string, string> = {
    SCHEDULED: '待生效',
    ACTIVE: '进行中',
    FINISHING: '待收尾'
  }
  return detail.value?.executionStatus ? labels[detail.value.executionStatus] || '' : ''
})
const footerText = computed(() => {
  if (isSystemPlan.value) return busy.value ? '处理中...' : '设置训练安排'
  if (!detail.value) return '启用此计划'
  if (!detail.value.active) {
    if (!hasPlanDays.value) return '请先新增训练日'
    return busy.value ? '处理中...' : '启用此计划'
  }
  if (detail.value.executionStatus === 'SCHEDULED') {
    return detail.value.scheduleStartDate
      ? `计划将于 ${formatPlanDate(detail.value.scheduleStartDate)} 生效`
      : '计划待生效'
  }
  if (nextPlanDay.value) return '开始下一个训练日'
  if (detail.value.executionStatus === 'FINISHING') return '还有待处理的训练安排'
  if (sortedDays.value.length > 0 && completedCount.value === sortedDays.value.length) {
    return '已完成全部训练日'
  }
  return '暂无可开始的训练日'
})

onLoad((options) => {
  const id = Number(options?.id)
  planId.value = Number.isFinite(id) && id > 0 ? id : null
  isSystemPlan.value = options?.source === 'system'
})

onShow(async () => {
  if (isSystemPlan.value) {
    await loadDetail(true)
    return
  }
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await Promise.all([loadDetail(true), templateStore.fetchTemplates({ includeDetails: false })])
})

function goBack() {
  uni.navigateBack()
}

async function editPlan() {
  if (!detail.value || !canEditSchedule.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  uni.navigateTo({ url: `${routes.planEdit}?id=${detail.value.id}` })
}

async function addPlanDay() {
  if (!detail.value || !canEditSchedule.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  uni.navigateTo({ url: `${routes.planDayEdit}?id=${detail.value.id}` })
}

async function editPlanDay(day: TrainingPlanDayResponse) {
  if (!detail.value || !canEditSchedule.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  uni.navigateTo({ url: `${routes.planDayEdit}?id=${detail.value.id}&dayId=${day.id}` })
}

async function loadDetail(force = false) {
  if (!planId.value || loading.value) return
  loading.value = true
  try {
    if (isSystemPlan.value) {
      systemPlanDetail.value = await planStore.getSystemPlanDetail(planId.value, force)
      return
    }
    detail.value = await planStore.getDetail(planId.value, force)
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({ title: '计划加载失败', icon: 'none' })
    console.error('[plan] detail fetch failed', err)
  } finally {
    loading.value = false
  }
}

async function activatePlan() {
  if (!detail.value || detail.value.active || busy.value) return
  if (!hasPlanDays.value) {
    uni.showToast({ title: '请先新增训练日后再启用', icon: 'none' })
    return
  }
  if (planStore.activePlan && planStore.activePlan.id !== detail.value.id) {
    openSwitchPlanSheet()
    return
  }
  await openActivationSheet()
}

async function performActivatePlan(mode: 'THIS_WEEK' | 'NEXT_WEEK') {
  if (!detail.value || busy.value) return
  busy.value = true
  try {
    await planStore.activate(detail.value.id, mode)
    await loadDetail(true)
    uni.showToast({ title: '已启用训练计划', icon: 'none' })
    setTimeout(() => uni.redirectTo({ url: routes.planActive }), 300)
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({
      title: activationErrorTitle(err),
      icon: 'none'
    })
    console.error('[plan] activate failed', err)
  } finally {
    busy.value = false
  }
}

async function openActivationSheet() {
  if (!detail.value || busy.value) return
  if (!hasPlanDays.value) {
    uni.showToast({ title: '请先新增训练日后再启用', icon: 'none' })
    return
  }
  busy.value = true
  try {
    const options = await fetchPlanActivationOptions(detail.value.id)
    sheetTargetDay.value = null
    sheetTitle.value = '选择计划生效周期'
    sheetSubtitle.value = '训练日日期和状态由服务端统一计算。'
    sheetItems.value = options.map((option) => ({
      key: `activate-${option.mode}`,
      label: option.mode === 'THIS_WEEK' ? '本周生效' : '下周生效',
      description: option.firstTrainingDate
        ? `首个训练日：${formatPlanDate(option.firstTrainingDate)}${option.notApplicableDays ? ' · 已错过训练日不计逾期' : ''}`
        : '当前计划暂未安排训练日',
      primary: option.recommended
    }))
    sheetVisible.value = true
  } catch (err) {
    uni.showToast({
      title:
        err instanceof Error && err.message.includes('at least one training day')
          ? '请先新增训练日后再启用'
          : '加载生效周期失败',
      icon: 'none'
    })
    console.error('[plan] activation options failed', err)
  } finally {
    busy.value = false
  }
}

function openSwitchPlanSheet() {
  if (!detail.value) return
  sheetTargetDay.value = null
  sheetTitle.value = '切换当前计划？'
  sheetSubtitle.value = `启用「${detail.value.name}」后，当前计划会被替换。已完成的训练记录会保留。`
  sheetItems.value = [
    {
      key: 'confirm-switch-plan',
      label: '确认切换',
      description: '替换当前启用计划，训练记录不会被删除。',
      primary: true
    }
  ]
  sheetVisible.value = true
}

async function copyPlan() {
  if (!detail.value || busy.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  busy.value = true
  try {
    const copied = await planStore.duplicate(detail.value.id)
    uni.showToast({ title: '已复制到我的计划', icon: 'none' })
    openCopiedPlanSheet(copied.id, copied.name)
  } catch (err) {
    showPlanWriteError(err, '计划复制失败，请重试')
    console.error('[plan] copy failed', err)
  } finally {
    busy.value = false
  }
}

async function openPlanDayShareCard(day: TrainingPlanDayResponse) {
  if (!detail.value) return
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchPlanDaySharePreview(detail.value.id, day.id)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] plan day preview failed', err)
  } finally {
    shareLoading.value = false
  }
}

function closeShareCard() {
  shareVisible.value = false
}

function copyShareText() {
  const text = sharePreview.value?.copyText
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制分享文案', icon: 'none' })
  })
}

function openCopiedPlanSheet(id: number, name: string) {
  copiedPlanId.value = id
  sheetTargetDay.value = null
  sheetTitle.value = '已复制到我的计划'
  sheetSubtitle.value = `${name} 可编辑，不会影响原计划。`
  sheetItems.value = [
    {
      key: 'view-copied-plan',
      label: '查看副本',
      description: '进入新计划详情，继续编辑训练日安排。',
      primary: true
    },
    {
      key: 'keep-browsing',
      label: '继续浏览',
      description: '留在当前计划详情。'
    }
  ]
  sheetVisible.value = true
}

function openPlanDeleteSheet() {
  if (!detail.value || !canEditSchedule.value || busy.value) return
  sheetTargetDay.value = null
  sheetTitle.value = '删除训练计划'
  sheetSubtitle.value = detail.value.active
    ? '删除后当前计划会停止启用，历史训练记录会保留。'
    : '删除后不可恢复，历史训练记录会保留。'
  sheetItems.value = [
    {
      key: 'delete-plan',
      label: '删除计划',
      description: '仅删除计划编排，不删除已完成的训练记录。',
      danger: true
    }
  ]
  sheetVisible.value = true
}

function openPlanDeactivateSheet() {
  if (!detail.value?.active || busy.value) return
  sheetTargetDay.value = null
  sheetTitle.value = '停用当前计划'
  sheetSubtitle.value = '停用后首页不再按此计划推荐训练，历史训练记录会保留。'
  sheetItems.value = [
    {
      key: 'deactivate-plan',
      label: '停用计划',
      description: '只关闭当前计划安排，不删除计划和历史训练记录。',
      danger: true
    }
  ]
  sheetVisible.value = true
}

function openPlanMoreSheet() {
  if (!detail.value || busy.value) return
  sheetTargetDay.value = null
  sheetTitle.value = '更多计划操作'
  sheetSubtitle.value = detail.value.name
  sheetItems.value = [
    {
      key: 'copy-plan',
      label: detail.value.planType === 'SYSTEM' ? '复制到我的计划' : '复制计划',
      description: '复制后可以编辑训练日和计划名称。',
      primary: detail.value.planType === 'SYSTEM'
    },
    ...(canEditSchedule.value
      ? [
          {
            key: 'edit-plan',
            label: '编辑计划',
            description: '修改计划名称、目标和难度。'
          },
          {
            key: 'add-plan-day',
            label: '新增训练日',
            description: '为计划增加新的周训练安排。'
          }
        ]
      : []),
    ...(detail.value.active
      ? [
          ...(detail.value.executionStatus === 'FINISHING'
            ? [
                {
                  key: 'finish-plan',
                  label: '结束并归档计划',
                  description: '剩余未完成训练日会标记为已跳过，之后可以再次启用。',
                  primary: true
                }
              ]
            : []),
          {
            key: 'deactivate-plan',
            label: '停用当前计划',
            description: '首页不再按此计划推荐训练，历史训练记录会保留。',
            danger: true
          }
        ]
      : []),
    ...(canEditSchedule.value
      ? [
          {
            key: 'delete-plan',
            label: '删除计划',
            description: '仅删除计划编排，不删除已完成训练记录。',
            danger: true
          }
        ]
      : [])
  ]
  if (!sheetItems.value.length) {
    sheetItems.value = [
      {
        key: 'keep-browsing',
        label: '暂无更多操作',
        description: '系统计划可以复制到我的计划后再编辑。'
      }
    ]
  }
  sheetVisible.value = true
}

function openDayActions(day: TrainingPlanDayResponse) {
  sheetTargetDay.value = day
  sheetTitle.value = day.title || '训练日'
  sheetSubtitle.value = `${weekdayText(day.dayOfWeek)} · ${day.templateName || '训练模板'}`
  if (day.completed) {
    sheetItems.value = [
      {
        key: 'open-record',
        label: '查看训练记录',
        description: '查看这个训练日已完成的训练详情。',
        primary: true
      },
      {
        key: 'share-day',
        label: '分享训练日',
        description: '生成这个训练日的动作安排分享图。'
      }
    ]
  } else if (detail.value?.active && canStartDay(day)) {
    sheetItems.value = [
      {
        key: 'start-day',
        label: actionText(day),
        description: '完成后会记录到当前计划执行进度。',
        primary: true
      },
      {
        key: 'share-day',
        label: '分享训练日',
        description: '生成这个训练日的动作安排分享图。'
      },
      {
        key: 'skip-day',
        label: '跳过本次安排',
        description: '本次安排不计入完成进度，也不再进入待补练推荐。',
        danger: true
      }
    ]
  } else if (detail.value?.active && day.actionType === 'RESTORE') {
    sheetItems.value = [
      {
        key: 'unskip-day',
        label: '恢复为待训练',
        description: '恢复后将重新按日期判断待训练或待补练状态。',
        primary: true
      },
      {
        key: 'share-day',
        label: '分享训练日',
        description: '生成这个训练日的动作安排分享图。'
      }
    ]
  } else if (canEditSchedule.value) {
    sheetItems.value = [
      {
        key: 'edit-day',
        label: '编辑训练日',
        description: '调整周次、周几或替换使用的模板。',
        primary: true
      },
      {
        key: 'share-day',
        label: '分享训练日',
        description: '生成这个训练日的动作安排分享图。'
      },
      {
        key: 'delete-day',
        label: '删除训练日',
        description: '只从计划中移除，不影响历史训练记录。',
        danger: true
      }
    ]
  } else {
    return
  }
  sheetVisible.value = true
}

async function handleSheetSelect(item: ActionSheetItem) {
  sheetVisible.value = false
  if (item.key === 'view-copied-plan') {
    if (copiedPlanId.value) {
      uni.navigateTo({ url: `${routes.planDetail}?id=${copiedPlanId.value}` })
    }
    return
  }
  if (item.key === 'keep-browsing') {
    return
  }
  const day = sheetTargetDay.value
  if (item.key === 'copy-plan') {
    await copyPlan()
    return
  }
  if (item.key === 'edit-plan') {
    await editPlan()
    return
  }
  if (item.key === 'add-plan-day') {
    await addPlanDay()
    return
  }
  if (item.key === 'delete-plan') {
    await removePlan()
    return
  }
  if (item.key === 'deactivate-plan') {
    await deactivatePlan()
    return
  }
  if (item.key === 'finish-plan') {
    await finishPlan()
    return
  }
  if (item.key === 'confirm-switch-plan') {
    await openActivationSheet()
    return
  }
  if (item.key === 'activate-THIS_WEEK' || item.key === 'activate-NEXT_WEEK') {
    await performActivatePlan(item.key === 'activate-NEXT_WEEK' ? 'NEXT_WEEK' : 'THIS_WEEK')
    return
  }
  if (!day) return
  if (item.key === 'share-day') {
    await openPlanDayShareCard(day)
    return
  }
  if (item.key === 'start-day') {
    await startPlanDay(day)
    return
  }
  if (item.key === 'edit-day') {
    await editPlanDay(day)
    return
  }
  if (item.key === 'delete-day') {
    await removePlanDay(day)
    return
  }
  if (item.key === 'open-record') {
    await openCompletedTraining(day)
    return
  }
  if (item.key === 'skip-day') {
    await skipPlanDay(day)
    return
  }
  if (item.key === 'unskip-day') {
    await unskipPlanDay(day)
  }
}

function closeSheet() {
  sheetVisible.value = false
}

async function removePlan() {
  if (!detail.value || !canEditSchedule.value || busy.value) return
  if (!(await ensureFeatureAuth('删除训练计划'))) return
  const target = detail.value
  busy.value = true
  try {
    await planStore.removePlan(target.id)
    uni.showToast({ title: '已删除计划', icon: 'none' })
    uni.switchTab({ url: routes.planIndex })
  } catch (err) {
    showPlanWriteError(err, '计划删除失败，请重试')
    console.error('[plan] delete failed', err)
  } finally {
    busy.value = false
  }
}

async function deactivatePlan() {
  if (!detail.value?.active || busy.value) return
  busy.value = true
  try {
    await planStore.deactivateActive()
    await loadDetail(true)
    uni.showToast({ title: '已停用计划', icon: 'none' })
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({ title: '停用失败', icon: 'none' })
    console.error('[plan] deactivate failed', err)
  } finally {
    busy.value = false
  }
}

async function finishPlan() {
  if (!detail.value?.active || busy.value) return
  busy.value = true
  try {
    await finishActiveTrainingPlan()
    await loadDetail(true)
    uni.showToast({ title: '计划已结束，可再次启用', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function removePlanDay(day: TrainingPlanDayResponse) {
  if (!detail.value || !canEditSchedule.value || busy.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  busy.value = true
  try {
    detail.value = await planStore.deleteDay(detail.value.id, day.id)
    uni.showToast({ title: '已删除训练日', icon: 'none' })
  } catch (err) {
    showPlanWriteError(err, '训练日删除失败，请重试')
    console.error('[plan] delete day failed', err)
  } finally {
    busy.value = false
  }
}

async function startPlanDay(day: TrainingPlanDayResponse) {
  if (!detail.value?.active || !canStartDay(day)) return
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  uni.navigateTo({ url: `${routes.planExecutionDay}?dayId=${day.id}` })
}

function planDayMeta(day: TrainingPlanDayResponse) {
  const template = templateStore.getById(day.templateId)
  if (!template) return '查看训练动作'
  return `${template.exercises} 个动作 · 约 ${template.duration} min`
}

function canManagePlanDay(day: TrainingPlanDayResponse) {
  if (day.completed) return true
  if (detail.value?.active) return canStartDay(day) || day.actionType === 'RESTORE'
  return canEditSchedule.value
}

async function skipPlanDay(day: TrainingPlanDayResponse) {
  if (!detail.value?.active || !canStartDay(day) || busy.value) return
  busy.value = true
  try {
    await skipActiveTrainingPlanDay(day.id)
    await loadDetail(true)
    uni.showToast({ title: '已跳过本次安排', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function unskipPlanDay(day: TrainingPlanDayResponse) {
  if (!detail.value?.active || day.actionType !== 'RESTORE' || busy.value) return
  busy.value = true
  try {
    await unskipActiveTrainingPlanDay(day.id)
    await loadDetail(true)
    uni.showToast({ title: '已恢复为待训练', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function planDayStatusText(day: TrainingPlanDayResponse) {
  const labels: Record<string, string> = {
    TODAY_PENDING: '今日待训练',
    OVERDUE: '待补训',
    UPCOMING: '未开始',
    SKIPPED: '已跳过本次安排',
    COMPLETED: '已按计划完成',
    COMPLETED_EARLY: '已提前完成',
    COMPLETED_LATE: '已补练完成',
    NOT_APPLICABLE: '本次未纳入'
  }
  const status = labels[day.status || ''] || '未训练'
  const suffix = day.status === 'SKIPPED' ? ' · 不计入本次进度' : ''
  return day.scheduledDate
    ? `${formatPlanDate(day.scheduledDate)} · ${status}${suffix}`
    : `${status}${suffix}`
}

function actionText(day: TrainingPlanDayResponse) {
  const labels: Record<string, string> = {
    START_EARLY: '提前训练',
    START: '开始训练',
    MAKE_UP: '开始补练'
  }
  return labels[day.actionType || ''] || '开始训练'
}

function canStartDay(day: TrainingPlanDayResponse) {
  return (
    Boolean(detail.value?.active) &&
    ['START_EARLY', 'START', 'MAKE_UP'].includes(day.actionType || '')
  )
}

function formatPlanDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${weekdays[date.getDay()]} · ${date.getMonth() + 1}月${date.getDate()}日`
}

function activationErrorTitle(err: unknown) {
  if (err instanceof Error) {
    if (err.message.includes('at least one training day')) {
      return '请先新增训练日后再启用'
    }
    if (err.message) {
      return err.message
    }
  }
  return '启用失败'
}

async function handleFooterAction() {
  if (isSystemPlan.value && planId.value) {
    if (!(await ensureFeatureAuth('设置训练安排'))) return
    uni.navigateTo({ url: `${routes.planCustomize}?id=${planId.value}` })
    return
  }
  if (!detail.value) return
  if (!detail.value.active) {
    await activatePlan()
    return
  }
  if (nextPlanDay.value) await startPlanDay(nextPlanDay.value)
}

async function openCompletedTraining(day: TrainingPlanDayResponse) {
  if (!day.completedTrainingId) return
  uni.navigateTo({ url: `${routes.historyDetail}?id=${day.completedTrainingId}` })
}

function openPlanDayPreview(day: TrainingPlanDayResponse) {
  if (day.completed) {
    void openCompletedTraining(day)
    return
  }
  if (detail.value?.active) {
    uni.navigateTo({ url: `${routes.planExecutionDay}?dayId=${day.id}` })
    return
  }
  uni.navigateTo({
    url: `${routes.planExecutionDay}?planId=${detail.value?.id}&dayId=${day.id}`
  })
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

async function openDraftFab() {
  workoutStore.refreshDraftState()
  const action = await draftPromptStore.open()
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}

function weekdayText(dayOfWeek: number) {
  return (
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayOfWeek - 1] || `第 ${dayOfWeek} 天`
  )
}

function difficultyText(level?: string) {
  const map: Record<string, string> = {
    BEGINNER: '入门',
    BEGINNER_INTERMEDIATE: '新手到进阶',
    INTERMEDIATE: '进阶',
    ADVANCED: '高阶'
  }
  return level ? map[level] || level : '通用'
}

function goalText(goal?: string) {
  const map: Record<string, string> = {
    STARTER: '入门体验',
    FOUNDATION: '基础力量',
    MUSCLE_GAIN: '增肌分化',
    HOME_FITNESS: '居家训练',
    STRENGTH: '力量提升',
    FAT_LOSS: '减脂塑形',
    GENERAL_FITNESS: '综合训练'
  }
  return goal ? map[goal] || goal : '综合训练'
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell plan-detail secondary-page safe-bottom" :class="themeStore.themeClass">
      <AppHeader
        title="计划详情"
        :subtitle="
          isSystemPlan
            ? '查看系统计划介绍，再生成自己的训练安排'
            : '按周查看训练日，也可以直接开始单日训练'
        "
        show-back
        @back="goBack"
      />

      <view v-if="isSystemPlan && systemPlanDetail" class="plan-detail__content">
        <view class="glass-card plan-detail__hero">
          <view class="plan-detail__tag-row">
            <view class="plan-detail__tag">系统计划</view>
          </view>
          <view class="plan-detail__title">{{ systemPlanDetail.name }}</view>
          <view class="plan-detail__meta">{{ heroMeta }}</view>
          <view v-if="systemPlanDetail.subtitle" class="plan-detail__intro-copy">
            {{ systemPlanDetail.subtitle }}
          </view>
          <view v-if="systemPlanDetail.targetUserText" class="plan-detail__intro-copy">
            {{ systemPlanDetail.targetUserText }}
          </view>
        </view>

        <view class="glass-card plan-detail__intro">
          <view class="plan-detail__section-title">计划说明</view>
          <view class="plan-detail__intro-copy">
            {{
              systemPlanDetail.description ||
              '设置后会按每周训练频率、器械条件和需要避开的部位生成安排。'
            }}
          </view>
        </view>

        <view class="glass-card plan-detail__intro">
          <view class="plan-detail__section-title">包含训练模板</view>
          <view
            v-for="blueprint in systemPlanDetail.blueprints"
            :key="blueprint.blueprintId"
            class="plan-detail__blueprint"
          >
            <view class="plan-detail__blueprint-name">{{ blueprint.name }}</view>
            <view class="plan-detail__intro-copy">
              {{ blueprint.description || '训练日蓝图' }}
              <text v-if="blueprint.estimatedMinutes">
                · 约 {{ blueprint.estimatedMinutes }} min</text
              >
            </view>
          </view>
        </view>

        <view class="glass-card plan-detail__intro">
          <view class="plan-detail__section-title">可设置项</view>
          <view class="plan-detail__intro-copy">
            每周训练次数、需要避开的部位、器械条件、单次训练时长。
          </view>
          <view v-if="systemPlanDetail.safetyNotes" class="plan-detail__intro-copy">
            {{ systemPlanDetail.safetyNotes }}
          </view>
        </view>
      </view>

      <view v-else-if="detail" class="plan-detail__content">
        <view class="glass-card plan-detail__hero">
          <view class="plan-detail__hero-more btn-press" @tap="openPlanMoreSheet">...</view>
          <view class="plan-detail__tag-row">
            <view class="plan-detail__tag">{{
              detail.planType === 'SYSTEM' ? '系统计划' : '我的计划'
            }}</view>
            <view v-if="detail.active" class="plan-detail__tag plan-detail__tag--active">
              {{ executionStatusText || '进行中' }}
            </view>
          </view>
          <view class="plan-detail__title">{{ detail.name }}</view>
          <view class="plan-detail__meta">{{ heroMeta }}</view>
          <view v-if="detail.active" class="plan-detail__progress">
            <view class="plan-detail__progress-head">
              <text>{{ completedCount }}/{{ sortedDays.length }} 已完成</text>
              <text>{{ progressPercent }}%</text>
            </view>
            <view class="plan-detail__progress-track">
              <view class="plan-detail__progress-fill" :style="{ width: `${progressPercent}%` }" />
            </view>
          </view>
        </view>

        <view
          v-if="detail.active && nextPlanDay"
          class="glass-card plan-detail__next btn-press"
          @tap="startPlanDay(nextPlanDay)"
        >
          <view class="plan-detail__next-label">下一次训练</view>
          <view class="plan-detail__next-row">
            <TemplateCover
              :name="nextPlanDay.templateName || nextPlanDay.title"
              :url="templateStore.getById(nextPlanDay.templateId)?.coverUrl"
              :record-type="templateStore.getById(nextPlanDay.templateId)?.coverRecordType"
            />
            <view class="plan-detail__next-body">
              <view class="plan-detail__next-title">
                第 {{ nextPlanDay.weekIndex }} 周 · {{ weekdayText(nextPlanDay.dayOfWeek) }}
              </view>
              <view class="plan-detail__next-sub">
                {{ nextPlanDay.title }} · {{ planDayMeta(nextPlanDay) }}
              </view>
            </view>
            <view class="plan-detail__next-action">开始训练</view>
          </view>
        </view>

        <view v-if="weeks.length" class="plan-detail__weeks">
          <view v-for="week in weeks" :key="week.weekIndex" class="plan-detail__week">
            <view class="plan-detail__week-title">第 {{ week.weekIndex }} 周</view>
            <view class="plan-detail__days">
              <view
                v-for="day in week.days"
                :key="day.id"
                class="glass-card plan-detail__day"
                :class="{ 'plan-detail__day--done': day.completed }"
              >
                <view
                  v-if="canManagePlanDay(day)"
                  class="plan-detail__day-more btn-press"
                  @tap="openDayActions(day)"
                >
                  ...
                </view>
                <view
                  class="plan-detail__day-main"
                  :class="{ 'plan-detail__day-main--managed': canManagePlanDay(day) }"
                  @tap="openPlanDayPreview(day)"
                >
                  <view class="plan-detail__day-index">{{ weekdayText(day.dayOfWeek) }}</view>
                  <TemplateCover
                    :name="day.templateName || day.title"
                    :url="templateStore.getById(day.templateId)?.coverUrl"
                    :record-type="templateStore.getById(day.templateId)?.coverRecordType"
                  />
                  <view class="plan-detail__day-body">
                    <view class="plan-detail__day-title">{{ day.title }}</view>
                    <view class="plan-detail__day-sub">{{ planDayMeta(day) }}</view>
                  </view>
                </view>
                <view class="plan-detail__day-footer">
                  <view
                    v-if="day.completed"
                    class="plan-detail__done btn-press"
                    @tap="openCompletedTraining(day)"
                  >
                    {{ planDayStatusText(day) }} · 查看训练记录
                  </view>
                  <template v-else>
                    <view class="plan-detail__pending">{{ planDayStatusText(day) }}</view>
                    <view
                      v-if="canStartDay(day)"
                      class="plan-detail__start btn-press"
                      @tap="startPlanDay(day)"
                    >
                      {{ actionText(day) }}
                    </view>
                  </template>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="glass-card plan-detail__empty">
          <view>
            {{
              detail.active
                ? '当前计划没有训练日，请先停用计划后补充安排。'
                : '这个计划还没有训练日。新增训练日后，就可以按周安排训练。'
            }}
          </view>
          <view
            v-if="canEditSchedule"
            class="plan-detail__empty-action btn-press"
            @tap="addPlanDay"
          >
            新增训练日
          </view>
        </view>
      </view>

      <view v-else class="glass-card plan-detail__empty">
        {{ loading ? '计划加载中...' : '没有找到训练计划' }}
      </view>

      <view class="plan-detail__footer">
        <PrimaryButton
          :disabled="
            isSystemPlan
              ? !systemPlanDetail || busy
              : detail?.active
                ? !nextPlanDay
                : !detail || !hasPlanDays || busy
          "
          @tap="handleFooterAction"
        >
          {{ footerText }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
  <WorkoutDraftFab :class="themeStore.themeClass" variant="light" @open="openDraftFab" />
  <AppActionSheet
    :class="themeStore.themeClass"
    :visible="sheetVisible"
    :title="sheetTitle"
    :subtitle="sheetSubtitle"
    :items="sheetItems"
    @close="closeSheet"
    @select="handleSheetSelect"
  />
  <ShareCardSheet
    :visible="shareVisible"
    :preview="sharePreview"
    :loading="shareLoading"
    @close="closeShareCard"
    @copy="copyShareText"
  />
  <WorkoutDraftPrompt />
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.plan-detail {
  padding-bottom: 160rpx;

  &__content {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
  }

  &__hero {
    position: relative;
    padding: 32rpx;
  }

  &__hero-more {
    position: absolute;
    top: 24rpx;
    right: 24rpx;
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
  }

  &__tag-row {
    display: flex;
    gap: 10rpx;
    flex-wrap: wrap;
  }

  &__tag {
    display: inline-flex;
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 800;

    &--active {
      background: rgba(80, 220, 180, 0.14);
      color: var(--app-success);
    }
  }

  &__title {
    margin-top: 22rpx;
    padding-right: 76rpx;
    color: var(--app-text);
    font-size: 42rpx;
    font-weight: 900;
  }

  &__meta {
    margin-top: 12rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
  }

  &__intro {
    padding: 28rpx;
  }

  &__section-title {
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 900;
  }

  &__intro-copy {
    margin-top: 14rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    line-height: 1.55;
  }

  &__blueprint {
    padding: 18rpx 0;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  }

  &__blueprint:last-child {
    border-bottom: 0;
  }

  &__blueprint-name {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__progress {
    margin-top: 24rpx;
  }

  &__progress-head {
    display: flex;
    justify-content: space-between;
    color: var(--app-text);
    font-size: 22rpx;
    font-weight: 800;
  }

  &__progress-track {
    height: 10rpx;
    margin-top: 12rpx;
    overflow: hidden;
    border-radius: 999rpx;
    background: var(--app-border);
  }

  &__progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff501e, #ffa03c);
  }

  &__next {
    padding: 24rpx;
    border-color: rgba(255, 80, 30, 0.24);
  }

  &__next-label {
    color: var(--app-accent);
    font-size: 21rpx;
    font-weight: 900;
  }

  &__next-row {
    margin-top: 16rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__next-body {
    min-width: 0;
    flex: 1;
  }

  &__next-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
  }

  &__next-sub {
    margin-top: 7rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__next-action {
    min-height: 56rpx;
    padding: 0 20rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 21rpx;
    font-weight: 900;
  }

  &__week-title {
    margin: 10rpx 0 16rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 900;
  }

  &__days {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__day {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14rpx;
    padding: 22rpx;

    &--done {
      border-color: rgba(80, 220, 180, 0.2);
    }
  }

  &__day-more {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    width: 58rpx;
    height: 58rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
  }

  &__day-main {
    display: flex;
    align-items: center;
    gap: 18rpx;
    min-width: 0;
    flex: 1;

    &--managed {
      padding-right: 58rpx;
    }
  }

  &__day-index {
    width: 82rpx;
    height: 72rpx;
    border-radius: 22rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__day-body {
    flex: 1;
    min-width: 0;
  }

  &__day-title {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__day-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__day-footer {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    padding-top: 14rpx;
    border-top: 1rpx solid var(--app-border);
  }

  &__pending {
    color: var(--app-text-muted);
    font-size: 21rpx;
  }

  &__start,
  &__done {
    min-height: 56rpx;
    padding: 0 20rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
  }

  &__start {
    background: var(--app-accent-soft);
    color: var(--app-accent);
  }

  &__done {
    width: 100%;
    justify-content: flex-start;
    padding: 0;
    color: var(--app-success);
    background: transparent;
  }

  &__empty {
    padding: 32rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__empty-action {
    min-height: 68rpx;
    margin-top: 24rpx;
    border: 1rpx solid rgba(255, 100, 40, 0.34);
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    font-weight: 800;
  }

  &__footer {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(24rpx + env(safe-area-inset-bottom));
    z-index: 10;
  }
}
</style>
