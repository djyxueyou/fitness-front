<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text?: string
    full?: boolean
    disabled?: boolean
    loading?: boolean
    variant?: 'default' | 'light'
  }>(),
  {
    text: '',
    full: true,
    disabled: false,
    loading: false,
    variant: 'default'
  }
)

const emit = defineEmits<{
  tap: []
}>()

function handleTap() {
  if (props.disabled || props.loading) return
  emit('tap')
}
</script>

<template>
  <view
    class="primary-button gradient-fire glow-primary btn-press"
    :class="{
      'primary-button--full': full,
      'primary-button--disabled': disabled || loading,
      'primary-button--light': variant === 'light'
    }"
    @tap="handleTap"
  >
    <view v-if="loading" class="primary-button__dot" />
    <slot>{{ loading ? '处理中...' : text }}</slot>
  </view>
</template>

<style lang="scss" scoped>
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 96rpx;
  border-radius: 28rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
  padding: 0 40rpx;
  letter-spacing: 0;
  transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 8rpx 32rpx rgba(255, 80, 30, 0.28);

  &--full {
    width: 100%;
  }

  &--disabled {
    opacity: 0.56;
    filter: grayscale(0.25);
  }

  &--light {
    background: var(--app-accent);
    box-shadow: var(--app-shadow-cta);
  }

  &__dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 0 14rpx rgba(255, 255, 255, 0.75);
  }

  &:active {
    transform: scale(0.98) translateY(2rpx);
    box-shadow: 0 4rpx 16rpx rgba(255, 80, 30, 0.34);
    opacity: 0.92;
  }
}
</style>
