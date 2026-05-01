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

  &__meta {
    display: flex;
    align-items: center;
    gap: 8rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__label,
  &__sub {
    color: #828296;
    font-size: 20rpx;
  }

  &__value {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 700;
  }

  &__sub {
    margin-top: 6rpx;
  }
}
</style>
