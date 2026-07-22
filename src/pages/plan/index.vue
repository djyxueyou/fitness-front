<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import CalendarView from '@/components/training-hub/calendar-view.vue'
import HistoryView from '@/components/training-hub/history-view.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { showPlanWriteError } from '@/utils/plan-write-feedback'
import { createSessionLoadCoordinator } from '@/utils/session-load-coordinator'
import { resetPlanViewLocalState } from '@/utils/plan-view-session-state'
import { getToken } from '@/api/http'
import { isStalePlanDetailError, usePlanStore } from '@/stores/plan'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import {
  resolvePlanLandingTab,
  useTrainingHubStore,
  type TrainingHubView
} from '@/stores/training-hub'
import {
  fetchPlanActivationOptions,
  type ActivePlanSummaryResponse,
  type SystemPlanListItemResponse,
  type TrainingPlanListItemResponse
} from '@/api/plan'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const planStore = usePlanStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const trainingHubStore = useTrainingHubStore()
const activeTab = ref<'system' | 'mine'>('system')
const busyPlanId = ref<number | null>(null)
const activePlanSummary = ref<ActivePlanSummaryResponse | null>(null)
const scrollTarget = ref('')
const sheetVisible = ref(false)
const sheetTitle = ref('')
const sheetSubtitle = ref('')
const sheetItems = ref<ActionSheetItem[]>([])
const sheetTargetPlan = ref<TrainingPlanListItemResponse | null>(null)
const selectedCollection = ref('ALL')
const planViewLoadCoordinator = createSessionLoadCoordinator<string | undefined>({
  onSessionChange: () => {
    resetPlanViewLocalState({
      activePlanSummary,
      busyPlanId,
      sheetVisible,
      sheetTitle,
      sheetSubtitle,
      sheetItems,
      sheetTargetPlan
    })
    planStore.clearPersonalPlanState()
  }
})
const planCollections = [
  { code: 'ALL', label: '全部' },
  { code: 'BEGINNER', label: '新手入门' },
  { code: 'HOME', label: '居家训练' },
  { code: 'GYM', label: '健身房' },
  { code: 'HYPERTROPHY', label: '增肌' },
  { code: 'STRENGTH', label: '力量' },
  { code: 'BODY_SHAPING', label: '塑形' },
  { code: 'TIME_SAVING', label: '短时训练' }
]

const visiblePlans = computed(() => {
  if (activeTab.value === 'mine') return sortActiveFirst(planStore.userPlans)
  if (selectedCollection.value === 'ALL') return planStore.systemPlans
  return planStore.systemPlans.filter((plan) =>
    plan.collectionCodes.includes(selectedCollection.value)
  )
})
const hasCurrentPlan = computed(() => Boolean(activePlanSummary.value))
const activePlanName = computed(() => activePlanSummary.value?.planName || '未启用')
const activePlanStatusText = computed(() => {
  if (!activePlanSummary.value) return '待选择'
  return summaryStatusText(activePlanSummary.value.executionStatus)
})
const hasActivePlanRecommendation = computed(() =>
  Boolean(hasCurrentPlan.value && planStore.recommendation?.type === 'PLAN_TODAY')
)
const isTodayCompletedRecommendation = computed(
  () => planStore.recommendation?.type === 'PLAN_TODAY_COMPLETED'
)
const activePlanRecommendationTitle = computed(() => {
  if (!activePlanSummary.value) return '还没有启用计划'
  return activePlanSummary.value.nextTitle || planStore.recommendation?.title || '暂无待训练安排'
})
const activePlanSubtitle = computed(() => {
  if (hasActivePlanRecommendation.value) return planStore.recommendation?.subtitle || '按计划推进'
  if (isTodayCompletedRecommendation.value) {
    return planStore.recommendation?.reason || '今天的计划训练已经完成'
  }
  if (activePlanSummary.value) return '进入当前安排查看训练日和后续排期'
  return '先选择一套系统计划，按你的频率和器械生成安排'
})
const activePlanActionText = computed(() => {
  if (activePlanSummary.value) return '查看当前安排'
  return '去启用'
})
const systemPlanCount = computed(() => planStore.systemPlans.length)
const userPlanCount = computed(() => planStore.userPlans.length)
const tabs = computed(() => [
  { key: 'system' as const, label: `系统计划 ${systemPlanCount.value}` },
  { key: 'mine' as const, label: `我的计划 ${userPlanCount.value}` }
])
const hubTabs: Array<{ key: TrainingHubView; label: string }> = [
  { key: 'plan', label: '计划' },
  { key: 'calendar', label: '日历' },
  { key: 'history', label: '历史' }
]
const completedWeekCount = computed(() => activePlanSummary.value?.completedThisWeek ?? 0)
const remainingWeekCount = computed(() => activePlanSummary.value?.remainingThisWeek ?? 0)
const weekProgressText = computed(() => {
  if (!activePlanSummary.value) return '--'
  return `${activePlanSummary.value.completedThisWeek}/${activePlanSummary.value.scheduledThisWeek}`
})
const weekProgressPercent = computed(() => {
  const total = activePlanSummary.value?.scheduledThisWeek ?? 0
  return total ? Math.min(100, Math.round((completedWeekCount.value / total) * 100)) : 0
})
const nextTrainingDayText = computed(() => {
  if (!activePlanSummary.value) return '待选择'
  if (!activePlanSummary.value) return '--'
  if (activePlanSummary.value.nextDayOfWeek)
    return weekdayText(activePlanSummary.value.nextDayOfWeek)
  return activePlanSummary.value.executionStatus === 'FINISHING' ? '待收尾' : '计划完成'
})

function sortActiveFirst(plans: TrainingPlanListItemResponse[]) {
  return [...plans].sort((a, b) => Number(b.active) - Number(a.active))
}

function executionStatusText(item: TrainingPlanListItemResponse) {
  const labels: Record<string, string> = {
    SCHEDULED: '待生效',
    ACTIVE: '进行中',
    FINISHING: '待收尾'
  }
  return item.lastExecutionStatus ? labels[item.lastExecutionStatus] || '' : ''
}

function summaryStatusText(status?: string) {
  const labels: Record<string, string> = {
    SCHEDULED: '待生效',
    ACTIVE: '进行中',
    FINISHING: '待收尾'
  }
  return status ? labels[status] || '进行中' : '进行中'
}

onShow(async () => {
  const requestedView = trainingHubStore.consumeRequestedView()
  if (requestedView) trainingHubStore.setActiveView(requestedView)
  if (trainingHubStore.activeView !== 'plan') return
  const tokenSnapshot = getToken()
  const loadTicket = planViewLoadCoordinator.begin(tokenSnapshot, (isCurrent) =>
    loadPlanView(tokenSnapshot, isCurrent)
  )
  await loadTicket.promise
  if (!loadTicket.isCurrent()) return
  const requestedPlanTab = trainingHubStore.consumeRequestedPlanTab()
  if (!requestedPlanTab) return
  activeTab.value = resolvePlanLandingTab(
    requestedPlanTab,
    !planStore.listError && Boolean(planStore.userPlans.length)
  )
})

onHide(() => {
  trainingHubStore.setActiveView('plan')
})

async function loadPlanView(tokenSnapshot = getToken(), shouldCommit = () => true) {
  if (!tokenSnapshot) {
    activeTab.value = 'system'
    activePlanSummary.value = null
    planStore.clearPersonalPlanState()
    await planStore.fetchSystemPlanList({ force: true })
    return
  }
  await loadAuthenticatedPlans(shouldCommit)
}

async function selectHubView(view: TrainingHubView) {
  if (view !== 'plan' && !(await ensureFeatureAuth(view === 'calendar' ? '训练日历' : '训练记录')))
    return
  trainingHubStore.setActiveView(view)
  if (view === 'plan') {
    const tokenSnapshot = getToken()
    await planViewLoadCoordinator.begin(tokenSnapshot, (isCurrent) =>
      loadPlanView(tokenSnapshot, isCurrent)
    ).promise
  }
}

async function loadAuthenticatedPlans(shouldCommit = () => true) {
  await planStore.fetchPlans({ force: true })
  if (!shouldCommit()) return
  await planStore.loadCurrentPlan()
  if (!shouldCommit()) return
  await planStore.loadRecommendation()
  if (!shouldCommit()) return
  await loadActivePlanSummary()
}

async function selectTab(tab: 'system' | 'mine') {
  if (tab === 'system') {
    activeTab.value = tab
    return
  }
  if (!(await ensureFeatureAuth('我的训练计划'))) return
  activeTab.value = tab
  await loadAuthenticatedPlans()
}

async function loadActivePlanSummary() {
  activePlanSummary.value = planStore.currentPlanSummary
}

async function goDetail(id: number) {
  if (!(await ensureFeatureAuth('我的训练计划'))) return
  uni.navigateTo({ url: `${routes.planDetail}?id=${id}` })
}

function goSystemPlanDetail(id: number) {
  uni.navigateTo({ url: `${routes.planDetail}?id=${id}&source=system` })
}

async function goCreatePlan() {
  if (!(await ensureFeatureAuth('创建训练计划'))) return
  uni.navigateTo({ url: routes.planCreate })
}

async function openMyTemplates() {
  if (!(await ensureFeatureAuth('我的模板'))) return
  uni.navigateTo({ url: routes.templateManager })
}

function goActivePlan() {
  if (activePlanSummary.value) {
    uni.navigateTo({ url: routes.planActive })
    return
  }
  void focusPlanList()
}

async function focusPlanList() {
  activeTab.value = 'system'
  scrollTarget.value = ''
  await nextTick()
  scrollTarget.value = 'plan-list-anchor'
}

async function activatePlan(item: TrainingPlanListItemResponse) {
  if (!(await ensureFeatureAuth('启用训练计划'))) return
  if (busyPlanId.value || item.active) return
  if (activePlanSummary.value && activePlanSummary.value.definitionId !== item.id) {
    openSwitchPlanSheet(item)
    return
  }
  await openActivationSheet(item)
}

async function performActivatePlan(
  item: TrainingPlanListItemResponse,
  mode: 'THIS_WEEK' | 'NEXT_WEEK'
) {
  busyPlanId.value = item.id
  try {
    await planStore.activate(item.id, mode)
    await loadActivePlanSummary()
    uni.showToast({ title: '已启用训练计划', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: routes.planActive }), 300)
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({
      title: activationErrorTitle(err),
      icon: 'none'
    })
    console.error('[plan] activate failed', err)
  } finally {
    busyPlanId.value = null
  }
}

async function openActivationSheet(item: TrainingPlanListItemResponse) {
  busyPlanId.value = item.id
  try {
    const options = await fetchPlanActivationOptions(item.id)
    sheetTargetPlan.value = item
    sheetTitle.value = '选择计划生效周期'
    sheetSubtitle.value = '训练日日期和状态由服务端按选择的周期统一计算。'
    sheetItems.value = options.map((option) => ({
      key: `activate-${option.mode}`,
      label: option.mode === 'THIS_WEEK' ? '本周生效' : '下周生效',
      description: option.firstTrainingDate
        ? `首个训练日：${formatPlanDate(option.firstTrainingDate)}${option.notApplicableDays ? ' · 本周已错过的训练日不会记为逾期' : ''}`
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
    busyPlanId.value = null
  }
}

function openSwitchPlanSheet(item: TrainingPlanListItemResponse) {
  sheetTargetPlan.value = item
  sheetTitle.value = '切换当前计划？'
  sheetSubtitle.value = `启用「${item.name}」后，当前计划会被替换。已完成的训练记录会保留。`
  sheetItems.value = [
    {
      key: 'confirm-switch',
      label: '确认切换',
      description: '替换当前启用计划，训练记录不会被删除。',
      primary: true
    }
  ]
  sheetVisible.value = true
}

async function copyPlan(item: TrainingPlanListItemResponse) {
  if (busyPlanId.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  busyPlanId.value = item.id
  try {
    await planStore.duplicate(item.id)
    activeTab.value = 'mine'
    uni.showToast({ title: '已复制到我的计划', icon: 'none' })
  } catch (err) {
    showPlanWriteError(err, '计划复制失败，请重试')
    console.error('[plan] copy failed', err)
  } finally {
    busyPlanId.value = null
  }
}

async function customizeSystemPlan(item: SystemPlanListItemResponse) {
  if (!(await ensureFeatureAuth('设置训练安排'))) return
  uni.navigateTo({ url: `${routes.planCustomize}?id=${item.id}` })
}

function selectCollection(code: string) {
  selectedCollection.value = code
}

function systemPlanMeta(item: SystemPlanListItemResponse) {
  const frequency =
    item.minWeeklyFrequency === item.maxWeeklyFrequency
      ? `每周 ${item.minWeeklyFrequency} 练`
      : `每周 ${item.minWeeklyFrequency}-${item.maxWeeklyFrequency} 练`
  const durations = [...item.supportedDurations].sort((a, b) => a - b)
  const duration = durations.length ? `${durations[0]}-${durations[durations.length - 1]} 分钟` : ''
  return [frequency, duration].filter(Boolean).join(' · ')
}

function openPlanActions(item: TrainingPlanListItemResponse) {
  sheetTargetPlan.value = item
  sheetTitle.value = item.name
  sheetSubtitle.value = item.planType === 'SYSTEM' ? '系统计划可复制后编辑' : '我的计划'
  sheetItems.value =
    item.planType === 'SYSTEM'
      ? [
          {
            key: 'copy',
            label: '复制到我的计划',
            description: '复制后可以编辑训练日和计划名称。',
            primary: true
          }
        ]
      : [
          {
            key: 'detail',
            label: '查看详情',
            description: '查看和管理训练安排。',
            primary: true
          },
          ...(!item.active
            ? [
                {
                  key: 'edit',
                  label: '编辑计划',
                  description: '修改计划名称、目标和难度。'
                },
                {
                  key: 'add-day',
                  label: '新增训练日',
                  description: '为计划增加新的周训练安排。'
                }
              ]
            : []),
          {
            key: 'copy',
            label: '复制计划',
            description: '复制一份新的计划副本。'
          },
          ...(item.active
            ? [
                {
                  key: 'manage-active',
                  label: '管理当前计划',
                  description: '前往当前安排保存副本或停用计划。'
                }
              ]
            : []),
          ...(!item.active
            ? [
                {
                  key: 'delete',
                  label: '删除计划',
                  description: '仅删除计划编排，不删除已完成的训练记录。',
                  danger: true
                }
              ]
            : [])
        ]
  sheetVisible.value = true
}

function closePlanActions() {
  sheetVisible.value = false
}

async function handlePlanAction(item: ActionSheetItem) {
  const target = sheetTargetPlan.value
  closePlanActions()
  if (!target) return
  if (item.key === 'confirm-switch') {
    await openActivationSheet(target)
    return
  }
  if (item.key === 'activate-THIS_WEEK' || item.key === 'activate-NEXT_WEEK') {
    await performActivatePlan(target, item.key === 'activate-NEXT_WEEK' ? 'NEXT_WEEK' : 'THIS_WEEK')
    return
  }
  if (item.key === 'copy') {
    await copyPlan(target)
    return
  }
  if (item.key === 'detail') {
    goDetail(target.id)
    return
  }
  if (item.key === 'edit') {
    if (!(await ensureMembershipFeature('自定义训练计划'))) return
    uni.navigateTo({ url: `${routes.planEdit}?id=${target.id}` })
    return
  }
  if (item.key === 'add-day') {
    if (!(await ensureMembershipFeature('自定义训练计划'))) return
    uni.navigateTo({ url: `${routes.planDayEdit}?id=${target.id}` })
    return
  }
  if (item.key === 'manage-active') {
    uni.navigateTo({ url: routes.planActive })
    return
  }
  if (item.key === 'delete') {
    if (!(await ensureFeatureAuth('删除训练计划'))) return
    busyPlanId.value = target.id
    try {
      await planStore.removePlan(target.id)
      if (target.active) {
        activePlanSummary.value = null
      }
      uni.showToast({ title: '已删除计划', icon: 'none' })
    } catch (err) {
      showPlanWriteError(err, '计划删除失败，请重试')
      console.error('[plan] delete failed', err)
    } finally {
      busyPlanId.value = null
    }
  }
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

function weekdayText(dayOfWeek?: number | null) {
  if (!dayOfWeek) return '训练日'
  return (
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayOfWeek - 1] || `第 ${dayOfWeek} 天`
  )
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
</script>

<template>
  <scroll-view
    scroll-y
    scroll-with-animation
    class="page-scroll"
    :class="themeStore.themeClass"
    :scroll-into-view="scrollTarget"
  >
    <view class="page-shell tab-page plan-page safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="训练" subtitle="计划接下来怎么练，也看见每一次完成" />

      <view class="training-hub__tabs">
        <view
          v-for="tab in hubTabs"
          :key="tab.key"
          class="training-hub__tab btn-press"
          :class="{ 'training-hub__tab--active': trainingHubStore.activeView === tab.key }"
          @tap="selectHubView(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>

      <template v-if="trainingHubStore.activeView === 'plan'">
        <view class="glass-card plan-page__hero">
          <view class="plan-page__hero-top">
            <view>
              <view class="plan-page__active-label">当前计划</view>
              <view class="plan-page__active-name">{{ activePlanName }}</view>
            </view>
            <view class="plan-page__active-pill">{{ activePlanStatusText }}</view>
          </view>
          <view class="plan-page__next-card">
            <view class="plan-page__next-copy">
              <view class="plan-page__next-label">下一步</view>
              <view class="plan-page__next-title">
                {{ activePlanRecommendationTitle || activePlanActionText }}
              </view>
              <view class="plan-page__active-next">{{ activePlanSubtitle }}</view>
            </view>
            <view class="plan-page__active-start btn-press" @tap.stop="goActivePlan">
              {{ activePlanActionText }}
            </view>
          </view>
          <view class="plan-page__progress-summary">
            <view class="plan-page__progress-copy">
              <view>
                <view class="plan-page__progress-label">本周进度</view>
                <view class="plan-page__progress-value">
                  {{
                    activePlanSummary
                      ? `${weekProgressText} 已完成 · 剩余 ${remainingWeekCount} 次`
                      : '启用计划后显示进度'
                  }}
                </view>
              </view>
              <view class="plan-page__next-day">
                <view class="plan-page__progress-label">下一次</view>
                <view class="plan-page__next-day-value">{{ nextTrainingDayText }}</view>
              </view>
            </view>
            <view class="plan-page__progress-track">
              <view
                class="plan-page__progress-fill"
                :style="{ width: `${weekProgressPercent}%` }"
              />
            </view>
          </view>
        </view>

        <view id="plan-list-anchor" class="section-heading plan-page__section-head">
          <view>
            <view class="section-title">选择计划</view>
            <view class="plan-page__section-sub"
              >系统计划会按频率、器械和不适部位生成训练安排。</view
            >
          </view>
          <view v-if="activeTab === 'mine'" class="plan-page__create btn-press" @tap="goCreatePlan"
            >+ 新建计划</view
          >
        </view>

        <view class="plan-page__tabs">
          <view
            v-for="tab in tabs"
            :key="tab.key"
            class="plan-page__tab btn-press"
            :class="{ 'plan-page__tab--active': activeTab === tab.key }"
            @tap="selectTab(tab.key)"
          >
            {{ tab.label }}
          </view>
        </view>

        <scroll-view
          v-if="activeTab === 'system'"
          scroll-x
          class="plan-page__collections"
          :show-scrollbar="false"
        >
          <view class="plan-page__collection-row">
            <view
              v-for="collection in planCollections"
              :key="collection.code"
              class="plan-page__collection btn-press"
              :class="{ 'plan-page__collection--active': selectedCollection === collection.code }"
              @tap="selectCollection(collection.code)"
            >
              {{ collection.label }}
            </view>
          </view>
        </scroll-view>

        <view
          v-if="activeTab === 'mine'"
          class="training-hub__template-entry btn-press"
          @tap="openMyTemplates"
        >
          <view>
            <view class="training-hub__asset-title">我的模板</view>
            <view class="training-hub__asset-subtitle">管理可重复使用的动作组合</view>
          </view>
          <view class="training-hub__asset-value">›</view>
        </view>

        <view v-if="planStore.loading && !visiblePlans.length" class="plan-page__state muted">
          加载训练计划...
        </view>

        <view v-else-if="planStore.listError" class="plan-page__state">
          <EmptyState
            icon="!"
            title="计划加载失败"
            description="网络或服务暂时不可用，请稍后重试。"
          />
        </view>

        <view v-else class="plan-page__list">
          <EmptyState
            v-if="!visiblePlans.length && activeTab === 'mine'"
            icon="+"
            title="还没有我的计划"
            description="可以先从系统计划生成一套安排。"
            action-text="浏览系统计划"
            @action="focusPlanList"
          />

          <view v-else-if="!visiblePlans.length" class="glass-card plan-page__empty">
            暂无符合筛选条件的系统计划。
          </view>

          <view
            v-for="item in visiblePlans"
            :key="item.id"
            class="glass-card plan-page__item btn-press"
            :class="{
              'plan-page__item--active': activeTab === 'mine' && 'active' in item && item.active
            }"
            @tap="activeTab === 'system' ? goSystemPlanDetail(item.id) : goDetail(item.id)"
          >
            <view
              v-if="activeTab === 'mine'"
              class="plan-page__more btn-press"
              @tap.stop="openPlanActions(item as TrainingPlanListItemResponse)"
              >...</view
            >
            <view class="plan-page__item-main">
              <view class="plan-page__tag-row">
                <view class="plan-page__tag">{{ activeTab === 'system' ? '系统' : '我的' }}</view>
                <view
                  v-if="activeTab === 'mine' && 'active' in item && item.active"
                  class="plan-page__tag plan-page__tag--active"
                >
                  {{ executionStatusText(item as TrainingPlanListItemResponse) || '进行中' }}
                </view>
                <view
                  v-else-if="
                    activeTab === 'mine' &&
                    executionStatusText(item as TrainingPlanListItemResponse)
                  "
                  class="plan-page__tag"
                >
                  {{ executionStatusText(item as TrainingPlanListItemResponse) }}
                </view>
              </view>
              <view class="plan-page__name">{{ item.name }}</view>
              <view class="plan-page__meta">
                <template v-if="activeTab === 'system'">
                  {{ item.cycleWeeks }} 周 ·
                  {{ systemPlanMeta(item as SystemPlanListItemResponse) }}
                </template>
                <template v-else>
                  {{ item.cycleWeeks }} 周 · {{ difficultyText(item.difficultyLevel) }} ·
                  {{ goalText(item.goal) }}
                </template>
              </view>
            </view>
            <view v-if="activeTab === 'system'" class="plan-page__actions">
              <view
                class="plan-page__btn plan-page__btn--primary btn-press"
                @tap.stop="customizeSystemPlan(item as SystemPlanListItemResponse)"
              >
                设置安排
              </view>
            </view>
            <view v-else-if="'active' in item && !item.active" class="plan-page__actions">
              <view
                class="plan-page__btn plan-page__btn--primary btn-press"
                @tap.stop="activatePlan(item as TrainingPlanListItemResponse)"
              >
                {{ busyPlanId === item.id ? '处理中' : '启用' }}
              </view>
            </view>
          </view>
        </view>
      </template>
      <CalendarView v-else-if="trainingHubStore.activeView === 'calendar'" />
      <HistoryView v-else />
    </view>
  </scroll-view>
  <AppActionSheet
    :class="themeStore.themeClass"
    :visible="sheetVisible"
    :title="sheetTitle"
    :subtitle="sheetSubtitle"
    :items="sheetItems"
    @close="closePlanActions"
    @select="handlePlanAction"
  />
  <WorkoutDraftFab :class="themeStore.themeClass" variant="light" @open="openDraftFab" />
  <WorkoutDraftPrompt />
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.training-hub {
  &__tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8rpx;
    margin: 22rpx 0 24rpx;
    padding: 8rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 24rpx;
    background: var(--app-surface);
  }

  &__tab {
    min-height: 68rpx;
    border-radius: 18rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;

    &--active {
      color: #fff;
      background: var(--app-accent);
    }
  }

  &__template-entry {
    min-height: 104rpx;
    margin-bottom: 18rpx;
    padding: 20rpx 24rpx;
    border: 1rpx solid var(--app-border);
    border-radius: var(--app-radius-lg);
    background: var(--app-surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__asset-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 800;
  }

  &__asset-subtitle {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__asset-value {
    flex-shrink: 0;
    color: var(--app-text-muted);
    font-size: 26rpx;
  }
}

.plan-page {
  &__hero {
    margin-top: 24rpx;
    padding: 24rpx;
  }

  &__hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__active-label {
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__active-name {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 800;
  }

  &__active-next {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.4;
  }

  &__next-card {
    margin-top: 20rpx;
    padding: 20rpx;
    border-radius: 20rpx;
    background: var(--app-surface-subtle);
    border: 1rpx solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__next-copy {
    min-width: 0;
    flex: 1;
  }

  &__next-label {
    color: var(--app-accent);
    font-size: 21rpx;
    font-weight: 800;
  }

  &__next-title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 800;
  }

  &__active-start {
    min-height: 64rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    background: var(--app-accent);
    color: #fff;
    font-size: 22rpx;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  &__active-pill,
  &__tag {
    border-radius: 999rpx;
    padding: 8rpx 16rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 800;
    flex-shrink: 0;
  }

  &__progress-summary {
    margin-top: 18rpx;
    padding: 18rpx 20rpx;
    border-radius: 20rpx;
    background: var(--app-surface-subtle);
    border: 1rpx solid var(--app-border);
  }

  &__progress-copy {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__progress-value {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 23rpx;
    font-weight: 900;
  }

  &__progress-label {
    color: var(--app-text-muted);
    font-size: 20rpx;
  }

  &__next-day {
    flex-shrink: 0;
    text-align: right;
  }

  &__next-day-value {
    margin-top: 6rpx;
    color: var(--app-accent);
    font-size: 23rpx;
    font-weight: 900;
  }

  &__progress-track {
    height: 8rpx;
    margin-top: 16rpx;
    overflow: hidden;
    border-radius: 999rpx;
    background: var(--app-border);
  }

  &__progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff501e, #ffa03c);
    transition: width 240ms ease;
  }

  &__section-head {
    margin-top: 30rpx;
    margin-bottom: 18rpx;
  }

  &__section-sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__tabs {
    display: flex;
    gap: 12rpx;
    margin: 0 0 20rpx;
    padding: 8rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__tab {
    flex: 1;
    min-height: 64rpx;
    border-radius: 999rpx;
    color: var(--app-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 700;

    &--active {
      background: var(--app-accent);
      color: #fff;
      box-shadow: var(--app-shadow-cta);
    }
  }

  &__collections {
    width: 100%;
    margin: -2rpx 0 20rpx;
    white-space: nowrap;
  }

  &__collection-row {
    display: inline-flex;
    gap: 12rpx;
    padding-right: 20rpx;
  }

  &__collection {
    min-height: 56rpx;
    padding: 0 22rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 999rpx;
    background: var(--app-surface);
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 800;
    display: flex;
    align-items: center;

    &--active {
      border-color: var(--app-accent);
      background: var(--app-accent-soft);
      color: var(--app-accent);
    }
  }

  &__state {
    padding-top: 80rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__empty {
    padding: 28rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
  }

  &__item {
    position: relative;
    padding: 20rpx;
    border-color: var(--app-border);

    &--active {
      border-color: rgba(255, 80, 30, 0.3);
      box-shadow: var(--app-shadow-focus);
    }
  }

  &__item-main {
    min-width: 0;
  }

  &__tag-row {
    display: flex;
    gap: 10rpx;
    flex-wrap: wrap;
  }

  &__tag--active {
    background: rgba(80, 220, 180, 0.14);
    color: #3dd9a2;
  }

  &__name {
    margin-top: 14rpx;
    padding-right: 76rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 800;
  }

  &__meta {
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__actions {
    display: flex;
    gap: 12rpx;
    margin-top: 18rpx;
  }

  &__btn {
    min-height: 58rpx;
    padding: 0 22rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23rpx;
    font-weight: 800;

    &--primary {
      background: var(--app-accent);
      color: #fff;
    }
  }

  &__more {
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
    flex-shrink: 0;
  }
}
</style>
