<script setup lang="ts">
defineProps<{
  icon?: string
  label: string
  value: string
  sub?: string
}>()
</script>

<template>
  <view class="glass-card stat-card">
    <view class="stat-card__meta">
      <text v-if="icon">{{ icon }}</text>
      <text class="stat-card__label">{{ label }}</text>
    </view>
    <view class="stat-card__value">{{ value }}</view>
    <view v-if="sub" class="stat-card__sub">{{ sub }}</view>
  </view>
</template>

<style lang="scss" scoped>
.stat-card {
  padding: 24rpx;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);
  border: 1px solid rgba(255, 255, 255, 0.05);

  &__meta {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 12rpx;
  }

  &__icon {
    width: 36rpx;
    height: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.1);
    border-radius: 8rpx;
    font-size: 20rpx;
  }

  &__label {
    color: #828296;
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 1rpx;
    text-transform: uppercase;
  }

  &__value {
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 800;
    text-shadow: 0 0 20rpx rgba(255, 255, 255, 0.1);
  }

  &__sub {
    margin-top: 6rpx;
    color: $color-primary-soft;
    font-size: 18rpx;
    font-weight: 600;
  }
}
</style>
