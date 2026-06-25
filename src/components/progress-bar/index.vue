<script setup lang="ts">
defineProps<{
  value: number
  color?: string
}>()
</script>

<template>
  <view class="progress-bar">
    <view
      class="progress-bar__fill"
      :style="{
        width: `${Math.max(0, Math.min(100, value * 100))}%`,
        background: color || 'linear-gradient(90deg, #ff501e, #ff8c00)'
      }"
    />
  </view>
</template>

<style lang="scss" scoped>
.progress-bar {
  width: 100%;
  height: 14rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: var(--app-border);
  box-shadow: inset 0 1rpx 3rpx rgba(31, 49, 72, 0.12);

  &__fill {
    height: 100%;
    border-radius: inherit;
    box-shadow: 0 0 16rpx rgba(255, 80, 30, 0.5);
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}
</style>
