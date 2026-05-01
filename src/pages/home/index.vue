<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import GlassCard from '@/components/glass-card/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import SectionTitle from '@/components/section-title/index.vue'
import StatCard from '@/components/stat-card/index.vue'
import { getToken } from '@/api/http'
import {
  fetchTrainingHistory,
  fetchTrainingSummary,
  type TrainingHistoryItemResponse,
  type TrainingStatsSummaryResponse
} from '@/api/training'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { offTrainingChanged, onTrainingChanged } from '@/utils/training-events'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import type { Template } from '@/types/template'
import { formatWeight } from '@/utils/unit'
import { formatSeconds } from '@/utils/format'

const profileStore = useProfileStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const summary = ref<TrainingStatsSummaryResponse | null>(null)
const weekHistory = ref<TrainingHistoryItemResponse[]>([])
const recentHistory = ref<TrainingHistoryItemResponse[]>([])

const weightUnit = computed(() => profileStore.unit)
const weekSessions = computed(() => (summary.value ? `${weekHistory.value.length} 次` : '--'))
const totalVolume = computed(() =>
  summary.value
    ? `${formatWeight(summary.value.totalVolumeKg, weightUnit.value, 0)} ${weightUnit.value}`
    : '--'
)
const totalDuration = computed(() =>
  summary.value ? `${Math.round(summary.value.totalDurationSeconds / 60)} min` : '--'
)
const draftSavedText = computed(() => {
  if (!workoutStore.draftSavedAt) return '刚刚保存'
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(workoutStore.draftSavedAt).getTime()) / 1000)
  )
  if (seconds < 60) return '刚刚保存'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前保存`
  return `${Math.floor(seconds / 3600)} 小时前保存`
})
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
const recentTemplates = computed(() => {
  const localItems = templateStore.recentItems
  const localIdSet = new Set(localItems.map((item) => item.id))
  const historyIdSet = new Set<number>()
  const historyItems = recentHistory.value
    .map((record) => (record.templateId ? templateStore.getById(record.templateId) : undefined))
    .filter((item): item is Template => {
      if (!item || localIdSet.has(item.id) || historyIdSet.has(item.id)) return false
      historyIdSet.add(item.id)
      return true
    })

  return [...localItems, ...historyItems].slice(0, 3)
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
  workoutStore.refreshDraftState()
  if (!workoutStore.hasActiveWorkout) {
    workoutStore.restoreDraft()
  }
  loadHomeData()
})

async function refreshAfterAuthChanged() {
  await loadHomeData({ forceTemplates: true })
}

async function refreshAfterTrainingChanged() {
  await loadHomeData({ forceTemplates: true })
}

async function loadHomeData(options?: { forceTemplates?: boolean }) {
  if (!getToken()) {
    summary.value = null
    weekHistory.value = []
    recentHistory.value = []
    return
  }

  if (options?.forceTemplates || !templateStore.loadedFromServer) {
    await templateStore.fetchTemplates({ includeDetails: false }).catch((err) => {
      console.error('[home] template fetch failed', err)
    })
  }

  const range = getCurrentWeekRange()
  fetchTrainingSummary()
    .then((nextSummary) => {
      summary.value = nextSummary
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

async function goSelectTemplate() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout()
  if (!canStart) return
  uni.navigateTo({ url: routes.selectTemplate })
}

async function goCalendar() {
  const ok = await ensureFeatureAuth('训练记录')
  if (!ok) return
  uni.navigateTo({ url: routes.workoutCalendar })
}

async function startWorkout(templateId: number) {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout()
  if (!canStart) return
  templateStore.markUsed(templateId)
  await workoutStore.startWorkout(templateId)
  uni.navigateTo({ url: routes.workoutActive })
}

async function goTemplateDetail(templateId: number) {
  const ok = await ensureFeatureAuth('训练模板')
  if (!ok) return
  uni.navigateTo({ url: `${routes.templateDetail}?id=${templateId}` })
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

async function prepareNewWorkout() {
  workoutStore.refreshDraftState()
  if (!workoutStore.hasRecoverableWorkout) return true

  try {
    const result = await new Promise<UniApp.ShowActionSheetSuccess>((resolve, reject) => {
      uni.showActionSheet({
        itemList: ['继续当前训练', '放弃并重新开始'],
        success: resolve,
        fail: reject
      })
    })

    if (result.tapIndex === 0) {
      if (workoutStore.restoreDraft()) {
        uni.navigateTo({ url: routes.workoutActive })
      }
      return false
    }

    workoutStore.discardWorkout()
    return true
  } catch {
    return false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell tab-page home-page safe-bottom">
      <view class="home-page__hero">
        <view class="eyebrow">LiftLog Daily</view>
        <view class="muted home-page__greeting">今天适合完成一次高质量训练。</view>
        <view class="title-xl">准备开始 <text class="text-gradient-fire">训练</text> 了吗？</view>
        <view class="home-page__hero-sub">选择模板快速开始，或者直接开启自由训练。</view>
      </view>

      <view class="home-page__stats">
        <StatCard icon="🔥" label="本周" :value="weekSessions" />
        <StatCard icon="⚡" label="总量" :value="totalVolume" />
        <StatCard icon="🕒" label="时长" :value="totalDuration" />
      </view>

      <GlassCard>
        <view class="home-page__week-card">
          <view class="space-between">
            <view class="home-page__section-title">本周训练</view>
            <view class="home-page__link" @tap="goCalendar">查看全部</view>
          </view>
          <view class="home-page__week-dots">
            <view v-for="item in weekStats" :key="item.day" class="home-page__week-col">
              <view
                class="home-page__week-dot"
                :class="{ 'home-page__week-dot--trained': item.trained }"
              />
              <view
                class="home-page__week-label"
                :class="{ 'home-page__week-label--today': item.isToday }"
              >
                {{ item.day }}
              </view>
            </view>
          </view>
        </view>
      </GlassCard>

      <view class="home-page__cta">
        <GlassCard v-if="workoutStore.hasRecoverableWorkout" class="home-page__resume-card">
          <view class="home-page__resume-content">
            <view>
              <view class="home-page__resume-title">有一场训练未完成</view>
              <view class="home-page__resume-sub">
                {{ workoutStore.activeTemplateName || '自由训练' }} ·
                {{ formatSeconds(workoutStore.elapsedSeconds) }} · {{ workoutStore.doneSets }}/{{
                  workoutStore.totalSets
                }}
                组 · {{ draftSavedText }}
              </view>
            </view>
            <view class="home-page__resume-btn btn-press" @tap="continueWorkout">继续训练</view>
          </view>
        </GlassCard>
        <PrimaryButton @tap="goSelectTemplate">
          <view class="home-page__cta-inner">
            <view class="home-page__cta-icon">▶</view>
            <view class="home-page__cta-copy">
              <view class="home-page__cta-title">开始训练</view>
              <view class="home-page__cta-sub">选择模板或自由训练</view>
            </view>
            <view class="home-page__cta-arrow">›</view>
          </view>
        </PrimaryButton>
      </view>

      <view class="home-page__section">
        <SectionTitle title="最近使用模板" action-text="全部" @action="goSelectTemplate" />
        <view v-if="recentTemplates.length" class="home-page__list">
          <view
            v-for="item in recentTemplates"
            :key="item.id"
            class="glass-card home-page__recent btn-press"
            @tap="goTemplateDetail(item.id)"
          >
            <view class="home-page__recent-icon">🔥</view>
            <view class="home-page__recent-body">
              <view class="home-page__recent-name">{{ item.name }}</view>
              <view class="home-page__recent-meta">
                {{ item.exercises }} 个动作 · {{ item.duration }} min
              </view>
            </view>
            <view class="home-page__recent-play btn-press" @tap.stop="startWorkout(item.id)"
              >▶</view
            >
          </view>
        </view>
        <view v-else class="glass-card home-page__recent-empty">
          开始一次模板训练后，会显示最近使用模板。
        </view>
      </view>

      <view class="glass-card home-page__calendar-link btn-press" @tap="goCalendar">
        <view class="home-page__calendar-icon">📅</view>
        <view class="home-page__calendar-body">
          <view class="home-page__recent-name">训练日历</view>
          <view class="home-page__recent-meta">查看训练历史和容量趋势</view>
        </view>
        <view class="home-page__cta-arrow">›</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.home-page {
  &__hero {
    margin-bottom: 32rpx;
  }

  &__greeting {
    margin-top: 10rpx;
  }

  &__hero-sub {
    max-width: 560rpx;
    margin-top: 16rpx;
    color: rgba(245, 245, 250, 0.78);
    font-size: 24rpx;
    line-height: 1.7;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-bottom: 24rpx;
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
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.02);

    &--trained {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.35);
    }
  }

  &__week-label {
    color: #828296;
    font-size: 22rpx;

    &--today {
      color: #ff501e;
      font-weight: 700;
    }
  }

  &__cta {
    margin-top: 24rpx;
  }

  &__resume-card {
    display: block;
    margin-bottom: 18rpx;
  }

  &__resume-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    padding: 24rpx;
  }

  &__resume-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__resume-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__resume-btn {
    min-width: 148rpx;
    min-height: 64rpx;
    border-radius: 999rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 800;
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
    font-size: 32rpx;
    font-weight: 700;
    color: #fff;
  }

  &__cta-sub {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.78);
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
</style>
