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
        background: color || 'linear-gradient(135deg, #ff501e, #ffa03c)'
      }"
    />
  </view>
</template>

<style lang="scss" scoped>
.progress-bar {
  width: 100%;
  height: 12rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);

  &__fill {
    height: 100%;
    border-radius: inherit;
  }
}
</style>
