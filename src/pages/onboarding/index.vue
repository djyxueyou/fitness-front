<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { trackProductEvent } from '@/utils/product-events'
import { useOnboardingStore } from '@/stores/onboarding'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'

const onboardingStore = useOnboardingStore()
const profileStore = useProfileStore()
const themeStore = useThemeStore()
const currentStep = computed(() => onboardingStore.profile.currentStep)
const editing = computed(() => onboardingStore.isCompleted)

const goalOptions = [
  { value: 'GENERAL_FITNESS', title: '建立规律', desc: '提升体能，先稳定开始' },
  { value: 'MUSCLE_GAIN', title: '增肌塑形', desc: '提高训练容量与肌肉刺激' },
  { value: 'STRENGTH', title: '提升力量', desc: '围绕核心动作稳步进阶' },
  { value: 'FAT_LOSS', title: '减脂燃脂', desc: '兼顾消耗与力量训练' }
] as const
const levelOptions = [
  { value: 'BEGINNER', title: '刚开始', desc: '需要清晰、易执行的安排' },
  { value: 'INTERMEDIATE', title: '有些经验', desc: '能独立完成常见动作' },
  { value: 'ADVANCED', title: '长期训练', desc: '希望更系统地推进表现' }
] as const
const environmentOptions = [
  { value: 'FULL_GYM', title: '健身房', desc: '器械相对完整' },
  { value: 'HOME_BASIC', title: '居家基础器械', desc: '哑铃、弹力带等' },
  { value: 'BODYWEIGHT_ONLY', title: '徒手训练', desc: '暂时不依赖器械' }
] as const

onLoad((options) => {
  if (options?.edit === '1') {
    onboardingStore.beginEdit()
  }
})

onShow(async () => {
  if (!(await ensureFeatureAuth('训练画像'))) {
    uni.switchTab({ url: routes.home })
    return
  }
  await profileStore.refreshProfile()
  onboardingStore.ensureOwner(profileStore.userId)
  try {
    await onboardingStore.loadFromServer()
  } catch (err) {
    console.warn('[onboarding] server profile load failed, local draft retained', err)
  }
  trackProductEvent('onboarding_viewed', { step: currentStep.value + 1 })
})

function choose(field: string, value: string | number) {
  onboardingStore.update({ [field]: value } as never)
}

function toggleLimitation(value: string) {
  const current = onboardingStore.profile.limitations
  onboardingStore.update({
    limitations: current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
  })
}

async function next() {
  if (currentStep.value < 2) {
    trackProductEvent('onboarding_step_completed', { step: currentStep.value + 1 })
    onboardingStore.update({ currentStep: currentStep.value + 1 })
    try {
      await onboardingStore.saveToServer(false)
    } catch (err) {
      console.warn('[onboarding] draft sync failed, local draft retained', err)
    }
    return
  }
  finish()
}

async function finish() {
  const wasEditing = editing.value
  if (wasEditing) {
    onboardingStore.completeEdit()
  } else {
    onboardingStore.complete()
  }
  try {
    await onboardingStore.saveToServer(true)
  } catch (err) {
    console.warn('[onboarding] training profile sync failed, local profile retained', err)
    uni.showToast({ title: '训练偏好保存失败，请重试', icon: 'none' })
    return
  }
  try {
    await profileStore.saveProfile({
      nickname: profileStore.nickname,
      avatarUrl: profileStore.avatarUrl,
      heightCm: profileStore.heightCm,
      trainingGoal: onboardingStore.profile.goal,
      experienceLevel: onboardingStore.profile.experienceLevel
    })
  } catch (err) {
    console.warn('[onboarding] profile sync failed, local profile retained', err)
  }
  trackProductEvent(wasEditing ? 'training_preferences_updated' : 'onboarding_completed', {
    goal: onboardingStore.profile.goal,
    sessionsPerWeek: onboardingStore.profile.sessionsPerWeek
  })
  uni.redirectTo({ url: routes.recommendedPlan })
}

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell onboarding safe-bottom" :class="themeStore.themeClass">
      <AppHeader
        :title="editing ? '更新训练偏好' : '建立训练画像'"
        :subtitle="editing ? '调整后会重新计算推荐，不会自动替换当前计划' : '30 秒，让计划更适合你'"
        show-back
        @back="goBack"
      />

      <view class="onboarding__progress">
        <view
          v-for="step in 3"
          :key="step"
          class="onboarding__progress-item"
          :class="{ 'onboarding__progress-item--active': step - 1 <= currentStep }"
        />
      </view>

      <view v-if="currentStep === 0" class="onboarding__section">
        <view class="onboarding__eyebrow">01 · 目标</view>
        <view class="onboarding__title">你现在最想获得什么？</view>
        <view class="onboarding__desc">只选当前最重要的一项，之后随时可以调整。</view>
        <view class="onboarding__grid">
          <view
            v-for="option in goalOptions"
            :key="option.value"
            class="onboarding__option btn-press"
            :class="{ 'onboarding__option--active': onboardingStore.profile.goal === option.value }"
            @tap="choose('goal', option.value)"
          >
            <view class="onboarding__option-title">{{ option.title }}</view>
            <view class="onboarding__option-desc">{{ option.desc }}</view>
          </view>
        </view>
      </view>

      <view v-else-if="currentStep === 1" class="onboarding__section">
        <view class="onboarding__eyebrow">02 · 节奏</view>
        <view class="onboarding__title">怎样安排更容易坚持？</view>
        <view class="onboarding__label">训练经验</view>
        <view class="onboarding__stack">
          <view
            v-for="option in levelOptions"
            :key="option.value"
            class="onboarding__option onboarding__option--row btn-press"
            :class="{
              'onboarding__option--active': onboardingStore.profile.experienceLevel === option.value
            }"
            @tap="choose('experienceLevel', option.value)"
          >
            <view>
              <view class="onboarding__option-title">{{ option.title }}</view>
              <view class="onboarding__option-desc">{{ option.desc }}</view>
            </view>
            <view class="onboarding__check">✓</view>
          </view>
        </view>
        <view class="onboarding__label">每周训练次数</view>
        <view class="onboarding__chips">
          <view
            v-for="count in [2, 3, 4, 5]"
            :key="count"
            class="onboarding__chip btn-press"
            :class="{
              'onboarding__chip--active': onboardingStore.profile.sessionsPerWeek === count
            }"
            @tap="choose('sessionsPerWeek', count)"
            >{{ count }} 次</view
          >
        </view>
        <view class="onboarding__label">单次可用时间</view>
        <view class="onboarding__chips">
          <view
            v-for="minutes in [30, 45, 60, 75]"
            :key="minutes"
            class="onboarding__chip btn-press"
            :class="{
              'onboarding__chip--active': onboardingStore.profile.sessionDurationMinutes === minutes
            }"
            @tap="choose('sessionDurationMinutes', minutes)"
            >{{ minutes }} 分钟</view
          >
        </view>
      </view>

      <view v-else class="onboarding__section">
        <view class="onboarding__eyebrow">03 · 条件</view>
        <view class="onboarding__title">你通常在哪里训练？</view>
        <view class="onboarding__stack">
          <view
            v-for="option in environmentOptions"
            :key="option.value"
            class="onboarding__option onboarding__option--row btn-press"
            :class="{
              'onboarding__option--active': onboardingStore.profile.environment === option.value
            }"
            @tap="choose('environment', option.value)"
          >
            <view>
              <view class="onboarding__option-title">{{ option.title }}</view>
              <view class="onboarding__option-desc">{{ option.desc }}</view>
            </view>
            <view class="onboarding__check">✓</view>
          </view>
        </view>
        <view class="onboarding__label">需要避开的部位（可选）</view>
        <view class="onboarding__chips">
          <view
            v-for="item in ['膝部', '腰背', '肩部']"
            :key="item"
            class="onboarding__chip btn-press"
            :class="{
              'onboarding__chip--active': onboardingStore.profile.limitations.includes(item)
            }"
            @tap="toggleLimitation(item)"
            >{{ item }}</view
          >
        </view>
      </view>

      <view class="bottom-action-bar onboarding__actions">
        <view
          v-if="currentStep > 0"
          class="onboarding__back btn-press"
          @tap="onboardingStore.update({ currentStep: currentStep - 1 })"
          >上一步</view
        >
        <PrimaryButton :text="currentStep === 2 ? '查看更新后的推荐' : '继续'" @tap="next" />
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.onboarding {
  &__progress {
    display: flex;
    gap: 10rpx;
    margin: 8rpx 0 34rpx;
  }
  &__progress-item {
    height: 8rpx;
    flex: 1;
    border-radius: 99rpx;
    background: var(--app-border);
  }
  &__progress-item--active {
    background: var(--app-accent);
  }
  &__section {
    padding: 30rpx;
    border-radius: 36rpx;
    background: var(--app-surface);
    border: 1rpx solid var(--app-border);
    box-shadow: var(--app-shadow-card);
  }
  &__eyebrow {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 800;
  }
  &__title {
    margin-top: 12rpx;
    color: var(--app-text);
    font-size: 40rpx;
    font-weight: 900;
    line-height: 1.25;
  }
  &__desc,
  &__option-desc {
    color: var(--app-text-muted);
    font-size: 23rpx;
    line-height: 1.5;
  }
  &__desc {
    margin-top: 10rpx;
  }
  &__grid,
  &__stack {
    margin-top: 28rpx;
    display: grid;
    gap: 16rpx;
  }
  &__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  &__option {
    min-height: 150rpx;
    padding: 24rpx;
    border-radius: 26rpx;
    background: var(--app-surface-subtle);
    border: 2rpx solid transparent;
  }
  &__option--row {
    min-height: 110rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  &__option--active {
    background: var(--app-accent-soft);
    border-color: var(--app-accent);
  }
  &__option-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
  }
  &__option-desc {
    margin-top: 8rpx;
  }
  &__check {
    color: var(--app-accent);
    font-size: 30rpx;
    opacity: 0;
  }
  &__option--active &__check {
    opacity: 1;
  }
  &__label {
    margin-top: 30rpx;
    color: var(--app-text-secondary);
    font-size: 23rpx;
    font-weight: 800;
  }
  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 14rpx;
  }
  &__chip {
    min-width: 120rpx;
    padding: 18rpx 24rpx;
    text-align: center;
    border-radius: 999rpx;
    color: var(--app-text-secondary);
    background: var(--app-surface-subtle);
    border: 1rpx solid var(--app-border);
    font-size: 24rpx;
    font-weight: 800;
  }
  &__chip--active {
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border-color: var(--app-accent);
  }
  &__actions {
    display: flex;
    gap: 16rpx;
  }
  &__back {
    width: 170rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    font-size: 25rpx;
    font-weight: 800;
  }
}
</style>
