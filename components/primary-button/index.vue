<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  full?: boolean
}>(), {
  text: '',
  full: true
})
</script>

<template>
  <view class="primary-button gradient-fire glow-primary btn-press" :class="{ 'primary-button--full': full }">
    <slot>{{ text }}</slot>
  </view>
</template>

<style lang="scss" scoped>
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  border-radius: 28rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  padding: 0 28rpx;

  &--full {
    width: 100%;
  }
}
</style>
