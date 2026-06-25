<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import PrimaryButton from '@/components/primary-button/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import TrainingRecordCard from '@/components/training-record-card/index.vue'
import { clearToken, getToken } from '@/api/http'
import {
  fetchTrainingHistory,
  fetchTrainingSummary,
  type TrainingHistoryItemResponse,
  type TrainingStatsSummaryResponse
} from '@/api/training'
import { clearCachedUserProfile, fetchUserProfile } from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { offTrainingChanged, onTrainingChanged } from '@/utils/training-events'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useOnboardingStore } from '@/stores/onboarding'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import { formatCompactWeight } from '@/utils/unit'

const profileStore = useProfileStore()
const planStore = usePlanStore()
const onboardingStore = useOnboardingStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const HOME_CACHE_MS = 30000

const summary = ref<TrainingStatsSummaryResponse | null>(null)
const weekHistory = ref<TrainingHistoryItemResponse[]>([])
const recentHistory = ref<TrainingHistoryItemResponse[]>([])
const isLoggedIn = ref(Boolean(getToken()))
let homeLoadedAt = 0

const weightUnit = computed(() => profileStore.unit)
const weekSessions = computed(() => (summary.value ? `${weekHistory.value.length} 次` : '--'))
const totalVolume = computed(() =>
  summary.value
    ? `${formatCompactWeight(summary.value.totalVolumeKg, weightUnit.value)} ${weightUnit.value}`
    : '--'
)
const totalDuration = computed(() =>
  summary.value ? `${Math.round(summary.value.totalDurationSeconds / 60)} min` : '--'
)
const weekStats = computed(() => {
  const today = new Date()
  const monday = getWeekStart(today)
  const trainedDateSet = new Set(weekHistory.value.map((item) => item.startedAt.slice(0, 10)))

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
const hasActivePlan = computed(() => Boolean(planStore.activePlan))
const needsOnboarding = computed(() => isLoggedIn.value && !onboardingStore.isCompleted)
const hasOnboardingRecommendation = computed(
  () => !hasActivePlan.value && Boolean(onboardingStore.profile.recommendedPlanId)
)
const onboardingRecommendedPlan = computed(() =>
  planStore.systemPlans.find((plan) => plan.id === onboardingStore.profile.recommendedPlanId)
)
const recommendationType = computed(() => planStore.recommendation?.type || '')
const isRestDay = computed(() => recommendationType.value === 'PLAN_REST')
const todayDateLabel = computed(() => {
  const today = new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()]
  return `今天 · ${today.getMonth() + 1}月${today.getDate()}日 ${weekday}`
})
const isPlanStartRecommendation = computed(() =>
  ['PLAN_TODAY', 'PLAN_PENDING'].includes(recommendationType.value)
)
const hasPlanRecommendation = computed(() =>
  Boolean(
    hasActivePlan.value && isPlanStartRecommendation.value && planStore.recommendation?.templateId
  )
)
const todayPlanStatusLabel = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '草稿训练'
  if (!hasActivePlan.value) return '计划未启用'
  if (recommendationType.value === 'PLAN_PENDING') return '有补训'
  if (recommendationType.value === 'PLAN_TODAY') return '今日计划'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '已完成'
  if (recommendationType.value === 'PLAN_COMPLETED') return '本周完成'
  if (recommendationType.value === 'PLAN_REST') return '休息日'
  return '查看安排'
})
const homeHeroTitle = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '继续上次训练'
  if (!isLoggedIn.value) return '建立你的训练档案'
  if (!hasActivePlan.value && needsOnboarding.value) return '先建立你的训练偏好'
  if (!hasActivePlan.value) return '选择适合你的下一步'
  if (recommendationType.value === 'PLAN_TODAY') return '今天有计划训练'
  if (recommendationType.value === 'PLAN_PENDING') return '有计划需要补训'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '今日训练已完成'
  if (recommendationType.value === 'PLAN_COMPLETED') return '本周计划已完成'
  if (recommendationType.value === 'PLAN_REST') return '今天适合灵活安排'
  return '安排一次有效训练'
})
const todayActionSub = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '恢复未完成训练'
  if (!hasActivePlan.value && needsOnboarding.value) return '完成 30 秒画像，获得适合你的起步计划'
  if (!hasActivePlan.value && hasOnboardingRecommendation.value) return '根据你的目标和训练条件重新推荐'
  if (!hasActivePlan.value) return '查看推荐理由并启用训练计划'
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
  if (!hasActivePlan.value && needsOnboarding.value) return '建立训练画像'
  if (!hasActivePlan.value && hasOnboardingRecommendation.value) return '查看推荐计划'
  if (!hasActivePlan.value) return '选择训练计划'
  if (recommendationType.value === 'PLAN_REST') return '查看本周安排'
  return '查看当前计划'
})
const recommendationTitle = computed(
  () => {
    if (!hasActivePlan.value && needsOnboarding.value) return '建立训练画像'
    if (!hasActivePlan.value && onboardingRecommendedPlan.value) {
      return `推荐计划：${onboardingRecommendedPlan.value.name}`
    }
    if (!hasActivePlan.value) return '选择一个训练计划'
    return (
      planStore.recommendation?.title ||
      planStore.recommendation?.planName ||
      planStore.activePlan?.name ||
      '自由安排训练'
    )
  }
)

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
  if (getToken() && !templateStore.loadedFromServer) {
    templateStore.fetchTemplates({ includeDetails: false }).catch((err) => {
      console.error('[home] template fetch failed', err)
    })
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

async function loadHomeData(options?: { forceTemplates?: boolean }) {
  if (!getToken()) {
    isLoggedIn.value = false
    summary.value = null
    weekHistory.value = []
    recentHistory.value = []
    homeLoadedAt = 0
    return
  }
  isLoggedIn.value = true

  try {
    const userProfile = await fetchUserProfile()
    onboardingStore.ensureOwner(userProfile.userId)
    try {
      await onboardingStore.loadFromServer()
    } catch (err) {
      console.warn('[home] training profile load failed, local draft retained', err)
    }
  } catch {
    clearToken()
    clearCachedUserProfile()
    isLoggedIn.value = false
    summary.value = null
    weekHistory.value = []
    recentHistory.value = []
    homeLoadedAt = 0
    return
  }

  if (!options?.forceTemplates && summary.value && Date.now() - homeLoadedAt < HOME_CACHE_MS) {
    return
  }

  if (options?.forceTemplates || !templateStore.loadedFromServer) {
    await templateStore
      .fetchTemplates({ includeDetails: false, force: options?.forceTemplates })
      .catch((err) => {
        console.error('[home] template fetch failed', err)
      })
  }

  planStore.fetchPlans({ force: options?.forceTemplates }).catch((err) => {
    console.error('[home] plan fetch failed', err)
  })
  planStore.loadRecommendation().catch((err) => {
    console.error('[home] plan recommendation fetch failed', err)
  })

  const range = getCurrentWeekRange()
  fetchTrainingSummary({
    startedFrom: range.startedFrom,
    startedTo: range.startedTo
  })
    .then((nextSummary) => {
      summary.value = nextSummary
      homeLoadedAt = Date.now()
    })
    .catch((err) => {
      summary.value = null
      console.error('[home] summary fetch failed', err)
    })

  fetchTrainingHistory({
    pageNo: 1,
    pageSize: 50,
    startedFrom: range.startedFrom,
    startedTo: range.startedTo
  })
    .then((historyPage) => {
      weekHistory.value = historyPage.list
    })
    .catch((err) => {
      weekHistory.value = []
      console.error('[home] week history fetch failed', err)
    })

  fetchTrainingHistory({
    pageNo: 1,
    pageSize: 20
  })
    .then((recentPage) => {
      recentHistory.value = recentPage.list
    })
    .catch((err) => {
      recentHistory.value = []
      console.error('[home] recent history fetch failed', err)
    })
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

function getCurrentWeekRange() {
  const start = getWeekStart(new Date())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    startedFrom: toDateString(start),
    startedTo: toDateString(end)
  }
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
    if (needsOnboarding.value) {
      uni.navigateTo({ url: routes.onboarding })
      return
    }
    if (!onboardingStore.profile.recommendedPlanId) {
      await onboardingStore.recommend()
    }
    if (onboardingStore.profile.recommendedPlanId) {
      uni.navigateTo({ url: routes.recommendedPlan })
      return
    }
    await goPlans()
    return
  }
  await viewRecommendedPlan()
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

async function viewRecommendedPlan() {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) return
  const planId = hasActivePlan.value
    ? (planStore.recommendation?.planId ?? planStore.activePlan?.id)
    : null
  if (planId) {
    uni.navigateTo({ url: `${routes.planDetail}?id=${planId}` })
    return
  }
  uni.switchTab({ url: routes.planIndex })
}

async function startPlanRecommendation() {
  const recommendation = planStore.recommendation
  if (!recommendation?.templateId) {
    await goPlans()
    return
  }
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout(
    recommendation.title || recommendation.planName || '计划训练'
  )
  if (!canStart) return
  templateStore.markUsed(recommendation.templateId)
  workoutStore.queueStartWorkout(recommendation.templateId, {
    planId: recommendation.planId ?? null,
    planDayId: recommendation.planDayId ?? null
  })
  uni.navigateTo({ url: routes.workoutActive })
}

async function goTrainingHistory() {
  const ok = await ensureFeatureAuth('训练记录')
  if (!ok) return
  uni.navigateTo({ url: `${routes.workoutCalendar}?mode=records` })
}

async function goCalendar() {
  const ok = await ensureFeatureAuth('训练日历')
  if (!ok) return
  uni.navigateTo({ url: routes.workoutCalendar })
}

async function loginForStats() {
  await ensureFeatureAuth('训练数据')
}

async function goTrend() {
  const ok = await ensureFeatureAuth('训练分析')
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
            <view class="home-page__focus-label">今日任务</view>
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
            <view class="home-page__quick-sub">基础数据与深度洞察</view>
          </view>
        </view>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-head">
          <view>
            <view class="home-page__section-no">
              <text class="home-page__section-index">02</text>
              <text class="home-page__section-divider">/</text>
              <text>本周节奏</text>
            </view>
            <view class="home-page__section-title">保持连续，比一次练满更重要</view>
          </view>
          <view class="home-page__link btn-press" @tap="goCalendar">训练日历</view>
        </view>
        <view v-if="!isLoggedIn" class="home-page__week-locked btn-press" @tap="loginForStats">
          <view class="home-page__week-locked-icon">⌁</view>
          <view>
            <view class="home-page__week-locked-title">登录后查看本周训练节奏</view>
            <view class="home-page__week-locked-sub">训练场次、容量和连续训练状态会显示在这里</view>
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
              <text class="home-page__section-index">03</text>
              <text class="home-page__section-divider">/</text>
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
</template>

<style lang="scss" scoped>
@import './index.scss';
</style>
