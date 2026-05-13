<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    active?: boolean
    color?: string
  }>(),
  {
    active: false,
    color: '#ffffff'
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
        : { background: 'rgba(255,255,255,0.06)', color }
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
  border-radius: 24rpx;
  font-size: 24rpx;
  font-weight: 700;
  transition: all 0.2s ease;

  &--active {
    box-shadow: 0 4rpx 16rpx rgba(255, 80, 30, 0.4);
    transform: translateY(-2rpx);
  }
}
</style>
