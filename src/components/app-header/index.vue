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
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text);
    font-size: 46rpx;
    line-height: 1;
    flex-shrink: 0;
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    color: var(--app-text);
    font-size: 42rpx;
    font-weight: 900;
    line-height: 1.2;
    text-shadow: none;
    word-break: break-word;
  }

  &__subtitle {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__right {
    flex-shrink: 0;
  }
}
</style>
