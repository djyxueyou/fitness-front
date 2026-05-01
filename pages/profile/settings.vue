<script setup lang="ts">
import AppHeader from '@/components/app-header/index.vue'
import ToggleSwitch from '@/components/toggle-switch/index.vue'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="设置" show-back @back="goBack" />

      <view class="glass-card settings__item">
        <view class="settings__icon">🔔</view>
        <view class="settings__body">
          <view class="settings__title">训练提醒</view>
          <view class="settings__sub">定时提醒你保持训练节奏</view>
        </view>
        <ToggleSwitch v-model="profileStore.notifications" />
      </view>

      <view class="glass-card settings__item">
        <view class="settings__icon">🌙</view>
        <view class="settings__body">
          <view class="settings__title">深色模式</view>
          <view class="settings__sub">当前：{{ profileStore.darkMode ? '深色' : '浅色' }}</view>
        </view>
        <ToggleSwitch v-model="profileStore.darkMode" />
      </view>

      <view class="glass-card settings__item">
        <view class="settings__icon">⚖️</view>
        <view class="settings__body">
          <view class="settings__title">重量单位</view>
          <view class="settings__sub">当前：{{ profileStore.unit }}</view>
        </view>
        <view class="settings__segmented">
          <view class="settings__segment" :class="{ 'settings__segment--active': profileStore.unit === 'kg' }" @tap="profileStore.unit = 'kg'">kg</view>
          <view class="settings__segment" :class="{ 'settings__segment--active': profileStore.unit === 'lb' }" @tap="profileStore.unit = 'lb'">lb</view>
        </view>
      </view>

      <view class="glass-card settings__item btn-press">
        <view class="settings__icon">🗑</view>
        <view class="settings__body">
          <view class="settings__title settings__title--danger">清除所有数据</view>
          <view class="settings__sub">此操作不可恢复</view>
        </view>
        <view class="settings__arrow">›</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.settings {
  &__item {
    padding: 24rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 16rpx;
  }

  &__icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    flex: 1;
  }

  &__title {
    font-size: 28rpx;
    font-weight: 700;

    &--danger {
      color: #ff501e;
    }
  }

  &__sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__segmented {
    display: flex;
    border-radius: 20rpx;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__segment {
    min-width: 72rpx;
    min-height: 52rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #828296;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
    }
  }

  &__arrow {
    color: #828296;
    font-size: 32rpx;
  }
}
</style>
