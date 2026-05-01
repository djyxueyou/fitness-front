<script setup lang="ts">
defineProps<{
  title: string
  actionText?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="section-title">
    <view class="section-title__text">{{ title }}</view>
    <view v-if="actionText" class="section-title__action" @tap="emit('action')">
      {{ actionText }}
    </view>
  </view>
</template>

<style lang="scss" scoped>
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;

  &__text {
    font-size: 30rpx;
    font-weight: 700;
  }

  &__action {
    color: #ff501e;
    font-size: 22rpx;
  }
}
</style>
