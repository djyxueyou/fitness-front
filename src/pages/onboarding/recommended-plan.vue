<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { fetchPlanActivationOptions, type TrainingPlanDetailResponse } from '@/api/plan'
import { routes } from '@/utils/navigation'
import { trackProductEvent } from '@/utils/product-events'
import { useOnboardingStore } from '@/stores/onboarding'
import { usePlanStore } from '@/stores/plan'
import { useThemeStore } from '@/stores/theme'

const onboardingStore = useOnboardingStore()
const planStore = usePlanStore()
const themeStore = useThemeStore()
const detail = ref<TrainingPlanDetailResponse | null>(null)
const loading = ref(true)
const activating = ref(false)
const weekOneDays = computed(() => (detail.value?.days || []).filter((day) => day.weekIndex === 1))
const isCurrentPlan = computed(() => planStore.activePlan?.id === detail.value?.id)
const hasDifferentActivePlan = computed(
  () => Boolean(planStore.activePlan && detail.value && planStore.activePlan.id !== detail.value.id)
)

onShow(loadRecommendation)

async function loadRecommendation() {
  loading.value = true
  try {
    await planStore.fetchPlans({ force: true })
    const serverRecommendation = await onboardingStore.recommend()
    const recommended = planStore.systemPlans.find(
      (plan) => plan.id === serverRecommendation?.planId
    )
    if (!recommended) return
    detail.value = await planStore.getDetail(recommended.id, true)
    trackProductEvent('recommended_plan_viewed', { planId: recommended.id })
  } catch (err) {
    console.error('[onboarding] recommendation load failed', err)
    uni.showToast({ title: '推荐计划加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function activate() {
  if (!detail.value || activating.value) return
  if (isCurrentPlan.value) {
    uni.showToast({ title: '当前计划已经启用', icon: 'none' })
    return
  }
  if (hasDifferentActivePlan.value) {
    uni.showModal({
      title: '切换当前计划？',
      content: `更新训练偏好不会自动替换计划。确认后将从“${planStore.activePlan?.name}”切换为“${detail.value.name}”，历史训练记录会保留。`,
      confirmText: '确认切换',
      success: (result) => {
        if (result.confirm) performActivate()
      }
    })
    return
  }
  await performActivate()
}

async function performActivate() {
  if (!detail.value || activating.value) return
  activating.value = true
  try {
    const options = await fetchPlanActivationOptions(detail.value.id)
    const mode = options.find((option) => option.recommended)?.mode || 'THIS_WEEK'
    await planStore.activate(detail.value.id, mode)
    trackProductEvent('recommended_plan_activated', { planId: detail.value.id, mode })
    uni.showToast({ title: '计划已启用', icon: 'none' })
    setTimeout(() => uni.switchTab({ url: routes.home }), 450)
  } catch (err) {
    console.error('[onboarding] activate recommended plan failed', err)
    uni.showToast({ title: '启用失败，请重试', icon: 'none' })
  } finally {
    activating.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function goPlans() {
  uni.switchTab({ url: routes.planIndex })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell recommendation safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="为你推荐" subtitle="根据训练画像匹配的起步计划" show-back @back="goBack" />
      <view v-if="loading" class="recommendation__state glass-card">正在匹配适合你的计划...</view>
      <template v-else-if="detail">
        <view class="recommendation__hero">
          <view class="recommendation__tag">首选计划</view>
          <view class="recommendation__title">{{ detail.name }}</view>
          <view class="recommendation__meta">{{ detail.cycleWeeks }} 周 · {{ detail.days.length }} 个训练日</view>
          <view class="recommendation__reasons">
            <view v-for="reason in onboardingStore.profile.recommendationReasons" :key="reason" class="recommendation__reason">
              <text>✓</text><text>{{ reason }}</text>
            </view>
          </view>
        </view>
        <view class="recommendation__section">
          <view class="section-heading">
            <view class="section-title">第 1 周会这样开始</view>
          </view>
          <view class="recommendation__days">
            <view v-for="day in weekOneDays" :key="day.id" class="recommendation__day">
              <view class="recommendation__day-index">周{{ ['日','一','二','三','四','五','六'][day.dayOfWeek] }}</view>
              <view>
                <view class="recommendation__day-title">{{ day.title }}</view>
                <view class="recommendation__day-sub">{{ day.templateName || '计划训练' }}</view>
              </view>
            </view>
          </view>
        </view>
        <view class="recommendation__note">推荐是起点，不是限制。启用后可在计划页查看完整安排。</view>
        <view v-if="hasDifferentActivePlan" class="recommendation__active-note">
          当前计划“{{ planStore.activePlan?.name }}”仍在使用。更新偏好不会自动替换，切换前会再次确认。
        </view>
        <view class="bottom-action-bar">
          <PrimaryButton
            :loading="activating"
            :disabled="isCurrentPlan"
            :text="isCurrentPlan ? '当前计划已启用' : hasDifferentActivePlan ? '切换为推荐计划' : '启用推荐计划'"
            @tap="activate"
          />
          <view class="recommendation__browse btn-press" @tap="goPlans">先看看其他计划</view>
        </view>
      </template>
      <view v-else class="recommendation__state glass-card">
        <view>暂时没有可推荐的系统计划</view>
        <view class="recommendation__browse" @tap="goPlans">前往计划页</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.recommendation {
  &__state { padding: 40rpx; color: var(--app-text-secondary); text-align: center; }
  &__hero { padding: 34rpx; border-radius: 38rpx; background: linear-gradient(145deg, var(--app-surface-warm), var(--app-accent-soft)); border: 1rpx solid rgba(255,100,24,.2); box-shadow: var(--app-shadow-focus); }
  &__tag { display: inline-flex; padding: 10rpx 18rpx; border-radius: 99rpx; color: var(--app-accent); background: var(--app-surface); font-size: 21rpx; font-weight: 900; }
  &__title { margin-top: 24rpx; color: var(--app-text); font-size: 46rpx; font-weight: 900; }
  &__meta, &__day-sub, &__note { color: var(--app-text-muted); font-size: 23rpx; }
  &__meta { margin-top: 10rpx; }
  &__reasons { margin-top: 28rpx; padding: 22rpx; border-radius: 26rpx; background: var(--app-surface); }
  &__reason { display: flex; gap: 14rpx; color: var(--app-text-secondary); font-size: 24rpx; line-height: 1.7; }
  &__reason text:first-child { color: var(--app-success); font-weight: 900; }
  &__section { margin-top: 28rpx; }
  &__days { display: grid; gap: 14rpx; }
  &__day { display: flex; align-items: center; gap: 20rpx; padding: 22rpx; border-radius: 26rpx; background: var(--app-surface); border: 1rpx solid var(--app-border); box-shadow: var(--app-shadow-card); }
  &__day-index { min-width: 80rpx; color: var(--app-accent); font-size: 23rpx; font-weight: 900; }
  &__day-title { color: var(--app-text); font-size: 27rpx; font-weight: 900; }
  &__day-sub { margin-top: 6rpx; }
  &__note { margin: 26rpx 8rpx 0; line-height: 1.6; }
  &__active-note { margin-top: 18rpx; padding: 20rpx; border-radius: 22rpx; color: var(--app-warning); background: var(--app-warning-soft); font-size: 22rpx; line-height: 1.6; }
  &__browse { margin-top: 18rpx; padding: 16rpx; text-align: center; color: var(--app-text-secondary); font-size: 24rpx; font-weight: 800; }
}
</style>
