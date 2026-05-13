<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    full?: boolean
  }>(),
  {
    text: '',
    full: true
  }
)
</script>

<template>
  <view
    class="primary-button gradient-fire glow-primary btn-press"
    :class="{ 'primary-button--full': full }"
  >
    <slot>{{ text }}</slot>
  </view>
</template>

<style lang="scss" scoped>
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 104rpx;
  border-radius: 32rpx;
  color: #fff;
  font-size: 32rpx;
  font-weight: 900;
  padding: 0 40rpx;
  letter-spacing: 2rpx;
  transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 8rpx 32rpx rgba(255, 80, 30, 0.3);

  &--full {
    width: 100%;
  }

  &:active {
    transform: scale(0.97) translateY(2rpx);
    box-shadow: 0 4rpx 16rpx rgba(255, 80, 30, 0.4);
    opacity: 0.9;
  }
}
</style>
