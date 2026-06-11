<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <view class="app-header">
    <view class="app-header__left">
      <view v-if="showBack" class="app-header__back btn-press" @tap="emit('back')">‹</view>
      <view class="app-header__copy">
        <view class="app-header__title">{{ title }}</view>
        <view v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</view>
      </view>
    </view>
    <view v-if="$slots.right" class="app-header__right">
      <slot name="right" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 24rpx;

  &__left {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__back {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f5f5fa;
    font-size: 46rpx;
    line-height: 1;
    flex-shrink: 0;
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    color: #f5f5fa;
    font-size: 42rpx;
    font-weight: 900;
    line-height: 1.2;
    text-shadow: 0 0 20rpx rgba(255, 255, 255, 0.1);
    word-break: break-word;
  }

  &__subtitle {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__right {
    flex-shrink: 0;
  }
}
</style>
