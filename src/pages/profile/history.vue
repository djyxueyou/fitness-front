<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useTrainingStore } from '@/stores/training'

const trainingStore = useTrainingStore()

const historyList = computed(() => trainingStore.history)

onShow(async () => {
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  trainingStore.fetchHistory()
})

function goBack() {
  uni.navigateBack()
}

function openDetail(id: number) {
  uni.navigateTo({ url: `${routes.historyDetail}?id=${id}` })
}

function formatDate(dateText: string) {
  const date = new Date(dateText)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader
        title="历史记录"
        :subtitle="`共 ${historyList.length} 条记录`"
        show-back
        @back="goBack"
      />
      <view class="history-page__list">
        <view
          v-for="item in historyList"
          :key="item.id"
          class="glass-card history-page__item btn-press"
          @tap="openDetail(item.id)"
        >
          <view class="history-page__icon">🏋</view>
          <view class="history-page__body">
            <view class="history-page__name">{{ item.trainingName }}</view>
            <view class="history-page__meta"
              >{{ formatDate(item.startedAt) }} ·
              {{ Math.round(item.durationSeconds / 60) }} min</view
            >
          </view>
          <view class="history-page__arrow">›</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.history-page {
  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 24rpx;
  }

  &__icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 80, 30, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    flex: 1;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__arrow {
    color: #828296;
    font-size: 32rpx;
  }
}
</style>
