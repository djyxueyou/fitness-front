<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import PrimaryButton from '@/components/primary-button/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
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
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { formatCompactWeight } from '@/utils/unit'

const profileStore = useProfileStore()
const planStore = usePlanStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
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
const recentTrainingRecords = computed(() => recentHistory.value.slice(0, 3))
const hasActivePlan = computed(() => Boolean(planStore.activePlan))
const recommendationType = computed(() => planStore.recommendation?.type || '')
const todayDateLabel = computed(() => {
  const today = new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()]
  return `今天 · ${weekday}`
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
  if (!hasActivePlan.value) return '先选一个训练计划'
  if (recommendationType.value === 'PLAN_TODAY') return '今天有计划训练'
  if (recommendationType.value === 'PLAN_PENDING') return '有计划需要补训'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '今日训练已完成'
  if (recommendationType.value === 'PLAN_COMPLETED') return '本周计划已完成'
  if (recommendationType.value === 'PLAN_REST') return '今天适合灵活安排'
  return '安排一次有效训练'
})
const todayActionSub = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '恢复未完成训练'
  if (!hasActivePlan.value) return '启用计划后推荐训练日'
  if (hasPlanRecommendation.value) return '按计划完成后计入进度'
  if (recommendationType.value === 'PLAN_TODAY_COMPLETED') return '可以自由训练，或查看后续安排'
  if (recommendationType.value === 'PLAN_COMPLETED') return '可以自由训练，或查看下周安排'
  if (recommendationType.value === 'PLAN_REST') return '今天没有固定计划训练'
  return '查看当前计划安排'
})
const primaryCtaTitle = computed(() => {
  if (workoutStore.hasRecoverableWorkout) return '继续训练'
  if (hasPlanRecommendation.value) return '开始今日计划'
  if (!hasActivePlan.value) return '选择训练计划'
  if (recommendationType.value === 'PLAN_REST') return '查看本周安排'
  return '查看当前计划'
})
const todayActionLabel = computed(() => {
  return todayPlanStatusLabel.value
})
const recommendationTitle = computed(
  () =>
    planStore.recommendation?.title ||
    planStore.recommendation?.planName ||
    planStore.activePlan?.name ||
    '自由安排训练'
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
    await fetchUserProfile()
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

async function loginForStats() {
  await ensureFeatureAuth('训练数据')
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
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell tab-page home-page safe-bottom">
      <view class="home-page__hero">
        <view class="home-page__hero-copy">
          <view class="home-page__hero-date">{{ todayDateLabel }}</view>
          <view class="home-page__hero-title">{{ homeHeroTitle }}</view>
        </view>
        <view class="home-page__readiness">
          <view class="home-page__readiness-dot" />
          <text>{{ todayActionLabel }}</text>
        </view>
      </view>

      <view class="home-page__focus-card">
        <view class="home-page__focus-topline">
          <view class="home-page__focus-label">今日主任务</view>
          <view class="home-page__focus-index">01</view>
        </view>
        <view class="home-page__focus-title">{{ recommendationTitle }}</view>
        <view class="home-page__focus-sub">{{ todayActionSub }}</view>
        <view class="home-page__focus-action">
          <PrimaryButton @tap="handlePrimaryCta">
            <view class="home-page__cta-inner">
              <view class="home-page__cta-copy">
                <view class="home-page__cta-kicker">下一步</view>
                <view class="home-page__cta-title">{{ primaryCtaTitle }}</view>
              </view>
              <view class="home-page__cta-arrow">→</view>
            </view>
          </PrimaryButton>
        </view>
        <view class="home-page__quick-actions">
          <view class="home-page__quick-action btn-press" @tap="goSelectTemplate">
            <view class="home-page__quick-no">A</view>
            <view class="home-page__quick-copy">
              <view class="home-page__quick-title">选模板</view>
              <view class="home-page__quick-sub">按熟悉方案练</view>
            </view>
          </view>
          <view class="home-page__quick-action btn-press" @tap="startFreeWorkout">
            <view class="home-page__quick-no">B</view>
            <view class="home-page__quick-copy">
              <view class="home-page__quick-title">自由练</view>
              <view class="home-page__quick-sub">立即开始记录</view>
            </view>
          </view>
          <view class="home-page__quick-action btn-press" @tap="goTrend">
            <view class="home-page__quick-no">C</view>
            <view class="home-page__quick-copy">
              <view class="home-page__quick-title">看分析</view>
              <view class="home-page__quick-sub">回顾训练变化</view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!isLoggedIn" class="home-page__login-hint">
        <view>
          <view class="home-page__login-title">登录后保存每次进步</view>
          <view class="home-page__login-sub">训练数据、计划进度和历史记录会自动同步。</view>
        </view>
        <view class="home-page__login-btn btn-press" @tap="loginForStats">登录</view>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-head">
          <view>
            <view class="home-page__section-no">02 / 本周节奏</view>
            <view class="home-page__section-title">保持连续，比一次练满更重要</view>
          </view>
          <view class="home-page__link btn-press" @tap="goCalendar">训练日历</view>
        </view>
        <view class="home-page__week-panel">
          <view class="home-page__stats">
            <view class="home-page__stat">
              <view class="home-page__stat-label">训练次数</view>
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
            <view class="home-page__section-no">03 / 最近完成</view>
            <view class="home-page__section-title">从上一次继续进步</view>
          </view>
          <view class="home-page__link btn-press" @tap="goTrainingHistory">全部记录</view>
        </view>
        <view v-if="recentTrainingRecords.length" class="home-page__list">
          <view
            v-for="item in recentTrainingRecords"
            :key="item.id"
            class="home-page__recent btn-press"
            @tap="goHistoryDetail(item.id)"
          >
            <view class="home-page__recent-date">{{ formatRecentDate(item.startedAt) }}</view>
            <view class="home-page__recent-body">
              <view class="home-page__recent-name">{{ item.trainingName }}</view>
              <view class="home-page__recent-meta">
                {{ Math.round(item.durationSeconds / 60) }} min · {{ item.totalSetCount }} 组 ·
                {{ formatCompactWeight(Number(item.totalVolumeKg || 0), weightUnit) }}
                {{ weightUnit }}
              </view>
            </view>
            <view class="home-page__recent-arrow">→</view>
          </view>
        </view>
        <view v-else class="home-page__recent-empty">
          <view class="home-page__empty-mark">0</view>
          <view>
            <view class="home-page__empty-title">还没有训练记录</view>
            <view class="home-page__empty-sub">完成第一次训练后，这里会形成你的进步轨迹。</view>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
  <WorkoutDraftFab @open="openDraftFab" />
  <WorkoutDraftPrompt />
</template>

<style lang="scss" scoped>
.home-page {
  &__hero {
    margin-bottom: 22rpx;
  }

  &__hero-date {
    color: #a0a0b4;
    font-size: 28rpx;
    font-weight: 700;
  }

  &__hero-title {
    margin-top: 8rpx;
    line-height: 1.15;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__login-hint {
    margin-bottom: 24rpx;
    padding: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__login-title {
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__login-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__login-btn {
    min-width: 112rpx;
    min-height: 56rpx;
    border-radius: 999rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 800;
  }

  &__week-card {
    padding: 30rpx;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__link {
    color: #ff501e;
    font-size: 22rpx;
  }

  &__week-dots {
    display: flex;
    gap: 12rpx;
    align-items: flex-start;
    margin-top: 28rpx;
  }

  &__week-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
  }

  &__week-dot {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;

    &--trained {
      background: linear-gradient(135deg, #ff501e, #ff8c00);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.6);
    }
  }

  &__week-label {
    color: #828296;
    font-size: 22rpx;
    font-weight: 500;

    &--today {
      color: #ff501e;
      font-weight: 800;
      text-shadow: 0 0 10rpx rgba(255, 80, 30, 0.3);
    }
  }

  &__today-card {
    padding: 26rpx;
  }

  &__today-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20rpx;
    margin-bottom: 22rpx;
  }

  &__today-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__quick-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14rpx;
    margin-top: 16rpx;
  }

  &__quick-action {
    min-height: 70rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 800;
  }

  &__quick-action:nth-child(1) {
    border-color: rgba(255, 80, 30, 0.24);
    color: #ff9b58;
  }

  &__quick-icon {
    width: 34rpx;
    height: 34rpx;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    line-height: 1;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);

    &--template {
      color: #ff9b58;
      background: rgba(255, 80, 30, 0.14);
      box-shadow: 0 0 16rpx rgba(255, 80, 30, 0.18);
    }

    &--free {
      color: #ffd7a8;
      background: rgba(255, 140, 0, 0.13);
    }

    &--analysis {
      color: #9adfff;
      background: rgba(53, 217, 255, 0.12);
    }
  }

  &__plan-summary {
    margin-bottom: 16rpx;
    padding: 22rpx;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.07);
  }

  &__plan-summary-main {
    min-width: 0;
  }

  &__plan-summary-label {
    color: #ff9b58;
    font-size: 21rpx;
    font-weight: 800;
  }

  &__plan-summary-title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
    line-height: 1.35;
  }

  &__plan-summary-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.5;
  }

  &__plan {
    padding: 26rpx;
  }

  &__plan-head,
  &__plan-body,
  &__plan-actions {
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__plan-head {
    justify-content: space-between;
  }

  &__plan-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__plan-body {
    margin-top: 24rpx;
  }

  &__plan-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    background: rgba(255, 80, 30, 0.16);
    color: #ff7a32;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__plan-copy {
    flex: 1;
    min-width: 0;
  }

  &__plan-title {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__plan-desc {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.5;
  }

  &__plan-reason {
    margin-top: 8rpx;
    color: #ff9b58;
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__plan-actions {
    margin-top: 22rpx;
  }

  &__plan-btn {
    min-height: 64rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #f5f5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23rpx;
    font-weight: 900;

    &--primary {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
    }
  }

  &__cta-inner {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__cta-icon,
  &__recent-play,
  &__calendar-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__cta-icon {
    background: rgba(255, 255, 255, 0.2);
    font-size: 26rpx;
  }

  &__cta-copy {
    flex: 1;
  }

  &__cta-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #fff;
  }

  &__cta-arrow {
    font-size: 32rpx;
    color: #828296;
  }

  &__section {
    margin-top: 40rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__recent,
  &__calendar-link,
  &__recent-empty {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx;
  }

  &__recent-empty {
    color: #828296;
    font-size: 24rpx;
  }

  &__recent-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.15);
  }

  &__recent-body,
  &__calendar-body {
    flex: 1;
  }

  &__recent-name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__recent-meta {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__recent-play {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-size: 24rpx;
  }

  &__calendar-link {
    margin-top: 24rpx;
  }

  &__calendar-icon {
    background: rgba(80, 200, 255, 0.16);
  }
}

.home-page {
  background:
    radial-gradient(circle at 92% 2%, rgba(255, 80, 30, 0.2), transparent 34%),
    linear-gradient(180deg, #09090d 0%, #050508 48%);

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24rpx;
    margin: 8rpx 0 34rpx;
  }

  &__hero-copy {
    min-width: 0;
  }

  &__hero-date,
  &__focus-label,
  &__section-no {
    color: #ff9358;
    font-size: 21rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
  }

  &__hero-title {
    max-width: 520rpx;
    margin-top: 12rpx;
    color: #fff;
    font-size: 48rpx;
    font-weight: 900;
    line-height: 1.12;
  }

  &__readiness {
    min-height: 54rpx;
    padding: 0 18rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.1);
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.045);
    color: #b8b8c6;
    display: flex;
    align-items: center;
    gap: 10rpx;
    font-size: 20rpx;
    font-weight: 800;
    white-space: nowrap;
  }

  &__readiness-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background: #ff6a2a;
    box-shadow: 0 0 18rpx rgba(255, 80, 30, 0.8);
  }

  &__focus-card {
    position: relative;
    overflow: hidden;
    padding: 34rpx;
    border: 1rpx solid rgba(255, 116, 54, 0.28);
    border-radius: 36rpx;
    background:
      linear-gradient(145deg, rgba(255, 89, 31, 0.18), rgba(255, 255, 255, 0.035) 48%), #111116;
    box-shadow: 0 28rpx 80rpx rgba(0, 0, 0, 0.28);

    &::after {
      content: '';
      position: absolute;
      width: 260rpx;
      height: 260rpx;
      right: -120rpx;
      top: -120rpx;
      border: 44rpx solid rgba(255, 100, 40, 0.08);
      border-radius: 50%;
      pointer-events: none;
    }
  }

  &__focus-topline,
  &__section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24rpx;
  }

  &__focus-index {
    color: rgba(255, 255, 255, 0.18);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__focus-title {
    position: relative;
    z-index: 1;
    margin-top: 34rpx;
    color: #fff;
    font-size: 42rpx;
    font-weight: 900;
    line-height: 1.15;
  }

  &__focus-sub {
    position: relative;
    z-index: 1;
    margin-top: 12rpx;
    color: #9d9dac;
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__focus-action {
    position: relative;
    z-index: 1;
    margin-top: 30rpx;
  }

  &__login-hint {
    margin: 20rpx 0 0;
    padding: 24rpx 26rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.075);
    border-radius: 26rpx;
    background: rgba(255, 255, 255, 0.035);
  }

  &__login-btn {
    min-height: 62rpx;
    background: #fff;
    color: #111116;
  }

  &__quick-actions {
    position: relative;
    z-index: 1;
    gap: 12rpx;
    margin-top: 18rpx;
  }

  &__quick-action {
    min-width: 0;
    min-height: 98rpx;
    padding: 16rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.075);
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.04);
    justify-content: flex-start;
    gap: 12rpx;
  }

  &__quick-no {
    width: 38rpx;
    height: 38rpx;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 120, 58, 0.13);
    color: #ff9358;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19rpx;
    font-weight: 900;
  }

  &__quick-copy {
    min-width: 0;
  }

  &__quick-title {
    color: #f5f5fa;
    font-size: 22rpx;
    font-weight: 900;
    white-space: nowrap;
  }

  &__quick-sub {
    overflow: hidden;
    margin-top: 5rpx;
    color: #777786;
    font-size: 18rpx;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__section {
    margin-top: 52rpx;
  }

  &__section-title {
    max-width: 460rpx;
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
    line-height: 1.35;
  }

  &__link {
    padding-top: 4rpx;
    color: #ff9358;
    font-weight: 800;
    white-space: nowrap;
  }

  &__week-panel {
    margin-top: 22rpx;
    padding: 30rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.075);
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.035);
  }

  &__stats {
    gap: 0;
    margin-top: 0;
  }

  &__stat {
    min-width: 0;
    padding: 0 22rpx;
    border-right: 1rpx solid rgba(255, 255, 255, 0.075);

    &:first-child {
      padding-left: 0;
    }

    &:last-child {
      padding-right: 0;
      border-right: 0;
    }
  }

  &__stat-label {
    color: #797988;
    font-size: 20rpx;
    font-weight: 700;
  }

  &__stat-value {
    overflow: hidden;
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 29rpx;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__week-dots {
    position: relative;
    gap: 0;
    margin-top: 34rpx;

    &::before {
      content: '';
      position: absolute;
      left: 7%;
      right: 7%;
      top: 19rpx;
      height: 2rpx;
      background: rgba(255, 255, 255, 0.08);
    }
  }

  &__week-dot {
    position: relative;
    z-index: 1;
    width: 40rpx;
    height: 40rpx;
    background: #19191f;
    border: 2rpx solid rgba(255, 255, 255, 0.12);

    &--trained {
      background: #ff6125;
      border-color: #ff8b55;
      box-shadow: 0 0 22rpx rgba(255, 80, 30, 0.42);
    }

    &--today {
      outline: 5rpx solid rgba(255, 80, 30, 0.12);
    }
  }

  &__week-check {
    width: 10rpx;
    height: 16rpx;
    margin: 8rpx auto 0;
    border-right: 3rpx solid #fff;
    border-bottom: 3rpx solid #fff;
    transform: rotate(45deg);
  }

  &__cta-inner {
    justify-content: space-between;
    gap: 20rpx;
  }

  &__cta-kicker {
    color: rgba(255, 255, 255, 0.7);
    font-size: 18rpx;
    font-weight: 800;
    letter-spacing: 2rpx;
  }

  &__cta-title {
    margin-top: 4rpx;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__cta-arrow {
    width: 58rpx;
    height: 58rpx;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__list {
    gap: 0;
    margin-top: 22rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  }

  &__recent {
    min-height: 112rpx;
    padding: 20rpx 0;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
  }

  &__recent-date {
    width: 74rpx;
    height: 74rpx;
    flex-shrink: 0;
    border-radius: 22rpx;
    background: rgba(255, 98, 37, 0.12);
    color: #ff9358;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 18rpx;
    font-weight: 900;
  }

  &__recent-body {
    min-width: 0;
  }

  &__recent-name {
    overflow: hidden;
    color: #f5f5fa;
    font-size: 27rpx;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__recent-meta {
    color: #777786;
  }

  &__recent-arrow {
    color: #ff9358;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__recent-empty {
    margin-top: 22rpx;
    padding: 30rpx;
    border: 1rpx dashed rgba(255, 255, 255, 0.13);
    border-radius: 28rpx;
    background: rgba(255, 255, 255, 0.025);
  }

  &__empty-mark {
    width: 64rpx;
    height: 64rpx;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2rpx solid rgba(255, 147, 88, 0.35);
    color: #ff9358;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__empty-title {
    color: #f5f5fa;
    font-size: 25rpx;
    font-weight: 900;
  }

  &__empty-sub {
    margin-top: 7rpx;
    color: #777786;
    font-size: 21rpx;
    line-height: 1.45;
  }
}

@media screen and (max-width: 420px) {
  .home-page {
    &__hero {
      align-items: flex-end;
    }

    &__hero-title {
      font-size: 42rpx;
    }

    &__readiness {
      padding: 0 14rpx;
      font-size: 18rpx;
    }

    &__focus-card {
      padding: 28rpx;
    }

    &__quick-actions {
      grid-template-columns: 1fr;
    }

    &__quick-action {
      min-height: 76rpx;
    }

    &__stat {
      padding: 0 14rpx;
    }

    &__stat-value {
      font-size: 25rpx;
    }
  }
}
</style>
