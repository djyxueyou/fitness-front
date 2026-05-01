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
      <view>
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
    font-size: 34rpx;
    line-height: 1;
  }

  &__title {
    font-size: 38rpx;
    font-weight: 700;
    color: #f5f5fa;
    line-height: 1.2;
  }

  &__subtitle {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }
}
</style>
