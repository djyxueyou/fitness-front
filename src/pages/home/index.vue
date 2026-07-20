<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import PrimaryButton from '@/components/primary-button/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import TrainingRecordCard from '@/components/training-record-card/index.vue'
import { clearToken, getToken } from '@/api/http'
import {
  fetchHomeWeeklyRhythm,
  fetchTrainingHistory,
  type TrainingHistoryItemResponse,
  type HomeWeeklyRhythmResponse
} from '@/api/training'
import {
  fetchActivePlanExecution,
  fetchActiveTrainingPlanSummary,
  fetchTodayPlanRecommendation
} from '@/api/plan'
import { clearCachedUserProfile, fetchUserProfile } from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { offTrainingChanged, onTrainingChanged } from '@/utils/training-events'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import { useTrainingHubStore, type TrainingHubView } from '@/stores/training-hub'
import { formatCompactWeight } from '@/utils/unit'
import { ensureMembershipFeature } from '@/utils/membership-guard'

const profileStore = useProfileStore()
const planStore = usePlanStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const trainingHubStore = useTrainingHubStore()
const HOME_CACHE_MS = 30000

const weeklyRhythm = ref<HomeWeeklyRhythmResponse | null>(null)
const recentHistory = ref<TrainingHistoryItemResponse[]>([])
const isLoggedIn = ref(Boolean(getToken()))
let homeLoadedAt = 0
let homeLoadPromise: Promise<void> | null = null
let homeLoadEpoch = 0

const weightUnit = computed(() => profileStore.unit)
const weekSessions = computed(() =>
  weeklyRhythm.value ? `${weeklyRhythm.value.sessionCount} 次` : '--'
)
const totalVolume = computed(() =>
  weeklyRhythm.value
    ? `${formatCompactWeight(weeklyRhythm.value.totalVolumeKg, weightUnit.value)} ${weightUnit.value}`
    : '--'
)
const totalDuration = computed(() =>
  weeklyRhythm.value ? `${Math.round(weeklyRhythm.value.totalDurationSeconds / 60)} min` : '--'
)
const weekStats = computed(() => {
  const today = new Date()
  const monday = getWeekStart(today)
  const trainedDateSet = new Set(weeklyRhythm.value?.trainedDates || [])

  return ['一', '二', '三', '四', '五', '六', '日'].map((day, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return {
      day,
      trained: trainedDateSet.has(toDateString(date)),
      isToday: toDateString(date) === toDateString(today)
    }
  })
})
const recentTrainingRecords = computed(() => recentHistory.value.slice(0, 2))
const hasActivePlan = computed(() => Boolean(planStore.currentPlanSummary))
const recommendationType = computed(() => planStore.recommendation?.type || '')
const isRestDay = computed(() => recommendationType.value === 'PLAN_REST')
const todayDateLabel = computed(() => {
  const today = new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()]
  return `今天 · ${today.getMonth() + 1}月${today.getDate()}日 ${weekday}`
})
const isPlanStartRecommendation = computed(() => recommendationType.value === 'PLAN_TODAY')
const hasPlanRecommendation = computed(() =>
  Boolean(hasActivePlan.value && isPlanStartRecommendation.value)
)
const todayPlanStatusLabel = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '草稿训练'
  if (!hasActivePlan.value) return '计划未启用'
  if (recommendationType.value === 'PLAN_TODAY') return '今日计划'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '已完成'
  if (recommendationType.value === 'PLAN_COMPLETED') return '本周完成'
  if (recommendationType.value === 'PLAN_REST') return '休息日'
  return '查看安排'
})
const homeHeroTitle = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '继续上次训练'
  if (!isLoggedIn.value) return '登录后保存训练数据'
  if (!hasActivePlan.value) return '选择一套训练计划'
  if (recommendationType.value === 'PLAN_TODAY') return '今天有计划训练'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '今日训练已完成'
  if (recommendationType.value === 'PLAN_COMPLETED') return '本周计划已完成'
  if (recommendationType.value === 'PLAN_REST') return '今天是计划休息日'
  return '查看当前训练计划'
})
const todayActionSub = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '恢复未完成训练'
  if (!hasActivePlan.value) return '启用后首页会按日期展示训练安排'
  if (hasPlanRecommendation.value) return '按计划完成后计入进度'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '可以自由训练，或查看后续安排'
  if (recommendationType.value === 'PLAN_COMPLETED') return '可以自由训练，或查看下周安排'
  if (recommendationType.value === 'PLAN_REST') return '今天没有固定计划训练'
  return '查看当前计划安排'
})
const primaryCtaTitle = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '继续训练'
  if (!isLoggedIn.value) return '登录并选择训练计划'
  if (hasPlanRecommendation.value) return '开始今日计划'
  if (!hasActivePlan.value) return '选择训练计划'
  if (recommendationType.value === 'PLAN_REST') return '查看本周安排'
  return '查看当前计划'
})
const recommendationTitle = computed(() => {
  if (!hasActivePlan.value) return '选择一个训练计划'
  if (recommendationType.value !== 'PLAN_TODAY') {
    return (
      planStore.currentPlanSummary?.planName || planStore.recommendation?.planName || '当前训练计划'
    )
  }
  return (
    planStore.recommendation?.title ||
    planStore.recommendation?.planName ||
    planStore.currentPlanSummary?.planName ||
    '自由安排训练'
  )
})

onLoad(() => {
  onAuthChanged(refreshAfterAuthChanged)
  onTrainingChanged(refreshAfterTrainingChanged)
})

onUnload(() => {
  offAuthChanged(refreshAfterAuthChanged)
  offTrainingChanged(refreshAfterTrainingChanged)
})

onShow(() => {
  isLoggedIn.value = Boolean(getToken())
  workoutStore.refreshDraftState()
  if (!workoutStore.hasActiveWorkout) {
    workoutStore.restoreDraft()
  }
  loadHomeData()
})

async function refreshAfterAuthChanged() {
  isLoggedIn.value = Boolean(getToken())
  await loadHomeData({ forceTemplates: true })
}

async function refreshAfterTrainingChanged() {
  await loadHomeData({ forceTemplates: true })
}

function clearHomeData() {
  homeLoadEpoch += 1
  homeLoadPromise = null
  isLoggedIn.value = false
  weeklyRhythm.value = null
  recentHistory.value = []
  homeLoadedAt = 0
  planStore.clearPersonalPlanState()
  templateStore.invalidateSession()
}

function isHomeLoadActive(epoch: number) {
  return homeLoadEpoch === epoch && Boolean(getToken())
}

function loadHomeData(options?: { forceTemplates?: boolean }) {
  if (!getToken()) {
    clearHomeData()
    return Promise.resolve()
  }

  if (homeLoadPromise && !options?.forceTemplates) {
    return homeLoadPromise
  }

  if (homeLoadPromise) {
    homeLoadEpoch += 1
    homeLoadPromise = null
  }

  const epoch = homeLoadEpoch + 1
  homeLoadEpoch = epoch
  let pendingLoad: Promise<void>
  pendingLoad = loadHomeDataForEpoch(epoch, options).finally(() => {
    if (homeLoadPromise === pendingLoad) {
      homeLoadPromise = null
    }
  })
  homeLoadPromise = pendingLoad
  return pendingLoad
}

async function loadHomeDataForEpoch(epoch: number, options?: { forceTemplates?: boolean }) {
  isLoggedIn.value = true

  try {
    await fetchUserProfile()
  } catch {
    if (!isHomeLoadActive(epoch)) return
    clearToken()
    clearCachedUserProfile()
    clearHomeData()
    return
  }

  if (!isHomeLoadActive(epoch)) return

  if (!options?.forceTemplates && homeLoadedAt && Date.now() - homeLoadedAt < HOME_CACHE_MS) {
    return
  }

  if (options?.forceTemplates || !templateStore.loadedFromServer) {
    await templateStore
      .fetchTemplates({
        includeDetails: false,
        force: options?.forceTemplates,
        shouldCommit: () => isHomeLoadActive(epoch)
      })
      .catch((err) => {
        console.error('[home] template fetch failed', err)
      })
  }

  if (!isHomeLoadActive(epoch)) return

  const [currentPlanResult, recommendationResult, weeklyRhythmResult, recentHistoryResult] =
    await Promise.allSettled([
      Promise.all([fetchActiveTrainingPlanSummary(), fetchActivePlanExecution()]),
      fetchTodayPlanRecommendation(),
      fetchHomeWeeklyRhythm(),
      fetchTrainingHistory({
        pageNo: 1,
        pageSize: 20
      })
    ])

  if (!isHomeLoadActive(epoch)) return

  if (currentPlanResult.status === 'fulfilled') {
    const [summary, execution] = currentPlanResult.value
    planStore.currentPlanSummary = summary
    planStore.activeExecution = execution && 'executionId' in execution ? execution : null
  } else {
    planStore.currentPlanSummary = null
    planStore.activeExecution = null
    console.error('[home] current plan fetch failed', currentPlanResult.reason)
  }

  if (recommendationResult.status === 'fulfilled') {
    planStore.recommendation = recommendationResult.value
  } else {
    planStore.recommendation = null
    console.error('[home] plan recommendation fetch failed', recommendationResult.reason)
  }

  if (weeklyRhythmResult.status === 'fulfilled') {
    weeklyRhythm.value = weeklyRhythmResult.value
  } else {
    weeklyRhythm.value = null
    console.error('[home] weekly rhythm fetch failed', weeklyRhythmResult.reason)
  }

  if (recentHistoryResult.status === 'fulfilled') {
    recentHistory.value = recentHistoryResult.value.list
    homeLoadedAt = Date.now()
  } else {
    recentHistory.value = []
    console.error('[home] recent history fetch failed', recentHistoryResult.reason)
  }
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

function toDateString(date: Date) {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatRecentDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (toDateString(date) === toDateString(new Date())) return '今天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

async function goSelectTemplate() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout()
  if (!canStart) return
  uni.navigateTo({ url: routes.selectTemplate })
}

async function handlePrimaryCta() {
  if (workoutStore.hasRecoverableWorkout) {
    await continueWorkout()
    return
  }
  if (hasPlanRecommendation.value) {
    await startPlanRecommendation()
    return
  }
  if (!hasActivePlan.value) {
    const ok = await ensureFeatureAuth('训练计划')
    if (!ok) return
    await goPlans()
    return
  }
  await viewCurrentPlan()
}

async function startFreeWorkout() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout('自由训练')
  if (!canStart) return
  workoutStore.queueStartWorkout(null)
  uni.navigateTo({ url: routes.workoutActive })
}

async function goPlans() {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) return
  uni.switchTab({ url: routes.planIndex })
}

async function viewCurrentPlan() {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) return
  if (hasActivePlan.value) {
    uni.navigateTo({ url: routes.planActive })
    return
  }
  uni.switchTab({ url: routes.planIndex })
}

async function startPlanRecommendation() {
  const recommendation = planStore.recommendation
  if (recommendation?.type !== 'PLAN_TODAY') {
    await goPlans()
    return
  }
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  uni.navigateTo({ url: routes.planActive })
}

async function goTrainingHistory() {
  await openTrainingHub('history', '训练记录')
}

async function goCalendar() {
  await openTrainingHub('calendar', '训练日历')
}

async function openTrainingHub(view: Exclude<TrainingHubView, 'plan'>, authLabel: string) {
  const ok = await ensureFeatureAuth(authLabel)
  if (!ok) return
  trainingHubStore.open(view)
  uni.switchTab({ url: routes.planIndex })
}

async function loginForStats() {
  await ensureFeatureAuth('训练数据')
}

async function goTrend() {
  const ok = await ensureMembershipFeature('周统计', 'advanced_analytics')
  if (!ok) return
  uni.navigateTo({ url: routes.volumeTrend })
}

async function goHistoryDetail(id: number) {
  const ok = await ensureFeatureAuth('训练详情')
  if (!ok) return
  uni.navigateTo({ url: `${routes.historyDetail}?id=${id}` })
}

async function continueWorkout() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  if (!workoutStore.restoreDraft()) {
    uni.showToast({ title: '没有可恢复的训练', icon: 'none' })
    return
  }
  uni.navigateTo({ url: routes.workoutActive })
}

async function prepareNewWorkout(nextTitle?: string) {
  workoutStore.refreshDraftState()
  if (!workoutStore.hasRecoverableWorkout) return true

  const action = await draftPromptStore.open(
    nextTitle ? { title: nextTitle, subtitle: '删除当前草稿后直接开始' } : undefined
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
    await continueWorkout()
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell tab-page home-page safe-bottom" :class="themeStore.themeClass">
      <view class="home-page__hero">
        <view class="home-page__hero-copy">
          <view class="home-page__hero-date">{{ todayDateLabel }}</view>
          <view class="home-page__hero-title">{{ homeHeroTitle }}</view>
        </view>
      </view>

      <view class="home-page__focus-card">
        <image
          class="home-page__focus-visual"
          src="/static/home/dumbbell-accent.svg"
          mode="aspectFit"
        />
        <view class="home-page__focus-content">
          <view class="home-page__focus-topline">
            <view class="home-page__focus-label">今日计划</view>
            <view class="home-page__focus-status">{{ todayPlanStatusLabel }}</view>
          </view>
          <view class="home-page__focus-title">{{ recommendationTitle }}</view>
          <view class="home-page__focus-sub">{{ todayActionSub }}</view>
          <view
            class="home-page__focus-action"
            :class="{ 'home-page__focus-action--wide': !isLoggedIn }"
          >
            <PrimaryButton variant="light" @tap="handlePrimaryCta">
              <view class="home-page__cta-inner">
                <view class="home-page__cta-copy">
                  <view class="home-page__cta-kicker">下一步</view>
                  <view class="home-page__cta-title">{{ primaryCtaTitle }}</view>
                </view>
                <view class="home-page__cta-arrow">→</view>
              </view>
            </PrimaryButton>
          </view>
          <view v-if="!isLoggedIn" class="home-page__focus-login-note">
            登录后保存训练进度与数据
          </view>
        </view>
      </view>

      <view class="home-page__quick-actions">
        <view class="home-page__quick-action btn-press" @tap="goSelectTemplate">
          <view class="home-page__quick-icon">
            <image src="/static/home/template.svg" mode="aspectFit" />
          </view>
          <view class="home-page__quick-copy">
            <view class="home-page__quick-title">选模板</view>
            <view class="home-page__quick-sub">按熟悉方案练</view>
          </view>
        </view>
        <view
          class="home-page__quick-action btn-press"
          :class="{ 'home-page__quick-action--primary': !isRestDay }"
          @tap="startFreeWorkout"
        >
          <view
            class="home-page__quick-icon"
            :class="{ 'home-page__quick-icon--primary': !isRestDay }"
          >
            <image src="/static/home/free-workout.svg" mode="aspectFit" />
          </view>
          <view class="home-page__quick-copy">
            <view class="home-page__quick-title">自由练</view>
            <view class="home-page__quick-sub">立即开始记录</view>
          </view>
        </view>
        <view class="home-page__quick-action btn-press" @tap="goTrend">
          <view class="home-page__quick-icon home-page__quick-icon--analysis">
            <image src="/static/home/analysis.svg" mode="aspectFit" />
          </view>
          <view class="home-page__quick-copy">
            <view class="home-page__quick-title">训练分析</view>
            <view class="home-page__quick-sub">周统计与深度洞察</view>
          </view>
        </view>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-head">
          <view>
            <view class="home-page__section-no">
              <text>本周节奏</text>
            </view>
            <view class="home-page__section-title">查看本周完成情况</view>
          </view>
          <view class="home-page__link btn-press" @tap="goCalendar">训练日历</view>
        </view>
        <view v-if="!isLoggedIn" class="home-page__week-locked btn-press" @tap="loginForStats">
          <view class="home-page__week-locked-icon">⌁</view>
          <view>
            <view class="home-page__week-locked-title">登录后查看本周训练节奏</view>
            <view class="home-page__week-locked-sub">训练场次、容量和每周训练趋势会显示在这里</view>
          </view>
          <view class="home-page__week-locked-arrow">→</view>
        </view>
        <view v-else class="home-page__week-panel">
          <view class="home-page__stats">
            <view class="home-page__stat">
              <view class="home-page__stat-label">训练场次</view>
              <view class="home-page__stat-value">{{ weekSessions }}</view>
            </view>
            <view class="home-page__stat">
              <view class="home-page__stat-label">总容量</view>
              <view class="home-page__stat-value">{{ totalVolume }}</view>
            </view>
            <view class="home-page__stat">
              <view class="home-page__stat-label">训练时长</view>
              <view class="home-page__stat-value">{{ totalDuration }}</view>
            </view>
          </view>
          <view class="home-page__week-dots">
            <view v-for="item in weekStats" :key="item.day" class="home-page__week-col">
              <view
                class="home-page__week-dot"
                :class="{
                  'home-page__week-dot--trained': item.trained,
                  'home-page__week-dot--today': item.isToday
                }"
              >
                <view v-if="item.trained" class="home-page__week-check" />
              </view>
              <view
                class="home-page__week-label"
                :class="{ 'home-page__week-label--today': item.isToday }"
              >
                {{ item.day }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-head">
          <view>
            <view class="home-page__section-no">
              <text>最近完成</text>
            </view>
            <view class="home-page__section-title">从上一次继续进步</view>
          </view>
          <view class="home-page__link btn-press" @tap="goTrainingHistory">全部记录</view>
        </view>
        <view v-if="recentTrainingRecords.length" class="home-page__list">
          <TrainingRecordCard
            v-for="item in recentTrainingRecords"
            :key="item.id"
            :name="item.trainingName"
            :cover-url="item.coverUrl"
            :cover-record-type="item.coverRecordType"
            :meta="`${formatRecentDate(item.startedAt)} · ${Math.round(item.durationSeconds / 60)} min · ${item.totalSetCount} 组 · ${formatCompactWeight(Number(item.totalVolumeKg || 0), weightUnit)} ${weightUnit}`"
            @tap="goHistoryDetail(item.id)"
          />
        </view>
        <view v-else class="home-page__recent-empty">
          <view class="home-page__empty-mark">0</view>
          <view>
            <view class="home-page__empty-title">还没有训练记录</view>
            <view class="home-page__empty-sub">完成第一次训练后，这里会形成你的进步轨迹。</view>
            <view class="home-page__empty-action btn-press" @tap="startFreeWorkout">
              开始自由训练
            </view>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
  <WorkoutDraftFab :class="themeStore.themeClass" variant="light" @open="openDraftFab" />
  <WorkoutDraftPrompt />
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
@import './index.scss';
</style>
