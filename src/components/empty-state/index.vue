<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    actionText?: string
  }>(),
  {
    icon: '—',
    actionText: ''
  }
)

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="empty-state">
    <view class="empty-state__icon">{{ icon }}</view>
    <view class="empty-state__title">{{ title }}</view>
    <view v-if="description" class="empty-state__desc">{{ description }}</view>
    <view v-if="actionText" class="empty-state__action btn-press" @tap="emit('action')">
      {{ actionText }}
    </view>
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
  color: var(--app-text);

  &__icon {
    width: 96rpx;
    height: 96rpx;
    border-radius: 30rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.1);
    color: var(--app-accent);
    font-size: 44rpx;
  }

  &__title {
    margin-top: 20rpx;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 8rpx;
    max-width: 520rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    line-height: 1.55;
  }

  &__action {
    margin-top: 24rpx;
    min-height: 64rpx;
    padding: 0 28rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 80, 30, 0.28);
    font-size: 24rpx;
    font-weight: 800;
  }
}
</style>
