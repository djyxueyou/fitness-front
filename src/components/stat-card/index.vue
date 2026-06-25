<script setup lang="ts">
defineProps<{
  icon?: string
  label: string
  value: string
  sub?: string
}>()
</script>

<template>
  <view class="surface-card stat-card">
    <view class="stat-card__meta">
      <text v-if="icon" class="stat-card__icon">{{ icon }}</text>
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
    color: var(--app-accent);
  }

  &__label {
    color: var(--app-text-muted);
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 1rpx;
    text-transform: uppercase;
  }

  &__value {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__sub {
    margin-top: 6rpx;
    color: $color-primary-soft;
    font-size: 18rpx;
    font-weight: 800;
  }
}
</style>
