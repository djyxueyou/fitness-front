<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { fetchTrainingHistory, type TrainingHistoryItemResponse } from '@/api/training'
import { fetchBodyMetricHistory } from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const busy = ref(false)

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
        trainings,
        bodyMetrics: bodyMetrics.items
      },
      null,
      2
    )
    await new Promise<void>((resolve, reject) => {
      uni.setClipboardData({ data: content, success: () => resolve(), fail: reject })
    })
    uni.showToast({ title: '数据已复制', icon: 'none' })
  } catch (err) {
    console.error('[privacy] export failed', err)
    uni.showToast({ title: '导出失败，请重试', icon: 'none' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell privacy safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="数据与隐私" subtitle="管理训练记录与身体指标" show-back @back="goBack" />

      <view class="privacy__card glass-card">
        <view class="privacy__title">导出我的数据</view>
        <view class="privacy__desc"
          >包含训练记录和身体指标。当前版本会将 JSON 数据复制到剪贴板。</view
        >
        <view
          class="privacy__action btn-press"
          :class="{ 'privacy__action--disabled': busy }"
          @tap="exportData"
        >
          {{ busy ? '处理中...' : '复制数据导出' }}
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.privacy {
  &__card {
    padding: 28rpx;
    margin-bottom: 20rpx;
  }
  &__title {
    color: var(--app-text);
    font-size: 29rpx;
    font-weight: 900;
  }
  &__desc {
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
    line-height: 1.65;
  }
  &__action {
    margin-top: 24rpx;
    min-height: 78rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 25rpx;
    font-weight: 900;
  }
  &__action {
    color: #fff;
    background: var(--app-accent);
    box-shadow: var(--app-shadow-cta);
  }
  &__action--disabled {
    opacity: 0.5;
  }
}
</style>
