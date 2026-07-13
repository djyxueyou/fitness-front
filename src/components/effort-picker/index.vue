<script setup lang="ts">
import type { WorkoutEffort } from '@/stores/workout'

defineProps<{ visible: boolean }>()
defineEmits<{ close: []; select: [effort: WorkoutEffort] }>()

const options: Array<{ value: WorkoutEffort; label: string; desc: string }> = [
  { value: 'RIR_4_PLUS', label: '轻松', desc: '还能完成 4 次以上' },
  { value: 'RIR_2_3', label: '适中', desc: '还能完成 2–3 次' },
  { value: 'RIR_1', label: '接近极限', desc: '还能完成 1 次' },
  { value: 'RIR_0', label: '力竭完成', desc: '无法再完成 1 次' },
  { value: 'FAILED', label: '未完成', desc: '本组没有完成目标' }
]
</script>

<template>
  <view v-if="visible" class="effort-picker" @tap="$emit('close')">
    <view class="effort-picker__sheet" @tap.stop>
      <view class="effort-picker__handle" />
      <view class="effort-picker__title">最后一组感觉如何？</view>
      <view class="effort-picker__sub">用于优化下次训练建议，可跳过</view>
      <view
        v-for="option in options"
        :key="option.value"
        class="effort-picker__option btn-press"
        @tap="$emit('select', option.value)"
      >
        <view class="effort-picker__label">{{ option.label }}</view>
        <view class="effort-picker__desc">{{ option.desc }}</view>
      </view>
      <view class="effort-picker__skip btn-press" @tap="$emit('close')">暂不记录</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.effort-picker {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog, 120);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;

  &__sheet {
    width: 100%;
    padding: 30rpx 30rpx calc(env(safe-area-inset-bottom) + 28rpx);
    border-radius: 34rpx 34rpx 0 0;
    background: var(--app-surface-warm);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-floating);
  }

  &__handle {
    width: 72rpx;
    height: 7rpx;
    margin: 0 auto 24rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
  }

  &__title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 900;
  }

  &__sub {
    margin: 8rpx 0 20rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__option {
    padding: 14rpx 18rpx;
    margin-top: 10rpx;
    border-radius: 20rpx;
    background: var(--app-surface-raised);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-card);
  }

  &__label {
    color: var(--app-text);
    font-size: 25rpx;
    font-weight: 800;
  }

  &__desc {
    margin-top: 4rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
  }

  &__skip {
    margin-top: 18rpx;
    padding: 18rpx;
    text-align: center;
    color: var(--app-text-secondary);
  }
}
</style>
