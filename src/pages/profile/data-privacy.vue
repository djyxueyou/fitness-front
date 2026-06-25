<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { fetchTrainingHistory, type TrainingHistoryItemResponse } from '@/api/training'
import { fetchBodyMetricHistory } from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { trackProductEvent } from '@/utils/product-events'
import { useOnboardingStore } from '@/stores/onboarding'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const onboardingStore = useOnboardingStore()
const busy = ref(false)
const preferenceActionTitle = computed(() =>
  onboardingStore.isCompleted ? '更新训练偏好' : '建立训练偏好'
)
const preferenceActionDescription = computed(() =>
  onboardingStore.isCompleted
    ? '调整目标、经验和训练条件，系统会重新计算推荐，但不会自动关闭或替换当前计划。'
    : '回答目标、经验和训练条件，获得更适合你的起步计划。'
)

onShow(async () => {
  if (!(await ensureFeatureAuth('数据与隐私'))) {
    uni.switchTab({ url: routes.home })
  }
})

function goBack() {
  uni.navigateBack()
}

async function loadAllTrainingRecords() {
  const records: TrainingHistoryItemResponse[] = []
  let pageNo = 1
  let total = 0
  do {
    const page = await fetchTrainingHistory({ pageNo, pageSize: 100 })
    records.push(...page.list)
    total = page.total
    pageNo += 1
  } while (records.length < total)
  return records
}

async function exportData() {
  if (busy.value) return
  busy.value = true
  try {
    const [trainings, bodyMetrics] = await Promise.all([
      loadAllTrainingRecords(),
      fetchBodyMetricHistory({ limit: 90 })
    ])
    const content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        trainingProfile: onboardingStore.profile,
        trainings,
        bodyMetrics: bodyMetrics.items
      },
      null,
      2
    )
    await new Promise<void>((resolve, reject) => {
      uni.setClipboardData({ data: content, success: () => resolve(), fail: reject })
    })
    trackProductEvent('training_data_exported', { trainingCount: trainings.length })
    uni.showToast({ title: '数据已复制', icon: 'none' })
  } catch (err) {
    console.error('[privacy] export failed', err)
    uni.showToast({ title: '导出失败，请重试', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function updateTrainingPreferences() {
  trackProductEvent('training_preferences_edit_started')
  uni.navigateTo({
    url: onboardingStore.isCompleted ? `${routes.onboarding}?edit=1` : routes.onboarding
  })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell privacy safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="数据与隐私" subtitle="管理训练数据与个性化信息" show-back @back="goBack" />

      <view class="privacy__card glass-card">
        <view class="privacy__title">导出我的数据</view>
        <view class="privacy__desc">包含训练记录、身体指标和本地训练画像。当前版本会将 JSON 数据复制到剪贴板。</view>
        <view class="privacy__action btn-press" :class="{ 'privacy__action--disabled': busy }" @tap="exportData">
          {{ busy ? '处理中...' : '复制数据导出' }}
        </view>
      </view>

      <view class="privacy__card glass-card">
        <view class="privacy__title">{{ preferenceActionTitle }}</view>
        <view class="privacy__desc">{{ preferenceActionDescription }}</view>
        <view class="privacy__subtle btn-press" @tap="updateTrainingPreferences">{{ preferenceActionTitle }}</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.privacy {
  &__card { padding: 28rpx; margin-bottom: 20rpx; }
  &__title { color: var(--app-text); font-size: 29rpx; font-weight: 900; }
  &__desc { margin-top: 10rpx; color: var(--app-text-muted); font-size: 23rpx; line-height: 1.65; }
  &__action, &__subtle { margin-top: 24rpx; min-height: 78rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; font-size: 25rpx; font-weight: 900; }
  &__action { color: #fff; background: var(--app-accent); box-shadow: var(--app-shadow-cta); }
  &__subtle { color: var(--app-text-secondary); background: var(--app-surface-subtle); border: 1rpx solid var(--app-border); }
  &__action--disabled { opacity: .5; }
}
</style>
