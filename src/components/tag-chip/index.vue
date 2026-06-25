<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    active?: boolean
    color?: string
  }>(),
  {
    active: false,
    color: 'var(--app-text-secondary)'
  }
)
</script>

<template>
  <view
    class="tag-chip"
    :class="{ 'tag-chip--active': active }"
    :style="
      active
        ? { background: 'linear-gradient(135deg, #ff501e, #ff8c00)', color: '#ffffff' }
        : { color }
    "
  >
    {{ text }}
  </view>
</template>

<style lang="scss" scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 32rpx;
  border-radius: 999rpx;
  background: var(--app-surface);
  border: 1rpx solid var(--app-border);
  font-size: 24rpx;
  font-weight: 800;
  transition: all 0.2s ease;

  &--active {
    border-color: rgba(255, 80, 30, 0.42);
    box-shadow: 0 4rpx 16rpx rgba(255, 80, 30, 0.4);
  }
}
</style>
