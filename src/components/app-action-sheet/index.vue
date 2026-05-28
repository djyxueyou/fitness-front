<script setup lang="ts">
interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

defineProps<{
  visible: boolean
  title: string
  subtitle?: string
  items: ActionSheetItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [item: ActionSheetItem]
}>()
</script>

<template>
  <view v-if="visible" class="app-action-sheet__mask" @tap="emit('close')">
    <view class="app-action-sheet" @tap.stop>
      <view class="app-action-sheet__handle" />
      <view class="app-action-sheet__head">
        <view>
          <view class="app-action-sheet__title">{{ title }}</view>
          <view v-if="subtitle" class="app-action-sheet__subtitle">{{ subtitle }}</view>
        </view>
        <view class="app-action-sheet__close btn-press" @tap="emit('close')">×</view>
      </view>

      <view class="app-action-sheet__items">
        <view
          v-for="item in items"
          :key="item.key"
          class="app-action-sheet__item btn-press"
          :class="{
            'app-action-sheet__item--danger': item.danger,
            'app-action-sheet__item--primary': item.primary
          }"
          @tap="emit('select', item)"
        >
          <view class="app-action-sheet__item-copy">
            <view class="app-action-sheet__item-label">{{ item.label }}</view>
            <view v-if="item.description" class="app-action-sheet__item-desc">
              {{ item.description }}
            </view>
          </view>
          <view class="app-action-sheet__item-arrow">›</view>
        </view>
      </view>

      <view class="app-action-sheet__cancel btn-press" @tap="emit('close')">取消</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-action-sheet {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 91;
  padding: 20rpx;
  border-radius: 34rpx;
  background: rgba(16, 16, 24, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -24rpx 80rpx rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(18rpx);

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(8rpx);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 20rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.16);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
    padding: 0 6rpx 18rpx;
  }

  &__title {
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 900;
  }

  &__subtitle,
  &__item-desc {
    margin-top: 6rpx;
    color: #858599;
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #f5f5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    flex-shrink: 0;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__item {
    min-height: 86rpx;
    padding: 18rpx 20rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.07);

    &--primary {
      background: rgba(255, 80, 30, 0.14);
      border-color: rgba(255, 80, 30, 0.3);
    }

    &--danger {
      background: rgba(255, 77, 79, 0.11);
      border-color: rgba(255, 77, 79, 0.24);
    }
  }

  &__item-copy {
    min-width: 0;
  }

  &__item-label {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__item--primary &__item-label {
    color: #ff8a3d;
  }

  &__item--danger &__item-label {
    color: #ff6b4a;
  }

  &__item-arrow {
    color: #77778a;
    font-size: 38rpx;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__cancel {
    min-height: 78rpx;
    margin-top: 16rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b8b8c8;
    font-size: 26rpx;
    font-weight: 900;
    background: rgba(255, 255, 255, 0.075);
  }
}
</style>
