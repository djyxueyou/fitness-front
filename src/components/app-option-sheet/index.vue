<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { isOptionSelected } from '@/utils/option-sheet'

export interface AppOptionSheetItem {
  value: string
  label: string
  description?: string
}

const themeStore = useThemeStore()

withDefaults(
  defineProps<{
    visible: boolean
    title: string
    subtitle?: string
    items: AppOptionSheetItem[]
    modelValue: string
    cancelText?: string
  }>(),
  {
    subtitle: '',
    cancelText: '取消'
  }
)

const emit = defineEmits<{
  close: []
  select: [value: string]
}>()
</script>

<template>
  <view
    v-if="visible"
    class="app-option-sheet__mask"
    :class="themeStore.themeClass"
    @tap="emit('close')"
  >
    <view class="app-option-sheet" @tap.stop>
      <view class="app-option-sheet__handle" />
      <view class="app-option-sheet__head">
        <view class="app-option-sheet__head-copy">
          <view class="app-option-sheet__title">{{ title }}</view>
          <view v-if="subtitle" class="app-option-sheet__subtitle">{{ subtitle }}</view>
        </view>
        <view class="app-option-sheet__close btn-press" aria-label="关闭选择" @tap="emit('close')">
          <image
            class="app-option-sheet__close-icon"
            src="/static/icons/x-mark.svg"
            mode="aspectFit"
          />
        </view>
      </view>

      <scroll-view scroll-y class="app-option-sheet__items">
        <view
          v-for="item in items"
          :key="item.value || '__empty__'"
          class="app-option-sheet__item btn-press"
          :class="{
            'app-option-sheet__item--selected': isOptionSelected(modelValue, item.value)
          }"
          @tap="emit('select', item.value)"
        >
          <view class="app-option-sheet__item-copy">
            <view class="app-option-sheet__item-label">{{ item.label }}</view>
            <view v-if="item.description" class="app-option-sheet__item-desc">
              {{ item.description }}
            </view>
          </view>
          <view
            v-if="isOptionSelected(modelValue, item.value)"
            class="app-option-sheet__selected-copy"
          >
            已选择
          </view>
        </view>
        <view class="app-option-sheet__items-bottom" />
      </scroll-view>

      <view class="app-option-sheet__cancel btn-press" @tap="emit('close')">
        {{ cancelText }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-option-sheet {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 181;
  height: 72vh;
  max-height: 880rpx;
  padding: 20rpx;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 34rpx;
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-focus);
  backdrop-filter: blur(18rpx);
  display: flex;
  flex-direction: column;

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 180;
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(8rpx);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 20rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
    flex-shrink: 0;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
    padding: 0 6rpx 18rpx;
    flex-shrink: 0;
  }

  &__head-copy {
    min-width: 0;
  }

  &__title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 900;
  }

  &__subtitle,
  &__item-desc {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 20rpx;
    background: var(--app-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__close-icon {
    width: 30rpx;
    height: 30rpx;
  }

  &__items {
    height: 0;
    min-height: 0;
    flex: 1;
  }

  &__item {
    min-height: 86rpx;
    margin-bottom: 12rpx;
    padding: 18rpx 20rpx;
    box-sizing: border-box;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
  }

  &__item--selected {
    background: var(--app-accent-soft);
    border-color: rgba(255, 100, 24, 0.38);
  }

  &__item-copy {
    min-width: 0;
  }

  &__item-label {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__item--selected &__item-label,
  &__selected-copy {
    color: var(--app-accent);
  }

  &__selected-copy {
    flex-shrink: 0;
    font-size: 22rpx;
    font-weight: 900;
  }

  &__items-bottom {
    height: 8rpx;
  }

  &__cancel {
    min-height: 78rpx;
    margin-top: 4rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    font-size: 26rpx;
    font-weight: 900;
    background: var(--app-bg);
    flex-shrink: 0;
  }
}
</style>
