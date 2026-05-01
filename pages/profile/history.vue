<script setup lang="ts">
import AppHeader from '@/components/app-header/index.vue'
import { historyList } from '@/mock/history'
import { routes } from '@/utils/navigation'

function goBack() {
  uni.navigateBack()
}

function openDetail(date: string) {
  uni.navigateTo({ url: `${routes.historyDetail}?date=${date}` })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="历史记录" :subtitle="`共 ${historyList.length} 条记录`" show-back @back="goBack" />
      <view class="history-page__list">
        <view v-for="item in historyList" :key="item.date" class="glass-card history-page__item btn-press" @tap="openDetail(item.date)">
          <view class="history-page__icon">🔥</view>
          <view class="history-page__body">
            <view class="history-page__name">{{ item.name }}</view>
            <view class="history-page__meta">{{ item.date }} · {{ item.duration }} min</view>
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
