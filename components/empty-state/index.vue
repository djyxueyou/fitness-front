<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <view class="empty-state">
    <view class="empty-state__icon">{{ icon }}</view>
    <view class="empty-state__title">{{ title }}</view>
    <view v-if="description" class="empty-state__desc">{{ description }}</view>
  </view>
</template>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
  text-align: center;

  &__icon {
    font-size: 72rpx;
  }

  &__title {
    margin-top: 20rpx;
    font-size: 30rpx;
    font-weight: 700;
  }

  &__desc {
    margin-top: 8rpx;
    color: #828296;
    font-size: 24rpx;
  }
}
</style>
